import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

/**
 * Microsoft Entra ID MSAL Configuration for TeamsHub Web
 *
 * Required env vars (set in web/.env or web/.env.local):
 *   VITE_MICROSOFT_CLIENT_ID=<your-azure-app-client-id>
 *   VITE_MICROSOFT_TENANT_ID=common
 */
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || 'c0e59292-129d-4d40-8b90-c1b022e98deb';
const tenantId = (import.meta.env.VITE_MICROSOFT_TENANT_ID && import.meta.env.VITE_MICROSOFT_TENANT_ID !== '41f9d7c7-4e78-4c29-b30d-423f638ea43e') ? import.meta.env.VITE_MICROSOFT_TENANT_ID : 'common';

export const isRealMsalConfigured = () => {
  return clientId && clientId !== '00000000-0000-0000-0000-000000000000';
};

export const msalConfig = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '',
    navigateToLoginRequestUrl: false
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: typeof window !== 'undefined' && window.location.protocol === 'https:'
  },
  system: {
    allowRedirectInIframe: false,
    windowHashTimeout: 9000,
    iframeHashTimeout: 9000,
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (message && (message.includes('Unsafe attempt') || message.includes('sandboxed') || message.includes('iframe'))) return;
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL Error]', message);
            return;
          case LogLevel.Warning:
            console.warn('[MSAL Warning]', message);
            return;
          default:
            return;
        }
      },
      logLevel: LogLevel.Warning
    }
  }
};

/**
 * Login scopes — includes Chat.Read for Microsoft Graph chat access.
 * Per Microsoft Graph permissions reference:
 *   - User.Read: user identity
 *   - Chat.Read: read Teams chats and messages (requires admin consent)
 */
export const loginRequest = {
  scopes: [
    'User.Read', 
    'User.ReadBasic.All', // For searching colleagues
    'Chat.ReadWrite',     // For reading and SENDING messages
    'Files.Read.All',     // For accessing files/attachments
    'Presence.Read.All',  // For real-time online/offline status
    'openid', 
    'profile', 
    'email', 
    'offline_access'
  ]
};

/**
 * Silent token acquisition scopes for Graph API calls
 */
export const graphTokenRequest = {
  scopes: [
    'User.Read', 
    'User.ReadBasic.All', 
    'Chat.ReadWrite', 
    'Files.Read.All', 
    'Presence.Read.All'
  ]
};

export const msalInstance = new PublicClientApplication(msalConfig);
