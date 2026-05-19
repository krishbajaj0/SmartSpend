/**
 * @file utils/token.js
 * @description Centralised JWT signing utility.
 *
 * WHY centralise this?
 * ────────────────────
 * The original `signToken(id)` was defined inline in authController.js.
 * With tokenVersion revocation, the token payload grows: { id, tv }.
 * If signing is duplicated in multiple files, it's trivially easy to forget
 * to include `tv` in one place — and that one place becomes a revocation bypass.
 *
 * Having a single `signToken(user)` function that takes the full User document
 * and extracts both `id` and `tokenVersion` makes it impossible to sign a
 * token without the version. Every call site is identical and auditable.
 *
 * WHY embed tokenVersion in the JWT?
 * ───────────────────────────────────
 * JWTs are stateless. Without revocation, a stolen or compromised token is
 * valid until it expires (7 days by default). By embedding `tv` (tokenVersion)
 * in the payload and incrementing the DB counter on password change/logout,
 * any token with an outdated `tv` is immediately rejected — no Redis needed.
 *
 * Cost: one extra integer field in every token (negligible, adds <10 bytes
 * to base64 payload). Benefit: instant revocation of all active sessions
 * for a specific user without affecting other users.
 */

import jwt from 'jsonwebtoken';
import constants from '../config/constants.js';

/**
 * Sign a JWT for a user, embedding their tokenVersion for revocation support.
 *
 * @param {import('mongoose').Document} user - Mongoose User document.
 *   Must have `_id` and `tokenVersion` fields loaded.
 *   Use `.select('+tokenVersion')` when fetching the user before calling this.
 * @returns {string} Signed JWT string
 */
export function signToken(user) {
    return jwt.sign(
        {
            id: user._id,
            tv: user.tokenVersion,   // token version — checked on every request
        },
        constants.jwtSecret,
        { expiresIn: constants.jwtExpire }
    );
}
