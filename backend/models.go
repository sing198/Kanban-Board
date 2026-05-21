package main

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint   `gorm:"primarykey" json:"id"`
	GoogleID  string `gorm:"uniqueIndex" json:"googleId"`
	Email     string `gorm:"uniqueIndex" json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl"`
}

// Board represents a single Kanban board
type Board struct {
	ID          string `gorm:"primarykey;type:uuid" json:"ID"`
	Name        string `json:"Name"`
	OwnerID     uint   `json:"OwnerID"` // Who created the board
	Columns     string `gorm:"default:'TODO,DOING,DONE'" json:"Columns"`
	Swimlanes   string `gorm:"default:''" json:"Swimlanes"`
	AccessLevel string `gorm:"default:'edit'" json:"AccessLevel"`
	Background  string `gorm:"default:'default'" json:"Background"`
	Cards       []Card `gorm:"foreignKey:BoardID" json:"Cards"`
}

// Card represents a task card
type Card struct {
	ID          uint    `gorm:"primarykey" json:"ID"`
	BoardID     string  `gorm:"type:uuid;index" json:"BoardID"`
	Title       string  `json:"Title"`
	Description string  `gorm:"default:''" json:"Description"`
	DueDate     string  `gorm:"default:''" json:"DueDate"`
	Checklist   string  `gorm:"default:''" json:"Checklist"`
	List        string  `gorm:"default:'TODO'" json:"List"` // TODO, DOING, DONE
	Swimlane    string  `gorm:"default:'Untitled'" json:"Swimlane"`
	Position    float64 `gorm:"default:0" json:"Position"`
	Tags        string  `gorm:"default:''" json:"Tags"` // Comma-separated tags e.g. "Bug,Urgent"
}

// BoardMember records shared access and recent visits
type BoardMember struct {
	ID       uint      `gorm:"primarykey" json:"ID"`
	BoardID  string    `gorm:"type:uuid;index" json:"BoardID"`
	UserID   uint      `gorm:"index" json:"UserID"`
	Role     string    `gorm:"default:'edit'" json:"Role"` // "owner", "edit", "view"
	LastSeen time.Time `json:"LastSeen"`
	Board    Board     `gorm:"foreignKey:BoardID" json:"Board,omitempty"`
}

// AccessRequest represents a viewer's request for edit permission on a board
type AccessRequest struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	BoardID   string    `gorm:"type:uuid;index" json:"boardId"`
	BoardName string    `json:"boardName"`
	UserID    uint      `gorm:"index" json:"userId"`
	UserName  string    `json:"userName"`
	UserEmail string    `json:"userEmail"`
	AvatarURL string    `json:"avatarUrl"`
	Status    string    `gorm:"default:'pending'" json:"status"` // "pending", "approved", "dismissed"
	CreatedAt time.Time `json:"createdAt"`
}

// Initialize schemas
func MigrateDB(db *gorm.DB) error {
	return db.AutoMigrate(&Board{}, &Card{}, &User{}, &BoardMember{}, &AccessRequest{})
}

// resolveBoardRole computes the effective role of userID on the board owned by
// ownerID. The returned role is one of:
//   - "owner" — userID owns the board
//   - "edit"  — explicit editor via BoardMember(role=edit) or an approved
//     AccessRequest
//   - "view"  — explicit viewer via BoardMember(role=view)
//   - ""      — no explicit relationship (caller should fall back to the
//     board's AccessLevel / invite token to decide)
//
// This is the single source of truth shared by the REST API and the WebSocket
// handler so the two paths can never disagree about a user's permissions.
func resolveBoardRole(db *gorm.DB, boardID string, ownerID, userID uint) string {
	if userID == 0 {
		return ""
	}
	if ownerID == userID {
		return "owner"
	}
	var mb BoardMember
	if err := db.Where("board_id = ? AND user_id = ?", boardID, userID).First(&mb).Error; err == nil {
		if mb.Role == "edit" {
			return "edit"
		}
		if mb.Role == "view" {
			return "view"
		}
		// "shared" and any other legacy role: treat as view-only presence, not
		// an explicit grant, so it does not silently confer edit rights.
	}
	// An approved AccessRequest upgrades the viewer to editor.
	var ar AccessRequest
	if err := db.Where("board_id = ? AND user_id = ? AND status = 'approved'", boardID, userID).First(&ar).Error; err == nil {
		return "edit"
	}
	return ""
}
