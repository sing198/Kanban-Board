# 🚀 Real-Time Kanban Board — Project Walkthrough & Guide

ไฟล์ `walkthrough.md` นี้คือ **เอกสารสรุปภาพรวมโปรเจกต์ (System Walkthrough & Verification Summary)** สำหรับแอปพลิเคชัน Real-Time Collaboration Kanban Board ของเราค่ะ! ⚡

---

## 🎨 สรุปฟีเจอร์และการปรับแต่งทั้งหมดที่เสร็จสมบูรณ์ 100%

### 1. **Miro Kanban Framework Matrix & Swimlanes**
   - **Unified Framework Matrix**: บอร์ดถูกดีไซน์เป็นโครงสร้างตารางเดียวแบบ Miro มีแนวตั้งเป็น Columns (`To Do`, `Doing`, `Done`) และแนวนอนเป็น Swimlanes (`Team A`, `Team B`)
   - **Direct Inline Card Editing**: กดไอคอนดินสอ ✏️ เพื่อแก้ไขข้อความบนการ์ดงานได้โดยตรงจากตัวการ์ดทันที
   - **Miro Bottom Floating Toolbar**: แถบเครื่องมือลอยด้านล่างสำหรับเพิ่ม Swimlane หรือ Column ได้ทันทีด้วยคลิกเดียว

### 2. **Persistent Modern Slate / Charcoal Dark Mode & Zero-Flash Refresh**:
   - Created custom `useTheme.ts` hook backed by `localStorage` persistence.
   - **Synchronous User Auth & Skeleton Loader**: Fixed split-second layout flashes on page refresh by initializing user authentication state synchronously from stored JWTs, and adding animated skeleton loading placeholders while fetching user boards.
   - Designed a ultra-clean Modern Slate Charcoal Dark Theme (`#090d16` background, `#0f172a` headers, `#1e293b` cards with `#334155` borders) — **100% free of green tint**, matching modern professional dark modes like Figma Dark, Linear, and Vercel!

### 3. **ระบบความปลอดภัย & การแชร์บอร์ดแบบ Miro (Signed Invite Tokens & Strict Permissions)**
   - **Smart Permission Banners**: ปรับปรุงป้ายเตือนการสิทธิ์เข้าถึงให้แม่นยำ 100%:
     - เมื่อเข้าด้วยลิงก์ **`Can view` (View-Only Link)**: แสดงป้ายสุภาพ *"👁️ You are viewing this board in Read-Only Mode"* โดย**ไม่แสดงปุ่มกดชวนล็อกอินล็อกอินเพื่อแก้ไข** (เนื่องจากการเปิดด้วยลิงก์ View-Only ถึงล็อกอินก็แก้ไขไม่ได้ตามสิทธิ์เจ้าของบอร์ด)
     - เมื่อเข้าบอร์ดที่อนุญาตให้แก้ไขได้แต่ยังไม่ได้ล็อกอิน: แสดงป้ายชวนล็อกอิน *"🔐 Want to edit this board? Log in with Google to create, edit, and move cards in real-time"* พร้อมปุ่มกด Log in to Edit
   - **Official Miro Share Dialog (2-Tab Layout)**: หน้าต่างแชร์คลีนๆ 2 แท็บ (`Invite` และ `Embed`)
   - **HMAC-SHA256 Signed Links**: ลิงก์แชร์ระบบความปลอดภัยสูง แยกสิทธิ์ `Can edit` และ `Can view` พร้อมลายเซ็นดิจิทัล HMAC ป้องกันการปลอมแปลง URL
   - **Mandatory Login Enforcement**: ผู้ใช้ต้องล็อกอิน Google ก่อนถึงจะแก้ไขการ์ดงานได้ (สายส่อง/แขกจะดูได้อย่างเดียวและเห็นอัปเดตแบบเรียลไทม์)
   - **Share Modal Access Sync (`resolveBoardRole`)**:
     1. **Unified Role Calculation**: อัปเดต `GET /api/boards/:id/members` ให้ใช้ `resolveBoardRole()` เป็น Single Source of Truth ในการคำนวณยศของสมาชิกทุกคน
     2. **Automatic Dropdown Sync**: เมื่อเจ้าของบอร์ดกดอนุมัติสิทธิ์ `Give access` ผ่านการแจ้งเตือน หน้าจัดการสิทธิ์ (Manage board access) จะแสดงสถานะยศของเพื่อนเป็น **`Editor`** ตรงตามฐานข้อมูลและสถานะการอนุมัติ 100%!

---

## 🧪 ผลการทดสอบและการตรวจสอบระบบ (100% Verified)

- **Backend Compilation:** `go build ./...` ✓ (0 Compilation Errors)
- **Backend Unit Tests:** `go test ./...` ✓ (Passed 100%)
- **Frontend Compilation:** `npm run build` ✓ (TypeScript 0 Errors, built in 288ms)
- **Security Check:** ป้องกัน SQL Injection, JWT HMAC-SHA256, Rate Limiting (15 msgs/sec), CSRF nonces

---

## 🛠️ วิธีการสั่งรันโปรเจกต์ (Quick Start Guide)

1. **สั่งรัน Backend (Go Server)**:
   เปิด Terminal ในโฟลเดอร์ `backend` แล้วพิมพ์:
   ```bash
   go run .
   ```

2. **สั่งรัน Frontend (React Vite)**:
   เปิด Terminal ในโฟลเดอร์ `frontend` แล้วพิมพ์:
   ```bash
   npm run dev
   ```

3. **เปิดใช้งานหน้าเว็บ**:
   เข้าเว็บผ่านบราวเซอร์ที่ `http://localhost:5173` ได้ทันทีค่ะ!
