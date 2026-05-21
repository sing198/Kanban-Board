# 🚀 Kanban Board - Real-Time Collaborative Workspace

[![Go](https://img.shields.io/badge/Go-1.23+-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://golang.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-Realtime-FF6C37?style=for-the-badge&logo=socketdotio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![Redis](https://img.shields.io/badge/Redis-7_Pub/Sub-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![NGINX](https://img.shields.io/badge/NGINX-Reverse_Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org)

**Kanban Board** is a high-performance, full-stack, real-time collaborative workspace. Engineered with a concurrent **Go (Gin) WebSocket** backend, **Redis Pub/Sub** horizontal scaling, and a modern **React 19 + TypeScript** glassmorphic frontend.

---

## ✨ Key Features & Latest Architectural Upgrades

### ⚡ Real-Time Collaboration & Synchronization
- **Zero-Latency WebSocket Engine**: Instant card dragging/moving, column management, swimlane creation, and real-time tag updates across all connected clients.
- **Global Card ID Deduplication**: Strict client & server state synchronization ensuring cards remain unique across columns during concurrent drag-and-drop operations.
- **Live User Presence Isolation**: Real-time online user avatar stack on board headers and dashboard cards, filtering out stale guest badges for logged-in accounts.

### 🔑 Dual-Storage Auth & Seamless Guest Demo Experience
- **Dual-Storage Architecture**: Persistent Google OAuth JWT tokens in `localStorage` and temporary Guest Demo tokens in `sessionStorage` (auto-expired on tab closure).
- **Auto-Claim Guest Boards**: When a Guest user decides to log in via Google, the Go backend automatically transfers ownership (`owner_id`) of their Guest board directly into their Google Account.
- **Strict Ownership Guard**: Prevents Guest users from claiming or overwriting boards owned by other users.

### 🛡️ Dual-Layer Exit Guarding & Garbage Collection
- **Browser Back Button Interception (`popstate`)**: Intercepts browser Back Button clicks for Guest owners, prompting a glassmorphic *"Save Board Before Leaving?"* confirmation modal.
- **Instant Unload Cleanup (`keepalive` fetch)**: Automatically issues an asynchronous `DELETE /api/boards/:id` request with `keepalive: true` when a Guest closes their browser tab (`X`).
- **24-Hour Backend Garbage Collection**: Hourly background worker (`startGuestBoardCleanupWorker`) purging expired Guest demo boards older than 24 hours.

### 🛡️ Access Control & Notification System
- **Role-Based Access Control (RBAC)**: Owner, Editor, and Viewer permission tiers.
- **Identity-Guarded Access Requests**: Requires Guest users to log in with a Google account before requesting editor access, preventing anonymous spam requests.
- **Manage Access Panel**: Dedicated modal allowing board owners to upgrade or downgrade user permissions in real time.

### 📋 Interactive Task Inspector & UI Polish
- **Glassmorphic Detail Modal**: Inspector for task descriptions, due dates, swimlanes, and interactive checklists.
- **Checklist Progress Bar**: Real-time visual progress percentage (`✓ 2/4` - `67%`) on checklists.
- **Dynamic Modal Labels**: Smart button labels (*"Keep Viewing as Guest"* vs *"Keep Editing as Guest"*) depending on Read-Only vs Editor permissions.
- **Hard-Reset Logout**: `logout()` clears all session/local storage and performs a clean hard redirect to the landing page.

---

## 🛠️ Tech Stack & System Architecture

| Layer | Technology | Key Responsibilities |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Lucide Icons | Responsive Glassmorphic UI, Optimistic State Updates, Custom Hooks (`useWebSocket`, `useAuth`, `useTheme`, `useNotifications`) |
| **Backend** | Go (Golang 1.23+), Gin Framework, GORM | RESTful APIs, WebSocket Hub, JWT Authentication, One-Time WS Ticket Engine, IP Rate Limiter, Guest Cleanup Worker |
| **Real-Time Scaling** | Redis 7 (Pub/Sub) | Cross-instance WebSocket message broadcasting for multi-node deployment |
| **Database** | SQLite3 / PostgreSQL | Relational storage for users, boards, columns, cards, swimlanes, and access requests |
| **DevOps** | Multi-stage Docker, NGINX | Containerization, SPA routing, Reverse Proxying `/api`, `/auth`, and WebSocket `/ws` |

---

## 🚀 Quick Start (Docker Compose)

The entire production stack (Backend, Frontend, NGINX Reverse Proxy, Redis) can be launched with a single command:

```bash
# Clone repository
git clone https://github.com/sing198/Kanban-Board.git
cd Kanban-Board

# Launch full containerized stack
docker-compose up -d --build
```

Access the application in your browser:
- **Web Application**: `http://localhost` or `http://localhost:5173`
- **Backend API**: `http://localhost:8080`

---

## 💻 Local Development Setup

### 1. Backend Setup (Go)
```bash
cd backend

# Copy environment template
cp .env.example .env

# Run database migrations and backend server
go run .
```
Backend runs locally at `http://localhost:8080`.

### 2. Frontend Setup (React)
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend runs locally at `http://localhost:5173`.

---

## 📁 Directory Structure

```
kanban-board/
├── backend/
│   ├── auth.go             # OAuth Handlers, Guest Auth & Board Claiming Logic
│   ├── client.go           # WebSocket Client & Defense-in-Depth Origin Checks
│   ├── hub.go              # WebSocket Room Hub & Redis Pub/Sub Sync
│   ├── main.go             # Gin Routes, Rate Limiter, Guest Cleanup Worker & API Controllers
│   ├── models.go           # GORM Data Schemas (Board, Card, Column, Swimlane, AccessRequest)
│   ├── rate_limiter_test.go# Rate Limiter Unit Tests
│   └── Dockerfile          # Multi-stage Go Build
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Board.tsx   # Canvas Workspace, Popstate/Unload Listeners, Wallpapers
│   │   │   └── Dashboard.tsx # Board Grid/List Views, Presence Filters, Custom Modals
│   │   ├── useWebSocket.ts # Real-Time Action Hooks, Deduplication & State Sync
│   │   ├── useAuth.ts      # Dual-Storage (sessionStorage/localStorage) Auth Hooks
│   │   └── config.ts       # Environment & API Configurations
│   ├── nginx.conf          # NGINX SPA & Reverse Proxy Configuration
│   └── Dockerfile          # Multi-stage Node & NGINX Build
├── docker-compose.yml      # Docker Orchestration Manifest
├── implementation_plan.md  # Detailed Architectural & Implementation Log
└── README.md
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for details.
