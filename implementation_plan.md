# Implementation Plan & System Update Log

## Summary of Accomplished Features & System Architecture

Comprehensive documentation of all features, architecture enhancements, real-time WebSocket mechanics, permission management systems, security controls, and DevOps deployment stacks implemented for **Realtime Board (Kanban / Miro Clone)**.

---

## 1. Miro Access Request & Real-Time Notification System

### User Experience
- **View-Only Popover (`👁 View only ∨`)**:
  - When an unauthenticated guest opens a `Can view` link, clicking the header badge shows a popover prompting login to request access.
  - When an authenticated viewer opens a `Can view` link, clicking the header badge displays **`Request editor rights`**.
  - Clicking the request button updates UI status immediately to **`✓ Request sent to owner`**.

- **Notification Bell & Panel (`🔔`)**:
  - Embedded in both **Dashboard** and **Board** headers for board owners.
  - Displays unread badge counter (e.g. `🔔1`) when new access requests arrive via WebSocket.
  - Clicking the bell toggles a floating Notifications Dropdown Panel displaying pending requests with **`Give access`** (blue button) and **`Dismiss`** (grey button).

### Backend Implementation (`backend/`)
- **Database Schema (`models.go`)**:
  - `AccessRequest`: Struct tracking `BoardID`, `BoardName`, `UserID`, `UserName`, `UserEmail`, `AvatarURL`, `Status` (`pending` | `approved` | `dismissed`), `CreatedAt`.
- **API Endpoints (`main.go`)**:
  - `POST /api/boards/:id/request-access`: Generates or resets pending access requests and publishes `ACCESS_REQUESTED` to WebSocket room.
  - `GET /api/notifications`: Retrieves pending and history notifications for owned boards.
  - `POST /api/notifications/:id/respond`: Processes owner responses (`approve` / `dismiss`). Approvals upsert `BoardMember` with `Role = "edit"` and broadcast `ACCESS_GRANTED` via WebSocket.

---

## 2. Instant Real-Time Permission Sync

### Mechanics & Security
- **Backend WebSocket Guard (`client.go`)**:
  - Updated card mutation handler to validate `BoardMember (role = edit)` and `AccessRequest (status = approved)` in addition to URL invite tokens.
- **Frontend Real-Time Sync (`useWebSocket.ts` & `Board.tsx`)**:
  - Listens for WebSocket `ACCESS_GRANTED` and `ACCESS_REQUESTED` events.
  - Re-evaluates `isGrantedEditor` dynamically (`userRole === "edit" || (userRole !== "view" && accessRequestStatus === "approved")`).
  - Seamlessly transitions header UI from `View only` to `Can Edit` mode without requiring a page reload.

---

## 3. Official Miro Manage Board Access Panel

### User Experience
- **Share Modal Integration**:
  - In the Share Modal (`Invite` tab), under `BOARD ACCESS`, next to the team members row, added a clickable **`Manage access`** link.
- **Manage Board Access Sub-View**:
  - Clicking **`Manage access`** transitions to `← Back Manage board access`.
  - Renders member list: Google Avatar, Full Name, Email address, and Role Dropdown Selector (`Editor` / `Viewer`).
  - Board owner is designated with a static `Owner` badge.
  - Clicking **`Done`** returns to the main Share Modal view.

### API & Real-Time Sync
- **`GET /api/boards/:id/members`**: Returns list of board owner, registered members (`BoardMember`), and access request users.
- **`POST /api/boards/:id/members/:userId`**: Updates target user's role in `BoardMember` and `AccessRequest`, and broadcasts real-time permission changes.

---

## 4. Role Downgrade & Re-Request Protection

### Security Logic & Permission Control
- **Strict Downgrade Enforce**:
  - When owner changes a member's role from `Editor` to `Viewer` in Manage Access, `BoardMember.Role` becomes `"view"`, `AccessRequest.Status` becomes `"dismissed"`, and WebSocket broadcasts `ACCESS_GRANTED` with `role: "view"`.
  - Frontend receives `userRole = "view"`, overriding any previous local `accessRequestStatus`, and immediately downgrades UI to `View only` mode in real-time.
- **Re-Request Protection**:
  - When a downgraded viewer clicks **`Request editor rights`** again, `POST /api/boards/:id/request-access` checks their current role. Because they are currently a `Viewer`, it resets their request status to `pending`, publishes `ACCESS_REQUESTED`, and notifies the owner via the `🔔` notification bell.
  - Prevents automated permission bypass and ensures owner approval is strictly required every time access is requested.

---

## 5. Modern UI Polish & Hover Controls

- **`+ Add Card` Hover-Only Visibility**:
  - Configured column container with `group/col` and applied `opacity-0 group-hover/col:opacity-100 transition-all duration-200` to the `+ Add card` button.
  - Keeps the board layout clean and minimalist by default, matching Miro UI design.
- **Brand & Header Redesign**:
  - Integrated Google Font `Plus Jakarta Sans` across index.html & index.css.
  - Created a glowing 3-bar Kanban logo badge with "Kanban Board PRO" typography and removed redundant Dashboard navigation text button.
- **Tag Popover Positioning**:
  - Repositioned card Tag Popover from `bottom-full` to `top-full mt-2 left-0 z-50` (opening downwards over cards).
  - Eliminates UI clipping under sticky header and filter toolbar for cards at the top of columns.

