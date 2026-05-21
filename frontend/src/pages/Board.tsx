import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Link as LinkIcon, Edit2, Trash2, LogOut, AlertCircle, Wifi, WifiOff, X, ChevronDown, ChevronRight, Sun, Moon, UserPlus, Globe, Code, Eye, Bell, Check, ArrowLeft, Download, Search, Tag, FileText, Image, Calendar, Clock, CheckSquare, Palette } from "lucide-react";
import { toPng } from "html-to-image";

import { useWebSocket } from "../useWebSocket";
import { useAuth } from "../useAuth";
import { useTheme } from "../useTheme";
import { useNotifications } from "../useNotifications";
import { API_URL } from "../config";

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

const COLUMN_STYLES = [
  {
    // Column 1: TODO (Neutral Grey)
    headerPill: "bg-[#e5e7eb] text-[#374151] font-bold px-3 py-1 rounded-md shadow-2xs",
    cardBorder: "border-2 border-[#d1d5db] hover:border-[#9ca3af]",
  },
  {
    // Column 2: DOING (Soft Pastel Blue)
    headerPill: "bg-[#93c5fd] text-[#1e3a8a] font-bold px-3 py-1 rounded-md shadow-2xs",
    cardBorder: "border-2 border-[#93c5fd] hover:border-[#60a5fa]",
  },
  {
    // Column 3: DONE (Soft Pastel Green)
    headerPill: "bg-[#86efac] text-[#14532d] font-bold px-3 py-1 rounded-md shadow-2xs",
    cardBorder: "border-2 border-[#86efac] hover:border-[#4ade80]",
  },
  {
    // Column 4: Purple/Violet
    headerPill: "bg-[#d8b4fe] text-[#581c87] font-bold px-3 py-1 rounded-md shadow-2xs",
    cardBorder: "border-2 border-[#d8b4fe] hover:border-[#c084fc]",
  },
  {
    // Column 5: Warm Yellow/Amber
    headerPill: "bg-[#fde047] text-[#713f12] font-bold px-3 py-1 rounded-md shadow-2xs",
    cardBorder: "border-2 border-[#fde047] hover:border-[#facc15]",
  },
  {
    // Column 6: Coral/Pink
    headerPill: "bg-[#fca5a5] text-[#7f1d1d] font-bold px-3 py-1 rounded-md shadow-2xs",
    cardBorder: "border-2 border-[#fca5a5] hover:border-[#f87171]",
  },
];

const SWIMLANE_TAG_COLORS = [
  "bg-[#fef08a] text-[#713f12] font-bold border border-[#fef08a]",
  "bg-[#fed7aa] text-[#7c2d12] font-bold border border-[#fed7aa]",
  "bg-[#bbf7d0] text-[#14532d] font-bold border border-[#bbf7d0]",
  "bg-[#bfdbfe] text-[#1e3a8a] font-bold border border-[#bfdbfe]",
  "bg-[#e9d5ff] text-[#581c87] font-bold border border-[#e9d5ff]",
  "bg-[#fbcfe8] text-[#831843] font-bold border border-[#fbcfe8]",
];

const adjustHeight = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const TAG_PRESETS = [
  { name: "Bug", bg: "bg-rose-500/15 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800/60" },
  { name: "Feature", bg: "bg-blue-500/15 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800/60" },
  { name: "Urgent", bg: "bg-amber-500/15 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800/60" },
  { name: "Design", bg: "bg-purple-500/15 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800/60" },
  { name: "Docs", bg: "bg-emerald-500/15 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/60" },
];

const COLOR_PALETTES = [
  { bg: "bg-rose-500/15 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800/60" },
  { bg: "bg-blue-500/15 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800/60" },
  { bg: "bg-amber-500/15 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800/60" },
  { bg: "bg-purple-500/15 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800/60" },
  { bg: "bg-emerald-500/15 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/60" },
  { bg: "bg-cyan-500/15 dark:bg-cyan-950/40", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800/60" },
  { bg: "bg-fuchsia-500/15 dark:bg-fuchsia-950/40", text: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-200 dark:border-fuchsia-800/60" },
  { bg: "bg-indigo-500/15 dark:bg-indigo-950/40", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800/60" },
];

const getTagColor = (name: string) => {
  const preset = TAG_PRESETS.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (preset) return preset;

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
};
const BOARD_BACKGROUND_PRESETS: Record<string, { name: string; class: string; previewBg: string }> = {
  default: {
    name: "Clean Slate",
    class: "",
    previewBg: "from-slate-300 to-slate-500",
  },
  cyberpunk: {
    name: "Cyberpunk Midnight",
    class: "bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/70 dark:from-[#090d16] dark:via-[#111827] dark:to-[#1e1b4b]",
    previewBg: "from-indigo-400 to-purple-600",
  },
  sunset: {
    name: "Sunset Amber",
    class: "bg-gradient-to-br from-amber-50/80 via-orange-50/60 to-rose-50/70 dark:from-[#0f172a] dark:via-[#31121d] dark:to-[#451a03]",
    previewBg: "from-amber-400 to-rose-500",
  },
  aurora: {
    name: "Emerald Aurora",
    class: "bg-gradient-to-br from-emerald-50/80 via-teal-50/60 to-cyan-50/70 dark:from-[#064e3b] dark:via-[#0f172a] dark:to-[#022c22]",
    previewBg: "from-emerald-400 to-teal-600",
  },
  ocean: {
    name: "Ocean Breeze",
    class: "bg-gradient-to-br from-sky-50/80 via-blue-50/60 to-indigo-50/70 dark:from-[#0c4a6e] dark:via-[#0f172a] dark:to-[#1e3a8a]",
    previewBg: "from-sky-400 to-blue-600",
  },
  pastel: {
    name: "Pastel Lavender",
    class: "bg-gradient-to-br from-pink-50/80 via-rose-50/60 to-purple-50/70 dark:from-[#2e1065] dark:via-[#0f172a] dark:to-[#3b0764]",
    previewBg: "from-pink-400 to-purple-500",
  },
};

const getDueDateBadge = (dueDateStr?: string) => {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 3600 * 24));

  if (diffDays < 0) {
    return { label: `Overdue (${dueDateStr})`, bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
  } else if (diffDays <= 1) {
    return { label: `Due Soon (${dueDateStr})`, bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
  } else {
    return { label: dueDateStr, bg: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
  }
};

function DraggableCard({
  id,
  cardData,
  title,
  tags,
  columnIndex,
  swimlaneName,
  swimlaneIndex,
  onEdit,
  onUpdateTags,
  onDelete,
  onOpenDetail,
  canEdit
}: {
  id: string,
  cardData: any,
  title: string,
  tags?: string,
  columnIndex: number,
  swimlaneName?: string,
  swimlaneIndex?: number,
  onEdit: (id: string, newTitle: string) => void,
  onUpdateTags?: (id: string, newTags: string) => void,
  onDelete: (id: string) => void,
  onOpenDetail?: (card: any) => void,
  canEdit: boolean
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : isTagPopoverOpen ? 30 : 1,
  };

  const colStyle = COLUMN_STYLES[columnIndex % COLUMN_STYLES.length];
  const tagColor = swimlaneIndex !== undefined ? SWIMLANE_TAG_COLORS[swimlaneIndex % SWIMLANE_TAG_COLORS.length] : SWIMLANE_TAG_COLORS[0];
  const cardTags = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  const handleSave = () => {
    if (editTitle.trim() && editTitle.trim() !== title) {
      onEdit(id, editTitle.trim());
    } else {
      setEditTitle(title);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-white dark:bg-[#1e293b] border-2 border-blue-500 p-4 rounded-2xl shadow-lg w-full max-w-full flex flex-col gap-3`}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <textarea
          ref={(el) => adjustHeight(el)}
          autoFocus
          rows={1}
          value={editTitle}
          onChange={(e) => {
            setEditTitle(e.target.value);
            adjustHeight(e.target);
          }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            } else if (e.key === "Escape") {
              setEditTitle(title);
              setIsEditing(false);
            }
          }}
          className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 focus:outline-none text-sm font-semibold leading-relaxed resize-none overflow-hidden [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap pr-6"
        />

        {swimlaneName && (
          <span className={`self-start px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-tight shadow-xs ${tagColor}`}>
            {swimlaneName}
          </span>
        )}
      </div>
    );
  }

  const activeListeners = isTagPopoverOpen ? {} : listeners;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...activeListeners}
      onClick={() => {
        if (!isTagPopoverOpen && onOpenDetail) {
          onOpenDetail(cardData);
        }
      }}
      className={`bg-white dark:bg-[#1e293b] border ${colStyle.cardBorder} p-4 rounded-2xl ${isTagPopoverOpen ? "cursor-default" : "cursor-pointer"} group transition-all duration-150 w-full max-w-full flex flex-col gap-2.5 shadow-xs hover:shadow-md relative`}
    >
      <p className={`text-sm font-semibold text-slate-800 dark:text-slate-100 w-full min-w-0 [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap leading-relaxed ${canEdit ? "pr-6" : ""}`}>
        {title}
      </p>

      {canEdit && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-1 rounded-lg border border-gray-200 dark:border-slate-700 shadow-xs z-10">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setEditTitle(title);
              setIsEditing(true);
            }}
            className="p-1 text-slate-400 hover:text-blue-500 dark:hover:text-sky-400 rounded transition-colors"
            title="Rename Task"
          >
            <Edit2 size={13} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
            title="Delete Task"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Due Date & Checklist Surface Badges */}
      {(cardData.DueDate || cardData.Checklist) && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {cardData.DueDate && getDueDateBadge(cardData.DueDate) && (
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border flex items-center gap-1 shadow-2xs ${getDueDateBadge(cardData.DueDate)?.bg}`}>
              <Clock size={10} /> {getDueDateBadge(cardData.DueDate)?.label}
            </span>
          )}

          {cardData.Checklist && (() => {
            try {
              const items = JSON.parse(cardData.Checklist);
              if (Array.isArray(items) && items.length > 0) {
                const done = items.filter((i: any) => i.done).length;
                return (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border flex items-center gap-1 shadow-2xs ${
                    done === items.length
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}>
                    <CheckSquare size={10} /> {done}/{items.length}
                  </span>
                );
              }
            } catch (e) {}
            return null;
          })()}
        </div>
      )}

      {/* Tags & Swimlane Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {swimlaneName && (
          <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-tight shadow-2xs ${tagColor}`}>
            {swimlaneName}
          </span>
        )}

        {cardTags.map((tagName) => {
          const colorObj = getTagColor(tagName);
          return (
            <span key={tagName} className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${colorObj?.bg || ''} ${colorObj?.text || ''} ${colorObj?.border || ''} shadow-2xs transition-all hover:scale-105`}>
              {tagName}
            </span>
          );
        })}

        {canEdit && onUpdateTags && (
          <div className="relative">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsTagPopoverOpen(!isTagPopoverOpen);
              }}
              className={`p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity flex items-center gap-0.5 text-[10px] font-bold cursor-pointer ${
                isTagPopoverOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              title="Add / Edit Tags"
            >
              <Tag size={11} />
              {cardTags.length === 0 && <span className="text-[10px]">+ Tag</span>}
            </button>

            {isTagPopoverOpen && (
              <>
                {/* Fullscreen Backdrop overlay to close popover on outside click */}
                <div
                  className="fixed inset-0 z-40 bg-transparent cursor-default"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTagPopoverOpen(false);
                  }}
                />

                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-2 w-48 p-2.5 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col gap-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto"
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pb-1 border-b border-gray-100 dark:border-slate-800">
                    Select Tags
                  </div>

                  {/* Preset Tags */}
                  {TAG_PRESETS.map((preset) => {
                    const hasTag = cardTags.some(t => t.toLowerCase() === preset.name.toLowerCase());
                    return (
                      <button
                        key={preset.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          let newTags: string[];
                          if (hasTag) {
                            newTags = cardTags.filter(t => t.toLowerCase() !== preset.name.toLowerCase());
                          } else {
                            newTags = [...cardTags, preset.name];
                          }
                          onUpdateTags(id, newTags.join(","));
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${preset.bg} ${preset.text} ${preset.border} ${hasTag ? "ring-2 ring-blue-500 shadow-xs" : "opacity-80 hover:opacity-100"}`}
                      >
                        <span>{preset.name}</span>
                        {hasTag && <Check size={12} />}
                      </button>
                    );
                  })}

                  {/* Custom Tags currently on this card */}
                  {cardTags.filter(t => !TAG_PRESETS.some(p => p.name.toLowerCase() === t.toLowerCase())).map((customTag) => {
                    const colorObj = getTagColor(customTag);
                    return (
                      <button
                        key={customTag}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTags = cardTags.filter(t => t.toLowerCase() !== customTag.toLowerCase());
                          onUpdateTags(id, newTags.join(","));
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ring-2 ring-blue-500 shadow-xs ${colorObj?.bg || ''} ${colorObj?.text || ''} ${colorObj?.border || ''}`}
                      >
                        <span>{customTag}</span>
                        <X size={12} className="hover:text-rose-500" />
                      </button>
                    );
                  })}

                  {/* Add Custom Tag Input Section */}
                  <div className="pt-1.5 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Custom Tag
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="New tag..."
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = customTagInput.trim();
                            if (trimmed && !cardTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
                              onUpdateTags(id, [...cardTags, trimmed].join(","));
                              setCustomTagInput("");
                            }
                          }
                        }}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          const trimmed = customTagInput.trim();
                          if (trimmed && !cardTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
                            onUpdateTags(id, [...cardTags, trimmed].join(","));
                            setCustomTagInput("");
                          }
                        }}
                        className="px-2 py-1 bg-[#4262ff] hover:bg-[#3551d8] text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer flex-shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SwimlaneDropZone({
  id,
  children
}: {
  id: string,
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="min-h-[50px] flex flex-col gap-2.5">
      {children}
    </div>
  );
}

