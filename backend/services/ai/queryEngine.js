import Expense from '../../models/Expense.js';

// ── Category aliases ──
const CATEGORY_ALIASES = {
    food: ['food', 'eat', 'dining', 'restaurant', 'lunch', 'dinner', 'breakfast', 'meal', 'snack', 'cafe', 'coffee'],
    transport: ['transport', 'travel', 'fuel', 'petrol', 'uber', 'ola', 'cab', 'taxi', 'metro', 'bus', 'train', 'flight'],
    shopping: ['shopping', 'shop', 'buy', 'purchase', 'amazon', 'flipkart', 'clothes', 'gadget', 'electronics'],
    entertainment: ['entertainment', 'movie', 'netflix', 'spotify', 'game', 'fun', 'party', 'concert'],
    bills: ['bill', 'bills', 'utility', 'electricity', 'water', 'rent', 'recharge', 'subscription', 'internet', 'phone'],
    health: ['health', 'medical', 'hospital', 'doctor', 'medicine', 'pharmacy', 'gym', 'fitness'],
    education: ['education', 'course', 'book', 'study', 'tuition', 'school', 'college', 'learn'],
    groceries: ['grocery', 'groceries', 'vegetable', 'fruit', 'provisions', 'supermarket'],
};

// ── Date range parser ──
function parseDateRange(text) {
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
        const day = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        return { start, end: now, label: 'this week' };
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
function parseCategory(text) {
    const lower = text.toLowerCase();
    for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
        for (const alias of aliases) {
            if (lower.includes(alias)) return cat;
        }
    }
    return null;
}

// ── Merchant parser ──
function parseMerchant(text) {
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
        userId,
        isDeleted: false,
        date: { $gte: dateRange.start, $lte: dateRange.end },
    };

    if (category) matchStage.category = category;
    if (merchant) matchStage.merchantNormalized = { $regex: merchant, $options: 'i' };

    const [result] = await Expense.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalSpent: { $sum: '$amount' },
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
        topCategories = await Expense.aggregate([
            { $match: matchStage },
            { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
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
        category: category || 'all',
        dateRange: dateRange.label,
        topCategories: topCategories.map(c => ({
            category: c._id,
            total: Math.round(c.total),
            count: c.count,
        })),
    };
}
