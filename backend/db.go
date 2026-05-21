package main

import (
	"fmt"
	"log"
	"os"
	"sort"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// validLists is the canonical set of Kanban list names. Mutations that target a
// list outside this set are rejected (see validateCardMutation in client.go).
var validLists = map[string]bool{
	"TODO":  true,
	"DOING": true,
	"DONE":  true,
}

// maxTitleLength bounds how long a card title may be. A rogue client could
// otherwise store arbitrarily large strings in the database.
const maxTitleLength = 10000

// positionGapThreshold is the minimum acceptable distance between two adjacent
// card positions in the same list. When a move produces a smaller gap, the list
// is renormalized so subsequent midpoint insertions keep working.
const positionGapThreshold = 1.0

// positionStep is the spacing used when renormalizing a list (1000, 2000, ...).
const positionStep = 1000.0

// minPositionGap returns the smallest gap between two consecutive positions in
// an ascending-sorted slice. Returns +Inf when there are fewer than two cards.
// Pure function — unit tested without a database.
func minPositionGap(positions []float64) float64 {
	if len(positions) < 2 {
		return 0
	}
	sorted := make([]float64, len(positions))
	copy(sorted, positions)
	sort.Float64s(sorted)
	minGap := sorted[1] - sorted[0]
	for i := 2; i < len(sorted); i++ {
		if gap := sorted[i] - sorted[i-1]; gap < minGap {
			minGap = gap
		}
	}
	return minGap
}

func InitDB() *gorm.DB {
	var dsn string

	// 1. เช็คก่อนว่ามี DATABASE_URL ไหม ( Render / Heroku / Production จะส่งค่านี้มา)
	if envURL := os.Getenv("DATABASE_URL"); envURL != "" {
		dsn = envURL
	} else {
		// 2. ถ้าไม่มี DATABASE_URL ให้ใช้การอ่านแบบแยกตัวแปร หรือ Fallback เป็น Local
		host := os.Getenv("DB_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("DB_PORT")
		if port == "" {
			port = "5433"
		}
		user := os.Getenv("DB_USER")
		if user == "" {
			user = "admin"
		}
		password := os.Getenv("DB_PASSWORD")
		if password == "" {
			password = "password"
		}
		dbname := os.Getenv("DB_NAME")
		if dbname == "" {
			dbname = "kanban"
		}

		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Bangkok", host, user, password, dbname, port)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database. Ensure Postgres is running. ", err)
	}

	// AutoMigrate is idempotent and will NOT drop existing data.
	err = MigrateDB(db)
	if err != nil {
		log.Fatal("Failed to migrate database ", err)
	}

	// Create a default board if it doesn't exist
	var count int64
	db.Model(&Board{}).Count(&count)
	if count == 0 {
		defaultUUID := uuid.MustParse("f47ac10b-58cc-4372-a567-0e02b2c3d479").String()
		db.Create(&Board{
			ID:   defaultUUID,
			Name: "Public Real-Time Board",
			Cards: []Card{
				{Title: "Design Architecture", List: "TODO"},
				{Title: "Setup Golang WebSocket", List: "TODO"},
				{Title: "Build React UI", List: "DOING"},
				{Title: "Test Concurrency", List: "DONE"},
			},
		})
	}

	return db
}

// renormalizePositions rewrites the positions of every card in a (board, list)
// to evenly-spaced multiples of positionStep (1000, 2000, 3000, ...), keeping
// their existing relative order. This is called when midpoint insertions have
// squeezed adjacent positions below positionGapThreshold, which would otherwise
// eventually make the gap too small to subdivide with float precision.
//
// It returns the renumbered cards so callers can broadcast them to clients.
func renormalizePositions(db *gorm.DB, boardID, list string) ([]Card, error) {
	var cards []Card
	if err := db.Where("board_id = ? AND list = ?", boardID, list).
		Order("position ASC, id ASC").Find(&cards).Error; err != nil {
		return nil, err
	}
	for i := range cards {
		cards[i].Position = positionStep * float64(i+1)
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		for _, c := range cards {
			if err := tx.Model(&Card{}).Where("id = ?", c.ID).
				Update("position", c.Position).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return cards, nil
}
