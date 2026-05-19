/**
 * @file utils/categoryNormalization.js
 *
 * Provides shared standard category normalization on the frontend.
 */

export const CATEGORY_ALIASES = {
    food: ['food', 'eat', 'dining', 'restaurant', 'lunch', 'dinner', 'breakfast', 'meal', 'snack', 'cafe', 'coffee'],
    transport: ['transport', 'travel', 'fuel', 'petrol', 'uber', 'ola', 'cab', 'taxi', 'metro', 'bus', 'train', 'flight'],
    shopping: ['shopping', 'shop', 'buy', 'purchase', 'amazon', 'flipkart', 'clothes', 'gadget', 'electronics'],
    entertainment: ['entertainment', 'movie', 'netflix', 'spotify', 'game', 'fun', 'party', 'concert'],
    bills: ['bill', 'bills', 'utility', 'electricity', 'water', 'rent', 'recharge', 'subscription', 'internet', 'phone'],
    health: ['health', 'medical', 'hospital', 'doctor', 'medicine', 'pharmacy', 'gym', 'fitness'],
    education: ['education', 'course', 'book', 'study', 'tuition', 'school', 'college', 'learn'],
    groceries: ['grocery', 'groceries', 'vegetable', 'fruit', 'provisions', 'supermarket'],
    subscriptions: ['subscription', 'subscriptions'],
    travel: ['travel', 'flight', 'hotel', 'airbnb', 'trip', 'vacation'],
    other: ['other', 'uncategorized'],
};

export function normalizeCategory(category) {
    if (!category || typeof category !== 'string') return 'other';
    const trimmed = category.trim().toLowerCase();

    // Direct mapping match
    if (trimmed === 'food') return 'food';
    if (trimmed === 'transport') return 'transport';
    if (trimmed === 'shopping') return 'shopping';
    if (trimmed === 'entertainment') return 'entertainment';
    if (trimmed === 'bills') return 'bills';
    if (trimmed === 'health') return 'health';
    if (trimmed === 'education') return 'education';
    if (trimmed === 'groceries') return 'groceries';
    if (trimmed === 'subscriptions') return 'subscriptions';
    if (trimmed === 'travel') return 'travel';
    if (trimmed === 'other') return 'other';

    // Substring / Aliases match
    for (const [standardCat, aliases] of Object.entries(CATEGORY_ALIASES)) {
        for (const alias of aliases) {
            if (trimmed.includes(alias)) {
                return standardCat;
            }
        }
    }

    return 'other';
}
