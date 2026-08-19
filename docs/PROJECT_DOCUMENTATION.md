# 📘 TeamsHub — Complete Technical Documentation & Master Implementation Plan

> **"All your Microsoft Teams accounts, chats, and files in one unified workspace."**

---

## 📋 Table of Contents
1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Target Audience & Problem Statement](#2-target-audience--problem-statement)
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Core Features Specification](#4-core-features-specification)
5. [Database Schema & Data Models](#5-database-schema--data-models)
6. [API Endpoints & Contracts](#6-api-endpoints--contracts)
7. [Authentication & Security Compliance](#7-authentication--security-compliance)
8. [Phase-by-Phase Implementation Roadmap](#8-phase-by-phase-implementation-roadmap)
9. [Development & Testing Guide](#9-development--testing-guide)

---

## 1. Executive Summary & Product Vision

**TeamsHub** is an enterprise-grade, multi-platform productivity workspace designed for professionals who manage multiple Microsoft Teams accounts, guest organization memberships, and client tenants.

Instead of requiring users to constantly log out and log back in, maintain multiple browser profiles, or miss critical messages across external client organizations, TeamsHub consolidates all connected Microsoft accounts into **one unified workspace** with real-time chat, instant notifications, document previews, and cross-account global search.

---

## 2. Target Audience & Problem Statement

### 🔴 The Problem
Freelancers, IT Consultants, B2B Agencies, and Corporate Executives routinely work across multiple client companies simultaneously. Each client company assigns a separate Microsoft Teams account in their own Entra ID tenant.

Currently, Microsoft Teams makes managing multiple tenants cumbersome:
- Users miss important chat messages in secondary guest tenants.
- Constantly switching accounts causes lost context and desktop clutter.
- Finding shared files sent across different client organizations takes excessive time.

### 🟢 The TeamsHub Solution
TeamsHub provides:
- **Unified Inbox**: View and respond to chats from all connected Microsoft accounts in one place.
- **1-Click Workspace Switcher**: Switch active company context in a single click.
- **Universal File Manager**: Search and preview shared OneDrive/SharePoint files across all connected accounts.
- **Real-Time Notifications**: Instant audio chimes and toast banners for incoming messages across any organization.

---

## 3. System Architecture & Data Flow

TeamsHub is designed as a decoupled, multi-platform application consisting of 3 core layers:

```
                  +-----------------------------------+
                  |         TeamsHub Workspace        |
                  |  (React Web App & Android App)    |
                  +-----------------+-----------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
+-----------------------+                           +-------------------+
|  Node.js + Express    |                           |  Microsoft MSAL   |
|     Backend API       |                           |   OAuth 2.0 PKCE  |
+-----------+-----------+                           +---------+---------+
            |                                                 |
            v                                                 v
+-----------------------+                           +-------------------+
| MongoDB Database &    |                           |  Microsoft Graph  |
|  Socket.IO Engine     |                           |    v1.0 REST API  |
+-----------------------+                           +-------------------+
```

### Stack Overview
- **Backend (`server/`)**: Node.js, Express.js, MongoDB (Mongoose ORM), Socket.IO (Real-Time Communication).
- **Web Application (`web/`)**: React.js, Vite, Vanilla CSS Design System (Glassmorphic theme, Light/Dark mode), MSAL.js (`@azure/msal-browser`, `@azure/msal-react`).
- **Android Application (`android/`)**: Kotlin, Jetpack Compose, Material 3, MVVM Architecture (`core/`, `data/`, `domain/`, `presentation/`).

---

## 4. Core Features Specification

### 1. Multi-Tenant Workspace Switcher
- Connect multiple Microsoft Teams Work, School, and Guest accounts.
- Display active workspace badge, tenant ID, and status indicator.
- Switch active workspace context without page reloads.

### 2. Real-Time Teams Chat & Messaging
- Sync 1-on-1, Group, and Meeting chat threads.
- Read and send messages in real-time.
- View live presence status (Online, Busy, Away, Offline) for colleagues.

### 3. Universal File Hub & Document Preview Modal
- Aggregate recent files sent across all connected Microsoft accounts.
- Built-in preview modal for PDF, Word (`.docx`), Excel (`.xlsx`), and Image attachments without downloading.

### 4. Real-Time Toast Notifications
- Broadcast real-time message alerts via Socket.IO.
- Play official Teams notification audio chime and display floating toast banners.

### 5. Universal Cross-Account Search
- Unified search bar to search for messages, teammates, and documents across all connected organizations simultaneously.

---

## 5. Database Schema & Data Models

### 1. User Model (`User.js`)
```javascript
{
  name: String,
  email: { type: String, unique: true },
  avatar: String,
  activeAccountId: String,
  defaultAccountId: String,
  timestamps: true
}
```

### 2. ConnectedAccount Model (`ConnectedAccount.js`)
```javascript
{
  userId: { type: ObjectId, ref: 'User' },
  accountId: { type: String, index: true },
  microsoftUserId: String,
  displayName: String,
  email: String,
  tenantId: String,
  accountType: String,
  status: { type: String, enum: ['connected', 'reconnect_required', 'disconnected'] },
  isDefault: Boolean,
  microsoftAccessToken: { type: String, select: false },
  tokenExpiresAt: Date,
  timestamps: true
}
```

### 3. Chat Model (`Chat.js`)
```javascript
{
  userId: { type: ObjectId, ref: 'User' },
  connectedAccountId: String,
  microsoftChatId: String,
  participant: String,
  role: String,
  company: String,
  accountBadge: String,
  avatar: String,
  lastMessagePreview: String,
  lastMessageTimestamp: Date,
  unreadCount: Number,
  chatType: { type: String, enum: ['oneOnOne', 'group', 'meeting'] },
  onlineStatus: String,
  pinned: Boolean,
  timestamps: true
}
```

### 4. Message Model (`Message.js`)
```javascript
{
  userId: { type: ObjectId, ref: 'User' },
  connectedAccountId: String,
  chatId: String,
  microsoftMessageId: String,
  senderName: String,
  senderEmail: String,
  content: String,
  contentType: { type: String, enum: ['text', 'html'] },
  isOutgoing: Boolean,
  createdDateTime: Date,
  timestamps: true
}
```

---

## 6. API Endpoints & Contracts

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | API Server status & health check. |
| `/api/accounts` | `GET` | Retrieve connected Microsoft accounts for user. |
| `/api/accounts/microsoft` | `POST` | Sync/Connect new Microsoft account identity. |
| `/api/accounts/active` | `PUT` | Update current active workspace context. |
| `/api/chats` | `GET` | Fetch chat threads (filterable by `connectedAccountId`). |
| `/api/chats/:id/messages` | `GET` | Fetch message history for a specific chat thread. |
| `/api/chats/:id/messages` | `POST` | Send a new message to a chat thread. |
| `/api/files` | `GET` | Fetch recent documents across connected accounts. |

---

## 7. Authentication & Security Compliance

1. **OAuth 2.0 PKCE Flow**: Uses Microsoft Authentication Library (MSAL) with Proof Key for Code Exchange (PKCE) for enterprise security.
2. **No Password Storage**: TeamsHub never requests or stores user passwords. Authentication is handled directly by Microsoft login servers (`login.microsoftonline.com`).
3. **Delegated Scopes**:
   - `User.Read`: Read identity & profile.
   - `User.ReadBasic.All`: Search teammates.
   - `Chat.ReadWrite`: Sync and send chat messages.
   - `Files.Read.All`: Access shared OneDrive / SharePoint documents.
   - `Presence.Read.All`: Monitor colleague online/busy status.
   - `offline_access`: Enable background token refresh.

---

## 8. Phase-by-Phase Implementation Roadmap

- **Phase 1 — Foundation (Completed)**: Architecture, MERN setup, responsive UI design system, Android Jetpack Compose layout.
- **Phase 2 — Database & API Integration (Completed)**: Express API endpoints connected to MongoDB Atlas database with real data seeding.
- **Phase 3 — MSAL OAuth & Multi-Tenant Setup (Completed)**: Microsoft Entra ID integration with multi-tenant authority (`common`).
- **Phase 4 — Real-Time Engine (Completed)**: Socket.IO integration for instant message delivery and toast notifications.
- **Phase 5 — Multi-Org Testing & Validation (Active)**: Live testing with multi-organization accounts.
- **Phase 6 — Global Document Preview & Search**: Cross-tenant document search and inline preview.
- **Phase 7 — AI Copilot Assistance**: AI chat thread summarization and smart reply suggestions.
- **Phase 8 — Production Deployment**: Cloud deployment (Vercel/Render + MongoDB Atlas).

---

## 9. Development & Testing Guide

### 1. Server Setup
```bash
cd server
npm install
npm run dev
```
- Starts API Server on `http://localhost:5000`.
- Test Health Endpoint: `curl http://localhost:5000/api/health`

### 2. Web Application Setup
```bash
cd web
npm install
npm run dev
```
- Opens Web Workspace on `http://localhost:5173`.

### 3. Database Seed / Reset Script
```bash
cd server
node src/seed.js
```

---

*Document Created & Maintained for TeamsHub Project.*
