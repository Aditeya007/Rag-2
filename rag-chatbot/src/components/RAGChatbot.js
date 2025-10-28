import React, { useState, useEffect, useRef } from 'react';
import './RAGChatbot.css'; // Assuming you have this CSS file for styling

// Helper component for the close icon in the header
const HeaderCloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const RAGChatbot = ({ toggleChatbot }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const messagesEndRef = useRef(null);
    
    // This line correctly reads the backend URL from your .env file
    const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    // Initialize the chat with a welcome message
    useEffect(() => {
        setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        setMessages([{
            text: "Hello! I'm an AI assistant. How can I help you today?",
            sender: 'bot'
        }]);
    }, []);

    // Automatically scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [messages]);

    // This is the function that sends the request to the backend.
    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const userMessage = { text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            // Debug logging
            console.log('API Base URL:', apiBaseUrl);
            console.log('Session ID:', sessionId);
            console.log('Sending request with payload:', { 
                query: currentInput,
                session_id: sessionId
            });

            // The fetch call is the bridge to your backend.
            const response = await fetch(`${apiBaseUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                
                // *** THE CRUCIAL FIX IS HERE ***
                // The JSON key MUST be "query" to match your Python backend's Pydantic model.
                body: JSON.stringify({ 
                    query: currentInput,
                    session_id: sessionId
                }),
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                // This provides more detailed error info if the server responds with an error
                const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
                throw new Error(`Server error: ${response.status} - ${errorData.detail}`);
            }

            const data = await response.json();
            setMessages(prev => [...prev, { text: data.answer, sender: 'bot' }]);

        } catch (error) {
            console.error("Failed to fetch from RAG API:", error);
            setMessages(prev => [...prev, {
                text: `Sorry, there was an error connecting to the server: ${error.message}`,
                sender: 'bot',
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Allows sending message with the Enter key
    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && !isLoading) {
            handleSend();
        }
    };

    return ( 
        <div className="rag-chatbot-container">
            <div className="chatbot-header">
                <h3>AI Assistant</h3>
                <button onClick={toggleChatbot} className="close-chatbot-btn" aria-label="Close Chatbot">
                   <HeaderCloseIcon />
                </button>
            </div>

            <div className="chatbot-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender} ${msg.isError ? 'error' : ''}`}>
                        <p>{msg.text}</p>
                    </div>
                ))} 
                {isLoading && (
                    <div className="message bot">
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chatbot-input-area">
                <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={isLoading || input.trim() === ''}>
                    Send
                </button> 
            </div> 
        </div>
    );
};

export default RAGChatbot;

