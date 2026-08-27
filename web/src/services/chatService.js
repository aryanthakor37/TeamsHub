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
      const matchUser = cleanAcc.split('@')[0];
      const matchKey = Object.keys(tokenMap).find(k => {
        const kUser = k.split('@')[0];
        return k.includes(cleanAcc) || cleanAcc.includes(k) || (matchUser && (k.includes(matchUser) || matchUser.includes(kUser)));
      });
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
 * Direct Client-Side Microsoft Graph API Chat Fetcher (Resilient Fallback)
 */
export const fetchChatsDirectFromGraph = async (token, accountEmail, accountDisplayName) => {
  if (!token) return [];
  const cleanEmail = (accountEmail || '').toLowerCase().trim();
  const cleanName = accountDisplayName || cleanEmail.split('@')[0];

  let rawList = [];
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/chats?$expand=members,lastMessagePreview&$top=50', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      rawList = data.value || [];
    }
  } catch (e) {}

  if (rawList.length === 0) {
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/chats?$top=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        rawList = data.value || [];
      }
    } catch (e) {}
  }

  if (rawList.length === 0) return [];

  return rawList.map(gc => {
    let participantName = '';
    if (gc.chatType === 'group' && gc.topic) {
      participantName = gc.topic;
    } else if (gc.members && gc.members.length > 0) {
      const others = gc.members.filter(m => (m.email || m.userPrincipalName || '').toLowerCase().trim() !== cleanEmail);
      if (others.length > 0) {
        participantName = others.map(m => m.displayName || m.email?.split('@')[0]).join(', ');
      } else {
        participantName = `${gc.members[0]?.displayName || 'You'} (You)`;
      }
    }
    if (!participantName) {
      participantName = gc.chatType === 'oneOnOne' ? 'Direct Message' : 'Group Chat';
    }

    const lastMsgContent = gc.lastMessagePreview?.body?.content
      ? gc.lastMessagePreview.body.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
      : '';

    return {
      _id: gc.id,
      microsoftChatId: gc.id,
      connectedAccountId: cleanEmail,
      accountEmail: cleanEmail,
      participant: participantName,
      role: gc.chatType === 'oneOnOne' ? 'Direct Message' : 'Group Chat',
      company: cleanName,
      accountBadge: cleanName,
      chatType: gc.chatType || 'oneOnOne',
      lastMessagePreview: lastMsgContent,
      lastMessageTimestamp: gc.lastMessagePreview?.createdDateTime || gc.lastUpdatedDateTime || new Date().toISOString(),
      unreadCount: 0,
      onlineStatus: 'online'
    };
  });
};

/**
 * Direct Client-Side Microsoft Graph API Message Fetcher (Resilient Fallback)
 */
export const fetchMessagesDirectFromGraph = async (token, chatId, userEmail) => {
  if (!token || !chatId) return [];
  const cleanUserEmail = (userEmail || '').toLowerCase().trim();
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages?$top=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const rawMsgs = data.value || [];
      return rawMsgs.map(m => {
        const senderEmail = (m.from?.user?.email || m.from?.user?.userPrincipalName || '').toLowerCase().trim();
        const senderName = m.from?.user?.displayName || senderEmail || 'Unknown';
        const isFromMe = !!(cleanUserEmail && senderEmail && (senderEmail === cleanUserEmail || senderEmail.includes(cleanUserEmail.split('@')[0])));

        return {
          _id: m.id,
          microsoftMessageId: m.id,
          chatId: chatId,
          senderName: senderName,
          senderEmail: senderEmail,
          isFromMe: isFromMe,
          content: m.body?.content || '',
          contentType: m.body?.contentType || 'text',
          timestamp: m.createdDateTime || new Date().toISOString(),
          createdDateTime: m.createdDateTime || new Date().toISOString(),
          attachments: m.attachments || [],
          reactions: m.reactions || [],
          status: 'delivered'
        };
      });
    }
  } catch (e) {}
  return [];
};

