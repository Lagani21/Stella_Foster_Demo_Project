"use client";

import ChatControls from "./ChatControls";
import ChatMessages from "./ChatMessages";
import EmptyState from "./EmptyState";
import EventLog from "./EventLog";
import InsightsPanel from "./InsightsPanel";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type VoiceState = {
  connected: boolean;
  isRecording: boolean;
  isResponding: boolean;
  audioPaused: boolean;
  status: string | null;
  error: string | null;
  lastError: string | null;
  liveTranscript: string;
  eventLog: string[];
  toggleMic: () => void;
  toggleAudioPlayback: () => void;
  stopResponse: () => void;
};

type InsightsState = {
  loading: boolean;
  insights: { id: string; title: string; detail: string; meta?: string }[];
};

type Props = {
  isAuthed: boolean;
  hasMessages: boolean;
  activeMessages: ChatMessage[];
  voice: VoiceState;
  insights: InsightsState;
  floatingControls?: React.ReactNode;
};

export default function ConversationView({
  isAuthed,
  hasMessages,
  activeMessages,
  voice,
  insights,
  floatingControls,
}: Props) {
  return (
    <main className="flex-1 md:pr-4">
      <div className="relative flex min-h-[520px] max-h-[72vh] flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white/70 p-6 shadow-sm backdrop-blur">
        {!hasMessages && !voice.isRecording ? (
          <EmptyState
            connected={voice.connected}
            status={voice.status}
            onStart={voice.toggleMic}
            title={
              isAuthed
                ? "You’re all set. Start a conversation."
                : "I am here to listen."
            }
            subtitle={
              isAuthed ? "Your sessions will be saved to your account." : undefined
            }
            steps={
              isAuthed
                ? [
                    "Press the mic to speak.",
                    "Stop to let the agent respond.",
                    "Find insights in the panel on the right.",
                  ]
                : undefined
            }
          />
        ) : null}

        {voice.lastError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 whitespace-pre-wrap">
            {voice.lastError}
          </div>
        )}
        {voice.error && (
          <div className="mt-2 text-sm text-red-600">{voice.error}</div>
        )}

        {hasMessages || voice.isRecording ? (
          <>
            <div className="mt-6 flex-1 overflow-y-auto pr-2">
              <ChatMessages
                messages={activeMessages}
                isRecording={voice.isRecording}
                liveTranscript={voice.liveTranscript}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex w-full justify-end">
                <ChatControls
                  connected={voice.connected}
                  isRecording={voice.isRecording}
                  isResponding={voice.isResponding}
                  status={voice.status}
                  onToggleMic={voice.toggleMic}
                  onStopResponse={voice.stopResponse}
                />
              </div>
              {floatingControls}
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[2fr,1fr]">
        <EventLog events={voice.eventLog} />
        <InsightsPanel loading={insights.loading} insights={insights.insights} />
      </div>
    </main>
  );
}
