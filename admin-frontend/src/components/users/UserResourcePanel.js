// src/components/users/UserResourcePanel.js

import React from 'react';
import Loader from '../Loader';

function UserResourcePanel({ user, resourceState, onClose }) {
  if (!user) {
    return null;
  }

  const { data, loading, error } = resourceState;

  return (
    <aside className="admin-resource-panel">
      <div className="admin-resource-panel__header">
        <h3>Tenant Resources</h3>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="admin-resource-panel__subtitle">
        {user.name} • {user.username} • {user.email}
      </p>

      {loading && <Loader message="Loading tenant metadata..." size="small" />}

      {error && <p className="admin-users-error">{error}</p>}

      {!loading && !error && !data && (
        <p className="admin-users-empty">No resource metadata available yet.</p>
      )}

      {!loading && data && (
        <dl className="admin-resource-panel__list">
          <div>
            <dt>Tenant User ID</dt>
            <dd>{data.userId}</dd>
          </div>
          <div>
            <dt>Resource ID</dt>
            <dd>{data.resourceId}</dd>
          </div>
          <div>
            <dt>Database URI</dt>
            <dd>{data.databaseUri}</dd>
          </div>
          <div>
            <dt>Bot Endpoint</dt>
            <dd>{data.botEndpoint}</dd>
          </div>
          <div>
            <dt>Scheduler Endpoint</dt>
            <dd>{data.schedulerEndpoint}</dd>
          </div>
          <div>
            <dt>Scraper Endpoint</dt>
            <dd>{data.scraperEndpoint}</dd>
          </div>
          <div>
            <dt>Vector Store Path</dt>
            <dd>{data.vectorStorePath || '—'}</dd>
          </div>
          <div>
            <dt>Last Updated</dt>
            <dd>{data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—'}</dd>
          </div>
        </dl>
      )}
    </aside>
  );
}

export default UserResourcePanel;
