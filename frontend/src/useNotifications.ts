import { useState, useEffect, useCallback } from "react";
import { API_URL } from "./config";
import { useAuth } from "./useAuth";

export type AccessRequestItem = {
  id: number;
  boardId: string;
  boardName: string;
  userId: number;
  userName: string;
  userEmail: string;
  avatarUrl: string;
  status: "pending" | "approved" | "dismissed";
  createdAt: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AccessRequestItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("kanban_jwt");
    if (!token || !user) return;

    try {
      setIsLoading(true);
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed fetching notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const requestAccess = async (boardId: string): Promise<AccessRequestItem | null> => {
    const token = localStorage.getItem("kanban_jwt");
    if (!token) return null;

    try {
      const res = await fetch(`${API_URL}/api/boards/${boardId}/request-access`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.error("Failed requesting board access:", err);
    }
    return null;
  };

  const respondToAccess = async (requestId: number, action: "approve" | "dismiss"): Promise<boolean> => {
    const token = localStorage.getItem("kanban_jwt");
    if (!token) return false;

    try {
      const res = await fetch(`${API_URL}/api/notifications/${requestId}/respond`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        await fetchNotifications();
        return true;
      }
    } catch (err) {
      console.error("Failed responding to access request:", err);
    }
    return false;
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    requestAccess,
    respondToAccess,
  };
}
