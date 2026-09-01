import { acquireGraphToken, syncAllAccountsTokens, isTokenExpired } from './auth/authService';
import { msalInstance } from './auth/msalConfig';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
  ? `${import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')}/api`
  : (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api');

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
      if (!t || isTokenExpired(t)) {
        t = await acquireGraphToken(a.homeAccountId || a.username);
        if (t) localStorage.setItem(`teamshub_token_${email}`, t);
      }
      if (t && !isTokenExpired(t)) tokenMap[email] = t;
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
  let activeToken = token;

  // Check if initial token is expired before calling
  if (isTokenExpired(activeToken)) {
    const refreshed = await acquireGraphToken(cleanEmail);
    if (refreshed) activeToken = refreshed;
  }

  try {
    let res = await fetch('https://graph.microsoft.com/v1.0/me/chats?$expand=members,lastMessagePreview&$top=50', {
      headers: { Authorization: `Bearer ${activeToken}` }
    });

    if (res.status === 401) {
      localStorage.removeItem(`teamshub_token_${cleanEmail}`);
      const freshToken = await acquireGraphToken(cleanEmail);
      if (freshToken) {
        activeToken = freshToken;
        res = await fetch('https://graph.microsoft.com/v1.0/me/chats?$expand=members,lastMessagePreview&$top=50', {
          headers: { Authorization: `Bearer ${activeToken}` }
        });
      }
    }

    if (res.ok) {
      const data = await res.json();
      rawList = data.value || [];
    }
  } catch (e) {}

  if (rawList.length === 0) {
    try {
      let res = await fetch('https://graph.microsoft.com/v1.0/me/chats?$top=50', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.status === 401) {
        localStorage.removeItem(`teamshub_token_${cleanEmail}`);
        const freshToken = await acquireGraphToken(cleanEmail);
        if (freshToken) {
          activeToken = freshToken;
          res = await fetch('https://graph.microsoft.com/v1.0/me/chats?$top=50', {
            headers: { Authorization: `Bearer ${activeToken}` }
          });
        }
      }
      if (res.ok) {
        const data = await res.json();
        rawList = data.value || [];
      }
    } catch (e) {}
  }

  if (rawList.length === 0) return [];

  return rawList.map(gc => {
    let participantName = '';
    const cleanUser = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;

    let isSelfChat = false;
    if (gc.chatType === 'group' && gc.topic && gc.topic.trim()) {
      participantName = gc.topic.trim();
    } else if (gc.members && gc.members.length > 0) {
      const others = gc.members.filter(m => {
        const mEmail = (m.email || m.userPrincipalName || m.emailAddress?.address || '').toLowerCase().trim();
        const mName = (m.displayName || m.emailAddress?.name || '').toLowerCase().trim();
        const isMe = (mEmail && (mEmail === cleanEmail || mEmail.includes(cleanUser))) ||
                     (mName && (mName === cleanName.toLowerCase() || mName.includes(cleanUser)));
        return !isMe;
      });

      if (others.length > 0) {
        participantName = others.map(m =>
          m.displayName ||
          m.emailAddress?.name ||
          m.email ||
          m.userPrincipalName ||
          m.emailAddress?.address?.split('@')[0] ||
          'External User'
        ).filter(Boolean).join(', ');
      } else {
        isSelfChat = true;
        participantName = `${gc.members[0]?.displayName || cleanName} (You)`;
      }
    }

    // If participant is still not resolved, check lastMessagePreview sender
    if (!participantName || participantName === 'Direct Message') {
      const fromName = gc.lastMessagePreview?.from?.user?.displayName;
      const fromEmail = (gc.lastMessagePreview?.from?.user?.email || gc.lastMessagePreview?.from?.user?.userPrincipalName || '').toLowerCase().trim();
      if (fromName && fromEmail !== cleanEmail && !fromName.toLowerCase().includes(cleanUser)) {
        participantName = fromName;
      }
    }

    if (!participantName) {
      participantName = gc.chatType === 'oneOnOne' ? 'Direct Message' : 'Group Chat';
    }

    // Dynamically detect real external client guest organizations from member domains
    let detectedCompany = cleanName;
    if (gc.members && gc.members.length > 0) {
      const homeDomain = cleanEmail.includes('@') ? cleanEmail.split('@')[1] : '';
      const externalMember = gc.members.find(m => {
        const mEmail = (m.email || m.userPrincipalName || m.emailAddress?.address || '').toLowerCase().trim();
        if (mEmail && mEmail.includes('@')) {
          const domain = mEmail.split('@')[1];
          return domain && domain !== homeDomain && !domain.includes('onmicrosoft.com');
        }
        return false;
      });

      if (externalMember) {
        const mEmail = (externalMember.email || externalMember.userPrincipalName || externalMember.emailAddress?.address || '').toLowerCase().trim();
        const domain = mEmail.split('@')[1] || '';
        if (domain.includes('gmail') || domain.includes('outlook') || domain.includes('hotmail')) {
          detectedCompany = 'External';
        } else {
          const base = domain.split('.')[0];
          if (base.length >= 2) {
            detectedCompany = base.charAt(0).toUpperCase() + base.slice(1);
          }
        }
      }
    }

    const lastMsgFromUser = gc.lastMessagePreview?.from?.user;
    const lastMsgFromName = (lastMsgFromUser?.displayName || '').trim();
    const lastMsgFromEmail = (lastMsgFromUser?.email || lastMsgFromUser?.userPrincipalName || '').toLowerCase().trim();

    const isOneOnOneOther = gc.chatType === 'oneOnOne' && participantName && lastMsgFromName &&
      (participantName.toLowerCase().trim() === lastMsgFromName.toLowerCase().trim() || lastMsgFromName.toLowerCase().includes(participantName.toLowerCase().trim()) || participantName.toLowerCase().trim().includes(lastMsgFromName.toLowerCase().trim()));

    let isLastMessageOutgoing = false;
    if (gc.chatType === 'oneOnOne' && lastMsgFromName && participantName && !isSelfChat) {
      if (!isOneOnOneOther) {
        isLastMessageOutgoing = true;
      }
    }

    if (!isLastMessageOutgoing) {
      isLastMessageOutgoing = !!(
        (cleanEmail && lastMsgFromEmail && (cleanEmail === lastMsgFromEmail || cleanEmail.startsWith(lastMsgFromEmail) || lastMsgFromEmail.startsWith(cleanEmail))) ||
        (cleanUser && lastMsgFromEmail && lastMsgFromEmail.includes(cleanUser)) ||
        (cleanName && lastMsgFromName && (cleanName.toLowerCase() === lastMsgFromName.toLowerCase() || lastMsgFromName.toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(lastMsgFromName.toLowerCase())))
      );
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
      lastMessageSender: lastMsgFromName,
      lastMessageSenderEmail: lastMsgFromEmail,
      role: gc.chatType === 'oneOnOne' ? 'Direct Message' : 'Group Chat',
      company: detectedCompany,
      accountBadge: detectedCompany,
      chatType: gc.chatType || 'oneOnOne',
      isSelfChat: !!isSelfChat,
      isLastMessageOutgoing,
      isOutgoing: isLastMessageOutgoing,
      lastMessagePreview: lastMsgContent,
      lastMessageTimestamp: gc.lastMessagePreview?.createdDateTime || gc.lastUpdatedDateTime || new Date().toISOString(),
      unreadCount: (isLastMessageOutgoing || isSelfChat) ? 0 : (gc.viewpoint?.lastMessageReadDateTime ? (new Date(gc.lastMessagePreview?.createdDateTime || 0).getTime() > new Date(gc.viewpoint.lastMessageReadDateTime).getTime() + 1000 ? 1 : 0) : 0),
      onlineStatus: 'online'
    };
  });
};

