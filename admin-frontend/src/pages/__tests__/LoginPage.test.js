// src/pages/__tests__/LoginPage.test.js

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import LoginPage from '../LoginPage';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Test wrapper with necessary providers
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('renders login form with all required fields', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    // Check for heading
    expect(screen.getByText(/Admin Portal Login/i)).toBeInTheDocument();

    // Check for email input
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();

    // Check for password input
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    // Check for login button
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();

    // Check for register link
    expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
  });

  test('validates email format and shows error', async () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText(/Email/i);
    const loginButton = screen.getByRole('button', { name: /Login/i });

    // Enter invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(loginButton);

    // Check for validation error
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  test('validates password and shows error', async () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const loginButton = screen.getByRole('button', { name: /Login/i });

    // Enter valid email but short password
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(loginButton);

    // Check for validation error
    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
  });

  test('navigates to register page when clicking register link', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const registerButton = screen.getByRole('button', { name: /Register/i });
    fireEvent.click(registerButton);

    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });
});
