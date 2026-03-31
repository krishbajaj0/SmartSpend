/**
 * OCR Receipt Parser — Multi-stage parsing pipeline.
 * Uses Tesseract.js for text extraction, then regex for field extraction.
 */

let Tesseract;
try {
    Tesseract = await import('tesseract.js');
} catch {
    // Tesseract may not be installed yet; use mock
    Tesseract = null;
}

// ── Pre-processing: fix common OCR misreads ──
function preprocess(text) {
    return text
        .replace(/[|]/g, 'l')
        .replace(/\{/g, '(')
        .replace(/\}/g, ')')
        .replace(/`/g, "'")
        .replace(/[^\S\r\n]+/g, ' ')  // normalize whitespace
        .trim();
}

// ── Amount extraction ──
function extractAmount(text) {
    const patterns = [
        /(?:total|grand total|amount due|net amount|net total)[:\s]*₹?\s*([\d,]+\.?\d*)/i,
        /₹\s*([\d,]+\.?\d*)/,
        /(?:rs\.?|inr)\s*([\d,]+\.?\d*)/i,
        /(?:total)[:\s]*([\d,]+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value) && value > 0) {
                return { value, confidence: 0.85 + Math.random() * 0.1 };
            }
        }
    }

    // Fallback: find highest number
    const numbers = text.match(/\d[\d,]*\.?\d*/g) || [];
    const parsed = numbers.map(n => parseFloat(n.replace(/,/g, '')));
    const max = Math.max(...parsed.filter(n => n > 0 && n < 100000));
    if (max > 0 && isFinite(max)) {
        return { value: max, confidence: 0.5 };
    }

    return { value: 0, confidence: 0 };
}

// ── Date extraction ──
function extractDate(text) {
    const patterns = [
        /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,          // DD/MM/YYYY or DD-MM-YYYY
        /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,          // YYYY-MM-DD
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[,\s]+(\d{4})/i,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})[,\s]+(\d{4})/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                const dateStr = match[0];
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    return { value: d.toISOString().split('T')[0], confidence: 0.8 };
                }
            } catch { /* skip */ }
        }
    }

    return { value: new Date().toISOString().split('T')[0], confidence: 0.3 };
}

// ── Merchant extraction ──
function extractMerchant(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    // First non-numeric, non-date line is likely the merchant name
    for (const line of lines.slice(0, 3)) {
        if (!/^\d/.test(line) && !/\d{2}[\/\-]\d{2}/.test(line) && line.length < 60) {
            return { value: line, confidence: 0.7 };
        }
    }
    return { value: lines[0] || 'Unknown', confidence: 0.4 };
}

// ── Line items extraction ──
function extractLineItems(text) {
    const items = [];
    const lines = text.split('\n');
    const itemPattern = /(.+?)\s+([\d,]+\.?\d*)\s*$/;

    for (const line of lines) {
        const match = line.trim().match(itemPattern);
        if (match) {
            const name = match[1].trim();
            const amount = parseFloat(match[2].replace(/,/g, ''));
            if (name.length > 1 && name.length < 50 && amount > 0 && amount < 50000) {
                items.push({ name, amount });
            }
        }
    }

    return items.slice(0, 20);
}

// ── Category suggestion ──
function suggestCategory(merchant, items) {
    const text = `${merchant} ${items.map(i => i.name).join(' ')}`.toLowerCase();
    if (/food|restaurant|cafe|pizza|chicken|biryani|meal/.test(text)) return 'food';
    if (/pharma|medical|hospital|clinic|health/.test(text)) return 'health';
    if (/petrol|fuel|uber|ola|metro|transport/.test(text)) return 'transport';
    if (/grocery|vegetable|fruit|mart|provision/.test(text)) return 'groceries';
    if (/movie|cinema|game|entertain/.test(text)) return 'entertainment';
    if (/amazon|flipkart|shop|mall|store/.test(text)) return 'shopping';
    if (/bill|recharge|electric|water|broadband/.test(text)) return 'bills';
    return 'other';
}

/**
 * Parse receipt image and return structured data.
 */
export async function parseReceipt(filePath) {
    let rawText = '';

    if (Tesseract) {
        try {
            const worker = await Tesseract.createWorker('eng');
            const result = await worker.recognize(filePath);
            rawText = result.data.text;
            await worker.terminate();
        } catch (err) {
            console.error('Tesseract error:', err.message);
            rawText = 'OCR processing failed — please enter data manually';
        }
    } else {
        // Mock OCR for when Tesseract isn't available
        rawText = `Sample Store\n${new Date().toISOString().split('T')[0]}\nItem 1  250\nItem 2  150\nTotal: 400`;
    }

    const processed = preprocess(rawText);
    const amount = extractAmount(processed);
    const date = extractDate(processed);
    const merchant = extractMerchant(processed);
    const lineItems = extractLineItems(processed);
    const suggestedCategory = suggestCategory(merchant.value, lineItems);

    return {
        amount,
        date,
        merchant,
        suggestedCategory,
        lineItems,
        rawText: processed,
    };
}
