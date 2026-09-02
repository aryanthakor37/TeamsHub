import { acquireGraphToken } from './auth/authService';
import { msalInstance } from './auth/msalConfig';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
  ? `${import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')}/api`
  : (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api');

/**
 * Build auth headers — includes Microsoft access token if available for the specific account
 */
const getAuthHeaders = async (accountId) => {
  const headers = { 'Content-Type': 'application/json' };
  
  let allAccounts = [];
  try {
    allAccounts = msalInstance.getAllAccounts() || [];
  } catch (e) {}

  // Fast token map from localStorage (instant 0ms lookup)
  const tokenMap = {};
  const missingAccounts = [];

  for (const a of allAccounts) {
    const email = (a.username || '').toLowerCase().trim();
    if (email) {
      const t = localStorage.getItem(`teamshub_token_${email}`);
      if (t) {
        tokenMap[email] = t;
      } else {
        missingAccounts.push(a);
      }
    }
  }

  // Acquire missing tokens in parallel without blocking if not needed
  if (missingAccounts.length > 0) {
    await Promise.all(missingAccounts.map(async (a) => {
      const email = (a.username || '').toLowerCase().trim();
      try {
        const t = await acquireGraphToken(a.homeAccountId || a.username);
        if (t) {
          tokenMap[email] = t;
          localStorage.setItem(`teamshub_token_${email}`, t);
        }
      } catch (e) {}
    }));
  }

  const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();

  if (accountId && accountId !== 'all') {
    const cleanAcc = accountId.toString().toLowerCase().trim();
    let token = tokenMap[cleanAcc] || localStorage.getItem(`teamshub_token_${cleanAcc}`) || (activeEmail === cleanAcc ? localStorage.getItem('teamshub_last_access_token') : null);
    if (!token) {
      token = await acquireGraphToken(accountId);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    headers['x-user-email'] = cleanAcc;
  } else {
    if (Object.keys(tokenMap).length > 0) {
      headers['x-account-tokens'] = JSON.stringify(tokenMap);
    }
    const token = Object.values(tokenMap)[0] || localStorage.getItem('teamshub_last_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (activeEmail) {
      headers['x-user-email'] = activeEmail;
    }
  }

  return headers;
};

/**
 * Direct Client-Side Microsoft Graph Files Fetcher
 */
export const fetchFilesDirectFromGraph = async (token, userEmail, userName) => {
  if (!token) return [];
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const cleanName = userName || cleanEmail.split('@')[0];

  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/recent?$top=50', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const rawList = data.value || [];
      return rawList.map(item => {
        const actualItem = item.remoteItem || item;
        const name = actualItem.name || 'Untitled File';
        const cleanNameLower = name.toLowerCase().trim();
        const ext = cleanNameLower.includes('.') ? cleanNameLower.split('.').pop() : '';
        const mime = (actualItem.file?.mimeType || actualItem.contentType || '').toLowerCase();

        let category = 'Documents';
        if (ext === 'pdf' || cleanNameLower.endsWith('.pdf') || mime === 'application/pdf') {
          category = 'PDF';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext) || mime.startsWith('image/')) {
          category = 'Images';
        } else if (['xls', 'xlsx', 'csv', 'tsv', 'ods'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
          category = 'Excel';
        } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || mime.startsWith('video/')) {
          category = 'Videos';
        } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
          category = 'ZIP';
        }

        const sizeBytes = actualItem.size || 0;
        let sizeStr = sizeBytes > 0 ? `${sizeBytes} B` : '';
        if (sizeBytes > 1024 * 1024) sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
        else if (sizeBytes > 1024) sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;

        const date = new Date(actualItem.lastModifiedDateTime || actualItem.createdDateTime || Date.now());
        const dateStr = isNaN(date.getTime()) ? 'Recent' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return {
          id: actualItem.id || `file-${Math.random().toString(36).substring(2, 9)}`,
          name: name,
          category: category,
          size: sizeStr || (category === 'Images' ? 'Image' : 'File'),
          account: cleanName,
          accountEmail: cleanEmail,
          accountBadge: cleanName,
          connectedAccountId: cleanEmail,
          sender: actualItem.lastModifiedBy?.user?.displayName || cleanName,
          date: dateStr,
          webUrl: actualItem.webUrl || '#',
          downloadUrl: actualItem['@microsoft.graph.downloadUrl'] || actualItem.webUrl || '#',
          thumbnailUrl: category === 'Images' ? (actualItem['@microsoft.graph.downloadUrl'] || actualItem.webUrl) : null
        };
      });
    }
  } catch (e) {}
  return [];
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
 * Fetch Microsoft Graph Files from Backend API with Fast Direct Fallback
 */
export const fetchFilesFromBackend = async (accountOrId = 'all') => {
  const accountId = typeof accountOrId === 'object' && accountOrId !== null
    ? (accountOrId._id || accountOrId.accountId || accountOrId.id)
    : (accountOrId || 'all');

  // Fast direct graph check first
  try {
    const allAccounts = msalInstance.getAllAccounts() || [];
    let directFiles = [];
    for (const a of allAccounts) {
      const email = (a.username || '').toLowerCase().trim();
      const token = localStorage.getItem(`teamshub_token_${email}`);
      if (token) {
        const dFiles = await fetchFilesDirectFromGraph(token, email, a.name);
        directFiles.push(...dFiles);
      }
    }
    if (directFiles.length > 0) {
      // Async trigger background backend sync without blocking UI
      (async () => {
        try {
          const headers = await getAuthHeaders(accountId === 'all' ? null : accountId);
          await fetch(`${API_BASE_URL}/files?connectedAccountId=${encodeURIComponent(accountId)}`, { headers });
        } catch (e) {}
      })();
      return directFiles;
    }
  } catch (e) {}

  try {
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
    
    if (isGraphOrApi) {
      let token = null;
      if (accountId && accountId !== 'all') {
        token = await acquireGraphToken(accountId);
      }
      if (!token) {
        token = await acquireGraphToken();
      }
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
    
    if (isGraphOrApi) {
      let token = null;
      if (accountId && accountId !== 'all') {
        token = await acquireGraphToken(accountId);
      }
      if (!token) {
        token = await acquireGraphToken();
      }
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

/**
 * Fetch raw text content securely with Graph Authorization headers (for code, cshtml, txt, html, json)
 */
export const fetchFileText = async (url, accountId) => {
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
    
    if (isGraphOrApi) {
      let token = null;
      if (accountId && accountId !== 'all') {
        token = await acquireGraphToken(accountId);
      }
      if (!token) {
        token = await acquireGraphToken();
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    console.warn('[TeamsHub File Text Fetch Error]:', err.message);
    return null;
  }
};
