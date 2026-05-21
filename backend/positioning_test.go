package main

import (
	"math"
	"testing"
)

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) <= 1e-9
}

func TestMinPositionGap(t *testing.T) {
	tests := []struct {
		name      string
		positions []float64
		want      float64
	}{
		{"empty", []float64{}, 0},
		{"single", []float64{1000}, 0},
		{"two sorted", []float64{1000, 2000}, 1000},
		{"two unsorted", []float64{2000, 1000}, 1000},
		{"multiple unsorted", []float64{3000, 1000, 2000, 2001}, 1},
		{"degenerate gap", []float64{1000, 1000.0001}, 0.0001},
		{"negative-ish min", []float64{0, 5000, 5001}, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := minPositionGap(tt.positions)
			// Compare with tolerance: floats like 1000.0001 - 1000 are not exact
			// in IEEE-754, so an exact == assertion would be flaky.
			if !almostEqual(got, tt.want) {
				t.Errorf("minPositionGap(%v) = %v, want %v", tt.positions, got, tt.want)
			}
		})
	}
}

// TestMinPositionGapDoesNotMutateInput guards against an implementation that
// sorts the caller's slice in place.
func TestMinPositionGapDoesNotMutateInput(t *testing.T) {
	in := []float64{3000, 1000, 2000}
	_ = minPositionGap(in)
	if in[0] != 3000 || in[1] != 1000 || in[2] != 2000 {
		t.Errorf("input slice was mutated: %v", in)
	}
}

func TestTrimTitle(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"plain", "hello", "hello"},
		{"surrounding whitespace", "  hello  ", "hello"},
		{"empty after trim", "   ", ""},
		{"overlong clipped", stringOfLen(maxTitleLength + 500), stringOfLen(maxTitleLength)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := trimTitle(tt.in)
			if got != tt.want {
				t.Errorf("trimTitle(%q len=%d) = %q (len=%d), want %q (len=%d)",
					tt.in, len(tt.in), got, len(got), tt.want, len(tt.want))
			}
		})
	}
}

func stringOfLen(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = 'x'
	}
	return string(b)
}

func TestValidateCardMutation(t *testing.T) {
	tests := []struct {
		name      string
		msg       WsMessage
		wantValid bool
		wantErr   string
	}{
		{"move valid", WsMessage{Type: "MOVE_CARD", CardId: "1", ToList: "DOING", Position: 1500}, true, ""},
		{"move bad list", WsMessage{Type: "MOVE_CARD", CardId: "1", ToList: "   ", Position: 1}, false, "Invalid target list."},
		{"move missing cardId", WsMessage{Type: "MOVE_CARD", ToList: "DOING", Position: 1}, false, "Missing cardId."},
		{"move negative position", WsMessage{Type: "MOVE_CARD", CardId: "1", ToList: "DOING", Position: -1}, false, "Position must be non-negative."},
		{"add valid", WsMessage{Type: "ADD_CARD", Title: "task", ToList: "TODO", Position: 1000}, true, ""},
		{"add empty title", WsMessage{Type: "ADD_CARD", Title: "   ", ToList: "TODO"}, false, "Card title cannot be empty."},
		{"add trims title", WsMessage{Type: "ADD_CARD", Title: "  task  ", ToList: "TODO"}, true, ""},
		{"edit valid", WsMessage{Type: "EDIT_CARD", CardId: "1", Title: "renamed"}, true, ""},
		{"edit empty title", WsMessage{Type: "EDIT_CARD", CardId: "1", Title: ""}, false, "Card title cannot be empty."},
		{"delete valid", WsMessage{Type: "DELETE_CARD", CardId: "1"}, true, ""},
		{"delete missing cardId", WsMessage{Type: "DELETE_CARD"}, false, "Missing cardId."},
		{"unknown type", WsMessage{Type: "NUKE_EVERYTHING"}, false, "Unknown message type."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, reason := validateCardMutation(tt.msg)
			valid := reason == ""
			if valid != tt.wantValid {
				t.Errorf("valid=%v want %v (reason=%q)", valid, tt.wantValid, reason)
			}
			if !tt.wantValid && reason == "" {
				t.Errorf("expected an error reason but got none")
			}
			if tt.wantValid && reason != "" {
				t.Errorf("expected no error but got %q", reason)
			}
		})
	}
}
