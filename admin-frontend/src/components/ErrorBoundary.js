// src/components/ErrorBoundary.js

import React from 'react';

/**
 * ErrorBoundary - Catches JavaScript errors anywhere in the component tree
 * Displays a fallback UI instead of crashing the entire app
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state to trigger fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Optionally redirect or reload
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <h1 style={styles.heading}>⚠️ Something went wrong</h1>
            <p style={styles.message}>
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details</summary>
                <pre style={styles.pre}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button style={styles.button} onClick={this.handleReset}>
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Inline styles for error boundary (independent of main CSS)
const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#181f2a',
    color: '#f1f1f1',
    padding: '20px',
  },
  content: {
    maxWidth: '600px',
    textAlign: 'center',
    background: '#222e3c',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  heading: {
    fontSize: '2rem',
    marginBottom: '16px',
    color: '#FF8307',
  },
  message: {
    fontSize: '1.1rem',
    marginBottom: '24px',
    lineHeight: '1.6',
  },
  details: {
    textAlign: 'left',
    background: '#1a1a1a',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #333',
  },
  summary: {
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#FF8307',
  },
  pre: {
    fontSize: '0.85rem',
    overflow: 'auto',
    color: '#ff6b6b',
  },
  button: {
    background: '#FF8307',
    color: '#fff',
    border: 'none',
    padding: '12px 32px',
    fontSize: '1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'background 0.3s',
  },
};

export default ErrorBoundary;