/**
 * Direct Client-Side Microsoft Graph API Message Fetcher (Resilient Fallback)
 */
export const fetchMessagesDirectFromGraph = async (token, chatId, userEmail) => {
  if (!chatId) return [];
  const cleanUserEmail = (userEmail || '').toLowerCase().trim();
  let activeToken = token;

  if (!activeToken || isTokenExpired(activeToken)) {
    const refreshed = await acquireGraphToken(cleanUserEmail);
    if (refreshed) activeToken = refreshed;
  }
  if (!activeToken) return [];

  try {
    let res = await fetch(`https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages?$top=50`, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });

    if (res.status === 401) {
      localStorage.removeItem(`teamshub_token_${cleanUserEmail}`);
      const freshToken = await acquireGraphToken(cleanUserEmail);
      if (freshToken) {
        activeToken = freshToken;
        res = await fetch(`https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages?$top=50`, {
          headers: { Authorization: `Bearer ${activeToken}` }
        });
      }
    }

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
  if (!chatId) return { chatId, items: [], messages: [], total: 0 };

  const cleanAcc = (accountId || '').toLowerCase().trim();

  // 1. Fast Direct Microsoft Graph call if token is available locally (100ms ultra fast!)
  try {
    let localToken = cleanAcc ? localStorage.getItem(`teamshub_token_${cleanAcc}`) : null;
    if (!localToken) {
      const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();
      if (activeEmail) localToken = localStorage.getItem(`teamshub_token_${activeEmail}`);
    }
    if (localToken && !isTokenExpired(localToken)) {
      const directMsgs = await fetchMessagesDirectFromGraph(localToken, chatId, cleanAcc);
      if (directMsgs && directMsgs.length > 0) {
        return {
          chatId,
          items: directMsgs,
          messages: directMsgs,
          page: 1,
          limit: directMsgs.length,
          total: directMsgs.length,
          hasMore: false
        };
      }
    }
  } catch (e) {}

  // 2. Backend API Pass-Through with multi-account auth headers
  try {
    const headers = await getAuthHeaders(accountId);
    const accParam = accountId ? `&connectedAccountId=${encodeURIComponent(accountId)}` : '';
    const response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages?page=${page}&limit=${limit}${accParam}`,
      { headers }
    );

    const result = await response.json();
    const responseItems = result.data?.items || result.data?.messages || [];
    if (response.ok && Array.isArray(responseItems) && responseItems.length > 0) {
      return {
        chatId: chatId,
        items: responseItems,
        messages: responseItems,
        page: 1,
        limit: 50,
        total: responseItems.length,
        hasMore: false
      };
    }

    // 3. Direct Graph fallback with silent token refresh
    const allAccounts = msalInstance.getAllAccounts() || [];
    const target = allAccounts.find(a => (a.username && a.username.toLowerCase() === cleanAcc)) || allAccounts[0];
    if (target) {
      let token = localStorage.getItem(`teamshub_token_${target.username.toLowerCase()}`);
      if (!token) token = await acquireGraphToken(target.homeAccountId || target.username);
      if (token) {
        const directMsgs = await fetchMessagesDirectFromGraph(token, chatId, target.username);
        if (directMsgs.length > 0) {
          return {
            chatId: chatId,
            items: directMsgs,
            messages: directMsgs,
            page: 1,
            limit: 50,
            total: directMsgs.length,
            hasMore: false
          };
        }
      }
    }

    return { chatId: chatId, items: [], messages: [], total: 0, hasMore: false };
  } catch (error) {
    console.warn('[TeamsHub Chat Messages Error]:', error.message);
    return { chatId: chatId, items: [], messages: [], total: 0, hasMore: false };
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
 * Edit a Message on Backend & Microsoft Graph
 */
export const editMessageOnBackend = async (chatId, messageId, content, accountId) => {
  try {
    const headers = await getAuthHeaders(accountId);
    const response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ content, connectedAccountId: accountId })
      }
    );
    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[TeamsHub Chat API] Edit Message Error:', error.message);
    return { success: false };
  }
};

/**
 * Delete a Message on Backend & Microsoft Graph
 */
export const deleteMessageOnBackend = async (chatId, messageId, accountId) => {
  try {
    const headers = await getAuthHeaders(accountId);
    let response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/delete?connectedAccountId=${encodeURIComponent(accountId || '')}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ connectedAccountId: accountId })
      }
    );
    if (!response.ok) {
      response = await fetch(
        `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}?connectedAccountId=${encodeURIComponent(accountId || '')}`,
        {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ connectedAccountId: accountId })
        }
      );
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[TeamsHub Chat API] Delete Message Error:', error.message);
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

/**
 * Fetch Today's Calendar Meetings (In-Memory Direct Graph Query - Zero DB Storage)
 */
export const fetchTodayCalendarMeetings = async (accountId = null) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    let allAccounts = [];
    try {
      allAccounts = msalInstance.getAllAccounts() || [];
    } catch (e) {}

    // Find token for active account
    let token = null;
    if (accountId && accountId !== 'all') {
      const cleanAcc = accountId.toString().toLowerCase().trim();
      token = localStorage.getItem(`teamshub_token_${cleanAcc}`);
    }
    if (!token) {
      const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();
      if (activeEmail) {
        token = localStorage.getItem(`teamshub_token_${activeEmail}`);
      }
    }
    if (!token) {
      token = localStorage.getItem('teamshub_last_access_token');
    }

    if (token) {
      try {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startOfDay)}&endDateTime=${encodeURIComponent(endOfDay)}&$orderby=start/dateTime&$top=10`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.value)) {
            return data.value.map(evt => {
              const startDt = evt.start?.dateTime ? new Date(evt.start.dateTime + 'Z') : null;
              const endDt = evt.end?.dateTime ? new Date(evt.end.dateTime + 'Z') : null;
              return {
                id: evt.id,
                subject: evt.subject || 'Teams Meeting',
                startTimeStr: startDt ? startDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
                endTimeStr: endDt ? endDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                startRaw: startDt,
                organizer: evt.organizer?.emailAddress?.name || 'Organizer',
                joinUrl: evt.onlineMeeting?.joinUrl || evt.webLink || null,
                isOnline: !!evt.isOnlineMeeting || !!evt.onlineMeeting?.joinUrl
              };
            });
          }
        }
      } catch (err) {
        console.warn('[Calendar Direct Fetch Error]:', err.message);
      }
    }
    return [];
  } catch (error) {
    console.warn('[fetchTodayCalendarMeetings] Error:', error.message);
    return [];
  }
};

