package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

var (
	googleOauthConfig *oauth2.Config
	jwtSecret         []byte
)

const oauthStateCookie = "oauth_state"

// initJWTSecret loads the HMAC signing key from the environment and fails fast
// at boot if it is missing or too short. A hardcoded secret is a real security
// hole (anyone with the source can forge tokens), so we refuse to run without
// a proper one.
func initJWTSecret() {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	if len(s) < 32 {
		log.Fatalf("JWT_SECRET must be at least 32 characters (got %d)", len(s))
	}
	jwtSecret = []byte(s)
}

func InitOAuth() {
	redirectURL := os.Getenv("OAUTH_REDIRECT_URL")
	if redirectURL == "" {
		redirectURL = "http://localhost:8080/auth/google/callback"
	}
	googleOauthConfig = &oauth2.Config{
		RedirectURL:  redirectURL,
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}
}

// GenerateJWT creates a token for the authenticated user.
func GenerateJWT(user User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":    user.ID,
		"email":  user.Email,
		"name":   user.Name,
		"avatar": user.AvatarURL,
		"exp":    time.Now().Add(time.Hour * 72).Unix(),
	})
	return token.SignedString(jwtSecret)
}

// parseJWT validates a token using the configured secret and restricts the
// accepted algorithm to HS256 (prevents "none" / algorithm-confusion attacks).
func parseJWT(tokenString string) (*jwt.Token, error) {
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
}

// --- OAuth state (CSRF) handling ---
//
// The OAuth `state` parameter must be an unpredictable nonce bound to the user
// session to prevent CSRF. The previous code set it to a constant string AND
// overloaded it to carry the boardId, which defeated both purposes.
//
// We now generate a random nonce per request, store it in a short-lived cookie,
// and carry the boardId alongside it inside the opaque state string:
//     state = "<nonce>|<boardId>"

func generateNonce() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		log.Fatal("failed to generate random nonce: ", err)
	}
	return hex.EncodeToString(b)
}

func buildState(nonce, boardID string) string {
	return nonce + "|" + boardID
}

func parseState(state string) (nonce, boardID string, ok bool) {
	parts := strings.SplitN(state, "|", 2)
	if len(parts) != 2 || parts[0] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func setStateCookie(c *gin.Context, nonce string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    nonce,
		Path:     "/",
		MaxAge:   300, // 5 minutes is plenty for the OAuth round-trip
		HttpOnly: true,
		Secure:   os.Getenv("COOKIE_SECURE") == "true",
		SameSite: http.SameSiteLaxMode,
	})
}

func GoogleLogin(c *gin.Context) {
	boardID := c.Query("boardId")
	if boardID == "" {
		boardID = "default"
	} else if boardID != "default" {
		if _, err := uuid.Parse(boardID); err != nil {
			boardID = "default"
		}
	}
	nonce := generateNonce()
	setStateCookie(c, nonce)
	url := googleOauthConfig.AuthCodeURL(buildState(nonce, boardID))
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func GoogleCallback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Verify the OAuth state against the nonce we stored in the cookie.
		nonce, boardID, ok := parseState(c.Query("state"))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid oauth state"})
			return
		}
		cookie, err := c.Cookie(oauthStateCookie)
		if err != nil || cookie == "" || cookie != nonce {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "OAuth state mismatch"})
			return
		}
		// Clear the single-use nonce cookie.
		http.SetCookie(c.Writer, &http.Cookie{
			Name: oauthStateCookie, Value: "", Path: "/", MaxAge: -1,
		})

		token, err := googleOauthConfig.Exchange(context.Background(), c.Query("code"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Code exchange failed: " + err.Error()})
			return
		}

		response, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + token.AccessToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed getting user info"})
			return
		}
		defer response.Body.Close()

		var userInfo struct {
			Id      string `json:"id"`
			Email   string `json:"email"`
			Name    string `json:"name"`
			Picture string `json:"picture"`
		}
		if err := json.NewDecoder(response.Body).Decode(&userInfo); err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed decoding user info"})
			return
		}

		var user User
		// Find or Create User
		result := db.Where("email = ?", userInfo.Email).First(&user)
		if result.Error != nil {
			// A real DB error (not "not found") must not be masked as a new user.
			if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + result.Error.Error()})
				return
			}
			user = User{
				GoogleID:  userInfo.Id,
				Email:     userInfo.Email,
				Name:      userInfo.Name,
				AvatarURL: userInfo.Picture,
			}
			db.Create(&user)
		} else {
			// Update profile picture/name in case it changed
			user.Name = userInfo.Name
			user.AvatarURL = userInfo.Picture
			db.Save(&user)
		}

		jwtToken, err := GenerateJWT(user)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			frontendURL = "http://localhost:5173"
		}
		var redirectURL string
		if boardID == "default" {
			redirectURL = fmt.Sprintf("%s/?token=%s", frontendURL, jwtToken)
		} else {
			redirectURL = fmt.Sprintf("%s/b/%s?token=%s", frontendURL, boardID, jwtToken)
		}
		c.Redirect(http.StatusTemporaryRedirect, redirectURL)
	}
}

// BoardInviteClaims represents an invite link token carrying boardID and role (edit/view)
type BoardInviteClaims struct {
	BoardID string `json:"board_id"`
	Role    string `json:"role"` // "edit" or "view"
	jwt.RegisteredClaims
}

// GenerateBoardInviteToken creates a signed JWT invite token for a board role
func GenerateBoardInviteToken(boardID string, role string) (string, error) {
	claims := BoardInviteClaims{
		BoardID: boardID,
		Role:    role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(365 * 24 * time.Hour)), // 1 year validity
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// VerifyBoardInviteToken verifies and parses a board invite token
func VerifyBoardInviteToken(tokenString string) (boardID string, role string, err error) {
	token, err := jwt.ParseWithClaims(tokenString, &BoardInviteClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !token.Valid {
		return "", "", errors.New("invalid or tampered invite token")
	}
	claims, ok := token.Claims.(*BoardInviteClaims)
	if !ok {
		return "", "", errors.New("invalid token claims")
	}
	return claims.BoardID, claims.Role, nil
}
