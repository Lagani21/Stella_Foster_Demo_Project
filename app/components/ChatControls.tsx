"use client";

type ChatControlsProps = {
  connected: boolean;
  isRecording: boolean;
  isResponding: boolean;
  audioPaused: boolean;
  status: string | null;
  isFloating?: boolean;
  showAudioToggle?: boolean;
  onToggleMic: () => void;
  onToggleAudio: () => void;
  onStopResponse: () => void;
};

export default function ChatControls({
  connected,
  isRecording,
  isResponding,
  audioPaused,
  status,
  isFloating = false,
  showAudioToggle = true,
  onToggleMic,
  onToggleAudio,
  onStopResponse,
}: ChatControlsProps) {
  const recordButton = (
    <button
      className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow"
      style={{ backgroundColor: isRecording ? "#1E3A8A" : "#92B5ED" }}
      disabled={!connected}
      onClick={onToggleMic}
    >
      {connected ? (
        <span className="inline-flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
          {isRecording ? "Recording... Click to Stop" : "Click to Start Recording"}
        </span>
      ) : (
        "Connecting..."
      )}
    </button>
  );

  const stopResponseButton = (
    <button
      className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50"
      style={{ backgroundColor: "#1F4D99" }}
      disabled={!connected || !isResponding}
      onClick={onStopResponse}
    >
      Stop Response
    </button>
  );

  if (isFloating) {
    return (
      <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2">
        {recordButton}
        {stopResponseButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {recordButton}
        <div className="flex items-center gap-2">
          {showAudioToggle && (
            <button
              className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50"
              style={{ backgroundColor: "#1F4D99" }}
              disabled={!connected}
              onClick={onToggleAudio}
            >
              {audioPaused ? "Unmute Audio" : "Mute Audio"}
            </button>
          )}
          {stopResponseButton}
        </div>
      </div>
      {status && <div className="text-xs text-slate-500">{status}</div>}
    </div>
  );
}
