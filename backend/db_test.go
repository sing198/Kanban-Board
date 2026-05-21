package main

import (
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDBCounter ensures every newTestDB call gets a distinct in-memory SQLite
// database. Without this, `cache=shared` + the same DSN would make every test
// share one database and collide on UNIQUE constraints.
var testDBCounter uint64

// newTestDB returns an in-memory SQLite database with the schema migrated. Each
// call creates a fresh, isolated database so tests don't interfere with each
// other. SQLite is used so integration tests run without a live Postgres.
//
// It is CGO-backed (mattn/go-sqlite3), so `go test ./...` requires CGO.
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	n := atomic.AddUint64(&testDBCounter, 1)
	dsn := fmt.Sprintf("file:testdb%d?mode=memory&cache=shared", n)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}
	// Pin all queries to a single connection so the in-memory DB is consistent
	// (a fresh in-memory DB is created per underlying connection otherwise).
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get underlying sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	if err := MigrateDB(db); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	return db
}

// seedBoard creates a fresh board with the given cards and returns its id.
func seedBoard(t *testing.T, db *gorm.DB, boardID string, cards []Card) {
	t.Helper()
	b := Board{ID: boardID, Name: "Test Board", OwnerID: 1}
	for i := range cards {
		cards[i].BoardID = boardID
	}
	b.Cards = cards
	if err := db.Create(&b).Error; err != nil {
		t.Fatalf("seed board: %v", err)
	}
}

const testBoardID = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
