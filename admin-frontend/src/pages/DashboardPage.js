// src/pages/DashboardPage.js

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/index';

import '../styles/index.css';

function DashboardPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [isScrapeModalOpen, setScrapeModalOpen] = useState(false);
  const [startUrl, setStartUrl] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [jobResult, setJobResult] = useState(null);

  const summaryJobId = jobResult?.summary
    ? jobResult.summary.jobId || jobResult.jobId || null
    : null;
  const summaryResourceId = jobResult?.summary
    ? jobResult.summary.resource_id || jobResult.summary.resourceId || jobResult.resourceId || null
    : null;

  // User resource endpoints, to be filled from backend profile (as you build infra)
  const dbUri = user?.databaseUri || 'Not provisioned yet';
  const botEndpoint = user?.botEndpoint || 'Not provisioned yet';
  const schedulerEndpoint = user?.schedulerEndpoint || 'Not provisioned yet';
  const scraperEndpoint = user?.scraperEndpoint || 'Not provisioned yet';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function openScrapeModal() {
    setStartUrl('');
    setStatusMessage('');
    setErrorMessage('');
    setJobResult(null);
    setScrapeModalOpen(true);
  }

  function closeScrapeModal() {
    if (isProcessing) {
      return;
    }
    setScrapeModalOpen(false);
  }

  async function handleScrape() {
    if (!startUrl || !startUrl.trim()) {
      setErrorMessage('Please provide a website URL to scrape.');
      return;
    }

    const normalizedUrl = startUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      setErrorMessage('URL must begin with http:// or https://');
      return;
    }

    if (!token) {
      setErrorMessage('Authentication expired. Please log in again.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('Launching updater. This may take a while depending on site size...');
    setProcessing(true);
    setJobResult(null);

    try {
      const response = await apiRequest('/scrape/update', {
        method: 'POST',
        token,
        data: {
          startUrl: normalizedUrl
        }
      });

      setStatusMessage('✅ Scraping completed successfully. You can now interact with the bot using the refreshed knowledge base.');
      setJobResult(response);
    } catch (err) {
      setErrorMessage(err.message || 'Scrape failed. Please try again later.');
      setStatusMessage('');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Welcome, {user?.name || user?.username || 'Admin'}!</h2>
        <button className="dashboard-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="dashboard-info">
        <h3>Your Isolated System Resources</h3>
        <p className="dashboard-subtitle">
          Each user has their own dedicated infrastructure for the RAG chatbot system.
        </p>
        <table className="dashboard-table">
          <tbody>
            <tr>
              <td><strong>Database URI:</strong></td>
              <td className="dashboard-value">{dbUri}</td>
            </tr>
            <tr>
              <td><strong>Bot Endpoint:</strong></td>
              <td className="dashboard-value">{botEndpoint}</td>
            </tr>
            <tr>
              <td><strong>Scheduler Endpoint:</strong></td>
              <td className="dashboard-value">{schedulerEndpoint}</td>
            </tr>
            <tr>
              <td><strong>Scraper Endpoint:</strong></td>
              <td className="dashboard-value">{scraperEndpoint}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="dashboard-actions">
        <button
          className="dashboard-action-btn"
          onClick={() => navigate('/bot')}
        >
          🤖 Interact with Bot
        </button>
        <button
          className="dashboard-action-btn"
          onClick={openScrapeModal}
        >
          🧹 Run Scrape & Update
        </button>
      </section>

      {isScrapeModalOpen && (
        <div className="scrape-modal-overlay" role="dialog" aria-modal="true">
          <div className="scrape-modal">
            <h3>Run Tenant Scrape & Updater</h3>
            <p className="scrape-modal-subtitle">
              Provide the root URL you want to crawl. The updater will refresh your tenant&apos;s knowledge base and notify you when it finishes.
            </p>

            <label htmlFor="scrape-start-url">Website URL</label>
            <input
              id="scrape-start-url"
              type="url"
              placeholder="https://example.com"
              value={startUrl}
              onChange={(event) => setStartUrl(event.target.value)}
              disabled={isProcessing}
            />

            {statusMessage && (
              <p className="scrape-status">{statusMessage}</p>
            )}

            {errorMessage && (
              <p className="scrape-error">{errorMessage}</p>
            )}

            {isProcessing && (
              <p className="scrape-processing">Working... This window will update once the job completes.</p>
            )}

            {jobResult?.summary && (
              <div className="scrape-summary">
                <h4>Job Summary</h4>
                {jobResult.summary.status && (
                  <p><strong>Status:</strong> {jobResult.summary.status}</p>
                )}
                {summaryJobId && (
                  <p><strong>Job ID:</strong> {summaryJobId}</p>
                )}
                {summaryResourceId && (
                  <p><strong>Resource ID:</strong> {summaryResourceId}</p>
                )}
                {jobResult.summary.stats && (
                  <pre>{JSON.stringify(jobResult.summary.stats, null, 2)}</pre>
                )}
              </div>
            )}

            {jobResult?.stdout && (
              <details className="scrape-logs">
                <summary>View Logs</summary>
                <pre>{jobResult.stdout}</pre>
              </details>
            )}

            <div className="scrape-modal-actions">
              <button
                type="button"
                className="scrape-btn-neutral"
                onClick={closeScrapeModal}
                disabled={isProcessing}
              >
                Close
              </button>
              <button
                type="button"
                className="scrape-btn-primary"
                onClick={handleScrape}
                disabled={isProcessing}
              >
                {isProcessing ? 'Running...' : 'Start Scrape'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
