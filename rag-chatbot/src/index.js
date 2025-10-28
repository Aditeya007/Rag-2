import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Global styles (like fonts) can go here.
import App from './App';

// We define a global object for our widget. This is safer than just attaching to window.
window.RAGChatbotWidget = {
  // The 'init' function is the public API for starting our widget.
  init: () => {
    // We check if the widget has already been initialized to prevent duplicates.
    if (document.getElementById('rag-chatbot-widget-container')) {
      console.warn('RAG Chatbot Widget has already been initialized.');
      return;
    }

    // Step 1: Create the div that will house our entire React app.
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'rag-chatbot-widget-container';

    // Step 2: Append this new div to the body of the host website.
    document.body.appendChild(widgetContainer);

    // Step 3: Use React to render our App component into our new container.
    const root = ReactDOM.createRoot(widgetContainer);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  },
};

// For easy local development, we can automatically initialize the widget.
// This ensures that when you run `npm start`, you see the widget immediately.
if (process.env.NODE_ENV === 'development') {
    window.RAGChatbotWidget.init();
}