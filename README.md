# 🚀 Realtime Board - Enterprise-Grade Collaborative Kanban & Miro Clone

[![Go](https://img.shields.io/badge/Go-1.23+-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://golang.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-Realtime-FF6C37?style=for-the-badge&logo=socketdotio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![Redis](https://img.shields.io/badge/Redis-7_Pub/Sub-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![NGINX](https://img.shields.io/badge/NGINX-Reverse_Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org)

**Realtime Board** is a high-performance, full-stack, real-time collaborative workspace inspired by Miro and Trello. Engineered with a concurrent **Go (Gin) WebSocket** backend, **Redis Pub/Sub** horizontal scaling, and a modern **React 19 + TypeScript** glassmorphic frontend.

---

## ✨ Key Features

### ⚡ Real-Time Collaboration & Synchronization
- **Zero-Latency WebSocket Engine**: Instant card dragging/moving, column management, swimlane creation, and real-time tag updates across all connected clients.
- **Live User Presence**: Real-time online user avatar stack on board header and dashboard cards with automated presence tracking.

### 🛡️ Miro-Style Access Control & Notification System
- **Role-Based Access (RBAC)**: Owner, Editor, and Viewer permission tiers.
- **Access Request Flow**: Viewers can request editor rights (`Request editor rights`). Board owners receive instant WebSocket notifications via a floating Notification Bell (`🔔`).
- **Manage Board Access Panel**: Detailed modal allowing board owners to upgrade or downgrade user permissions in real time.

### 📋 Rich Task Inspector & Inspector Modal
- **Glassmorphic Detail Modal**: Comprehensive inspector for task details, descriptions, due dates, and interactive checklists.
- **Checklist Progress Bar**: Real-time visual progress percentage (`✓ 2/4` - `67%`) on checklists.
- **Dynamic Due Date Badges**: Automatic visual badges (*Overdue*, *Due Soon*, *On Track*).
- **Swimlane Reassignment**: Reassign cards across swimlanes directly from task details or canvas drag-and-drop.

### 🎨 Adaptive Aesthetic & Customization
- **Dual-Mode Theme Engine**: Seamless switching between Dark Mode and Light Mode with HSL tailored color palettes.
- **6 Wallpaper Presets**: Real-time background wallpaper synchronization (*Clean Slate, Cyberpunk Midnight, Sunset Amber, Emerald Aurora, Ocean Breeze, Pastel Lavender*).

### 🚀 Security & Enterprise Reliability
- **Ticket-Based WebSocket Authentication**: One-time secure tickets for WebSocket connection handshake to prevent unauthorized access.
- **Sliding-Window Rate Limiter**: Thread-safe IP rate limiting (120 requests/minute per IP) with automatic background memory reclamation.
- **Database Optimizations**: Batch SQL query execution eliminating N+1 query bottlenecks.
- **Safe Swimlane & Card Protection**: Automatic card migration and zero-data-loss fallback on swimlane deletion.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Key Responsibilities |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Lucide Icons | Responsive Glassmorphic UI, Optimistic State Updates, Custom Hooks (`useWebSocket`, `useAuth`, `useTheme`, `useNotifications`) |
| **Backend** | Go (Golang 1.23+), Gin Framework, GORM | RESTful APIs, WebSocket Hub, JWT Authentication, One-Time WS Ticket Engine, IP Rate Limiter |
| **Real-Time Scaling** | Redis 7 (Pub/Sub) | Cross-instance WebSocket message broadcasting for multi-node deployment |
| **Database** | SQLite3 / PostgreSQL | Relational storage for users, boards, columns, cards, swimlanes, and access requests |
| **DevOps** | Multi-stage Docker, NGINX | Production containerization, SPA routing, Reverse Proxying `/api`, `/auth`, and WebSocket `/ws` |

---

## 🚀 Quick Start (Docker Compose)

The entire production stack (Backend, Frontend, NGINX Reverse Proxy, Redis) can be launched with a single command:

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/realtime-board.git
cd realtime-board

# Launch full containerized stack
docker-compose up -d --build
```

Access the application in your browser:
- **Web App (NGINX Proxy)**: `http://localhost` or `http://localhost:5173`
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
realtime-board/
├── backend/
│   ├── client.go           # WebSocket Client & Message Validation
│   ├── hub.go              # WebSocket Room Hub & Redis Pub/Sub Sync
│   ├── main.go             # Gin Routes, Rate Limiter Middleware, Auth & API Controllers
│   ├── models.go           # GORM Data Schemas (Board, Card, Column, Swimlane, AccessRequest)
│   ├── rate_limiter_test.go# Rate Limiter Unit Tests
│   └── Dockerfile          # Multi-stage Go Build
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Board.tsx   # Miro Canvas Workspace, Modal Inspectors, Wallpapers
│   │   │   └── Dashboard.tsx # Board Grid/List Views, Custom Modals, Avatars
│   │   ├── useWebSocket.ts # Real-Time Action Hooks & State Sync
│   │   ├── useAuth.tsx     # JWT & Google OAuth State Management
│   │   └── config.ts       # Environment & API Configurations
│   ├── nginx.conf          # NGINX SPA & Reverse Proxy Configuration
│   └── Dockerfile          # Multi-stage Node & NGINX Build
├── docker-compose.yml      # Docker Orchestration Manifest
├── implementation_plan.md  # Comprehensive Architectural & System Update Documentation
└── README.md
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for details.

---

Designed & Developed by **LO** (Full-Stack Engineer) ⚡
