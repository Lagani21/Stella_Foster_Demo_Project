"use client";

import { signOut } from "next-auth/react";
import SessionSidebar from "./SessionSidebar";
import type { Session } from "../hooks/useSessions";

type Props = {
  sessions: Session[];
  activeSessionId: string;
  editingSessionId: string | null;
  editingTitle: string;
  menuSessionId: string | null;
  authStatus: "authenticated" | "unauthenticated" | "loading";
  userName: string | null;
  onCreateSession: () => void;
  onSwitchSession: (id: string) => void;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onDeleteSession: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onEditingTitleChange: (value: string) => void;
};

export default function SessionSidebarContainer({
  sessions,
  activeSessionId,
  editingSessionId,
  editingTitle,
  menuSessionId,
  authStatus,
  userName,
  onCreateSession,
  onSwitchSession,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDeleteSession,
  onToggleMenu,
  onEditingTitleChange,
}: Props) {
  return (
    <SessionSidebar
      sessions={sessions}
      activeSessionId={activeSessionId}
      editingSessionId={editingSessionId}
      editingTitle={editingTitle}
      menuSessionId={menuSessionId}
      authStatus={authStatus}
      userName={userName}
      onCreateSession={onCreateSession}
      onSwitchSession={onSwitchSession}
      onStartRename={onStartRename}
      onCommitRename={onCommitRename}
      onCancelRename={onCancelRename}
      onDeleteSession={onDeleteSession}
      onToggleMenu={onToggleMenu}
      onEditingTitleChange={onEditingTitleChange}
      onSignOut={() => signOut({ callbackUrl: "/login" })}
    />
  );
}
