import { acquireGraphToken } from './auth/authService';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
  ? `${import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')}/api`
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://teamshub-api.onrender.com/api' : '/api');

/**
 * Build auth headers — includes Microsoft access token if available for the specific account
 */
const getAuthHeaders = async (accountId) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = await acquireGraphToken(accountId);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Parse API error response into a structured error object
 */
const parseApiError = (responseData) => {
  if (responseData?.error) {
    return {
      code: responseData.error.code || 'UNKNOWN_ERROR',
      message: responseData.error.message || 'An error occurred.',
      retryAfter: responseData.error.retryAfter
    };
  }
  return { code: 'UNKNOWN_ERROR', message: responseData?.message || 'An unexpected error occurred.' };
};

/**
 * Fetch Microsoft Graph Files from Backend API
 */
export const fetchFilesFromBackend = async (accountOrId = 'all') => {
  try {
    const accountId = typeof accountOrId === 'object' && accountOrId !== null
      ? (accountOrId._id || accountOrId.accountId || accountOrId.id)
      : (accountOrId || 'all');

    const headers = await getAuthHeaders(accountId === 'all' ? null : accountId);
    const response = await fetch(
      `${API_BASE_URL}/files?connectedAccountId=${encodeURIComponent(accountId)}`,
      { headers }
    );

    const result = await response.json();

    if (!response.ok) {
      const error = parseApiError(result);
      throw new Error(`[${error.code}] ${error.message}`);
    }

    return result.data;
  } catch (error) {
    console.warn('[TeamsHub File API]', error.message);
    throw error;
  }
};

/**
 * Fetch a file / image / PDF blob securely with Graph Authorization headers
 */
export const fetchFileBlob = async (url, accountId) => {
  if (!url || url === '#') return null;

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  // Prepend backend base URL if relative path starting with /api
  let fullUrl = url;
  if (fullUrl.startsWith('/api') || fullUrl.startsWith('api/')) {
    const backendBase = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
      ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')
      : '';
    fullUrl = `${backendBase}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
  }

  try {
    const isGraphOrApi = fullUrl.includes('graph.microsoft.com') || fullUrl.includes('/api/') || fullUrl.includes('onrender.com');
    const headers = {};
    
    if (isGraphOrApi && accountId) {
      const token = await acquireGraphToken(accountId);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[TeamsHub File Blob Fetch Error]:', err.message);
    return null;
  }
};

/**
 * Fetch raw binary ArrayBuffer securely with Graph Authorization headers (for Excel, Word parsing)
 */
export const fetchFileArrayBuffer = async (url, accountId) => {
  if (!url || url === '#') return null;

  let fullUrl = url;
  if (fullUrl.startsWith('/api') || fullUrl.startsWith('api/')) {
    const backendBase = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
      ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')
      : '';
    fullUrl = `${backendBase}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
  }

  try {
    const isGraphOrApi = fullUrl.includes('graph.microsoft.com') || fullUrl.includes('/api/') || fullUrl.includes('onrender.com');
    const headers = {};
    
    if (isGraphOrApi && accountId) {
      const token = await acquireGraphToken(accountId);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn('[TeamsHub File ArrayBuffer Fetch Error]:', err.message);
    return null;
  }
};
