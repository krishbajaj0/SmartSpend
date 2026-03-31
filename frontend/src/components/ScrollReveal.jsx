import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';

const variants = {
    'fade-up': {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
    },
    'fade-left': {
        hidden: { opacity: 0, x: -30 },
        visible: { opacity: 1, x: 0 },
    },
    'fade-right': {
        hidden: { opacity: 0, x: 30 },
        visible: { opacity: 1, x: 0 },
    },
    'scale-in': {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1 },
    },
};

const containerVariant = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.1,
        },
    },
};

export default function ScrollReveal({
    children,
    variant = 'fade-up',
    delay = 0,
    duration = 0.5,
    stagger = false,
    className = '',
    threshold = 0.2,
    as = 'div',
    ...props
}) {
    const { ref, isVisible } = useScrollReveal({ threshold });
    const Component = motion[as] || motion.div;

    if (stagger) {
        return (
            <Component
                ref={ref}
                variants={containerVariant}
                initial="hidden"
                animate={isVisible ? 'visible' : 'hidden'}
                className={className}
                {...props}
            >
                {children}
            </Component>
        );
    }

    return (
        <Component
            ref={ref}
            variants={variants[variant]}
            initial="hidden"
            animate={isVisible ? 'visible' : 'hidden'}
            transition={{ duration, delay, ease: 'easeOut' }}
            className={className}
            {...props}
        >
            {children}
        </Component>
    );
}

export function ScrollRevealItem({ children, variant = 'fade-up', duration = 0.5, className = '', ...props }) {
    return (
        <motion.div
            variants={variants[variant]}
            transition={{ duration, ease: 'easeOut' }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}
