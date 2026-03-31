import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import './ParallaxOrbs.css';

const orbConfigs = [
    { size: 300, color: 'rgba(108, 92, 231, 0.15)', top: '10%', left: '5%', speed: 0.3 },
    { size: 200, color: 'rgba(0, 206, 201, 0.1)', top: '60%', right: '10%', speed: 0.5 },
    { size: 250, color: 'rgba(108, 92, 231, 0.08)', top: '30%', right: '20%', speed: 0.2 },
    { size: 180, color: 'rgba(0, 184, 148, 0.1)', bottom: '15%', left: '15%', speed: 0.4 },
    { size: 150, color: 'rgba(162, 155, 254, 0.12)', top: '50%', left: '50%', speed: 0.35 },
];

export default function ParallaxOrbs({ className = '' }) {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll();

    return (
        <div ref={containerRef} className={`parallax-orbs ${className}`}>
            {orbConfigs.map((orb, i) => {
                const y = useTransform(scrollYProgress, [0, 1], [0, -100 * orb.speed]);

                return (
                    <motion.div
                        key={i}
                        className="parallax-orb"
                        style={{
                            width: orb.size,
                            height: orb.size,
                            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
                            top: orb.top,
                            left: orb.left,
                            right: orb.right,
                            bottom: orb.bottom,
                            y,
                        }}
                    />
                );
            })}
        </div>
    );
}
