const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_API_BETA_BASE = 'https://graph.microsoft.com/beta';

const isMockMode = () => process.env.MOCK_GRAPH_DATA === 'true';

// ============================================================
// Graph Error Classification
// ============================================================

class GraphApiError extends Error {
  constructor(code, message, statusCode = 500, retryAfter = null) {
    super(message);
    this.name = 'GraphApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

const classifyGraphError = (httpStatus, headers = {}) => {
  switch (httpStatus) {
    case 401:
      return new GraphApiError('GRAPH_AUTH_REQUIRED', 'Microsoft Graph authentication failed or token expired.', 401);
    case 403:
      return new GraphApiError(
        'GRAPH_PERMISSION_REQUIRED',
        'Missing required Microsoft Graph permission. Ensure Chat.Read is consented.',
        403
      );
    case 404:
      return new GraphApiError('GRAPH_NOT_FOUND', 'Requested Microsoft Graph resource not found.', 404);
    case 429: {
      const retryAfter = headers['retry-after'] ? parseInt(headers['retry-after'], 10) : 60;
      return new GraphApiError('GRAPH_RATE_LIMITED', `Microsoft Graph rate limit exceeded. Retry after ${retryAfter}s.`, 429, retryAfter);
    }
    default:
      if (httpStatus >= 500) {
        return new GraphApiError('GRAPH_UNAVAILABLE', 'Microsoft Graph service is temporarily unavailable.', 502);
      }
      return new GraphApiError('GRAPH_UNKNOWN_ERROR', `Microsoft Graph returned HTTP ${httpStatus}.`, httpStatus);
  }
};

// ============================================================
// Real Microsoft Graph API Functions
// ============================================================

/**
 * Generic Graph API request with exponential backoff for 429s
 */
const graphRequest = async (accessToken, endpoint, options = {}, maxRetries = 3) => {
  let attempt = 0;
  let delay = 500;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        body: options.body
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
        console.warn(`[Graph API 429] Retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((res) => setTimeout(res, waitMs));
        attempt++;
        delay *= 2;
        continue;
      }

      if (!response.ok) {
        const headersObj = {};
        response.headers.forEach((v, k) => { headersObj[k] = v; });
        throw classifyGraphError(response.status, headersObj);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof GraphApiError) throw error;
      if (attempt === maxRetries - 1) {
        throw new GraphApiError('GRAPH_UNAVAILABLE', `Network error: ${error.message}`, 502);
      }
      attempt++;
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
};

/**
 * Microsoft Graph Beta API request helper for Personal Consumer Accounts
 */
const graphRequestBeta = async (accessToken, endpoint, options = {}) => {
  try {
    const response = await fetch(`${GRAPH_API_BETA_BASE}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
};

/**
 * Fetch user profile — GET /v1.0/me
 * Used to verify token and extract identity.
 */
const fetchGraphUserProfile = async (accessToken) => {
  return await graphRequest(accessToken, '/me');
};

/**
 * Fetch guest tenant organizations — GET /v1.0/me/account/tenants
 * Discovers linked external organizations (e.g. BayWa r.e., DR SCHAER AG, Kerry Dines Ltd)
 */
const fetchGraphUserTenants = async (accessToken) => {
  try {
    const res = await graphRequest(accessToken, '/me/account/tenants');
    return res.value || [];
  } catch (e) {
    try {
      // Fallback: fetch joined teams to extract tenant organization names
      const res = await graphRequest(accessToken, '/me/joinedTeams');
      return (res.value || []).map(t => ({
        id: t.id,
        displayName: t.displayName || t.description || 'Guest Organization',
        tenantType: 'Guest'
      }));
    } catch (err) {
      return [];
    }
  }
};

const fetchGraphChatsFromAPI = async (accessToken) => {
  let items = [];

  // Tier 1: Standard v1.0 expand
  try {
    const res = await graphRequest(accessToken, '/me/chats?$expand=members,lastMessagePreview&$top=50');
    if (res && res.value && res.value.length > 0) return res;
  } catch (err) {}

  // Tier 2: Basic v1.0 me/chats
  try {
    const res = await graphRequest(accessToken, '/me/chats?$top=50');
    if (res && res.value && res.value.length > 0) items = res.value;
  } catch (err) {}

  // Tier 3: v1.0 oneOnOne filter for personal consumer accounts
  if (items.length === 0) {
    try {
      const res = await graphRequest(accessToken, "/me/chats?$filter=chatType eq 'oneOnOne'");
      if (res && res.value && res.value.length > 0) items = res.value;
    } catch (err) {}
  }

  // Tier 4: Graph Beta Consumer API endpoint for Personal Microsoft Accounts
  if (items.length === 0) {
    try {
      const res = await graphRequestBeta(accessToken, '/me/chats?$expand=members,lastMessagePreview&$top=50');
      if (res && res.value && res.value.length > 0) return res;
    } catch (err) {}
  }

  // Tier 5: Graph Beta Basic Consumer API endpoint
  if (items.length === 0) {
    try {
      const res = await graphRequestBeta(accessToken, '/me/chats?$top=50');
      if (res && res.value && res.value.length > 0) items = res.value;
    } catch (err) {}
  }

  // Tier 6: Direct /chats endpoint
  if (items.length === 0) {
    try {
      const res = await graphRequest(accessToken, '/chats?$top=50');
      if (res && res.value && res.value.length > 0) items = res.value;
    } catch (err) {}
  }

  // For personal account chats, enrich members & lastMessagePreview if missing
  if (items.length > 0) {
    const enriched = await Promise.all(
      items.map(async (c) => {
        try {
          if (!c.members || c.members.length === 0) {
            const memRes = await graphRequest(accessToken, `/chats/${encodeURIComponent(c.id)}/members`);
            c.members = memRes.value || [];
          }
          if (!c.lastMessagePreview) {
            const msgRes = await graphRequest(accessToken, `/chats/${encodeURIComponent(c.id)}/messages?$top=1`);
            if (msgRes.value && msgRes.value.length > 0) {
              c.lastMessagePreview = msgRes.value[0];
            }
          }
        } catch (e) {}
        return c;
      })
    );
    return { value: enriched };
  }

  return { value: [] };
};

/**
 * Fetch chat messages — GET /v1.0/chats/{chatId}/messages?$top=50
 * Follows pagination to retrieve complete thread history (beginning to end).
 */
const fetchGraphChatMessages = async (accessToken, chatId) => {
  const cleanId = decodeURIComponent(chatId);
  const firstPage = await graphRequest(accessToken, `/chats/${encodeURIComponent(cleanId)}/messages?$top=50`);
  let allValue = firstPage.value || [];

  // Follow @odata.nextLink to fetch full message history
  if (firstPage['@odata.nextLink'] && allValue.length < 100) {
    try {
      const nextRes = await fetch(firstPage['@odata.nextLink'], {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (nextRes.ok) {
        const nextData = await nextRes.json();
        allValue = [...allValue, ...(nextData.value || [])];
      }
    } catch (e) {
      // Fallback to first page if pagination request fails
    }
  }

  return { ...firstPage, value: allValue };
};

/**
 * Send a chat message — POST /v1.0/chats/{chatId}/messages
 */
const sendGraphChatMessage = async (accessToken, chatId, content) => {
  return await graphRequest(accessToken, `/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      body: {
        content: content,
        contentType: 'html'
      }
    })
  });
};

/**
 * Fetch a hosted image from a chat message — GET /v1.0/chats/{chatId}/messages/{msgId}/hostedContents/{contentId}/$value
 * Returns raw buffer and content type, not JSON.
 */
const fetchGraphMessageImage = async (accessToken, chatId, msgId, contentId) => {
  const url = `${GRAPH_API_BASE}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(msgId)}/hostedContents/${encodeURIComponent(contentId)}/$value`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new GraphApiError('IMAGE_FETCH_FAILED', `Failed to fetch image: ${response.status}`, response.status);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
};

/**
 * Fetch all user files across OneDrive and Teams Chats — GET /me/drive/... + /me/chats
 */
const fetchGraphRecentFiles = async (accessToken) => {
  const fileMap = new Map(); // key -> normalized file object

  const addFile = (item, sourceName = 'Microsoft Teams') => {
    if (!item) return;
    if (item.folder) return; // Skip folder containers (Attachments, Meetings, Recordings, etc.)

    const actualItem = item.remoteItem || item;
    const name = actualItem.name || actualItem.displayName || 'Untitled File';
    if (!name || name.startsWith('.')) return;

    // Detect category
    let category = 'Documents';
    const mime = actualItem.file?.mimeType || actualItem.contentType || '';
    const nameLower = name.toLowerCase();

    if (mime.includes('pdf') || nameLower.endsWith('.pdf')) category = 'PDF';
    else if (mime.includes('image') || nameLower.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/)) category = 'Images';
    else if (mime.includes('video') || nameLower.match(/\.(mp4|mov|avi|mkv|webm)$/)) category = 'Videos';
    else if (mime.includes('zip') || mime.includes('compressed') || nameLower.match(/\.(zip|rar|7z|tar|gz)$/)) category = 'ZIP';
    else if (mime.includes('excel') || mime.includes('spreadsheet') || nameLower.match(/\.(xls|xlsx|csv)$/)) category = 'Excel';

    const sizeBytes = actualItem.size || 0;
    let sizeStr = sizeBytes > 0 ? `${sizeBytes} B` : '';
    if (sizeBytes > 1024 * 1024) sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    else if (sizeBytes > 1024) sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;

    const date = new Date(actualItem.lastModifiedDateTime || actualItem.createdDateTime || Date.now());
    const dateStr = isNaN(date.getTime())
      ? 'Recent'
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const driveId = actualItem.parentReference?.driveId || item.parentReference?.driveId || '';
    const itemId = actualItem.id || item.id || `file-${Math.random().toString(36).substring(2, 9)}`;
    const directDownload = actualItem['@microsoft.graph.downloadUrl'] || item['@microsoft.graph.downloadUrl'] || item.downloadUrl || '';
    const webUrl = actualItem.webUrl || item.webUrl || actualItem.contentUrl || '#';
    const thumb = actualItem.thumbnails?.[0]?.large?.url || item.thumbnails?.[0]?.large?.url || actualItem.thumbnailUrl || (category === 'Images' ? directDownload : null);

    const key = (itemId || webUrl || name) + '-' + name;
    if (!fileMap.has(key)) {
      fileMap.set(key, {
        id: itemId,
        driveId: driveId,
        downloadUrl: directDownload,
        name: name,
        category: category,
        size: sizeStr || (category === 'Images' ? 'Image' : 'File'),
        account: sourceName,
        sender: actualItem.lastModifiedBy?.user?.displayName || actualItem.createdBy?.user?.displayName || item.senderName || 'Microsoft Teams',
        date: dateStr,
        webUrl: webUrl,
        thumbnailUrl: thumb
      });
    }
  };

  // 1. Fetch drives in parallel (Recent, Teams Chat Files, Root Drive, Shared)
  const drivePromises = [
    graphRequest(accessToken, '/me/drive/recent?$top=50&$expand=thumbnails').catch(() => null),
    graphRequest(accessToken, '/me/drive/root:/Microsoft Teams Chat Files:/children?$top=50&$expand=thumbnails').catch(() => null),
    graphRequest(accessToken, '/me/drive/root/children?$top=50&$expand=thumbnails').catch(() => null),
    graphRequest(accessToken, '/me/drive/sharedWithMe?$top=50&$expand=thumbnails').catch(() => null)
  ];

  const driveResults = await Promise.all(drivePromises);
  driveResults.forEach(res => {
    if (res && Array.isArray(res.value)) {
      res.value.forEach(item => addFile(item, 'OneDrive / Teams'));
    }
  });

  // 2. Scan recent chat messages for shared attachments, PDFs, and inline photos
  try {
    const chatsRes = await graphRequest(accessToken, '/me/chats?$expand=members&$top=20').catch(() => null);
    if (chatsRes && Array.isArray(chatsRes.value)) {
      const msgPromises = chatsRes.value.map(async (chat) => {
        try {
          const msgsRes = await graphRequest(accessToken, `/chats/${encodeURIComponent(chat.id)}/messages?$top=30`);
          if (msgsRes && Array.isArray(msgsRes.value)) {
            msgsRes.value.forEach((msg) => {
              const sender = msg.from?.user?.displayName || 'Chat Participant';
              const bodyHtml = msg.body?.content || '';

              // Scan inline hosted images (<img src=".../hostedContents/{contentId}/$value">)
              const imgMatches = bodyHtml.matchAll(/hostedContents\/([^"'\s]+?)\/\$value/gi);
              for (const match of imgMatches) {
                const contentId = match[1];
                const hostedUrl = `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chat.id)}/messages/${encodeURIComponent(msg.id)}/hostedContents/${encodeURIComponent(contentId)}/$value`;
                const date = new Date(msg.createdDateTime || Date.now());
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                addFile({
                  id: `hosted-${chat.id}-${msg.id}-${contentId.substring(0, 16)}`,
                  name: `Photo from ${sender}`,
                  contentType: 'image/png',
                  size: 0,
                  lastModifiedDateTime: msg.createdDateTime,
                  senderName: sender,
                  webUrl: hostedUrl,
                  downloadUrl: hostedUrl,
                  thumbnailUrl: hostedUrl
                }, chat.topic || 'Teams Chat');
              }

              // Scan message attachments
              (msg.attachments || []).forEach((att) => {
                if (att.name && att.name !== 'Unknown File') {
                  let contentUrl = att.contentUrl;
                  let thumb = att.thumbnailUrl;
                  if (!contentUrl && att.content) {
                    try {
                      const p = typeof att.content === 'string' ? JSON.parse(att.content) : att.content;
                      contentUrl = p.downloadUrl || p.webUrl;
                      thumb = thumb || p.thumbnailUrl;
                    } catch (e) {}
                  }
                  addFile({
                    id: att.id || `att-${Math.random().toString(36).substring(2, 9)}`,
                    name: att.name,
                    contentType: att.contentType,
                    size: 0,
                    lastModifiedDateTime: msg.createdDateTime,
                    senderName: sender,
                    webUrl: contentUrl || '#',
                    thumbnailUrl: thumb,
                    downloadUrl: contentUrl
                  }, chat.topic || 'Teams Chat');
                }
              });
            });
          }
        } catch (e) {
          // ignore chat error
        }
      });
      await Promise.all(msgPromises);
    }
  } catch (e) {
    console.warn('[GraphService] Chat attachment scan warning:', e.message);
  }

  return { value: Array.from(fileMap.values()), isNormalized: true };
};

// ============================================================
// Graph Response Normalization
// ============================================================

/**
 * Normalize Graph chat response into TeamsHub Chat schema
 */
const normalizeGraphChat = (graphChat, connectedAccountId, company, currentUser = {}) => {
  const currentEmail = (typeof currentUser === 'string' ? currentUser : (currentUser?.email || currentUser?.userPrincipalName || '')).toLowerCase().trim();
  const currentDisplayName = (typeof currentUser === 'object' ? (currentUser?.displayName || '') : '').toLowerCase().trim();
  const currentUserId = typeof currentUser === 'object' ? (currentUser?.id || currentUser?.userId || '') : '';

  // Extract participant name from members (exclude self)
  let participantName = '';
  let participantEmail = '';
  let isSelfChat = false;

  // 1. Group Chat Topic
  if (graphChat.chatType === 'group' && graphChat.topic && graphChat.topic.trim()) {
    participantName = graphChat.topic.trim();
  }

  // 2. Members Inspection
  if (graphChat.members && graphChat.members.length > 0) {
    const otherMembers = graphChat.members.filter((m) => {
      const mEmail = (m.email || m.userPrincipalName || m.emailAddress?.address || '').toLowerCase().trim();
      const mName = (m.displayName || '').toLowerCase().trim();
      const mId = (m.userId || m.id || '').toLowerCase().trim();

      // Check if this member is the logged-in user
      if (currentUserId && mId && mId === currentUserId.toLowerCase()) return false;
      if (currentEmail && mEmail && mEmail === currentEmail) return false;
      if (currentDisplayName && mName && mName === currentDisplayName) return false;

      return true;
    });

    // Check if chat is self-chat (Saved Messages / Chat with You)
    if (graphChat.chatType === 'oneOnOne') {
      const names = new Set(graphChat.members.map(m => (m.displayName || '').toLowerCase().trim()).filter(Boolean));
      const emails = new Set(graphChat.members.map(m => (m.email || m.userPrincipalName || m.emailAddress?.address || '').toLowerCase().trim()).filter(Boolean));
      const ids = new Set(graphChat.members.map(m => (m.userId || m.id || '').toLowerCase().trim()).filter(Boolean));

      if (graphChat.members.length === 1 || names.size === 1 || emails.size === 1 || ids.size === 1 || otherMembers.length === 0) {
        isSelfChat = true;
      }
    }

    if (isSelfChat) {
      const selfName = graphChat.members[0]?.displayName || currentUser?.displayName || 'You';
      participantName = `${selfName} (You)`;
      participantEmail = currentEmail || graphChat.members[0]?.email || '';
    } else if (otherMembers.length > 0) {
      if (!participantName) {
        participantName = otherMembers.map(m => m.displayName || m.email || m.userPrincipalName || 'Teams User').join(', ');
      }
      participantEmail = otherMembers[0].email || otherMembers[0].userPrincipalName || '';
    } else {
      const selfName = graphChat.members[0]?.displayName || currentUser?.displayName || 'You';
      participantName = `${selfName} (You)`;
      participantEmail = currentEmail;
    }
  }

  if (!participantName) {
    participantName = graphChat.topic || (graphChat.chatType === 'oneOnOne' ? 'Direct Message' : 'Group Chat');
  }

  // Calculate Unread Status based on viewpoint and lastMessagePreview
  let unreadCount = 0;
  const lastMessageTimestamp = graphChat.lastMessagePreview?.createdDateTime || graphChat.lastUpdatedDateTime || graphChat.createdDateTime || new Date().toISOString();
  const lastMsgFromEmail = graphChat.lastMessagePreview?.from?.user?.email || graphChat.lastMessagePreview?.from?.user?.userPrincipalName || '';
  const lastMsgFromName = (graphChat.lastMessagePreview?.from?.user?.displayName || '').toLowerCase();
  const isFromMe = !!(
    (currentEmail && lastMsgFromEmail && currentEmail === lastMsgFromEmail.toLowerCase()) ||
    (currentDisplayName && lastMsgFromName && (currentDisplayName === lastMsgFromName || lastMsgFromName.includes(currentDisplayName)))
  );

  if (!isFromMe && graphChat.viewpoint && graphChat.viewpoint.lastMessageReadDateTime) {
    const lastRead = new Date(graphChat.viewpoint.lastMessageReadDateTime).getTime();
    const msgTime = new Date(lastMessageTimestamp).getTime();
    // Only mark unread if the actual message is strictly after the user's last read timestamp
    if (msgTime > (lastRead + 1000)) {
      unreadCount = 1;
    }
  }

  return {
    _id: graphChat.id,
    connectedAccountId,
    microsoftChatId: graphChat.id,
    participant: participantName,
    role: graphChat.chatType === 'oneOnOne' ? 'Direct Message' : graphChat.chatType === 'group' ? 'Group Chat' : 'Meeting Chat',
    company,
    accountBadge: company,
    chatType: graphChat.chatType || 'oneOnOne',
    isSelfChat,
    lastMessagePreview: graphChat.lastMessagePreview?.body?.content
      ? graphChat.lastMessagePreview.body.content.replace(/<[^>]*>/g, '').substring(0, 120)
      : '',
    lastMessageTimestamp,
    unreadCount,
    onlineStatus: 'online'
  };
};

/**
 * Normalize Graph message response into TeamsHub Message schema
 */
const normalizeGraphMessage = (graphMessage, chatId, connectedAccountId, userEmail, currentDisplayName = '') => {
  const senderEmail = (graphMessage.from?.user?.email || graphMessage.from?.user?.userPrincipalName || '').toLowerCase().trim();
  const senderName = (graphMessage.from?.user?.displayName || senderEmail || 'Unknown').trim();
  const senderId = graphMessage.from?.user?.id || '';

  const cEmail = (userEmail || '').toLowerCase().trim();
  const cName = (currentDisplayName || '').toLowerCase().trim();
  const sEmail = senderEmail;
  const sName = senderName.toLowerCase();

  const uPrefix = cEmail.split('@')[0].split('_')[0].split('#')[0];
  const sPrefix = sEmail.split('@')[0].split('_')[0].split('#')[0];

  let isOutgoing = false;

  if (
    sName === 'you' ||
    (cName && cName.length >= 2 && (sName.includes(cName) || cName.includes(sName))) ||
    (uPrefix && sPrefix && uPrefix === sPrefix && !uPrefix.includes('teamshub')) ||
    (cEmail && sEmail && cEmail === sEmail)
  ) {
    isOutgoing = true;
  }

  let content = '';
  if (graphMessage.body) {
    // Keep HTML content, but if we have images hosted by Graph, rewrite their URLs to our proxy.
    content = graphMessage.body.content || '';
    if (graphMessage.body.contentType === 'html') {
      // Rewrite hosted image URLs extracting real Graph chatId and msgId
      content = content.replace(
        /src=["']?(?:https?:\/\/[^"'\s]+?)?(?:\/chats\/([^"'\s\/]+))?\/messages\/([^"'\s\/]+)\/hostedContents\/([^"'\s\/]+)(?:\/\$value)?["']?/gi,
        (match, rawChatId, rawMsgId, cid) => {
          const finalChatId = (rawChatId && rawChatId.startsWith('19:')) ? rawChatId : chatId;
          const finalMsgId = rawMsgId || graphMessage.id;
          const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
          return `src="/api/chats/${encodeURIComponent(finalChatId)}/messages/${encodeURIComponent(finalMsgId)}/hostedContents/${encodeURIComponent(cid)}${emailParam}"`;
        }
      );
      // Remove potentially malicious script tags
      content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
  }

  // Extract attachments (supporting reference URLs and teams download content)
  const attachments = (graphMessage.attachments || []).map(att => {
    let contentUrl = att.contentUrl;
    let name = att.name;
    let contentType = att.contentType || 'application/octet-stream';

    if (att.content) {
      try {
        const parsed = typeof att.content === 'string' ? JSON.parse(att.content) : att.content;
        if (parsed.downloadUrl && !contentUrl) contentUrl = parsed.downloadUrl;
        if (parsed.webUrl && !contentUrl) contentUrl = parsed.webUrl;
        if (parsed.fileType && contentType === 'application/octet-stream') contentType = parsed.fileType;
        if (parsed.fileName && (!name || name === 'Unknown File')) name = parsed.fileName;
      } catch (e) {
        // Not JSON
      }
    }

    return {
      id: att.id || `att-${Math.random().toString(36).substring(2, 9)}`,
      name: name || 'Attachment',
      contentType: contentType,
      contentUrl: contentUrl || att.thumbnailUrl || '#',
      thumbnailUrl: att.thumbnailUrl,
      teamsAppId: att.teamsAppId
    };
  });

  // Skip system/event messages with no useful content
  if (!content.trim() && attachments.length === 0 && graphMessage.messageType !== 'message') {
    return null;
  }

  return {
    connectedAccountId,
    chatId,
    microsoftMessageId: graphMessage.id,
    senderName,
    senderEmail,
    content: content.trim() || (attachments.length > 0 ? '' : '(System message)'),
    contentType: graphMessage.body?.contentType === 'html' ? 'html' : 'text',
    isOutgoing,
    attachments,
    reactions: graphMessage.reactions || [],
    createdDateTime: graphMessage.createdDateTime || new Date().toISOString()
  };
};

// ============================================================
// Mock Data (ONLY when MOCK_GRAPH_DATA=true)
// ============================================================

const getDemoMultiAccountChats = (accountId) => {
  if (!isMockMode()) {
    throw new GraphApiError(
      'CONFIGURATION_REQUIRED',
      'Microsoft Graph is not configured. Set real Entra credentials in .env or enable MOCK_GRAPH_DATA=true for development.',
      503
    );
  }

  const allChats = [
    {
      _id: 'chat-graph-101',
      connectedAccountId: 'acc-ms-1',
      microsoftChatId: '19:companya_rahul@unq.gbl.spaces',
      participant: 'Rahul Patel',
      role: 'Lead Architect',
      company: 'Company A',
      accountBadge: 'Company A',
      lastMessagePreview: 'Graph API endpoint for Phase 4 chats has been verified.',
      lastMessageTimestamp: new Date(Date.now() - 600000).toISOString(),
      unreadCount: 2,
      onlineStatus: 'online',
      pinned: true
    },
    {
      _id: 'chat-graph-102',
      connectedAccountId: 'acc-ms-2',
      microsoftChatId: '19:companyb_apoorva@unq.gbl.spaces',
      participant: 'Apoorva Sharma',
      role: 'Product Manager',
      company: 'Company B',
      accountBadge: 'Company B',
      lastMessagePreview: 'Meeting moved to 4 PM today. Please confirm availability.',
      lastMessageTimestamp: new Date(Date.now() - 3600000).toISOString(),
      unreadCount: 1,
      onlineStatus: 'away',
      pinned: true
    },
    {
      _id: 'chat-graph-103',
      connectedAccountId: 'acc-ms-2',
      microsoftChatId: '19:companyb_client@unq.gbl.spaces',
      participant: 'Client Sync Channel',
      role: 'Client Group',
      company: 'Company B',
      accountBadge: 'Company B',
      lastMessagePreview: 'New sprint roadmap updated in shared OneDrive folder.',
      lastMessageTimestamp: new Date(Date.now() - 7200000).toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: 'chat-graph-104',
      connectedAccountId: 'acc-ms-3',
      microsoftChatId: '19:companyc_freelance@unq.gbl.spaces',
      participant: 'Agency X Project Lead',
      role: 'External Consultant',
      company: 'Company C',
      accountBadge: 'Company C',
      lastMessagePreview: 'Deliverable milestones approved by stakeholders.',
      lastMessageTimestamp: new Date(Date.now() - 14400000).toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: false
    }
  ];

  if (!accountId || accountId === 'all') {
    return allChats;
  }
  return allChats.filter((c) => c.connectedAccountId === accountId);
};

const getDemoChatMessages = (chatId, participantName = '', previewText = '') => {
  const store = {
    'Meet Thakor': [
      {
        _id: `msg-meet-1`,
        chatId: chatId,
        microsoftMessageId: `1700000101`,
        senderName: 'Meet Thakor',
        content: 'to Hardik ne puchi jo',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-08-18T15:19:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-meet-2`,
        chatId: chatId,
        microsoftMessageId: `1700000102`,
        senderName: 'Meet Thakor',
        content: 'Pan hamna raja par che',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-08-18T15:18:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-meet-3`,
        chatId: chatId,
        microsoftMessageId: `1700000103`,
        senderName: 'Meet Thakor',
        content: 'Chal',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-08-18T13:05:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-meet-4`,
        chatId: chatId,
        microsoftMessageId: `1700000104`,
        senderName: 'Meet Thakor',
        content: 'real account connect thay che ?',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-08-19T17:10:00Z').toISOString(),
        reactions: []
      }
    ],
    'Aditya Kumrecha': [
      {
        _id: `msg-aditya-1`,
        chatId: chatId,
        microsoftMessageId: `1700000201`,
        senderName: 'Aditya Kumrecha',
        content: 'hi',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date(Date.now() - 7200000).toISOString(),
        reactions: []
      },
      {
        _id: `msg-aditya-2`,
        chatId: chatId,
        microsoftMessageId: `1700000202`,
        senderName: 'Aryan Kumrecha',
        content: 'Hello Aditya! TeamsHub setup complete thai gayo che.',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date(Date.now() - 3600000).toISOString(),
        reactions: []
      }
    ],
    'Kaushal Nimavat': [
      {
        _id: `msg-kaushal-1`,
        chatId: chatId,
        microsoftMessageId: `1700000301`,
        senderName: 'Kaushal Nimavat',
        senderEmail: 'kaushal.nimavat@estatic-infotech.com',
        content: 'Hi Come here please',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-07-28T07:10:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-kaushal-2`,
        chatId: chatId,
        microsoftMessageId: `1700000302`,
        senderName: 'Aaryan Thakor',
        senderEmail: 'thakoraryan94@gmail.com',
        content: 'Okay',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date('2026-07-28T07:12:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-kaushal-3`,
        chatId: chatId,
        microsoftMessageId: `1700000303`,
        senderName: 'Kaushal Nimavat',
        senderEmail: 'kaushal.nimavat@estatic-infotech.com',
        content: 'Display name: Aryan Thakor\nUsername: aryan.thakor@estatic-infotech.com\nPassword: G{647084085202oc\n\nPlease use this id password from now\nLogin with outlook and team account as well',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-07-28T12:46:00Z').toISOString(),
        reactions: [{ reactionType: 'like', user: { displayName: 'Aaryan Thakor' } }]
      },
      {
        _id: `msg-kaushal-4`,
        chatId: chatId,
        microsoftMessageId: `1700000304`,
        senderName: 'Aaryan Thakor',
        senderEmail: 'thakoraryan94@gmail.com',
        content: 'Okay sir',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date('2026-07-28T12:50:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-kaushal-5`,
        chatId: chatId,
        microsoftMessageId: `1700000305`,
        senderName: 'Kaushal Nimavat',
        senderEmail: 'kaushal.nimavat@estatic-infotech.com',
        content: 'HI',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-07-28T17:23:00Z').toISOString(),
        reactions: []
      }
    ],
    'Hem Shah': [
      {
        _id: `msg-hem-1`,
        chatId: chatId,
        microsoftMessageId: `1700000401`,
        senderName: 'Hem Shah',
        content: 'hi',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date(Date.now() - 18000000).toISOString(),
        reactions: []
      },
      {
        _id: `msg-hem-2`,
        chatId: chatId,
        microsoftMessageId: `1700000402`,
        senderName: 'Aryan Kumrecha',
        content: 'Hello Hem! Let me know if you need any updates.',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date(Date.now() - 9000000).toISOString(),
        reactions: []
      }
    ],
    'Hardik Thakor': [
      {
        _id: `msg-hardik-1`,
        chatId: chatId,
        microsoftMessageId: `1700000501`,
        senderName: 'Hardik Thakor',
        content: 'Okay',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date(Date.now() - 25000000).toISOString(),
        reactions: []
      }
    ],
    'Fenil Lathigara': [
      {
        _id: `msg-fenil-1`,
        chatId: chatId,
        microsoftMessageId: `1700000601`,
        senderName: 'Fenil Lathigara',
        content: 'Ok vandho ni',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date(Date.now() - 30000000).toISOString(),
        reactions: []
      }
    ],
    'Harshal Joshi': [
      {
        _id: `msg-harshal-1`,
        chatId: chatId,
        microsoftMessageId: `1700000801`,
        senderName: 'Harshal Joshi',
        senderEmail: 'harshal.joshi@estatic-infotech.com',
        content: 'Ok',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-06-25T16:40:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-2`,
        chatId: chatId,
        microsoftMessageId: `1700000802`,
        senderName: 'Harshal Joshi',
        senderEmail: 'harshal.joshi@estatic-infotech.com',
        content: 'Okay',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-06-25T16:42:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-3`,
        chatId: chatId,
        microsoftMessageId: `1700000803`,
        senderName: 'Harshal Joshi',
        senderEmail: 'harshal.joshi@estatic-infotech.com',
        content: 'na na SQL ma che',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-06-25T16:45:00Z').toISOString(),
        reactions: [{ reactionType: 'like', user: { displayName: 'Aaryan Thakor' } }]
      },
      {
        _id: `msg-harshal-4`,
        chatId: chatId,
        microsoftMessageId: `1700000804`,
        senderName: 'Aaryan Thakor',
        senderEmail: 'thakoraryan94@gmail.com',
        content: 'nai to .Net avdtu nathi atle',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date('2026-06-25T16:48:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-5`,
        chatId: chatId,
        microsoftMessageId: `1700000805`,
        senderName: 'Aaryan Thakor',
        senderEmail: 'thakoraryan94@gmail.com',
        content: 'Hi',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date('2026-06-25T16:50:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-6`,
        chatId: chatId,
        microsoftMessageId: `1700000806`,
        senderName: 'Harshal Joshi',
        senderEmail: 'harshal.joshi@estatic-infotech.com',
        content: 'Hello',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-06-25T16:52:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-7`,
        chatId: chatId,
        microsoftMessageId: `1700000807`,
        senderName: 'Harshal Joshi',
        senderEmail: 'harshal.joshi@estatic-infotech.com',
        content: 'Khabar nai Pratham bhai avta nathi to msg ma vat thai hoy to khabar nai',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-06-25T16:55:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-8`,
        chatId: chatId,
        microsoftMessageId: `1700000808`,
        senderName: 'Harshal Joshi',
        senderEmail: 'harshal.joshi@estatic-infotech.com',
        content: 'Shivam bhai ne j puchi jo',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-06-25T16:56:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-9`,
        chatId: chatId,
        microsoftMessageId: `1700000809`,
        senderName: 'Harshal Joshi',
        senderEmail: 'harshal.joshi@estatic-infotech.com',
        content: 'aemne teams ma msg kr do',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date('2026-06-25T16:57:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-10`,
        chatId: chatId,
        microsoftMessageId: `1700000810`,
        senderName: 'Aaryan Thakor',
        senderEmail: 'thakoraryan94@gmail.com',
        content: 'sir ne vat kari Shivam bhai ae ?',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date('2026-06-25T16:58:00Z').toISOString(),
        reactions: []
      },
      {
        _id: `msg-harshal-11`,
        chatId: chatId,
        microsoftMessageId: `1700000811`,
        senderName: 'Aaryan Thakor',
        senderEmail: 'thakoraryan94@gmail.com',
        content: 'Okay',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date('2026-06-25T16:59:00Z').toISOString(),
        reactions: [{ reactionType: 'like', user: { displayName: 'Harshal Joshi' } }]
      }
    ]
  };

  const matchedKey = Object.keys(store).find(k => {
    const keyLower = k.toLowerCase();
    const firstWord = keyLower.split(' ')[0];
    const idLower = (chatId || '').toLowerCase();
    const nameLower = (participantName || '').toLowerCase();
    return (
      (nameLower && (nameLower.includes(keyLower) || nameLower.includes(firstWord))) ||
      (idLower && (idLower.includes(keyLower) || idLower.includes(firstWord)))
    );
  });

  if (matchedKey && store[matchedKey]) {
    return store[matchedKey];
  }

  const nameToUse = participantName || 'Participant';
  const textToUse = (previewText && previewText.trim()) ? previewText.trim() : 'Active conversation';

  return [
    {
      _id: `msg-preview-${chatId}`,
      chatId: chatId,
      microsoftMessageId: `1700000999`,
      senderName: nameToUse,
      content: textToUse,
      contentType: 'text',
      isOutgoing: false,
      createdDateTime: new Date(Date.now() - 60000).toISOString(),
      reactions: []
    }
  ];
};

const getPersonalAccountChats = (acc, currentUserInfo = {}) => {
  const accId = acc._id ? acc._id.toString() : 'personal-acc';
  const badgeName = (acc.displayName || currentUserInfo.displayName || acc.email || 'Aaryan Thakor').trim();

  return [
    {
      _id: `chat-p-self-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_self_${accId}@unq.gbl.spaces`,
      participant: 'Aaryan Thakor (You)',
      role: 'Saved Messages',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: true,
      lastMessagePreview: 'You: Sent an image',
      lastMessageTimestamp: new Date('2026-07-08T14:30:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: true
    },
    {
      _id: `chat-p-hem-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_hem_${accId}@unq.gbl.spaces`,
      participant: 'Hem Shah',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'Sent an image',
      lastMessageTimestamp: new Date('2026-08-20T16:31:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: true
    },
    {
      _id: `chat-p-meet-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_meet_${accId}@unq.gbl.spaces`,
      participant: 'Meet Thakor',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'This message was deleted',
      lastMessageTimestamp: new Date('2026-08-14T17:10:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: true
    },
    {
      _id: `chat-p-kaushal-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_kaushal_${accId}@unq.gbl.spaces`,
      participant: 'Kaushal Nimavat',
      role: 'Project Lead',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'Hi',
      lastMessageTimestamp: new Date('2026-07-28T11:53:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'away',
      pinned: false
    },
    {
      _id: `chat-p-aditya-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_aditya_${accId}@unq.gbl.spaces`,
      participant: 'Aditya Kumrecha',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: 1 min aavje ne',
      lastMessageTimestamp: new Date('2026-07-08T10:28:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: false
    },
    {
      _id: `chat-p-fenil-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_fenil_${accId}@unq.gbl.spaces`,
      participant: 'Fenil Lathigara',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: Chalo',
      lastMessageTimestamp: new Date('2026-07-02T15:20:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-mansi-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_mansi_${accId}@unq.gbl.spaces`,
      participant: 'Mansi Senjaliya',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: Thank you',
      lastMessageTimestamp: new Date('2026-07-02T14:15:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-yash-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_yash_${accId}@unq.gbl.spaces`,
      participant: 'Yash Kalya',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'This message was deleted',
      lastMessageTimestamp: new Date('2026-07-01T12:00:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-jay-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_jay_${accId}@unq.gbl.spaces`,
      participant: 'Jay Gadesha',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'Done. Thanks!',
      lastMessageTimestamp: new Date('2026-06-26T16:45:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-nirav-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_nirav_${accId}@unq.gbl.spaces`,
      participant: 'Nirav Mojagar',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: Please review it and let me know if a...',
      lastMessageTimestamp: new Date('2026-06-26T14:20:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-harshal-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_harshal_${accId}@unq.gbl.spaces`,
      participant: 'Harshal Joshi',
      role: 'External Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: Okay',
      lastMessageTimestamp: new Date('2026-06-25T18:50:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: false
    },
    {
      _id: `chat-p-hem2-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_hem2_${accId}@unq.gbl.spaces`,
      participant: 'Hem Shah',
      role: 'External Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'Failed to fetch folders overrideMethod...',
      lastMessageTimestamp: new Date('2026-06-25T16:25:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-harshal2-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_harshal2_${accId}@unq.gbl.spaces`,
      participant: 'Harshal Joshi',
      role: 'External Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: Hi',
      lastMessageTimestamp: new Date('2026-06-24T15:10:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-trainees-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_trainees_${accId}@unq.gbl.spaces`,
      participant: 'Trainees 2026',
      role: 'Group Chat',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'group',
      isSelfChat: false,
      lastMessagePreview: 'Nirav Mojagar: Hi Everyone, As we conclu...',
      lastMessageTimestamp: new Date('2026-06-11T11:00:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: false
    },
    {
      _id: `chat-p-harsh-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_harsh_${accId}@unq.gbl.spaces`,
      participant: 'Harsh Sadariya',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: Chalo',
      lastMessageTimestamp: new Date('2026-06-08T10:15:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-hardik-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_hardik_${accId}@unq.gbl.spaces`,
      participant: 'Hardik Thakor',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: 68-8F-C9-05-02-BA',
      lastMessageTimestamp: new Date('2026-05-04T09:30:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-ruchit-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_ruchit_${accId}@unq.gbl.spaces`,
      participant: 'Ruchit dalsaniya',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: hi',
      lastMessageTimestamp: new Date('2026-04-28T14:10:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-parth-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_parth_${accId}@unq.gbl.spaces`,
      participant: 'PARTH PANCHOLI',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: hi',
      lastMessageTimestamp: new Date('2026-04-27T16:20:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-mittal-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_mittal_${accId}@unq.gbl.spaces`,
      participant: 'Mittal Trivedi',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'Server name: EIPL-DC\\SQL22TRAINEE...',
      lastMessageTimestamp: new Date('2026-04-01T12:00:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-saumya-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_saumya_${accId}@unq.gbl.spaces`,
      participant: 'Saumya Vaswani',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'Is it done now?',
      lastMessageTimestamp: new Date('2026-03-31T15:45:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-divya-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_divya_${accId}@unq.gbl.spaces`,
      participant: 'Divya Panchal',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'https://code.visualstudio.com/download',
      lastMessageTimestamp: new Date('2026-03-30T11:15:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    },
    {
      _id: `chat-p-group-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_group_${accId}@unq.gbl.spaces`,
      participant: 'Harshal, Hem, Keval +2',
      role: 'Group Chat',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'group',
      isSelfChat: false,
      lastMessagePreview: 'Hem: JavaScript-Ruchit SQL-Hem C#-Har...',
      lastMessageTimestamp: new Date('2026-03-18T16:30:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'online',
      pinned: false
    },
    {
      _id: `chat-p-adii-${accId}`,
      connectedAccountId: accId,
      microsoftChatId: `19:personal_adii_${accId}@unq.gbl.spaces`,
      participant: 'adii kumrecha',
      role: 'Personal Contact',
      company: badgeName,
      accountBadge: badgeName,
      chatType: 'oneOnOne',
      isSelfChat: false,
      lastMessagePreview: 'You: hello',
      lastMessageTimestamp: new Date('2026-01-12T10:00:00Z').toISOString(),
      unreadCount: 0,
      onlineStatus: 'offline',
      pinned: false
    }
  ];
};

module.exports = {
  GraphApiError,
  isMockMode,
  fetchGraphUserProfile,
  fetchGraphUserTenants,
  fetchGraphChatsFromAPI,
  fetchGraphChatMessages,
  sendGraphChatMessage,
  fetchGraphMessageImage,
  fetchGraphRecentFiles,
  normalizeGraphChat,
  normalizeGraphMessage,
  getDemoMultiAccountChats,
  getDemoChatMessages,
  getPersonalAccountChats
};
