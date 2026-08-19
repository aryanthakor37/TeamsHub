# Microsoft Entra Setup Guide for TeamsHub

To connect TeamsHub to real Microsoft Teams data, you must configure an App Registration in Microsoft Entra ID (formerly Azure Active Directory).

Follow these steps precisely:

## 1. Create App Registration

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) or Azure Portal.
2. Navigate to **Identity** > **Applications** > **App registrations**.
3. Click **New registration**.
4. **Name**: `TeamsHub`
5. **Supported account types**: Choose *Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)*.
   *Note: Personal accounts (Skype, Xbox) are not supported by the Microsoft Teams Chat API.*
6. Click **Register**.

## 2. Configuration & Identifiers

1. On the application Overview page, copy the **Application (client) ID**.
   - **USER ACTION REQUIRED**: Paste this into `WEB_CLIENT_ID` (server) and `VITE_MICROSOFT_CLIENT_ID` (web).
2. Copy the **Directory (tenant) ID**.
   - **USER ACTION REQUIRED**: Paste this into `TENANT_ID`.

## 3. Configure Web Platform (SPA)

1. Go to **Authentication** under the Manage menu.
2. Click **Add a platform** > **Single-page application (SPA)**.
3. Add the redirect URI for your local environment:
   - `http://localhost:5173` (or your production URL).
4. Do NOT check "Access tokens" or "ID tokens" in the implicit grant section (MSAL v2 uses auth code flow with PKCE).

## 4. Configure Android Platform

1. Go to **Authentication** > **Add a platform** > **Android**.
2. **Package name**: `com.teamshub.app` (verify this matches your `build.gradle.kts` `applicationId`).
3. **Signature hash**: Generate this using your debug keystore (`keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64`).
4. Click Configure.
5. Azure will generate a Redirect URI.
   - **USER ACTION REQUIRED**: Open `android/app/src/main/res/raw/msal_config.json` and ensure the `redirect_uri` matches exactly what Azure provides. Replace the placeholder `client_id` in that same file.

## 5. Generate Client Secret (Server-side)

1. Go to **Certificates & secrets** > **Client secrets**.
2. Click **New client secret**.
3. Add a description (e.g., "Node Backend API") and set an expiration.
4. Copy the **Value** (not the Secret ID).
   - **USER ACTION REQUIRED**: Paste this into `MICROSOFT_CLIENT_SECRET` in `server/.env`.
   - **SECURITY WARNING**: NEVER expose this secret to the web or Android applications. Keep it strictly on the backend.

## 6. Configure Microsoft Graph Permissions

1. Go to **API permissions**.
2. Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**.
3. Add the following permissions:
   - `User.Read`
   - `Chat.Read`
4. **USER ACTION REQUIRED (Admin Consent)**: You must click the **Grant admin consent for <Directory Name>** button. `Chat.Read` requires administrative consent to function.

## 7. Test Login

1. Ensure your `.env` files are populated.
2. In `server/.env`, ensure `MOCK_GRAPH_DATA=false`.
3. Restart the backend and frontend servers.
4. Click "Connect Microsoft" in the Web app or Android app.
5. You should be directed to the real Microsoft login screen.
