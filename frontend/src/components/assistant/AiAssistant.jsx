import { useState, useCallback } from 'react';
import { MessageSquare, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import './AiAssistant.css';

export default function AiAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);

    const togglePanel = useCallback(() => {
        setIsOpen(prev => !prev);
        setHasNewMessage(false);
    }, []);

    return (
        <>
            {/* FAB Button */}
            <button
                id="ai-assistant-fab"
                className={`ai-fab ${isOpen ? 'open' : ''}`}
                onClick={togglePanel}
                aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
            >
                {isOpen ? <X /> : <MessageSquare />}
                {hasNewMessage && !isOpen && <span className="ai-fab-badge" />}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <ChatPanel
                    onClose={() => setIsOpen(false)}
                    onNewMessage={() => setHasNewMessage(true)}
                />
            )}
        </>
    );
}
