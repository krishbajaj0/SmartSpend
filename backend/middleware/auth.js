import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';
import constants from '../config/constants.js';

/**
 * Protect routes — verify JWT and attach req.user.
 */
export async function protect(req, res, next) {
    let token;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        token = auth.split(' ')[1];
    }
    if (!token) {
        return next(new AppError('Not authorized — no token', 401));
    }
    try {
        const decoded = jwt.verify(token, constants.jwtSecret);
        const user = await User.findById(decoded.id).select('-passwordHash');
        if (!user) {
            return next(new AppError('User no longer exists', 401));
        }
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
}
