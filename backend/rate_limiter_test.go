package main

import (
	"testing"
	"time"
)

func TestIPRateLimiter(t *testing.T) {
	limiter := newIPRateLimiter(3, 500*time.Millisecond)

	ip := "192.168.1.100"

	// First 3 requests should be allowed
	if !limiter.allow(ip) {
		t.Errorf("expected request 1 to be allowed")
	}
	if !limiter.allow(ip) {
		t.Errorf("expected request 2 to be allowed")
	}
	if !limiter.allow(ip) {
		t.Errorf("expected request 3 to be allowed")
	}

	// 4th request should be blocked
	if limiter.allow(ip) {
		t.Errorf("expected request 4 to be blocked by rate limiter")
	}

	// Wait for window to expire
	time.Sleep(550 * time.Millisecond)

	// Should be allowed again
	if !limiter.allow(ip) {
		t.Errorf("expected request after window expiry to be allowed")
	}
}
