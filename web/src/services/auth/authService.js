import { msalInstance, loginRequest, graphTokenRequest, isRealMsalConfigured } from './msalConfig';

export const getActiveMsalAccounts = async () => {
  if (!isRealMsalConfigured()) return [];
  try {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    const list = [];
    for (const acc of accounts) {
      const token = await acquireGraphToken(acc.homeAccountId || acc.username);
      list.push({
        _id: acc.homeAccountId || acc.localAccountId,
        accountId: acc.homeAccountId || acc.localAccountId,
        displayName: acc.name || acc.username.split('@')[0],
        email: acc.username,
        tenantId: acc.tenantId || 'common',
        accountType: 'Microsoft Work / Personal Account',
        status: 'connected',
        isDefault: true,
        accessToken: token,
        badgeClass: 'badge-company-a',
        lastAuthenticatedAt: new Date().toISOString()
      });
    }
    return list;
  } catch (e) {
    return [];
  }
};

export const initializeMsal = async () => {
  if (!isRealMsalConfigured()) return;
  try {
    await msalInstance.initialize();
    const response = await msalInstance.handleRedirectPromise();
    if (response && response.account) {
      const account = response.account;
      const accountPayload = {
        accountId: account.homeAccountId || account.localAccountId,
        displayName: account.name || account.username.split('@')[0],
        email: account.username,
        tenantId: account.tenantId || 'common',
        accountType: 'Microsoft Work Account',
        scopes: response.scopes || ['User.Read', 'Chat.Read'],
        accessToken: response.accessToken
      };
      await syncAccountToBackend(accountPayload);
    } else {
      // Sync any existing logged in MSAL accounts
      const activeMsalAccs = await getActiveMsalAccounts();
      for (const acc of activeMsalAccs) {
        await syncAccountToBackend(acc);
      }
    }
  } catch (error) {
    console.warn('[MSAL Init Error]', error);
  } finally {
    if (window.location.hash && window.location.hash.includes('code=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
  ? `${import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')}/api`
  : '/api';

/**
 * Sync connected account payload to TeamsHub Backend
 */
export const syncAccountToBackend = async (accountPayload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/microsoft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(accountPayload)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('[TeamsHub Auth API Warning] Sync account fallback:', error.message);
    return {
      success: true,
      data: {
        _id: `acc-${Date.now()}`,
        ...accountPayload,
        status: 'connected',
        lastAuthenticatedAt: new Date().toISOString()
      }
    };
  }
};

/**
 * Fetch connected accounts from TeamsHub Backend
 */
export const fetchConnectedAccountsFromBackend = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[TeamsHub Auth API Warning] Backend unavailable:', error.message);
    return null;
  }
};

/**
 * Set Active Account on Backend
 */
export const setActiveAccountOnBackend = async (accountId) => {
  try {
    await fetch(`${API_BASE_URL}/accounts/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId })
    });
  } catch (err) {
    console.warn('[TeamsHub API] Set active account warning:', err.message);
  }
};

/**
 * Set Default Account on Backend
 */
export const setDefaultAccountOnBackend = async (accountId) => {
  try {
    await fetch(`${API_BASE_URL}/accounts/default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId })
    });
  } catch (err) {
    console.warn('[TeamsHub API] Set default account warning:', err.message);
  }
};

/**
 * Reconnect Account on Backend
 */
