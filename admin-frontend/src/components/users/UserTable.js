// src/components/users/UserTable.js

import React from 'react';

function UserTable({ users, onEdit, onDelete, onViewResources, onSelect, activeTenantId }) {
  if (!users || users.length === 0) {
    return <p className="admin-users-empty">No users found.</p>;
  }

  const formatDate = (value) => {
    if (!value) {
      return '—';
    }
    try {
      const date = new Date(value);
      return date.toLocaleString();
    } catch (err) {
      return value;
    }
  };

  return (
    <div className="admin-users-table-wrapper">
      <table className="admin-users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const userId = user.id || user._id;
            return (
              <tr key={userId}>
                <td>
                  <div className="admin-users-table__name">
                    <span>{user.name}</span>
                    <small>{userId}</small>
                  </div>
                </td>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <span className={user.isActive ? 'badge badge-success' : 'badge badge-danger'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{formatDate(user.createdAt)}</td>
                <td className="admin-users-table__actions">
                  <button
                    type="button"
                    className={userId === activeTenantId ? 'btn-secondary' : 'btn-ghost'}
                    onClick={() => onSelect?.(user)}
                    disabled={userId === activeTenantId}
                  >
                    {userId === activeTenantId ? 'Active' : 'Set Active'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onViewResources(user)}
                  >
                    Resources
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onEdit(user)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-ghost--danger"
                    onClick={() => onDelete(user)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default UserTable;
