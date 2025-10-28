// src/pages/HealthPage.js

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import Loader from '../components/Loader';

import '../styles/index.css';

function HealthPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchHealth() {
      setLoading(true);
      setError('');
      
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        
        const data = await res.json();
        setHealth(data);
      } catch (err) {
        console.error('Health check failed:', err);
        setError(err.message || 'Failed to fetch health data');
        setHealth({
          status: 'error',
          mongo: 'unknown',
          message: 'Unable to reach health endpoint'
        });
      } finally {
        setLoading(false);
      }
    }
    
    fetchHealth();
    
    // Optional: Poll health status every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [token]);

  function getStatusIcon(status) {
    if (status === 'ok' || status === 'connected') return '✅';
    if (status === 'error' || status === 'disconnected') return '❌';
    return '⚠️';
  }

  function getStatusClass(status) {
    if (status === 'ok' || status === 'connected') return 'status-ok';
    if (status === 'error' || status === 'disconnected') return 'status-error';
    return 'status-warning';
  }

  return (
    <div className="health-container">
      <header className="health-header">
        <h2 className="health-heading">❤️ System Health Status</h2>
        <button className="health-back-btn" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
      </header>

      {loading ? (
        <Loader message="Checking system health..." />
      ) : error ? (
        <div className="health-error-banner">
          <strong>⚠️ Health Check Failed</strong>
          <p>{error}</p>
          <button className="health-retry-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="health-status">
          <div className="health-summary">
            <div className={`health-indicator ${getStatusClass(health?.status)}`}>
              {getStatusIcon(health?.status)} System Status: <strong>{health?.status || 'Unknown'}</strong>
            </div>
          </div>

          <table className="health-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>API Health</td>
                <td className={getStatusClass(health?.status)}>
                  {getStatusIcon(health?.status)} {health?.status || 'Unknown'}
                </td>
              </tr>
              <tr>
                <td>MongoDB</td>
                <td className={getStatusClass(health?.mongo)}>
                  {getStatusIcon(health?.mongo)} {health?.mongo || 'Unknown'}
                </td>
              </tr>
              {health?.uptime && (
                <tr>
                  <td>Uptime</td>
                  <td>{Math.floor(health.uptime / 60)} minutes</td>
                </tr>
              )}
              {health?.timestamp && (
                <tr>
                  <td>Last Check</td>
                  <td>{new Date(health.timestamp).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>

          {health?.message && (
            <div className="health-message">
              <strong>Message:</strong> {health.message}
            </div>
          )}

          <div className="health-footer">
            <small>Auto-refreshes every 30 seconds</small>
          </div>
        </div>
      )}
    </div>
  );
}

export default HealthPage;
