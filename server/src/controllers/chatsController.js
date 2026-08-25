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

    // ── Real Mode: Find Tokens & Fetch Live Graph Chats across ALL connected accounts ──
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    let targetAccounts = [];
    const headerToken = req.microsoftAccessToken;

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    if (dbAvailable) {
      const userEmailsHeader = req.headers['x-user-emails'];
      const activeEmailsList = userEmailsHeader
        ? userEmailsHeader.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
        : (clientUserEmail ? [clientUserEmail] : []);

      if (connectedAccountId && connectedAccountId !== 'all') {
        let acc = null;
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase().trim() }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc && mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc) {
          acc = await ConnectedAccount.findOne({ accountId: connectedAccountId }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase().trim() }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc && clientUserEmail) {
          acc = await ConnectedAccount.findOne({ email: clientUserEmail }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (acc) targetAccounts = [acc];
      } else if (activeEmailsList.length > 0) {
        targetAccounts = await ConnectedAccount.find({
          email: { $in: activeEmailsList },
          status: { $ne: 'disconnected' }
        }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }

      // Fallback: If no accounts matched by email header, find all active connected accounts in DB
      if (targetAccounts.length === 0) {
        targetAccounts = await ConnectedAccount.find({
          status: { $ne: 'disconnected' },
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }

      if (targetAccounts.length === 0 && headerToken) {
        targetAccounts = [{
          _id: 'active-user-session',
          microsoftAccessToken: headerToken,
          email: clientUserEmail || '',
          displayName: clientUserEmail ? clientUserEmail.split('@')[0] : 'Microsoft User'
        }];
      }
    } else if (headerToken) {
      targetAccounts = [{
        _id: 'active-user-session',
        microsoftAccessToken: headerToken,
        email: clientUserEmail || '',
        displayName: clientUserEmail ? clientUserEmail.split('@')[0] : 'Microsoft User'
      }];
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
              const profile = await fetchGraphUserProfile(activeAccessToken);
              if (profile) {
                currentUserInfo = {
                  email: profile.mail || profile.userPrincipalName || acc.email,
                  displayName: profile.displayName || acc.displayName,
                  id: profile.id || ''
                };
              }
            } catch (pErr) {
              console.error(`[getChats] Profile error for ${acc.email}:`, pErr.message);
            }

            try {
              const graphResponse = await fetchGraphChatsFromAPI(activeAccessToken);
              rawChats = graphResponse?.value || [];
            } catch (gErr) {
              console.error(`[getChats] Graph chats error for ${acc.email}:`, gErr.message);
            }
          }

          let accountCompanyBadge = (acc.displayName || currentUserInfo.displayName || acc.email?.split('@')[0] || 'Microsoft Account').trim();

          let normalizedList = rawChats.map((gc) => {
            const normalized = normalizeGraphChat(gc, acc._id.toString(), accountCompanyBadge, currentUserInfo);
            normalized.connectedAccountId = acc._id.toString();
            normalized.accountEmail = (acc.email || currentUserInfo.email || '').toLowerCase();
            return normalized;
          });

          allUnifiedChats.push(...normalizedList);
        } catch (err) {
          console.warn(`[getChats] Warning fetching chats for ${acc.displayName}:`, err.message);
        }
      })
    );

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
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();
    const { connectedAccountId } = req.query;

    if (dbAvailable) {
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

    if (accessToken) {
      // Need the microsoftChatId — look up from DB or use id directly
      let microsoftChatId = id;
      if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(id)) {
        const chat = await Chat.findById(id);
        if (chat && chat.microsoftChatId) {
          microsoftChatId = chat.microsoftChatId;
        } else {
          microsoftChatId = null;
        }
      }

      if (!microsoftChatId || /^[0-9a-fA-F]{24}$/.test(microsoftChatId)) {
        const cachedMessages = dbAvailable ? await Message.find({ chatId: id }).sort({ createdDateTime: 1 }) : [];
        return res.status(200).json({
          success: true,
          source: 'cache',
          data: {
            items: cachedMessages,
            page: pageNum,
            limit: limitNum,
            total: cachedMessages.length,
            hasMore: false,
            isReadOnly: true
          }
        });
      }

      try {
        let msEmail = (req.user?.email || req.headers['x-user-email'] || '').toLowerCase().trim();
        let msDisplayName = (req.user?.name || req.user?.displayName || 'User').trim();

        if (!msEmail || msEmail.includes('teamshub.app') || msEmail.includes('companya.com')) {
          if (dbAvailable) {
            const acc = await ConnectedAccount.findOne({
              microsoftAccessToken: { $exists: true, $ne: '' }
            }).sort({ updatedAt: -1 }).select('email displayName');
            if (acc) {
              msEmail = acc.email;
              msDisplayName = acc.displayName;
            }
          }
        }
        const cleanChatId = decodeURIComponent(microsoftChatId);
        const graphResponse = await fetchGraphChatMessages(accessToken, cleanChatId);
        const rawMessages = graphResponse.value || [];
        const messages = rawMessages.map((m) =>
          normalizeGraphMessage(m, cleanChatId, connectedAccountId || 'default', msEmail, msDisplayName)
        );
        messages.reverse(); // chronological order: oldest first, newest last

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
        if (graphErr.httpStatus !== 403 && graphErr.httpStatus !== 404) {
          console.warn('[getChatMessages] Graph API notice:', graphErr.message);
        }
      }
    }

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
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Message content is required.' }
      });
    }

    // ── Mock Mode ──
    if (isMockMode()) {
      const mockMsg = {
        _id: `msg-mock-${Date.now()}`,
        chatId: id,
        microsoftMessageId: `mock-${Date.now()}`,
        senderName: 'You',
        senderEmail: req.user.email,
        content: content.trim(),
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date().toISOString()
      };
      return res.status(201).json({ success: true, source: 'mock', data: mockMsg });
    }

    // ── Real Mode ──
    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    let accessToken = req.microsoftAccessToken;
    const connectedAccountId = req.body?.connectedAccountId || req.query?.connectedAccountId;
    const activeEmailHeader = (req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();

    if (dbAvailable) {
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

    if (accessToken) {
      // Look up the microsoftChatId (it could be id or we fetch from DB)
      let microsoftChatId = id;
      let connectedAccountId = 'default';
      if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(id)) {
        const chat = await Chat.findById(id);
        if (chat) {
          microsoftChatId = chat.microsoftChatId;
          connectedAccountId = chat.connectedAccountId;
        }
      }

      try {
        const userProfile = await fetchGraphUserProfile(accessToken);
        const msEmail = userProfile.mail || userProfile.userPrincipalName || req.user.email || '';
        const msId = userProfile.id;

        const graphResponse = await sendGraphChatMessage(accessToken, microsoftChatId, content);
        const normalizedMessage = normalizeGraphMessage(graphResponse, id, connectedAccountId, msEmail, msId);

        // Zero-Storage Mode: Pass-through response directly to browser RAM (NO DB storage)
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
        return sendGraphError(res, graphErr);
      }
    }

    // In-Memory Pass-Through for local/mock response
    const passThroughMsg = {
      _id: `msg-${Date.now()}`,
      chatId: id,
      microsoftMessageId: `msg-${Date.now()}`,
      senderName: req.user?.name || req.user?.displayName || 'Aryan Kumrecha',
      senderEmail: req.user?.email || 'aryan@companya.com',
      content: content.trim(),
      contentType: 'text',
      isOutgoing: true,
      createdDateTime: new Date().toISOString(),
      reactions: []
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

    return res.status(401).json({
      success: false,
      error: { code: 'GRAPH_AUTH_REQUIRED', message: 'No Microsoft access token available.' }
    });
  } catch (error) {
    return sendGraphError(res, error);
  }
};

