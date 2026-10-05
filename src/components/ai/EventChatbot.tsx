'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function EventChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
        api: '/api/assistant',
        fetch: async (input, init) => {
            const response = await fetch(input, init);
            if (!response.ok) {
                let message = `Assistant request failed (${response.status}).`;
                try {
                    const body: unknown = await response.clone().json();
                    if (
                        typeof body === 'object' &&
                        body !== null &&
                        'error' in body &&
                        typeof body.error === 'string'
                    ) {
                        message = body.error;
                    }
                } catch {
                    // Keep the status-based message if the server did not return JSON.
                }
                throw new Error(message);
            }
            return response;
        },
    });

    return (
        <div className="assistant-widget">
            {!isOpen ? (
                <button className="assistant-launcher" type="button" onClick={() => setIsOpen(true)}>
                    <span aria-hidden="true">✦</span>
                    Ask Assistant
                </button>
            ) : (
                <section className="assistant-chat" aria-label="Event assistant">
                    <header className="assistant-header">
                        <div>
                            <span className="assistant-header-icon" aria-hidden="true">✦</span>
                            <h2>Event Assistant</h2>
                        </div>
                        <button
                            className="assistant-close"
                            type="button"
                            aria-label="Close assistant"
                            onClick={() => setIsOpen(false)}
                        >
                            ×
                        </button>
                    </header>

                    <div className="assistant-messages" aria-live="polite">
                        {messages.length === 0 && (
                            <p className="assistant-empty">
                                Ask about events, tasks, guests, your budget, or vendors.
                            </p>
                        )}
                        {messages.map((message) => (
                            <div
                                className={`assistant-message ${message.role === 'user' ? 'assistant-message-user' : 'assistant-message-ai'}`}
                                key={message.id}
                            >
                                {message.role === 'assistant' ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            table: ({ children }) => (
                                                <div className="assistant-table-wrap" role="region" aria-label="Event details" tabIndex={0}>
                                                    <table>{children}</table>
                                                </div>
                                            ),
                                        }}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                ) : (
                                    message.content
                                )}
                            </div>
                        ))}
                        {isLoading && <p className="assistant-thinking">Assistant is thinking…</p>}
                        {error && (
                            <p className="assistant-error" role="alert">
                                {error.message || 'The assistant could not respond. Please try again.'}
                            </p>
                        )}
                    </div>

                    <form className="assistant-form" onSubmit={handleSubmit}>
                        <input
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Ask about your plan…"
                            aria-label="Message the event assistant"
                            maxLength={4000}
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
                            Send
                        </button>
                    </form>
                </section>
            )}
        </div>
    );
}
