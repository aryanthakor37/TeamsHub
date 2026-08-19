# TeamsHub

> **"All your Microsoft Teams accounts, chats and files in one workspace."**

TeamsHub is a third-party productivity companion for Microsoft Teams that enables professionals to manage multiple Microsoft Teams accounts, chats, files, global search, and AI productivity tools in one unified workspace without constantly switching accounts.

---

## 🚀 Project Overview & Architecture

TeamsHub is built as a multi-platform enterprise application:

1. **Backend (`server/`)**: Node.js + Express + MongoDB Mongoose server with modular architecture, environment configuration, CORS, health endpoint, error handling, and future-ready API contracts.
2. **Web Application (`web/`)**: React + Vite single-page application with a modern, glassmorphic UI design system, light/dark mode support, 3-column desktop workspace, responsive mobile layouts, and a centralized mock data layer.
3. **Android Application (`android/`)**: Kotlin + Jetpack Compose + Material 3 Android app following MVVM & Clean Architecture principles (`core/`, `data/`, `domain/`, `presentation/`).

---

## 📂 Repository Structure

```
TeamsHub/
├── android/                  # Android App (Kotlin + Jetpack Compose)
│   ├── app/
│   │   └── src/main/java/com/teamshub/app/
│   │       ├── core/         # Navigation, Theme, Network, Utilities
│   │       ├── data/         # Models, Repository Implementations, Remote/Local Data Sources
│   │       ├── domain/       # Domain Models, Repository Interfaces, Use Cases
│   │       └── presentation/ # ViewModels & Compose Screens (Home, Chats, Files, Search, Accounts, Settings)
│   ├── build.gradle.kts
│   └── settings.gradle.kts
├── web/                      # Web App (React + Vite + Modern UI Design System)
│   ├── src/
│   │   ├── components/       # Common UI elements (Navbar, Sidebar, Modals, Cards, Badges)
│   │   ├── layouts/          # Main responsive workspace layout
│   │   ├── pages/            # Welcome, Dashboard, Chats, Files, Search, Accounts, Settings
│   │   ├── services/         # Mock data service & API client
│   │   └── index.css         # Complete CSS design system (tokens, themes, glassmorphism)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                   # MERN Backend API (Node.js + Express + MongoDB)
│   ├── src/
│   │   ├── config/           # Database setup
│   │   ├── controllers/      # Route controllers (Health check, etc.)
│   │   ├── middleware/       # Error handler & 404 handler
│   │   ├── models/           # Mongoose models (User, etc.)
│   │   ├── routes/           # Health & API route declarations
│   │   └── app.js            # Express app configuration
│   ├── server.js             # HTTP server entry point
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

---

## 📌 Phase Roadmap

### ✅ Current Phase: **Phase 1 — Foundation**
- Complete architecture & project layout across Android, Web, and Backend.
- Health endpoint `GET /api/health`.
- Unified UI design system with Light/Dark mode support.
- Fully responsive Web workspace (Welcome, Dashboard, Chats, Files, Search, Accounts, Settings).
- Full Kotlin Jetpack Compose Android app navigation & UI flow across all 8 screens.
- Centralized, decoupled mock data provider.
- Microsoft integration preview modals (Phase 2 preview indicator).

### 🔮 Future Phases
- **Phase 2** — Microsoft OAuth & Entra ID Integration
- **Phase 3** — Multi-account token management & switching
- **Phase 4** — Real-time Chat sync via Microsoft Graph & Socket.IO
- **Phase 5** — Universal Inbox across connected workspaces
- **Phase 6** — Files synchronization & document preview
- **Phase 7** — Cross-account Global Search
- **Phase 8** — AI Copilot & Productivity Summaries
- **Phase 9** — Multi-channel Push Notifications
- **Phase 10** — Security, Encryption & Compliance Audit
- **Phase 11** — Production Optimization & Testing
- **Phase 12** — Cloud & App Store Deployment

---

## 🛠️ How to Run

### 1. Server (Backend)
```bash
cd server
npm install
npm run dev # or npm start
```
The backend starts on `http://localhost:5000`.
Test health endpoint: `curl http://localhost:5000/api/health`

### 2. Web Application
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Android Application
1. Open the `android/` directory in Android Studio.
2. Sync Project with Gradle Files.
3. Select an Emulator or connected Android device.
4. Click **Run 'app'**.

---

## 🔒 Security & Architecture Directives
- **No Password Scraping**: TeamsHub never requests or stores Microsoft user passwords. Authentication in future phases strictly utilizes official Microsoft MSAL / OAuth 2.0 PKCE flows.
- **No Unofficial APIs**: Operations connect exclusively to official Microsoft Graph APIs in later phases.
- **Decoupled Architecture**: Phase 1 mock data is isolated in dedicated data repositories, ensuring a seamless transition to live API endpoints in Phase 2.
