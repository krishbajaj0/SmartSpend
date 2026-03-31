import './SkeletonLoader.css';

export function SkeletonLine({ width = '100%', height = 16, className = '' }) {
    return (
        <div
            className={`skeleton-line ${className}`}
            style={{ width, height }}
        />
    );
}

export function SkeletonCircle({ size = 40, className = '' }) {
    return (
        <div
            className={`skeleton-circle ${className}`}
            style={{ width: size, height: size }}
        />
    );
}

export function SkeletonCard({ className = '' }) {
    return (
        <div className={`skeleton-card ${className}`}>
            <div className="skeleton-card-header">
                <SkeletonCircle size={36} />
                <div className="skeleton-card-meta">
                    <SkeletonLine width="60%" height={14} />
                    <SkeletonLine width="40%" height={12} />
                </div>
            </div>
            <SkeletonLine height={20} />
            <SkeletonLine width="80%" height={14} />
        </div>
    );
}

export default function SkeletonLoader({ type = 'line', count = 1, ...props }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => {
                if (type === 'card') return <SkeletonCard key={i} {...props} />;
                if (type === 'circle') return <SkeletonCircle key={i} {...props} />;
                return <SkeletonLine key={i} {...props} />;
            })}
        </>
    );
}
