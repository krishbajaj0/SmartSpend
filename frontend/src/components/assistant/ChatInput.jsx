import { useState, useRef, useEffect } from 'react';
import { SendHorizonal } from 'lucide-react';

export default function ChatInput({ onSend, disabled }) {
    const [input, setInput] = useState('');
    const inputRef = useRef(null);

    // Auto-focus input when enabled
    useEffect(() => {
        if (!disabled && inputRef.current) {
            inputRef.current.focus();
        }
    }, [disabled]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed && !disabled) {
            onSend(trimmed);
            setInput('');
        }
    };

    return (
        <form className="chat-input-container" onSubmit={handleSubmit}>
            <input
                ref={inputRef}
                type="text"
                className="chat-input"
                placeholder="Ask about your spending..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={disabled}
                maxLength={500}
                aria-label="Chat input"
            />
            <button
                type="submit"
                className="ai-send-btn"
                disabled={disabled || !input.trim()}
                aria-label="Send message"
            >
                <SendHorizonal />
            </button>
        </form>
    );
}
