"use client";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import ConversationView from "./components/ConversationView";
import SessionSidebarContainer from "./components/SessionSidebarContainer";
import useInsights from "./hooks/useInsights";
import useSessions from "./hooks/useSessions";
import useVoiceAgent from "./hooks/useVoiceAgent";

function VoiceAgent() {
  const { data: authSession, status: authStatus } = useSession();
  const userName = authSession?.user?.name || authSession?.user?.email || null;
  const isAuthed = authStatus === "authenticated";
  const resetRef = useRef<() => void>(() => {});

  const {
    sessions,
    activeSessionId,
    editingSessionId,
    editingTitle,
    menuSessionId,
    setEditingTitle,
    setMenuSessionId,
    activeMessages,
    hasMessages,
    updateActiveMessages,
    persistMessage,
    createSession,
    switchSession,
    deleteSession,
    startRenameSession,
    commitRenameSession,
    cancelRename,
  } = useSessions({
    isAuthed,
    authStatus,
    onReset: () => resetRef.current(),
  });

  const voiceAgent = useVoiceAgent({
    isAuthed,
    activeSessionId,
    updateActiveMessages,
    persistMessage,
  });

  useEffect(() => {
    resetRef.current = voiceAgent.reset;
  }, [voiceAgent.reset]);

  const insights = useInsights({ isAuthed, sessionId: activeSessionId });

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background:
          "linear-gradient(135deg, #E9EEF7 0%, #F6F9FF 45%, #E9EEF7 100%)",
        fontFamily: '"Space Grotesk", "Avenir Next", "Helvetica Neue", sans-serif',
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row">
        <SessionSidebarContainer
          sessions={sessions}
          activeSessionId={activeSessionId}
          editingSessionId={editingSessionId}
          editingTitle={editingTitle}
          menuSessionId={menuSessionId}
          authStatus={authStatus}
          userName={userName}
          onCreateSession={createSession}
          onSwitchSession={switchSession}
          onStartRename={(id) => {
            setMenuSessionId(null);
            startRenameSession(id);
          }}
          onCommitRename={commitRenameSession}
          onCancelRename={cancelRename}
          onDeleteSession={(id) => {
            setMenuSessionId(null);
            deleteSession(id);
          }}
          onToggleMenu={(id) =>
            setMenuSessionId((prev) => (prev === id ? null : id))
          }
          onEditingTitleChange={setEditingTitle}
        />

        <ConversationView
          isAuthed={isAuthed}
          hasMessages={hasMessages}
          activeMessages={activeMessages}
          voice={voiceAgent}
          insights={insights}
        />
      </div>
    </div>
  );
}

export default VoiceAgent;
