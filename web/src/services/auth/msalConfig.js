import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

/**
 * Microsoft Entra ID MSAL Configuration for TeamsHub Web
 *
 * Required env vars (set in web/.env or web/.env.local):
 *   VITE_MICROSOFT_CLIENT_ID=<your-azure-app-client-id>
 *   VITE_MICROSOFT_TENANT_ID=common
 */
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '00000000-0000-0000-0000-000000000000';
const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';

export const isRealMsalConfigured = () => {
  return clientId && clientId !== '00000000-0000-0000-0000-000000000000';
};

export const msalConfig = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
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
