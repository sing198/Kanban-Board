package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// TestWebSocketBroadcast verifies that a message sent by one client is
// broadcast to the other client via the hub, using the local in-memory path
// (Redis unreachable). Runs entirely against an in-memory SQLite DB, so it does
// not require a running Postgres.
//
// Both clients authenticate via short-lived WS tickets so mutations reach the
// hub's publish channel (unauthenticated clients are rejected before that).
func TestWebSocketBroadcast(t *testing.T) {
	db := newTestDB(t)
	seedBoard(t, db, testBoardID, []Card{
		{Title: "Card A", List: "TODO", Position: 1000},
		{Title: "Card B", List: "TODO", Position: 2000},
	})

	hub := newTestHub(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, db, w, r)
	}))
	defer server.Close()

	// Authenticate both clients with WS tickets for userID=1.
	ticket1 := createWSTicket(1)
	wsURL1 := "ws" + server.URL[4:] + "?boardId=" + testBoardID + "&ticket=" + ticket1
	ws1, _, err := websocket.DefaultDialer.Dial(wsURL1, nil)
	if err != nil {
		t.Fatalf("Client 1 failed to connect: %v", err)
	}
	defer ws1.Close()

	ticket2 := createWSTicket(1)
	wsURL2 := "ws" + server.URL[4:] + "?boardId=" + testBoardID + "&ticket=" + ticket2
	ws2, _, err := websocket.DefaultDialer.Dial(wsURL2, nil)
	if err != nil {
		t.Fatalf("Client 2 failed to connect: %v", err)
	}
	defer ws2.Close()

	time.Sleep(200 * time.Millisecond)

	// Drain the initial state fetch that happens on socket open (serveWs triggers
	// a fetch via the onopen handler in the real frontend, but the server-side
	// doesn't send one — so there should be nothing queued). Send a MOVE_CARD.
	msg := WsMessage{
		Type:     "MOVE_CARD",
		CardId:   "1",
		ToList:   "DOING",
		Position: 1500,
	}
	if err := ws1.WriteJSON(msg); err != nil {
		t.Fatalf("Failed to write message: %v", err)
	}

	ws2.SetReadDeadline(time.Now().Add(2 * time.Second))
	var received WsMessage
	if err := ws2.ReadJSON(&received); err != nil {
		t.Fatalf("Client 2 failed to read message: %v", err)
	}

	// The broadcast may be MOVE_CARD or, if the move triggered a rebalance,
	// a REORDER carrying the renormalized card set. Either proves the broadcast
	// path works end-to-end.
	if received.Type != "MOVE_CARD" && received.Type != "REORDER" {
		t.Fatalf("Expected MOVE_CARD or REORDER broadcast, got %+v", received)
	}
}

// TestServeWsRejectsInvalidBoardID verifies that a non-UUID boardId is rejected
// before the WebSocket is upgraded.
func TestServeWsRejectsInvalidBoardID(t *testing.T) {
	db := newTestDB(t)
	hub := newTestHub(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, db, w, r)
	}))
	defer server.Close()

	// "1" is not a valid UUID.
	_, resp, err := websocket.DefaultDialer.Dial("ws"+server.URL[4:]+"?boardId=1", nil)
	if err == nil {
		t.Fatalf("expected dial to fail for invalid boardId")
	}
	if resp != nil && resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

// TestServeWsAnonymousDoesNotCreateOrphanBoard verifies the fix for the orphan
// board bug: an anonymous (unauthenticated) client connecting to a board that
// does not exist must NOT cause a board to be created.
func TestServeWsAnonymousDoesNotCreateOrphanBoard(t *testing.T) {
	db := newTestDB(t)
	hub := newTestHub(t)

	const newBoard = "12345678-1234-1234-1234-123456789abc"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, db, w, r)
	}))
	defer server.Close()

	// Anonymous dial (no ticket). serveWs upgrades the socket first, discovers
	// the board doesn't exist and the user is anonymous, then closes the
	// connection without creating a board.
	ws, _, _ := websocket.DefaultDialer.Dial("ws"+server.URL[4:]+"?boardId="+newBoard, nil)
	if ws != nil {
		ws.Close()
	}
	// Give the server goroutine a moment to finish serveWs.
	time.Sleep(100 * time.Millisecond)

	var count int64
	db.Model(&Board{}).Where("id = ?", newBoard).Count(&count)
	if count != 0 {
		t.Errorf("anonymous connection created an orphan board")
	}
}
