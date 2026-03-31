import { subDays, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

// ── Categories ──
export const categories = [
    'food', 'transport', 'bills', 'shopping',
    'entertainment', 'health', 'education', 'travel',
    'groceries', 'subscriptions', 'other',
];

// ── Mock Expenses ──
const merchants = {
    food: ['Zomato', 'Swiggy', 'KFC', 'Dominos', "McDonald's", 'Café Coffee Day'],
    transport: ['Uber', 'Ola', 'Metro Card', 'Petrol Pump', 'Rapido'],
    bills: ['Electricity Board', 'Jio Recharge', 'Water Bill', 'Gas Bill'],
    shopping: ['Amazon', 'Flipkart', 'Myntra', 'DMart', 'Croma'],
    entertainment: ['Netflix', 'Disney+', 'PVR Cinemas', 'BookMyShow', 'Spotify'],
    health: ['Apollo Pharmacy', 'Dr. Sharma Clinic', 'Gym Membership', 'Meditation App'],
    education: ['Udemy', 'Coursera', 'Book Store', 'Stationery'],
    travel: ['MakeMyTrip', 'IRCTC', 'Airbnb', 'Booking.com'],
    groceries: ['BigBasket', 'Blinkit', 'Zepto', 'DMart'],
    subscriptions: ['YouTube Premium', 'iCloud', 'GitHub Pro', 'Notion'],
    other: ['ATM Withdrawal', 'Gift', 'Donation', 'Miscellaneous'],
};

function randomAmount(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateExpenses(count = 50) {
    const expenses = [];
    for (let i = 0; i < count; i++) {
        const category = randomPick(categories);
        const merchant = randomPick(merchants[category]);
        const daysAgo = Math.floor(Math.random() * 90);
        const date = subDays(new Date(), daysAgo);

        const amountRanges = {
            food: [50, 800], transport: [30, 500], bills: [200, 3000],
            shopping: [200, 5000], entertainment: [100, 1500], health: [100, 2000],
            education: [200, 3000], travel: [500, 8000], groceries: [100, 2000],
            subscriptions: [100, 999], other: [50, 2000],
        };

        const [min, max] = amountRanges[category];

        expenses.push({
            id: `exp-${i + 1}`,
            amount: randomAmount(min, max),
            category,
            merchant,
            date: date.toISOString(),
            notes: '',
            tags: [],
            isRecurring: Math.random() > 0.85,
            receiptUrl: null,
        });
    }
    return expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const mockExpenses = generateExpenses(60);

// ── Summary Stats ──
const thisMonthExpenses = mockExpenses.filter(e => {
    const d = new Date(e.date);
    const now = new Date();
    return d >= startOfMonth(now) && d <= endOfMonth(now);
});

export const summaryStats = {
    totalSpent: thisMonthExpenses.reduce((s, e) => s + e.amount, 0),
    monthBudget: 30000,
    transactionCount: thisMonthExpenses.length,
    savings: 8500,
};

// ── Spending Trend Data (last 30 days) ──
export function getSpendingTrend(days = 30) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStr = format(date, 'yyyy-MM-dd');
        const dayExpenses = mockExpenses.filter(
            e => format(new Date(e.date), 'yyyy-MM-dd') === dayStr
        );
        result.push({
            date: format(date, 'MMM dd'),
            amount: dayExpenses.reduce((s, e) => s + e.amount, 0),
        });
    }
    return result;
}

// ── Category Breakdown ──
export function getCategoryBreakdown() {
    const breakdown = {};
    thisMonthExpenses.forEach(e => {
        breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
    });
    return Object.entries(breakdown)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value);
}

// ── Budget Data ──
export const budgets = [
    { category: 'food', limit: 5000 },
    { category: 'transport', limit: 3000 },
    { category: 'bills', limit: 4000 },
    { category: 'shopping', limit: 4000 },
    { category: 'entertainment', limit: 2000 },
    { category: 'health', limit: 1500 },
    { category: 'groceries', limit: 3500 },
    { category: 'subscriptions', limit: 1500 },
].map(b => {
    const spent = thisMonthExpenses
        .filter(e => e.category === b.category)
        .reduce((s, e) => s + e.amount, 0);
    return { ...b, spent: Math.round(spent) };
});

// ── Chart Colors ──
export const CHART_COLORS = [
    '#6c5ce7', '#00cec9', '#ff7675', '#fdcb6e',
    '#00b894', '#a29bfe', '#fd79a8', '#0984e3',
    '#55efc4', '#e17055', '#74b9ff',
];
