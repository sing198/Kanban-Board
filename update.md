# Security Audit & Bug Fix Summary

**Date**: 2026-07-31  
**Scope**: Full codebase audit — backend (Go/Gin/GORM) + frontend (React/TypeScript)  
**Verdict**: 9 issues found (4 critical, 4 medium, 1 frontend logic bug) — all fixed.

---

## Critical Vulnerabilities Fixed

### 1. Privilege Escalation — Unauthenticated Invite Token Endpoint
**File**: `backend/main.go` — `GET /api/boards/:id/invite-tokens`

**Before**: This endpoint had zero authentication. Anyone on the internet could call it with any `boardId` (including private boards) and receive a valid `edit` invite token, then use that token to grant themselves full editor access.

**After**: Added `authMiddleware` + board owner verification. Only the board owner can mint invite tokens. Returns `403` for non-owners and `404` for non-existent boards.

---

### 2. IDOR — Arbitrary User Role Assignment via Member Update
**File**: `backend/main.go` — `POST /api/boards/:id/members/:userId`

**Before**: The board owner could supply any `:userId` in the URL. The backend blindly created a new `BoardMember` record for that user, granting them edit/view access on the owner's board — even if the target user had never visited the board. This allowed owners to "pollute" other users' membership records across boards.

**After**: Added an IDOR guard — the target user must already be associated with the board (existing `BoardMember` or `AccessRequest`). Also added:
- `fmt.Sscanf` return-value check (previously unchecked — `targetUserID` could silently be `0`).
- Owner role protection — prevents downgrading or changing the board owner's own role.

---

### 3. Broken Permission System — Backend Never Sent `UserRole`
**File**: `backend/main.go`, `backend/models.go` — `GET /api/boards/:id`

**Before**: The frontend (`useWebSocket.ts`) read `data.UserRole` from the board API response to decide editor vs. view-only mode. The backend returned the raw `Board` struct via `c.JSON(200, board)`, which **never included a `UserRole` field**. This meant `userRole` was always stuck at its default value `"view"`, completely breaking the real-time permission sync described in the implementation plan (ACCESS_GRANTED events, role downgrades, etc.).

**After**: 
- Added `resolveBoardRole(db, boardID, ownerID, userID)` helper in `models.go` as the **single source of truth** for computing a user's effective role (`"owner"` | `"edit"` | `"view"` | `""`).
- The board endpoint now returns an explicit `gin.H{}` response including `UserRole`.
- Stopped auto-creating `"shared"` `BoardMember` records for every anonymous visitor — only users with a real role (`"edit"` or `"view"`) get tracked.

---

### 4. Invite Token Leak via WebSocket Broadcast
**File**: `backend/client.go` — `readPump()`, line before `hub.publish`

**Before**: When a client sent a WebSocket message containing their `inviteToken` (used for permission checks), the backend broadcast the **entire message** — including that token — to every other client connected to the same board room. This leaked one user's access credentials to all other users in the board.

**After**: `msg.InviteToken` is explicitly cleared to `""` before marshaling and publishing. Invite tokens are now treated as inbound-only credentials that never leave the server.

---

## Medium-severity Fixes

### 5. Unauthorized Board Creation via WebSocket
**File**: `backend/client.go` — `serveWs()`

**Before**: Any authenticated user connecting via WebSocket with a random UUID `boardId` that didn't exist in the database would trigger automatic board creation, making that user the owner. This was an unintended creation path that bypassed `POST /api/boards`.

**After**: Removed auto-creation entirely. If the board doesn't exist, the WebSocket connection is closed immediately. Boards can only be created through the authenticated `POST /api/boards` endpoint.

---

### 6. Rate Limit Had No Teeth
**File**: `backend/client.go` — `readPump()` rate limiter

**Before**: Clients exceeding 15 messages/second received an error message but the connection stayed open. An attacker could continue flooding messages, forcing the server to parse JSON and query the database on every message — a potential DoS vector.

**After**: Added a hard disconnect threshold at 30 messages/second. After the first warning at 15 msg/s, continued abuse triggers `break` in the read loop, which cleanly closes the connection via the deferred `unregister` + `conn.Close()`.

---

### 7. Column & Swimlane Rename/Delete Whitespace Mismatch
**File**: `backend/client.go` — `DELETE_COLUMN`, `RENAME_COLUMN`, `DELETE_SWIMLANE`, `RENAME_SWIMLANE`

**Before**: The loop that matched column/swimlane names used `strings.TrimSpace(col) == msg.ColumnName`, but the subsequent database query for card updates used exact match (`list = msg.ColumnName`). If a column name in the database had leading/trailing whitespace (from legacy data), the column would be removed from the list string but its cards would **not** be deleted or renamed — a silent data inconsistency.

**After**: Changed all four operations to use exact match (`col == msg.ColumnName`, `swim == msg.Swimlane`). Column/swimlane names are already canonicalized (trimmed, comma-stripped) at creation/rename time by the validator, so exact match is both correct and consistent with the card queries.

---

### 8. Frontend Swimlane Card Filter Logic Bug
**File**: `frontend/src/pages/Board.tsx` — swimCards filter

**Before**: The filter expression was:
```ts
c.List === col && (swimlanes.length === 0 || (c.Swimlane || swim || "Untitled") === swim)
```
The fallback chain `c.Swimlane || swim || "Untitled"` meant that when `swim` was a non-empty string and a card had no `Swimlane`, it would evaluate to `swim` and match — showing unassigned cards in every swimlane row.

**After**: Extracted `rowSwim` as a normalized variable, then compare card's swimlane against it:
```ts
const rowSwim = swim || "Untitled";
// ...
(c.Swimlane || "Untitled") === rowSwim
```
Each side is normalized independently, so cards without a swimlane only appear in the "Untitled" row.

---

## Architecture Improvement

### `resolveBoardRole()` — Single Source of Truth
**File**: `backend/models.go`

A new helper function that computes the effective role of any user on any board:

```
owner  → if userID == board.OwnerID
edit   → if BoardMember(role="edit") exists
view   → if BoardMember(role="view") exists
edit   → if AccessRequest(status="approved") exists
""     → no explicit relationship (fall back to AccessLevel / invite token)
```

This ensures the REST API's `GET /api/boards/:id` and any future code paths always agree on a user's permissions. Previously the permission logic was scattered and duplicated across `main.go` and `client.go` with subtle differences.

---

## Verification

| Check | Result |
|-------|--------|
| `go build ./...` | ✅ 0 errors |
| `go test ./...` | ✅ ok (2.6s) |
| `npm run build` (tsc + vite) | ✅ built in 371ms, 0 errors |
| `npx tsc --noEmit` | ✅ 0 type errors |

### Files Modified

| `backend/main.go` | Auth on invite-tokens, IDOR guard on members, UserRole in board response, route reordering |
| `backend/models.go` | Added `resolveBoardRole()` helper |
| `backend/client.go` | Strip inviteToken before broadcast, remove auto-board-creation, rate-limit disconnect, exact match on column/swimlane ops, use `resolveBoardRole` |
| `backend/hub.go` | Fixed concurrent map iteration race in `broadcastRoom` |
| `backend/auth.go` | Added UUID format validation for `boardId` in `GoogleLogin` to prevent redirect manipulation |
| `frontend/src/useAuth.ts` | Fixed TypeScript headers type and added JWT `exp` expiration validation check |
| `frontend/src/pages/Board.tsx` | Fixed swimCards filter logic |

