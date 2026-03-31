// Mock OCR Service — simulates receipt scanning
// Will be replaced with real Tesseract.js backend in Phase 17

const mockMerchants = [
    { name: 'Big Bazaar', category: 'shopping' },
    { name: 'Swiggy', category: 'food' },
    { name: 'Apollo Pharmacy', category: 'health' },
    { name: 'Shell Petrol Pump', category: 'transport' },
    { name: 'Amazon', category: 'shopping' },
    { name: 'Café Coffee Day', category: 'food' },
    { name: 'Reliance Digital', category: 'shopping' },
    { name: 'DMart', category: 'groceries' },
    { name: 'PVR Cinemas', category: 'entertainment' },
    { name: 'Jio Store', category: 'bills' },
];

function randomBetween(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate() {
    const daysAgo = Math.floor(Math.random() * 14);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

function randomConfidence(min = 0.65, max = 0.98) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Simulate OCR scanning with a delay.
 * Returns structured data with confidence scores.
 */
export async function scanReceipt(file) {
    // Simulate processing time (1.5–3s)
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));

    const merchant = mockMerchants[Math.floor(Math.random() * mockMerchants.length)];
    const amount = randomBetween(80, 5000);
    const date = randomDate();

    const lineItems = [];
    const itemCount = Math.floor(Math.random() * 4) + 1;
    let runningTotal = 0;
    for (let i = 0; i < itemCount; i++) {
        const itemAmount = i === itemCount - 1
            ? Math.round((amount - runningTotal) * 100) / 100
            : randomBetween(20, amount / itemCount);
        runningTotal += itemAmount;
        lineItems.push({
            name: `Item ${i + 1}`,
            amount: Math.max(0, itemAmount),
        });
    }

    return {
        amount: { value: amount, confidence: randomConfidence(0.85, 0.98) },
        date: { value: date, confidence: randomConfidence(0.75, 0.95) },
        merchant: { value: merchant.name, confidence: randomConfidence(0.7, 0.95) },
        suggestedCategory: merchant.category,
        lineItems,
        rawText: `${merchant.name}\n${date}\n\nItems:\n${lineItems.map(li => `${li.name}  ₹${li.amount}`).join('\n')}\n\nTotal: ₹${amount}\nThank you for shopping!`,
    };
}

/**
 * Generate a mock receipt gallery entry
 */
export function createReceiptEntry(file, ocrResult) {
    return {
        id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        ocrData: ocrResult,
        linkedExpenseId: null,
    };
}
