import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { API_URL } from "./config";

export type User = {
  id: number;
  email: string;
  name: string;
  avatarUrl: string;
};

function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT Decode error", e);
    return null;
  }
}

const TOKEN_KEY = "kanban_jwt";

export function useAuth() {
  // Read initial token: real Google tokens from localStorage, Guest tokens from sessionStorage
  const [token, setToken] = useState<string | null>(() => {
    // Purge any legacy guest tokens from localStorage
    const localSaved = localStorage.getItem(TOKEN_KEY);
    if (localSaved) {
      const payload = parseJwt(localSaved);
      if (payload && (payload.email === "guest@kanban.demo" || payload.sub === "guest")) {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        return localSaved;
      }
    }
    // Read session-only token for Guest
    const sessionSaved = sessionStorage.getItem(TOKEN_KEY);
    if (sessionSaved) {
      const payload = parseJwt(sessionSaved);
      if (payload && !payload.exp || (payload.exp * 1000 > Date.now())) {
        return sessionSaved;
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }
    return null;
  });

  const [user, setUser] = useState<User | null>(() => {
    const activeToken = token || sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    if (!activeToken) return null;
    const payload = parseJwt(activeToken);
    const isExpired = payload && payload.exp && payload.exp * 1000 < Date.now();
    if (payload && payload.sub && !isExpired) {
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.avatar,
      };
    }
    return null;
  });

  const [searchParams, setSearchParams] = useSearchParams();

  // Consume a token from the URL (?token=...) once, on mount.
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (!urlToken) return;

    // Real Google OAuth tokens go to localStorage (persistent)
    localStorage.setItem(TOKEN_KEY, urlToken);
    setToken(urlToken);

    // Clean up the URL token but keep everything else.
    const next = new URLSearchParams(searchParams);
    next.delete("token");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (boardId: string) => {
    if (boardId === "guest") {
      try {
        const res = await fetch(`${API_URL}/api/auth/guest`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          // Store Guest tokens ONLY in sessionStorage so they auto-expire when tab closes!
          sessionStorage.setItem(TOKEN_KEY, data.token);
          localStorage.removeItem(TOKEN_KEY);
          setToken(data.token);
          if (data.user) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              avatarUrl: data.user.avatarUrl,
            });
          }
          return;
        }
      } catch (e) {
        console.error("Backend guest login failed", e);
      }
    }
    window.location.href = `${API_URL}/auth/google/login?boardId=${boardId}`;
  }, []);

  // Derive the user from the stored token.
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    if (token.endsWith(".mock_signature")) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      login("guest");
      return;
    }
    const payload = parseJwt(token);
    const isExpired = payload && payload.exp && payload.exp * 1000 < Date.now();
    if (payload && payload.sub && !isExpired) {
      setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.avatar,
      });
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, [token, login]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    window.location.href = "/";
  }, []);

  return { token, user, login, logout };
}
