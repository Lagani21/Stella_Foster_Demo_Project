"use client";
import { useSession, signOut } from "next-auth/react";
import ChatControls from "./components/ChatControls";
import ChatMessages from "./components/ChatMessages";
import EmptyState from "./components/EmptyState";
import EventLog from "./components/EventLog";
import SessionSidebar from "./components/SessionSidebar";
import useSessions from "./hooks/useSessions";
import useVoiceAgent from "./hooks/useVoiceAgent";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function VoiceAgent() {
  const { data: authSession, status: authStatus } = useSession();
  const userName = authSession?.user?.name || authSession?.user?.email || null;
  const isAuthed = authStatus === "authenticated";

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
    createSession,
    switchSession,
    deleteSession,
    startRenameSession,
    commitRenameSession,
    cancelRename,
  } = useSessions({
    isAuthed,
    onReset: () => voice.reset(),
  });

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

  const voice = useVoiceAgent({
    isAuthed,
    activeSessionId,
    updateActiveMessages: updateActiveMessages as unknown as (
      updater: (messages: ChatMessage[]) => ChatMessage[]
    ) => void,
    persistMessage: persistMessage as (
      sessionId: string,
      role: "user" | "assistant",
      text: string
    ) => Promise<void>,
  });

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
        <SessionSidebar
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
          onSignOut={() => signOut({ callbackUrl: "/login" })}
        />

        <main className="flex-1 md:pr-4">
          <div className="rounded-3xl border border-blue-100 bg-white/70 p-6 shadow-sm backdrop-blur">
            {!hasMessages && !voice.isRecording ? (
              <EmptyState
                connected={voice.connected}
                status={voice.status}
                onStart={voice.toggleMic}
              />
            ) : (
              <ChatControls
                connected={voice.connected}
                isRecording={voice.isRecording}
                isResponding={voice.isResponding}
                audioPaused={voice.audioPaused}
                status={voice.status}
                onToggleMic={voice.toggleMic}
                onToggleAudio={voice.toggleAudioPlayback}
                onStopResponse={voice.stopResponse}
              />
            )}

            {voice.lastError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 whitespace-pre-wrap">
                {voice.lastError}
              </div>
            )}
            {voice.error && <div className="mt-2 text-sm text-red-600">{voice.error}</div>}

            <ChatMessages
              messages={activeMessages}
              isRecording={voice.isRecording}
              liveTranscript={voice.liveTranscript}
            />
          </div>

          <EventLog events={voice.eventLog} />
        </main>
      </div>

      {voice.isRecording && (
        <ChatControls
          connected={voice.connected}
          isRecording={voice.isRecording}
          isResponding={voice.isResponding}
          audioPaused={voice.audioPaused}
          status={null}
          isFloating
          showAudioToggle={false}
          onToggleMic={voice.toggleMic}
          onToggleAudio={voice.toggleAudioPlayback}
          onStopResponse={voice.stopResponse}
        />
      )}
    </div>
  );
}

export default VoiceAgent;
