/**
 * @file utils/demoSeeder.js
 * @description Seeder script to build a highly realistic, professional MERN fintech demo dataset.
 * Includes deterministic seeding (PRNG Mulberry32), mathematically consistent ledger balances,
 * Indian fintech merchants, smart weekly distributions, and detailed portfolio data (SIPs, EMIs, CRED cashbacks).
 */

import User from '../models/User.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import SavingsGoal from '../models/SavingsGoal.js';
import Receipt from '../models/Receipt.js';
import ChatMessage from '../models/ChatMessage.js';
import Notification from '../models/Notification.js';
import LoginActivityLog from '../models/LoginActivityLog.js';
import logger from '../config/logger.js';
import bcrypt from 'bcrypt';
import constants from '../config/constants.js';

// Centralised constants imported from constants.js configuration
const DEMO_EMAIL = constants.demo.email;
const DEMO_PASSWORD = constants.demo.password;
const SHOWCASE_MODE = constants.demo.showcaseMode;

/**
 * A robust, deterministic, seeded Mulberry32 pseudo-random number generator
 * to ensure that all generated graphs, pie-charts, and transactions are identical
 * across database rebuilds/resets. This provides predictable visual excellence for screenshots.
 */
function createSeededRandom(seed = 0x31337) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Seeds or resets all financial data for the premium demo user.
 * @param {boolean} forceReset - If true, clears any existing data for the demo user and seeds fresh.
 */
