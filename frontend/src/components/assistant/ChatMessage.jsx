import ResponseRenderer from './ResponseRenderer';

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, onSuggestionClick, isConsecutive }) {
    const isUser = message.role === 'user';
    const spacingClass = isConsecutive ? 'grouped-message' : 'new-sender';

    return (
        <div className={`chat-message-wrapper ${isUser ? 'user-message' : 'ai-message'} ${spacingClass}`}>
            <div className="chat-bubble">
                <div className="message-content">
                    {isUser ? (
                        <span>{message.message}</span>
                    ) : message.structuredResponse ? (
                        <ResponseRenderer
                            response={message.structuredResponse}
                            meta={message.meta}
                            onSuggestionClick={onSuggestionClick}
                        />
                    ) : (
                        <span>{message.message}</span>
                    )}
                </div>
            </div>
            <div className="message-meta">{formatTime(message.timestamp)}</div>
        </div>
    );
}
