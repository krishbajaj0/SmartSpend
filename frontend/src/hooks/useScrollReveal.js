import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(options = {}) {
    const { threshold = 0.2, rootMargin = '0px', triggerOnce = true } = options;
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (triggerOnce) observer.unobserve(element);
                } else if (!triggerOnce) {
                    setIsVisible(false);
                }
            },
            { threshold, rootMargin }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [threshold, rootMargin, triggerOnce]);

    return { ref, isVisible };
}
