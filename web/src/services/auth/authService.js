import { msalInstance, loginRequest, graphTokenRequest, isRealMsalConfigured } from './msalConfig';

export const getActiveMsalAccounts = async () => {
  if (!isRealMsalConfigured()) return [];
  try {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    const activeAcc = msalInstance.getActiveAccount();
    
    let disconnectedList = [];
    try {
      disconnectedList = JSON.parse(localStorage.getItem('teamshub_disconnected_emails') || '[]');
    } catch (e) {}

    const list = [];
    for (const acc of accounts) {
      const email = (acc.username || '').toLowerCase().trim();
      if (!email || disconnectedList.includes(email)) continue; // Never restore disconnected accounts on refresh!

      const token = await acquireGraphToken(acc.homeAccountId || acc.username);
      const actualTenantId = acc.tenantId || '41f9d7c7-4e78-4c29-b30d-423f638ea43e';
      
      list.push({
        _id: acc.homeAccountId || acc.localAccountId,
        accountId: acc.homeAccountId || acc.localAccountId,
        displayName: acc.name || (email ? email.split('@')[0] : 'Microsoft User'),
        email: acc.username,
        tenantId: actualTenantId,
        accountType: 'Microsoft Work / Personal Account',
        status: 'connected',
        isDefault: activeAcc ? (acc.username === activeAcc.username) : true,
        accessToken: token || localStorage.getItem(`teamshub_token_${email}`) || localStorage.getItem('teamshub_last_access_token') || '',
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

      // Re-enable account if it was previously disconnected
      const loggedInEmail = (account.username || '').toLowerCase().trim();
      if (loggedInEmail) {
        try {
          let disconnectedList = JSON.parse(localStorage.getItem('teamshub_disconnected_emails') || '[]');
          disconnectedList = disconnectedList.filter(e => e.toLowerCase() !== loggedInEmail);
          localStorage.setItem('teamshub_disconnected_emails', JSON.stringify(disconnectedList));
        } catch (e) {}
      }

      // HARDCODE ESTATIC INFOTECH Tenant ID to guarantee guest accounts get the correct token
      const actualTenantId = '41f9d7c7-4e78-4c29-b30d-423f638ea43e';
      
      const accountPayload = {
        accountId: account.homeAccountId || account.localAccountId,
        displayName: account.name || account.username.split('@')[0],
        email: account.username,
        tenantId: actualTenantId,
        accountType: 'Microsoft Work / Personal Account',
        scopes: response.scopes || ['User.Read', 'Chat.Read'],
        accessToken: response.accessToken
      };
      await syncAccountToBackend(accountPayload);
    } else {
      // Sync only the active NON-disconnected MSAL accounts
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
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://teamshub-api.onrender.com/api' : '/api');

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
    const activeMsalAccount = msalInstance.getActiveAccount() || (activeAccs && activeAccs.length > 0 ? activeAccs[0] : null);
    const userEmail = activeMsalAccount?.username || activeMsalAccount?.email || localStorage.getItem('teamshub_active_email') || '';
    const response = await fetch(`${API_BASE_URL}/accounts`, {
      headers: userEmail ? { 'x-user-email': userEmail } : {}
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
 * Acquire fresh Microsoft Graph access tokens for all active MSAL accounts
 */
export const syncAllAccountsTokens = async () => {
  if (!isRealMsalConfigured()) return {};
  try {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    let disconnectedList = [];
    try {
      disconnectedList = JSON.parse(localStorage.getItem('teamshub_disconnected_emails') || '[]');
    } catch (e) {}

    const tokenMap = {};
    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const email = (acc.username || '').toLowerCase().trim();
          if (!email || disconnectedList.includes(email)) return;
          const token = await acquireGraphToken(acc.homeAccountId || acc.username);
          if (token) {
            tokenMap[email] = token;
            localStorage.setItem(`teamshub_token_${email}`, token);
            syncAccountToBackend({
              accountId: acc.homeAccountId || acc.localAccountId,
              displayName: acc.name || email.split('@')[0],
              email: acc.username,
              accessToken: token
            }).catch(() => {});
          } else {
            const fallback = localStorage.getItem(`teamshub_token_${email}`);
            if (fallback) {
              tokenMap[email] = fallback;
            }
          }
        } catch (err) {}
      })
    );
    return tokenMap;
  } catch (e) {
    return {};
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
    const accounts = msalInstance.getAllAccounts() || [];
    if (!accounts || accounts.length === 0) return null;

    const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();
    let targetAccount = null;

    if (accountId) {
      const cleanTarget = accountId.toString().toLowerCase().trim();
      targetAccount = accounts.find(acc =>
        (acc.username && acc.username.toLowerCase() === cleanTarget) ||
        (acc.homeAccountId && acc.homeAccountId.toLowerCase() === cleanTarget) ||
        (acc.localAccountId && acc.localAccountId.toLowerCase() === cleanTarget) ||
        (acc.name && acc.name.toLowerCase() === cleanTarget) ||
        (acc.username && (acc.username.toLowerCase().includes(cleanTarget) || cleanTarget.includes(acc.username.toLowerCase())))
      );
    }

    if (!targetAccount && activeEmail) {
      targetAccount = accounts.find(acc => acc.username?.toLowerCase() === activeEmail);
    }
    if (!targetAccount) {
      targetAccount = msalInstance.getActiveAccount() || accounts[0];
    }

    if (targetAccount) {
      const emailLower = (targetAccount.username || '').toLowerCase().trim();
      const storedToken = localStorage.getItem(`teamshub_token_${emailLower}`);

      // If we already have stored token for this account, return immediately
      if (storedToken) {
        return storedToken;
      }

      // Silent acquisition with loginHint to avoid multi-account iframe mismatch
      try {
        const result = await msalInstance.acquireTokenSilent({
          ...graphTokenRequest,
          account: targetAccount,
          loginHint: targetAccount.username
        });
        if (result && result.accessToken) {
          localStorage.setItem(`teamshub_token_${emailLower}`, result.accessToken);
          return result.accessToken;
        }
      } catch (silentErr) {
        console.warn(`[acquireGraphToken] Silent refresh notice for ${emailLower}:`, silentErr?.message || 'Silent request');
      }

      return storedToken || null;
    }

    return null;
  } catch (error) {
    if (accountId) {
      const cleanTarget = accountId.toString().toLowerCase().trim();
      return localStorage.getItem(`teamshub_token_${cleanTarget}`) || null;
    }
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
