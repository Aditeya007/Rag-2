// src/setupTests.js

// Setup file for React Testing Library
import '@testing-library/jest-dom/extend-expect';

// You can add custom mocks, global setup, or cleanup logic here

// Example: Silence fetch warnings during tests by providing a global fetch
if (!global.fetch) {
  global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
}