const decodeInviteRole = (tokenStr: string | null): "edit" | "view" | null => {
  if (!tokenStr) return null;
  try {
    const base64Url = tokenStr.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    return parsed.role === "edit" || parsed.role === "view" ? parsed.role : null;
  } catch {
    return null;
  }
};

function CardDetailModal({
  card,
  canEdit,
  theme,
  swimlanes,
  onClose,
  onEditDetail,
  onDeleteCard,
}: {
  card: any;
  canEdit: boolean;
  theme: string;
  swimlanes: string[];
  onClose: () => void;
  onEditDetail: (cardId: string, details: any) => void;
  onDeleteCard: (cardId: string, title: string) => void;
}) {
  const [title, setTitle] = useState(card.Title || "");
  const [description, setDescription] = useState(card.Description || "");
  const [dueDate, setDueDate] = useState(card.DueDate || "");
  const [checklist, setChecklist] = useState<Array<{ id: string; text: string; done: boolean }>>(() => {
    try {
      const parsed = card.Checklist ? JSON.parse(card.Checklist) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [newItemText, setNewItemText] = useState("");

  const cardId = card.ID.toString();

  const handleSaveTitle = () => {
    if (title.trim() && title.trim() !== card.Title) {
      onEditDetail(cardId, { title: title.trim() });
    }
  };

  const handleSaveDescription = () => {
    if (description !== card.Description) {
      onEditDetail(cardId, { description });
    }
  };

  const badge = getDueDateBadge(dueDate);

  const rawSwim = (card.Swimlane || "").trim();
  const effectiveSwimlane = (rawSwim && rawSwim !== "Untitled" && swimlanes.includes(rawSwim)) ? rawSwim : (swimlanes.length > 0 ? swimlanes[0] : "Untitled");

  return (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl p-6 flex flex-col gap-5 my-8 max-h-[90vh] overflow-y-auto ${
          theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-100" : "bg-white border-gray-200 text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b pb-4 border-gray-100 dark:border-slate-800">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <input
              type="text"
              value={title}
              readOnly={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              className={`text-lg font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-1 py-0.5 w-full ${
                theme === "dark" ? "text-slate-100" : "text-slate-900"
              }`}
              placeholder="Task title..."
            />
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2.5 py-0.5 rounded-lg font-bold ${
                theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
              }`}>
                List: {card.List}
              </span>
              {swimlanes.length > 0 ? (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <span className="opacity-75">Swimlane:</span>
                  <select
                    disabled={!canEdit}
                    value={effectiveSwimlane}
                    onChange={(e) => {
                      const newSwim = e.target.value;
                      onEditDetail(cardId, { swimlane: newSwim });
                    }}
                    className="bg-transparent font-bold focus:outline-none cursor-pointer"
                  >
                    {swimlanes.map((s) => (
                      <option key={s} value={s} className={theme === "dark" ? "bg-slate-800 text-slate-100" : "bg-white text-slate-800"}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Swimlane: {effectiveSwimlane}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Due Date */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Calendar size={15} className="text-blue-500" />
            <span>Due Date:</span>
            <input
              type="date"
              disabled={!canEdit}
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                onEditDetail(cardId, { dueDate: e.target.value });
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none ${
                theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-100" : "bg-gray-50 border-gray-200 text-slate-800"
              }`}
            />
          </div>

          {dueDate && badge && (
            <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 shadow-2xs ${badge.bg}`}>
              <Clock size={13} /> {badge.label}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <FileText size={14} className="text-blue-500" /> Description
          </div>
          <textarea
            rows={3}
            readOnly={!canEdit}
            placeholder="Add a more detailed description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            className={`w-full p-3 rounded-2xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-y ${
              theme === "dark" ? "bg-slate-900/60 border-slate-700 text-slate-100 placeholder:text-slate-500" : "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-slate-400"
            }`}
          />
        </div>

        {/* Checklist */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <CheckSquare size={14} className="text-emerald-500" /> Checklist
            </div>
            {checklist.length > 0 && (
              <span className="text-xs font-bold text-emerald-500">
                {Math.round((checklist.filter((i) => i.done).length / checklist.length) * 100)}%
              </span>
            )}
          </div>

          {checklist.length > 0 && (
            <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${(checklist.filter((i) => i.done).length / checklist.length) * 100}%` }}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {checklist.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center gap-2.5 group">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={item.done}
                  onChange={(e) => {
                    const updated = checklist.map((i, iIdx) => (iIdx === idx ? { ...i, done: e.target.checked } : i));
                    setChecklist(updated);
                    onEditDetail(cardId, { checklist: JSON.stringify(updated) });
                  }}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
                />
                <span className={`text-xs font-medium flex-1 ${item.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"}`}>
                  {item.text}
                </span>
                {canEdit && (
                  <button
                    onClick={() => {
                      const updated = checklist.filter((_, iIdx) => iIdx !== idx);
                      setChecklist(updated);
                      onEditDetail(cardId, { checklist: JSON.stringify(updated) });
                    }}
                    className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}

            {canEdit && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  placeholder="Add a checklist item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItemText.trim()) {
                      e.preventDefault();
                      const updated = [...checklist, { id: Date.now().toString(), text: newItemText.trim(), done: false }];
                      setChecklist(updated);
                      setNewItemText("");
                      onEditDetail(cardId, { checklist: JSON.stringify(updated) });
                    }
                  }}
                  className={`flex-1 px-3 py-1.5 rounded-xl border text-xs focus:outline-none ${
                    theme === "dark" ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-gray-50 border-gray-200 text-slate-800"
                  }`}
                />
                <button
                  onClick={() => {
                    if (newItemText.trim()) {
                      const updated = [...checklist, { id: Date.now().toString(), text: newItemText.trim(), done: false }];
                      setChecklist(updated);
                      setNewItemText("");
                      onEditDetail(cardId, { checklist: JSON.stringify(updated) });
                    }
                  }}
                  className="px-3 py-1.5 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-4 border-gray-100 dark:border-slate-800 mt-2">
          {canEdit && (
            <button
              onClick={() => onDeleteCard(cardId, card.Title)}
              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Delete Task
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Board() {
  const { boardId } = useParams();
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const token = (sessionStorage.getItem("kanban_jwt") || localStorage.getItem("kanban_jwt"));

  const {
    cards,
    boardName,
    columns,
    swimlanes,
    accessLevel,
    boardBackground,
    ownerId,
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
    updateBoardAccess,
    userRole
  } = useWebSocket(boardId || "", token);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("All");
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isThemePaletteOpen, setIsThemePaletteOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Card Detail Modal states
  const [selectedCardDetail, setSelectedCardDetail] = useState<any | null>(null);

  const currentCardDetail = useMemo(() => {
    if (!selectedCardDetail) return null;
    return cards.find((c) => c.ID.toString() === selectedCardDetail.ID.toString()) || selectedCardDetail;
  }, [selectedCardDetail, cards]);

  const handleOpenCardDetail = useCallback((card: any) => {
    setSelectedCardDetail(card);
  }, []);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);

  const handleExportPNG = async () => {
    if (!boardContainerRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(boardContainerRef.current, { cacheBust: true, quality: 0.95 });
      const link = document.createElement("a");
      link.download = `${boardName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-kanban.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export PNG failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const filteredCards = cards.filter((c) => {
    const matchesSearch = !searchQuery.trim() || c.Title.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const cardTags = c.Tags ? c.Tags.split(",").map(t => t.trim().toLowerCase()) : [];
    const matchesTag = selectedTagFilter === "All" || cardTags.includes(selectedTagFilter.toLowerCase());
    return matchesSearch && matchesTag;
  });

  const allBoardTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    TAG_PRESETS.forEach(p => tagSet.add(p.name));
    cards.forEach(c => {
      if (c.Tags) {
        c.Tags.split(",").forEach(t => {
          const trimmed = t.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    return Array.from(tagSet);
  }, [cards]);

  const [addingToKey, setAddingToKey] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const navigate = useNavigate();
  const [showGuestShareModal, setShowGuestShareModal] = useState(false);
  const [showGuestExitModal, setShowGuestExitModal] = useState(false);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [tempBoardName, setTempBoardName] = useState("");
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTab, setShareTab] = useState<"invite" | "embed">("invite");
  const [copySuccessToast, setCopySuccessToast] = useState(false);
  const [shareLinkRole, setShareLinkRole] = useState<"edit" | "view">("edit");
  const [shareView, setShareView] = useState<"main" | "manage_access">("main");
  const [boardMembers, setBoardMembers] = useState<Array<{
    id: number;
    name: string;
    email: string;
    avatarUrl: string;
    role: string;
    isOwner: boolean;
  }>>([]);

  const fetchBoardMembers = useCallback(async () => {
    if (!boardId) return;
    const token = (sessionStorage.getItem("kanban_jwt") || localStorage.getItem("kanban_jwt"));
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/boards/${boardId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("🔥 Data from GET /members on Refresh:", data);
        setBoardMembers(data || []);
      }
    } catch (err) {
      console.error("Failed fetching board members:", err);
    }
  }, [boardId]);

  useEffect(() => {
    if (isShareModalOpen) {
      fetchBoardMembers();
    }
  }, [isShareModalOpen, fetchBoardMembers]);

  const isLoggingInRef = useRef(false);
  const handleLogin = useCallback((bId: string) => {
    isLoggingInRef.current = true;
    login(bId);
  }, [login]);



  // Access Request & Notifications System
  const { notifications, unreadCount, requestAccess, respondToAccess } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isViewOnlyPopoverOpen, setIsViewOnlyPopoverOpen] = useState(false);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [accessRequestStatus, setAccessRequestStatus] = useState<"none" | "pending" | "approved">("none");

  const handleRequestAccess = async () => {
    if (!boardId) return;
    setIsRequestingAccess(true);
    const res = await requestAccess(boardId);
    setIsRequestingAccess(false);
    if (res) {
      setAccessRequestStatus(res.status === "approved" ? "approved" : "pending");
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const currentInviteToken = urlParams.get("inviteToken");
  const inviteRole = decodeInviteRole(currentInviteToken);

  const isLoggedIn = !!user;
  const isOwner = isLoggedIn && ownerId !== null && user.id === ownerId;
  const isGrantedEditor = userRole === "edit" || (userRole !== "view" && accessRequestStatus === "approved");

  const canEditIfLoggedIn =
    isGrantedEditor ||
    inviteRole === "edit" ||
    (accessLevel === "edit" && inviteRole !== "view");

  const canEdit =
    isLoggedIn && (
      isOwner ||
      canEditIfLoggedIn
    );

  // Intercept Browser Back Button (<) and Tab Closing (X) for Guest Owners
  useEffect(() => {
    if (!user || user.email !== "guest@kanban.demo" || !isOwner) return;

    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setShowGuestExitModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLoggingInRef.current) return;
      e.preventDefault();
      e.returnValue = "You have unsaved changes in Guest Mode. Sign in to save your board permanently.";
      return e.returnValue;
    };

    const handleUnload = () => {
      if (isLoggingInRef.current) return;
      const token = (sessionStorage.getItem("kanban_jwt") || localStorage.getItem("kanban_jwt"));
      if (boardId && token) {
        fetch(`${API_URL}/api/boards/${boardId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        });
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, [user, isOwner, boardId]);

  const toggleSwimlane = (swim: string) => setCollapsedSwimlanes((prev) => ({ ...prev, [swim]: !prev[swim] }));

  // Custom Dark Glassmorphism Modal Card Box States
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: "confirm" | "rename";
    title: string;
    description?: string;
    initialValue?: string;
    onConfirm?: (val?: string) => void;
  }>({
    isOpen: false,
    type: "confirm",
    title: "",
  });
  const [modalInputVal, setModalInputVal] = useState("");

  const openConfirmModal = (title: string, description: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      type: "confirm",
      title,
      description,
      onConfirm: () => {
        onConfirm();
        closeModal();
      }
    });
  };

  const openRenameModal = (title: string, initialValue: string, onSave: (val: string) => void) => {
    setModalInputVal(initialValue);
    setModalConfig({
      isOpen: true,
      type: "rename",
      title,
      initialValue,
      onConfirm: (val) => {
        if (val && val.trim() && val.trim() !== initialValue) {
          onSave(val.trim());
        }
        closeModal();
      }
    });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
    setModalInputVal("");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const activeCard = cards.find((c: any) => c.ID.toString() === activeId);
    if (!activeCard) return;

    let targetList = activeCard.List;
    let targetSwimlane = activeCard.Swimlane || "Untitled";

    if (overId.includes(":::")) {
      const parts = overId.split(":::");
      targetList = parts[0];
      targetSwimlane = parts[1] || "Untitled";
    } else if (columns.includes(overId)) {
      targetList = overId;
      targetSwimlane = activeCard.Swimlane || "Untitled";
    } else {
      const overCard = cards.find((c: any) => c.ID.toString() === overId);
      if (overCard) {
        targetList = overCard.List;
        targetSwimlane = overCard.Swimlane || "Untitled";
      }
    }

    const targetCards = cards
      .filter((c: any) => c.List === targetList && (swimlanes.length === 0 || (c.Swimlane || "Untitled") === targetSwimlane))
      .sort((a: any, b: any) => (a.Position ?? 0) - (b.Position ?? 0));

    let newPosition = 1000;

    if (activeCard.List === targetList && (activeCard.Swimlane || "Untitled") === targetSwimlane) {
      const oldIndex = targetCards.findIndex((c: any) => c.ID.toString() === activeId);
      const newIndex = overId.includes(":::")
        ? targetCards.length - 1
        : targetCards.findIndex((c: any) => c.ID.toString() === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered: any[] = arrayMove(targetCards, oldIndex, newIndex);
        const finalIdx = reordered.findIndex((c: any) => c.ID.toString() === activeId);

        if (finalIdx === 0) {
          const nextPos = reordered[1]?.Position ?? 2000;
          newPosition = nextPos > 0 ? nextPos / 2 : 500;
        } else if (finalIdx === reordered.length - 1) {
          const prevPos = reordered[reordered.length - 2]?.Position ?? 0;
          newPosition = prevPos + 1000;
        } else {
          const prevPos = reordered[finalIdx - 1]?.Position ?? 0;
          const nextPos = reordered[finalIdx + 1]?.Position ?? 2000;
          newPosition = (prevPos + nextPos) / 2;
        }
      } else {
        return;
      }
    } else {
      const otherCards = targetCards.filter((c: any) => c.ID.toString() !== activeId);
      const overIdx = overId.includes(":::")
        ? otherCards.length
        : otherCards.findIndex((c: any) => c.ID.toString() === overId);

      if (overIdx <= 0) {
        const firstPos = otherCards[0]?.Position ?? 2000;
        newPosition = firstPos > 0 ? firstPos / 2 : 500;
      } else if (overIdx >= otherCards.length) {
        const lastPos = otherCards[otherCards.length - 1]?.Position ?? 0;
        newPosition = lastPos + 1000;
      } else {
        const prevPos = otherCards[overIdx - 1]?.Position ?? 0;
        const nextPos = otherCards[overIdx]?.Position ?? 2000;
        newPosition = (prevPos + nextPos) / 2;
      }
    }

    moveCard(activeId, targetList, newPosition, targetSwimlane);
  };





  if (!boardId) return null;

  const bgPresetClass = BOARD_BACKGROUND_PRESETS[boardBackground]?.class || "";

  return (
    <div className={`min-h-screen font-sans relative selection:bg-blue-500/20 transition-all duration-300 ${
      bgPresetClass || (theme === "dark" ? "bg-[#090d16] text-[#f8fafc]" : "bg-[#f8fafc] text-slate-900")
    }`}>

      {/* Toast Alert Banner */}
      {errorToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-rose-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 border border-rose-500/50 animate-bounce">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{errorToast}</span>
        </div>
      )}

      {/* Sleek Top Navigation Header */}
      <header className={`px-6 py-3.5 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-40 transition-colors ${theme === "dark" ? "bg-[#0f172a]/95 border-[#1e293b]" : "bg-white border-gray-200 shadow-xs"
        }`}>

        {/* Header Left: Brand Logo & Board Title */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => {
              if ((!user || user.email === "guest@kanban.demo") && isOwner) {
                setShowGuestExitModal(true);
              } else {
                navigate("/");
              }
            }}
            className="flex items-center gap-2 group cursor-pointer select-none"
            title="Go to Dashboard"
          >
            {/* Sleek Gradient Glowing Logo Badge */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2563eb] via-[#4f46e5] to-[#38bdf8] p-[1.5px] shadow-sm shadow-blue-500/20 group-hover:shadow-blue-500/40 group-hover:scale-105 transition-all duration-200">
              <div className="w-full h-full bg-[#0f172a] rounded-[10.5px] flex items-center justify-center p-1 gap-0.5">
                <div className="w-1 h-full rounded-xs bg-gradient-to-b from-blue-400 to-blue-600 shadow-2xs" />
                <div className="w-1 h-3/4 rounded-xs bg-gradient-to-b from-sky-300 to-indigo-500 shadow-2xs" />
                <div className="w-1 h-1/2 rounded-xs bg-gradient-to-b from-indigo-400 to-purple-500 shadow-2xs" />
              </div>
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-800 dark:text-slate-100 group-hover:text-blue-500 transition-colors">
              Kanban
            </span>
          </div>

          <div className={`h-4 w-px ${theme === "dark" ? "bg-[#1e293b]" : "bg-gray-200"}`} />

          {isEditingBoardName ? (
            <input
              type="text"
              value={tempBoardName}
              onChange={(e) => setTempBoardName(e.target.value)}
              onBlur={() => {
                if (tempBoardName.trim() && tempBoardName !== boardName) {
                  updateBoardName(tempBoardName.trim());
                }
                setIsEditingBoardName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (tempBoardName.trim() && tempBoardName !== boardName) {
                    updateBoardName(tempBoardName.trim());
                  }
                  setIsEditingBoardName(false);
                }
              }}
              autoFocus
              className={`border text-sm font-extrabold px-2 py-1 rounded-lg focus:outline-none shadow-xs ${theme === "dark" ? "bg-[#1e293b] border-blue-500 text-slate-100" : "bg-white border-blue-500 text-slate-900"
                }`}
            />
          ) : (
            <h1
              onClick={() => {
                if (isOwner) {
                  setTempBoardName(boardName);
                  setIsEditingBoardName(true);
                }
              }}
              className={`text-sm font-extrabold transition-colors flex items-center gap-2 ${theme === "dark" ? "text-slate-100" : "text-slate-900"
                } ${isOwner ? "hover:text-[#4262ff] dark:hover:text-[#38bdf8] cursor-pointer" : ""}`}
            >
              {boardName}
              {isOwner && <span className="text-[10px] font-normal text-slate-400 opacity-0 group-hover:opacity-100">(click to edit)</span>}
            </h1>
          )}
        </div>

        {/* Header Right Status & User */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${theme === "dark"
              ? "bg-[#1e293b] text-amber-400 hover:bg-[#334155] border-[#334155]"
              : "bg-gray-100 text-slate-700 hover:bg-gray-200 border-gray-200"
              }`}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${status === "connected"
            ? theme === "dark" ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
            : status === "connecting"
              ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
              : "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
            }`}>
            {status === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="capitalize">{status}</span>
          </div>

          {/* View-Only Mode Badge & Popover (Miro Screenshot 1 & 2) */}
          {!canEdit && (
            <div className="relative">
              <button
                onClick={() => setIsViewOnlyPopoverOpen(!isViewOnlyPopoverOpen)}
                className="px-3 py-1.5 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Eye size={13} /> View only <ChevronDown size={13} />
              </button>

              {/* View-Only Request Access Popover (Miro Screenshot 1 & 2) */}
              {isViewOnlyPopoverOpen && (
                <div className={`absolute right-0 mt-2 w-72 rounded-2xl border shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-100" : "bg-white border-gray-200 text-slate-800"
                  }`}>
                  <p className="text-xs leading-relaxed mb-3">
                    {user && user.email !== "guest@kanban.demo"
                      ? "You're a viewer on this board. Ask for editor rights to make changes."
                      : "You're a viewer on this board. To ask for editor rights to make changes, please log in with your Google account."}
                  </p>

                  {user && user.email !== "guest@kanban.demo" ? (
                    accessRequestStatus === "approved" ? (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <Check size={14} /> Editor access granted!
                      </div>
                    ) : accessRequestStatus === "pending" ? (
                      <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <Check size={14} /> Request sent to owner
                      </div>
                    ) : (
                      <button
                        onClick={handleRequestAccess}
                        disabled={isRequestingAccess}
                        className="w-full py-2 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                      >
                        {isRequestingAccess ? "Sending request..." : "Request editor rights"}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleLogin(boardId || "")}
                      className="w-full py-2 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      Log in to Request Edit Access
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notifications Bell Dropdown (Miro Screenshot 3, 4 & 5) */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer relative ${theme === "dark"
                  ? "bg-[#1e293b] text-slate-200 hover:bg-[#334155] border-[#334155]"
                  : "bg-gray-100 text-slate-700 hover:bg-gray-200 border-gray-200"
                  }`}
                title="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0f172a] shadow-xs">
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
          )}

          <button
            onClick={() => {
              if (!user || user.email === "guest@kanban.demo") {
                setShowGuestShareModal(true);
              } else {
                setIsShareModalOpen(true);
              }
            }}
            className={`px-4 py-1.5 rounded-xl text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${theme === "dark" ? "bg-[#2563eb] hover:bg-[#1d4ed8] shadow-md shadow-blue-500/20" : "bg-[#4262ff] hover:bg-[#3551d8] shadow-md shadow-blue-500/20"
              }`}
          >
            <LinkIcon size={13} /> Share
          </button>

          {user ? (
            <div className={`flex items-center gap-2.5 px-3 py-1 rounded-xl border ${theme === "dark" ? "bg-[#1e293b] border-[#334155]" : "bg-gray-50 border-gray-200"
              }`}>
              <AvatarImage 
                src={user.avatarUrl} 
                name={user.name} 
                className="w-6 h-6 rounded-full object-cover" 
              />
              <span className={`text-xs font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}>{user.name}</span>
              <button
                onClick={async () => {
                  if (user?.email === "guest@kanban.demo" && boardId && isOwner) {
                    const token = (sessionStorage.getItem("kanban_jwt") || localStorage.getItem("kanban_jwt"));
                    if (token) {
                      try {
                        await fetch(`${API_URL}/api/boards/${boardId}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                      } catch (e) {}
                    }
                  }
                  logout();
                  navigate("/");
                }}
                className="text-slate-400 hover:text-rose-600 transition-colors ml-1 cursor-pointer"
                title="Logout"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleLogin(boardId || "")}
              className="px-3.5 py-1.5 bg-[#4262ff] hover:bg-[#3551d8] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Secondary Toolbar: Search, Filter Chips & Export PNG/PDF */}
      <div className={`px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 ${
        theme === "dark" ? "bg-[#0b1329]/80 border-[#1e293b]" : "bg-slate-50 border-gray-200"
      }`}>
        {/* Left: Search input & Tag filters */}
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 min-w-[200px] md:min-w-[260px] ${
            theme === "dark" ? "bg-[#1e293b] border-[#334155]" : "bg-white border-gray-200 shadow-2xs"
          }`}>
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search cards in board..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-transparent text-xs focus:outline-none placeholder:text-slate-400 ${
                theme === "dark" ? "text-slate-100" : "text-slate-800"
              }`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
            <button
              onClick={() => setSelectedTagFilter("All")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                selectedTagFilter === "All"
                  ? "bg-[#4262ff] text-white border-blue-500 shadow-2xs"
                  : theme === "dark" ? "bg-[#1e293b] text-slate-300 border-[#334155] hover:bg-slate-800" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              All Cards
            </button>
            {allBoardTags.map((tagName) => {
              const colorObj = getTagColor(tagName);
              const active = selectedTagFilter.toLowerCase() === tagName.toLowerCase();
              return (
                <button
                  key={tagName}
                  onClick={() => setSelectedTagFilter(active ? "All" : tagName)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${colorObj?.bg || ''} ${colorObj?.text || ''} ${
                    active ? "ring-2 ring-blue-500 shadow-2xs" : (colorObj?.border || '') + " opacity-80 hover:opacity-100"
                  }`}
                >
                  {tagName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Theme Wallpaper Palette & Export Dropdown Button */}
        <div className="flex items-center gap-2">
          {/* Theme Palette Button */}
          <div className="relative">
            <button
              onClick={() => setIsThemePaletteOpen(!isThemePaletteOpen)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                theme === "dark"
                  ? "bg-[#1e293b] hover:bg-[#334155] text-slate-200 border-[#334155]"
                  : "bg-white hover:bg-gray-100 text-slate-700 border-gray-200 shadow-2xs"
              }`}
              title="Change Board Background Wallpaper"
            >
              <Palette size={14} className="text-purple-400" />
              <span>Theme</span>
            </button>

            {isThemePaletteOpen && (
              <div className={`absolute right-0 mt-2 w-56 rounded-2xl border shadow-xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-100" : "bg-white border-gray-200 text-slate-800"
              }`}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1.5 mb-1.5 border-b border-gray-100 dark:border-slate-800">
                  Board Wallpapers
                </div>
                <div className="flex flex-col gap-1">
                  {Object.entries(BOARD_BACKGROUND_PRESETS).map(([bgKey, bgItem]) => (
                    <button
                      key={bgKey}
                      onClick={() => {
                        updateBoardBackground(bgKey);
                        setIsThemePaletteOpen(false);
                      }}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        boardBackground === bgKey
                          ? "bg-blue-500/10 text-blue-500 border border-blue-500/30"
                          : "hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-gradient-to-tr ${bgItem.previewBg} border border-white/20`} />
                      <span>{bgItem.name}</span>
                      {boardBackground === bgKey && <Check size={12} className="ml-auto text-blue-500" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export Dropdown Button */}
          <div className="relative">
          <button
            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
            disabled={isExporting}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              theme === "dark"
                ? "bg-[#1e293b] hover:bg-[#334155] text-slate-200 border-[#334155]"
                : "bg-white hover:bg-gray-100 text-slate-700 border-gray-200 shadow-2xs"
            }`}
          >
            <Download size={14} />
            <span>{isExporting ? "Exporting..." : "Export Board"}</span>
            <ChevronDown size={13} />
          </button>

          {isExportDropdownOpen && (
            <div className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
              theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-100" : "bg-white border-gray-200 text-slate-800"
            }`}>
              <button
                onClick={() => {
                  setIsExportDropdownOpen(false);
                  handleExportPNG();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Image size={15} className="text-blue-500" />
                Export as PNG Image
              </button>
              <button
                onClick={() => {
                  setIsExportDropdownOpen(false);
                  handleExportPDF();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <FileText size={15} className="text-purple-500" />
                Print / Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* MIRO KANBAN CANVAS */}
      <main ref={boardContainerRef} className="p-6 md:p-8 w-full max-w-[1920px] mx-auto relative z-10 flex flex-col gap-6">

        {/* Unauthenticated Edit Prompt Banner (Shown ONLY if logging in will grant edit access) */}
        {!user && canEditIfLoggedIn && (
          <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-xs ${theme === "dark" ? "bg-blue-950/40 border-blue-800/60 text-slate-100" : "bg-blue-50 border-blue-200 text-slate-800"
            }`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-[#4262ff] dark:text-[#38bdf8] flex items-center justify-center font-bold text-sm">
                🔐
              </div>
              <div>
                <p className="text-xs font-bold">Want to edit this board?</p>
                <p className="text-[11px] opacity-75">Log in with Google to create, edit, and move cards in real-time.</p>
              </div>
            </div>
            <button
              onClick={() => handleLogin(boardId || "")}
              className="px-4 py-2 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex-shrink-0 cursor-pointer"
            >
              Log in to Edit
            </button>
          </div>
        )}

        {/* View-Only Mode Indicator Badge (Shown when accessing via an explicit View-Only link) */}
        {(inviteRole === "view" || (!canEditIfLoggedIn && !canEdit)) && (
          <div className={`border rounded-2xl p-3.5 flex items-center justify-between shadow-xs ${theme === "dark" ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-gray-50 border-gray-200 text-slate-600"
            }`}>
            <div className="flex items-center gap-2.5">
              <span className="text-sm">👁️</span>
              <p className="text-xs font-semibold">
                You are viewing this board in <span className="font-bold text-amber-500">Read-Only Mode</span>.
              </p>
            </div>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>

          {/* Top Column Headers Row */}
          <div className="flex gap-6 items-center w-full px-1">
            {columns.map((col, colIdx) => {
              const totalColCards = cards.filter((c: any) => c.List === col).length;
              const colStyle = COLUMN_STYLES[colIdx % COLUMN_STYLES.length];

              return (
                <div key={col} className="flex-1 min-w-0 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold ${colStyle.headerPill}`}>
                      {col}
                    </span>
                    <span className={`text-xs font-semibold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{totalColCards}</span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openRenameModal("Rename Column", col, (newName) => renameColumn(col, newName))}
                        className="p-1 text-slate-400 hover:text-blue-500 rounded transition-colors"
                        title="Rename Column"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => openConfirmModal("Delete Column?", `Are you sure you want to delete column "${col}" and all its cards?`, () => deleteColumn(col))}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete Column"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Unified Swimlane Rows Section */}
          <div className="flex flex-col gap-6 w-full">
            {(swimlanes.length > 0 ? swimlanes : [""]).map((swim, swimIdx) => {
              const isCollapsed = !!collapsedSwimlanes[swim];
              const isFirstSwimlane = swimIdx === 0;
              const tagColor = SWIMLANE_TAG_COLORS[swimIdx % SWIMLANE_TAG_COLORS.length];
              const totalSwimCards = cards.filter((c: any) => {
                if (swimlanes.length === 0) return true;
                const cardSwim = (c.Swimlane || "").trim();
                if (cardSwim === swim) return true;
                if (isFirstSwimlane && (!cardSwim || cardSwim === "Untitled" || !swimlanes.includes(cardSwim))) return true;
                return false;
              }).length;

              return (
                <div key={swim || "default"} className="flex flex-col gap-3 w-full">

                  {/* Swimlane Section Title Row with Collapsible Chevron */}
                  {swimlanes.length > 0 && (
                    <div className="flex items-center gap-2.5 py-1 group/swim">
                      <button 
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-0.5 cursor-pointer"
                        onClick={() => toggleSwimlane(swim)}
                        title={isCollapsed ? "Expand Swimlane" : "Collapse Swimlane"}
                      >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <span 
                        onClick={() => {
                          if (canEdit) openRenameModal("Rename Swimlane", swim, (newName) => renameSwimlane(swim, newName));
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:scale-105 transition-all ${tagColor}`}
                        title="Click to rename swimlane"
                      >
                        {swim}
                      </span>

                      <span className={`text-xs font-semibold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        ({totalSwimCards})
                      </span>

                      {canEdit && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/swim:opacity-100 transition-opacity ml-1">
                          <button
                            onClick={() => openRenameModal("Rename Swimlane", swim, (newName) => renameSwimlane(swim, newName))}
                            className={`p-1 text-slate-400 hover:text-blue-500 rounded transition-colors cursor-pointer ${theme === "dark" ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}
                            title="Rename Swimlane"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => openConfirmModal("Delete Swimlane?", `Are you sure you want to delete swimlane "${swim}"?`, () => deleteSwimlane(swim))}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Swimlane"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Swimlane Columns Grid */}
                  {!isCollapsed && (
                    <div className="flex gap-6 items-stretch w-full">
                      {columns.map((col, colIdx) => {
                        const rowSwim = swim || "Untitled";
                        const swimCards = filteredCards
                          .filter((c: any) => {
                            if (c.List !== col) return false;
                            if (swimlanes.length === 0) return true;
                            const cardSwim = (c.Swimlane || "").trim();
                            if (cardSwim === swim) return true;
                            if (isFirstSwimlane && (!cardSwim || cardSwim === "Untitled" || !swimlanes.includes(cardSwim))) return true;
                            return false;
                          })
                          .sort((a: any, b: any) => (a.Position ?? 0) - (b.Position ?? 0));
                        const swimCardIds = swimCards.map((c: any) => c.ID.toString());
                        const dropKey = `${col}:::${rowSwim}`;
                        const isAdding = addingToKey === dropKey;

                        return (
                          <div key={col} className="flex-1 min-w-0 flex flex-col justify-between min-h-[100px] group/col">
                            <div className="flex flex-col">
                              <SortableContext items={swimCardIds} strategy={verticalListSortingStrategy}>
                                <SwimlaneDropZone id={dropKey}>
                                  {swimCards.map((c: any) => (
                                    <DraggableCard
                                      key={c.ID}
                                      id={c.ID.toString()}
                                      cardData={c}
                                      title={c.Title}
                                      tags={c.Tags}
                                      columnIndex={colIdx}
                                      swimlaneName={swimlanes.length > 0 ? ((c.Swimlane && c.Swimlane !== "Untitled") ? c.Swimlane : (swim || "Untitled")) : undefined}
                                      swimlaneIndex={swimIdx}
                                      onEdit={editCard}
                                      onUpdateTags={updateCardTags}
                                      onDelete={(cardId) => openConfirmModal("Delete Task?", `Are you sure you want to delete task "${c.Title}"?`, () => deleteCard(cardId))}
                                      onOpenDetail={handleOpenCardDetail}
                                      canEdit={canEdit}
                                    />
                                  ))}
                                </SwimlaneDropZone>
                              </SortableContext>
                            </div>

                            {/* Full-width "+ Add card" button (Only visible on hover matching user mockups) */}
                            {canEdit && !isAdding && (
                              <button
                                onClick={() => {
                                  setAddingToKey(dropKey);
                                  setNewTaskTitle("");
                                }}
                                className={`mt-3 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer opacity-0 group-hover/col:opacity-100 ${
                                  theme === "dark"
                                    ? "bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60"
                                    : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 shadow-2xs"
                                }`}
                              >
                                <Plus size={14} /> Add card
                              </button>
                            )}

                            {/* Inline Draft Card Creation Box (Clean Auto-Save on Blur/Enter, No Buttons) */}
                            {canEdit && isAdding && (
                              <div className={`mt-3 border-2 p-4 rounded-2xl flex flex-col gap-3 shadow-md w-full transition-all ${
                                theme === "dark" ? "bg-[#1e293b] border-blue-500" : "bg-white border-blue-400"
                              }`}>
                                <textarea
                                  ref={(el) => adjustHeight(el)}
                                  autoFocus
                                  rows={2}
                                  placeholder="Type something"
                                  value={newTaskTitle}
                                  onChange={(e) => {
                                    setNewTaskTitle(e.target.value);
                                    adjustHeight(e.target);
                                  }}
                                  onBlur={() => {
                                    if (newTaskTitle.trim()) {
                                      const lastPos = swimCards[swimCards.length - 1]?.Position ?? 0;
                                      addCard(newTaskTitle.trim(), col, lastPos + 1000, swim || "Untitled");
                                    }
                                    setNewTaskTitle("");
                                    setAddingToKey(null);
                                  }}
                                  className={`w-full bg-transparent border-none focus:outline-none text-xs font-semibold leading-relaxed resize-none overflow-hidden [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap ${
                                    theme === "dark" ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
                                  }`}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      if (newTaskTitle.trim()) {
                                        const lastPos = swimCards[swimCards.length - 1]?.Position ?? 0;
                                        addCard(newTaskTitle.trim(), col, lastPos + 1000, swim || "Untitled");
                                      }
                                      setNewTaskTitle("");
                                      setAddingToKey(null);
                                    } else if (e.key === "Escape") {
                                      setAddingToKey(null);
                                      setNewTaskTitle("");
                                    }
                                  }}
                                />

                                {swimlanes.length > 0 && (
                                  <div className="flex items-center justify-between pt-1">
                                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-tight shadow-2xs ${
                                      SWIMLANE_TAG_COLORS[swimIdx % SWIMLANE_TAG_COLORS.length]
                                    }`}>
                                      {swim || "Untitled"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Soft Separator Line Between Swimlanes */}
                  {swimlanes.length > 0 && swimIdx < swimlanes.length - 1 && (
                    <div className={`border-b my-2 w-full ${theme === "dark" ? "border-[#1e293b]" : "border-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </DndContext>
      </main>

      {/* Miro Floating Toolbar at Bottom Center */}
      {canEdit && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 backdrop-blur-xl px-3 py-1.5 rounded-2xl border shadow-xl flex items-center gap-1.5 ${theme === "dark" ? "bg-[#0f172a]/95 border-[#1e293b] text-slate-200" : "bg-white/95 border-gray-200 text-slate-700"
          }`}>
          <button
            onClick={() => {
              const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
              let letterIdx = 0;
              let name = `Team ${letters[letterIdx]}`;
              while (swimlanes.includes(name)) {
                letterIdx++;
                if (letterIdx < letters.length) {
                  name = `Team ${letters[letterIdx]}`;
                } else {
                  name = `Team ${letterIdx + 1}`;
                }
              }
              addSwimlane(name);
            }}
            className={`p-2 rounded-xl transition-all flex items-center gap-2 font-semibold text-xs group cursor-pointer ${theme === "dark" ? "hover:bg-[#1e293b] text-slate-300 hover:text-white" : "hover:bg-gray-100 text-slate-600 hover:text-slate-900"
              }`}
            title="Add Swimlane (Horizontal Row)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="12" y1="12" x2="12" y2="20" />
              <line x1="8" y1="16" x2="16" y2="16" />
            </svg>
          </button>

          <div className={`h-5 w-[1px] ${theme === "dark" ? "bg-[#1e293b]" : "bg-gray-200"}`} />

          <button
            onClick={() => {
              let name = "Column 1";
              let count = 1;
              while (columns.includes(name)) {
                name = `Column ${++count}`;
              }
              addColumn(name);
            }}
            className={`p-2 rounded-xl transition-all flex items-center gap-2 font-semibold text-xs group cursor-pointer ${theme === "dark" ? "hover:bg-[#1e293b] text-slate-300 hover:text-white" : "hover:bg-gray-100 text-slate-600 hover:text-slate-900"
              }`}
            title="Add Column (Vertical Column)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
              <line x1="6" y1="4" x2="6" y2="20" />
              <line x1="12" y1="12" x2="20" y2="12" />
              <line x1="16" y1="8" x2="16" y2="16" />
            </svg>
          </button>
        </div>
      )}

      {/* Custom Light Glassmorphic Modal Card Box (Centered on screen) */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4 relative border animate-in fade-in zoom-in-95 duration-150 ${theme === "dark" ? "bg-[#0f172a] border-[#1e293b] text-slate-100" : "bg-white border-gray-200 text-slate-900"
            }`}>

            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-3 ${theme === "dark" ? "border-[#1e293b]" : "border-gray-100"}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                {modalConfig.type === "confirm" ? (
                  <AlertCircle size={17} className="text-rose-500" />
                ) : (
                  <Edit2 size={17} className="text-blue-500" />
                )}
                {modalConfig.title}
              </h3>
              <button
                onClick={closeModal}
                className={`transition-colors p-1 rounded-lg ${theme === "dark" ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-gray-100"}`}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Content Body */}
            {modalConfig.type === "confirm" ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                {modalConfig.description}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
                <input
                  autoFocus
                  type="text"
                  value={modalInputVal}
                  onChange={(e) => setModalInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      modalConfig.onConfirm?.(modalInputVal);
                    } else if (e.key === "Escape") {
                      closeModal();
                    }
                  }}
                  className="w-full bg-white border border-gray-300 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-colors shadow-xs"
                />
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={closeModal}
                className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (modalConfig.type === "confirm") {
                    modalConfig.onConfirm?.();
                  } else {
                    modalConfig.onConfirm?.(modalInputVal);
                  }
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${modalConfig.type === "confirm"
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                  : "bg-[#4262ff] hover:bg-[#3551d8] text-white shadow-blue-500/20"
                  }`}
              >
                {modalConfig.type === "confirm" ? "Delete" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MIRO OFFICIAL SHARE MODAL DIALOG */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className={`rounded-2xl border shadow-2xl p-6 max-w-lg w-full flex flex-col gap-5 relative transition-colors ${theme === "dark" ? "bg-[#0f172a] border-[#1e293b] text-slate-100" : "bg-white border-gray-200 text-slate-900"
            }`}>

            {/* Top Close Button */}
            <button
              onClick={() => setIsShareModalOpen(false)}
              className={`absolute top-5 right-5 p-1.5 rounded-xl transition-colors cursor-pointer ${theme === "dark" ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-gray-100"
                }`}
            >
              <X size={18} />
            </button>

            {/* Top Modal Navigation Tabs (Invite, Embed) */}
            <div className={`flex items-center gap-6 border-b text-sm font-semibold pb-2.5 ${theme === "dark" ? "border-[#1e293b]" : "border-gray-200"
              }`}>
              <button
                onClick={() => setShareTab("invite")}
                className={`pb-2.5 -mb-3 transition-colors cursor-pointer ${shareTab === "invite"
                  ? "text-[#4262ff] dark:text-[#38bdf8] font-bold border-b-2 border-[#4262ff] dark:border-[#38bdf8]"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
              >
                Invite
              </button>
              <button
                onClick={() => setShareTab("embed")}
                className={`pb-2.5 -mb-3 transition-colors cursor-pointer ${shareTab === "embed"
                  ? "text-[#4262ff] dark:text-[#38bdf8] font-bold border-b-2 border-[#4262ff] dark:border-[#38bdf8]"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
              >
                Embed
              </button>
            </div>

            {/* TAB 1: INVITE */}
            {shareTab === "invite" && (
              <>
                {/* Middle Invite Link Bar (Grey Container Box) */}
                <div className={`flex items-center justify-between gap-2 border rounded-xl p-2 pl-3 ${theme === "dark" ? "bg-[#162032] border-[#334155]" : "bg-[#f4f5f7] border-gray-200"
                  }`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <LinkIcon size={16} className="text-slate-500 flex-shrink-0" />
                    <span className={`text-xs truncate font-medium ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                      {`${window.location.origin}/b/${boardId}?inviteToken=${shareLinkRole === "edit" ? editInviteToken : viewInviteToken}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={shareLinkRole}
                      onChange={(e) => setShareLinkRole(e.target.value as "edit" | "view")}
                      className={`border text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-200" : "bg-white border-gray-200 text-slate-800"
                        }`}
                    >
                      <option value="edit">Can edit</option>
                      <option value="view">Can view</option>
                    </select>

                    <button
                      onClick={() => {
                        const tokenToCopy = shareLinkRole === "edit" ? editInviteToken : viewInviteToken;
                        const url = `${window.location.origin}/b/${boardId}?inviteToken=${tokenToCopy}`;
                        navigator.clipboard.writeText(url);
                        setCopySuccessToast(true);
                        setTimeout(() => setCopySuccessToast(false), 3000);
                      }}
                      className="px-3.5 py-1.5 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-lg transition-all shadow-sm flex-shrink-0 cursor-pointer"
                    >
                      {copySuccessToast ? "Copied! ✓" : "Copy team invite link"}
                    </button>
                  </div>
                </div>

                {shareView === "main" ? (
                  <>
                    {/* BOARD ACCESS Section */}
                    <div className="flex flex-col gap-3 pt-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        BOARD ACCESS
                      </span>

                      {/* Team Members Row (Miro Screenshot 1) */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Member Avatars Stack */}
                          <div className="flex items-center -space-x-1.5 overflow-hidden flex-shrink-0">
                            {boardMembers.length > 0 ? (
                              boardMembers.slice(0, 3).map((m, idx) => (
                                <AvatarImage
                                  key={m.id || idx}
                                  src={m.avatarUrl}
                                  name={m.name}
                                  className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-[#0f172a] object-cover"
                                />
                              ))
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-bold text-slate-900">
                                👤
                              </div>
                            )}
                          </div>
                          <span className={`text-xs font-medium truncate ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                            <span className="font-bold">{boardMembers.length || 1} team members</span> have access
                          </span>
                        </div>

                        {isOwner && (
                          <button
                            onClick={() => setShareView("manage_access")}
                            className="text-xs font-bold text-[#4262ff] dark:text-[#38bdf8] hover:underline cursor-pointer flex-shrink-0"
                          >
                            Manage access
                          </button>
                        )}
                      </div>

                      {/* Anyone with the link Row */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <Globe size={16} className="text-slate-500 flex-shrink-0" />
                          <span className={`text-xs font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                            Anyone with the link
                          </span>
                        </div>

                        {user ? (
                          <select
                            value={accessLevel}
                            onChange={(e) => updateBoardAccess(e.target.value as "edit" | "view" | "private")}
                            className={`border text-xs font-semibold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-200" : "bg-white border-gray-200 text-slate-800"
                              }`}
                          >
                            <option value="edit">Can edit</option>
                            <option value="view">Viewer</option>
                            <option value="private">No access</option>
                          </select>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500 capitalize">
                            {accessLevel === "edit" ? "Can edit" : accessLevel === "view" ? "Viewer" : "No access"}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* MANAGE BOARD ACCESS VIEW (Miro Screenshot 2) */
                  <div className="flex flex-col gap-4">
                    {/* Header with Back button */}
                    <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-[#1e293b]">
                      <button
                        onClick={() => setShareView("main")}
                        className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <ArrowLeft size={16} /> Back
                      </button>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Manage board access
                      </h3>
                      <div className="w-12" />
                    </div>

                    {/* Members List */}
                    <div className="max-h-72 overflow-y-auto space-y-3 pr-1 divide-y divide-gray-100 dark:divide-[#1e293b]/60">
                      {boardMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between pt-3 first:pt-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <AvatarImage
                              src={member.avatarUrl}
                              name={member.name}
                              className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {member.name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {member.email}
                              </p>
                            </div>
                          </div>

                          {/* Role Selector (Editor / Viewer) */}
                          <div className="flex-shrink-0">
                            {member.isOwner ? (
                              <span className="text-xs font-bold text-slate-400 px-3 py-1">Owner</span>
                            ) : (
                              <select
                                // บังคับอ่านค่าจาก member.role ตรงๆ ("edit" -> "Editor", อื่นๆ -> "Viewer")
                                value={member.role === "edit" ? "Editor" : "Viewer"}
                                onChange={async (e) => {
                                  const selectedValue = e.target.value; // "Editor" หรือ "Viewer"
                                  const newRoleForBackend = selectedValue === "Editor" ? "edit" : "view";
                                  const targetUserId = member.id;

                                  // 1. อัปเดต UI ทันที และล็อกค่าไว้ใน React State
                                  setBoardMembers((prevMembers) =>
                                    prevMembers.map((m) =>
                                      m.id === targetUserId ? { ...m, role: newRoleForBackend } : m
                                    )
                                  );

                                  // 2. ยิง API บันทึกลง Database
                                  const token = (sessionStorage.getItem("kanban_jwt") || localStorage.getItem("kanban_jwt"));
                                  if (!token) return;

                                  try {
                                    const res = await fetch(`${API_URL}/api/boards/${boardId}/members/${targetUserId}`, {
                                      method: "POST",
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ role: newRoleForBackend }),
                                    });

                                    if (!res.ok) {
                                      console.error("Failed to update role in DB, reverting...");
                                      // ถ้ายิง API ไม่ผ่าน ค่อยดึงข้อมูลเดิมจากเซิร์ฟเวอร์มาคืนค่า
                                      fetchBoardMembers();
                                    }
                                    // **ถ้ายิงผ่าน (res.ok) ไม่ต้องเรียก fetchBoardMembers() แล้ว** 
                                    // เพราะ Optimistic Update ได้อัปเดต state อย่างถูกต้องเรียบร้อยแล้ว
                                  } catch (err) {
                                    console.error("Error updating role:", err);
                                    fetchBoardMembers();
                                  }
                                }}
                                className={`border text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer ${theme === "dark"
                                  ? "bg-[#1e293b] border-[#334155] text-slate-200"
                                  : "bg-white border-gray-200 text-slate-800"
                                  }`}
                              >
                                <option value="Editor">Editor</option>
                                <option value="Viewer">Viewer</option>
                              </select>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom Action Button */}
                    <div className="pt-3 border-t flex justify-between items-center border-gray-100 dark:border-[#1e293b]">
                      <button
                        onClick={() => setShareView("main")}
                        className="px-6 py-2 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Copy Board Link */}
                <div className={`pt-4 border-t flex items-center gap-2 ${theme === "dark" ? "border-[#1e293b]" : "border-gray-200"
                  }`}>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/b/${boardId}`;
                      navigator.clipboard.writeText(url);
                      setCopySuccessToast(true);
                      setTimeout(() => setCopySuccessToast(false), 3000);
                    }}
                    className="text-[#4262ff] dark:text-[#38bdf8] hover:underline text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <LinkIcon size={16} /> Copy board link
                  </button>
                </div>
              </>
            )}

            {/* TAB 2: EMBED */}
            {shareTab === "embed" && (
              <div className="flex flex-col gap-4">
                {/* Blue Info Notice Box */}
                <div className="flex items-start gap-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl p-3.5 text-xs">
                  <Eye size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    <strong className="font-bold text-slate-900 dark:text-slate-100">This board is shared by link.</strong> Anyone can view the board. Change who can see it in the <button onClick={() => setShareTab("invite")} className="text-blue-600 dark:text-blue-400 underline font-semibold cursor-pointer">invite section</button>.
                  </p>
                </div>

                {/* Settings Row */}
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Start view:</span>
                    <span className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-200" : "bg-gray-100 border-gray-200 text-slate-800"
                      }`}>
                      📺 Board <ChevronDown size={14} />
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-semibold">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    View only
                  </label>
                </div>

                {/* Embedded Board Preview Box */}
                <div className={`h-40 rounded-xl border p-4 flex flex-col justify-center items-center gap-2 text-center relative overflow-hidden ${theme === "dark" ? "bg-[#090d16] border-[#334155]" : "bg-gray-100 border-gray-200"
                  }`}>
                  <div className="w-full max-w-xs h-24 border rounded-lg p-2 bg-white dark:bg-[#1e293b] dark:border-slate-700 shadow-xs flex flex-col gap-1.5 opacity-80">
                    <div className="flex gap-2">
                      <div className="w-1/3 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
                      <div className="w-1/3 h-4 bg-blue-100 dark:bg-blue-900/50 rounded" />
                      <div className="w-1/3 h-4 bg-green-100 dark:bg-green-900/50 rounded" />
                    </div>
                    <div className="w-full h-12 bg-gray-50 dark:bg-slate-800 rounded border border-dashed border-gray-200 dark:border-slate-700" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Embed Preview</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      const iframeCode = `<iframe src="${window.location.origin}/b/${boardId}?inviteToken=${viewInviteToken}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;
                      navigator.clipboard.writeText(iframeCode);
                      setCopySuccessToast(true);
                      setTimeout(() => setCopySuccessToast(false), 3000);
                    }}
                    className="flex-1 py-2.5 bg-[#4262ff] hover:bg-[#3551d8] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Code size={15} /> {copySuccessToast ? "Copied HTML! ✓" : "Copy code"}
                  </button>

                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/b/${boardId}?inviteToken=${viewInviteToken}`;
                      navigator.clipboard.writeText(url);
                      setCopySuccessToast(true);
                      setTimeout(() => setCopySuccessToast(false), 3000);
                    }}
                    className={`flex-1 py-2.5 border text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${theme === "dark" ? "bg-[#1e293b] border-[#334155] text-slate-200 hover:bg-slate-800" : "bg-white border-gray-300 text-blue-600 hover:bg-gray-50"
                      }`}
                  >
                    <LinkIcon size={15} /> Copy link
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Rich Glassmorphic Card Detail Modal */}
      {currentCardDetail && (
        <CardDetailModal
          card={currentCardDetail}
          canEdit={canEdit}
          theme={theme}
          swimlanes={swimlanes}
          onClose={() => setSelectedCardDetail(null)}
          onEditDetail={editCardDetail}
          onDeleteCard={(cardId, title) => {
            openConfirmModal("Delete Task?", `Are you sure you want to delete task "${title}"?`, () => {
              deleteCard(cardId);
              setSelectedCardDetail(null);
            });
          }}
        />
      )}

      {/* Guest Share Prompt Modal */}
      {showGuestShareModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className={`max-w-md w-full rounded-3xl p-6 border shadow-2xl relative overflow-hidden ${
            theme === "dark" 
              ? "bg-[#1e293b]/95 border-[#334155] text-slate-100 shadow-blue-950/40" 
              : "bg-white/95 border-gray-200 text-slate-900 shadow-slate-400/20"
          }`}>
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-[1.5px] shadow-lg shadow-blue-500/20">
                <div className="w-full h-full bg-[#0f172a] rounded-[14px] flex items-center justify-center text-blue-400">
                  <UserPlus size={20} />
                </div>
              </div>
              <button 
                onClick={() => setShowGuestShareModal(false)}
                className="p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="text-lg font-extrabold tracking-tight mb-2">
              Sign in to Share Board
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              You are currently exploring in <strong className="text-blue-500 font-semibold">Guest Mode</strong>. Sign in with your Google account to invite collaborators, manage editor rights, and generate real-time share links.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleLogin(boardId || "")}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Globe size={15} /> Continue with Google
              </button>
              <button
                onClick={() => setShowGuestShareModal(false)}
                className="w-full py-2 bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                {isOwner || userRole === "editor" ? "Keep Editing as Guest" : "Keep Viewing as Guest"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Exit & Save Prompt Modal */}
      {showGuestExitModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className={`max-w-md w-full rounded-3xl p-6 border shadow-2xl relative overflow-hidden ${
            theme === "dark" 
              ? "bg-[#1e293b]/95 border-[#334155] text-slate-100 shadow-rose-950/30" 
              : "bg-white/95 border-gray-200 text-slate-900 shadow-slate-400/20"
          }`}>
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 p-[1.5px] shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-[#0f172a] rounded-[14px] flex items-center justify-center text-amber-400">
                  <AlertCircle size={20} />
                </div>
              </div>
              <button 
                onClick={() => setShowGuestExitModal(false)}
                className="p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="text-lg font-extrabold tracking-tight mb-2">
              Save Board Before Leaving?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              You are using <strong className="text-amber-500 font-semibold">Guest Access</strong>. Connect your Google account now to save this board permanently under your dashboard, or exit to discard.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleLogin(boardId || "")}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={15} /> Sign In to Save Board
              </button>
              <button
                onClick={async () => {
                  setShowGuestExitModal(false);
                  const token = (sessionStorage.getItem("kanban_jwt") || localStorage.getItem("kanban_jwt"));
                  if (boardId && token) {
                    try {
                      await fetch(`${API_URL}/api/boards/${boardId}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                    } catch (err) {
                      console.error("Failed deleting guest board:", err);
                    }
                  }
                  navigate("/", { replace: true });
                }}
                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} /> Exit & Discard Board
              </button>
              <button
                onClick={() => setShowGuestExitModal(false)}
                className="w-full py-1.5 bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium rounded-xl transition-all cursor-pointer"
              >
                Stay on Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
