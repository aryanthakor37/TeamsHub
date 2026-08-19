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
  getDemoChatMessages
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

    // ── Real Mode: Find Token & Fetch Live Graph Chats ──
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    let accessToken = req.microsoftAccessToken;
    let userEmail = req.user?.email || '';
    let accountName = 'Microsoft Teams';

    // Strictly match token by current user's email or selected connectedAccountId
    if (!accessToken && dbAvailable) {
      let acc = null;
      if (connectedAccountId && connectedAccountId !== 'all') {
        if (mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt');
        } else {
          acc = await ConnectedAccount.findOne({ accountId: connectedAccountId }).select('+microsoftAccessToken +tokenExpiresAt');
        }
      }
      if (!acc && req.user?.email) {
        acc = await ConnectedAccount.findOne({
          email: req.user.email.toLowerCase()
        }).select('+microsoftAccessToken +tokenExpiresAt');
      }
      if (!acc) {
        acc = await ConnectedAccount.findOne({
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).sort({ updatedAt: -1 }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }
      if (acc && acc.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
        userEmail = acc.email || userEmail;
        accountName = acc.displayName || accountName;
      }
    }

    if (accessToken) {
      try {
        let currentUserInfo = {
          email: userEmail,
          displayName: accountName !== 'Microsoft Teams' ? accountName : (req.user?.name || req.user?.displayName || ''),
          id: ''
        };

        try {
          const profile = await fetchGraphUserProfile(accessToken);
          if (profile) {
            const rawTokenEmail = (profile.mail || profile.userPrincipalName || '').toLowerCase().trim();
            const rawExpectedEmail = (req.user?.email || '').toLowerCase().trim();
            const isFallbackEmail = !rawExpectedEmail || rawExpectedEmail.includes('teamshub.app') || rawExpectedEmail.includes('companya.com');

            const tokenPrefix = rawTokenEmail.split('@')[0].split('_')[0].split('#')[0];
            const expectedPrefix = rawExpectedEmail.split('@')[0].split('_')[0].split('#')[0];

            // Strict email match guard: Reject only if both are real emails with completely different prefixes (e.g. hem.shah vs aryankumar.kumrecha)
            if (!isFallbackEmail && tokenPrefix && expectedPrefix && tokenPrefix !== expectedPrefix) {
              console.warn(`[TeamsHub Guard] Access token email prefix (${tokenPrefix}) does not match active logged-in user (${expectedPrefix}). Rejecting token.`);
              accessToken = null;
            } else {
              if (profile.displayName) {
                accountName = profile.displayName;
              }
              currentUserInfo = {
                email: profile.mail || profile.userPrincipalName || currentUserInfo.email,
                displayName: profile.displayName || currentUserInfo.displayName,
                id: profile.id || ''
              };
            }
          }
        } catch (profileErr) {
          // Profile fallback on token expiry / demo token
        }

        if (!accessToken) {
          throw new Error('No valid access token available');
        }

        const graphResponse = await fetchGraphChatsFromAPI(accessToken);
        const rawChats = graphResponse.value || [];
        const normalizedList = rawChats.map((gc) =>
          normalizeGraphChat(gc, connectedAccountId || 'default', accountName, currentUserInfo)
        );

        // Ensure Self Chat (You) is ALWAYS present for the authenticated user
        const selfName = currentUserInfo.displayName || req.user?.name || 'You';
        const hasSelfChat = normalizedList.some(c => c.participant && (c.participant.includes('(You)') || c.participant.toLowerCase().includes('you')));

        if (!hasSelfChat && selfName) {
          const selfChatObj = {
            _id: `self-chat-${currentUserInfo.id || 'me'}`,
            connectedAccountId: connectedAccountId || 'default',
            microsoftChatId: `self-chat-${currentUserInfo.id || 'me'}`,
            participant: `${selfName} (You)`,
            role: 'Direct Message',
            company: accountName,
            accountBadge: accountName,
            chatType: 'oneOnOne',
            lastMessagePreview: 'Personal workspace & saved notes',
            lastMessageTimestamp: '2026-01-01T00:00:00.000Z',
            unreadCount: 0,
            onlineStatus: 'online',
            isSelfChat: true
          };
          normalizedList.unshift(selfChatObj);
        }

        // Sort latest first (keeping Self Chat at top if timestamps match)
        normalizedList.sort((a, b) => {
          if (a.isSelfChat) return -1;
          if (b.isSelfChat) return 1;
          const timeA = new Date(a.lastMessageTimestamp || 0).getTime();
          const timeB = new Date(b.lastMessageTimestamp || 0).getTime();
          return timeB - timeA;
        });

        // Strict filter: Ensure no chat has a mismatched company badge (e.g. Hem Shah chats in Aryan's session)
        const sanitizedList = normalizedList.filter(c => {
          if (c.company && accountName && accountName !== 'Microsoft Teams' && c.company !== accountName && c.company !== 'Microsoft Teams') {
            return false;
          }
          return true;
        });

        // Background update DB cache without blocking (wiping all old stale chats for this user & purging Hem Shah stale docs)
        if (dbAvailable) {
          await Chat.deleteMany({ company: 'Hem Shah' }).catch(() => {});

          Promise.all(sanitizedList.map(c => {
            const copy = { ...c, userId: req.user._id };
            delete copy._id;
            return Chat.findOneAndUpdate(
              { userId: req.user._id, microsoftChatId: c.microsoftChatId },
              copy,
              { upsert: true }
            );
          })).catch(() => {});
        }

        return res.status(200).json({
          success: true,
          source: 'graph',
          data: {
            items: sanitizedList,
            page: 1,
            limit: sanitizedList.length,
            total: sanitizedList.length,
            hasMore: !!graphResponse['@odata.nextLink']
          }
        });
      } catch (graphErr) {
        console.error('[TeamsHub getChats Graph Error]:', graphErr.message);
        if (dbAvailable && req.user?._id) {
          const cachedChats = await Chat.find({ userId: req.user._id }).sort({ lastMessageTimestamp: -1 });
          if (cachedChats.length > 0) {
            return res.status(200).json({
              success: true,
              source: 'cache',
              data: {
                items: cachedChats,
                page: 1,
                limit: cachedChats.length,
                total: cachedChats.length,
                hasMore: false
              }
            });
          }
        }
      }
    }

    // ── Unauthenticated / No Access Token: Return empty chats list ──
    return res.status(200).json({
      success: true,
      source: 'unauthenticated',
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

    // We intentionally bypass the cache early-return here for now
    // because without webhooks/socket.io, returning only the cache
    // prevents the user from seeing new incoming replies from Graph.
    
    // ── Real Mode: Token Lookup & Graph Call ──
    let accessToken = req.microsoftAccessToken;

    // Auto-save incoming token into ConnectedAccount for persistence
    if (accessToken && dbAvailable) {
      ConnectedAccount.updateOne(
        { userId: req.user._id },
        { microsoftAccessToken: accessToken, tokenExpiresAt: new Date(Date.now() + 3600 * 1000) }
      ).catch(e => console.warn('[Token Persistence Warning]', e.message));
    }



    if (accessToken) {
      // Need the microsoftChatId — look up from DB or use id directly
      let microsoftChatId = id;
      if (dbAvailable && /^[0-9a-fA-F]{24}$/.test(id)) {
        const chat = await Chat.findById(id);
        if (chat) microsoftChatId = chat.microsoftChatId;
      }

      try {
        const userProfile = await fetchGraphUserProfile(accessToken);
        const msEmail = userProfile.mail || userProfile.userPrincipalName || req.user.email || '';
        const msId = userProfile.id;

        const graphResponse = await fetchGraphChatMessages(accessToken, microsoftChatId);
        const messages = (graphResponse.value || [])
          .map((gm) => normalizeGraphMessage(gm, id, '', msEmail, msId))
          .filter(Boolean)
          .reverse(); // Reverse to chronological order (oldest top, newest bottom)

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
        // Fallback to cache or demo messages if Graph API call fails or token is expired/demo
      }
    }

    if (dbAvailable) {
      const cachedMessages = await Message.find({ $or: [{ chatId: id }, { microsoftMessageId: id }] }).sort({ createdDateTime: 1 });
      if (cachedMessages.length > 0) {
        return res.status(200).json({
          success: true,
          source: 'cache',
          data: {
            items: cachedMessages,
            page: 1,
            limit: cachedMessages.length,
            total: cachedMessages.length,
            hasMore: false
          }
        });
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

    if (!accessToken && dbAvailable) {
      const acc = await ConnectedAccount.findOne({ microsoftAccessToken: { $exists: true, $ne: '' } }).select('+microsoftAccessToken +tokenExpiresAt');
      if (acc && acc.microsoftAccessToken) {
        accessToken = acc.microsoftAccessToken;
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

        // Save to DB cache if available
        if (dbAvailable && normalizedMessage) {
          normalizedMessage.userId = req.user._id;
          await Message.create(normalizedMessage);
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

    if (dbAvailable) {
      const newMsg = await Message.create({
        chatId: id,
        microsoftMessageId: `msg-${Date.now()}`,
        senderName: req.user?.name || req.user?.displayName || 'Aryan Kumrecha',
        senderEmail: req.user?.email || 'aryan@companya.com',
        content: content.trim(),
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date().toISOString(),
        reactions: []
      });

      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        await Chat.findByIdAndUpdate(id, {
          lastMessagePreview: content.trim(),
          lastMessageTimestamp: new Date().toISOString()
        });
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`chat:${id}`).emit('new_message', newMsg);
      }

      return res.status(201).json({
        success: true,
        source: 'db',
        data: newMsg
      });
    }

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
    let accessToken = req.microsoftAccessToken;

    let microsoftChatId = id;
    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    if (dbAvailable) {
      let chat = null;
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        chat = await Chat.findById(id);
      } else {
        chat = await Chat.findOne({ microsoftChatId: id });
      }
      if (chat) {
        if (chat.microsoftChatId) microsoftChatId = chat.microsoftChatId;
        if (!accessToken && chat.connectedAccountId && chat.connectedAccountId !== 'all' && /^[0-9a-fA-F]{24}$/.test(chat.connectedAccountId)) {
          const account = await ConnectedAccount.findById(chat.connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt');
          if (account && account.microsoftAccessToken) {
            accessToken = account.microsoftAccessToken;
          }
        }
      }
    }

    if (!accessToken && req.query.token) {
      accessToken = req.query.token;
    }

    if (!accessToken && dbAvailable && req.user?._id) {
      const userAccount = await ConnectedAccount.findOne({
        userId: req.user._id,
        microsoftAccessToken: { $exists: true, $ne: '' }
      }).select('+microsoftAccessToken');
      if (userAccount && userAccount.microsoftAccessToken) {
        accessToken = userAccount.microsoftAccessToken;
      }
    }

    if (!accessToken) {
      return res.status(401).send('Microsoft access token required');
    }

    const decodedContentId = decodeURIComponent(contentId);
    const { buffer, contentType } = await fetchGraphMessageImage(
      accessToken,
      microsoftChatId,
      msgId,
      decodedContentId
    );

    res.set('Content-Type', contentType || 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=86400'); // Cache in browser for 24h
    return res.send(buffer);
  } catch (error) {
    console.error('[TeamsHub] Failed to proxy image:', error.message);
    return res.status(404).send('Image not found or access denied');
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
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_ACCOUNTS',
          message: 'No connected Microsoft accounts found. Please connect an account first.'
        }
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
          const normalized = normalizeGraphChat(gc, account._id.toString(), account.displayName, currentUserInfo);
          normalized.userId = req.user._id;
          delete normalized._id;

          await Chat.findOneAndUpdate(
            { userId: req.user._id, microsoftChatId: normalized.microsoftChatId },
            normalized,
            { upsert: true, new: true }
          );
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
    const { id } = req.params;
    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    if (dbAvailable) {
      await Chat.updateMany(
        { 
          userId: req.user._id, 
          $or: [
            { microsoftChatId: id },
            /^[0-9a-fA-F]{24}$/.test(id) ? { _id: id } : { microsoftChatId: id }
          ] 
        },
        { $set: { unreadCount: 0 } }
      );
    }
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
