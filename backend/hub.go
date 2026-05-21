package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"sync"

	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()

type UserPresence struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	AvatarUrl string `json:"avatarUrl"`
}

type Hub struct {
	mu         sync.RWMutex
	rooms      map[string]map[*Client]bool // boardID -> clients
	publish    chan []byte
	register   chan *Client
	unregister chan *Client
	redisDb    *redis.Client
	redisOK    bool
}

func newHub() *Hub {
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "localhost:6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: host,
	})

	redisOK := false
	if err := rdb.Ping(ctx).Err(); err == nil {
		redisOK = true
		log.Println("Redis connected at", host)
	} else {
		log.Println("Redis unavailable, using local in-memory broadcast:", err)
	}

	return &Hub{
		publish:    make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]map[*Client]bool),
		redisDb:    rdb,
		redisOK:    redisOK,
	}
}

// GetOnlineUsers returns list of online users in a board room
func (h *Hub) GetOnlineUsers(boardID string) []UserPresence {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients, ok := h.rooms[boardID]
	if !ok {
		return []UserPresence{}
	}

	seenKey := make(map[string]bool)
	var list []UserPresence
	for client := range clients {
		key := "guest"
		if client.userID != 0 {
			key = fmt.Sprintf("user:%d", client.userID)
		}
		if !seenKey[key] {
			seenKey[key] = true
			list = append(list, UserPresence{
				ID:        client.userID,
				Name:      client.userName,
				AvatarUrl: client.avatarUrl,
			})
		}
	}

	// Deterministic sorting: Registered users first (by ID asc), Guests last
	sort.Slice(list, func(i, j int) bool {
		iIsGuest := list[i].ID == 0 || list[i].Name == "Guest"
		jIsGuest := list[j].ID == 0 || list[j].Name == "Guest"
		if iIsGuest != jIsGuest {
			return !iIsGuest // Real users first
		}
		if list[i].ID != list[j].ID {
			return list[i].ID < list[j].ID
		}
		return list[i].Name < list[j].Name
	})

	return list
}

// broadcastRoom sends a message ONLY to connected local clients in a specific board room.
func (h *Hub) broadcastRoom(boardID string, message []byte) {
	h.mu.RLock()
	clientsMap, ok := h.rooms[boardID]
	if !ok || len(clientsMap) == 0 {
		h.mu.RUnlock()
		return
	}
	clientList := make([]*Client, 0, len(clientsMap))
	for client := range clientsMap {
		clientList = append(clientList, client)
	}
	h.mu.RUnlock()

	var slowClients []*Client
	for _, client := range clientList {
		select {
		case client.send <- message:
		default:
			slowClients = append(slowClients, client)
		}
	}

	if len(slowClients) > 0 {
		h.mu.Lock()
		if currentMap, ok := h.rooms[boardID]; ok {
			for _, client := range slowClients {
				if _, exists := currentMap[client]; exists {
					delete(currentMap, client)
					close(client.send)
				}
			}
			if len(currentMap) == 0 {
				delete(h.rooms, boardID)
			}
		}
		h.mu.Unlock()
	}
}

func (h *Hub) run() {
	var redisCh <-chan *redis.Message
	if h.redisOK {
		pubsub := h.redisDb.PSubscribe(ctx, "board:*")
		defer pubsub.Close()
		redisCh = pubsub.Channel()
	}

	for {
		select {
		case client := <-h.register:
			if client.boardID == "" {
				continue
			}
			h.mu.Lock()
			if h.rooms[client.boardID] == nil {
				h.rooms[client.boardID] = make(map[*Client]bool)
			}
			h.rooms[client.boardID][client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.rooms[client.boardID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.send)
				}
				if len(clients) == 0 {
					delete(h.rooms, client.boardID)
				}
			}
			h.mu.Unlock()

		case message := <-h.publish:
			var msg WsMessage
			boardID := ""
			if err := json.Unmarshal(message, &msg); err == nil {
				boardID = msg.BoardId
			}

			if boardID == "" {
				continue
			}

			if h.redisOK {
				channel := fmt.Sprintf("board:%s", boardID)
				if err := h.redisDb.Publish(ctx, channel, message).Err(); err != nil {
					log.Println("Error publishing to redis, falling back to local:", err)
					h.broadcastRoom(boardID, message)
				}
			} else {
				h.broadcastRoom(boardID, message)
			}

		case redisMsg := <-redisCh:
			// redisMsg.Channel is "board:<boardID>"
			boardID := strings.TrimPrefix(redisMsg.Channel, "board:")
			if boardID != "" {
				h.broadcastRoom(boardID, []byte(redisMsg.Payload))
			}
		}
	}
}
