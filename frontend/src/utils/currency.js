/**
 * Currency formatting utility.
 * Uses Intl.NumberFormat for locale-aware display.
 */

const CURRENCY_MAP = {
    INR: { symbol: '₹', locale: 'en-IN' },
    USD: { symbol: '$', locale: 'en-US' },
    EUR: { symbol: '€', locale: 'de-DE' },
    GBP: { symbol: '£', locale: 'en-GB' },
    JPY: { symbol: '¥', locale: 'ja-JP' },
};

/**
 * Format a number as currency.
 * @param {number} amount
 * @param {string} [currencyCode='INR'] — ISO 4217 code
 * @param {object} [opts] — extra Intl.NumberFormat options
 * @returns {string} e.g. "₹1,234.56"
 */
export function formatCurrency(amount, currencyCode = 'INR', opts = {}) {
    const code = (currencyCode || 'INR').toUpperCase();
    const info = CURRENCY_MAP[code] || CURRENCY_MAP.INR;

    try {
        return new Intl.NumberFormat(info.locale, {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 0,
            maximumFractionDigits: (code === 'JPY' || code === 'INR') ? 0 : 2,
            ...opts,
        }).format(amount || 0);
    } catch {
        // Fallback if Intl fails
        return `${info.symbol}${(amount || 0).toLocaleString()}`;
    }
}

/**
 * Get just the currency symbol.
 * @param {string} [currencyCode='INR']
 * @returns {string} e.g. "₹"
 */
export function getCurrencySymbol(currencyCode = 'INR') {
    return CURRENCY_MAP[(currencyCode || 'INR').toUpperCase()]?.symbol || '₹';
}

/**
 * Format for axis labels (compact). e.g. ₹12k, $1.5M
 * @param {number} value
 * @param {string} [currencyCode='INR']
 * @returns {string}
 */
export function formatCurrencyCompact(value, currencyCode = 'INR') {
    const sym = getCurrencySymbol(currencyCode);
    if (Math.abs(value) >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}k`;
    return `${sym}${value}`;
}
