import { AppError } from './errorHandler.js';

/**
 * Validate request body against a schema object.
 * Schema format: { fieldName: { required: bool, type: 'string'|'number'|'boolean'|'email', min, max, enum } }
 */
export function validate(schema) {
    return (req, res, next) => {
        const errors = [];
        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }

            if (value === undefined || value === null) continue;

            if (rules.type === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errors.push(`${field} must be a valid email`);
                }
            }

            if (rules.type === 'number' && typeof value !== 'number') {
                errors.push(`${field} must be a number`);
            }

            if (rules.type === 'string' && typeof value !== 'string') {
                errors.push(`${field} must be a string`);
            }

            if (rules.min !== undefined && value < rules.min) {
                errors.push(`${field} must be at least ${rules.min}`);
            }

            if (rules.max !== undefined && value > rules.max) {
                errors.push(`${field} must be at most ${rules.max}`);
            }

            if (rules.minLength !== undefined && typeof value === 'string' && value.length < rules.minLength) {
                errors.push(`${field} must be at least ${rules.minLength} characters`);
            }

            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            }
        }

        if (errors.length > 0) {
            return next(new AppError(errors.join('. '), 400));
        }
        next();
    };
}
