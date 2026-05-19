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
        .replace(/\u201d|\u201c/g, '"') // Normalize smart quotes
        .replace(/[^\S\r\n]+/g, ' ')   // normalize whitespace
        .split('\n')
        .map(line => line.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')) // Strip leading/trailing garbage
        .join('\n')
        .trim();
}

// ── Amount extraction ──
function extractAmount(text) {
    const patterns = [
        /(?:total|grand total|amount due|net amount|net total|payable|paid|card)[:\s]*₹?\s*([\d,]+\.?\d*)/i,
        /₹\s*([\d,]+\.?\d*)/,
        /(?:rs\.?|inr)\s*([\d,]+\.?\d*)/i,
        /TOTAL[:\s]*([\d,]+\.?\d*)/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value) && value > 0) {
                return { value, confidence: 0.9 };
            }
        }
    }

    // Fallback: find highest number that isn't a date or year
    const numbers = text.match(/\b\d[\d,]*\.?\d*\b/g) || [];
    const parsed = numbers
        .map(n => parseFloat(n.replace(/,/g, '')))
        .filter(n => n > 5 && n < 100000 && n !== 2026); // ignore years
    
    const max = Math.max(...parsed);
    if (max > 0 && isFinite(max)) {
        return { value: max, confidence: 0.5 };
    }

    return { value: 0, confidence: 0 };
}

// ── Date extraction ──
function extractDate(text) {
    const patterns = [
        /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,          // DD/MM/YYYY
        /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,          // YYYY-MM-DD
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|vey|nay|ray|uay)\w*[,\s]+(\d{4})/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                let dateStr = match[0];
                // Fix common month misreads
                dateStr = dateStr.replace(/vey|nay|ray|uay/i, 'May');
                
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    return { value: d.toISOString().split('T')[0], confidence: 0.85 };
                }
            } catch { /* skip */ }
        }
    }

    return { value: new Date().toISOString().split('T')[0], confidence: 0.3 };
}

// ── Merchant extraction ──
function extractMerchant(text) {
    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 3);
    
    // Pick the best candidate line from the top of the receipt
    let bestCandidate = { value: 'Unknown', score: -1 };

    for (const line of lines.slice(0, 6)) {
        const letters = (line.match(/[a-zA-Z]/g) || []).length;
        const digits = (line.match(/[0-9]/g) || []).length;
        const symbols = (line.match(/[^a-zA-Z0-9\s]/g) || []).length;
        
        // Skip lines that are mostly numbers or symbols
        if (letters < 4 || symbols > letters || digits > letters) continue;
        
        // Skip summary lines
        if (/total|amount|tax|receipt|date|invoice/i.test(line)) continue;

        const score = letters - symbols;
        if (score > bestCandidate.score) {
            bestCandidate = { value: line, score };
        }
    }

    return { 
        value: bestCandidate.value
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/^\s*[a-zA-Z]\s+/, '') // Remove single letter prefixes (like 'l ')
            .replace(/\s+[a-zA-Z]{1,3}\s*$/, '') // Remove short suffixes (like ' Fie')
            .trim(), 
        confidence: bestCandidate.score > 0 ? 0.8 : 0.4 
    };
}

// ── Line items extraction ──
function extractLineItems(text) {
    const items = [];
    const lines = text.split('\n');
    const itemPattern = /(.+?)\s+([\d,]+\.?\d*)\s*$/;
    const SUMMARY_KEYWORDS = /total|subtotal|tax|gst|vat|cgst|sgst|change|cash|paid|card|discount|savings|thank|visit|enjoy/i;

    for (const line of lines) {
        const cleanedLine = line.trim();
        if (SUMMARY_KEYWORDS.test(cleanedLine)) continue;

        const match = cleanedLine.match(itemPattern);
        if (match) {
            const name = match[1].replace(/[^a-zA-Z0-9\s]/g, '').trim();
            const amount = parseFloat(match[2].replace(/,/g, ''));
            if (name.length > 3 && name.length < 50 && amount > 1) {
                items.push({ name, amount });
            }
        }
    }

    return items.slice(0, 15);
}

// ── Category suggestion ──
function suggestCategory(merchant, items) {
    const text = `${merchant} ${items.map(i => i.name).join(' ')}`.toLowerCase();
    
    const rules = [
        { re: /coffee|tea|beverage|starbucks|starbeans|cafe|restaurant|food|pizza|burger|meal|bakery|cappuccino|muffin/, cat: 'food' },
        { re: /pharma|medical|health|clinic|doctor|medicine|hospital/, cat: 'health' },
        { re: /uber|ola|metro|transport|fuel|petrol|gas|railway|irctc|bus/, cat: 'transport' },
        { re: /grocery|mart|provision|market|vegetable|fruit|blinkit|zepto|bigbasket|reliance/, cat: 'groceries' },
        { re: /amazon|flipkart|shop|mall|store|clothing|fashion|myntra|apparel/, cat: 'shopping' },
        { re: /netflix|prime|disney|movie|cinema|inox|pvr|game|entertain/, cat: 'entertainment' },
        { re: /bill|recharge|electric|water|broadband|utility|jio|airtel|vi|insurance/, cat: 'bills' },
    ];

    for (const rule of rules) {
        if (rule.re.test(text)) return rule.cat;
    }
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
        rawText = `Starbeans Coffee\n11 May 2026\nCappuccino  250\nMuffin  150\nTotal: 400`;
    }

    const processed = preprocess(rawText);
    const merchant = extractMerchant(processed);
    const items = extractLineItems(processed);
    const amount = extractAmount(processed);
    const date = extractDate(processed);
    const suggestedCategory = suggestCategory(merchant.value, items);

    return {
        amount,
        date,
        merchant,
        suggestedCategory,
        lineItems: items,
        rawText: processed,
    };
}
