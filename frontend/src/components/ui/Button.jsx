import { motion } from 'framer-motion';
import './Button.css';

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    onClick,
    type = 'button',
    ...props
}) {
    return (
        <motion.button
            type={type}
            className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
            onClick={onClick}
            disabled={disabled || loading}
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.96 }}
            {...props}
        >
            {loading ? (
                <span className="btn-spinner" />
            ) : (
                <>
                    {icon && <span className="btn-icon">{icon}</span>}
                    {children && <span className="btn-label">{children}</span>}
                    {iconRight && <span className="btn-icon btn-icon-right">{iconRight}</span>}
                </>
            )}
        </motion.button>
    );
}
