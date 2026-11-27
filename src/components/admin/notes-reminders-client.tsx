"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellPlus,
  CalendarClock,
  Check,
  Folder,
  FolderPlus,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { formatDateTimeBR } from "@/lib/format";
import {
  Button,
  ConfirmModal,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

type NoteFolderItem = {
  id: string;
  name: string;
  color: string;
};

type StudioNoteItem = {
  id: string;
  folderId: string | null;
  folderName: string | null;
  folderColor: string | null;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  updatedAt: string;
};

type ReminderItem = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  dueAt: string;
  completedAt: string | null;
};

const NOTE_PALETTE = [
  { id: "pink", label: "Rosa", bg: "#ff66a3", text: "#000000" },
  { id: "cyan", label: "Azul", bg: "#1ac2ff", text: "#000000" },
  { id: "green", label: "Verde", bg: "#4ade80", text: "#000000" },
  { id: "yellow", label: "Amarelo", bg: "#facc15", text: "#000000" },
  { id: "purple", label: "Lilás", bg: "#c084fc", text: "#000000" },
  { id: "orange", label: "Laranja", bg: "#fb923c", text: "#000000" },
  { id: "champagne", label: "Dourado", bg: "#e6c77a", text: "#000000" },
  { id: "default", label: "Branco", bg: "#f4f4f5", text: "#000000" },
] as const;

function getPalette(colorId: string | null | undefined) {
  return (
    NOTE_PALETTE.find((c) => c.id === colorId) ||
    NOTE_PALETTE[0]
  );
}

