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
  onReset: () => void;
};

export default function useSessions({ isAuthed, onReset }: UseSessionsOptions) {
  const initialSessionIdRef = useRef<string>(crypto.randomUUID());
  const [sessions, setSessions] = useState<Session[]>(() => [
    { id: initialSessionIdRef.current, title: "Session 1", messages: [] },
  ]);
  const [activeSessionId, setActiveSessionId] = useState(
    initialSessionIdRef.current
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);

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
      if (!isAuthed) return;
      const res = await fetch("/api/sessions");
      if (!res.ok) return;
      const data = (await res.json()) as Session[];
      if (data.length === 0) {
        const created = await createSessionRemote();
        setSessions([created]);
        setActiveSessionId(created.id);
        onReset();
        return;
      }
      setSessions(data);
      setActiveSessionId(data[0].id);
      onReset();
    };

    loadSessions();
  }, [isAuthed]);

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
    createSession,
    switchSession,
    deleteSession,
    startRenameSession,
    commitRenameSession,
    cancelRename,
  };
}
