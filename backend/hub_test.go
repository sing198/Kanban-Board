package main

import (
	"testing"
	"time"
)

// newTestHub builds a hub against an unreachable Redis address so it falls back
// to local in-memory broadcast (the path we can exercise without a broker).
func newTestHub(t *testing.T) *Hub {
	t.Helper()
	h := &Hub{
		publish:    make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]map[*Client]bool),
		// redisOK=false forces the local broadcast path.
		redisOK: false,
	}
	go h.run()
	return h
}

func makeClient(hub *Hub, boardID string) *Client {
	return &Client{
		hub:     hub,
		send:    make(chan []byte, 256),
		boardID: boardID,
	}
}

// TestHubBroadcastLocal verifies the local (non-Redis) broadcast path: a
// published message reaches every client in the same board room.
func TestHubBroadcastLocal(t *testing.T) {
	hub := newTestHub(t)
	defer close(hub.publish)

	boardID := testBoardID
	c1 := makeClient(hub, boardID)
	c2 := makeClient(hub, boardID)
	c3 := makeClient(hub, "another-board") // must NOT receive this room's msg

	hub.register <- c1
	hub.register <- c2
	hub.register <- c3
	// Give the run() goroutine time to process registrations.
	time.Sleep(50 * time.Millisecond)

	for _, client := range []*Client{c1, c2, c3} {
		for len(client.send) > 0 {
			<-client.send
		}
	}
	payload := []byte(`{"type":"MOVE_CARD","boardId":"` + boardID + `","cardId":"1"}`)
	hub.publish <- payload

	for i, c := range []*Client{c1, c2} {
		select {
		case got := <-c.send:
			if string(got) != string(payload) {
				t.Errorf("client %d: got %q, want %q", i+1, got, payload)
			}
		case <-time.After(time.Second):
			t.Errorf("client %d did not receive broadcast", i+1)
		}
	}

	select {
	case got := <-c3.send:
		t.Errorf("client in another room unexpectedly received message: %q", got)
	case <-time.After(100 * time.Millisecond):
		// expected: no message
	}
}

// TestHubUnregister verifies that an unregistered client's send channel is
// closed (which is the hub's signal that it has been evicted and will receive
// no further messages).
func TestHubUnregister(t *testing.T) {
	hub := newTestHub(t)

	c1 := makeClient(hub, testBoardID)
	hub.register <- c1
	time.Sleep(50 * time.Millisecond)

	hub.unregister <- c1
	time.Sleep(50 * time.Millisecond)

	// After unregister the hub closes c1.send. A receive on a closed channel
	// returns the zero value immediately with ok=false.
	for len(c1.send) > 0 {
		<-c1.send
	}
	_, ok := <-c1.send
	if ok {
		t.Errorf("expected c1.send to be closed after unregister")
	}
}

func TestPresenceDeduplicatesUserTabs(t *testing.T) {
	hub := newTestHub(t)
	first, second := makeClient(hub, testBoardID), makeClient(hub, testBoardID)
	first.userID, second.userID = 1, 1
	first.userName, second.userName = "Alice", "Alice"
	hub.register <- first
	hub.register <- second
	time.Sleep(20 * time.Millisecond)
	if users := hub.GetOnlineUsers(testBoardID); len(users) != 1 {
		t.Fatalf("Expected one person for two tabs, got %+v", users)
	}
	hub.unregister <- second
	time.Sleep(20 * time.Millisecond)
	if users := hub.GetOnlineUsers(testBoardID); len(users) != 1 {
		t.Fatal("Closing one tab removed active user")
	}
	hub.unregister <- first
}
