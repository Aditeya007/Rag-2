// src/pages/DashboardPage.js

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api';
import UserForm from '../components/users/UserForm';
import Loader from '../components/Loader';

import '../styles/index.css';

function DashboardPage() {
  const { user, token, logout, activeTenant, setActiveTenant } = useAuth();
  const navigate = useNavigate();

  const [tenantDetails, setTenantDetails] = useState(activeTenant);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isScrapeModalOpen, setScrapeModalOpen] = useState(false);
  const [startUrl, setStartUrl] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [scrapeError, setScrapeError] = useState('');
  const [jobResult, setJobResult] = useState(null);

  const summaryJobId = jobResult?.summary
    ? jobResult.summary.jobId || jobResult.jobId || null
    : null;
  const summaryResourceId = jobResult?.summary
    ? jobResult.summary.resource_id || jobResult.summary.resourceId || jobResult.resourceId || null
    : null;

  const activeTenantId = useMemo(() => {
    if (!activeTenant) {
      return null;
    }
    return activeTenant.id || activeTenant._id || null;
  }, [activeTenant]);

  useEffect(() => {
    if (!token || !activeTenantId) {
      setTenantDetails(null);
      setTenantError('');
      return;
    }

    let isCancelled = false;

    async function fetchTenant() {
      setTenantLoading(true);
      setTenantError('');
      try {
        const response = await apiRequest(`/users/${activeTenantId}`, {
          method: 'GET',
          token
        });
        if (!isCancelled) {
          setTenantDetails(response.user);
          setActiveTenant(response.user);
        }
      } catch (err) {
        if (!isCancelled) {
          setTenantDetails(null);
          setTenantError(err.message || 'Unable to load the selected user.');
          setActiveTenant(null);
        }
      } finally {
        if (!isCancelled) {
          setTenantLoading(false);
        }
      }
    }

    fetchTenant();

    return () => {
      isCancelled = true;
    };
  }, [activeTenantId, setActiveTenant, token]);

  useEffect(() => {
    if (!createSuccess) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setCreateSuccess(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [createSuccess]);

  const dbUri = tenantDetails?.databaseUri || 'Not provisioned yet';
  const botEndpoint = tenantDetails?.botEndpoint || 'Not provisioned yet';
  const schedulerEndpoint = tenantDetails?.schedulerEndpoint || 'Not provisioned yet';
  const scraperEndpoint = tenantDetails?.scraperEndpoint || 'Not provisioned yet';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function openCreateModal() {
    setCreateError('');
    setCreateSuccess('');
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (createLoading) {
      return;
    }
    setCreateModalOpen(false);
  }

  function openScrapeModal() {
    if (!tenantDetails) {
      setTenantError('Create or select a user before running a scrape.');
      return;
    }
    setStartUrl('');
    setStatusMessage('');
    setScrapeError('');
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
    if (!tenantDetails) {
      setScrapeError('No user selected.');
      return;
    }

    if (!startUrl || !startUrl.trim()) {
      setScrapeError('Please provide a website URL to scrape.');
      return;
    }

    const normalizedUrl = startUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      setScrapeError('URL must begin with http:// or https://');
      return;
    }

    if (!token) {
      setScrapeError('Authentication expired. Please log in again.');
      return;
    }

    setScrapeError('');
    setStatusMessage('Launching updater. This may take a while depending on site size...');
    setProcessing(true);
    setJobResult(null);

    try {
      const response = await apiRequest('/scrape/update', {
        method: 'POST',
        token,
        data: {
          startUrl: normalizedUrl,
          tenantUserId: tenantDetails.id || tenantDetails._id
        }
      });

      setStatusMessage('✅ Scraping completed successfully. You can now interact with the bot using the refreshed knowledge base.');
      setJobResult(response);
    } catch (err) {
      setScrapeError(err.message || 'Scrape failed. Please try again later.');
      setStatusMessage('');
    } finally {
      setProcessing(false);
    }
  }

  async function handleCreateUser(values) {
    if (!token) {
      setCreateError('Session expired. Please log in again.');
      return;
    }

    setCreateError('');
    setCreateSuccess('');
    setCreateLoading(true);

    try {
      const response = await apiRequest('/users', {
        method: 'POST',
        token,
        data: {
          name: values.name.trim(),
          email: values.email.trim(),
          username: values.username.trim(),
          password: values.password
        }
      });

      setActiveTenant(response.user);
      setTenantDetails(response.user);
      setCreateSuccess('User created and provisioned successfully.');
      setCreateModalOpen(false);
    } catch (err) {
      setCreateError(err.message || 'Failed to create user.');
    } finally {
      setCreateLoading(false);
    }
  }

  const hasProvisionedTenant = Boolean(tenantDetails);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Welcome, {user?.name || user?.username || 'Admin'}!</h2>
        <button className="dashboard-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="dashboard-actions">
        <button className="dashboard-action-btn" onClick={openCreateModal}>
          ➕ Create User
        </button>
        <button
          className="dashboard-action-btn"
          onClick={() => navigate('/admin/users')}
        >
          📋 View Users
        </button>
      </section>

      {createSuccess && (
        <div className="dashboard-alert dashboard-alert--success">{createSuccess}</div>
      )}

      {tenantError && (
        <div className="dashboard-alert dashboard-alert--error">{tenantError}</div>
      )}

      {tenantLoading ? (
        <Loader message="Loading selected user..." />
      ) : hasProvisionedTenant ? (
        <>
          <section className="dashboard-info">
            <h3>Provisioned Resources for {tenantDetails.name}</h3>
            <p className="dashboard-subtitle">
              The infrastructure below was created when the user was provisioned.
            </p>
            <table className="dashboard-table">
              <tbody>
                <tr>
                  <td><strong>Tenant ID:</strong></td>
                  <td className="dashboard-value">{tenantDetails.id || tenantDetails._id}</td>
                </tr>
                <tr>
                  <td><strong>Resource ID:</strong></td>
                  <td className="dashboard-value">{tenantDetails.resourceId}</td>
                </tr>
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

          <section className="dashboard-actions dashboard-actions--secondary">
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
        </>
      ) : (
        <section className="dashboard-empty">
          <p>Create a user to provision dedicated endpoints for the RAG system.</p>
        </section>
      )}

      {createModalOpen && (
        <div className="scrape-modal-overlay" role="dialog" aria-modal="true">
          <div className="scrape-modal">
            <h3>Create User</h3>
            <p className="scrape-modal-subtitle">
              Enter the user details. Provisioning runs immediately after submission.
            </p>

            {createError && <p className="scrape-error">{createError}</p>}

            <UserForm
              mode="create"
              loading={createLoading}
              onSubmit={handleCreateUser}
            />

            <div className="scrape-modal-actions">
              <button
                type="button"
                className="scrape-btn-neutral"
                onClick={closeCreateModal}
                disabled={createLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isScrapeModalOpen && (
        <div className="scrape-modal-overlay" role="dialog" aria-modal="true">
          <div className="scrape-modal">
            <h3>Run Tenant Scrape & Updater</h3>
            <p className="scrape-modal-subtitle">
              Provide the root URL you want to crawl. The updater will refresh the selected user&apos;s knowledge base and notify you when it finishes.
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

            {scrapeError && (
              <p className="scrape-error">{scrapeError}</p>
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
