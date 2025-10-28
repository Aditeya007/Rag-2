import React, { useState } from 'react';
import RAGChatbot from './components/RAGChatbot';
import './App.css';

// Using inline SVGs is a great practice for widgets as it avoids extra file requests.
// This is the icon for the launcher button when the chat is closed.
const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

// This is the 'X' icon for the launcher button when the chat is open.
const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);


function App() {
  // This state is the single source of truth for the widget's visibility.
  const [isOpen, setIsOpen] = useState(false);

  // This function is the only way to change the widget's state.
  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  return (
    // This is the "force field" ID. All our styles will be scoped to this.
    <div id="rag-widget-root">
      
      {/* The Chatbot Window Container */}
      {/* It's always in the DOM, but its visibility and position are controlled by the 'open' class. */}
      <div className={`chatbot-window-container ${isOpen ? 'open' : ''}`}>
        {/* We pass the toggle function down so the chatbot can close itself. */}
        {/* Your original RAGChatbot component lives here, unchanged in its core logic. */}
        <RAGChatbot toggleChatbot={toggleChatbot} />
      </div>

      {/* The Launcher Button */}
      {/* This is the entry point for the user. It floats on the host website. */}
      <button className="chatbot-launcher-button" onClick={toggleChatbot} aria-label="Toggle Chatbot">
        {/* We conditionally render the icon based on the 'isOpen' state. */}
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

    </div>
  );
}

export default App;