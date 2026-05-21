import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../useAuth";
import { useTheme } from "../useTheme";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  Plus,
  Sparkles,
  Edit2,
  Trash2,
  Search,
  Star,
  FolderKanban,
  LayoutGrid,
  List as ListIcon,
  Sun,
  Moon,
  Bell,
  X,
  Check
} from "lucide-react";
import { API_URL } from "../config";
import { useNotifications } from "../useNotifications";

type UserPresence = {
  id: number;
  name: string;
  avatarUrl: string;
  email?: string;
};

type Board = {
  ID: string;
  Name: string;
  Cards: any[];
  OwnerID?: number;
  IsOwner?: boolean;
  OnlineUsers?: UserPresence[];
};

function AvatarImage({ src, name, className, title }: { src: string; name: string; className: string; title?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-[#4262ff] to-indigo-600 text-white font-extrabold flex items-center justify-center uppercase shadow-xs text-[10px]`}
        title={title || name}
      >
        {name ? name[0].toUpperCase() : "U"}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      title={title || name}
    />
  );
}

export default function Dashboard() {
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, respondToAccess } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "my" | "shared" | "starred">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [renameModalData, setRenameModalData] = useState<{ boardId: string; name: string } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);

  const [deleteModalData, setDeleteModalData] = useState<{ boardId: string; name: string } | null>(null);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const navigate = useNavigate();

  const renderOnlineAvatars = (users?: UserPresence[], size: "sm" | "md" = "sm") => {
    if (!users || users.length === 0) {
      return <span className="text-[10px] text-slate-400 opacity-60">0 online</span>;
    }

    // Filter out lingering Guest User presence if current user is logged in with a real Google account
    const filteredUsers = users.filter((u) => {
      if (!u) return false;
      const isGuestPresence = u.name === "Guest" || u.name === "Guest User" || (u.email && u.email === "guest@kanban.demo") || u.name?.toLowerCase().includes("guest") || u.id === 0;
      if (user && user.email !== "guest@kanban.demo" && isGuestPresence) {
        return false;
      }
      return true;
    });

    if (filteredUsers.length === 0) {
      return <span className="text-[10px] text-slate-400 opacity-60">0 online</span>;
    }

    // Strict client-side deduplication by ID, Name, or Guest!
    const seen = new Set<string>();
    const uniqueUsers: UserPresence[] = [];

    for (const u of filteredUsers) {
      if (!u) continue;
      const isGuest = u.name === "Guest" || u.name === "Guest User" || (u.email && u.email === "guest@kanban.demo") || u.name?.toLowerCase().includes("guest") || !u.name || u.id === 0;
      const key = (!isGuest && u.id && u.id > 0)
        ? `user-id:${u.id}`
        : (!isGuest && u.name)
          ? `user-name:${u.name.toLowerCase().trim()}`
          : "guest-visitor";

      if (!seen.has(key)) {
        seen.add(key);
        uniqueUsers.push(u);
      }
    }

    // Deterministic sorting: Users with avatar image first, then initial badges, Guests last
    uniqueUsers.sort((a, b) => {
      const aIsGuest = a.name === "Guest" || a.name === "Guest User" || (a.email && a.email === "guest@kanban.demo") || a.name?.toLowerCase().includes("guest") || !a.name || a.id === 0;
      const bIsGuest = b.name === "Guest" || b.name === "Guest User" || (b.email && b.email === "guest@kanban.demo") || b.name?.toLowerCase().includes("guest") || !b.name || b.id === 0;
      if (aIsGuest !== bIsGuest) return aIsGuest ? 1 : -1;

      const aHasImg = !!a.avatarUrl;
      const bHasImg = !!b.avatarUrl;
      if (aHasImg !== bHasImg) return aHasImg ? -1 : 1;

      return (a.name || "").localeCompare(b.name || "");
    });

    const maxVisible = 3;
    const visibleUsers = uniqueUsers.slice(0, maxVisible);
    const remainingCount = uniqueUsers.length - maxVisible;

    const imgSize = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs";
    const spaceOffset = size === "sm" ? "-space-x-1.5" : "-space-x-2";

    return (
      <div className={`flex items-center ${spaceOffset} overflow-hidden`}>
        {visibleUsers.map((u, i) => {
          const isGuest = u.name === "Guest" || !u.name || u.id === 0;
          return isGuest ? (
            <div
              key={u.id || `guest-${i}`}
              className={`inline-flex ${imgSize} rounded-full ring-2 ring-white dark:ring-[#1e293b] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 items-center justify-center shadow-xs font-bold`}
              title="Guest Visitor (Online)"
            >
              👤
            </div>
          ) : (
            <AvatarImage
              key={u.id || `avatar-${i}`}
              src={u.avatarUrl}
              name={u.name || "User"}
              className={`inline-block ${imgSize} rounded-full ring-2 ring-white dark:ring-[#1e293b] object-cover`}
              title={`${u.name || "User"} (Online)`}
            />
          );
        })}
        {remainingCount > 0 && (
          <div className={`inline-flex ${imgSize} rounded-full ring-2 ring-white dark:ring-[#1e293b] bg-slate-800 text-white font-bold items-center justify-center text-[10px]`}>
            +{remainingCount}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (user) {
      fetchBoards(true);

      // Delayed fetch to capture WS unregisters right after route changes
      const timer = setTimeout(() => fetchBoards(false), 400);

      // Live polling interval so online profile avatars update automatically without F5
      const interval = setInterval(() => fetchBoards(false), 2500);

      // Refetch on tab/window focus
      const handleFocus = () => fetchBoards(false);
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleFocus);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleFocus);
      };
    } else {
      setIsLoadingBoards(false);
    }
  }, [user]);

  const fetchBoards = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoadingBoards(true);
      const res = await fetch(`${API_URL}/api/me/boards`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("kanban_jwt")}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setBoards(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch boards", err);
    } finally {
      setIsLoadingBoards(false);
    }
  };

  const createNewBoard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/boards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("kanban_jwt")}`,
        },
        body: JSON.stringify({ name: "Untitled Board" }),
      });
      if (res.ok) {
        const newBoard = await res.json();
        navigate(`/b/${newBoard.ID}`);
      }
    } catch (err) {
      console.error("Failed to create board", err);
    }
  };

  const openRenameModal = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setRenameModalData({ boardId: id, name });
    setRenameInputValue(name);
  };

  const handleSaveRename = async () => {
    if (!renameModalData || !renameInputValue.trim()) return;

    try {
      setIsSavingRename(true);
      const res = await fetch(`${API_URL}/api/boards/${renameModalData.boardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("kanban_jwt")}`,
        },
        body: JSON.stringify({ name: renameInputValue.trim() }),
      });
      if (res.ok) {
        setBoards(boards.map(b => b.ID === renameModalData.boardId ? { ...b, Name: renameInputValue.trim() } : b));
      }
    } catch (err) {
      console.error("Failed to rename board", err);
    } finally {
      setIsSavingRename(false);
      setRenameModalData(null);
    }
  };

  const openDeleteModal = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteModalData({ boardId: id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalData) return;

    try {
      setIsDeletingBoard(true);
      const res = await fetch(`${API_URL}/api/boards/${deleteModalData.boardId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("kanban_jwt")}`,
        },
      });
      if (res.ok) {
        setBoards(boards.filter(b => b.ID !== deleteModalData.boardId));
      }
    } catch (err) {
      console.error("Failed to delete board", err);
    } finally {
      setIsDeletingBoard(false);
      setDeleteModalData(null);
    }
  };

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setStarredIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredBoards = useMemo(() => {
    return boards.filter(board => {
      const matchesSearch = board.Name.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesTab = true;
      if (activeTab === "starred") matchesTab = starredIds.includes(board.ID);
      else if (activeTab === "my") matchesTab = !!board.IsOwner;
      else if (activeTab === "shared") matchesTab = !board.IsOwner;
      return matchesSearch && matchesTab;
    });
  }, [boards, searchQuery, activeTab, starredIds]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060b13] via-[#0b1329] to-[#060b13] text-white flex items-center justify-center font-sans overflow-hidden p-6 relative selection:bg-blue-500/30">
        {/* Glowing Background Ambient Orbs */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full bg-[#0f172a]/80 backdrop-blur-2xl p-8 sm:p-10 flex flex-col items-center relative z-10 text-center border border-slate-700/50 shadow-2xl rounded-3xl gap-6">

          {/* Logo Badge */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2563eb] via-[#4f46e5] to-[#38bdf8] p-[2px] shadow-lg shadow-blue-500/30">
              <div className="w-full h-full bg-[#0f172a] rounded-[14px] flex items-center justify-center p-2 gap-1">
                <div className="w-2 h-full rounded-xs bg-gradient-to-b from-blue-400 to-blue-600 shadow-2xs" />
                <div className="w-2 h-4/5 rounded-xs bg-gradient-to-b from-sky-300 to-indigo-500 shadow-2xs" />
                <div className="w-2 h-3/5 rounded-xs bg-gradient-to-b from-indigo-400 to-purple-500 shadow-2xs" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Kanban Board
              </h1>
            </div>
          </div>

          <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
            Collaborative Kanban workspace with zero-latency WebSocket sync, custom swimlanes, and role-based permissions.
          </p>

          {/* Action Buttons Stack */}
          <div className="w-full flex flex-col gap-3 pt-2">
            <button
              onClick={() => login("default")}
              className="w-full py-3.5 px-4 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-sm cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Continue with Google
            </button>

            <button
              onClick={() => login("guest")}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] text-sm cursor-pointer"
            >
              <Sparkles size={16} />
              Guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-200 selection:bg-blue-500/20 ${theme === "dark" ? "bg-[#090d16] text-[#f8fafc]" : "bg-[#f8fafc] text-slate-900"
      }`}>

      {/* HEADER */}
      <header className={`px-8 py-4 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-20 transition-colors ${theme === "dark" ? "bg-[#0f172a]/95 border-[#1e293b]" : "bg-white border-gray-200 shadow-xs"
        }`}>
        <div className="flex items-center gap-3.5 group cursor-pointer select-none">
          {/* Sleek Gradient Glowing Logo Badge */}
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#2563eb] via-[#4f46e5] to-[#38bdf8] p-[1.5px] shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 group-hover:scale-105 transition-all duration-200">
            <div className="w-full h-full bg-[#0f172a] rounded-[14px] flex items-center justify-center p-1.5 gap-0.5">
              <div className="w-1.5 h-full rounded-xs bg-gradient-to-b from-blue-400 to-blue-600 shadow-2xs" />
              <div className="w-1.5 h-3/4 rounded-xs bg-gradient-to-b from-sky-300 to-indigo-500 shadow-2xs" />
              <div className="w-1.5 h-1/2 rounded-xs bg-gradient-to-b from-indigo-400 to-purple-500 shadow-2xs" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-extrabold tracking-tight flex items-center">
              <span className="bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#0284c7] dark:from-white dark:via-slate-100 dark:to-sky-400 bg-clip-text text-transparent">
                Kanban
              </span>
              <span className="text-slate-800 dark:text-slate-200 ml-1">Board</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${theme === "dark"
              ? "bg-[#1e293b] text-amber-400 hover:bg-[#334155] border-[#334155]"
              : "bg-gray-100 text-slate-700 hover:bg-gray-200 border-gray-200"
              }`}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            onClick={createNewBoard}
            className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer ${theme === "dark"
              ? "bg-[#2563eb] hover:bg-[#1d4ed8] shadow-md shadow-blue-500/20"
              : "bg-[#4262ff] hover:bg-[#3551d8] shadow-md shadow-blue-500/20"
              }`}
          >
            <Plus size={16} /> Create New Board
          </button>

          <div className={`flex items-center gap-3 px-3.5 py-1.5 rounded-xl border ${theme === "dark" ? "bg-[#1e293b] border-[#334155]" : "bg-gray-50 border-gray-200"
            }`}>
            <AvatarImage
              src={user.avatarUrl}
              name={user.name}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span className={`text-xs font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}>
              {user.name}
            </span>
          </div>

          {/* Notifications Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`p-2 rounded-xl border transition-all cursor-pointer relative ${theme === "dark"
                ? "bg-[#1e293b] text-slate-200 hover:bg-[#334155] border-[#334155]"
                : "bg-gray-100 text-slate-700 hover:bg-gray-200 border-gray-200"
                }`}
              title="Notifications"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0f172a] shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel (Miro Screenshot 4 & 5) */}
            {isNotificationsOpen && (
              <div className={`absolute right-0 mt-2 w-80 md:w-96 rounded-2xl border shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-100" : "bg-white border-gray-200 text-slate-800"
                }`}>
                <div className="flex items-center justify-between border-b pb-3 mb-3 border-gray-100 dark:border-[#334155]">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {unreadCount} unread
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${item.status === "pending"
                          ? theme === "dark" ? "bg-blue-950/20 border-blue-800/40" : "bg-blue-50/50 border-blue-100"
                          : theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-gray-50 border-gray-100"
                          }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <AvatarImage
                            src={item.avatarUrl}
                            name={item.userName}
                            className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs leading-snug">
                              <span className="font-bold">{item.userName}</span> requests access to your board <span className="font-semibold text-blue-500">{item.boardName}</span>
                            </p>

                            {/* Notification Actions */}
                            <div className="mt-2.5 flex items-center gap-2">
                              {item.status === "pending" ? (
                                <>
                                  <button
                                    onClick={() => respondToAccess(item.id, "approve")}
                                    className="px-3 py-1 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs"
                                  >
                                    Give access
                                  </button>
                                  <button
                                    onClick={() => respondToAccess(item.id, "dismiss")}
                                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                                  >
                                    Dismiss
                                  </button>
                                </>
                              ) : item.status === "approved" ? (
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <Check size={14} /> Request approved
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">
                                  Request dismissed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className={`p-2 rounded-xl border transition-colors ${theme === "dark"
              ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-transparent"
              : "bg-gray-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-gray-200"
              }`}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl w-full mx-auto px-8 py-8 flex-1 space-y-8">

        {/* ACTION BAR: SEARCH, TABS, VIEW TOGGLE */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${theme === "dark" ? "border-[#1e293b]" : "border-gray-200"
          }`}>

          {/* Tabs */}
          <div className={`flex items-center gap-2 w-fit flex-wrap p-1.5 rounded-2xl border ${theme === "dark" ? "bg-[#0f172a] border-[#1e293b]" : "bg-gray-100/80 border-gray-200"
            }`}>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "all"
                ? theme === "dark" ? "bg-[#2563eb] text-white shadow-md shadow-blue-500/20" : "bg-[#4262ff] text-white shadow-md shadow-blue-500/20"
                : theme === "dark" ? "bg-[#1e293b] border border-[#334155] text-slate-300 hover:bg-[#334155]" : "bg-white border border-gray-200 text-slate-600 hover:bg-gray-50 hover:text-slate-900"
                }`}
            >
              All Boards ({boards.length})
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "my"
                ? theme === "dark" ? "bg-[#2563eb] text-white shadow-md shadow-blue-500/20" : "bg-[#4262ff] text-white shadow-md shadow-blue-500/20"
                : theme === "dark" ? "bg-[#1e293b] border border-[#334155] text-slate-300 hover:bg-[#334155]" : "bg-white border border-gray-200 text-slate-600 hover:bg-gray-50 hover:text-slate-900"
                }`}
            >
              👑 My Boards ({boards.filter(b => b.IsOwner).length})
            </button>
            <button
              onClick={() => setActiveTab("shared")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "shared"
                ? theme === "dark" ? "bg-[#2563eb] text-white shadow-md shadow-blue-500/20" : "bg-[#4262ff] text-white shadow-md shadow-blue-500/20"
                : theme === "dark" ? "bg-[#1e293b] border border-[#334155] text-slate-300 hover:bg-[#334155]" : "bg-white border border-gray-200 text-slate-600 hover:bg-gray-50 hover:text-slate-900"
                }`}
            >
              🤝 Shared with Me ({boards.filter(b => !b.IsOwner).length})
            </button>
            <button
              onClick={() => setActiveTab("starred")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "starred"
                ? theme === "dark" ? "bg-[#2563eb] text-white shadow-md shadow-blue-500/20" : "bg-[#4262ff] text-white shadow-md shadow-blue-500/20"
                : theme === "dark" ? "bg-[#1e293b] border border-[#334155] text-slate-300 hover:bg-[#334155]" : "bg-white border border-gray-200 text-slate-600 hover:bg-gray-50 hover:text-slate-900"
                }`}
            >
              <Star size={14} className={activeTab === "starred" ? "fill-current" : ""} />
              Starred ({starredIds.length})
            </button>
          </div>

          {/* Controls: Search + View Toggle */}
          <div className="flex items-center gap-3">

            {/* Search Input */}
            <div className="relative w-64">
              <Search className={`absolute left-3.5 top-2.5 ${theme === "dark" ? "text-slate-400" : "text-slate-400"}`} size={16} />
              <input
                type="text"
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none transition-colors ${theme === "dark"
                  ? "bg-[#0f172a] border border-[#1e293b] text-slate-200 focus:border-[#2563eb] placeholder:text-slate-500"
                  : "bg-white border border-gray-200 text-slate-800 focus:border-blue-500 placeholder:text-slate-400 shadow-xs"
                  }`}
              />
            </div>

            {/* Grid / List Switcher */}
            <div className={`flex items-center rounded-xl p-1 shadow-xs border ${theme === "dark" ? "bg-[#0f172a] border-[#1e293b]" : "bg-white border-gray-200"
              }`}>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${viewMode === "grid"
                  ? theme === "dark" ? "bg-[#1e293b] text-[#38bdf8] font-bold" : "bg-gray-100 text-[#4262ff] font-bold"
                  : ""
                  }`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${viewMode === "list"
                  ? theme === "dark" ? "bg-[#1e293b] text-[#38bdf8] font-bold" : "bg-gray-100 text-[#4262ff] font-bold"
                  : ""
                  }`}
                title="List View"
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* BOARD LISTING */}
        {isLoadingBoards ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`h-56 rounded-2xl p-5 border animate-pulse flex flex-col justify-between ${theme === "dark" ? "bg-[#1e293b]/60 border-[#334155]" : "bg-white border-gray-200"
                }`}>
                <div className={`h-28 rounded-xl ${theme === "dark" ? "bg-slate-800/80" : "bg-slate-100"}`} />
                <div className="space-y-2 pt-3">
                  <div className={`h-4 w-2/3 rounded ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`} />
                  <div className={`h-3 w-1/3 rounded ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className={`text-center py-20 border-2 border-dashed rounded-3xl ${theme === "dark" ? "border-[#1e293b] bg-[#0f172a]/50" : "border-gray-200 bg-white/60"
            }`}>
            <FolderKanban className={`mx-auto mb-3 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`} size={48} />
            <h3 className={`text-lg font-bold mb-1 ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>No boards found</h3>
            <p className={`text-xs max-w-sm mx-auto mb-6 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {searchQuery ? "No boards match your search filter." : "Create your first Kanban board to start managing tasks."}
            </p>
            <button
              onClick={createNewBoard}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all hover:scale-105 active:scale-95 ${theme === "dark" ? "bg-[#2563eb] hover:bg-[#1d4ed8] shadow-md shadow-blue-500/20" : "bg-[#4262ff] hover:bg-[#3551d8] shadow-md shadow-blue-500/20"
                }`}
            >
              + Create New Board
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBoards.map(board => {
              const isStarred = starredIds.includes(board.ID);
              return (
                <Link key={board.ID} to={`/b/${board.ID}`} className="block group">
                  <div className={`h-56 rounded-2xl p-5 flex flex-col justify-between border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden shadow-xs ${theme === "dark"
                    ? "bg-[#1e293b] border-[#334155] group-hover:border-blue-500/50"
                    : "bg-white border-gray-200 group-hover:border-blue-500/50"
                    }`}>

                    {/* Top Card Thumbnail Header */}
                    <div className={`h-28 rounded-xl p-3 border relative flex items-center justify-center overflow-hidden ${theme === "dark"
                      ? "bg-gradient-to-br from-slate-900 via-[#0f172a] to-blue-950/30 border-[#334155]"
                      : "bg-gradient-to-br from-amber-100/70 via-slate-100 to-blue-50/50 border-gray-100"
                      }`}>
                      <div className={`w-full h-full rounded-lg shadow-xs border p-2 flex gap-1.5 opacity-90 group-hover:scale-105 transition-transform ${theme === "dark" ? "bg-[#0f172a]/90 border-[#334155]" : "bg-white/80 border-gray-200/60"
                        }`}>
                        <div className={`w-1/3 h-full rounded ${theme === "dark" ? "bg-slate-800" : "bg-slate-100/80"}`} />
                        <div className={`w-1/3 h-full rounded ${theme === "dark" ? "bg-slate-800" : "bg-slate-100/80"}`} />
                        <div className={`w-1/3 h-full rounded ${theme === "dark" ? "bg-slate-800" : "bg-slate-100/80"}`} />
                      </div>

                      {/* Action buttons overlay */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button
                          onClick={(e) => toggleStar(e, board.ID)}
                          className={`p-1.5 rounded-lg transition-colors border shadow-xs ${theme === "dark" ? "bg-[#0f172a]/90 border-[#334155]" : "bg-white/90 border-gray-200"
                            } ${isStarred ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`}
                          title="Star Board"
                        >
                          <Star size={13} fill={isStarred ? "currentColor" : "none"} />
                        </button>
                        {board.IsOwner && (
                          <>
                            <button
                              onClick={(e) => openRenameModal(e, board.ID, board.Name)}
                              className={`p-1.5 rounded-lg transition-colors border shadow-xs ${theme === "dark" ? "bg-[#0f172a]/90 border-[#334155] text-slate-400 hover:text-[#38bdf8]" : "bg-white/90 border-gray-200 text-slate-500 hover:text-blue-600"
                                }`}
                              title="Rename"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={(e) => openDeleteModal(e, board.ID, board.Name)}
                              className={`p-1.5 rounded-lg transition-colors border shadow-xs ${theme === "dark" ? "bg-[#0f172a]/90 border-[#334155] text-slate-400 hover:text-rose-400" : "bg-white/90 border-gray-200 text-slate-500 hover:text-rose-600"
                                }`}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Title & Badges */}
                    <div className="pt-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className={`text-sm font-bold truncate transition-colors ${theme === "dark" ? "text-slate-100 group-hover:text-[#38bdf8]" : "text-slate-900 group-hover:text-[#4262ff]"
                          }`}>
                          {board.Name || "Untitled Board"}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${board.IsOwner
                          ? theme === "dark" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-200"
                          : theme === "dark" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                          {board.IsOwner ? "👑 My Board" : "🤝 Shared"}
                        </span>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between text-xs pt-2 border-t ${theme === "dark" ? "border-[#334155] text-slate-400" : "border-gray-100 text-slate-500"
                      }`}>
                      <span className="text-[11px] font-semibold">
                        {board.Cards?.length || 0} cards
                      </span>

                      {/* Active Online Users Avatar Stack */}
                      {renderOnlineAvatars(board.OnlineUsers, "sm")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className={`border rounded-2xl overflow-hidden shadow-xs ${theme === "dark" ? "bg-[#1e293b] border-[#334155]" : "bg-white border-gray-200"
            }`}>
            {/* Table Header */}
            <div className={`grid grid-cols-12 px-6 py-3 border-b text-xs font-bold ${theme === "dark" ? "bg-[#0f172a]/60 border-[#334155] text-slate-400" : "bg-gray-50 border-gray-100 text-slate-500"
              }`}>
              <div className="col-span-5">Name</div>
              <div className="col-span-3 text-center">Online users</div>
              <div className="col-span-2 text-center">Owner</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className={`divide-y ${theme === "dark" ? "divide-[#334155]" : "divide-gray-100"}`}>
              {filteredBoards.map(board => {
                const isStarred = starredIds.includes(board.ID);
                return (
                  <Link key={board.ID} to={`/b/${board.ID}`} className={`px-6 py-4 grid grid-cols-12 items-center transition-colors group ${theme === "dark" ? "hover:bg-[#0f172a]" : "hover:bg-blue-50/40"
                    }`}>
                    {/* Name Column */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className={`p-2 rounded-xl border flex-shrink-0 ${theme === "dark" ? "bg-blue-500/10 border-blue-500/20 text-[#38bdf8]" : "bg-blue-50 border-blue-100 text-[#4262ff]"
                        }`}>
                        <FolderKanban size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-bold truncate transition-colors ${theme === "dark" ? "text-slate-100 group-hover:text-[#38bdf8]" : "text-slate-900 group-hover:text-[#4262ff]"
                          }`}>
                          {board.Name || "Untitled Board"}
                        </h4>
                        <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{board.Cards?.length || 0} cards</p>
                      </div>
                    </div>

                    {/* Online Users Column (Miro Style Avatar Stack) */}
                    <div className="col-span-3 flex items-center justify-center">
                      {renderOnlineAvatars(board.OnlineUsers, "md")}
                    </div>

                    {/* Owner Column */}
                    <div className="col-span-2 flex items-center justify-center">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${board.IsOwner
                        ? theme === "dark" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-200"
                        : theme === "dark" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                        {board.IsOwner ? "👑 My Board" : "🤝 Shared"}
                      </span>
                    </div>

                    {/* Actions Column */}
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => toggleStar(e, board.ID)}
                        className={`p-1.5 rounded-lg transition-colors border ${theme === "dark" ? "border-[#334155]" : "border-gray-200"
                          } ${isStarred ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`}
                        title="Star Board"
                      >
                        <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                      </button>
                      {board.IsOwner && (
                        <>
                          <button
                            onClick={(e) => openRenameModal(e, board.ID, board.Name)}
                            className={`p-1.5 transition-colors ${theme === "dark" ? "text-slate-400 hover:text-[#38bdf8]" : "text-slate-400 hover:text-blue-600"}`}
                            title="Rename"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => openDeleteModal(e, board.ID, board.Name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Centered Glassmorphic Rename Board Modal */}
      {renameModalData && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setRenameModalData(null)}
        >
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150 ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-100" : "bg-white border-gray-200 text-slate-800"
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Rename Board</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Enter a new name for your board</p>
                </div>
              </div>
              <button
                onClick={() => setRenameModalData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Board Name</label>
              <input
                type="text"
                autoFocus
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRename();
                  if (e.key === "Escape") setRenameModalData(null);
                }}
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold transition-all ${theme === "dark" ? "bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-600" : "bg-gray-50 border-gray-200 text-slate-900 placeholder:text-slate-400"
                  }`}
                placeholder="Board name..."
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setRenameModalData(null)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-gray-100 hover:bg-gray-200 text-slate-700"
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRename}
                disabled={!renameInputValue.trim() || isSavingRename}
                className="px-5 py-2.5 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingRename ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Glassmorphic Delete Confirm Modal */}
      {deleteModalData && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteModalData(null)}
        >
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150 ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-100" : "bg-white border-gray-200 text-slate-800"
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-500">Delete Board?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteModalData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-rose-500/5 p-3.5 rounded-xl border border-rose-500/10">
              Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-100 font-bold">"{deleteModalData.name}"</strong>? All lists, cards, and data inside this board will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeleteModalData(null)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-gray-100 hover:bg-gray-200 text-slate-700"
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeletingBoard}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingBoard ? "Deleting..." : "Delete Board"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
