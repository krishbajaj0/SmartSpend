import mongoose from 'mongoose';
import Transaction from '../../models/Transaction.js';
import { ACTIVE_TRANSACTION_FILTER } from '../../config/constants.js';
import { CATEGORY_ALIASES, normalizeCategory } from '../../utils/categoryNormalization.js';

// ── Date range parser ──
export function parseDateRange(text) {
    const now = new Date();
    const lower = text.toLowerCase();

    if (/today/.test(lower)) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { start, end: now, label: 'today' };
    }
    if (/yesterday/.test(lower)) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        return { start, end, label: 'yesterday' };
    }
    if (/this\s*week/.test(lower)) {
        // Users usually expect "this week" to mean the last 7 days when asking a bot, 
        // especially early in the week.
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { start, end: now, label: 'last 7 days' };
    }
    if (/last\s*week/.test(lower)) {
        const day = now.getDay();
        const end = new Date(now);
        end.setDate(now.getDate() - day - 1);
        end.setHours(23, 59, 59);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return { start, end, label: 'last week' };
    }
    if (/this\s*month/.test(lower)) {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: now, label: 'this month' };
    }
    if (/last\s*month/.test(lower)) {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { start, end, label: 'last month' };
    }
    if (/this\s*year/.test(lower)) {
        const start = new Date(now.getFullYear(), 0, 1);
        return { start, end: now, label: 'this year' };
    }
    if (/last\s*year/.test(lower)) {
        const start = new Date(now.getFullYear() - 1, 0, 1);
        const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        return { start, end, label: 'last year' };
    }

    // "last N days/weeks/months"
    const lastN = lower.match(/last\s*(\d+)\s*(day|week|month)s?/);
    if (lastN) {
        const n = parseInt(lastN[1]);
        const unit = lastN[2];
        const start = new Date(now);
        if (unit === 'day') start.setDate(now.getDate() - n);
        else if (unit === 'week') start.setDate(now.getDate() - n * 7);
        else if (unit === 'month') start.setMonth(now.getMonth() - n);
        start.setHours(0, 0, 0, 0);
        return { start, end: now, label: `last ${n} ${unit}s` };
    }

    // Default: last 30 days
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { start, end: now, label: 'last 30 days' };
}

// ── Category parser ──
export function parseCategory(text) {
    const lower = text.toLowerCase();
    for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
        for (const alias of aliases) {
            if (lower.includes(alias)) return normalizeCategory(cat);
        }
    }
    return null;
}

// ── Merchant parser ──
export function parseMerchant(text) {
    const lower = text.toLowerCase();
    const atMatch = lower.match(/(?:at|from|on)\s+([a-z\s]+?)(?:\s+(?:last|this|today|yesterday|in)|\?|$)/);
    if (atMatch) return atMatch[1].trim();
    return null;
}

/**
 * Process a natural language spending query.
 */
export async function processQuery(userId, query) {
    const category = parseCategory(query);
    const dateRange = parseDateRange(query);
    const merchant = parseMerchant(query);

    const matchStage = {
        userId: new mongoose.Types.ObjectId(userId),
        type: 'EXPENSE',
        ...ACTIVE_TRANSACTION_FILTER,
        date: { $gte: dateRange.start, $lte: dateRange.end },
    };

    if (category) {
        matchStage.category = { $regex: `^${category}$`, $options: 'i' };
    }
    
    if (merchant) {
        matchStage.$or = [
            { merchantNormalized: { $regex: merchant, $options: 'i' } },
            { note: { $regex: merchant, $options: 'i' } }
        ];
    } else {
        // Fallback: If no explicit merchant keyword found, search the whole query against merchantNormalized
        // but exclude filler/query words to isolate potential merchant names
        const FILLER_WORDS = /\b(spent|spend|spending|overspend|overspending|budget|balance|trend|trends|compare|break|down|by|category|categories|chart|pie|summarize|summary|breakdown|stats|statistics|insights|analyze|analysis|group|how|much|too|total|show|me|my|i|did|do|on|in|for|what|all|the|a|an|is|was|were|have|has|had|am|are|been|being|get|got|last|this|today|yesterday|week|month|year|days|weeks|months|years|tell|give|list|find|search|query|about|from|to|at|of|with|it|its|and|or|but|not|no|so|if|can|will|would|could|should|may|might|shall|overall|since|until|till|recent|recently|past|during|expenses?|transactions?|money|rupees?|rs|inr)\b/gi;
        const cleanQuery = query
            .replace(FILLER_WORDS, '')
            .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
            .replace(/\s+/g, ' ')              // Collapse whitespace
            .trim();
        
        const wordCount = cleanQuery.split(' ').filter(w => w.length > 0).length;
        
        if (cleanQuery.length > 2 && !category && wordCount <= 3) {
            matchStage.$or = [
                { merchantNormalized: { $regex: cleanQuery, $options: 'i' } },
                { note: { $regex: cleanQuery, $options: 'i' } }
            ];
        }
    }

    const [result] = await Transaction.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalSpent: { $sum: { $ifNull: ['$baseAmount', '$amount'] } },
                transactionCount: { $sum: 1 },
                avgAmount: { $avg: '$amount' },
                maxAmount: { $max: '$amount' },
                minAmount: { $min: '$amount' },
            },
        },
    ]);

    // Get top categories if no specific category queried
    let topCategories = [];
    if (!category) {
        topCategories = await Transaction.aggregate([
            { $match: matchStage },
            { $group: { _id: { $toLower: '$category' }, total: { $sum: { $ifNull: ['$baseAmount', '$amount'] } }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 5 },
        ]);
    }

    const totalSpent = Math.round(result?.totalSpent || 0);
    const transactionCount = result?.transactionCount || 0;

    // Generate natural language response
    let response = '';
    if (totalSpent === 0) {
        response = category
            ? `You haven't spent anything on ${category} ${dateRange.label}.`
            : `No spending found for ${dateRange.label}.`;
    } else if (category) {
        response = `You spent ₹${totalSpent.toLocaleString('en-IN')} on ${category} ${dateRange.label} across ${transactionCount} transaction${transactionCount > 1 ? 's' : ''}.`;
    } else if (merchant) {
        response = `You spent ₹${totalSpent.toLocaleString('en-IN')} at ${merchant} ${dateRange.label}.`;
    } else {
        response = `You spent ₹${totalSpent.toLocaleString('en-IN')} in total ${dateRange.label} across ${transactionCount} transaction${transactionCount > 1 ? 's' : ''}.`;
    }

    return {
        query,
        response,
        totalSpent,
        transactionCount,
        avgAmount: Math.round(result?.avgAmount || 0),
        filters: {
            category: category || null,
            merchant: merchant || null,
            dateRange: {
                start: dateRange.start,
                end: dateRange.end,
                label: dateRange.label
            }
        },
        topCategories: topCategories.map(c => ({
            category: c._id,
            total: Math.round(c.total),
            count: c.count,
        })),
    };
}
