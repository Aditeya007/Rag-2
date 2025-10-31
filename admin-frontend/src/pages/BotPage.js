// src/pages/BotPage.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useApi from '../hooks/useApi';

import '../styles/index.css';

function BotPage() {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();
  const { execute, loading } = useApi();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [sessionId, setSessionId] = useState(() => `tenant_session_${Date.now()}`);
  const messagesEndRef = useRef(null);

  const displayName = useMemo(() => user?.name || user?.username || 'there', [user]);
  const activeTenantId = useMemo(() => {
    if (!activeTenant) {
      return null;
    }
    return activeTenant.id || activeTenant._id || null;
  }, [activeTenant]);

  useEffect(() => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'bot',
        text: `Hi ! I'm an AI assistant. How can I help you today?`,
      },
    ]);
    setSessionId(`tenant_session_${Date.now()}`);
  }, [displayName]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const appendMessage = useCallback((message) => {
    const uniqueId = `${message.sender}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, { ...message, id: uniqueId }]);
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) {
      return;
    }

    if (!activeTenantId) {
      setInlineError('Create or select a user before interacting with the bot.');
      return;
    }

    setInlineError('');
    appendMessage({ sender: 'user', text: trimmed });
    setInput('');

    const result = await execute('/bot/run', {
      method: 'POST',
      data: { input: trimmed, sessionId, tenantUserId: activeTenantId },
    });

    if (result.success && result.data?.answer) {
      if (result.data.session_id) {
        setSessionId(result.data.session_id);
      }
      appendMessage({ sender: 'bot', text: result.data.answer });

      if (Array.isArray(result.data.sources) && result.data.sources.length > 0) {
        appendMessage({
          sender: 'bot',
          text: `Sources:\n${result.data.sources.map((src, index) => `${index + 1}. ${src}`).join('\n')}`,
        });
      }
    } else {
      const errorMessage = result.error || 'Bot service is unavailable right now.';
      setInlineError(errorMessage);
      appendMessage({ sender: 'bot', text: errorMessage, isError: true });
    }
  }, [activeTenantId, appendMessage, execute, input, loading, sessionId]);

  const handleReset = useCallback(() => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'bot',
        text: `Hi ${displayName}! Start a new conversation whenever you're ready.`,
      },
    ]);
    setInlineError('');
    setSessionId(`tenant_session_${Date.now()}`);
  }, [displayName]);

  return (
    <div className="bot-container">
      {!activeTenantId && (
        <div className="bot-error-banner">
          <strong>No tenant selected</strong>
          <span>
            Create a user on the dashboard and set it as active before using the bot.
          </span>
        </div>
      )}
      <header className="bot-header">
        <h2 className="bot-heading">🤖AI Assistant</h2>
        <div className="bot-header-actions">
    <button className="bot-clear-btn" onClick={handleReset} disabled={loading}>
            Reset Session
          </button>
          <button className="bot-back-btn" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
        </div>
      </header>

      {inlineError && (
        <div className="bot-error-banner">
          <strong>Request failed</strong>
          <span>{inlineError}</span>
        </div>
      )}

      <div className="bot-messages">
        {messages.length === 0 && (
          <div className="bot-welcome">
            Start a conversation to see responses here.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`bot-message ${
              message.sender === 'user' ? 'bot-message-user' : 'bot-message-bot'
            } ${message.isError ? 'bot-message-error' : ''}`}
          >
            {message.text.split('\n').map((line, index) => (
              <p key={`${message.id}-${index}`}>{line}</p>
            ))}
          </div>
        ))}

        {loading && (
          <div className="bot-message bot-message-bot bot-typing">
            Generating answer…
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="bot-form" onSubmit={handleSubmit}>
        <input
          className="bot-input"
          type="text"
          placeholder="Ask a question about your data..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={loading || !activeTenantId}
        />
        <button
          className="bot-send-btn"
          type="submit"
          disabled={loading || !input.trim() || !activeTenantId}
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>

      <div className="bot-footer-info">
        <small>
          Session: <code>{sessionId}</code>
        </small>
      </div>
    </div>
  );
}

export default BotPage;
