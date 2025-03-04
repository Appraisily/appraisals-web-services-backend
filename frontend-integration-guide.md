# Frontend Integration Guide
## Standardized API Communication Protocol

This guide explains how to update your frontend application to work with the new standardized API response format and error handling system.

## Table of Contents

1. [New Response Format](#new-response-format)
2. [API Client Implementation](#api-client-implementation)
3. [Error Handling](#error-handling)
4. [Displaying Errors to Users](#displaying-errors-to-users)
5. [Form Validation Integration](#form-validation-integration)
6. [Migration Guide](#migration-guide)
7. [Testing](#testing)

## New Response Format

All API endpoints now follow a standardized response format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
    // This replaces various response structures previously used
  },
  "error": null
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details when available
    }
  }
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `NOT_FOUND` | 404 | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in a given time |
| `SERVER_ERROR` | 500 | Internal server error |
| `NETWORK_ERROR` | N/A | Network or connectivity issue |

## API Client Implementation

### Using Axios

Here's a complete implementation of an API client using Axios that handles the standardized response format:

```javascript
// api/client.js
import axios from 'axios';

// Create Axios instance with default config
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling the standardized format
apiClient.interceptors.response.use(
  (response) => {
    // Check if the response follows our standard format
    if (response.data && typeof response.data.success === 'boolean') {
      if (response.data.success) {
        // Return just the data for successful requests
        return response.data.data;
      } else {
        // For unsuccessful responses with 2xx status, create and throw an error
        const error = new Error(response.data.error?.message || 'Unknown error');
        error.code = response.data.error?.code || 'UNKNOWN_ERROR';
        error.details = response.data.error?.details || null;
        error.response = response;
        return Promise.reject(error);
      }
    }
    
    // For responses not following our format, return as is
    return response.data;
  },
  (error) => {
    // Handle network errors
    if (!error.response) {
      const networkError = new Error('Unable to connect to the server. Please check your internet connection.');
      networkError.code = 'NETWORK_ERROR';
      networkError.originalError = error;
      return Promise.reject(networkError);
    }
    
    // Handle API errors with error response format
    if (error.response.data && error.response.data.error) {
      const apiError = new Error(error.response.data.error.message);
      apiError.code = error.response.data.error.code;
      apiError.details = error.response.data.error.details;
      apiError.status = error.response.status;
      apiError.response = error.response;
      return Promise.reject(apiError);
    }
    
    // Handle unexpected error formats
    const fallbackError = new Error(error.response?.data?.message || 'An unexpected error occurred');
    fallbackError.code = 'UNKNOWN_ERROR';
    fallbackError.status = error.response?.status;
    fallbackError.response = error.response;
    fallbackError.originalError = error;
    return Promise.reject(fallbackError);
  }
);

// API method wrappers
const api = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),
  
  // Custom methods for specific endpoints
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    
    return apiClient.post('/upload-temp', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  getSession: (sessionId) => apiClient.get(`/session/${sessionId}`),
  
  submitEmail: (data) => apiClient.post('/submit-email', data),
  
  // Add other API methods as needed
};

export default api;
```

### Using Fetch API

If you prefer using the native Fetch API:

```javascript
// api/client.js
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Helper to handle API responses
const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  
  // If response is not ok, throw error
  if (!response.ok) {
    const error = new Error(
      data.error?.message || `API Error: ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.code = data.error?.code || 'API_ERROR';
    error.details = data.error?.details || null;
    throw error;
  }
  
  // Check if the response follows our standard format
  if (typeof data.success === 'boolean') {
    if (data.success) {
      return data.data;
    } else {
      const error = new Error(data.error?.message || 'Unknown error');
      error.code = data.error?.code || 'UNKNOWN_ERROR';
      error.details = data.error?.details || null;
      throw error;
    }
  }
  
  // For responses not following our format, return as is
  return data;
};

// API client
const api = {
  request: async (endpoint, options = {}) => {
    try {
      const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      
      // Default headers
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      // Add auth token if available
      const token = localStorage.getItem('authToken');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      // Build request options
      const requestOptions = {
        method: options.method || 'GET',
        headers,
        ...options,
      };
      
      // Add body for POST, PUT, PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(requestOptions.method) && options.body) {
        requestOptions.body = JSON.stringify(options.body);
      }
      
      const response = await fetch(url, requestOptions);
      return handleResponse(response);
    } catch (error) {
      // Handle network errors
      if (error.message === 'Failed to fetch') {
        const networkError = new Error('Unable to connect to the server. Please check your internet connection.');
        networkError.code = 'NETWORK_ERROR';
        networkError.originalError = error;
        throw networkError;
      }
      throw error;
    }
  },
  
  get: (endpoint, options = {}) => 
    api.request(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint, body, options = {}) => 
    api.request(endpoint, { ...options, method: 'POST', body }),
  
  put: (endpoint, body, options = {}) => 
    api.request(endpoint, { ...options, method: 'PUT', body }),
  
  delete: (endpoint, options = {}) => 
    api.request(endpoint, { ...options, method: 'DELETE' }),
  
  // File upload helper
  uploadFile: async (endpoint, file, fieldName = 'image', options = {}) => {
    try {
      const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      
      const formData = new FormData();
      formData.append(fieldName, file);
      
      // Add any additional form fields
      if (options.additionalData) {
        Object.entries(options.additionalData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }
      
      // Build request options
      const headers = { ...options.headers };
      
      // Add auth token if available
      const token = localStorage.getItem('authToken');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const requestOptions = {
        method: 'POST',
        headers,
        body: formData,
        ...options,
      };
      
      const response = await fetch(url, requestOptions);
      return handleResponse(response);
    } catch (error) {
      // Handle network errors
      if (error.message === 'Failed to fetch') {
        const networkError = new Error('Unable to connect to the server. Please check your internet connection.');
        networkError.code = 'NETWORK_ERROR';
        networkError.originalError = error;
        throw networkError;
      }
      throw error;
    }
  }
};

export default api;
```

## Error Handling

### Global Error Handler

Create a global error handler component/hook to consistently handle errors across your application:

```jsx
// hooks/useErrorHandler.js
import { useCallback } from 'react';
import { useToast } from 'your-toast-library'; // Replace with your UI library
import { useNavigate } from 'react-router-dom';

// Map of friendly error messages
const errorMessages = {
  'VALIDATION_ERROR': 'There was a problem with the information you provided. Please check and try again.',
  'UNAUTHORIZED': 'Please sign in to continue.',
  'NOT_FOUND': 'The requested information could not be found.',
  'SERVER_ERROR': 'Something went wrong on our end. Please try again later.',
  'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
  'RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait a moment and try again.',
};

export function useErrorHandler() {
  const toast = useToast();
  const navigate = useNavigate();
  
  const handleError = useCallback((error) => {
    console.error('API Error:', error);
    
    // Get appropriate message
    const message = errorMessages[error.code] || error.message || 'An unexpected error occurred';
    
    // Show toast notification
    toast({
      title: 'Error',
      description: message,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
    
    // Handle specific error types
    switch (error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        navigate('/login');
        break;
        
      case 'VALIDATION_ERROR':
        // You might want to return validation errors to the component
        // so it can highlight specific form fields
        return error.details;
        
      case 'NOT_FOUND':
        // Could redirect to 404 page
        // navigate('/404');
        break;
        
      // Add other cases as needed
        
      default:
        // Default error handling
        break;
    }
    
    return null;
  }, [toast, navigate]);
  
  return { handleError };
}
```

### Usage in Components

```jsx
// components/LoginForm.jsx
import { useState } from 'react';
import { useErrorHandler } from '../hooks/useErrorHandler';
import api from '../api/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const { handleError } = useErrorHandler();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setValidationErrors({});
    
    try {
      const userData = await api.post('/auth/login', { email, password });
      
      // Handle successful login
      console.log('Login successful:', userData);
      
      // Save token and redirect
      localStorage.setItem('authToken', userData.token);
      window.location.href = '/dashboard';
      
    } catch (error) {
      const validationErrors = handleError(error);
      if (validationErrors) {
        setValidationErrors(validationErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={validationErrors.email ? 'input-error' : ''}
        />
        {validationErrors.email && (
          <div className="error-message">{validationErrors.email}</div>
        )}
      </div>
      
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={validationErrors.password ? 'input-error' : ''}
        />
        {validationErrors.password && (
          <div className="error-message">{validationErrors.password}</div>
        )}
      </div>
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}

export default LoginForm;
```

## Displaying Errors to Users

### Error Toast/Notification Component

```jsx
// components/ErrorToast.jsx
import { useEffect } from 'react';
import './ErrorToast.css'; // Add your own styling

function ErrorToast({ error, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  if (!error) return null;
  
  // Map error codes to icons
  const getIcon = () => {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return '⚠️';
      case 'UNAUTHORIZED':
        return '🔒';
      case 'SERVER_ERROR':
        return '❌';
      case 'NETWORK_ERROR':
        return '📡';
      default:
        return '❓';
    }
  };
  
  return (
    <div className="error-toast">
      <div className="error-toast-icon">{getIcon()}</div>
      <div className="error-toast-content">
        <h4>Error</h4>
        <p>{error.message}</p>
        {error.details && (
          <button 
            className="error-toast-details-button"
            onClick={() => console.log('Error details:', error.details)}
          >
            Show Details
          </button>
        )}
      </div>
      <button className="error-toast-close" onClick={onClose}>×</button>
    </div>
  );
}

export default ErrorToast;
```

### Form Field Error Display

```jsx
// components/FormField.jsx
function FormField({ 
  label, 
  name, 
  type = 'text', 
  value, 
  onChange, 
  error, 
  ...props 
}) {
  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export default FormField;
```

## Form Validation Integration

### Handling Validation Errors

```jsx
// components/SubmissionForm.jsx
import { useState } from 'react';
import { useErrorHandler } from '../hooks/useErrorHandler';
import api from '../api/client';
import FormField from './FormField';

function SubmissionForm() {
  const [formData, setFormData] = useState({
    email: '',
    sessionId: '',
    name: '',
    subscribeToNewsletter: false
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { handleError } = useErrorHandler();
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when field is changed
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const result = await api.submitEmail(formData);
      
      // Handle success
      alert('Email submitted successfully!');
      // Reset form or redirect
      
    } catch (error) {
      // Format validation errors for the form
      if (error.code === 'VALIDATION_ERROR' && error.details) {
        const formattedErrors = {};
        
        // Convert API validation errors to form errors
        error.details.forEach(err => {
          formattedErrors[err.param] = err.msg;
        });
        
        setErrors(formattedErrors);
      } else {
        // Handle other types of errors
        handleError(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <FormField
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        required
      />
      
      <FormField
        label="Session ID"
        name="sessionId"
        value={formData.sessionId}
        onChange={handleChange}
        error={errors.sessionId}
        required
      />
      
      <FormField
        label="Name (Optional)"
        name="name"
        value={formData.name}
        onChange={handleChange}
        error={errors.name}
      />
      
      <div className="form-field checkbox">
        <input
          id="subscribeToNewsletter"
          name="subscribeToNewsletter"
          type="checkbox"
          checked={formData.subscribeToNewsletter}
          onChange={handleChange}
        />
        <label htmlFor="subscribeToNewsletter">
          Subscribe to our newsletter
        </label>
        {errors.subscribeToNewsletter && (
          <div className="field-error">{errors.subscribeToNewsletter}</div>
        )}
      </div>
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

export default SubmissionForm;
```

## Migration Guide

To migrate your existing frontend to work with the new standardized API:

### 1. Update API Client

Replace your existing API calls with the new API client implementation that handles the standardized format:

```javascript
// Before
fetch('/api/session/123')
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showSessionData(data.session);
    } else {
      showError(data.message);
    }
  });

// After
api.getSession('123')
  .then(sessionData => {
    showSessionData(sessionData);
  })
  .catch(error => {
    handleError(error);
  });
```

### 2. Response Handling

Update how you handle API responses in your components:

```jsx
// Before
function UserProfile() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
        } else {
          // Handle error
          console.error(data.message);
        }
      })
      .catch(err => {
        console.error('Network error', err);
      });
  }, []);
  
  return (/* component JSX */);
}

// After
function UserProfile() {
  const [user, setUser] = useState(null);
  const { handleError } = useErrorHandler();
  
  useEffect(() => {
    api.get('/user/profile')
      .then(userData => {
        setUser(userData);
      })
      .catch(error => {
        handleError(error);
      });
  }, [handleError]);
  
  return (/* component JSX */);
}
```

### 3. Form Submissions

Update your form submissions to handle the new validation error format:

```jsx
// Before
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const response = await fetch('/api/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    const data = await response.json();
    if (data.success) {
      // Handle success
    } else {
      // Show general error
      setError(data.message);
    }
  } catch (err) {
    setError('Network error');
  }
};

// After
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const result = await api.post('/submit-form', formData);
    // Handle success
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR' && error.details) {
      // Format and display field-specific errors
      setFieldErrors(formatValidationErrors(error.details));
    } else {
      // Use global error handler
      handleError(error);
    }
  }
};
```

### 4. Update Error Display Components

Make sure your error display components can handle the new error format:

```jsx
// Before
<ErrorMessage message={errorMessage} />

