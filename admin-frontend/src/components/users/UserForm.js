// src/components/users/UserForm.js

import React, { useEffect, useMemo, useState } from 'react';

const defaultValues = {
  name: '',
  email: '',
  username: '',
  password: ''
};

function UserForm({
  mode = 'create',
  initialValues,
  loading = false,
  onSubmit,
  onCancel,
  resetKey = 0
}) {
  const [values, setValues] = useState(defaultValues);
  const [fieldErrors, setFieldErrors] = useState({});

  const isEditMode = mode === 'edit';

  const mergedInitialValues = useMemo(
    () => ({
      ...defaultValues,
      ...(initialValues || {}),
      password: ''
    }),
    [initialValues, resetKey]
  );

  useEffect(() => {
    setValues({ ...mergedInitialValues });
    setFieldErrors({});
  }, [mergedInitialValues, resetKey]);

  const updateValue = (field, value) => {
    setValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    updateValue(name, type === 'checkbox' ? checked : value);
  };

  const validate = () => {
    const errors = {};

    if (!values.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!values.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (!values.username.trim()) {
      errors.username = 'Username is required';
    } else if (values.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(values.username.trim())) {
      errors.username = 'Username can only include letters, numbers, and underscores';
    }

    if (!isEditMode && !values.password.trim()) {
      errors.password = 'Password is required';
    } else if (values.password && values.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    return errors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = validate();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    onSubmit?.(values);
  };

  return (
    <form className="admin-user-form" onSubmit={handleSubmit}>
      <h3 className="admin-user-form__title">
        {isEditMode ? 'Edit User' : 'Create New User'}
      </h3>

      <label htmlFor="user-name">Name</label>
      <input
        id="user-name"
        name="name"
        type="text"
        value={values.name}
        onChange={handleChange}
        disabled={loading}
        className={fieldErrors.name ? 'input-error' : ''}
      />
      {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}

      <label htmlFor="user-email">Email</label>
      <input
        id="user-email"
        name="email"
        type="email"
        value={values.email}
        onChange={handleChange}
        disabled={loading}
        className={fieldErrors.email ? 'input-error' : ''}
      />
      {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}

      <label htmlFor="user-username">Username</label>
      <input
        id="user-username"
        name="username"
        type="text"
        value={values.username}
        onChange={handleChange}
        disabled={loading}
        className={fieldErrors.username ? 'input-error' : ''}
      />
      {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}

      <label htmlFor="user-password">Password</label>
      <input
        id="user-password"
        name="password"
        type="password"
        placeholder={isEditMode ? 'Leave blank to keep current password' : ''}
        value={values.password}
        onChange={handleChange}
        disabled={loading}
        className={fieldErrors.password ? 'input-error' : ''}
      />
      {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}

      <div className="admin-user-form__actions">
        {isEditMode && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </form>
  );
}

export default UserForm;
