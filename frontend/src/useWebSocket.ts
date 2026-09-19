import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, WS_URL } from "./config";

export type Card = {
  ID: number;
  BoardID: string;
  Title: string;
  Description?: string;
  DueDate?: string;
  Checklist?: string;
  List: string;
  Swimlane?: string;
  Position?: number;
  Tags?: string;
};

export type BoardState = Card[];

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

const deduplicateAndSortCards = (cards: Card[]): Card[] => {
  const map = new Map<string, Card>();
  for (const c of cards) {
    if (c && c.ID != null) {
      map.set(String(c.ID), c);
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.Position ?? 0) - (b.Position ?? 0));
};

export function useWebSocket(boardId: string, token: string | null) {
  const [cards, setCardsState] = useState<Card[]>([]);
  const setCards = useCallback((action: React.SetStateAction<Card[]>) => {
    setCardsState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      return deduplicateAndSortCards(next);
    });
  }, []);

  const [boardName, setBoardName] = useState<string>("Board");
  const [columns, setColumns] = useState<string[]>(["TODO", "DOING", "DONE"]);
  const [swimlanes, setSwimlanes] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState<"edit" | "view" | "private">("edit");
  const [boardBackground, setBoardBackground] = useState<string>("default");
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>("view");
  const [editInviteToken, setEditInviteToken] = useState<string>("");
  const [viewInviteToken, setViewInviteToken] = useState<string>("");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const readyToEdit = useRef(false);
  const connectionGeneration = useRef(0);
  const activeSocketsRef = useRef<Set<WebSocket>>(new Set());
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef<number>(1000);

  const closeAllSockets = useCallback(() => {
    readyToEdit.current = false;
    connectionGeneration.current += 1;
    activeSocketsRef.current.forEach((s) => {
      s.onclose = null;
      s.onerror = null;
      s.onmessage = null;
      try {
        s.close(1000, "Unmounted");
      } catch (e) { }
    });
    activeSocketsRef.current.clear();
    ws.current = null;
  }, []);

  const fetchBoard = useCallback(async () => {
    const generation = connectionGeneration.current;
    try {
      const jwtToken = sessionStorage.getItem("kanban_jwt") || localStorage.getItem("kanban_jwt");
      const headers: Record<string, string> = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};

      // 1. ดึงข้อมูล Board
      const res = await fetch(`${API_URL}/api/boards/${boardId}`, {
        headers,
      });
      if (!res.ok) throw new Error("Unable to refresh board");
      if (res.ok) {
        const data = await res.json();
        if (generation !== connectionGeneration.current) return;
        setCards(data.Cards || []);
        setBoardName(data.Name || "Untitled Board");
        if (data.OwnerID) {
          setOwnerId(data.OwnerID);
        }
        if (data.AccessLevel) {
          setAccessLevel(data.AccessLevel);
        }
        if (data.Background) {
          setBoardBackground(data.Background);
        }
        if (data.UserRole) {
          setUserRole(data.UserRole);
        }
        if (data.Columns !== undefined) {
          const colList = data.Columns ? data.Columns.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          setColumns(colList);
        }
        if (data.Swimlanes !== undefined) {
          const swimList = data.Swimlanes ? data.Swimlanes.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          setSwimlanes(swimList);
        }

        // 2. ดึง Invite Tokens (เฉพาะเมื่อเป็นเจ้าของบอร์ดเท่านั้น)
        if (token && (data.IsOwner || data.UserRole === "owner")) {
          const tokensRes = await fetch(`${API_URL}/api/boards/${boardId}/invite-tokens`, {
            headers,
          });
          if (tokensRes.ok) {
            const tData = await tokensRes.json();
            setEditInviteToken(tData.editToken || "");
            setViewInviteToken(tData.viewToken || "");
          }
        }
      }
    } catch (err) {
      if (generation !== connectionGeneration.current) return;
      console.error("Failed to fetch initial board state", err);
      setErrorToast("Could not refresh the board. Please reload before editing.");
      throw err;
    }
  }, [boardId, token]);

  const tokenRef = useRef<string | null>(token);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const connect = useCallback(async () => {
    if (!isMountedRef.current) return;

    closeAllSockets();
    const generation = connectionGeneration.current;

    setStatus("connecting");

    const currentToken = tokenRef.current;
    let wsUrl = `${WS_URL}/ws?boardId=${boardId}`;

    if (currentToken) {
      try {
        const ticketRes = await fetch(`${API_URL}/api/ws-ticket`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
        if (ticketRes.ok) {
          const ticketData = await ticketRes.json();
          if (ticketData.ticket) {
            wsUrl += `&ticket=${ticketData.ticket}`;
          }
        }
      } catch (err) {
        console.error("Failed to get WS ticket", err);
      }
    }

    if (!isMountedRef.current || generation !== connectionGeneration.current) return;

    const socket = new WebSocket(wsUrl);
    ws.current = socket;
    activeSocketsRef.current.add(socket);

    socket.onopen = async () => {
      if (!isMountedRef.current) {
        socket.close(1000, "Unmounted");
        activeSocketsRef.current.delete(socket);
        return;
      }
      console.log("Connected to WebSocket");
      reconnectDelay.current = 1000;
      try {
        await fetchBoard();
        if (ws.current !== socket || socket.readyState !== WebSocket.OPEN) return;
        readyToEdit.current = true;
        setErrorToast(null);
        setStatus("connected");
      } catch {
        socket.close();
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.boardId && data.boardId !== boardId) return;

        if (data.type === "ACCESS_GRANTED" || data.type === "ACCESS_REQUESTED") {
          void fetchBoard().catch(() => {});
          return;
        }

        if (data.type === "ERROR") {
          setErrorToast(data.title || "An error occurred");
          readyToEdit.current = false;
          setStatus("connecting");
          void fetchBoard().then(() => {
            if (ws.current === socket && socket.readyState === WebSocket.OPEN) {
              readyToEdit.current = true;
              setStatus("connected");
            }
          }).catch(() => socket.close());
          return;
        }

        if (data.type === "MOVE_CARD") {
          setCards((prev) =>
            prev.map((c) =>
              c.ID.toString() === data.cardId
                ? {
                  ...c,
                  List: data.toList,
                  Swimlane: data.swimlane ?? c.Swimlane,
                  Position: data.position ?? c.Position
                }
                : c
            ).sort((a, b) => (a.Position ?? 0) - (b.Position ?? 0))
          );
        } else if (data.type === "REORDER" && Array.isArray(data.cards)) {
          const list = data.toList as string | undefined;
          setCards((prev) => {
            const incomingIds = new Set((data.cards as Card[]).map((c) => String(c.ID)));
            const others = prev.filter((c) => !incomingIds.has(String(c.ID)));
            const incoming = (data.cards as Card[]).map((c) => ({
              ...c,
              List: list ?? c.List,
            }));
            return [...others, ...incoming];
          });
        } else if (data.type === "ADD_CARD" && data.card) {
          setCards((prev) => {
            if (prev.some((c) => c.ID === data.card.ID)) return prev;
            return [...prev, data.card].sort((a, b) => (a.Position ?? 0) - (b.Position ?? 0));
          });
        } else if (data.type === "EDIT_CARD") {
          setCards((prev) =>
            prev.map((c) => (c.ID.toString() === data.cardId ? {
              ...c,
              Title: data.title || c.Title,
              Description: data.description !== undefined ? data.description : c.Description,
              DueDate: data.dueDate !== undefined ? data.dueDate : c.DueDate,
              Checklist: data.checklist !== undefined ? data.checklist : c.Checklist,
              Swimlane: data.swimlane !== undefined ? data.swimlane : c.Swimlane,
              Tags: (data.tags !== undefined && data.tags !== "") ? data.tags : c.Tags
            } : c))
          );
        } else if (data.type === "UPDATE_BOARD_BACKGROUND" && data.background) {
          setBoardBackground(data.background);
        } else if (data.type === "UPDATE_CARD_TAGS") {
          setCards((prev) =>
            prev.map((c) => (c.ID.toString() === data.cardId ? { ...c, Tags: data.tags } : c))
          );
        } else if (data.type === "DELETE_CARD") {
          setCards((prev) => prev.filter((c) => c.ID.toString() !== data.cardId));
        } else if (data.type === "UPDATE_BOARD_NAME" && data.boardName) {
          setBoardName(data.boardName);
        } else if (data.type === "UPDATE_BOARD_ACCESS" && data.accessLevel) {
          setAccessLevel(data.accessLevel);
        } else if (data.columns !== undefined) {
          const colList = data.columns ? data.columns.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          setColumns(colList);
        } else if (data.swimlanes !== undefined) {
          const swimList = data.swimlanes ? data.swimlanes.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          setSwimlanes((prev) => {
            if (prev.length === 0 && swimList.length > 0) {
              setCards((prevCards) =>
                prevCards.map((c) =>
                  !c.Swimlane || c.Swimlane === "Untitled" ? { ...c, Swimlane: swimList[0] } : c
                )
              );
            }
            return swimList;
          });
        } else if (data.type === "DELETE_SWIMLANE") {
          const targetSwimlane = data.swimlane;
          if (targetSwimlane) {
            setSwimlanes((prev) => {
              const remaining = prev.filter((s) => s !== targetSwimlane);
              const fallbackSwim = remaining.length > 0 ? remaining[0] : "Untitled";
              setCards((prevCards) =>
                prevCards.map((c) =>
                  (c.Swimlane || "Untitled") === targetSwimlane ? { ...c, Swimlane: fallbackSwim } : c
                )
              );
              return remaining;
            });
          }
          if (data.swimlanes !== undefined) {
            const swimList = data.swimlanes ? data.swimlanes.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
            setSwimlanes(swimList);
          }

        } else if (data.swimlanes !== undefined) {
          const swimList = data.swimlanes ? data.swimlanes.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          setSwimlanes(swimList);
          void fetchBoard().catch(() => {});
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    socket.onclose = () => {
      readyToEdit.current = false;
      activeSocketsRef.current.delete(socket);
      if (!isMountedRef.current) return;
      setStatus("disconnected");
      console.log(`WebSocket disconnected. Reconnecting in ${reconnectDelay.current}ms...`);
      reconnectTimeout.current = setTimeout(() => {
        if (isMountedRef.current) {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000);
          connect();
        }
      }, reconnectDelay.current);
    };

    socket.onerror = (err) => {
      readyToEdit.current = false;
      activeSocketsRef.current.delete(socket);
      console.error("WebSocket error", err);
      if (isMountedRef.current) {
        setStatus("disconnected");
      }
    };
  }, [boardId, fetchBoard, closeAllSockets]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      closeAllSockets();
    };
  }, [connect, fetchBoard, closeAllSockets]);

  const sendWsMsg = useCallback((payload: Record<string, unknown>) => {
    if (!readyToEdit.current || ws.current?.readyState !== WebSocket.OPEN) {
      setErrorToast("Change not sent. Wait for the board to reconnect, then try again.");
      return false;
    }
    try {
      const inviteToken = new URLSearchParams(window.location.search).get("inviteToken") || "";
      ws.current.send(JSON.stringify({ ...payload, inviteToken }));
      setErrorToast(null);
      return true;
    } catch {
      readyToEdit.current = false;
      setStatus("disconnected");
      setErrorToast("Change not sent. Reconnecting — please try again when connected.");
      ws.current?.close();
      return false;
    }
  }, []);

  const moveCard = useCallback((cardId: string, toList: string, position?: number, swimlane?: string) => {
    if (!sendWsMsg({ type: "MOVE_CARD", cardId, toList, position, swimlane })) return;
    setCards((prev) =>
      prev
        .map((c) => (c.ID.toString() === cardId ? {
          ...c,
          List: toList,
          Swimlane: swimlane ?? c.Swimlane,
          Position: position ?? c.Position
        } : c))
        .sort((a, b) => (a.Position ?? 0) - (b.Position ?? 0))
    );
  }, [sendWsMsg]);

  const addCard = useCallback((title: string, list: string, position?: number, swimlane?: string) => {
    sendWsMsg({ type: "ADD_CARD", title, toList: list, position, swimlane: swimlane || "Untitled" });
  }, [sendWsMsg]);

  const editCard = useCallback((cardId: string, title: string, tags?: string) => {
    const currentTags = tags ?? cards.find((c) => String(c.ID) === cardId)?.Tags ?? "";
    if (!sendWsMsg({ type: "EDIT_CARD", cardId, title, tags: currentTags })) return;
    setCards((prev) => prev.map((c) => String(c.ID) === cardId ? { ...c, Title: title, Tags: currentTags } : c));
  }, [sendWsMsg, cards]);

  const updateCardTags = useCallback((cardId: string, tags: string) => {
    if (!sendWsMsg({ type: "UPDATE_CARD_TAGS", cardId, tags })) return;
    setCards((prev) => {
      return prev.map((c) => (c.ID.toString() === cardId ? { ...c, Tags: tags } : c));
    });
  }, [sendWsMsg]);

  const deleteCard = useCallback((cardId: string) => {
    if (!sendWsMsg({ type: "DELETE_CARD", cardId })) return;
    setCards((prev) => prev.filter((c) => c.ID.toString() !== cardId));
  }, [sendWsMsg]);

  const updateBoardName = useCallback((name: string) => {
    if (!sendWsMsg({ type: "UPDATE_BOARD_NAME", boardName: name })) return;
    setBoardName(name);
  }, [sendWsMsg]);

  const addColumn = useCallback((columnName: string) => {
    if (!sendWsMsg({ type: "ADD_COLUMN", columnName })) return;
    setColumns((prev) => [...prev, columnName]);
  }, [sendWsMsg]);

  const deleteColumn = useCallback((columnName: string) => {
    if (!sendWsMsg({ type: "DELETE_COLUMN", columnName })) return;
    setColumns((prev) => prev.filter((c) => c !== columnName));
    setCards((prev) => prev.filter((c) => c.List !== columnName));
  }, [sendWsMsg]);

  const renameColumn = useCallback((oldColumn: string, columnName: string) => {
    if (!sendWsMsg({ type: "RENAME_COLUMN", oldColumn, columnName })) return;
    setColumns((prev) => prev.map((c) => (c === oldColumn ? columnName : c)));
    setCards((prev) => prev.map((c) => (c.List === oldColumn ? { ...c, List: columnName } : c)));
  }, [sendWsMsg]);

  const addSwimlane = useCallback((swimlane: string) => {
    if (!sendWsMsg({ type: "ADD_SWIMLANE", swimlane })) return;
    setSwimlanes((prev) => [...prev, swimlane]);
  }, [sendWsMsg]);

  const deleteSwimlane = useCallback((swimlane: string) => {
    if (!sendWsMsg({ type: "DELETE_SWIMLANE", swimlane })) return;
    setSwimlanes((prev) => {
      const remaining = prev.filter((s) => s !== swimlane);
      const fallbackSwim = remaining.length > 0 ? remaining[0] : "Untitled";
      setCards((prevCards) =>
        prevCards.map((c) =>
          (c.Swimlane || "Untitled") === swimlane ? { ...c, Swimlane: fallbackSwim } : c
        )
      );
      return remaining;
    });
  }, [sendWsMsg]);

  const renameSwimlane = useCallback((oldSwimlane: string, swimlane: string) => {
    if (!sendWsMsg({ type: "RENAME_SWIMLANE", oldSwimlane, swimlane })) return;
    setSwimlanes((prev) => prev.map((s) => (s === oldSwimlane ? swimlane : s)));
    setCards((prev) => prev.map((c) => {
      const cardSwim = (c.Swimlane || "").trim();
      if (cardSwim === oldSwimlane || (!cardSwim && oldSwimlane === swimlanes[0]) || (cardSwim === "Untitled" && oldSwimlane === swimlanes[0])) {
        return { ...c, Swimlane: swimlane };
      }
      return c;
    }));
  }, [sendWsMsg, swimlanes]);

  const updateBoardAccess = useCallback((level: "edit" | "view" | "private") => {
    if (!sendWsMsg({ type: "UPDATE_BOARD_ACCESS", accessLevel: level })) return;
    setAccessLevel(level);
  }, [sendWsMsg]);

  const updateBoardBackground = useCallback((bg: string) => {
    if (!sendWsMsg({ type: "UPDATE_BOARD_BACKGROUND", background: bg })) return;
    setBoardBackground(bg);
  }, [sendWsMsg]);

  const editCardDetail = useCallback((cardId: string, details: { title?: string; description?: string; dueDate?: string; checklist?: string; tags?: string; swimlane?: string }) => {
    const targetCard = cards.find((c) => c.ID.toString() === cardId);
    const updatedTitle = details.title !== undefined ? details.title : (targetCard?.Title || "");
    const updatedDescription = details.description !== undefined ? details.description : (targetCard?.Description || "");
    const updatedDueDate = details.dueDate !== undefined ? details.dueDate : (targetCard?.DueDate || "");
    const updatedChecklist = details.checklist !== undefined ? details.checklist : (targetCard?.Checklist || "");
    const updatedTags = details.tags !== undefined ? details.tags : (targetCard?.Tags || "");
    const updatedSwimlane = details.swimlane !== undefined ? details.swimlane : (targetCard?.Swimlane || "Untitled");

    if (!sendWsMsg({
      type: "EDIT_CARD",
      cardId,
      title: updatedTitle,
      description: updatedDescription,
      dueDate: updatedDueDate,
      checklist: updatedChecklist,
      tags: updatedTags,
      swimlane: updatedSwimlane,
    })) return;

    setCards((prev) => prev.map((c) =>
      c.ID.toString() === cardId
        ? {
            ...c,
            Title: updatedTitle,
            Description: updatedDescription,
            DueDate: updatedDueDate,
            Checklist: updatedChecklist,
            Tags: updatedTags,
            Swimlane: updatedSwimlane,
          }
        : c
    ));
  }, [sendWsMsg, cards]);

  return {
    cards,
    boardName,
    columns,
    swimlanes,
    accessLevel,
    boardBackground,
    ownerId,
    userRole,
    editInviteToken,
    viewInviteToken,
    status,
    errorToast,
    moveCard,
    addCard,
    editCard,
    editCardDetail,
    updateCardTags,
    deleteCard,
    updateBoardName,
    updateBoardBackground,
    addColumn,
    deleteColumn,
    renameColumn,
    addSwimlane,
    deleteSwimlane,
    renameSwimlane,
    updateBoardAccess
  };
}
