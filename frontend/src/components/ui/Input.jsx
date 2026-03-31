import { useState } from 'react';
import './Input.css';

export default function Input({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    error,
    icon,
    disabled = false,
    className = '',
    id,
    ...props
}) {
    const [focused, setFocused] = useState(false);
    const hasValue = value && value.length > 0;
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

    return (
        <div className={`input-wrapper ${focused ? 'focused' : ''} ${error ? 'has-error' : ''} ${hasValue ? 'has-value' : ''} ${className}`}>
            {icon && <span className="input-icon">{icon}</span>}
            <input
                id={inputId}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={focused ? placeholder : ' '}
                disabled={disabled}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className={icon ? 'has-icon' : ''}
                {...props}
            />
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                </label>
            )}
            {error && <span className="input-error">{error}</span>}
        </div>
    );
}

export function Textarea({
    label,
    value,
    onChange,
    placeholder,
    error,
    rows = 4,
    className = '',
    id,
    ...props
}) {
    const [focused, setFocused] = useState(false);
    const hasValue = value && value.length > 0;
    const inputId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-')}`;

    return (
        <div className={`input-wrapper ${focused ? 'focused' : ''} ${error ? 'has-error' : ''} ${hasValue ? 'has-value' : ''} ${className}`}>
            <textarea
                id={inputId}
                value={value}
                onChange={onChange}
                placeholder={focused ? placeholder : ' '}
                rows={rows}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                {...props}
            />
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                </label>
            )}
            {error && <span className="input-error">{error}</span>}
        </div>
    );
}
