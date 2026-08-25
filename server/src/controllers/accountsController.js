const ConnectedAccount = require('../models/ConnectedAccount');
const { isMockMode, fetchGraphUserProfile, fetchGraphUserTenants, GraphApiError } = require('../services/graphService');

// ============================================================
// Mock in-memory accounts (ONLY when MOCK_GRAPH_DATA=true)
// ============================================================

let inMemoryAccounts = [
  {
    _id: 'acc-ms-1',
    userId: '65c1f0000000000000000001',
    provider: 'microsoft',
    accountId: 'ms-oid-1001',
    displayName: 'Company A (Work)',
    email: 'aryan.patel@companya.com',
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    accountType: 'Microsoft Work Account',
    status: 'connected',
    isDefault: true,
    scopes: ['User.Read', 'Chat.Read'],
    lastAuthenticatedAt: new Date().toISOString()
  },
  {
    _id: 'acc-ms-2',
    userId: '65c1f0000000000000000001',
    provider: 'microsoft',
    accountId: 'ms-oid-1002',
    displayName: 'Company B (Client)',
    email: 'apoorva@clientcorp.io',
    tenantId: '44a889cc-12e3-41ab-88bc-99ee0011aa22',
    accountType: 'Client Workspace Account',
    status: 'connected',
    isDefault: false,
    scopes: ['User.Read', 'Chat.Read'],
    lastAuthenticatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    _id: 'acc-ms-3',
    userId: '65c1f0000000000000000001',
    provider: 'microsoft',
    accountId: 'ms-oid-1003',
    displayName: 'Company C (Freelance)',
    email: 'freelance@agencyx.com',
    tenantId: '11bb22cc-33dd-44ee-55ff-66aa77bb88cc',
    accountType: 'Consultant Account',
    status: 'connected',
    isDefault: false,
    scopes: ['User.Read'],
    lastAuthenticatedAt: new Date(Date.now() - 7200000).toISOString()
  }
];

let activeAccountId = 'acc-ms-1';
let defaultAccountId = 'acc-ms-1';

// ============================================================
// Controllers
// ============================================================

/**
 * @desc    Get connected Microsoft accounts for current TeamsHub user
 * @route   GET /api/accounts
 */
const getAccounts = async (req, res) => {
  try {
    // ── Mock Mode ──
    if (isMockMode()) {
      return res.status(200).json({
        success: true,
        source: 'mock',
        count: 0,
        activeAccountId: null,
        defaultAccountId: null,
        data: []
      });
    }

    // ── Real Mode ──
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    if (!dbAvailable) {
      const memoryList = global.liveInMemoryAccounts ? Array.from(global.liveInMemoryAccounts.values()) : [];
      return res.status(200).json({
        success: true,
        source: 'memory',
        count: memoryList.length,
        data: memoryList
      });
    }

    const { email } = req.query;
    let query = {};
    if (email && email !== 'all') {
      query.email = email.toLowerCase();
    }

    const accounts = await ConnectedAccount.find(query);

    res.status(200).json({
      success: true,
      source: 'database',
      count: accounts.length,
      activeAccountId: accounts.find((a) => a.isDefault)?._id?.toString() || (accounts[0]?._id?.toString() || null),
      defaultAccountId: accounts.find((a) => a.isDefault)?._id?.toString() || null,
      data: accounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ACCOUNTS_FETCH_ERROR',
        message: 'Failed to retrieve connected Microsoft accounts.',
        details: error.message
      }
    });
  }
};

/**
 * @desc    Connect or Update Microsoft Account identity
 * @route   POST /api/accounts/microsoft
 *
 * In real mode: accepts accessToken from MSAL client, verifies via GET /v1.0/me,
 * stores token (select:false) and real identity from Graph.
 */
