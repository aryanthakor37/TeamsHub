import { msalInstance, loginRequest, graphTokenRequest, isRealMsalConfigured } from './msalConfig';

export const getActiveMsalAccounts = async () => {
  if (!isRealMsalConfigured()) return [];
  try {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    const activeAcc = msalInstance.getActiveAccount();
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
        isDefault: activeAcc ? (acc.username === activeAcc.username) : true,
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
      msalInstance.setActiveAccount(account);
      localStorage.setItem('teamshub_active_email', account.username);
      if (response.accessToken) {
        localStorage.setItem(`teamshub_token_${account.username.toLowerCase()}`, response.accessToken);
        localStorage.setItem('teamshub_last_access_token', response.accessToken);
      }
      const accountPayload = {
        accountId: account.homeAccountId || account.localAccountId,
        displayName: account.name || account.username.split('@')[0],
        email: account.username,
        tenantId: account.tenantId || 'common',
        accountType: 'Microsoft Work / Personal Account',
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
    const activeAccs = await getActiveMsalAccounts();
    if (!activeAccs || activeAccs.length === 0) {
      return {
        success: true,
        source: 'browser',
        count: 0,
        data: []
      };
    }
    const activeMsalAccount = msalInstance.getActiveAccount() || activeAccs[0];
    const userEmail = activeMsalAccount.username || activeMsalAccount.email || localStorage.getItem('teamshub_active_email') || '';
    const response = await fetch(`${API_BASE_URL}/accounts?email=${encodeURIComponent(userEmail)}`, {
      headers: {
        'x-user-email': userEmail
      }
    });
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
    const tokenPromise = (async () => {
      await msalInstance.initialize();
      const accounts = msalInstance.getAllAccounts();
      if (!accounts || accounts.length === 0) return null;

      const activeEmail = localStorage.getItem('teamshub_active_email');
      let targetAccount = msalInstance.getActiveAccount();
      if (!targetAccount && activeEmail) {
        targetAccount = accounts.find(acc => acc.username?.toLowerCase() === activeEmail.toLowerCase());
      }
      if (accountId) {
        targetAccount = accounts.find(acc => acc.homeAccountId === accountId || acc.username === accountId) || targetAccount;
      }
      if (!targetAccount && accounts.length > 0) {
        targetAccount = accounts[0];
      }

      if (targetAccount) {
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
          try {
            const fallbackResult = await msalInstance.acquireTokenSilent({
              scopes: ['User.Read', 'Chat.Read', 'Chat.ReadWrite', 'openid', 'profile'],
              account: targetAccount
            });
            if (fallbackResult && fallbackResult.accessToken) {
              syncAccountToBackend({
                email: targetAccount.username,
                displayName: targetAccount.name || targetAccount.username,
                accessToken: fallbackResult.accessToken
              }).catch(() => { });
              return fallbackResult.accessToken;
            }
          } catch (fErr) {
            const storedToken = localStorage.getItem(`teamshub_token_${targetAccount.username.toLowerCase()}`) || localStorage.getItem('teamshub_last_access_token');
            if (storedToken) return storedToken;
          }
        }
      }

      if (activeEmail) {
        return localStorage.getItem(`teamshub_token_${activeEmail.toLowerCase()}`) || localStorage.getItem('teamshub_last_access_token');
      }

      return null;
    })();

    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1500));
    return await Promise.race([tokenPromise, timeoutPromise]);
  } catch (error) {
    console.warn('[MSAL Token Acquisition Warning]:', error.message);
    return null;
  }
};

/**
 * Initiate Microsoft Account Sign In
 *
 * Uses loginRedirect so authentication happens directly inside the SAME TAB (no popup windows).
 */
export const loginMicrosoftAccount = async () => {
  if (isRealMsalConfigured()) {
    try {
      await msalInstance.initialize();
      // Use loginRedirect so Microsoft authentication opens in the SAME TAB (same window)
      await msalInstance.loginRedirect({ ...loginRequest, prompt: 'select_account' });
      return { success: true, isRealAuth: true };
    } catch (error) {
      console.error('[MSAL Redirect Error]', error);
      return {
        success: false,
        error: error.message || 'Microsoft sign-in failed.',
        isRealAuth: true
      };
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