---

## 6. Swimlane Management & Card Preservation Fixes

- **Swimlane Card Preservation & Auto-Migration**:
  - When adding the first swimlane to a board, all existing cards with empty or `"Untitled"` swimlanes are automatically migrated in SQLite DB to the new swimlane.
  - Prevents cards from disappearing when creating swimlanes.
- **Safe Swimlane Deletion**:
  - Removed destructive card deletion on `DELETE_SWIMLANE`.
  - Deleting a swimlane reassigns all contained cards to the remaining swimlane, or back to standard board layout (`"Untitled"`) if no swimlanes remain, guaranteeing zero data loss.
- **Enhanced Swimlane Controls**:
  - Made swimlane pill badges (`Team A`) directly clickable to open the Rename Swimlane modal.
  - Positioned Edit (`Edit2`) and Delete (`Trash2`) icons immediately adjacent to the swimlane title badge (`Team A (4)`).

---

## 7. Dashboard Live Presence & Owner Permission Isolation

- **Live Online Profile Avatars Auto-Sync**:
  - Added a 2.5-second background polling interval, 400ms post-route change fetch, and window tab `focus`/`visibilitychange` listeners in `Dashboard.tsx`.
  - Ensures online user avatars on board cards update in real-time without requiring F5 refreshes.
- **Board Title Owner-Only Permission Isolation**:
  - Restricted board title editing in `Board.tsx` header strictly to the board owner (`isOwner`).
  - Non-owner users (Editors and Viewers) cannot click or edit the board name title input, eliminating permission error toasts (`Only the board owner can modify board settings.`).

---

## 8. UX / UI & Features Upgrade

### Card Detail Modal
- **Glassmorphic Task Inspector**:
  - Clicking any card opens a rich glassmorphic modal with real-time editing for Task Title, Description, Due Date datepicker, and Checklists with interactive progress bars (`✓ 2/4` - `67%`).
  - **Dynamic Due Date Badges**: Surface badges render automatically on cards and modal header (*Overdue (Red)*, *Due Soon (Amber)*, *On Track (Blue)*).
  - **Live Swimlane Reassignment**: Dropdown selector inside modal allows reassigning a card to any active swimlane with real-time canvas position updates.

### Adaptive Board Wallpaper Themes
- **Dual-Mode Theme Presets**:
  - Added a Theme Selector (`🎨 Palette`) in the toolbar featuring 6 curated adaptive gradient presets (*Clean Slate, Cyberpunk Midnight, Sunset Amber, Emerald Aurora, Ocean Breeze, Pastel Lavender*).
  - Designed using adaptive Tailwind classes (`bg-gradient-to-br light... dark...`) ensuring wallpapers look soft, pastel, and high-contrast in Light Mode while remaining deep, vibrant, and glassmorphic in Dark Mode.
  - Real-time WebSocket synchronization (`UPDATE_BOARD_BACKGROUND`) broadcasts wallpaper updates across all connected clients.

---

## 9. Backend Security & High-Performance Infrastructure

- **Rate Limiting Middleware**:
  - Integrated `rateLimiterMiddleware` in `main.go` enforcing a thread-safe **120 requests/minute per IP** sliding window rate limit with automatic background memory cleanup.
  - Returns `HTTP 429 Too Many Requests` with `Retry-After: 60` headers on excess traffic to prevent DDoS and API spamming.
- **Redis Pub/Sub Horizontal Scaling**:
  - Integrated Redis Pub/Sub (`board:<boardID>`) in WebSocket `Hub` (`hub.go`), enabling multi-instance WebSocket synchronization across servers with graceful fallback to local in-memory broadcasting if Redis is unavailable.
- **Database & Query Optimizations**:
  - Fixed `EDIT_CARD` validation in `client.go` to support partial detail updates without requiring full title re-transmission.
  - Eliminated redundant `fetchBoard()` calls and N+1 SQL queries across REST endpoints.

---

## 10. Production Deployment & DevOps Stack

- **Backend Dockerfile (`backend/Dockerfile`)**:
  - Multi-stage build (`golang:1.23-alpine` -> `alpine:latest`) with CGO optimization and persistent data volume (`/app/data`).
- **Frontend Dockerfile & NGINX Configuration (`frontend/`)**:
  - Multi-stage build (`node:20-alpine` -> `nginx:alpine`).
  - Configured `frontend/nginx.conf` with SPA routing (`try_files $uri $uri/ /index.html`) and reverse proxies for `/api/`, `/auth/`, and `/ws` with WebSocket Upgrade headers (`Upgrade`, `Connection`).
- **One-Command Docker Compose (`docker-compose.yml`)**:
  - Production `docker-compose.yml` orchestrating `redis:7-alpine`, `backend`, and `frontend` with Redis healthchecks, restart policies, and volume persistence.
  - Enables full production stack deployment via single command:
    ```bash
    docker-compose up -d --build
    ```

---

## 11. System Verification & Test Status

- **Go Backend Unit Tests**: `go test ./...` -> **`ok backend` (100% PASS)**
- **React Frontend Production Build**: `npm run build` -> **`built in 311ms` (0 ERRORS)**
- **Docker Stack Validation**: `docker-compose config` -> **100% CLEAN SYNTAX (0 WARNINGS)**
