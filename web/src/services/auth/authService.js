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
    } catch (e) { }

    const validAccounts = accounts.filter(acc => {
      const email = (acc.username || '').toLowerCase().trim();
      return email && !disconnectedList.includes(email);
    });

    const list = await Promise.all(
      validAccounts.map(async (acc) => {
        const email = (acc.username || '').toLowerCase().trim();
        const token = await acquireGraphToken(acc.homeAccountId || acc.username).catch(() => null);
        const actualTenantId = acc.tenantId || '41f9d7c7-4e78-4c29-b30d-423f638ea43e';

        return {
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
        };
      })
    );

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
        } catch (e) { }
      }

      // Determine actual tenant ID (supporting Guest Tenant logins)
      const pendingOrg = localStorage.getItem('teamshub_pending_guest_org');
      const pendingTenant = localStorage.getItem('teamshub_pending_guest_tenant');
      localStorage.removeItem('teamshub_pending_guest_org');
      localStorage.removeItem('teamshub_pending_guest_tenant');

      const actualTenantId = pendingTenant || account.tenantId || '41f9d7c7-4e78-4c29-b30d-423f638ea43e';
      const cleanEmail = (account.username || '').toLowerCase().trim();
      const uniqueSuffix = pendingOrg ? `_${pendingOrg.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : '';
      const uniqueAccountId = `acc-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}${uniqueSuffix}`;

      if (response.accessToken) {
        localStorage.setItem(`teamshub_token_${uniqueAccountId}`, response.accessToken);
        localStorage.setItem(`teamshub_token_${cleanEmail}${uniqueSuffix}`, response.accessToken);
        localStorage.setItem(`teamshub_token_${cleanEmail}`, response.accessToken);
        localStorage.setItem('teamshub_last_access_token', response.accessToken);
      }

      const accountPayload = {
        _id: uniqueAccountId,
        accountId: uniqueAccountId,
        displayName: pendingOrg ? `${account.name || cleanEmail.split('@')[0]} (${pendingOrg})` : (account.name || cleanEmail.split('@')[0]),
        email: cleanEmail,
        tenantId: actualTenantId,
        company: pendingOrg || 'ESTATIC INFOTECH',
        accountType: pendingOrg ? `Guest Organization (${pendingOrg})` : 'Microsoft Work Account',
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
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://teamshub-wkd3.onrender.com/api' : '/api');

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
    } catch (e) { }

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
          } else {
            const fallback = localStorage.getItem(`teamshub_token_${email}`);
            if (fallback) {
              tokenMap[email] = fallback;
            }
          }
        } catch (err) { }
      })
    );
    return tokenMap;
  } catch (e) {
    return {};
  }
};

/**
 * Helper to check if a JWT access token is expired or close to expiry (within 60s)
 */
export const isTokenExpired = (tokenStr) => {
  if (!tokenStr || typeof tokenStr !== 'string') return true;
  try {
    const parts = tokenStr.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    return (payload.exp * 1000) < (Date.now() + 60000);
  } catch (e) {
    return true;
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

      // If stored token exists AND is NOT expired, return immediately
      if (storedToken && !isTokenExpired(storedToken)) {
        return storedToken;
      }

      // Token is missing or expired — acquire a fresh token silently
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

      if (storedToken && !isTokenExpired(storedToken)) {
        return storedToken;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Initiate Microsoft Account Sign In
 *
 * Uses loginRedirect so authentication happens directly inside the SAME TAB (no popup windows).
 */
export const loginMicrosoftAccount = async (options = {}) => {
  if (isRealMsalConfigured()) {
    try {
      await msalInstance.initialize();
      const { guestTenantId, guestOrgName, loginHint } = options || {};

      if (guestOrgName) {
        localStorage.setItem('teamshub_pending_guest_org', guestOrgName);
      }
      if (guestTenantId) {
        localStorage.setItem('teamshub_pending_guest_tenant', guestTenantId);
      }

      const authority = guestTenantId
        ? `https://login.microsoftonline.com/${guestTenantId}`
        : `https://login.microsoftonline.com/common`;

      const requestConfig = {
        ...loginRequest,
        authority,
        prompt: 'select_account'
      };

      if (loginHint) {
        requestConfig.loginHint = loginHint;
      }

      // Use loginRedirect so Microsoft authentication opens in the SAME TAB
      await msalInstance.loginRedirect(requestConfig);
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
