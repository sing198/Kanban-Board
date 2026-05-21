package main

import (
	"testing"
)

// TestRenormalizePositions verifies that a list whose positions have degraded
// (tiny gaps between cards) gets rewritten to evenly-spaced multiples of
// positionStep while preserving the existing order.
func TestRenormalizePositions(t *testing.T) {
	db := newTestDB(t)

	// Seed: positions are nearly touching (gaps of ~0.0001), order is C,C,D,B,A.
	seedBoard(t, db, testBoardID, []Card{
		{Title: "A", List: "TODO", Position: 1000.0004},
		{Title: "B", List: "TODO", Position: 1000.0003},
		{Title: "C", List: "TODO", Position: 1000.0002},
		{Title: "C2", List: "TODO", Position: 1000.0001},
		{Title: "D", List: "DOING", Position: 500}, // other list, must be untouched
	})

	got, err := renormalizePositions(db, testBoardID, "TODO")
	if err != nil {
		t.Fatalf("renormalizePositions: %v", err)
	}

	if len(got) != 4 {
		t.Fatalf("expected 4 cards, got %d", len(got))
	}

	// Order must be preserved (ascending by old position): C2, C, B, A.
	wantTitles := []string{"C2", "C", "B", "A"}
	wantPositions := []float64{1000, 2000, 3000, 4000}
	for i, c := range got {
		if c.Title != wantTitles[i] {
			t.Errorf("card %d title = %q, want %q", i, c.Title, wantTitles[i])
		}
		// 1000..4000 are exactly representable in float64, so == is safe here.
		if c.Position != wantPositions[i] {
			t.Errorf("card %d (%s) position = %v, want %v", i, c.Title, c.Position, wantPositions[i])
		}
	}

	// The DOING card must be unchanged.
	var doing Card
	if err := db.Where("list = ?", "DOING").First(&doing).Error; err != nil {
		t.Fatalf("query doing card: %v", err)
	}
	if doing.Position != 500 {
		t.Errorf("DOING card position changed: got %v, want 500", doing.Position)
	}
}

// TestRenormalizePositionsEmptyList is a no-op that must not error.
func TestRenormalizePositionsEmptyList(t *testing.T) {
	db := newTestDB(t)
	seedBoard(t, db, testBoardID, nil)

	got, err := renormalizePositions(db, testBoardID, "TODO")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected no cards, got %d", len(got))
	}
}
