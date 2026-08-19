const msal = require('@azure/msal-node');

/**
 * TeamsHub MSAL Node Service
 * Server-side Microsoft token management for Graph API access.
 *
 * SECURITY:
 * - No tokens logged to console
 * - No tokens exposed in API responses
 * - Client secret only used server-side
 */

const isConfigured = () => {
  const clientId = process.env.WEB_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  return (
    clientId &&
    clientId !== 'YOUR_MICROSOFT_ENTRA_WEB_CLIENT_ID_PLACEHOLDER' &&
    clientSecret &&
    clientSecret !== 'YOUR_MICROSOFT_CLIENT_SECRET_PLACEHOLDER'
  );
};

let ccaInstance = null;

const getConfidentialClient = () => {
  if (ccaInstance) return ccaInstance;
  if (!isConfigured()) return null;

  ccaInstance = new msal.ConfidentialClientApplication({
    auth: {
      clientId: process.env.WEB_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.TENANT_ID || 'common'}`,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET
    },
    system: {
      loggerOptions: {
        loggerCallback: (loglevel, message, containsPii) => {
          // Never log PII or token data
          if (containsPii) return;
          if (loglevel === msal.LogLevel.Error) {
            console.error('[MSAL Node Error]', message);
          }
        },
        piiLoggingEnabled: false,
        logLevel: msal.LogLevel.Error
      }
    }
  });

  return ccaInstance;
};

/**
 * Acquire token On-Behalf-Of a user's access token.
 * Used when the web/mobile client sends its access token and
 * the server needs to call Graph on behalf of that user.
 */
const acquireTokenOnBehalfOf = async (userAccessToken, scopes = ['User.Read', 'Chat.Read']) => {
  const cca = getConfidentialClient();
  if (!cca) {
    throw new Error('MSAL_NOT_CONFIGURED');
  }

  try {
    const result = await cca.acquireTokenOnBehalfOf({
      oboAssertion: userAccessToken,
      scopes
    });
    return {
      accessToken: result.accessToken,
      expiresOn: result.expiresOn
    };
  } catch (error) {
    console.error('[MSAL OBO Error]', error.errorCode || error.message);
    throw error;
  }
};

/**
 * Exchange authorization code for tokens (used during initial login).
 */
const exchangeCodeForTokens = async (authCode, redirectUri) => {
  const cca = getConfidentialClient();
  if (!cca) {
    throw new Error('MSAL_NOT_CONFIGURED');
  }

  try {
    const result = await cca.acquireTokenByCode({
      code: authCode,
      scopes: ['User.Read', 'Chat.Read'],
      redirectUri: redirectUri || process.env.CLIENT_URL || 'http://localhost:5173'
    });
    return {
      accessToken: result.accessToken,
      expiresOn: result.expiresOn,
      account: result.account
    };
  } catch (error) {
    console.error('[MSAL Code Exchange Error]', error.errorCode || error.message);
    throw error;
  }
};

module.exports = {
  isConfigured,
  getConfidentialClient,
  acquireTokenOnBehalfOf,
  exchangeCodeForTokens
};
