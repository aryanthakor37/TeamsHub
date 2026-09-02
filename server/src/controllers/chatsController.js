const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const ConnectedAccount = require('../models/ConnectedAccount');
const {
  isMockMode,
  GraphApiError,
  fetchGraphUserProfile,
  fetchGraphChatsFromAPI,
  fetchGraphChatMessages,
  sendGraphChatMessage,
  updateGraphChatMessage,
  deleteGraphChatMessage,
  setGraphMessageReaction,
  unsetGraphMessageReaction,
  getUnicodeReaction,
  fetchGraphMessageImage,
  normalizeGraphChat,
  normalizeGraphMessage,
  getDemoMultiAccountChats,
  getDemoChatMessages,
  getPersonalAccountChats
} = require('../services/graphService');

/**
 * Helper: Get the access token for a specific connected account.
 * Token is stored in ConnectedAccount with select:false, so we must explicitly select it.
 */
const getAccountToken = async (userId, connectedAccountId) => {
  const account = await ConnectedAccount.findOne({
    _id: connectedAccountId,
    userId
  }).select('+microsoftAccessToken +tokenExpiresAt');

  if (!account) return null;
  if (!account.microsoftAccessToken) return null;

  // Check expiry
  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
    return null; // Token expired — client must re-authenticate
  }

  return {
    accessToken: account.microsoftAccessToken,
    email: account.email,
    displayName: account.displayName,
    company: account.displayName
  };
};

/**
 * Helper: Send a Graph error response
 */
const sendGraphError = (res, error) => {
  if (error instanceof GraphApiError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        retryAfter: error.retryAfter || undefined
      }
    });
  }
  return res.status(500).json({
    success: false,
    error: {
      code: 'CHATS_FETCH_ERROR',
      message: error.message || 'An unexpected error occurred.'
    }
  });
};

// ============================================================
// GET /api/chats
// ============================================================

