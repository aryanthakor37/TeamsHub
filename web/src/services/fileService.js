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
  const fileMap = new Map();

  const parseAndAdd = (actualItem, sourceName = 'OneDrive') => {
    if (!actualItem || actualItem.folder || actualItem.deleted || actualItem.root) return;
    const name = actualItem.name || actualItem.displayName || 'Untitled File';
    if (!name || name.startsWith('.')) return;

    const cleanNameLower = name.toLowerCase().trim();
    const ext = cleanNameLower.includes('.') ? cleanNameLower.split('.').pop() : '';
    const mime = (actualItem.file?.mimeType || actualItem.contentType || actualItem.mimeType || '').toLowerCase();

    let category = 'Documents';
    if (ext === 'pdf' || cleanNameLower.endsWith('.pdf') || mime === 'application/pdf') {
      category = 'PDF';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tif', 'tiff', 'heic', 'avif'].includes(ext) || mime.startsWith('image/')) {
      category = 'Images';
    } else if (['xls', 'xlsx', 'csv', 'tsv', 'ods', 'xlsm', 'xltx'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
      category = 'Excel';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp'].includes(ext) || mime.startsWith('video/')) {
      category = 'Videos';
    } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
      category = 'ZIP';
    } else if (['doc', 'docx', 'txt', 'pptx', 'ppt', 'rtf', 'odt', 'pages', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'cs', 'sql'].includes(ext) || mime.includes('word') || mime.includes('document') || mime.includes('presentation') || mime.includes('text/')) {
      category = 'Documents';
    }

    const sizeBytes = actualItem.size || 0;
    let sizeStr = sizeBytes > 0 ? `${sizeBytes} B` : '';
    if (sizeBytes > 1024 * 1024) sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    else if (sizeBytes > 1024) sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;

    const date = new Date(actualItem.lastModifiedDateTime || actualItem.createdDateTime || Date.now());
    const dateStr = isNaN(date.getTime()) ? 'Recent' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const key = `${cleanNameLower}_${sizeBytes}_${actualItem.lastModifiedDateTime || ''}`;
    if (!fileMap.has(key)) {
      fileMap.set(key, {
        id: actualItem.id || `file-${Math.random().toString(36).substring(2, 9)}`,
        name: name,
        category: category,
        size: sizeStr || (category === 'Images' ? 'Image' : 'File'),
        account: cleanName,
        accountEmail: cleanEmail,
        accountBadge: cleanName,
        connectedAccountId: cleanEmail,
        sender: actualItem.lastModifiedBy?.user?.displayName || actualItem.createdBy?.user?.displayName || cleanName,
        date: dateStr,
        webUrl: actualItem.webUrl || '#',
        downloadUrl: actualItem['@microsoft.graph.downloadUrl'] || actualItem.downloadUrl || actualItem.webUrl || '#',
        thumbnailUrl: category === 'Images' ? (actualItem['@microsoft.graph.downloadUrl'] || actualItem.webUrl) : null
      });
    }
  };

  try {
    const endpoints = [
      'https://graph.microsoft.com/v1.0/me/drive/recent?$top=100',
      'https://graph.microsoft.com/v1.0/me/drive/root:/Microsoft Teams Chat Files:/children?$top=100',
      'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100',
      'https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$top=100',
      'https://graph.microsoft.com/v1.0/me/drive/root/search(q=\'\')?$top=100'
    ];

    await Promise.all(endpoints.map(async (url) => {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          (data.value || []).forEach(item => parseAndAdd(item.remoteItem || item));
        }
      } catch (e) {}
    }));

    // Scan chats for shared files and attachments
    try {
      const chatsRes = await fetch('https://graph.microsoft.com/v1.0/me/chats?$top=20', { headers: { Authorization: `Bearer ${token}` } });
      if (chatsRes.ok) {
        const chatsData = await chatsRes.json();
        const chatList = chatsData.value || [];
        await Promise.all(chatList.map(async (chat) => {
          try {
            const msgsRes = await fetch(`https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chat.id)}/messages?$top=25`, { headers: { Authorization: `Bearer ${token}` } });
            if (msgsRes.ok) {
              const msgsData = await msgsRes.json();
              (msgsData.value || []).forEach((msg) => {
                const sender = msg.from?.user?.displayName || cleanName;
                (msg.attachments || []).forEach((att) => {
                  if (att.name && att.name !== 'Unknown File') {
                    parseAndAdd({
                      id: att.id,
                      name: att.name,
                      contentType: att.contentType,
                      size: 0,
                      lastModifiedDateTime: msg.createdDateTime,
                      createdBy: { user: { displayName: sender } },
                      webUrl: att.contentUrl || '#',
                      downloadUrl: att.contentUrl || '#'
                    });
                  }
                });
              });
            }
          } catch (e) {}
        }));
      }
    } catch (e) {}
  } catch (e) {}

  return Array.from(fileMap.values());
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
 * Fetch Microsoft Graph Files from Backend API with Fast Direct Fallback & Merge
 */
export const fetchFilesFromBackend = async (accountOrId = 'all') => {
  const accountId = typeof accountOrId === 'object' && accountOrId !== null
    ? (accountOrId._id || accountOrId.accountId || accountOrId.id)
    : (accountOrId || 'all');

  let directFiles = [];
  try {
    const allAccounts = msalInstance.getAllAccounts() || [];
    for (const a of allAccounts) {
      const email = (a.username || '').toLowerCase().trim();
      const token = localStorage.getItem(`teamshub_token_${email}`);
      if (token) {
        const dFiles = await fetchFilesDirectFromGraph(token, email, a.name);
        directFiles.push(...dFiles);
      }
    }
  } catch (e) {}

  try {
    const headers = await getAuthHeaders(accountId === 'all' ? null : accountId);
    const response = await fetch(
      `${API_BASE_URL}/files?connectedAccountId=${encodeURIComponent(accountId)}`,
      { headers }
    );

    if (response.ok) {
      const result = await response.json();
      const backendFiles = Array.isArray(result.data) ? result.data : [];

      const mergedMap = new Map();
      [...backendFiles, ...directFiles].forEach((f) => {
        const cleanName = (f.name || '').toLowerCase().trim();
        const key = `${f.connectedAccountId || f.accountEmail}_${cleanName}_${f.size || ''}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, f);
        }
      });

      const finalMerged = Array.from(mergedMap.values());
      if (finalMerged.length > 0) {
        return finalMerged;
      }
    }
  } catch (error) {
    console.warn('[TeamsHub File API]', error.message);
  }

  if (directFiles.length > 0) {
    return directFiles;
  }

  return [];
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
