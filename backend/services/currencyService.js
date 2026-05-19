/**
 * Currency conversion service.
 * Uses static exchange rates as a fallback. In production,
 * replace with a live API (e.g. Open Exchange Rates, Fixer.io).
 */

// Static rates relative to USD (updated periodically)
const RATES_TO_USD = {
    USD: 1,
    INR: 83.5,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 154.5,
};

/**
 * Convert an amount from one currency to a base (target) currency.
 *
 * @param {number} amount - Original amount
 * @param {string} fromCurrency - Source currency code (e.g. 'USD')
 * @param {string} toCurrency - Target/base currency code (e.g. 'INR')
 * @returns {{ baseAmount: number, exchangeRate: number }}
 */
export async function convertToBaseCurrency(amount, fromCurrency = 'INR', toCurrency = 'INR') {
    // Same currency — no conversion needed
    if (fromCurrency === toCurrency) {
        return { baseAmount: amount, exchangeRate: 1 };
    }

    const fromRate = RATES_TO_USD[fromCurrency.toUpperCase()];
    const toRate = RATES_TO_USD[toCurrency.toUpperCase()];

    if (!fromRate || !toRate) {
        console.warn(`[CurrencyService] Unknown currency: ${fromCurrency} or ${toCurrency}, skipping conversion`);
        return { baseAmount: amount, exchangeRate: 1 };
    }

    // Convert: fromCurrency → USD → toCurrency
    const amountInUSD = amount / fromRate;
    const baseAmount = Math.round(amountInUSD * toRate * 100) / 100;
    const exchangeRate = Math.round((toRate / fromRate) * 1000000) / 1000000;

    return { baseAmount, exchangeRate };
}
