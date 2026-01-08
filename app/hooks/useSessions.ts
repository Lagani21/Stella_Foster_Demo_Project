"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type Session = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

type UseSessionsOptions = {
  isAuthed: boolean;
  authStatus: "authenticated" | "unauthenticated" | "loading";
  onReset: () => void;
};

export default function useSessions({
  isAuthed,
  authStatus,
  onReset,
}: UseSessionsOptions) {
  const localSyncDoneRef = useRef(false);
  const initialSessionIdRef = useRef<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);

  const LOCAL_STORAGE_KEY = "stella.sessions.v1";

  const readLocalSessions = () => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Session[]) : [];
    } catch {
      return [];
    }
  };

  const writeLocalSessions = (nextSessions: Session[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextSessions));
    } catch {
      // Ignore local storage failures
    }
  };

  const clearLocalSessions = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // Ignore local storage failures
    }
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeMessages = activeSession?.messages ?? [];

  const updateActiveMessages = (
    updater: (messages: ChatMessage[]) => ChatMessage[]
  ) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? { ...session, messages: updater(session.messages) }
          : session
      )
    );
  };

  const persistMessage = async (
    sessionId: string,
    role: "user" | "assistant",
    text: string
  ) => {
    if (!isAuthed) return;
    await fetch(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, text }),
    });
  };

  const createSessionRemote = async (title?: string) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to create session");
    }
    return (await res.json()) as Session;
  };

  const createSession = async () => {
    if (isAuthed) {
      const created = await createSessionRemote();
      setSessions((prev) => [...prev, created]);
      setActiveSessionId(created.id);
      onReset();
      return;
    }
    const newId = crypto.randomUUID();
    setSessions((prev) => [
      ...prev,
      { id: newId, title: `Session ${prev.length + 1}`, messages: [] },
    ]);
    setActiveSessionId(newId);
    onReset();
  };

  const switchSession = (id: string) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    onReset();
  };

  const deleteSession = async (id: string) => {
    if (sessions.length === 1) return;
    if (isAuthed) {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    }
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((session) => session.id !== id);
      if (remaining[0]) {
        setActiveSessionId(remaining[0].id);
      }
    }
    onReset();
  };

  const startRenameSession = (id: string) => {
    const current = sessions.find((session) => session.id === id);
    setEditingSessionId(id);
    setEditingTitle(current?.title || "");
  };

  const commitRenameSession = async (id: string) => {
    const nextName = editingTitle.trim();
    if (!nextName) return;
    if (isAuthed) {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextName }),
      });
    }
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, title: nextName } : session
      )
    );
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const cancelRename = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  useEffect(() => {
    const loadSessions = async () => {
      if (!isAuthed || authStatus === "loading") return;
      const res = await fetch("/api/sessions");
      if (!res.ok) return;
      const data = (await res.json()) as Session[];
      if (!localSyncDoneRef.current) {
        const localSessions = readLocalSessions();
        if (localSessions.length) {
          try {
            for (const localSession of localSessions) {
              const created = await createSessionRemote(localSession.title);
              for (const message of localSession.messages || []) {
                await persistMessage(created.id, message.role, message.text);
              }
            }
            clearLocalSessions();
          } catch {
            // Keep local sessions if sync fails
          } finally {
            localSyncDoneRef.current = true;
          }
          const refreshed = await fetch("/api/sessions");
          if (refreshed.ok) {
            const refreshedData = (await refreshed.json()) as Session[];
            setSessions(refreshedData);
            setActiveSessionId(refreshedData[0]?.id || "");
            onReset();
            return;
          }
        } else {
          localSyncDoneRef.current = true;
        }
      }
      setSessions(data);
      setActiveSessionId(data[0]?.id || "");
      onReset();
    };

    loadSessions();
  }, [isAuthed, authStatus]);

  useEffect(() => {
    if (isAuthed || authStatus === "loading") return;
    const localSessions = readLocalSessions();
    if (localSessions.length) {
      setSessions(localSessions);
      setActiveSessionId(localSessions[0].id);
      return;
    }
    if (!initialSessionIdRef.current) {
      initialSessionIdRef.current = crypto.randomUUID();
      setSessions([
        { id: initialSessionIdRef.current, title: "Session 1", messages: [] },
      ]);
      setActiveSessionId(initialSessionIdRef.current);
    }
  }, [isAuthed, authStatus]);

  useEffect(() => {
    if (isAuthed || authStatus === "loading") return;
    writeLocalSessions(sessions);
  }, [sessions, isAuthed, authStatus]);

  return {
    sessions,
    activeSessionId,
    editingSessionId,
    editingTitle,
    menuSessionId,
    setEditingTitle,
    setMenuSessionId,
    activeMessages,
    hasMessages: activeMessages.length > 0,
    updateActiveMessages,
    persistMessage,
    createSession,
    switchSession,
    deleteSession,
    startRenameSession,
    commitRenameSession,
    cancelRename,
  };
}