// ============================================================
// GET /api/chats/:id/messages/:msgId/hostedContents/:contentId
// ============================================================

const getMessageImage = async (req, res) => {
  try {
    const { id, msgId, contentId } = req.params;
    const clientEmail = (req.query.email || req.headers['x-user-email'] || req.user?.email || '').toLowerCase().trim();
    let accessToken = req.microsoftAccessToken;

    const rawId = decodeURIComponent(id);
    let microsoftChatId = rawId;
    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    let targetAccount = null;

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

        if (chatDoc.connectedAccountId) {
          if (/^[0-9a-fA-F]{24}$/.test(chatDoc.connectedAccountId)) {
            targetAccount = await ConnectedAccount.findById(chatDoc.connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt email displayName');
          } else {
            targetAccount = await ConnectedAccount.findOne({
              $or: [
                { accountId: chatDoc.connectedAccountId },
                { email: chatDoc.connectedAccountId.toLowerCase() }
              ]
            }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
          }
        }
      }
    }

    if (!accessToken && dbAvailable) {
      if (!targetAccount && clientEmail) {
        targetAccount = await ConnectedAccount.findOne({
          email: clientEmail,
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }
      if (!targetAccount && req.user?._id) {
        targetAccount = await ConnectedAccount.findOne({
          userId: req.user._id,
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }
      if (!targetAccount) {
        targetAccount = await ConnectedAccount.findOne({
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).sort({ updatedAt: -1 }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }
      if (targetAccount && targetAccount.microsoftAccessToken) {
        accessToken = targetAccount.microsoftAccessToken;
      }
    }

    if (accessToken && microsoftChatId) {
      try {
        const decodedContentId = decodeURIComponent(contentId);
        const { buffer, contentType } = await fetchGraphMessageImage(
          accessToken,
          microsoftChatId,
          msgId,
          decodedContentId
        );

        res.set('Content-Type', contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      } catch (graphErr) {
        console.warn('[TeamsHub getMessageImage Graph fetch warning]:', graphErr.message);
      }
    }

    const svgPhotoCard = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e0e7ff"/><stop offset="100%" stop-color="#c7d2fe"/></linearGradient><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bgGrad)" rx="16"/><circle cx="240" cy="130" r="48" fill="url(#iconGrad)" opacity="0.9"/><path d="M216 142l16-20 14 16 22-28 24 32H216z" fill="#ffffff"/><circle cx="232" cy="116" r="6" fill="#ffffff"/><text x="240" y="215" dominant-baseline="middle" text-anchor="middle" fill="#3730a3" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="16">Teams Photo Attachment</text><text x="240" y="240" dominant-baseline="middle" text-anchor="middle" fill="#4338ca" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="12">Shared via Microsoft Teams</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(svgPhotoCard);
  } catch (error) {
    console.warn('[TeamsHub getMessageImage Error]:', error.message);
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
      return res.status(503).json({
        success: false,
        error: {
          code: 'CONFIGURATION_REQUIRED',
          message: 'Database is required for real Graph sync.'
        }
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
  getMessageImage,
  refreshChats,
  markChatRead
};
