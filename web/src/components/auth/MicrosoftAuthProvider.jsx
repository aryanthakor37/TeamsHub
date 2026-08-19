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

  // Initialize & sync connected accounts from backend & MSAL session on mount
  useEffect(() => {
    const initAuth = async () => {
      setAuthState('LOADING');
      await initializeMsal();
      
      const backendRes = await fetchConnectedAccountsFromBackend();
      const msalAccs = await getActiveMsalAccounts();

      let mergedAccounts = backendRes && backendRes.data ? [...backendRes.data] : [];
      
      // Sync active MSAL logged-in accounts & fresh access tokens to backend DB
      for (const msalAcc of msalAccs) {
        await syncAccountToBackend(msalAcc).catch(() => {});
        if (!mergedAccounts.some(a => a.email?.toLowerCase() === msalAcc.email?.toLowerCase())) {
          mergedAccounts.push(msalAcc);
        }
      }

      if (mergedAccounts.length > 0) {
        setConnectedAccounts(mergedAccounts);
        const activeId = backendRes?.activeAccountId;
        const matchedActive = mergedAccounts.find(a => a._id === activeId || a.accountId === activeId);
        const chosenActive = matchedActive || mergedAccounts[0];
        setActiveAccountState(chosenActive);
        setDefaultAccountIdState(chosenActive._id || chosenActive.accountId);
        setUser({
          name: chosenActive.displayName || chosenActive.email.split('@')[0],
          email: chosenActive.email,
          avatar: chosenActive.avatar || ''
        });
      } else {
        setConnectedAccounts([]);
        setActiveAccountState(null);
      }
      setAuthState('AUTHENTICATED');
    };

    initAuth();
  }, []);

  const handleSetActiveAccount = async (accOrId) => {
    let targetAcc = null;
    if (typeof accOrId === 'string') {
      targetAcc = connectedAccounts.find(a => a._id === accOrId || a.accountId === accOrId || a.id === accOrId);
    } else {
      targetAcc = accOrId;
    }
    if (targetAcc) {
      setActiveAccountState(targetAcc);
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

  const handleReconnectAccount = async (accId) => {
    await reconnectAccountOnBackend(accId);
    setConnectedAccounts(prev => prev.map(a => {
      if (a._id === accId || a.accountId === accId || a.id === accId) {
        return { ...a, status: 'connected', lastAuthenticatedAt: new Date().toISOString() };
      }
      return a;
    }));
  };

  const handleDisconnectAccount = async (accId) => {
    await disconnectAccountFromBackend(accId);
    setConnectedAccounts(prev => prev.map(a => {
      if (a._id === accId || a.accountId === accId || a.id === accId) {
        return { ...a, status: 'disconnected' };
      }
      return a;
    }));
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
    setAuthState('SIGNED_OUT');
    setUser(null);
    setActiveAccountState(null);
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