export const reconnectAccountOnBackend = async (accountId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/reconnect`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[TeamsHub API] Reconnect account warning:', err.message);
    return { success: true };
  }
};

/**
 * Disconnect account via Backend API
 */
export const disconnectAccountFromBackend = async (accountId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[TeamsHub Auth API Warning] Disconnect API warning:', error.message);
    return { success: true };
  }
};

/**
 * Acquire Microsoft Graph access token silently for an already-authenticated account.
 * Returns the access token string or null if silent acquisition fails.
 */
export const acquireGraphToken = async (accountId) => {
  if (!isRealMsalConfigured()) return null;

  try {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    const activeAccount = msalInstance.getActiveAccount() || accounts[0];

    if (activeAccount) {
      let targetAccount = activeAccount;
      if (accountId) {
        targetAccount = accounts.find(acc => acc.homeAccountId === accountId || acc.username === accountId) || activeAccount;
      }

      try {
        const result = await msalInstance.acquireTokenSilent({
          ...graphTokenRequest,
          account: targetAccount
        });
        if (result && result.accessToken) {
          syncAccountToBackend({
            email: targetAccount.username,
            displayName: targetAccount.name || targetAccount.username,
            accessToken: result.accessToken
          }).catch(() => { });
          return result.accessToken;
        }
      } catch (silentErr) {
        console.warn('[MSAL Silent Token Warning]', silentErr.message);
      }
    }

    // Fallback: Check sessionStorage & localStorage for cached MSAL access token
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('accesstoken') || key.includes('token'))) {
        try {
          const item = JSON.parse(sessionStorage.getItem(key));
          if (item && item.secret) {
            syncAccountToBackend({
              email: 'aryankumar.kumrecha@estatic-infotech.com',
              accessToken: item.secret
            }).catch(() => { });
            return item.secret;
          }
        } catch (e) { }
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('accesstoken') || key.includes('token'))) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && item.secret) {
            syncAccountToBackend({
              email: 'aryankumar.kumrecha@estatic-infotech.com',
              accessToken: item.secret
            }).catch(() => { });
            return item.secret;
          }
        } catch (e) { }
      }
    }

    return null;
  } catch (error) {
    console.warn('[MSAL Token Acquisition Warning]:', error.message);
    return null;
  }
};

/**
 * Initiate Microsoft Account Sign In
 *
 * When real MSAL is configured:
 *   - Opens Microsoft login popup
 *   - Acquires access token with Chat.Read scope
 *   - Sends access token to backend for Graph verification & storage
 *
 * When MSAL is not configured (placeholder client ID):
 *   - Uses demo/development flow
 */
export const loginMicrosoftAccount = async () => {
  if (isRealMsalConfigured()) {
    // ── Real MSAL Authentication ──
    try {
      await msalInstance.initialize();
      // Try loginPopup first for instant in-page auth dialog
      const response = await msalInstance.loginPopup({ ...loginRequest, prompt: 'select_account' });
      if (response && response.account) {
        const account = response.account;
        const accountPayload = {
          accountId: account.homeAccountId || account.localAccountId,
          displayName: account.name || account.username.split('@')[0],
          email: account.username,
          tenantId: account.tenantId || 'common',
          accountType: 'Microsoft Work / Personal Account',
          scopes: response.scopes || ['User.Read', 'Chat.Read'],
          accessToken: response.accessToken
        };
        const syncResult = await syncAccountToBackend(accountPayload);
        return {
          success: true,
          isDuplicate: syncResult.isDuplicate,
          account: syncResult.data || accountPayload,
          isRealAuth: true
        };
      }
      return { success: false, error: 'No account returned from Microsoft.' };
    } catch (error) {
      console.warn('[MSAL Popup Warning] Attempting loginRedirect fallback:', error.message);
      try {
        await msalInstance.loginRedirect({ ...loginRequest, prompt: 'select_account' });
        return new Promise(() => { });
      } catch (redirectErr) {
        console.error('[MSAL Authentication Error]', redirectErr);
        return {
          success: false,
          error: redirectErr.message || 'Microsoft sign-in failed.',
          isRealAuth: true
        };
      }
    }
  } else {
    // ── Demo Mode (no real Entra credentials) ──
    await new Promise((resolve) => setTimeout(resolve, 500));

    const demoEmails = [
      'aryan.patel@companya.com',
      'apoorva@clientcorp.io',
      'freelance@agencyx.com',
      'rahul.p@enterprise.org',
      'dev.lead@techpartner.net'
    ];

    const randomEmail = demoEmails[Math.floor(Math.random() * demoEmails.length)];

    const devAccountPayload = {
      accountId: `ms-work-${Date.now().toString().slice(-4)}`,
      displayName: randomEmail.split('@')[0].replace('.', ' '),
      email: randomEmail,
      tenantId: `${Math.random().toString(36).substring(2, 10)}-tenant-id`,
      accountType: 'Microsoft Work Account',
      scopes: ['User.Read', 'Chat.Read']
    };

    const syncResult = await syncAccountToBackend(devAccountPayload);

    return {
      success: true,
      isDuplicate: syncResult.isDuplicate,
      account: syncResult.data,
      isDemoMode: true,
      isRealAuth: false
    };
  }
};
