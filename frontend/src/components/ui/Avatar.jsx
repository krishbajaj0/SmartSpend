import './Avatar.css';

const gradients = [
    'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    'linear-gradient(135deg, #00cec9, #81ecec)',
    'linear-gradient(135deg, #fd79a8, #e84393)',
    'linear-gradient(135deg, #fdcb6e, #f39c12)',
    'linear-gradient(135deg, #00b894, #55efc4)',
    'linear-gradient(135deg, #0984e3, #74b9ff)',
];

function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function getGradient(name) {
    if (!name) return gradients[0];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
}

export default function Avatar({ name, src, size = 40, online, className = '' }) {
    const initials = getInitials(name);
    const gradient = getGradient(name);

    return (
        <div className={`avatar ${className}`} style={{ width: size, height: size }}>
            {src ? (
                <img src={src} alt={name} className="avatar-img" />
            ) : (
                <div
                    className="avatar-initials"
                    style={{ background: gradient, fontSize: size * 0.38 }}
                >
                    {initials}
                </div>
            )}
            {online !== undefined && (
                <span className={`avatar-status ${online ? 'online' : 'offline'}`} />
            )}
        </div>
    );
}