export function NotesRemindersClient({
  todayStr,
  initialReminders,
  initialFolders,
  initialNotes,
}: {
  todayStr: string;
  initialReminders: ReminderItem[];
  initialFolders: NoteFolderItem[];
  initialNotes: StudioNoteItem[];
}) {
  const router = useRouter();
  const [sectionTab, setSectionTab] = useState<"notes" | "reminders">("notes");
  const [notes, setNotes] = useState<StudioNoteItem[]>(initialNotes);
  const [folders, setFolders] = useState<NoteFolderItem[]>(initialFolders);
  const [reminders, setReminders] = useState<ReminderItem[]>(initialReminders);

  const [activeFolderId, setActiveFolderId] = useState<string>("ALL");
  const [reminderFilter, setReminderFilter] = useState<"PENDING" | "DONE" | "ALL">(
    "PENDING"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Criar/Editar Nota
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StudioNoteItem | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteFolderId, setNoteFolderId] = useState<string>("");
  const [noteNewFolderName, setNoteNewFolderName] = useState("");
  const [noteColor, setNoteColor] = useState<string>("pink");
  const [notePinned, setNotePinned] = useState(false);

  // Modal Criar Pasta
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("yellow");

  // Modal Criar/Editar Lembrete
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(
    null
  );
  const [remTitle, setRemTitle] = useState("");
  const [remDesc, setRemDesc] = useState("");
  const [remDate, setRemDate] = useState(todayStr);
  const [remTime, setRemTime] = useState("09:00");
  const [remColor, setRemColor] = useState("cyan");

  // Exclusão
  const [deleteNoteTarget, setDeleteNoteTarget] =
    useState<StudioNoteItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<NoteFolderItem | null>(null);
  const [deleteReminderTarget, setDeleteReminderTarget] =
    useState<ReminderItem | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeFolderId === "NONE" && n.folderId !== null) return false;
      if (
        activeFolderId !== "ALL" &&
        activeFolderId !== "NONE" &&
        n.folderId !== activeFolderId
      ) {
        return false;
      }
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.folderName || "").toLowerCase().includes(q)
      );
    });
  }, [notes, activeFolderId, searchQuery]);

  const filteredReminders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reminders.filter((r) => {
      const done = Boolean(r.completedAt);
      if (reminderFilter === "PENDING" && done) return false;
      if (reminderFilter === "DONE" && !done) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
      );
    });
  }, [reminders, reminderFilter, searchQuery]);

  const openNewNote = () => {
    setEditingNote(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteFolderId(
      activeFolderId !== "ALL" && activeFolderId !== "NONE"
        ? activeFolderId
        : ""
    );
    setNoteNewFolderName("");
    setNoteColor("pink");
    setNotePinned(false);
    setError(null);
    setNoteModalOpen(true);
  };

  const openEditNote = (n: StudioNoteItem) => {
    setEditingNote(n);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setNoteFolderId(n.folderId || "");
    setNoteNewFolderName("");
    setNoteColor(n.color || "pink");
    setNotePinned(n.isPinned);
    setError(null);
    setNoteModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let resolvedFolderId: string | null = noteFolderId || null;

      if (noteFolderId === "__NEW__" && noteNewFolderName.trim()) {
        const fRes = await fetch("/api/admin/note-folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: noteNewFolderName.trim(),
            color: noteColor,
          }),
        });
        if (fRes.ok) {
          const fData = await fRes.json();
          if (fData.folder) {
            resolvedFolderId = fData.folder.id;
            setFolders((prev) =>
              prev.some((f) => f.id === fData.folder.id)
                ? prev
                : [...prev, fData.folder]
            );
          }
        }
      } else if (noteFolderId === "__NEW__") {
        resolvedFolderId = null;
      }

      const payload = {
        title: noteTitle.trim(),
        content: noteContent,
        folderId: resolvedFolderId,
        color: noteColor,
        isPinned: notePinned,
      };

      const url = editingNote
        ? `/api/admin/notes/${editingNote.id}`
        : "/api/admin/notes";
      const method = editingNote ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao salvar nota.");
        return;
      }

      const mapped: StudioNoteItem = {
        id: data.note.id,
        folderId: data.note.folderId,
        folderName: data.note.folder?.name || null,
        folderColor: data.note.folder?.color || null,
        title: data.note.title,
        content: data.note.content,
        color: data.note.color,
        isPinned: data.note.isPinned,
        updatedAt: data.note.updatedAt,
      };

      setNotes((prev) => {
        const next = editingNote
          ? prev.map((x) => (x.id === mapped.id ? mapped : x))
          : [mapped, ...prev];
        return [...next].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      });
      setNoteModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (n: StudioNoteItem) => {
    const res = await fetch(`/api/admin/notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !n.isPinned }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => {
        const next = prev.map((x) =>
          x.id === n.id
            ? { ...x, isPinned: data.note.isPinned, updatedAt: data.note.updatedAt }
            : x
        );
        return [...next].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      });
    }
  };

  const handleConfirmDeleteNote = async () => {
    if (!deleteNoteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/notes/${deleteNoteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((x) => x.id !== deleteNoteTarget.id));
        setDeleteNoteTarget(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/note-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName.trim(),
          color: folderColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar pasta.");
        return;
      }
      if (data.folder) {
        setFolders((prev) =>
          prev.some((f) => f.id === data.folder.id)
            ? prev.map((f) => (f.id === data.folder.id ? data.folder : f))
            : [...prev, data.folder]
        );
        setActiveFolderId(data.folder.id);
      }
      setFolderName("");
      setFolderModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/note-folders?id=${encodeURIComponent(deleteFolderTarget.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setFolders((prev) =>
          prev.filter((f) => f.id !== deleteFolderTarget.id)
        );
        setNotes((prev) =>
          prev.map((n) =>
            n.folderId === deleteFolderTarget.id
              ? { ...n, folderId: null, folderName: null, folderColor: null }
              : n
          )
        );
        if (activeFolderId === deleteFolderTarget.id) setActiveFolderId("ALL");
        setDeleteFolderTarget(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const openNewReminder = (prefillTitle = "", prefillContent = "") => {
    setEditingReminder(null);
    setRemTitle(prefillTitle);
    setRemDesc(prefillContent);
    setRemDate(todayStr);
    setRemTime("09:00");
    setRemColor("cyan");
    setError(null);
    setReminderModalOpen(true);
  };

  const openEditReminder = (r: ReminderItem) => {
    setEditingReminder(r);
    setRemTitle(r.title);
    setRemDesc(r.description || "");
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(r.dueAt));
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    setRemDate(`${map.year}-${map.month}-${map.day}`);
    setRemTime(`${map.hour}:${map.minute}`);
    setRemColor(r.color || "cyan");
    setError(null);
    setReminderModalOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const dueAt = remTime ? `${remDate}T${remTime}` : remDate;
      const method = editingReminder ? "PATCH" : "POST";
      const body = editingReminder
        ? {
            id: editingReminder.id,
            title: remTitle.trim(),
            description: remDesc.trim() || null,
            dueAt,
            color: remColor,
          }
        : {
            title: remTitle.trim(),
            description: remDesc.trim() || undefined,
            dueAt,
            color: remColor,
          };

      const res = await fetch("/api/admin/reminders", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao salvar lembrete.");
        return;
      }

      if (data.reminder) {
        const mapped: ReminderItem = {
          id: data.reminder.id,
          title: data.reminder.title,
          description: data.reminder.description,
          color: data.reminder.color || "cyan",
          dueAt: data.reminder.dueAt,
          completedAt: data.reminder.completedAt,
        };
        setReminders((prev) =>
          editingReminder
            ? prev.map((x) => (x.id === mapped.id ? mapped : x))
            : [mapped, ...prev]
        );
      }
      setReminderModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleReminderDone = async (r: ReminderItem) => {
    const nextDone = !r.completedAt;
    setReminders((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, completedAt: nextDone ? new Date().toISOString() : null }
          : x
      )
    );
    await fetch("/api/admin/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, completed: nextDone }),
    });
    router.refresh();
  };

  const handleConfirmDeleteReminder = async () => {
    if (!deleteReminderTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/reminders?id=${encodeURIComponent(deleteReminderTarget.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setReminders((prev) =>
          prev.filter((x) => x.id !== deleteReminderTarget.id)
        );
        setDeleteReminderTarget(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const pendingRemindersCount = reminders.filter((r) => !r.completedAt).length;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-champagne)]">
            Organização Pessoal & Estúdio
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Lembretes & Notas
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Crie notas personalizadas com pastas e cores vibrantes ou agende lembretes rápidos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setFolderModalOpen(true);
            }}
            className="h-9 px-3.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
            <span>Nova pasta</span>
          </button>

          <button
            type="button"
            onClick={() => openNewReminder()}
            className="h-9 px-3.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <BellPlus className="h-3.5 w-3.5 text-[var(--brand-champagne)]" />
            <span>Novo lembrete</span>
          </button>

          <button
            type="button"
            onClick={openNewNote}
            className="h-9 px-4 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span>Nova nota</span>
          </button>
        </div>
      </div>

      {/* Abas Notas / Lembretes + Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] w-full sm:w-auto sm:min-w-[260px]">
          <button
            type="button"
            onClick={() => setSectionTab("notes")}
            className={`flex-1 h-8 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              sectionTab === "notes"
                ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            Notas ({notes.length})
          </button>
          <button
            type="button"
            onClick={() => setSectionTab("reminders")}
            className={`flex-1 h-8 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              sectionTab === "reminders"
                ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            Lembretes ({pendingRemindersCount})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="h-4 w-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar título, nota ou pasta..."
            className="w-full h-10 pl-10 pr-4 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>
      </div>

      {/* ABA NOTAS (Estilo Janela Neo-Brutalista com cores, título e pastas) */}
      {sectionTab === "notes" ? (
        <div className="space-y-5">
          {/* Pastas */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFolderId("ALL")}
              className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                activeFolderId === "ALL"
                  ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
              }`}
            >
              Todas ({notes.length})
            </button>

            {folders.map((folder) => {
              const p = getPalette(folder.color);
              const count = notes.filter((n) => n.folderId === folder.id).length;
              const isActive = activeFolderId === folder.id;
              return (
                <div key={folder.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    className={`h-8 px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-default)]"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black shrink-0"
                      style={{ backgroundColor: p.bg }}
                    />
                    <Folder className="h-3 w-3 opacity-80" />
                    <span>
                      {folder.name} ({count})
                    </span>
                  </button>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => setDeleteFolderTarget(folder)}
                      aria-label={`Remover pasta ${folder.name}`}
                      className="h-7 w-7 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] inline-flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              );
            })}

            {notes.some((n) => !n.folderId) && folders.length > 0 ? (
              <button
                type="button"
                onClick={() => setActiveFolderId("NONE")}
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  activeFolderId === "NONE"
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
                }`}
              >
                Sem pasta
              </button>
            ) : null}
          </div>

          {filteredNotes.length === 0 ? (
            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center space-y-3">
              <StickyNote className="h-7 w-7 mx-auto text-[var(--brand-champagne)]" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Nenhuma nota nesta visualização
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Crie notas personalizadas com título, pasta e a cor que preferir.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openNewNote}>
                + Nova nota
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4 pr-2">
              {filteredNotes.map((note) => {
                const pal = getPalette(note.color);
                return (
                  <div
                    key={note.id}
                    style={{
                      backgroundColor: pal.bg,
                      border: "3px solid #000000",
                      boxShadow: "10px 10px 0 #000000",
                      fontFamily: "var(--font-display), Montserrat, sans-serif",
                    }}
                    className="min-h-[225px] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 overflow-hidden"
                  >
                    <div>
                      {/* Barra superior estilo Window */}
                      <div
                        style={{
                          backgroundColor: "#ffffff",
                          color: "#000000",
                          borderBottom: "3px solid #000000",
                        }}
                        className="px-3 py-1.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {note.isPinned ? (
                            <Pin className="h-3.5 w-3.5 fill-black text-black shrink-0" />
                          ) : null}
                          <span className="text-[13px] font-black truncate tracking-tight">
                            {note.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(note)}
                            title={note.isPinned ? "Desafixar" : "Fixar nota"}
                            className="h-6 w-6 inline-flex items-center justify-center rounded border-2 border-black bg-white hover:bg-zinc-200 text-black cursor-pointer"
                          >
                            <Pin
                              className={`h-3 w-3 ${
                                note.isPinned ? "fill-black" : ""
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteNoteTarget(note)}
                            title="Excluir nota"
                            className="h-6 w-6 inline-flex items-center justify-center rounded border-2 border-black bg-[#ff66a3] hover:bg-red-400 text-black cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Corpo da janela */}
                      <div className="p-3 space-y-2 text-black">
                        {note.folderName ? (
                          <span
                            style={{
                              border: "2px solid #000000",
                              backgroundColor: "#ffffff",
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black"
                          >
                            <Folder className="h-2.5 w-2.5" />
                            {note.folderName}
                          </span>
                        ) : null}

                        <p className="text-[13px] font-semibold leading-snug whitespace-pre-wrap break-words line-clamp-5">
                          {note.content || "Sem conteúdo adicional."}
                        </p>
                      </div>
                    </div>

                    {/* Botões estilo Neobrutalista no rodapé da nota */}
                    <div className="px-3 pb-3 pt-1 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openEditNote(note)}
                        style={{
                          border: "3px solid #000000",
                          boxShadow: "3px 3px 0 #000000",
                        }}
                        className="px-3 py-1 bg-[#4ade80] hover:bg-[#1ac2ff] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none text-black text-xs font-extrabold transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => openNewReminder(note.title, note.content)}
                        style={{
                          border: "3px solid #000000",
                          boxShadow: "3px 3px 0 #000000",
                        }}
                        className="px-2.5 py-1 bg-[#ffffff] hover:bg-[#facc15] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none text-black text-[11px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <CalendarClock className="h-3 w-3" />
                        Lembrar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ABA LEMBRETES (também com janelinhas neobrutalistas coloridas!) */}
      {sectionTab === "reminders" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["PENDING", `Pendentes (${pendingRemindersCount})`],
                ["DONE", `Concluídos (${reminders.length - pendingRemindersCount})`],
                ["ALL", `Todos (${reminders.length})`],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setReminderFilter(k)}
                className={`h-8 px-3.5 rounded-full text-xs font-medium border cursor-pointer ${
                  reminderFilter === k
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {filteredReminders.length === 0 ? (
            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center space-y-3">
              <CalendarClock className="h-7 w-7 mx-auto text-[var(--brand-champagne)]" />
              <p className="text-sm font-semibold">
                Nenhum lembrete nesta lista
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => openNewReminder()}
              >
                + Novo lembrete
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4 pr-2">
              {filteredReminders.map((rem) => {
                const pal = getPalette(rem.color || "cyan");
                const done = Boolean(rem.completedAt);
                return (
                  <div
                    key={rem.id}
                    style={{
                      backgroundColor: done ? "#d4d4d8" : pal.bg,
                      border: "3px solid #000000",
                      boxShadow: "10px 10px 0 #000000",
                    }}
                    className={`min-h-[190px] flex flex-col justify-between transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 ${
                      done ? "opacity-75" : ""
                    }`}
                  >
                    <div>
                      <div
                        style={{
                          backgroundColor: "#ffffff",
                          color: "#000000",
                          borderBottom: "3px solid #000000",
                        }}
                        className="px-3 py-1.5 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-black truncate tabular-nums">
                          {formatDateTimeBR(rem.dueAt)}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditReminder(rem)}
                            className="h-6 w-6 inline-flex items-center justify-center rounded border-2 border-black bg-white hover:bg-zinc-200 text-black cursor-pointer"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteReminderTarget(rem)}
                            className="h-6 w-6 inline-flex items-center justify-center rounded border-2 border-black bg-[#ff66a3] hover:bg-red-400 text-black cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 space-y-1.5 text-black">
                        <p
                          className={`text-sm font-black leading-snug ${
                            done ? "line-through" : ""
                          }`}
                        >
                          {rem.title}
                        </p>
                        {rem.description ? (
                          <p className="text-xs font-semibold leading-snug whitespace-pre-wrap">
                            {rem.description}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleReminderDone(rem)}
                        style={{
                          border: "3px solid #000000",
                          boxShadow: "3px 3px 0 #000000",
                        }}
                        className={`px-3 py-1 text-black text-xs font-extrabold transition-all cursor-pointer inline-flex items-center gap-1.5 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${
                          done
                            ? "bg-white hover:bg-[#facc15]"
                            : "bg-[#4ade80] hover:bg-[#1ac2ff]"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {done ? "Reabrir" : "Concluir"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* MODAL NOTA PERSONALIZADA (Tela inteira no celular) */}
      {noteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/65 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleSaveNote}
            className="w-full max-h-[88dvh] md:max-w-lg rounded-t-[28px] md:rounded-3xl bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">
                {editingNote ? "Editar nota" : "Nova nota personalizada"}
              </h2>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs font-medium">
                {error}
              </div>
            ) : null}

            <Field label="Título da janela *">
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Ex: Ideias Fine Line, Compras do mês..."
                required
              />
            </Field>

            <Field label="Pasta (opcional)">
              <Select
                value={noteFolderId}
                onChange={(e) => setNoteFolderId(e.target.value)}
              >
                <option value="">Sem pasta (Geral)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
                <option value="__NEW__">+ Criar nova pasta...</option>
              </Select>
            </Field>

            {noteFolderId === "__NEW__" ? (
              <Field label="Nome da nova pasta">
                <Input
                  value={noteNewFolderName}
                  onChange={(e) => setNoteNewFolderName(e.target.value)}
                  placeholder="Ex: Estúdio, Fornecedores, Pessoal..."
                />
              </Field>
            ) : null}

            <Field label="Cor do card">
              <div className="flex flex-wrap gap-2">
                {NOTE_PALETTE.map((c) => {
                  const selected = noteColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNoteColor(c.id)}
                      style={{
                        backgroundColor: c.bg,
                        border: "2.5px solid #000000",
                        boxShadow: selected ? "3px 3px 0 #ffffff" : "2px 2px 0 #000000",
                      }}
                      className={`h-8 px-3 rounded-lg text-[11px] font-extrabold text-black inline-flex items-center gap-1 cursor-pointer transition-transform ${
                        selected ? "scale-105 ring-2 ring-[var(--brand-champagne)]" : ""
                      }`}
                    >
                      {selected ? <Check className="h-3 w-3" strokeWidth={2.8} /> : null}
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Conteúdo da nota">
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Escreva tudo o que precisar aqui..."
                className="min-h-[120px]"
              />
            </Field>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={notePinned}
                onChange={(e) => setNotePinned(e.target.checked)}
              />
              Fixar esta nota no topo
            </label>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setNoteModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : "Salvar nota"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* MODAL CRIAR PASTA (Tela inteira no mobile) */}
      {folderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/65 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-h-[88dvh] md:max-w-sm rounded-t-[28px] md:rounded-3xl bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">
                Nova pasta
              </h2>
              <button
                type="button"
                onClick={() => setFolderModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs font-medium">
                {error}
              </div>
            ) : null}

            <Field label="Nome da pasta *">
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Ex: Ideias, Estúdio, Compras..."
                required
              />
            </Field>

            <Field label="Cor da pasta">
              <div className="flex flex-wrap gap-2">
                {NOTE_PALETTE.map((c) => {
                  const selected = folderColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFolderColor(c.id)}
                      style={{
                        backgroundColor: c.bg,
                        border: "2.5px solid #000000",
                      }}
                      className={`h-8 px-2.5 rounded-lg text-[11px] font-extrabold text-black inline-flex items-center gap-1 cursor-pointer ${
                        selected ? "ring-2 ring-[var(--brand-champagne)]" : ""
                      }`}
                    >
                      {selected ? <Check className="h-3 w-3" strokeWidth={2.8} /> : null}
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setFolderModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : "Criar pasta"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* MODAL CRIAR / EDITAR LEMBRETE (Tela inteira no mobile) */}
      {reminderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/65 backdrop-blur-xs p-0 md:p-4">
          <form
            onSubmit={handleSaveReminder}
            className="w-full max-h-[88dvh] md:max-w-md rounded-t-[28px] md:rounded-3xl bg-[var(--bg-surface)] border-t md:border border-[var(--border-strong)]/70 p-5 space-y-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">
                {editingReminder ? "Editar lembrete" : "Novo lembrete"}
              </h2>
              <button
                type="button"
                onClick={() => setReminderModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs font-medium">
                {error}
              </div>
            ) : null}

            <Field label="Título do lembrete *">
              <Input
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                placeholder="Ex: Confirmar cliente ou comprar luvas..."
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <Input
                  type="date"
                  value={remDate}
                  onChange={(e) => setRemDate(e.target.value)}
                  required
                />
              </Field>
              <Field label="Horário">
                <Input
                  type="time"
                  value={remTime}
                  onChange={(e) => setRemTime(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Cor do card">
              <div className="flex flex-wrap gap-2">
                {NOTE_PALETTE.map((c) => {
                  const selected = remColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setRemColor(c.id)}
                      style={{
                        backgroundColor: c.bg,
                        border: "2.5px solid #000000",
                      }}
                      className={`h-8 px-2.5 rounded-lg text-[11px] font-extrabold text-black inline-flex items-center gap-1 cursor-pointer ${
                        selected ? "ring-2 ring-[var(--brand-champagne)]" : ""
                      }`}
                    >
                      {selected ? <Check className="h-3 w-3" strokeWidth={2.8} /> : null}
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Detalhes (opcional)">
              <Textarea
                value={remDesc}
                onChange={(e) => setRemDesc(e.target.value)}
                placeholder="Observações extras..."
                className="min-h-[85px]"
              />
            </Field>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setReminderModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : "Salvar lembrete"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteNoteTarget)}
        title="Excluir nota?"
        description={`A nota "${deleteNoteTarget?.title || ""}" será removida permanentemente.`}
        confirmLabel="Excluir nota"
        danger
        loading={saving}
        onConfirm={handleConfirmDeleteNote}
        onCancel={() => setDeleteNoteTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteFolderTarget)}
        title="Remover pasta?"
        description={`A pasta "${deleteFolderTarget?.name || ""}" será removida (as notas continuam salvas em Todas).`}
        confirmLabel="Remover pasta"
        danger
        loading={saving}
        onConfirm={handleConfirmDeleteFolder}
        onCancel={() => setDeleteFolderTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteReminderTarget)}
        title="Excluir lembrete?"
        description={`O lembrete "${deleteReminderTarget?.title || ""}" será excluído.`}
        confirmLabel="Excluir lembrete"
        danger
        loading={saving}
        onConfirm={handleConfirmDeleteReminder}
        onCancel={() => setDeleteReminderTarget(null)}
      />
    </div>
  );
}
