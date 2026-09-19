package main

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

// createBoard commits the board, owner membership and optional sample cards together.
func createBoard(db *gorm.DB, ownerID uint, name string, demo bool) (Board, error) {
	board := Board{ID: uuid.New().String(), Name: name, OwnerID: ownerID}
	if demo {
		board.Name = "Product Launch · Demo"
		board.Columns = "TODO,DOING,DONE"
		board.Swimlanes = "Product,Engineering"
		board.Cards = []Card{
			{Title: "Drag this card into DOING", Description: "Move this task to another column. Open the same board in a second tab to watch changes arrive live.", List: "TODO", Swimlane: "Product", Position: 1000, Tags: "Getting started"},
			{Title: "Write the launch announcement", Description: "Click a card to explore its description, tags and checklist.", List: "TODO", Swimlane: "Product", Position: 2000, Tags: "Content"},
			{Title: "Review the mobile layout", Description: "Check the board on a narrow screen before launch.", List: "DOING", Swimlane: "Engineering", Position: 1000, Tags: "UI"},
			{Title: "Test live collaboration", Description: "Share the board link and move a card while both windows are open.", List: "DOING", Swimlane: "Engineering", Position: 2000, Tags: "Testing"},
			{Title: "Define launch milestones", Description: "An example of a completed task. This board contains sample data.", List: "DONE", Swimlane: "Product", Position: 1000, Tags: "Planning"},
		}
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&board).Error; err != nil {
			return err
		}
		return tx.Create(&BoardMember{BoardID: board.ID, UserID: ownerID, Role: "owner", LastSeen: time.Now()}).Error
	})
	return board, err
}