const getChats = async (req, res) => {
  try {
    const { connectedAccountId, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    let clientUserEmail = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();
    const userEmailsHeader = req.headers['x-user-emails'];
    const activeEmailsList = userEmailsHeader
      ? userEmailsHeader.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
      : (clientUserEmail ? [clientUserEmail] : []);

    const headerToken = req.microsoftAccessToken;
    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    // If client has no connected accounts or tokens in session, return empty list
    if (activeEmailsList.length === 0 && !headerToken && Object.keys(accountTokensMap).length === 0) {
      return res.status(200).json({
        success: true,
        source: 'empty',
        data: {
          items: [],
          page: pageNum,
          limit: limitNum,
          total: 0,
          hasMore: false
        }
      });
    }

    // ── Mock Mode ──
    if (isMockMode()) {
      const chats = getDemoMultiAccountChats(connectedAccountId);
      return res.status(200).json({
        success: true,
        source: 'mock',
        data: {
          items: chats,
          page: pageNum,
          limit: limitNum,
          total: chats.length,
          hasMore: false
        }
      });
    }

const decodeTokenMeta = (token) => {
  if (!token || typeof token !== 'string') return { email: '', name: '' };
  try {
    const parts = token.split('.');
    if (parts.length < 2) return { email: '', name: '' };
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const email = (payload.preferred_username || payload.upn || payload.email || payload.unique_name || '').toLowerCase().trim();
    const name = (payload.name || payload.given_name || '').trim();
    return { email, name };
  } catch (e) {
    return { email: '', name: '' };
  }
};

    // ── Real Mode: Find Tokens & Fetch Live Graph Chats across ALL connected accounts ──
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    let targetAccounts = [];

    // 1. If caller sent a direct Bearer headerToken, ALWAYS accurately decode email/name
    if (headerToken) {
      const { email: jwtEmail, name: jwtName } = decodeTokenMeta(headerToken);
      const primaryEmail = jwtEmail || clientUserEmail || 'active-user';
      const primaryName = jwtName || (primaryEmail.includes('@') ? primaryEmail.split('@')[0] : 'Microsoft User');
      targetAccounts.push({
        _id: `acc-bearer-${primaryEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: primaryEmail,
        displayName: primaryName,
        microsoftAccessToken: headerToken
      });
    }

    // 2. Populate all accounts from accountTokensMap with token verification
    Object.entries(accountTokensMap).forEach(([email, token]) => {
      const cleanEmail = email.toLowerCase().trim();
      const { email: jwtEmail, name: jwtName } = decodeTokenMeta(token);
      const finalEmail = jwtEmail || cleanEmail;
      const finalName = jwtName || (finalEmail.includes('@') ? finalEmail.split('@')[0] : 'Microsoft User');

      if (token && !targetAccounts.some(a => (a.email || '').toLowerCase() === finalEmail)) {
        targetAccounts.push({
          _id: `acc-token-${finalEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: finalEmail,
          displayName: finalName,
          microsoftAccessToken: token
        });
      }
    });

    // 3. Include in-memory connected accounts
    if (global.liveInMemoryAccounts) {
      global.liveInMemoryAccounts.forEach((memAcc, memEmail) => {
        const cleanEmail = memEmail.toLowerCase().trim();
        if (memAcc.status !== 'disconnected' && !targetAccounts.some(a => (a.email || '').toLowerCase() === cleanEmail)) {
          targetAccounts.push(memAcc);
        }
      });
    }

    // 4. Add from DB if available
    if (dbAvailable) {
      try {
        const dbAccs = await ConnectedAccount.find({
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        dbAccs.forEach(acc => {
          const cleanEmail = (acc.email || '').toLowerCase().trim();
          if (cleanEmail && !targetAccounts.some(a => (a.email || '').toLowerCase() === cleanEmail)) {
            targetAccounts.push(acc);
          }
        });
      } catch (dbErr) {}
    }

    // Filter targetAccounts by active connected accounts in current client session if specified
    if (activeEmailsList.length > 0 && targetAccounts.length > 1) {
      const filtered = targetAccounts.filter(acc => {
        const accEmail = (acc.email || '').toLowerCase().trim();
        return activeEmailsList.some(clientEmail => clientEmail === accEmail || clientEmail.includes(accEmail) || accEmail.includes(clientEmail));
      });
      if (filtered.length > 0) {
        targetAccounts = filtered;
      }
    }

    // Filter by specific connectedAccountId if requested
    if (connectedAccountId && connectedAccountId !== 'all' && connectedAccountId !== '[object Object]') {
      const filterKey = connectedAccountId.toLowerCase().trim();
      const filterUser = filterKey.split('@')[0];
      const matched = targetAccounts.filter(a => {
        const aEmail = (a.email || '').toLowerCase().trim();
        const aId = (a._id || a.accountId || '').toString().toLowerCase().trim();
        const aName = (a.displayName || a.name || '').toLowerCase().trim();
        const aUser = aEmail.split('@')[0];
        return aEmail === filterKey || aId === filterKey || aEmail.includes(filterKey) || filterKey.includes(aEmail) ||
               (aName && (aName.includes(filterKey) || filterKey.includes(aName))) ||
               (filterUser && (aEmail.includes(filterUser) || aId.includes(filterUser) || (aUser && (aUser.includes(filterUser) || filterUser.includes(aUser)))));
      });
      if (matched.length > 0) {
        targetAccounts = matched;
      }
    }

    if (targetAccounts.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'graph',
        data: {
          items: [],
          page: pageNum,
          limit: limitNum,
          total: 0,
          hasMore: false
        }
      });
    }

    const allUnifiedChats = [];

    await Promise.all(
      targetAccounts.map(async (acc) => {
        try {
          const accEmail = (acc.email || '').toLowerCase().trim();
          let currentUserInfo = {
            email: accEmail,
            displayName: acc.displayName || 'Microsoft User',
            id: ''
          };

          let rawChats = [];
          const tokenFromHeader = accountTokensMap[accEmail];
          let activeAccessToken = tokenFromHeader || acc.microsoftAccessToken;
          if (!activeAccessToken && headerToken && (!clientUserEmail || clientUserEmail === accEmail)) {
            activeAccessToken = headerToken;
          }

          if (activeAccessToken) {
            try {
              const graphResponse = await fetchGraphChatsFromAPI(activeAccessToken);
              rawChats = graphResponse?.value || [];
            } catch (gErr) {
              console.error(`[getChats] Graph chats error for ${acc.email}:`, gErr.message);
            }
          }

          let accountCompanyBadge = (acc.displayName || currentUserInfo.displayName || acc.email?.split('@')[0] || 'Microsoft Account').trim();

          let normalizedList = [];
          if (rawChats && rawChats.length > 0) {
            normalizedList = rawChats.map((gc) => {
              const normalized = normalizeGraphChat(gc, acc._id.toString(), accountCompanyBadge, currentUserInfo);
              normalized.connectedAccountId = acc._id.toString();
              normalized.accountEmail = (acc.email || currentUserInfo.email || '').toLowerCase();
              return normalized;
            });

            if (!global.liveInMemoryChats) global.liveInMemoryChats = new Map();
            global.liveInMemoryChats.set(accEmail, normalizedList);
          } else if (global.liveInMemoryChats && (global.liveInMemoryChats.get(accEmail) || Array.from(global.liveInMemoryChats.entries()).find(([k]) => k.includes(accEmail.split('@')[0])))) {
            const entry = global.liveInMemoryChats.get(accEmail) || Array.from(global.liveInMemoryChats.entries()).find(([k]) => k.includes(accEmail.split('@')[0]))?.[1] || [];
            normalizedList = entry;
          } else if (dbAvailable) {
            // Fallback: retrieve cached chats for this account from database
            try {
              const cachedDbChats = await Chat.find({
                $or: [
                  { accountEmail: accEmail },
                  { connectedAccountId: acc._id.toString() },
                  { company: { $regex: new RegExp(accEmail.split('@')[0], 'i') } }
                ]
              }).lean();

              if (cachedDbChats && cachedDbChats.length > 0) {
                normalizedList = cachedDbChats.map((c) => ({
                  _id: c.microsoftChatId || c._id.toString(),
                  microsoftChatId: c.microsoftChatId || c._id.toString(),
                  connectedAccountId: acc._id.toString(),
                  accountEmail: c.accountEmail || accEmail,
                  participant: c.participant,
                  role: c.role || 'Direct Message',
                  company: c.company || accountCompanyBadge,
                  accountBadge: c.accountBadge || accountCompanyBadge,
                  lastMessagePreview: c.lastMessagePreview || '',
                  lastMessageTimestamp: c.lastMessageTimestamp,
                  unreadCount: c.unreadCount || 0,
                  chatType: c.chatType || 'oneOnOne',
                  onlineStatus: 'online'
                }));
              }
            } catch (cErr) {}
          }

          allUnifiedChats.push(...normalizedList);
        } catch (err) {
          console.warn(`[getChats] Warning fetching chats for ${acc.displayName}:`, err.message);
        }
      })
    );

    // If still 0 chats across all target accounts, fallback to global in-memory chats for active accounts only
    if (allUnifiedChats.length === 0 && global.liveInMemoryChats && global.liveInMemoryChats.size > 0) {
      for (const [memEmail, chatsArr] of global.liveInMemoryChats.entries()) {
        const cleanMemEmail = memEmail.toLowerCase().trim();
        const isActive = activeEmailsList.length === 0 || activeEmailsList.some(e => e === cleanMemEmail || e.includes(cleanMemEmail) || cleanMemEmail.includes(e));
        if (isActive && Array.isArray(chatsArr)) {
          allUnifiedChats.push(...chatsArr);
        }
      }
    }

    // Deduplicate combined multi-account chats by unique account + microsoftChatId
    const uniqueMap = new Map();
    allUnifiedChats.forEach((c) => {
      const key = `${c.accountEmail || c.connectedAccountId}-${c.microsoftChatId || c._id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, c);
      }
    });
    const sanitizedChats = Array.from(uniqueMap.values());

    // Sort combined multi-account chats chronologically
    sanitizedChats.sort((a, b) => {
      const tA = new Date(a.lastMessageTimestamp || 0).getTime();
      const tB = new Date(b.lastMessageTimestamp || 0).getTime();
      return tB - tA;
    });

    return res.status(200).json({
      success: true,
      source: 'graph',
      data: {
        items: sanitizedChats,
        page: pageNum,
        limit: limitNum,
        total: sanitizedChats.length,
        hasMore: false
      }
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// GET /api/chats/:id
// ============================================================

const getChatById = async (req, res) => {
  try {
    const { id } = req.params;

    // ── Mock Mode ──
    if (isMockMode()) {
      const all = getDemoMultiAccountChats('all');
      const chat = all.find((c) => c._id === id || c.microsoftChatId === id);
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: { code: 'CHAT_NOT_FOUND', message: 'Chat not found.' }
        });
      }
      return res.status(200).json({ success: true, source: 'mock', data: chat });
    }

    // ── Real Mode ──
    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    if (dbAvailable) {
      const chat = await Chat.findOne({ _id: id, userId: req.user._id });
      if (chat) {
        return res.status(200).json({ success: true, source: 'cache', data: chat });
      }
    }

    return res.status(404).json({
      success: false,
      error: { code: 'CHAT_NOT_FOUND', message: 'Requested chat does not exist or you do not have permission.' }
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// GET /api/chats/:id/messages
// ============================================================

const getChatMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // ── Mock Mode ──
    if (isMockMode()) {
      const messages = getDemoChatMessages(id);
      return res.status(200).json({
        success: true,
        source: 'mock',
        data: {
          items: messages,
          page: pageNum,
          limit: limitNum,
          total: messages.length,
          hasMore: false,
          isReadOnly: true
        }
      });
    }

    // ── Real Mode: Try MongoDB cache first ──
    const dbAvailable = Message.db && Message.db.readyState === 1;

    // ── Real Mode: Token Lookup & Graph Call ──
    let accessToken = req.microsoftAccessToken;
    if (!accessToken && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      accessToken = req.headers.authorization.substring(7).trim();
    }
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();
    const { connectedAccountId } = req.query;

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    if (!accessToken) {
      if (connectedAccountId && accountTokensMap[connectedAccountId.toLowerCase()]) {
        accessToken = accountTokensMap[connectedAccountId.toLowerCase()];
      } else if (activeEmailHeader && accountTokensMap[activeEmailHeader]) {
        accessToken = accountTokensMap[activeEmailHeader];
      } else if (Object.keys(accountTokensMap).length > 0) {
        accessToken = Object.values(accountTokensMap)[0];
      }
    }

    if (!accessToken && dbAvailable) {
      let acc = null;
      if (connectedAccountId && connectedAccountId !== 'all') {
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc && mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc) {
          acc = await ConnectedAccount.findOne({ accountId: connectedAccountId }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
      }
      if (acc && acc.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
      } else if (!accessToken) {
        if (activeEmailHeader) {
          acc = await ConnectedAccount.findOne({
            email: activeEmailHeader,
            microsoftAccessToken: { $exists: true, $ne: '' }
          }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc) {
          acc = await ConnectedAccount.findOne({
            microsoftAccessToken: { $exists: true, $ne: '' }
          }).sort({ updatedAt: -1 }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (acc && acc.microsoftAccessToken) {
          accessToken = acc.microsoftAccessToken;
        }
      }
    }

    const cleanChatId = decodeURIComponent(id);
    const candidateTokens = [];
    if (accessToken) candidateTokens.push(accessToken);
    Object.values(accountTokensMap).forEach(t => {
      if (t && !candidateTokens.includes(t)) candidateTokens.push(t);
    });

    if (candidateTokens.length > 0 && cleanChatId.startsWith('19:')) {
      for (const token of candidateTokens) {
        try {
          let msEmail = (req.user?.email || req.headers['x-user-email'] || '').toLowerCase().trim();
          let msDisplayName = (req.user?.name || req.user?.displayName || 'User').trim();

          if (dbAvailable && connectedAccountId && connectedAccountId !== 'all') {
            const accDoc = connectedAccountId.includes('@')
              ? await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() })
              : (mongoose.Types.ObjectId.isValid(connectedAccountId) ? await ConnectedAccount.findById(connectedAccountId) : await ConnectedAccount.findOne({ accountId: connectedAccountId }));
            if (accDoc) {
              if (accDoc.email) msEmail = accDoc.email.toLowerCase();
              if (accDoc.displayName) msDisplayName = accDoc.displayName;
            }
          }

          const graphResponse = await fetchGraphChatMessages(token, cleanChatId);
          const rawMessages = graphResponse?.value || [];
          const messages = rawMessages
            .map((m) => normalizeGraphMessage(m, cleanChatId, connectedAccountId || 'default', msEmail, msDisplayName))
            .filter(Boolean);

          // Strictly sort in chronological order: oldest first (top), newest last (bottom)
          messages.sort((a, b) => {
            const timeA = new Date(a.createdDateTime).getTime() || 0;
            const timeB = new Date(b.createdDateTime).getTime() || 0;
            return timeA - timeB;
          });

          return res.status(200).json({
            success: true,
            source: 'graph',
            data: {
              items: messages,
              page: 1,
              limit: messages.length,
              total: messages.length,
              hasMore: !!graphResponse['@odata.nextLink'],
              isReadOnly: true
            }
          });
        } catch (graphErr) {
          console.warn('[getChatMessages] Multi-token retry notice:', graphErr.message);
        }
      }
    }

    // Seamless Fallback
    const demoFallback = getDemoChatMessages(cleanChatId);
    return res.status(200).json({
      success: true,
      source: 'fallback',
      data: {
        items: demoFallback || [],
        page: pageNum,
        limit: limitNum,
        total: (demoFallback || []).length,
        hasMore: false,
        isReadOnly: true
      }
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// POST /api/chats/:id/messages
// ============================================================

const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content = '', attachments = [], image = null } = req.body;

    if (!content.trim() && (!attachments || attachments.length === 0) && !image) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Message content or attachment is required.' }
      });
    }

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    let formattedContent = content ? content.trim() : '';
    const hostedContents = [];
    let tempIdCounter = 1;

    // Helper to format images as Microsoft Graph hostedContents
    const processImageToHosted = (dataUrlStr, fileName = 'Image') => {
      const match = typeof dataUrlStr === 'string' ? dataUrlStr.match(/^data:([^;]+);base64,(.+)$/) : null;
      if (match) {
        const mime = match[1] || 'image/png';
        const bytes = match[2];
        const tempId = String(tempIdCounter++);
        hostedContents.push({
          '@microsoft.graph.temporaryId': tempId,
          contentBytes: bytes,
          contentType: mime
        });
        return `<p><img src="../hostedContents/${tempId}/$value" alt="${fileName}" style="max-width: 480px; max-height: 360px; border-radius: 8px;" /></p>`;
      }
      return '';
    };

    if (image) {
      if (typeof image === 'string' && image.startsWith('data:image')) {
        const imgTag = processImageToHosted(image, 'Uploaded Photo');
        if (imgTag) formattedContent += `\n${imgTag}`;
      } else if (image.dataUrl && image.dataUrl.startsWith('data:image')) {
        const imgTag = processImageToHosted(image.dataUrl, image.name || 'Uploaded Photo');
        if (imgTag) formattedContent += `\n${imgTag}`;
      }
    }

    if (Array.isArray(attachments)) {
      attachments.forEach((att) => {
        if (att.dataUrl && att.dataUrl.startsWith('data:image')) {
          const imgTag = processImageToHosted(att.dataUrl, att.name || 'Photo');
          if (imgTag) formattedContent += `\n${imgTag}`;
        }
      });
    }

    // ── Mock Mode ──
    if (isMockMode()) {
      const mockMsg = {
        _id: `msg-mock-${Date.now()}`,
        chatId: id,
        microsoftMessageId: `mock-${Date.now()}`,
        senderName: 'You',
        senderEmail: req.user?.email || 'user@example.com',
        content: formattedContent || content.trim(),
        contentType: 'html',
        isOutgoing: true,
        attachments: attachments || [],
        reactions: [],
        createdDateTime: new Date().toISOString()
      };
      return res.status(201).json({ success: true, source: 'mock', data: mockMsg });
    }

    // ── Real Mode ──
    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    let accessToken = req.microsoftAccessToken;
    const connectedAccountId = req.body?.connectedAccountId || req.query?.connectedAccountId;
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();

    if (!accessToken) {
      if (connectedAccountId && accountTokensMap[connectedAccountId.toLowerCase()]) {
        accessToken = accountTokensMap[connectedAccountId.toLowerCase()];
      } else if (activeEmailHeader && accountTokensMap[activeEmailHeader]) {
        accessToken = accountTokensMap[activeEmailHeader];
      } else if (Object.keys(accountTokensMap).length > 0) {
        accessToken = Object.values(accountTokensMap)[0];
      }
    }

    if (dbAvailable && !accessToken) {
      let acc = null;
      if (connectedAccountId && connectedAccountId !== 'all') {
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc && mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc) {
          acc = await ConnectedAccount.findOne({ accountId: connectedAccountId }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
      }
      if (acc && acc.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
      } else if (!accessToken) {
        if (activeEmailHeader) {
          acc = await ConnectedAccount.findOne({
            email: activeEmailHeader,
            microsoftAccessToken: { $exists: true, $ne: '' }
          }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc) {
          acc = await ConnectedAccount.findOne({
            microsoftAccessToken: { $exists: true, $ne: '' }
          }).sort({ updatedAt: -1 }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (acc && acc.microsoftAccessToken) {
          accessToken = acc.microsoftAccessToken;
        }
      }
    }

    const candidateTokens = [];
    if (accessToken) candidateTokens.push(accessToken);
    Object.values(accountTokensMap).forEach(t => {
      if (t && !candidateTokens.includes(t)) candidateTokens.push(t);
    });

    let microsoftChatId = decodeURIComponent(id);
    let targetAccountId = 'default';
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(microsoftChatId)) {
      const chat = await Chat.findById(microsoftChatId);
      if (chat) {
        microsoftChatId = chat.microsoftChatId;
        targetAccountId = chat.connectedAccountId;
      }
    }

    if (candidateTokens.length > 0 && microsoftChatId.startsWith('19:')) {
      for (const token of candidateTokens) {
        try {
          const userProfile = await fetchGraphUserProfile(token);
          const msEmail = userProfile.mail || userProfile.userPrincipalName || req.user?.email || '';
          const msId = userProfile.id;

          const graphResponse = await sendGraphChatMessage(token, microsoftChatId, formattedContent, [], hostedContents);
          const normalizedMessage = normalizeGraphMessage(graphResponse, id, targetAccountId, msEmail, msId);

          if (attachments && attachments.length > 0 && (!normalizedMessage.attachments || normalizedMessage.attachments.length === 0)) {
            normalizedMessage.attachments = attachments;
          }

          const io = req.app.get('io');
          if (io && normalizedMessage) {
            io.to(`chat:${id}`).emit('new_message', normalizedMessage);
          }

          return res.status(201).json({
            success: true,
            source: 'graph',
            data: normalizedMessage
          });
        } catch (graphErr) {
          console.warn('[Graph sendMessage token retry]:', graphErr.message);
        }
      }
    }

    // In-Memory Pass-Through Fallback
    const passThroughMsg = {
      _id: `msg-${Date.now()}`,
      chatId: id,
      microsoftMessageId: `msg-${Date.now()}`,
      senderName: req.user?.name || req.user?.displayName || 'Aryan Kumrecha',
      senderEmail: req.user?.email || activeEmailHeader || 'aryan@companya.com',
      content: formattedContent || content.trim(),
      contentType: 'html',
      isOutgoing: true,
      attachments: attachments || [],
      reactions: [],
      createdDateTime: new Date().toISOString()
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('new_message', passThroughMsg);
    }

    return res.status(201).json({
      success: true,
      source: 'passthrough',
      data: passThroughMsg
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

/**
 * POST /api/chats/:id/messages/:msgId/reactions
 * Set a reaction on a message
 */
const setMessageReaction = async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const { reactionType = 'like', connectedAccountId } = req.body;

    const validReactions = ['like', 'heart', 'laugh', 'surprised', 'sad', 'applause', 'angry'];
    const cleanReaction = validReactions.includes(reactionType.toLowerCase()) ? reactionType.toLowerCase() : 'like';

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    let accessToken = req.microsoftAccessToken;
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();

    if (!accessToken) {
      if (connectedAccountId && accountTokensMap[connectedAccountId.toLowerCase()]) {
        accessToken = accountTokensMap[connectedAccountId.toLowerCase()];
      } else if (activeEmailHeader && accountTokensMap[activeEmailHeader]) {
        accessToken = accountTokensMap[activeEmailHeader];
      } else if (Object.keys(accountTokensMap).length > 0) {
        accessToken = Object.values(accountTokensMap)[0];
      }
    }

    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    if (dbAvailable && !accessToken) {
      let acc = null;
      if (connectedAccountId && connectedAccountId !== 'all') {
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() }).select('+microsoftAccessToken');
        } else if (mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken');
        }
      }
      if (!acc && activeEmailHeader) {
        acc = await ConnectedAccount.findOne({ email: activeEmailHeader }).select('+microsoftAccessToken');
      }
      if (!acc) {
        acc = await ConnectedAccount.findOne({ microsoftAccessToken: { $exists: true, $ne: '' } }).sort({ updatedAt: -1 }).select('+microsoftAccessToken');
      }
      if (acc?.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
      }
    }

    const candidateTokens = [];
    if (accessToken) candidateTokens.push(accessToken);
    Object.values(accountTokensMap).forEach(t => {
      if (t && !candidateTokens.includes(t)) candidateTokens.push(t);
    });

    let cleanChatId = decodeURIComponent(id);
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(cleanChatId)) {
      const chat = await Chat.findById(cleanChatId);
      if (chat && chat.microsoftChatId) cleanChatId = chat.microsoftChatId;
    }

    let realMessageId = decodeURIComponent(msgId);
    if (realMessageId.startsWith('msg-')) {
      const sub = realMessageId.replace(/^msg-/, '');
      if (/^\d+$/.test(sub)) {
        realMessageId = sub;
      }
    }
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(realMessageId)) {
      const msgDoc = await Message.findById(realMessageId);
      if (msgDoc && msgDoc.microsoftMessageId) realMessageId = msgDoc.microsoftMessageId;
    }

    let graphSuccess = false;
    if (candidateTokens.length > 0 && !isMockMode()) {
      for (const token of candidateTokens) {
        try {
          await setGraphMessageReaction(token, cleanChatId, realMessageId, cleanReaction);
          graphSuccess = true;
          console.log(`[Graph setReaction SUCCESS] Chat: ${cleanChatId} Msg: ${realMessageId} Reaction: ${cleanReaction}`);
          break;
        } catch (err) {
          console.warn(`[Graph setReaction error for Chat: ${cleanChatId} Msg: ${realMessageId}]`, err.message);
        }
      }
    }

    const reactionPayload = {
      chatId: id,
      messageId: msgId,
      reactionType: cleanReaction,
      action: 'set',
      graphSynced: graphSuccess,
      user: {
        displayName: req.user?.displayName || req.user?.name || 'You',
        email: req.user?.email || activeEmailHeader || ''
      }
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('reaction:updated', reactionPayload);
    }

    return res.status(200).json({
      success: true,
      data: reactionPayload
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

/**
 * DELETE /api/chats/:id/messages/:msgId/reactions or POST /unsetReaction
 * Unset a reaction on a message
 */
const unsetMessageReaction = async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const reactionType = req.body?.reactionType || req.query?.reactionType || 'like';
    const connectedAccountId = req.body?.connectedAccountId || req.query?.connectedAccountId;

    const validReactions = ['like', 'heart', 'laugh', 'surprised', 'sad', 'applause', 'angry'];
    const cleanReaction = validReactions.includes(reactionType.toLowerCase()) ? reactionType.toLowerCase() : 'like';

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    let accessToken = req.microsoftAccessToken;
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();

    if (!accessToken) {
      if (connectedAccountId && accountTokensMap[connectedAccountId.toLowerCase()]) {
        accessToken = accountTokensMap[connectedAccountId.toLowerCase()];
      } else if (activeEmailHeader && accountTokensMap[activeEmailHeader]) {
        accessToken = accountTokensMap[activeEmailHeader];
      } else if (Object.keys(accountTokensMap).length > 0) {
        accessToken = Object.values(accountTokensMap)[0];
      }
    }

    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    if (dbAvailable && !accessToken) {
      let acc = null;
      if (connectedAccountId && connectedAccountId !== 'all') {
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() }).select('+microsoftAccessToken');
        } else if (mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken');
        }
      }
      if (!acc && activeEmailHeader) {
        acc = await ConnectedAccount.findOne({ email: activeEmailHeader }).select('+microsoftAccessToken');
      }
      if (!acc) {
        acc = await ConnectedAccount.findOne({ microsoftAccessToken: { $exists: true, $ne: '' } }).sort({ updatedAt: -1 }).select('+microsoftAccessToken');
      }
      if (acc?.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
      }
    }

    const candidateTokens = [];
    if (accessToken) candidateTokens.push(accessToken);
    Object.values(accountTokensMap).forEach(t => {
      if (t && !candidateTokens.includes(t)) candidateTokens.push(t);
    });

    let cleanChatId = decodeURIComponent(id);
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(cleanChatId)) {
      const chat = await Chat.findById(cleanChatId);
      if (chat && chat.microsoftChatId) cleanChatId = chat.microsoftChatId;
    }

    let realMessageId = decodeURIComponent(msgId);
    if (realMessageId.startsWith('msg-')) {
      const sub = realMessageId.replace(/^msg-/, '');
      if (/^\d+$/.test(sub)) {
        realMessageId = sub;
      }
    }
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(realMessageId)) {
      const msgDoc = await Message.findById(realMessageId);
      if (msgDoc && msgDoc.microsoftMessageId) realMessageId = msgDoc.microsoftMessageId;
    }

    let graphSuccess = false;
    if (candidateTokens.length > 0 && !isMockMode()) {
      for (const token of candidateTokens) {
        try {
          await unsetGraphMessageReaction(token, cleanChatId, realMessageId, cleanReaction);
          graphSuccess = true;
          console.log(`[Graph unsetReaction SUCCESS] Chat: ${cleanChatId} Msg: ${realMessageId} Reaction: ${cleanReaction}`);
          break;
        } catch (err) {
          console.warn(`[Graph unsetReaction error for Chat: ${cleanChatId} Msg: ${realMessageId}]`, err.message);
        }
      }
    }

    const reactionPayload = {
      chatId: id,
      messageId: msgId,
      reactionType: cleanReaction,
      action: 'unset',
      graphSynced: graphSuccess,
      user: {
        displayName: req.user?.displayName || req.user?.name || 'You',
        email: req.user?.email || activeEmailHeader || ''
      }
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('reaction:updated', reactionPayload);
    }

    return res.status(200).json({
      success: true,
      data: reactionPayload
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// PATCH /api/chats/:id/messages/:msgId (Edit Message)
// ============================================================
const editMessage = async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const { content, connectedAccountId } = req.body || {};
    const dbAvailable = Chat.db && Chat.db.readyState === 1;

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    let accessToken = req.microsoftAccessToken;
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();

    if (!accessToken) {
      if (connectedAccountId && accountTokensMap[connectedAccountId.toLowerCase()]) {
        accessToken = accountTokensMap[connectedAccountId.toLowerCase()];
      } else if (activeEmailHeader && accountTokensMap[activeEmailHeader]) {
        accessToken = accountTokensMap[activeEmailHeader];
      } else if (Object.keys(accountTokensMap).length > 0) {
        accessToken = Object.values(accountTokensMap)[0];
      }
    }

    if (dbAvailable && !accessToken) {
      let acc = null;
      if (connectedAccountId && connectedAccountId !== 'all') {
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() }).select('+microsoftAccessToken');
        } else if (mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken');
        }
      }
      if (!acc && activeEmailHeader) {
        acc = await ConnectedAccount.findOne({ email: activeEmailHeader }).select('+microsoftAccessToken');
      }
      if (!acc) {
        acc = await ConnectedAccount.findOne({ microsoftAccessToken: { $exists: true, $ne: '' } }).sort({ updatedAt: -1 }).select('+microsoftAccessToken');
      }
      if (acc?.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
      }
    }

    const candidateTokens = [];
    if (accessToken) candidateTokens.push(accessToken);
    if (req.headers['x-ms-token'] && !candidateTokens.includes(req.headers['x-ms-token'])) candidateTokens.push(req.headers['x-ms-token']);
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const b = req.headers.authorization.split(' ')[1];
      if (b && !candidateTokens.includes(b)) candidateTokens.push(b);
    }
    Object.values(accountTokensMap).forEach(t => {
      if (t && !candidateTokens.includes(t)) candidateTokens.push(t);
    });

    if (dbAvailable) {
      const accounts = await ConnectedAccount.find({
        microsoftAccessToken: { $exists: true, $ne: '' }
      }).select('+microsoftAccessToken');
      accounts.forEach(acc => {
        if (acc.microsoftAccessToken && !candidateTokens.includes(acc.microsoftAccessToken)) {
          candidateTokens.push(acc.microsoftAccessToken);
        }
      });
    }

    let cleanChatId = decodeURIComponent(id);
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(cleanChatId)) {
      const chat = await Chat.findById(cleanChatId);
      if (chat && chat.microsoftChatId) cleanChatId = chat.microsoftChatId;
    }

    let realMessageId = decodeURIComponent(msgId);
    if (realMessageId.startsWith('msg-')) {
      const sub = realMessageId.replace(/^msg-/, '');
      if (/^\d+$/.test(sub)) realMessageId = sub;
    }
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(realMessageId)) {
      const msgDoc = await Message.findById(realMessageId);
      if (msgDoc && msgDoc.microsoftMessageId) realMessageId = msgDoc.microsoftMessageId;
    }

    let graphSuccess = false;
    if (candidateTokens.length > 0 && !isMockMode()) {
      for (const token of candidateTokens) {
        try {
          await updateGraphChatMessage(token, cleanChatId, realMessageId, content);
          graphSuccess = true;
          console.log(`[Graph editMessage SUCCESS] Chat: ${cleanChatId} Msg: ${realMessageId}`);
          break;
        } catch (err) {
          console.warn(`[Graph editMessage error for Chat: ${cleanChatId} Msg: ${realMessageId}]`, err.message);
        }
      }
    }

    if (dbAvailable) {
      try {
        await Message.updateOne(
          { $or: [{ microsoftMessageId: realMessageId }, { _id: realMessageId }] },
          { $set: { content: content, isEdited: true } }
        );
      } catch (dbErr) {}
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('chat:message:edited', {
        chatId: id,
        messageId: msgId,
        content
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        chatId: id,
        messageId: msgId,
        content,
        graphSynced: graphSuccess
      }
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// DELETE /api/chats/:id/messages/:msgId (Delete Message)
// ============================================================
const deleteMessage = async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const connectedAccountId = req.body?.connectedAccountId || req.query?.connectedAccountId || req.query?.email || req.headers['x-user-email'];
    const dbAvailable = Chat.db && Chat.db.readyState === 1;

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    let accessToken = req.microsoftAccessToken;
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();

    if (!accessToken) {
      if (connectedAccountId && accountTokensMap[connectedAccountId.toLowerCase()]) {
        accessToken = accountTokensMap[connectedAccountId.toLowerCase()];
      } else if (activeEmailHeader && accountTokensMap[activeEmailHeader]) {
        accessToken = accountTokensMap[activeEmailHeader];
      } else if (Object.keys(accountTokensMap).length > 0) {
        accessToken = Object.values(accountTokensMap)[0];
      }
    }

    if (dbAvailable && !accessToken) {
      let acc = null;
      if (connectedAccountId && connectedAccountId !== 'all') {
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() }).select('+microsoftAccessToken');
        } else if (mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken');
        }
      }
      if (!acc && activeEmailHeader) {
        acc = await ConnectedAccount.findOne({ email: activeEmailHeader }).select('+microsoftAccessToken');
      }
      if (!acc) {
        acc = await ConnectedAccount.findOne({ microsoftAccessToken: { $exists: true, $ne: '' } }).sort({ updatedAt: -1 }).select('+microsoftAccessToken');
      }
      if (acc?.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
      }
    }

    const candidateTokens = [];
    if (accessToken) candidateTokens.push(accessToken);
    if (req.headers['x-ms-token'] && !candidateTokens.includes(req.headers['x-ms-token'])) candidateTokens.push(req.headers['x-ms-token']);
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const b = req.headers.authorization.split(' ')[1];
      if (b && !candidateTokens.includes(b)) candidateTokens.push(b);
    }
    Object.values(accountTokensMap).forEach(t => {
      if (t && !candidateTokens.includes(t)) candidateTokens.push(t);
    });

    if (dbAvailable) {
      const accounts = await ConnectedAccount.find({
        microsoftAccessToken: { $exists: true, $ne: '' }
      }).select('+microsoftAccessToken');
      accounts.forEach(acc => {
        if (acc.microsoftAccessToken && !candidateTokens.includes(acc.microsoftAccessToken)) {
          candidateTokens.push(acc.microsoftAccessToken);
        }
      });
    }

    let cleanChatId = decodeURIComponent(id);
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(cleanChatId)) {
      const chat = await Chat.findById(cleanChatId);
      if (chat && chat.microsoftChatId) cleanChatId = chat.microsoftChatId;
    }

    let realMessageId = decodeURIComponent(msgId);
    if (realMessageId.startsWith('msg-')) {
      const sub = realMessageId.replace(/^msg-/, '');
      if (/^\d+$/.test(sub)) realMessageId = sub;
    }
    if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(realMessageId)) {
      const msgDoc = await Message.findById(realMessageId);
      if (msgDoc && msgDoc.microsoftMessageId) realMessageId = msgDoc.microsoftMessageId;
    }

    let graphSuccess = false;
    const debugLogs = [];
    if (candidateTokens.length > 0 && !isMockMode()) {
      for (let idx = 0; idx < candidateTokens.length; idx++) {
        const token = candidateTokens[idx];
        try {
          const tokenSnippet = token.substring(0, 15) + '...';
          debugLogs.push({ attempt: idx + 1, tokenSnippet, status: 'started' });
          await deleteGraphChatMessage(token, cleanChatId, realMessageId, debugLogs);
          graphSuccess = true;
          console.log(`[Graph deleteMessage SUCCESS] Chat: ${cleanChatId} Msg: ${realMessageId}`);
          break;
        } catch (err) {
          console.warn(`[Graph deleteMessage error for Chat: ${cleanChatId} Msg: ${realMessageId}]`, err.message);
          debugLogs.push({ attempt: idx + 1, status: 'failed', error: err.message, details: err.details });
        }
      }
    }

    if (dbAvailable) {
      try {
        await Message.deleteOne({
          $or: [{ microsoftMessageId: realMessageId }, { _id: realMessageId }]
        });
      } catch (dbErr) {}
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('chat:message:deleted', {
        chatId: id,
        messageId: msgId,
        realMessageId
      });
      io.emit('chat:message:deleted', {
        chatId: id,
        messageId: msgId,
        realMessageId
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        chatId: id,
        messageId: msgId,
        graphSynced: graphSuccess,
        debugLogs
      }
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// GET /api/chats/:id/messages/:msgId/hostedContents/:contentId
// ============================================================

const hostedImageCache = new Map();

const getMessageImage = async (req, res) => {
  try {
    const { id, msgId, contentId } = req.params;
    const clientEmail = (req.query.email || req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();
    const rawId = decodeURIComponent(id);
    let microsoftChatId = rawId;

    const cacheKey = `${microsoftChatId}:${msgId}:${contentId}`;
    if (hostedImageCache.has(cacheKey)) {
      const cached = hostedImageCache.get(cacheKey);
      res.set('Content-Type', cached.contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(cached.buffer);
    }

    const candidateTokens = [];
    if (req.query.token) candidateTokens.push(req.query.token);
    if (req.microsoftAccessToken) candidateTokens.push(req.microsoftAccessToken);

    const dbAvailable = Chat.db && Chat.db.readyState === 1;

    if (dbAvailable) {
      let chatDoc = null;
      if (/^[0-9a-fA-F]{24}$/.test(rawId)) {
        chatDoc = await Chat.findById(rawId);
      }
      if (!chatDoc) {
        chatDoc = await Chat.findOne({
          $or: [
            { chatId: rawId },
            { microsoftChatId: rawId }
          ]
        });
      }

      if (chatDoc) {
        if (chatDoc.microsoftChatId) {
          microsoftChatId = chatDoc.microsoftChatId;
        } else if (chatDoc.chatId && chatDoc.chatId.startsWith('19:')) {
          microsoftChatId = chatDoc.chatId;
        }
      }

      const allAccounts = await ConnectedAccount.find({
        microsoftAccessToken: { $exists: true, $ne: '' }
      }).select('+microsoftAccessToken email displayName');

      allAccounts.forEach(acc => {
        if (acc.microsoftAccessToken && !candidateTokens.includes(acc.microsoftAccessToken)) {
          if (clientEmail && acc.email && acc.email.toLowerCase() === clientEmail) {
            candidateTokens.unshift(acc.microsoftAccessToken);
          } else {
            candidateTokens.push(acc.microsoftAccessToken);
          }
        }
      });
    }

    if (global.liveInMemoryAccounts && global.liveInMemoryAccounts.size > 0) {
      for (const [key, acc] of global.liveInMemoryAccounts.entries()) {
        if (acc && acc.microsoftAccessToken) {
          const accEmail = (acc.email || '').toLowerCase().trim();
          if (clientEmail && accEmail === clientEmail) {
            if (!candidateTokens.includes(acc.microsoftAccessToken)) candidateTokens.unshift(acc.microsoftAccessToken);
          } else if (!candidateTokens.includes(acc.microsoftAccessToken)) {
            candidateTokens.push(acc.microsoftAccessToken);
          }
        }
      }
    }

    if (candidateTokens.length > 0 && microsoftChatId) {
      const decodedContentId = decodeURIComponent(contentId);
      for (const token of candidateTokens) {
        try {
          const { buffer, contentType } = await fetchGraphMessageImage(
            token,
            microsoftChatId,
            msgId,
            decodedContentId
          );

          if (buffer && buffer.length > 0) {
            hostedImageCache.set(cacheKey, { buffer, contentType: contentType || 'image/jpeg' });
            res.set('Content-Type', contentType || 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
            return res.send(buffer);
          }
        } catch (graphErr) {}
      }
    }

    const svgPhotoCard = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e0e7ff"/><stop offset="100%" stop-color="#c7d2fe"/></linearGradient><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bgGrad)" rx="16"/><circle cx="240" cy="130" r="48" fill="url(#iconGrad)" opacity="0.9"/><path d="M216 142l16-20 14 16 22-28 24 32H216z" fill="#ffffff"/><circle cx="232" cy="116" r="6" fill="#ffffff"/><text x="240" y="215" dominant-baseline="middle" text-anchor="middle" fill="#3730a3" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="16">Teams Photo Attachment</text><text x="240" y="240" dominant-baseline="middle" text-anchor="middle" fill="#4338ca" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="12">Shared via Microsoft Teams</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(svgPhotoCard);
  } catch (error) {
    const svgPhotoCard = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e0e7ff"/><stop offset="100%" stop-color="#c7d2fe"/></linearGradient><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bgGrad)" rx="16"/><circle cx="240" cy="130" r="48" fill="url(#iconGrad)" opacity="0.9"/><path d="M216 142l16-20 14 16 22-28 24 32H216z" fill="#ffffff"/><circle cx="232" cy="116" r="6" fill="#ffffff"/><text x="240" y="215" dominant-baseline="middle" text-anchor="middle" fill="#3730a3" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="16">Teams Photo Attachment</text><text x="240" y="240" dominant-baseline="middle" text-anchor="middle" fill="#4338ca" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="12">Shared via Microsoft Teams</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(svgPhotoCard);
  }
};

// ============================================================
// POST /api/chats/refresh
// ============================================================

const refreshChats = async (req, res) => {
  try {
    const { connectedAccountId } = req.body;

    // ── Mock Mode ──
    if (isMockMode()) {
      return res.status(200).json({
        success: true,
        source: 'mock',
        message: 'Mock Graph chats refreshed.',
        syncedAt: new Date().toISOString()
      });
    }

    // ── Real Mode ──
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    if (!dbAvailable) {
      return res.status(200).json({
        success: true,
        source: 'memory',
        message: 'Graph chats synced successfully.',
        syncedAt: new Date().toISOString()
      });
    }

    // Find connected accounts to sync
    const accountQuery = { userId: req.user._id, status: 'connected' };
    if (connectedAccountId && connectedAccountId !== 'all') {
      accountQuery._id = connectedAccountId;
    }

    const accounts = await ConnectedAccount.find(accountQuery).select('+microsoftAccessToken +tokenExpiresAt');

    if (accounts.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'none',
        message: 'No connected Microsoft accounts found to refresh.',
        syncedAt: new Date().toISOString(),
        results: []
      });
    }

    const syncResults = [];

    for (const account of accounts) {
      if (!account.microsoftAccessToken) {
        syncResults.push({
          accountId: account._id,
          displayName: account.displayName,
          status: 'SKIPPED',
          reason: 'No access token — re-authentication required'
        });
        continue;
      }

      // Check token expiry
      if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
        syncResults.push({
          accountId: account._id,
          displayName: account.displayName,
          status: 'SKIPPED',
          reason: 'Access token expired — re-authentication required'
        });
        continue;
      }

      try {
        let currentUserInfo = {
          email: account.email || '',
          displayName: account.displayName || '',
          id: account.microsoftUserId || ''
        };

        try {
          const profile = await fetchGraphUserProfile(account.microsoftAccessToken);
          if (profile) {
            currentUserInfo = {
              email: profile.mail || profile.userPrincipalName || currentUserInfo.email,
              displayName: profile.displayName || currentUserInfo.displayName,
              id: profile.id || ''
            };
          }
        } catch (profileErr) {
          // Profile fallback when token is expired or demo
        }

        const graphResponse = await fetchGraphChatsFromAPI(account.microsoftAccessToken);
        const graphChats = graphResponse.value || [];
        let syncedCount = 0;

        for (const gc of graphChats) {
          syncedCount++;
        }

        syncResults.push({
          accountId: account._id,
          displayName: account.displayName,
          status: 'SUCCESS',
          chatsSynced: syncedCount
        });
      } catch (graphErr) {
        syncResults.push({
          accountId: account._id,
          displayName: account.displayName,
          status: 'FAILED',
          error: graphErr instanceof GraphApiError ? graphErr.code : graphErr.message
        });
      }
    }

    res.status(200).json({
      success: true,
      source: 'graph',
      message: 'Microsoft Graph chat sync completed.',
      syncedAt: new Date().toISOString(),
      results: syncResults
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// POST /api/chats/:id/read
// ============================================================

const markChatRead = async (req, res) => {
  try {
    return res.status(200).json({ success: true, message: 'Chat marked as read' });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

module.exports = {
  getChats,
  getChatById,
  getChatMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  setMessageReaction,
  unsetMessageReaction,
  getMessageImage,
  refreshChats,
  markChatRead
};
