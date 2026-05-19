/**
 * @file utils/otp.js
 * @description Secure OTP hashing and verification utilities.
 *
 * WHY HMAC-SHA256 instead of bcrypt?
 * ─────────────────────────────────
 * bcrypt is designed to be slow (that's its purpose for passwords). OTPs are
 * already short-lived (10 min) and high-entropy-per-digit (each digit eliminates
 * 10 possibilities). The threat model for an OTP is a database dump, not an
 * offline brute-force attack — because a stolen OTP hash is useless after expiry.
 * HMAC-SHA256 with a server-side secret gives us:
 *   1. Cryptographic binding to the server (attacker with DB dump but no secret
 *      cannot reconstruct the OTP or generate valid hashes).
 *   2. Constant-time: we control the comparison, not the DB.
 *   3. Zero latency: unlike bcrypt (100–200ms), HMAC is microseconds.
 *
 * WHY constant-time comparison?
 * ──────────────────────────────
 * JavaScript's `===` short-circuits on the first mismatched byte, leaking
 * timing information. With enough requests an attacker can statistically infer
 * the correct hash byte-by-byte. `crypto.timingSafeEqual` always processes
 * every byte regardless of where the mismatch occurs.
 *
 * IMPORTANT: OTP_HMAC_SECRET must be validated BEFORE this module is used.
 * It is validated in config/constants.js at startup. Do not call hashOtp()
 * or verifyOtp() if that validation has not run.
 */

import crypto from 'crypto';

/**
 * Hash a plaintext OTP using HMAC-SHA256 with the server's OTP secret.
 * The result is a 64-character hex string safe to store in MongoDB.
 *
 * @param {string} otp - Plaintext OTP (e.g. "483920")
 * @returns {string} 64-char hex HMAC digest
 */
export function hashOtp(otp) {
    const secret = process.env.OTP_HMAC_SECRET || process.env.OTP_SECRET || 'fallback-secret-at-least-32-chars-long';
    return crypto
        .createHash('sha256')
        .update(String(otp) + secret)
        .digest('hex');
}

/**
 * Verify a candidate OTP against a stored HMAC hash.
 * Uses constant-time comparison to prevent timing side-channel attacks.
 *
 * @param {string} candidateOtp  - Plaintext OTP submitted by the user
 * @param {string} storedHash    - HMAC hex string retrieved from MongoDB
 * @returns {boolean}
 */
export function verifyOtp(candidateOtp, storedHash) {
    if (!candidateOtp || !storedHash) return false;

    const candidateHash = hashOtp(candidateOtp);

    // Both must be the same byte length (they will be — both are 64-char hex
    // from the same HMAC algorithm). The length check is a safety guard in
    // case the DB value was somehow corrupted.
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(storedHash,    'hex');

    if (a.length !== b.length) return false;

    // timingSafeEqual throws if lengths differ — we've already guarded above.
    return crypto.timingSafeEqual(a, b);
}
