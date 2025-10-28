// src/components/Loader.js

import React from 'react';

/**
 * Loader - Reusable loading spinner component
 * @param {string} message - Optional message to display below spinner
 * @param {string} size - Size of spinner: 'small', 'medium', 'large'
 */
function Loader({ message = 'Loading...', size = 'medium' }) {
  const sizes = {
    small: '24px',
    medium: '48px',
    large: '64px',
  };

  const spinnerSize = sizes[size] || sizes.medium;

  return (
    <div style={styles.container}>
      <div style={{ ...styles.spinner, width: spinnerSize, height: spinnerSize }}>
        <div style={styles.spinnerInner}></div>
      </div>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    padding: '20px',
  },
  spinner: {
    position: 'relative',
    animation: 'rotate 1s linear infinite',
  },
  spinnerInner: {
    width: '100%',
    height: '100%',
    border: '4px solid rgba(255, 131, 7, 0.2)',
    borderTop: '4px solid #FF8307',
    borderRadius: '50%',
  },
  message: {
    marginTop: '16px',
    color: '#FF8307',
    fontSize: '1rem',
    fontWeight: '500',
  },
};

// Add keyframe animation via a style tag
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default Loader;
