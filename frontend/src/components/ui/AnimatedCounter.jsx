import { useEffect } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export default function AnimatedCounter({
    value,
    prefix = '',
    suffix = '',
    decimals = 0,
    duration = 1500,
    className = '',
}) {
    const { ref, isVisible } = useScrollReveal({ triggerOnce: true });
    const { displayValue, start } = useCountUp(value, {
        prefix,
        suffix,
        decimals,
        duration,
        enabled: isVisible,
    });

    useEffect(() => {
        if (isVisible) start();
    }, [isVisible, start]);

    return (
        <span ref={ref} className={className}>
            {displayValue}
        </span>
    );
}