/**
 * Fetch Microsoft Graph Chats from Backend API with Instant Direct Graph Fallback
 */
export const fetchChatsFromBackend = async (accountId = 'all', page = 1, limit = 20) => {
  try {
    const headers = await getAuthHeaders(accountId === 'all' ? null : accountId);
    const response = await fetch(
      `${API_BASE_URL}/chats?connectedAccountId=${accountId}&page=${page}&limit=${limit}`,
      { headers }
    );

    const result = await response.json();

    if (response.ok && result.data && Array.isArray(result.data.items) && result.data.items.length > 0) {
      return result.data;
    }

    // Direct Microsoft Graph fallback if backend returned empty array
    let directChats = [];
    const allAccounts = msalInstance.getAllAccounts() || [];
    for (const acc of allAccounts) {
      const email = (acc.username || '').toLowerCase().trim();
      let token = localStorage.getItem(`teamshub_token_${email}`);
      if (!token) token = await acquireGraphToken(acc.homeAccountId || acc.username);
      if (token) {
        const accountChats = await fetchChatsDirectFromGraph(token, email, acc.name || email.split('@')[0]);
        directChats.push(...accountChats);
      }
    }

    if (directChats.length > 0) {
      return {
        items: directChats,
        page: 1,
        limit: 50,
        total: directChats.length,
        hasMore: false
      };
    }

    return result.data || { items: [] };
  } catch (error) {
    console.warn('[TeamsHub Chat API] Trying direct fallback:', error.message);
    let directChats = [];
    const allAccounts = msalInstance.getAllAccounts() || [];
    for (const acc of allAccounts) {
      const email = (acc.username || '').toLowerCase().trim();
      let token = localStorage.getItem(`teamshub_token_${email}`);
      if (!token) token = await acquireGraphToken(acc.homeAccountId || acc.username);
      if (token) {
        const accountChats = await fetchChatsDirectFromGraph(token, email, acc.name || email.split('@')[0]);
        directChats.push(...accountChats);
      }
    }
    if (directChats.length > 0) {
      return { items: directChats, page: 1, limit: 50, total: directChats.length, hasMore: false };
    }
    throw error;
  }
};

/**
 * Fetch Conversation Message History with Direct Graph Fallback
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

    if (response.ok && result.data && Array.isArray(result.data.messages) && result.data.messages.length > 0) {
      return result.data;
    }

    // Direct Graph fallback
    const allAccounts = msalInstance.getAllAccounts() || [];
    const target = allAccounts.find(a => (a.username && a.username.toLowerCase() === accountId?.toLowerCase())) || allAccounts[0];
    if (target) {
      let token = localStorage.getItem(`teamshub_token_${target.username.toLowerCase()}`);
      if (!token) token = await acquireGraphToken(target.homeAccountId || target.username);
      if (token) {
        const directMsgs = await fetchMessagesDirectFromGraph(token, chatId, target.username);
        if (directMsgs.length > 0) {
          return {
            chatId: chatId,
            messages: directMsgs,
            page: 1,
            limit: 50,
            total: directMsgs.length,
            hasMore: false
          };
        }
      }
    }

    return result.data || { messages: [] };
  } catch (error) {
    console.warn('[TeamsHub Chat API] Direct messages fallback:', error.message);
    const allAccounts = msalInstance.getAllAccounts() || [];
    const target = allAccounts[0];
    if (target) {
      let token = localStorage.getItem(`teamshub_token_${target.username?.toLowerCase()}`);
      if (!token) token = await acquireGraphToken(target.homeAccountId || target.username);
      if (token) {
        const directMsgs = await fetchMessagesDirectFromGraph(token, chatId, target.username);
        if (directMsgs.length > 0) {
          return { chatId: chatId, messages: directMsgs, page: 1, limit: 50, total: directMsgs.length, hasMore: false };
        }
      }
    }
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
