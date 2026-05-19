import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, BotMessageSquare } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { aiAPI } from '../../utils/api';

const WELCOME_SUGGESTIONS = [
    '💰 How much did I spend this month?',
    '📊 What\'s my financial health score?',
    '🔄 Show my subscriptions',
    '📈 Predict my spending this month',
];

const STORAGE_KEY = 'smartspend_chat_session';

export default function ChatPanel({ onClose }) {
    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Expire local session after 2 hours of inactivity
                if (Date.now() - parsed.lastUpdated < 2 * 60 * 60 * 1000) {
                    return parsed.messages || [];
                }
            }
        } catch { }
        return [];
    });
    
    const [isLoading, setIsLoading] = useState(false);
    
    const [conversationState, setConversationState] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved).conversationState || null;
        } catch { }
        return null;
    });

    const [sessionId, setSessionId] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved).sessionId || null;
        } catch { }
        return null;
    });
    
    const messagesEndRef = useRef(null);

    // Persist to localStorage whenever state changes
    useEffect(() => {
        try {
            if (messages.length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    messages,
                    conversationState,
                    sessionId,
                    lastUpdated: Date.now(),
                }));
            }
        } catch { }
    }, [messages, conversationState, sessionId]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Handle ESC key close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const sendMessage = useCallback(async (text) => {
        const userMsg = {
            id: Date.now(),
            role: 'user',
            message: text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const { data } = await aiAPI.chat(text, conversationState, sessionId);

            const assistantMsg = {
                id: Date.now() + 1,
                role: 'assistant',
                message: data.response.text,
                structuredResponse: data.response,
                meta: data.meta,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
            setConversationState(data.conversationState);
            if (data.sessionId) setSessionId(data.sessionId);
        } catch (err) {
            const errorMsg = {
                id: Date.now() + 1,
                role: 'assistant',
                message: 'Sorry, something went wrong. Please try again.',
                structuredResponse: {
                    type: 'error',
                    text: err.response?.data?.message || 'Connection error. Please try again.',
                    data: null,
                    charts: null,
                    suggestions: ['Try again'],
                    severity: 'danger',
                    actions: null,
                },
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [conversationState, sessionId]);

    const handleSuggestionClick = useCallback((suggestion) => {
        // Strip emoji prefix
        const cleanText = suggestion.replace(/^[^\w\s]+\s*/, '').trim();
        sendMessage(cleanText);
    }, [sendMessage]);

    const showWelcome = messages.length === 0;

    return (
        <div className="ai-panel ai-panel-enter" role="dialog" aria-label="AI Assistant">
            {/* Header */}
            <div className="ai-panel-header">
                <div className="ai-panel-header-left">
                    <div className="ai-panel-avatar">
                        <Sparkles />
                    </div>
                    <div>
                        <div className="ai-panel-title">SmartSpend AI</div>
                        <div className="ai-panel-subtitle">Financial Assistant</div>
                    </div>
                </div>
                <button className="ai-panel-close" onClick={onClose} aria-label="Close">
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div className="ai-messages">
                {showWelcome ? (
                    <div className="ai-welcome">
                        <div className="ai-welcome-icon">
                            <BotMessageSquare size={32} />
                        </div>
                        <h3>Hey! 👋</h3>
                        <p>
                            I'm your SmartSpend financial assistant. Ask me anything about your spending, health score, predictions, or subscriptions.
                        </p>
                        <div className="ai-welcome-suggestions">
                            {WELCOME_SUGGESTIONS.map((s, i) => (
                                <button
                                    key={i}
                                    className="ai-welcome-btn"
                                    onClick={() => handleSuggestionClick(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, index) => {
                            const isConsecutive = index > 0 && messages[index - 1].role === msg.role;
                            return (
                                <ChatMessage
                                    key={msg.id}
                                    message={msg}
                                    isConsecutive={isConsecutive}
                                    onSuggestionClick={handleSuggestionClick}
                                />
                            );
                        })}
                        {isLoading && <TypingIndicator />}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
    );
}
