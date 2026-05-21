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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) return null;
    const payload = parseJwt(savedToken);
    if (payload && payload.sub) {
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

    localStorage.setItem(TOKEN_KEY, urlToken);
    setToken(urlToken);

    // Clean up the URL token but keep everything else.
    const next = new URLSearchParams(searchParams);
    next.delete("token");
    setSearchParams(next, { replace: true });
    // We intentionally only run this on mount to grab the URL token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive the user from the stored token.
  useEffect(() => {
    if (!token) {
      setUser(null);
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
  }, [token]);

  const login = useCallback((boardId: string) => {
    if (boardId === "guest") {
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
      const guestId = Math.floor(Math.random() * 899999) + 100000;
      const payload = btoa(JSON.stringify({
        sub: guestId,
        email: "guest@kanban.demo",
        name: "Guest User",
        avatar: "",
        exp: exp
      }));
      const mockJwt = `${header}.${payload}.mock_signature`;
      localStorage.setItem(TOKEN_KEY, mockJwt);
      setToken(mockJwt);
      return;
    }
    window.location.href = `${API_URL}/auth/google/login?boardId=${boardId}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return { token, user, login, logout };
}
