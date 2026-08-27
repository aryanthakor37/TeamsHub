import { acquireGraphToken, syncAllAccountsTokens } from './auth/authService';
import { msalInstance } from './auth/msalConfig';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
  ? `${import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')}/api`
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://teamshub-api.onrender.com/api' : '/api');

/**
 * Build auth headers — instant zero-latency token resolution with background refresh
 */
const getAuthHeaders = async (accountId) => {
  const headers = { 'Content-Type': 'application/json' };
  
  let allAccounts = [];
  try {
    allAccounts = msalInstance.getAllAccounts() || [];
  } catch (e) {}

  // Fast token map from localStorage (0ms!) and silent acquisition
  const tokenMap = {};
  await Promise.all(allAccounts.map(async (a) => {
    const email = (a.username || '').toLowerCase().trim();
    if (email) {
      let t = localStorage.getItem(`teamshub_token_${email}`);
      if (!t) {
        t = await acquireGraphToken(a.homeAccountId || a.username);
        if (t) localStorage.setItem(`teamshub_token_${email}`, t);
      }
      if (t) tokenMap[email] = t;
    }
  }));

  const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();

  // Always attach all active account tokens to allow backend multi-account fallback
  if (Object.keys(tokenMap).length > 0) {
    headers['x-account-tokens'] = JSON.stringify(tokenMap);
  }

  if (allAccounts.length > 0) {
    headers['x-user-emails'] = allAccounts.map(a => (a.username || '').toLowerCase().trim()).filter(Boolean).join(',');
  }

  if (accountId && accountId !== 'all') {
    const cleanAcc = accountId.toString().toLowerCase().trim();
    let token = tokenMap[cleanAcc] || localStorage.getItem(`teamshub_token_${cleanAcc}`);

    if (!token) {
      const matchKey = Object.keys(tokenMap).find(k => k.includes(cleanAcc) || cleanAcc.includes(k) || (cleanAcc.includes('aryan') && k.includes('aryan')) || (cleanAcc.includes('keval') && k.includes('keval')));
      if (matchKey) token = tokenMap[matchKey];
    }

    if (!token) {
      const target = allAccounts.find(a => 
        (a.username && a.username.toLowerCase() === cleanAcc) ||
        (a.homeAccountId && a.homeAccountId.toLowerCase() === cleanAcc) ||
        (a.localAccountId && a.localAccountId.toLowerCase() === cleanAcc) ||
        (a.username && (a.username.toLowerCase().includes(cleanAcc) || cleanAcc.includes(a.username.toLowerCase())))
      );
      if (target?.username) {
        token = tokenMap[target.username.toLowerCase()] || localStorage.getItem(`teamshub_token_${target.username.toLowerCase()}`);
        headers['x-user-email'] = target.username;
      }
    }

    if (!token) {
      token = (activeEmail && tokenMap[activeEmail]) || localStorage.getItem('teamshub_last_access_token');
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (cleanAcc.includes('@') && !headers['x-user-email']) {
      headers['x-user-email'] = cleanAcc;
    }
  } else {
    let token = (activeEmail && tokenMap[activeEmail]) || localStorage.getItem('teamshub_last_access_token');
    if (!token && Object.values(tokenMap).length > 0) {
      token = Object.values(tokenMap)[0];
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (activeEmail) {
      headers['x-user-email'] = activeEmail;
    }

    // Refresh any expiring tokens in background without blocking this request
    syncAllAccountsTokens().catch(() => {});
  }

  if (allAccounts.length > 0) {
    headers['x-user-emails'] = allAccounts.map(a => (a.username || '').toLowerCase()).filter(Boolean).join(',');
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
export const fetchMessagesFromBackend = async (chatId, accountId, page = 1, limit = 50) => {
  try {
    const headers = await getAuthHeaders(accountId);
    const accParam = accountId ? `&connectedAccountId=${encodeURIComponent(accountId)}` : '';
    const response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages?page=${page}&limit=${limit}${accParam}`,
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
 * Send a Conversation Message (with optional attachments, images)
 */
export const sendMessageToBackend = async (chatId, payload, accountId) => {
  try {
    const headers = await getAuthHeaders(accountId);
    
    // Normalise payload if passed as string or object
    const bodyData = typeof payload === 'string' 
      ? { content: payload, connectedAccountId: accountId }
      : { 
          content: payload.content || '', 
          attachments: payload.attachments || [], 
          image: payload.image || null,
          connectedAccountId: accountId 
        };

    const response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData)
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
 * Set a Reaction on a Message
 */
export const setMessageReactionOnBackend = async (chatId, messageId, reactionType, accountId) => {
  try {
    const headers = await getAuthHeaders(accountId);
    const response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ reactionType, connectedAccountId: accountId })
      }
    );

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[TeamsHub Chat API] Set Reaction Error:', error.message);
    return { success: false };
  }
};

/**
 * Unset a Reaction on a Message
 */
export const unsetMessageReactionOnBackend = async (chatId, messageId, reactionType, accountId) => {
  try {
    const headers = await getAuthHeaders(accountId);
    const response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ reactionType, connectedAccountId: accountId })
      }
    );

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[TeamsHub Chat API] Unset Reaction Error:', error.message);
    return { success: false };
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
