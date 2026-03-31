import Expense from '../../models/Expense.js';

// ── Tier 1: Exact merchant→category map ──
const MERCHANT_MAP = {
    zomato: 'food', swiggy: 'food', 'uber eats': 'food', dominos: 'food',
    starbucks: 'food', mcdonalds: 'food', subway: 'food', kfc: 'food',
    'cafe coffee day': 'food', 'chai point': 'food',
    uber: 'transport', ola: 'transport', rapido: 'transport', metro: 'transport',
    irctc: 'transport', blablacar: 'transport',
    netflix: 'entertainment', spotify: 'entertainment', hotstar: 'entertainment',
    pvr: 'entertainment', inox: 'entertainment', bookmyshow: 'entertainment',
    amazon: 'shopping', flipkart: 'shopping', myntra: 'shopping', ajio: 'shopping',
    reliance: 'shopping', croma: 'shopping',
    apollo: 'health', practo: 'health', '1mg': 'health', netmeds: 'health', pharmeasy: 'health',
    'big bazaar': 'groceries', dmart: 'groceries', 'nature basket': 'groceries',
    bigbasket: 'groceries', grofers: 'groceries', zepto: 'groceries', blinkit: 'groceries',
    airtel: 'bills', jio: 'bills', vodafone: 'bills', bsnl: 'bills',
    electricity: 'bills', 'water bill': 'bills', broadband: 'bills',
    coursera: 'education', udemy: 'education', skillshare: 'education',
    byju: 'education', unacademy: 'education',
};

// ── Tier 2: Keyword→category mapping ──
const KEYWORD_MAP = {
    food: ['restaurant', 'cafe', 'diner', 'pizza', 'burger', 'biryani', 'food', 'meal', 'lunch', 'dinner', 'breakfast', 'snack', 'bakery', 'sweet'],
    transport: ['fuel', 'petrol', 'diesel', 'parking', 'toll', 'cab', 'taxi', 'auto', 'bus', 'train', 'flight', 'travel'],
    shopping: ['mall', 'store', 'mart', 'shop', 'fashion', 'clothing', 'electronics', 'gadget'],
    health: ['hospital', 'clinic', 'doctor', 'pharma', 'medicine', 'medical', 'dental', 'lab', 'test'],
    entertainment: ['movie', 'cinema', 'game', 'concert', 'party', 'club', 'fun', 'play', 'sports'],
    bills: ['bill', 'recharge', 'payment', 'subscription', 'insurance', 'premium', 'rent', 'emi'],
    education: ['school', 'college', 'course', 'tuition', 'book', 'exam', 'study', 'learn'],
    groceries: ['grocery', 'vegetable', 'fruit', 'milk', 'dairy', 'provisions'],
};

/**
 * Multi-tier AI categorization for expenses.
 */
export async function categorizeExpense(userId, merchant, notes = '', amount = 0) {
    const merchantLower = (merchant || '').toLowerCase().trim();
    const notesLower = (notes || '').toLowerCase().trim();
    const searchText = `${merchantLower} ${notesLower}`;

    // Tier 1: Exact merchant match
    for (const [key, cat] of Object.entries(MERCHANT_MAP)) {
        if (merchantLower.includes(key)) {
            return { category: cat, confidence: 1.0, tier: 1 };
        }
    }

    // Tier 2: Fuzzy keyword matching
    let bestKeywordMatch = null;
    let bestScore = 0;
    for (const [cat, keywords] of Object.entries(KEYWORD_MAP)) {
        for (const kw of keywords) {
            if (searchText.includes(kw)) {
                const score = kw.length / searchText.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestKeywordMatch = cat;
                }
            }
        }
    }
    if (bestKeywordMatch) {
        return { category: bestKeywordMatch, confidence: 0.7 + bestScore * 0.2, tier: 2 };
    }

    // Tier 3: User history learning
    if (userId) {
        const pastExpenses = await Expense.find({
            userId,
            merchantNormalized: merchantLower,
            aiCategorized: false, // user-set categories only
            isDeleted: false,
        }).sort({ date: -1 }).limit(5);

        if (pastExpenses.length > 0) {
            const catCounts = {};
            pastExpenses.forEach(e => {
                catCounts[e.category] = (catCounts[e.category] || 0) + 1;
            });
            const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
            const confidence = 0.8 + (topCat[1] / pastExpenses.length) * 0.15;
            return { category: topCat[0], confidence: Math.min(confidence, 0.95), tier: 3 };
        }
    }

    // Tier 4: Amount-based heuristics
    if (amount > 0) {
        if (amount < 200) return { category: 'food', confidence: 0.4, tier: 4 };
        if (amount < 500) return { category: 'transport', confidence: 0.4, tier: 4 };
        if (amount > 5000) return { category: 'shopping', confidence: 0.45, tier: 4 };
        if (amount > 1000) return { category: 'bills', confidence: 0.4, tier: 4 };
    }

    return { category: 'other', confidence: 0.3, tier: 4 };
}
