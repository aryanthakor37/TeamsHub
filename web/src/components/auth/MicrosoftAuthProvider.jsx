import React, { createContext, useState, useEffect } from 'react';
import {
  loginMicrosoftAccount,
  fetchConnectedAccountsFromBackend,
  setActiveAccountOnBackend,
  setDefaultAccountOnBackend,
  reconnectAccountOnBackend,
  disconnectAccountFromBackend,
  initializeMsal,
  getActiveMsalAccounts,
  syncAccountToBackend
} from '../../services/auth/authService';
import { msalInstance } from '../../services/auth/msalConfig';

export const AuthContext = createContext({
  user: null,
  connectedAccounts: [],
  activeAccount: null,
  defaultAccountId: null,
  authState: 'LOADING',
  authError: null,
  loginWithMicrosoft: async () => { },
  logout: () => { },
  setActiveAccount: async () => { },
  setDefaultAccount: async () => { },
  reconnectAccount: async () => { },
  disconnectAccount: async () => { }
});

export const MicrosoftAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  const [activeAccount, setActiveAccountState] = useState(null);
  const [defaultAccountId, setDefaultAccountIdState] = useState(null);
  const [authState, setAuthState] = useState('AUTHENTICATED');
  const [authError, setAuthError] = useState(null);

  // Initialize & sync connected accounts from current browser MSAL session on mount
  useEffect(() => {
    const initAuth = async () => {
      setAuthState('LOADING');
      await initializeMsal();
      
      const msalAccs = await getActiveMsalAccounts();

      if (!msalAccs || msalAccs.length === 0) {
        setConnectedAccounts([]);
        setActiveAccountState(null);
        setDefaultAccountIdState(null);
        setUser(null);
        localStorage.removeItem('teamshub_active_email');
        localStorage.removeItem('teamshub_cached_chats');
        setAuthState('AUTHENTICATED');
        return;
      }

      // Sync only the active MSAL accounts in this browser to backend DB and load them
      const currentSessionAccounts = [];
      for (const msalAcc of msalAccs) {
        const synced = await syncAccountToBackend(msalAcc).catch(() => null);
        currentSessionAccounts.push(synced?.data || msalAcc);
      }

      setConnectedAccounts(currentSessionAccounts);
      const activeEmail = localStorage.getItem('teamshub_active_email');
      const matchedActive = currentSessionAccounts.find(a => a.email?.toLowerCase() === activeEmail?.toLowerCase());
      const chosenActive = matchedActive || currentSessionAccounts[0];
      setActiveAccountState(chosenActive);
      if (chosenActive?.email) {
        localStorage.setItem('teamshub_active_email', chosenActive.email);
      }
      setDefaultAccountIdState(chosenActive?._id || chosenActive?.accountId);
      setUser({
        name: chosenActive?.displayName || chosenActive?.email?.split('@')[0],
        email: chosenActive?.email,
        avatar: chosenActive?.avatar || ''
      });
      setAuthState('AUTHENTICATED');
    };

    initAuth();
  }, []);

  const handleSetActiveAccount = async (accOrId) => {
    let targetAcc = null;
    if (typeof accOrId === 'string') {
      targetAcc = connectedAccounts.find(a => a._id === accOrId || a.accountId === accOrId || a.id === accOrId || a.email === accOrId);
    } else {
      targetAcc = accOrId;
    }
    if (targetAcc) {
      setActiveAccountState(targetAcc);
      if (targetAcc.email) {
        const cleanEmail = targetAcc.email.toLowerCase().trim();
        try {
          let disconnectedList = JSON.parse(localStorage.getItem('teamshub_disconnected_emails') || '[]');
          if (disconnectedList.includes(cleanEmail)) {
            disconnectedList = disconnectedList.filter(e => e.toLowerCase() !== cleanEmail);
            localStorage.setItem('teamshub_disconnected_emails', JSON.stringify(disconnectedList));
          }
        } catch (e) {}

        localStorage.setItem('teamshub_active_email', targetAcc.email);
        setUser({
          name: targetAcc.displayName || targetAcc.email.split('@')[0],
          email: targetAcc.email,
          avatar: targetAcc.avatar || ''
        });

        const existingToken = localStorage.getItem(`teamshub_token_${cleanEmail}`);
        if (!existingToken) {
          acquireGraphToken(cleanEmail).then(token => {
            if (token) {
              localStorage.setItem(`teamshub_token_${cleanEmail}`, token);
              syncAccountToBackend({
                accountId: targetAcc.accountId || targetAcc._id,
                displayName: targetAcc.displayName,
                email: targetAcc.email,
                accessToken: token,
                status: 'connected'
              }).catch(() => {});
            }
          });
        }
      }
      try {
        const allMsal = msalInstance.getAllAccounts();
        const cleanTarget = (targetAcc.email || targetAcc.username || '').toLowerCase().trim();
        const msalAcc = allMsal.find(a => (a.username || '').toLowerCase() === cleanTarget || (a.homeAccountId && a.homeAccountId === targetAcc.accountId));
        if (msalAcc) {
          msalInstance.setActiveAccount(msalAcc);
        }
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('teamshub:account-switched', { detail: { account: targetAcc } }));
      await setActiveAccountOnBackend(targetAcc._id || targetAcc.accountId || targetAcc.id);
    }
  };

  const handleSetDefaultAccount = async (accId) => {
    setDefaultAccountIdState(accId);
    setConnectedAccounts(prev => prev.map(a => ({
      ...a,
      isDefault: (a._id === accId || a.accountId === accId || a.id === accId)
    })));
    await setDefaultAccountOnBackend(accId);
  };

  const handleReconnectAccount = async (accOrId) => {
    let targetEmail = null;
    if (typeof accOrId === 'string' && accOrId.includes('@')) {
      targetEmail = accOrId.toLowerCase().trim();
    } else {
      const found = connectedAccounts.find(a => a._id === accOrId || a.accountId === accOrId || a.id === accOrId);
      if (found?.email) targetEmail = found.email.toLowerCase().trim();
    }

    if (targetEmail) {
      try {
        let disconnectedList = JSON.parse(localStorage.getItem('teamshub_disconnected_emails') || '[]');
        disconnectedList = disconnectedList.filter(e => e.toLowerCase() !== targetEmail);
        localStorage.setItem('teamshub_disconnected_emails', JSON.stringify(disconnectedList));
      } catch (e) {}

      const token = await acquireGraphToken(targetEmail);
      if (token) {
        localStorage.setItem(`teamshub_token_${targetEmail}`, token);
        await syncAccountToBackend({
          accountId: accOrId,
          email: targetEmail,
          accessToken: token,
          status: 'connected'
        });
      }
    }

    await reconnectAccountOnBackend(accOrId);
    setConnectedAccounts(prev => prev.map(a => {
      if (a._id === accOrId || a.accountId === accOrId || a.id === accOrId || (targetEmail && a.email?.toLowerCase() === targetEmail)) {
        return { ...a, status: 'connected', lastAuthenticatedAt: new Date().toISOString() };
      }
      return a;
    }));

    window.dispatchEvent(new CustomEvent('teamshub:account-switched'));
  };

  const handleDisconnectAccount = async (accId) => {
    let targetEmail = null;
    const currentAccounts = connectedAccounts || [];
    const targetAcc = currentAccounts.find(
      (a) => a._id === accId || a.accountId === accId || a.id === accId || (a.email && a.email.toLowerCase() === String(accId).toLowerCase())
    );
    if (targetAcc && targetAcc.email) {
      targetEmail = targetAcc.email.toLowerCase().trim();
    } else if (typeof accId === 'string' && accId.includes('@')) {
      targetEmail = accId.toLowerCase().trim();
    }

    if (targetEmail) {
      localStorage.removeItem(`teamshub_token_${targetEmail}`);

      try {
        const disconnectedList = JSON.parse(localStorage.getItem('teamshub_disconnected_emails') || '[]');
        if (!disconnectedList.includes(targetEmail)) {
          disconnectedList.push(targetEmail);
          localStorage.setItem('teamshub_disconnected_emails', JSON.stringify(disconnectedList));
        }
      } catch (e) {}

      try {
        const msalAcc = msalInstance.getAllAccounts().find(a => (a.username || '').toLowerCase() === targetEmail);
        if (msalAcc) {
          msalInstance.getTokenCache().removeAccount(msalAcc);
        }
      } catch (e) {}
    }

    try {
      await disconnectAccountFromBackend(targetEmail || accId);
    } catch (e) {}

    setConnectedAccounts((prev) => {
      const remaining = prev.filter((a) => {
        const emailMatch = targetEmail && a.email && a.email.toLowerCase().trim() === targetEmail;
        const idMatch = a._id === accId || a.accountId === accId || a.id === accId;
        return !emailMatch && !idMatch;
      });

      if (activeAccount && (
        (targetEmail && activeAccount.email && activeAccount.email.toLowerCase().trim() === targetEmail) ||
        activeAccount._id === accId || activeAccount.accountId === accId || activeAccount.id === accId
      )) {
        const nextActive = remaining.length > 0 ? remaining[0] : null;
        setActiveAccountState(nextActive);
        if (nextActive) {
          localStorage.setItem('teamshub_active_email', nextActive.email);
          setUser({
            name: nextActive.displayName || nextActive.email.split('@')[0],
            email: nextActive.email,
            avatar: nextActive.avatar || ''
          });
        } else {
          localStorage.removeItem('teamshub_active_email');
          localStorage.removeItem('teamshub_cached_chats');
          setUser(null);
          setDefaultAccountIdState(null);
        }
      }

      return remaining;
    });

    window.dispatchEvent(new CustomEvent('teamshub:account-disconnected', { detail: { email: targetEmail, accId } }));
  };

  const loginWithMicrosoft = async () => {
    setAuthState('SIGNING_IN');
    setAuthError(null);

    const result = await loginMicrosoftAccount();

    if (result.success && result.account) {
      setConnectedAccounts((prev) => {
        const existsIdx = prev.findIndex((acc) => acc.email === result.account.email);
        if (existsIdx >= 0) {
          const updated = [...prev];
          updated[existsIdx] = { ...updated[existsIdx], ...result.account, status: 'connected' };
          return updated;
        }
        return [...prev, result.account];
      });
      setActiveAccountState(result.account);
      setUser({
        name: result.account.displayName || result.account.email?.split('@')[0] || 'Microsoft User',
        email: result.account.email || '',
        avatar: result.account.avatar || ''
      });
      setAuthState('AUTHENTICATED');
      return { success: true, isDuplicate: result.isDuplicate };
    } else {
      setAuthState('ERROR');
      setAuthError(result.error || 'Authentication failed');
      return { success: false, error: result.error };
    }
  };

  const logout = () => {
    // 1. Clear all localStorage session tokens & active email
    localStorage.removeItem('teamshub_active_email');
    localStorage.removeItem('teamshub_user');
    localStorage.removeItem('teamshub_token');
    localStorage.removeItem('teamshub_cached_chats');
    localStorage.removeItem('teamshub_read_chats');

    // 2. Clear MSAL cache keys from localStorage and sessionStorage
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('msal.') || key.includes('teamshub')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
    } catch (e) {}

    // 3. Clear auth context state
    setAuthState('SIGNED_OUT');
    setUser(null);
    setConnectedAccounts([]);
    setActiveAccountState(null);

    // 4. Fire logout event to immediately switch activeTab to 'welcome'
    window.dispatchEvent(new CustomEvent('teamshub:logout'));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        connectedAccounts,
        activeAccount: activeAccount || connectedAccounts[0],
        defaultAccountId,
        authState,
        authError,
        loginWithMicrosoft,
        logout,
        setActiveAccount: handleSetActiveAccount,
        setDefaultAccount: handleSetDefaultAccount,
        reconnectAccount: handleReconnectAccount,
        disconnectAccount: handleDisconnectAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
