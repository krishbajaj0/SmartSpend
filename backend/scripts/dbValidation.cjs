const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/smartspend');
        const transactions = mongoose.connection.collection('transactions');
        // Rename it back for a moment if it's renamed
        try {
            await mongoose.connection.collection('expenses_deprecated_backup').rename('expenses');
        } catch (e) {}
        
        const expenses = mongoose.connection.collection('expenses');

        // Step 4: Data Integrity (Total Parity)
        const oldC = await expenses.countDocuments({ isDeleted: false });
        // Instead of only mig_expense_, count all EXPENSE
        const newC = await transactions.countDocuments({ type: 'EXPENSE', isDeleted: false });
        console.log(`Count Match: ${oldC === newC} (${oldC} vs ${newC})`);

        const oldS = await expenses.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$currency', total: { $sum: '$baseAmount' } } }]).toArray();
        const newS = await transactions.aggregate([{ $match: { type: 'EXPENSE', isDeleted: false } }, { $group: { _id: '$currency', total: { $sum: '$baseAmount' } } }]).toArray();
        console.log(`Sum Match: ${JSON.stringify(oldS)} vs ${JSON.stringify(newS)}`);
        
        // Step 5: Scream Test (Simulate)
        console.log('Renaming collection for Scream Test...');
        await expenses.rename('expenses_deprecated_backup');
        console.log('Scream Test active.');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