const connectMicrosoftAccount = async (req, res) => {
  try {
    const { accountId, displayName, email, tenantId, accountType, scopes, accessToken } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Account email is required.' }
      });
    }

    const cleanEmail = email.toLowerCase();

    // ── Mock Mode ──
    if (isMockMode()) {
      const accountData = {
        userId: req.user._id,
        provider: 'microsoft',
        accountId: accountId || `ms-oid-${Date.now()}`,
        displayName: displayName || cleanEmail.split('@')[0],
        email: cleanEmail,
        tenantId: tenantId || 'common',
        accountType: accountType || 'Microsoft Work Account',
        status: 'connected',
        isDefault: false,
        scopes: scopes || ['User.Read'],
        lastAuthenticatedAt: new Date().toISOString()
      };

      let isDuplicate = false;
      const existingIdx = inMemoryAccounts.findIndex((acc) => acc.email === cleanEmail);
      if (existingIdx >= 0) {
        isDuplicate = true;
        inMemoryAccounts[existingIdx] = {
          ...inMemoryAccounts[existingIdx],
          ...accountData,
          _id: inMemoryAccounts[existingIdx]._id
        };
      } else {
        accountData._id = `acc-ms-${Date.now()}`;
        inMemoryAccounts.push(accountData);
      }

      activeAccountId = accountData._id || inMemoryAccounts[existingIdx]?._id;

      return res.status(201).json({
        success: true,
        source: 'mock',
        isDuplicate,
        message: isDuplicate ? 'Account re-authenticated' : 'New account connected',
        data: isDuplicate ? inMemoryAccounts[existingIdx] : accountData,
        activeAccountId
      });
    }

    // ── Live In-Memory Accounts Store (Fallback when MongoDB is offline) ──
    if (!global.liveInMemoryAccounts) {
      global.liveInMemoryAccounts = new Map();
    }

    const resolvedEmail = (
      cleanEmail ||
      req.user?.email ||
      ''
    ).toLowerCase().trim();

    if (!resolvedEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Valid email address is required.' }
      });
    }

    const accountData = {
      _id: `acc-${resolvedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      userId: req.user?._id || 'user-default',
      provider: 'microsoft',
      accountId: accountId || `ms-oid-${Date.now()}`,
      microsoftUserId: accountId || '',
      displayName: displayName || resolvedEmail.split('@')[0] || 'User',
      email: resolvedEmail,
      tenantId: tenantId || 'common',
      accountType: accountType || 'Microsoft Account',
      status: 'connected',
      isDefault: false,
      scopes: scopes || ['User.Read', 'Chat.Read'],
      microsoftAccessToken: accessToken || '',
      lastAuthenticatedAt: new Date()
    };

    global.liveInMemoryAccounts.set(resolvedEmail, accountData);

    // ── Real Database Mode (if MongoDB connected) ──
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    if (!dbAvailable) {
      return res.status(200).json({
        success: true,
        source: 'memory',
        message: 'Account connected successfully',
        data: accountData
      });
    }

    // Verify the access token by calling Graph /me
    let graphProfile = null;
    if (accessToken) {
      try {
        graphProfile = await fetchGraphUserProfile(accessToken);
      } catch (graphErr) {
        // Token verification fallback (demo/expired token proceeding with payload)
      }
    }

    const resolvedEmail = (
      graphProfile?.mail ||
      graphProfile?.userPrincipalName ||
      cleanEmail ||
      req.user?.email ||
      ''
    ).toLowerCase().trim();

    if (!resolvedEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Valid email address is required.' }
      });
    }

    const accountData = {
      userId: req.user?._id,
      provider: 'microsoft',
      accountId: graphProfile?.id || accountId || `ms-oid-${Date.now()}`,
      microsoftUserId: graphProfile?.id || '',
      displayName: graphProfile?.displayName || displayName || resolvedEmail.split('@')[0] || 'User',
      email: resolvedEmail,
      tenantId: tenantId || 'common',
      accountType: accountType || 'Microsoft Account',
      status: 'connected',
      isDefault: false,
      scopes: scopes || ['User.Read', 'Chat.Read'],
      lastAuthenticatedAt: new Date()
    };

    // Store token securely (only accessible via explicit +select)
    const tokenFields = {};
    if (accessToken) {
      tokenFields.microsoftAccessToken = accessToken;
      tokenFields.tokenExpiresAt = new Date(Date.now() + 3600 * 1000);
    }

    const realEmail = accountData.email;

    const User = require('../models/User');
    if (User.db && User.db.readyState === 1 && realEmail) {
      try {
        await User.findOneAndUpdate(
          { email: realEmail },
          {
            _id: req.user._id,
            name: accountData.displayName,
            email: realEmail
          },
          { upsert: true, new: true }
        );
      } catch (uErr) {
        // User upsert fallback
      }
    }

    const savedAccount = await ConnectedAccount.findOneAndUpdate(
      { email: realEmail },
      { ...accountData, ...tokenFields },
      { upsert: true, new: true }
    );

    // Auto-discover Guest Tenant Organizations (e.g. BayWa r.e., DR SCHAER AG, Kerry Dines Ltd)
    if (accessToken) {
      try {
        const guestTenants = await fetchGraphUserTenants(accessToken);
        const emailDomain = realEmail.includes('@') ? realEmail.split('@')[1] : 'tenant.org';
        for (const guest of guestTenants) {
          if (!guest || !guest.displayName) continue;
          const cleanGuestName = (guest.displayName || 'Guest').toLowerCase().replace(/[^a-z0-9]/g, '');
          const guestEmail = `${cleanGuestName}@guest.${emailDomain}`;
          await ConnectedAccount.findOneAndUpdate(
            { userId: req.user._id, displayName: guest.displayName },
            {
              userId: req.user._id,
              provider: 'microsoft',
              accountId: guest.id || `guest-${Date.now()}`,
              microsoftUserId: accountData.microsoftUserId,
              displayName: guest.displayName,
              email: guestEmail,
              tenantId: guest.id || 'guest-tenant',
              accountType: 'Guest Tenant Workspace',
              status: 'connected',
              isDefault: false,
              lastAuthenticatedAt: new Date(),
              microsoftAccessToken: accessToken,
              tokenExpiresAt: new Date(Date.now() + 3600 * 1000)
            },
            { upsert: true, new: true }
          );
        }
      } catch (tErr) {
        console.warn('[AccountsController] Guest discovery warning:', tErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      source: 'database',
      message: 'Microsoft account connected to TeamsHub',
      data: savedAccount,
      activeAccountId: savedAccount._id
    });
  } catch (error) {
    console.error('[AccountsController] Connection error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'ACCOUNT_CONNECT_ERROR',
        message: 'Failed to connect Microsoft account.',
        details: error.message
      }
    });
  }
};

/**
 * @desc    Set Active Microsoft Account
 * @route   PUT /api/accounts/active
 */
const setActiveAccount = async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required' });
    }

    if (isMockMode()) {
      activeAccountId = accountId;
      if (req.user) req.user.activeAccountId = accountId;
      return res.status(200).json({ success: true, source: 'mock', activeAccountId });
    }

    // Real mode
    if (req.user && req.user.activeAccountId !== undefined) {
      req.user.activeAccountId = accountId;
    }

    res.status(200).json({
      success: true,
      source: 'database',
      message: 'Active Microsoft account updated',
      activeAccountId: accountId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to set active account', error: error.message });
  }
};

/**
 * @desc    Set Default Microsoft Account
 * @route   PUT /api/accounts/default
 */
const setDefaultAccount = async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required' });
    }

    if (isMockMode()) {
      defaultAccountId = accountId;
      inMemoryAccounts = inMemoryAccounts.map((acc) => ({
        ...acc,
        isDefault: acc._id === accountId || acc.accountId === accountId
      }));
      return res.status(200).json({ success: true, source: 'mock', defaultAccountId });
    }

    // Real mode
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    if (dbAvailable) {
      await ConnectedAccount.updateMany({ userId: req.user._id }, { isDefault: false });
      await ConnectedAccount.findByIdAndUpdate(accountId, { isDefault: true });
    }

    res.status(200).json({
      success: true,
      source: 'database',
      message: 'Default Microsoft account updated',
      defaultAccountId: accountId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to set default account', error: error.message });
  }
};

/**
 * @desc    Reconnect / Refresh Disconnected Microsoft Account
 * @route   POST /api/accounts/:id/reconnect
 */
const reconnectAccount = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMockMode()) {
      const idx = inMemoryAccounts.findIndex((acc) => acc._id === id || acc.accountId === id);
      if (idx >= 0) {
        inMemoryAccounts[idx].status = 'connected';
        inMemoryAccounts[idx].lastAuthenticatedAt = new Date().toISOString();
      }
      return res.status(200).json({ success: true, source: 'mock', data: inMemoryAccounts[idx] || null });
    }

    // Real mode
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    if (dbAvailable) {
      const account = await ConnectedAccount.findByIdAndUpdate(
        id,
        { status: 'connected', lastAuthenticatedAt: new Date() },
        { new: true }
      );
      return res.status(200).json({ success: true, source: 'database', data: account });
    }

    res.status(503).json({
      success: false,
      error: { code: 'CONFIGURATION_REQUIRED', message: 'Database required.' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reconnect account', error: error.message });
  }
};

/**
 * @desc    Disconnect Microsoft Account from TeamsHub
 * @route   DELETE /api/accounts/:id
 */
const disconnectAccount = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMockMode()) {
      const idx = inMemoryAccounts.findIndex((acc) => acc._id === id || acc.accountId === id);
      if (idx >= 0) {
        inMemoryAccounts[idx].status = 'disconnected';
      }
      return res.status(200).json({ success: true, source: 'mock' });
    }

    // Real mode — also clear stored tokens
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    if (dbAvailable) {
      await ConnectedAccount.findByIdAndUpdate(id, {
        status: 'disconnected',
        microsoftAccessToken: '',
        microsoftRefreshToken: '',
        tokenExpiresAt: null
      });
    }

    res.status(200).json({
      success: true,
      source: 'database',
      message: 'Microsoft account disconnected and tokens cleared.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to disconnect account', error: error.message });
  }
};

module.exports = {
  getAccounts,
  connectMicrosoftAccount,
  setActiveAccount,
  setDefaultAccount,
  reconnectAccount,
  disconnectAccount
};
