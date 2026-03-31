import { useEffect, useState, useRef, useCallback } from 'react';

export function useCountUp(target, options = {}) {
    const { duration = 1500, prefix = '', suffix = '', decimals = 0, enabled = true } = options;
    const [count, setCount] = useState(0);
    const frameRef = useRef(null);
    const startTimeRef = useRef(null);

    const start = useCallback(() => {
        if (!enabled || target === 0) {
            setCount(target);
            return;
        }

        startTimeRef.current = performance.now();

        const animate = (now) => {
            const elapsed = now - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            const current = eased * target;

            setCount(current);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        frameRef.current = requestAnimationFrame(animate);
    }, [target, duration, enabled]);

    useEffect(() => {
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, []);

    const displayValue = `${prefix}${count.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}`;

    return { count, displayValue, start };
}
