import { acquireGraphToken } from './auth/authService';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
  ? `${import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')}/api`
  : '/api';

/**
 * Build auth headers — includes Microsoft access token if available for the specific account
 */
const getAuthHeaders = async (accountId) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = await acquireGraphToken(accountId);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const activeEmail = localStorage.getItem('teamshub_active_email');
  if (activeEmail) {
    headers['x-user-email'] = activeEmail;
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
  return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred.' };
};

/**
 * Fetch Microsoft Graph Chats from Backend API
 */
export const fetchChatsFromBackend = async (accountId = 'all', page = 1, limit = 20) => {
  try {
    const headers = await getAuthHeaders(accountId === 'all' ? null : accountId);
    const response = await fetch(
      `${API_BASE_URL}/chats?connectedAccountId=${accountId}&page=${page}&limit=${limit}`,
      { headers }
    );

    const result = await response.json();

    if (!response.ok) {
      const error = parseApiError(result);
      throw new Error(`[${error.code}] ${error.message}`);
    }

    return result.data;
  } catch (error) {
    console.warn('[TeamsHub Chat API]', error.message);
    throw error;
  }
};

/**
 * Fetch Conversation Message History
 */
export const fetchMessagesFromBackend = async (chatId, accountId, page = 1, limit = 30) => {
  try {
    const headers = await getAuthHeaders(accountId);
    const response = await fetch(
      `${API_BASE_URL}/chats/${chatId}/messages?page=${page}&limit=${limit}`,
      { headers }
    );

    const result = await response.json();

    if (!response.ok) {
      const error = parseApiError(result);
      throw new Error(`[${error.code}] ${error.message}`);
    }

    return result.data;
  } catch (error) {
    console.warn('[TeamsHub Chat API]', error.message);
    throw error;
  }
};

/**
 * Send a Conversation Message
 */
export const sendMessageToBackend = async (chatId, content, accountId) => {
  try {
    const headers = await getAuthHeaders(accountId);
    const response = await fetch(
      `${API_BASE_URL}/chats/${chatId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      const error = parseApiError(result);
      throw new Error(`[${error.code}] ${error.message}`);
    }

    return result.data;
  } catch (error) {
    console.warn('[TeamsHub Chat API] Send Error:', error.message);
    throw error;
  }
};

/**
 * Mark Chat as Read on Backend
 */
export const markChatAsReadOnBackend = async (chatId, accountId = null) => {
  try {
    const headers = await getAuthHeaders(accountId);
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/read`, {
      method: 'POST',
      headers
    });
    return await response.json();
  } catch (error) {
    console.warn('[TeamsHub Chat API] Mark read error:', error.message);
    return { success: false };
  }
};

/**
 * Trigger Graph Chat Sync/Refresh
 */
export const refreshChatsOnBackend = async (accountId = 'all') => {
  try {
    const headers = await getAuthHeaders(accountId === 'all' ? null : accountId);
    const response = await fetch(`${API_BASE_URL}/chats/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ connectedAccountId: accountId })
    });
    return await response.json();
  } catch (error) {
    console.warn('[TeamsHub Chat API] Refresh error:', error.message);
    return { success: false, error: error.message };
  }
};
