# TeamsHub: Master Product Vision & Roadmap

## 1. The Core Problem
Freelancers, IT Consultants, and B2B Agencies often work with multiple clients simultaneously. Each client provides a separate Microsoft Teams account (Work/School account) in their own Entra ID tenant. 
Currently, Microsoft Teams makes it incredibly difficult to manage multiple tenants. Users are forced to constantly log out and log back in, or keep 4-5 different browser profiles open. This leads to missed messages, lost context, and misplaced files.

## 2. The Solution: TeamsHub (SaaS)
TeamsHub is a unified workspace and messaging hub that securely connects to multiple Microsoft Teams accounts simultaneously. It provides a single pane of glass for all communications and files across every connected organization.

**Target Audience:** Freelancers, Consultants, Agency Owners.
**Business Model:** Commercial SaaS (Freemium or Subscription).

---

## 3. Core Capabilities & Architecture

### A. Authentication & Security
- **Multi-Tenant MSAL:** Utilizes Microsoft Authentication Library (MSAL) with OAuth 2.0 PKCE.
- **Strict Isolation:** Each account's access tokens are securely isolated in MongoDB and strictly associated with the specific tenant.
- **Admin Consent:** Built to handle enterprise security requirements, instructing IT admins to grant `Chat.Read` and `Chat.ReadWrite` permissions.

### B. Dual Engine Architecture
- **Real Graph Mode:** Fetches live data directly from Microsoft Graph API (`/me/chats`, `/me/drive`).
- **Mock / Demo Mode:** Controlled via `MOCK_GRAPH_DATA=true`. Generates realistic dummy accounts, chats, and files for UI development, portfolio presentations, and offline testing when Azure credentials are not available.

---

## 4. Feature Roadmap

### ✅ Phase 1 to 3: Foundation & UI
- Base MERN Stack setup + Android Kotlin scaffolding.
- UI layouts, Dark mode, multi-account connect buttons.
- JWT-based authentication for the core app.

### ✅ Phase 4: Unified Chat Inbox (Read-Only)
- **Status: Complete (Mock Mode Enabled)**
- Ability to connect multiple accounts.
- Fetch and aggregate chats from all connected accounts into a single dashboard.
- View chat history and messages without switching contexts.

### ⏳ Phase 5: Interactive Chat (Read & Write)
- **Status: Pending**
- Send messages directly from TeamsHub to any Teams chat.
- Create new 1-on-1 or Group chats.
- Requires `Chat.ReadWrite` delegated permissions in Azure.

### 🚀 Phase 6: Unified Global Drive (The "Killer Feature")
- **Status: Vision Defined**
- **Problem:** Finding a file sent by "Company B" 3 weeks ago is tedious.
- **Solution:** A unified File Manager tab that queries the Graph API (`/me/drive/recent` and `/search/query`) across ALL connected accounts simultaneously.
- **Features:**
  - Global Search: Type a filename and search across 5 different client tenants at once.
  - Unified Data Grid: View file name, sender, source company, and date in one table.
  - Smart Filters: Filter files by specific client/account.
  - One-Click Download: Authenticated download links via Graph API.

---

## 5. Technology Stack
- **Frontend:** React, Vite, Tailwind CSS (or Vanilla CSS based on preference), MSAL.js.
- **Backend:** Node.js, Express, MongoDB, Microsoft Graph SDK.
- **Mobile:** Android natively built with Kotlin.

## 6. Microsoft App Verification (Future Commercialization)
To launch this as a public SaaS, the Azure App Registration must go through Microsoft's MPN (Microsoft Partner Network) verification process. This ensures the app is marked as a "Verified Publisher" to remove warning prompts during user login and allow for easier widespread adoption.