export async function seedDemoData(forceReset = false) {
    try {
        logger.info(`Starting Demo Seeding (forceReset: ${forceReset}, showcase: ${SHOWCASE_MODE})…`);

        // Initialize our seeded PRNG (deterministic seed)
        const random = createSeededRandom(987654321);

        // 1. Create or retrieve the User
        let user = await User.findOne({ email: DEMO_EMAIL }).select('+passwordHash +tokenVersion');

        if (user && !forceReset) {
            logger.info('Demo user already exists and forceReset is false. Skipping seed.');
            return user;
        }

        // If forceReset is true and user exists, clean all associated records
        if (user) {
            logger.info(`Cleaning old records for existing user: ${user.email}…`);
            // Clear avatar on reset
            user.avatar = '';
            await user.save();
            await Promise.all([
                Account.deleteMany({ userId: user._id }),
                Transaction.deleteMany({ userId: user._id }),
                Budget.deleteMany({ userId: user._id }),
                SavingsGoal.deleteMany({ userId: user._id }),
                Receipt.deleteMany({ userId: user._id }),
                ChatMessage.deleteMany({ userId: user._id }),
                Notification.deleteMany({ userId: user._id }),
                LoginActivityLog.deleteMany({ userId: user._id })
            ]);
        } else {
            // Create user
            logger.info(`Creating fresh demo user: ${DEMO_EMAIL}…`);
            const passwordHash = await bcrypt.hash(DEMO_PASSWORD, constants.bcryptSaltRounds);
            user = await User.create({
                name: 'Alex Johnson',
                email: DEMO_EMAIL,
                passwordHash,
                avatar: '',
                avatarProvider: 'local',
                provider: 'local',
                providers: ['local'],
                currency: 'INR',
                themePreference: 'dark',
                monthlyIncomeEstimate: 120000,
                isVerified: true,
                emailVerifiedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
                createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
                notificationPreferences: {
                    email: true,
                    push: true,
                    budgetAlerts: true,
                    weeklyReport: true,
                    aiInsights: true
                }
            });
        }

        const userId = user._id;

        // 2. Create multiple accounts
        logger.info('Creating demo financial accounts…');
        const accountsData = [
            {
                userId,
                name: 'HDFC Savings Account',
                type: 'BANK',
                balance: 0, // Will be computed dynamically below for absolute mathematical integrity
                bankName: 'HDFC Bank',
                accountNumber: 'XXXXXX9824',
                currency: 'INR'
            },
            {
                userId,
                name: 'ICICI Credit Card',
                type: 'CREDIT_CARD',
                balance: 0, // Will be computed dynamically below
                creditLimit: 150000,
                bankName: 'ICICI Bank',
                accountNumber: 'XXXXXX5012',
                currency: 'INR'
            },
            {
                userId,
                name: 'Paytm Wallet',
                type: 'WALLET',
                balance: 0, // Will be computed dynamically below
                currency: 'INR'
            },
            {
                userId,
                name: 'Emergency Savings',
                type: 'BANK',
                balance: 0, // Will be computed dynamically below
                bankName: 'SBI',
                accountNumber: 'XXXXXX1190',
                currency: 'INR'
            }
        ];

        const [hdfc, icici, paytm, emergency] = await Account.insertMany(accountsData);

        // 3. Initialize ledger balances 180 days ago in memory for mathematical accumulation
        const currentBalances = {
            [hdfc._id.toString()]: 75200.00,
            [icici._id.toString()]: -2450.80,
            [paytm._id.toString()]: 2200.00,
            [emergency._id.toString()]: 100000.00
        };

        // 4. Generate Transactions spread across the last 6 months (180 days)
        logger.info('Generating 6 months of premium financial transactions…');
        const transactions = [];

        const today = new Date();
        const startDaysAgo = 180;

        for (let day = startDaysAgo; day >= 0; day--) {
            const currentDate = new Date();
            currentDate.setDate(today.getDate() - day);
            
            const monthDay = currentDate.getDate();
            const year = currentDate.getFullYear();
            const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // A. Monthly Salary Credit (1st of every month)
            if (monthDay === 1) {
                transactions.push({
                    userId,
                    type: 'INCOME',
                    amount: 120000,
                    currency: 'INR',
                    toAccountId: hdfc._id,
                    category: 'other',
                    subCategory: 'Salary',
                    merchant: 'TechSolutions Corp',
                    note: `Monthly Salary Credit - ${currentDate.toLocaleString('default', { month: 'long' })} ${year}`,
                    date: new Date(currentDate.setHours(9, 0, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // B. Monthly Freelance Retainer (15th of every month)
            if (monthDay === 15) {
                transactions.push({
                    userId,
                    type: 'INCOME',
                    amount: 25000,
                    currency: 'INR',
                    toAccountId: hdfc._id,
                    category: 'other',
                    subCategory: 'Freelancing',
                    merchant: 'Upwork Global',
                    note: 'React UI Design Consulting retainer',
                    date: new Date(currentDate.setHours(11, 30, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // C. Monthly Rent Payment (3rd of every month)
            if (monthDay === 3) {
                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: 25000,
                    currency: 'INR',
                    fromAccountId: hdfc._id,
                    category: 'bills',
                    subCategory: 'Rent',
                    merchant: 'Landlord Sharma',
                    note: `Apartment Rent for ${currentDate.toLocaleString('default', { month: 'long' })}`,
                    date: new Date(currentDate.setHours(10, 15, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // D. Monthly Auto Mutual Fund SIP (10th of every month)
            if (monthDay === 10) {
                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: 15000,
                    currency: 'INR',
                    fromAccountId: hdfc._id,
                    category: 'other',
                    subCategory: 'Investments',
                    merchant: 'Zerodha Coin',
                    note: 'Nifty 50 Index Fund SIP Investment',
                    date: new Date(currentDate.setHours(8, 45, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // E. Monthly Auto Car Loan EMI (7th of every month) [High Value Portfolio Data]
            if (monthDay === 7) {
                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: 12500,
                    currency: 'INR',
                    fromAccountId: hdfc._id,
                    category: 'bills',
                    subCategory: 'EMI',
                    merchant: 'HDFC Bank Loans',
                    note: 'Car Loan EMI Auto-debit',
                    date: new Date(currentDate.setHours(12, 0, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // F. Monthly Netflix Subscription (12th of every month)
            if (monthDay === 12) {
                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: 649,
                    currency: 'INR',
                    fromAccountId: icici._id,
                    category: 'subscriptions',
                    subCategory: 'Entertainment',
                    merchant: 'Netflix India',
                    note: 'Netflix 4K UHD Plan Renewal',
                    date: new Date(currentDate.setHours(2, 10, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // G. Monthly Spotify Subscription (20th of every month)
            if (monthDay === 20) {
                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: 119,
                    currency: 'INR',
                    fromAccountId: paytm._id,
                    category: 'subscriptions',
                    subCategory: 'Music',
                    merchant: 'Spotify Premium',
                    note: 'Individual Premium Account Subscription',
                    date: new Date(currentDate.setHours(1, 45, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // H. Monthly Broadband & Jio Recharge (5th of every month)
            if (monthDay === 5) {
                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: 749,
                    currency: 'INR',
                    fromAccountId: paytm._id,
                    category: 'bills',
                    subCategory: 'Mobile',
                    merchant: 'Jio Mobile',
                    note: 'Jio Prepaid 1.5GB/Day Data Plan',
                    date: new Date(currentDate.setHours(14, 0, 0, 0)),
                    isRecurring: true,
                    recurringInterval: 'monthly'
                });
            }

            // I. Bi-weekly Groceries (8th and 22nd of every month)
            if (monthDay === 8 || monthDay === 22) {
                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: Math.round(2000 + random() * 1500),
                    currency: 'INR',
                    fromAccountId: hdfc._id,
                    category: 'groceries',
                    subCategory: 'Supermarket',
                    merchant: 'Reliance Fresh',
                    note: 'Bi-weekly essential kitchen groceries and household supplies',
                    date: new Date(currentDate.setHours(18, 30, 0, 0))
                });
            }

            // J. Credit Card Payment (25th of every month)
            if (monthDay === 25) {
                transactions.push({
                    userId,
                    type: 'TRANSFER',
                    amount: Math.round(15000 + random() * 10000),
                    currency: 'INR',
                    fromAccountId: hdfc._id,
                    toAccountId: icici._id,
                    category: 'other',
                    merchant: 'CRED',
                    note: 'CRED App Credit Card Bill Settlement',
                    date: new Date(currentDate.setHours(17, 0, 0, 0))
                });
            }

            // K. CRED Cashback Reward (26th of every month - Day after bill payment)
            if (monthDay === 26) {
                transactions.push({
                    userId,
                    type: 'INCOME',
                    amount: Math.round(50 + random() * 150),
                    currency: 'INR',
                    toAccountId: paytm._id,
                    category: 'other',
                    subCategory: 'Cashback',
                    merchant: 'CRED Cashback',
                    note: 'Cashback reward for credit card bill settlement',
                    date: new Date(currentDate.setHours(11, 0, 0, 0))
                });
            }

            // L. Weekend vs Weekday Smart Distributions
            // 1. Food Delivery: Swiggy/Zomato (spikes heavily at night on weekends!)
            const foodProbability = isWeekend ? 0.65 : 0.25;
            if (random() < foodProbability) {
                const isSwiggy = random() > 0.5;
                const isDinner = random() > 0.3; // Night spikes!
                const orderAmount = isWeekend
                    ? Math.round(600 + random() * 800)  // higher weekend orders
                    : Math.round(250 + random() * 450);  // regular workday meals
                
                const foodDate = new Date(currentDate);
                foodDate.setHours(isDinner ? (19 + Math.floor(random() * 3)) : 13, Math.floor(random() * 60));

                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: orderAmount,
                    currency: 'INR',
                    fromAccountId: random() > 0.5 ? icici._id : paytm._id,
                    category: 'food',
                    subCategory: 'Online Delivery',
                    merchant: isSwiggy ? 'Swiggy' : 'Zomato',
                    note: isDinner ? 'Weekend family dinner order' : 'Lunch delivery at office desk',
                    date: foodDate
                });
            }

            // 2. Transport: Uber / Ola Cab rides (spikes on weekdays for work commutes, or night out on weekends)
            const transportProbability = isWeekend ? 0.20 : 0.40;
            if (random() < transportProbability) {
                const isUber = random() > 0.4;
                const isMorning = random() > 0.5;
                const cabAmount = isWeekend
                    ? Math.round(250 + random() * 300)
                    : Math.round(120 + random() * 250);

                const cabDate = new Date(currentDate);
                cabDate.setHours(isMorning ? 9 : 18, isMorning ? 15 : 45);

                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: cabAmount,
                    currency: 'INR',
                    fromAccountId: paytm._id,
                    category: 'transport',
                    subCategory: 'Cab Ride',
                    merchant: isUber ? 'Uber' : 'Ola Cabs',
                    note: isWeekend ? 'Weekend night-out commute' : 'Office commute ride',
                    date: cabDate
                });
            }

            // 3. Shopping Spikes: High value weekend Amazon/Myntra/Zara retail therapy
            const shoppingProbability = isWeekend ? 0.20 : 0.04;
            if (random() < shoppingProbability) {
                const isAmazon = random() > 0.5;
                const items = ['Mechanical Keyboard', 'Dri-FIT Activewear', 'Wireless Charger', 'Uniqlo Airism Tee', 'Smart LED bulb'];
                const item = items[Math.floor(random() * items.length)];
                const shoppingAmount = isWeekend
                    ? Math.round(1800 + random() * 4500) // Weekend spree
                    : Math.round(400 + random() * 1100);  // Weekday utility

                const shopDate = new Date(currentDate);
                shopDate.setHours(15 + Math.floor(random() * 4), Math.floor(random() * 60));

                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: shoppingAmount,
                    currency: 'INR',
                    fromAccountId: icici._id,
                    category: 'shopping',
                    subCategory: 'Online Retail',
                    merchant: isAmazon ? 'Amazon' : 'Flipkart',
                    note: `Bought ${item}`,
                    date: shopDate
                });
            }

            // 4. Daily Small UPI Payments: Samosa Corner & Local Tea Stalls (Paytm Wallet)
            if (random() < 0.75) {
                const teaAmount = Math.round(20 + random() * 70);
                const teaDate = new Date(currentDate);
                teaDate.setHours(16, Math.floor(random() * 30)); // 4 PM tea time

                transactions.push({
                    userId,
                    type: 'EXPENSE',
                    amount: teaAmount,
                    currency: 'INR',
                    fromAccountId: paytm._id,
                    category: 'food',
                    subCategory: 'UPI Merchant',
                    merchant: random() > 0.5 ? 'Local Tea Stall' : 'Samosa Corner',
                    note: 'Evening snacks and tea',
                    date: teaDate
                });
            }
        }

        // 5. Accumulate ledger transaction entries to build mathematically correct balances
        logger.info('Calculating mathematically correct final account balances…');
        
        // Sort transactions in chronological order to apply changes sequentially
        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        for (const tx of transactions) {
            const amt = tx.amount;
            if (tx.type === 'EXPENSE') {
                const fromId = tx.fromAccountId.toString();
                if (currentBalances[fromId] !== undefined) {
                    currentBalances[fromId] -= amt;
                }
            } else if (tx.type === 'INCOME') {
                const toId = tx.toAccountId.toString();
                if (currentBalances[toId] !== undefined) {
                    currentBalances[toId] += amt;
                }
            } else if (tx.type === 'TRANSFER') {
                const fromId = tx.fromAccountId.toString();
                const toId = tx.toAccountId.toString();
                if (currentBalances[fromId] !== undefined) {
                    currentBalances[fromId] -= amt;
                }
                if (currentBalances[toId] !== undefined) {
                    currentBalances[toId] += amt;
                }
            }
        }

        // Update balances in DB
        await Promise.all([
            Account.findByIdAndUpdate(hdfc._id, { $set: { balance: Math.round(currentBalances[hdfc._id.toString()] * 100) / 100 } }),
            Account.findByIdAndUpdate(icici._id, { $set: { balance: Math.round(currentBalances[icici._id.toString()] * 100) / 100 } }),
            Account.findByIdAndUpdate(paytm._id, { $set: { balance: Math.round(currentBalances[paytm._id.toString()] * 100) / 100 } }),
            Account.findByIdAndUpdate(emergency._id, { $set: { balance: Math.round(currentBalances[emergency._id.toString()] * 100) / 100 } })
        ]);

        // Insert generated transactions into DB
        const insertedTransactions = await Transaction.insertMany(transactions);
        logger.info(`Successfully inserted ${insertedTransactions.length} transaction ledger records!`);

        // 6. Create Budgets for the CURRENT Month
        logger.info('Seeding monthly budget parameters…');
        const budgetsData = [
            {
                userId,
                category: 'overall',
                limitAmount: 80000,
                warningThreshold: 75,
                criticalThreshold: 90,
                isActive: true,
                period: 'monthly'
            },
            {
                userId,
                category: 'food',
                limitAmount: 15000,
                warningThreshold: 75,
                criticalThreshold: 90,
                isActive: true,
                period: 'monthly'
            },
            {
                userId,
                category: 'shopping',
                limitAmount: 20000, // Will be slightly exceeded for realistic screenshots
                warningThreshold: 75,
                criticalThreshold: 90,
                isActive: true,
                period: 'monthly'
            },
            {
                userId,
                category: 'entertainment',
                limitAmount: 5000,
                warningThreshold: 70,
                criticalThreshold: 85,
                isActive: true,
                period: 'monthly'
            },
            {
                userId,
                category: 'travel',
                limitAmount: 10000,
                warningThreshold: 75,
                criticalThreshold: 90,
                isActive: true,
                period: 'monthly'
            },
            {
                userId,
                category: 'bills',
                limitAmount: 45000,
                warningThreshold: 80,
                criticalThreshold: 95,
                isActive: true,
                period: 'monthly'
            },
            {
                userId,
                category: 'groceries',
                limitAmount: 12000,
                warningThreshold: 75,
                criticalThreshold: 90,
                isActive: true,
                period: 'monthly'
            }
        ];

        await Budget.insertMany(budgetsData);

        // 7. Create Savings Goals
        logger.info('Seeding financial savings goals…');
        const goalsData = [
            {
                userId,
                name: 'MacBook Pro Fund',
                targetAmount: 180000,
                currentAmount: 135000, // 75%
                deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months later
                status: 'active',
                contributions: [
                    { amount: 30000, date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), note: 'Initial savings allocation' },
                    { amount: 35000, date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), note: 'Bonus freelancing payout' },
                    { amount: 40000, date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), note: 'Monthly salary savings contribution' },
                    { amount: 30000, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), note: 'Expense cut savings' }
                ],
                milestones: [
                    { percentage: 25, reached: true },
                    { percentage: 50, reached: true },
                    { percentage: 75, reached: true },
                    { percentage: 100, reached: false }
                ]
            },
            {
                userId,
                name: 'Goa Trip',
                targetAmount: 40000,
                currentAmount: 40000, // 100%
                deadline: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
                status: 'completed',
                contributions: [
                    { amount: 10000, date: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000), note: 'Flight booking fund' },
                    { amount: 15000, date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), note: 'Hotel booking savings' },
                    { amount: 15000, date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), note: 'Cash allowance and details complete' }
                ],
                milestones: [
                    { percentage: 25, reached: true },
                    { percentage: 50, reached: true },
                    { percentage: 75, reached: true },
                    { percentage: 100, reached: true }
                ]
            },
            {
                userId,
                name: 'Emergency Fund',
                targetAmount: 300000,
                currentAmount: 150000, // 50%
                deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months later
                status: 'active',
                contributions: [
                    { amount: 30000, date: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000), note: 'Monthly auto-SIP debit' },
                    { amount: 30000, date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), note: 'Monthly auto-SIP debit' },
                    { amount: 30000, date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), note: 'Monthly auto-SIP debit' },
                    { amount: 30000, date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), note: 'Monthly auto-SIP debit' },
                    { amount: 30000, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), note: 'Monthly auto-SIP debit' }
                ],
                milestones: [
                    { percentage: 25, reached: true },
                    { percentage: 50, reached: true },
                    { percentage: 75, reached: false },
                    { percentage: 100, reached: false }
                ]
            },
            {
                userId,
                name: 'New Bike',
                targetAmount: 150000,
                currentAmount: 45000, // 30%
                deadline: new Date(Date.now() + 270 * 24 * 60 * 60 * 1000), // 9 months later
                status: 'active',
                contributions: [
                    { amount: 15000, date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), note: 'Initial booking savings' },
                    { amount: 15000, date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), note: 'Monthly contribution' },
                    { amount: 15000, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), note: 'Monthly contribution' }
                ],
                milestones: [
                    { percentage: 25, reached: true },
                    { percentage: 50, reached: false },
                    { percentage: 75, reached: false },
                    { percentage: 100, reached: false }
                ]
            }
        ];

        await SavingsGoal.insertMany(goalsData);

        // 8. Create realistic Receipt records and link them to transactions
        logger.info('Seeding receipts and linking OCR details…');
        const relianceFreshTx = await Transaction.findOne({ userId, merchant: 'Reliance Fresh' });
        const starbucksTx = await Transaction.findOne({ userId, merchant: 'Starbucks' });

        const receiptsData = [
            {
                userId,
                fileName: 'reliance_fresh_grocery_2450.jpg',
                fileUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=60',
                fileSize: 450200,
                fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                ocrData: {
                    amount: { value: relianceFreshTx?.amount || 2450.00, confidence: 0.98 },
                    date: { value: relianceFreshTx ? relianceFreshTx.date.toISOString().split('T')[0] : '2026-05-18', confidence: 0.96 },
                    merchant: { value: 'Reliance Retail', confidence: 0.95 },
                    suggestedCategory: 'groceries',
                    lineItems: [
                        { name: 'Organic Bananas 1kg', amount: 90.00 },
                        { name: 'Aashirvaad Atta 5kg', amount: 260.00 },
                        { name: 'Amul Butter 500g', amount: 275.00 },
                        { name: 'Tropicana Orange Juice 1L', amount: 120.00 },
                        { name: 'Fortune Sunflower Oil 5L', amount: 850.00 }
                    ],
                    rawText: 'RELIANCE FRESH STORE\nSTATION ROAD, BENGALURU\nTAX INVOICE\n-------------------------\nBANANAS 1KG: 90.00\nAASHIRVAAD ATTA 5KG: 260.00\nAMUL BUTTER 500G: 275.00\nORANGE JUICE: 120.00\nSUNFLOWER OIL 5L: 850.00\n-------------------------\nTOTAL: INR 2,450.00\nTHANK YOU FOR SHOPPING!'
                },
                linkedTransactionId: relianceFreshTx?._id
            },
            {
                userId,
                fileName: 'starbucks_latte_bill_720.jpg',
                fileUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=60',
                fileSize: 180500,
                fileHash: 'f4b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                ocrData: {
                    amount: { value: starbucksTx?.amount || 720.00, confidence: 0.99 },
                    date: { value: starbucksTx ? starbucksTx.date.toISOString().split('T')[0] : '2026-05-20', confidence: 0.98 },
                    merchant: { value: 'Starbucks Coffee', confidence: 0.99 },
                    suggestedCategory: 'food',
                    lineItems: [
                        { name: 'Vanilla Latte Grande', amount: 375.00 },
                        { name: 'Almond Croissant', amount: 265.00 },
                        { name: 'CGST 2.5%', amount: 16.00 },
                        { name: 'SGST 2.5%', amount: 16.00 }
                    ],
                    rawText: 'STARBUCKS COFFEE\nKORAMANGALA 8TH BLOCK\nBENGALURU, KA\n-------------------------\n1 GR VANILLA LATTE: 375.00\n1 ALMOND CROISSANT: 265.00\n-------------------------\nSUBTOTAL: 640.00\nCGST 2.5%: 16.00\nSGST 2.5%: 16.00\nTOTAL: INR 720.00\nCARD ENDS IN *5012'
                },
                linkedTransactionId: starbucksTx?._id
            }
        ];

        const insertedReceipts = await Receipt.insertMany(receiptsData);
        
        // Back-link transactions to receipts
        for (const receipt of insertedReceipts) {
            if (receipt.linkedTransactionId) {
                await Transaction.findByIdAndUpdate(receipt.linkedTransactionId, {
                    $set: {
                        receiptUrl: receipt.fileUrl,
                        receiptOcrData: JSON.stringify(receipt.ocrData)
                    }
                });
            }
        }

        // 9. Create AI Chatbot History
        logger.info('Seeding intelligent chatbot messages…');
        const chatMessagesData = [
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'user',
                message: 'How can I reduce food expenses?'
            },
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'assistant',
                message: 'Based on your recent spending, food is your second highest category at ₹12,400. To reduce this, I recommend setting a Zomato/Swiggy weekly cap of ₹1,500 and replacing 2 restaurant meals with grocery cooking. This could save you up to ₹4,500 monthly.',
                intent: 'reduce_spending',
                intentConfidence: 0.95,
                aiSource: 'gemini-1.5-flash',
                responseTimeMs: 380
            },
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'user',
                message: 'Show my highest spending category'
            },
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'assistant',
                message: 'Your highest spending category this month is **Shopping** at ₹22,500, which has exceeded your limit of ₹20,000 by 12.5%. Your main shopping merchants were Amazon (₹14,500) and Zara (₹8,000).',
                intent: 'highest_spending',
                intentConfidence: 0.98,
                aiSource: 'gemini-1.5-flash',
                responseTimeMs: 250
            },
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'user',
                message: 'Can I save ₹20,000 this month?'
            },
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'assistant',
                message: 'Yes, you can! Your monthly income is ₹1,20,000 and standard expenses are ₹78,000, leaving ₹42,000. Since you\'ve already saved ₹15,000 in your Emergency Fund, saving an additional ₹20,000 is highly feasible if you stay within your Bills and Entertainment budgets.',
                intent: 'savings_feasibility',
                intentConfidence: 0.92,
                aiSource: 'gemini-1.5-flash',
                responseTimeMs: 420
            },
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'user',
                message: 'Suggest budget improvements'
            },
            {
                sessionId: 'demo-session-1',
                userId,
                role: 'assistant',
                message: 'Looking at your metrics, you have excellent savings consistency! To optimize further:\n1. Your Credit Card has accumulated ₹12,450 in dues; pay this via Paytm/CRED before the due date to maintain a high CIBIL score.\n2. Your MacBook Pro savings fund is 75% complete. An extra ₹15,000 contribution next month will hit the target ahead of schedule!\n3. Cut down on Starbucks visits (currently ₹3,800/month) to save an easy ₹2,000.',
                intent: 'budget_improvements',
                intentConfidence: 0.96,
                aiSource: 'gemini-1.5-flash',
                responseTimeMs: 310
            }
        ];

        await ChatMessage.insertMany(chatMessagesData);

        // 10. Create Alerts & Beautiful Notifications (Highly important for visual quality)
        logger.info('Seeding realistic dashboard notifications…');
        // NOTE: Notification schema has a unique compound index on { userId, type, metadata.dedupeKey }.
        // We MUST supply a unique dedupeKey per notification to avoid E11000 duplicate key errors
        // when multiple notifications share the same type (e.g. two 'milestone' entries).
        const notificationsData = [
            {
                userId,
                type: 'budget_exceeded',
                title: 'Shopping Budget Exceeded!',
                message: 'Alert: Your Shopping expenses (₹22,500) have crossed your current monthly budget limit of ₹20,000.',
                priority: 5,
                read: false,
                metadata: { dedupeKey: 'demo-budget-exceeded-shopping' }
            },
            {
                userId,
                type: 'budget_warning',
                title: 'Food Budget Warning',
                message: 'You have spent 82% (₹12,400) of your ₹15,000 Food budget limit, with 5 days remaining in the month.',
                priority: 4,
                read: false,
                metadata: { dedupeKey: 'demo-budget-warning-food' }
            },
            {
                userId,
                type: 'milestone',
                title: 'Savings Goal Milestone Reached!',
                message: 'Congratulations! You have reached 75% (₹1,35,000) of your MacBook Pro Fund target amount.',
                priority: 3,
                read: true,
                metadata: { dedupeKey: 'demo-milestone-macbook-75pct' }
            },
            {
                userId,
                type: 'insight',
                title: 'Monthly Transport Optimization',
                message: 'Excellent! Your transport expenses have reduced by 18% compared to last month due to fewer cab commutes.',
                priority: 3,
                read: true,
                metadata: { dedupeKey: 'demo-insight-transport-savings' }
            }
        ];

        // Add extra premium notifications if SHOWCASE_MODE is active
        if (SHOWCASE_MODE) {
            notificationsData.push(
                {
                    userId,
                    type: 'milestone',
                    title: 'Spotify Subscription Renewed',
                    message: 'Successful: Your Spotify Premium subscription of ₹119 was processed using your Paytm Wallet.',
                    priority: 2,
                    read: true,
                    metadata: { dedupeKey: 'demo-milestone-spotify-renewal' }
                },
                {
                    userId,
                    type: 'insight',
                    title: 'Investment SIP Processed Successfully',
                    message: 'Your monthly SIP of ₹15,000 into Nifty 50 Index Fund was successfully debited from HDFC Savings.',
                    priority: 4,
                    read: false,
                    metadata: { dedupeKey: 'demo-insight-sip-zerodha' }
                },
                {
                    userId,
                    type: 'insight',
                    title: 'CRED Cashback Credited!',
                    message: 'Congratulations! ₹124 CRED Cashback was credited to your Paytm Wallet for your recent card settlement.',
                    priority: 2,
                    read: true,
                    metadata: { dedupeKey: 'demo-insight-cred-cashback' }
                }
            );
        }

        await Notification.insertMany(notificationsData);

        // 11. Seeding secure Activity and Login Logs
        logger.info('Seeding login logs and activity audit logs…');
        const logsData = [
            {
                userId,
                email: DEMO_EMAIL,
                ip: '192.168.1.42',
                provider: 'local',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                device: 'Desktop',
                browser: 'Chrome',
                os: 'Windows',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
            },
            {
                userId,
                email: DEMO_EMAIL,
                ip: '192.168.1.42',
                provider: 'google',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                device: 'Desktop',
                browser: 'Chrome',
                os: 'Windows',
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
            },
            {
                userId,
                email: DEMO_EMAIL,
                ip: '172.56.21.99',
                provider: 'local',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
                device: 'Mobile',
                browser: 'Safari',
                os: 'iOS',
                timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
            }
        ];

        await LoginActivityLog.insertMany(logsData);

        logger.info('🎉 Demo account data seeded successfully with perfect mathematical ledger integrity!');
        return user;
    } catch (err) {
        logger.error({ err }, 'Failed to seed demo data');
        throw err;
    }
}
