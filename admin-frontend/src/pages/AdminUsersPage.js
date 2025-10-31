// src/pages/AdminUsersPage.js

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api';
import Loader from '../components/Loader';
import UserForm from '../components/users/UserForm';
import UserTable from '../components/users/UserTable';
import UserResourcePanel from '../components/users/UserResourcePanel';
import '../styles/index.css';

function AdminUsersPage() {
  const { token, user: currentUser, activeTenant, setActiveTenant } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formMode, setFormMode] = useState('create');
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [resourceState, setResourceState] = useState({ data: null, loading: false, error: '' });
  const [formResetKey, setFormResetKey] = useState(0);
  const activeTenantId = activeTenant ? activeTenant.id || activeTenant._id : null;

  const fetchUsers = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await apiRequest('/users', {
        method: 'GET',
        token
      });
      setUsers(response.users || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setSuccessMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const handleRefresh = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  const resetFormState = () => {
    setFormMode('create');
    setEditingUser(null);
    setFormResetKey((key) => key + 1);
  };

  const handleCreateSubmit = async (values) => {
    setSubmitting(true);
    setErrorMessage('');
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
      setSuccessMessage('User created successfully');
      setFormResetKey((key) => key + 1);
      if (response.user) {
        setActiveTenant(response.user);
      }
      await handleRefresh();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (values) => {
    if (!editingUser) {
      return;
    }

    const payload = {};
    if (values.name.trim() !== editingUser.name) {
      payload.name = values.name.trim();
    }
    if (values.email.trim() !== editingUser.email) {
      payload.email = values.email.trim();
    }
    if (values.username.trim() !== editingUser.username) {
      payload.username = values.username.trim();
    }
    if (values.password) {
      payload.password = values.password;
    }
    if (Object.keys(payload).length === 0) {
      setErrorMessage('No changes detected to update.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await apiRequest(`/users/${editingUser.id || editingUser._id}`, {
        method: 'PUT',
        token,
        data: payload
      });
      setSuccessMessage('User updated successfully');
      if (activeTenantId && (editingUser.id || editingUser._id) === activeTenantId && response.user) {
        setActiveTenant(response.user);
      }
      resetFormState();
      await handleRefresh();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (!userToDelete) {
      return;
    }

    const message = `Delete user \"${userToDelete.username}\"? This cannot be undone.`;
    if (!window.confirm(message)) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      await apiRequest(`/users/${userToDelete.id || userToDelete._id}`, {
        method: 'DELETE',
        token
      });
      setSuccessMessage('User deleted successfully');
      if (selectedUser && (selectedUser.id || selectedUser._id) === (userToDelete.id || userToDelete._id)) {
        setSelectedUser(null);
        setResourceState({ data: null, loading: false, error: '' });
      }
      if (activeTenantId === (userToDelete.id || userToDelete._id)) {
        setActiveTenant(null);
      }
      await handleRefresh();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewResources = async (userRow) => {
    setSelectedUser(userRow);
    setResourceState({ data: null, loading: true, error: '' });
    try {
      const response = await apiRequest(`/users/${userRow.id || userRow._id}/resources`, {
        method: 'GET',
        token
      });
      setResourceState({ data: response.tenant, loading: false, error: '' });
    } catch (err) {
      setResourceState({ data: null, loading: false, error: err.message || 'Failed to load resources' });
    }
  };

  const handleSelectActive = (userRow) => {
    setActiveTenant(userRow);
    setSuccessMessage(`Selected ${userRow.username} as the active user.`);
  };

  const handleFormSubmit = (values) => {
    if (formMode === 'edit') {
      handleEditSubmit(values);
    } else {
      handleCreateSubmit(values);
    }
  };

  if (!token || !currentUser) {
    return <Loader message="Validating session..." />;
  }

  return (
    <div className="admin-users-container">
      <header className="admin-users-header">
        <div>
          <h2>User Management</h2>
          <p>Provision and manage tenant accounts for the RAG platform.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={handleRefresh} disabled={loading}>
          Refresh
        </button>
      </header>

      {errorMessage && <div className="admin-users-error">{errorMessage}</div>}
      {successMessage && <div className="admin-users-success">{successMessage}</div>}

      <div className="admin-users-grid">
        <section className="admin-users-column admin-users-column--form">
          <UserForm
            mode={formMode}
            initialValues={editingUser}
            loading={submitting}
            onSubmit={handleFormSubmit}
            onCancel={resetFormState}
            resetKey={formResetKey}
          />
        </section>

        <section className="admin-users-column admin-users-column--table">
          {loading ? (
            <Loader message="Loading users..." />
          ) : (
            <UserTable
              users={users}
              onEdit={(userRow) => {
                setFormMode('edit');
                setEditingUser(userRow);
              }}
              onDelete={handleDeleteUser}
              onViewResources={handleViewResources}
              onSelect={handleSelectActive}
              activeTenantId={activeTenantId}
            />
          )}
        </section>
      </div>

      <UserResourcePanel
        user={selectedUser}
        resourceState={resourceState}
        onClose={() => {
          setSelectedUser(null);
          setResourceState({ data: null, loading: false, error: '' });
        }}
      />
    </div>
  );
}

export default AdminUsersPage;