// After
<ErrorToast 
  error={{ 
    code: error.code,
    message: error.message,
    details: error.details,
  }} 
  onClose={() => setError(null)} 
/>
```

## Testing

### Testing API Client

Create tests to verify your API client correctly handles the standardized response format:

```javascript
// api/__tests__/client.test.js
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import api from '../client';

const mock = new MockAdapter(axios);

describe('API Client', () => {
  afterEach(() => {
    mock.reset();
  });
  
  test('handles successful responses correctly', async () => {
    mock.onGet('/user/123').reply(200, {
      success: true,
      data: { id: 123, name: 'Test User' },
      error: null
    });
    
    const result = await api.get('/user/123');
    expect(result).toEqual({ id: 123, name: 'Test User' });
  });
  
  test('handles error responses correctly', async () => {
    mock.onGet('/user/999').reply(404, {
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'User not found',
        details: null
      }
    });
    
    try {
      await api.get('/user/999');
      fail('Expected an error to be thrown');
    } catch (error) {
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    }
  });
  
  test('handles validation errors correctly', async () => {
    mock.onPost('/user/create').reply(400, {
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [
          { param: 'email', msg: 'Invalid email format' }
        ]
      }
    });
    
    try {
      await api.post('/user/create', { email: 'invalid' });
      fail('Expected an error to be thrown');
    } catch (error) {
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual([
        { param: 'email', msg: 'Invalid email format' }
      ]);
    }
  });
  
  test('handles network errors correctly', async () => {
    mock.onGet('/network-error').networkError();
    
    try {
      await api.get('/network-error');
      fail('Expected an error to be thrown');
    } catch (error) {
      expect(error.code).toBe('NETWORK_ERROR');
    }
  });
});
```

### Testing Components with API Interactions

```jsx
// components/__tests__/LoginForm.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginForm from '../LoginForm';
import api from '../../api/client';

// Mock the API client
jest.mock('../../api/client');

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('submits form with correct data', async () => {
    // Mock successful login
    api.post.mockResolvedValueOnce({
      token: 'test-token',
      user: { id: 1, name: 'Test User' }
    });
    
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    
    // Fill out form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    // Check that API was called with correct data
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    // Wait for success
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('authToken', 'test-token');
    });
  });
  
  test('displays validation errors', async () => {
    // Mock validation error
    const error = new Error('Validation failed');
    error.code = 'VALIDATION_ERROR';
    error.details = [
      { param: 'email', msg: 'Invalid email format' }
    ];
    api.post.mockRejectedValueOnce(error);
    
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    
    // Fill out form with invalid data
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'invalid-email' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    // Check that error is displayed
    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });
});
``` 