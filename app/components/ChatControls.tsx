"use client";

type ChatControlsProps = {
  connected: boolean;
  isRecording: boolean;
  isResponding: boolean;
  status: string | null;
  isFloating?: boolean;
  showStopResponse?: boolean;
  onToggleMic: () => void;
  onStopResponse: () => void;
};

export default function ChatControls({
  connected,
  isRecording,
  isResponding,
  status,
  isFloating = false,
  showStopResponse = true,
  onToggleMic,
  onStopResponse,
}: ChatControlsProps) {
  const recordButton = (
    <button
      className="rounded-full p-3 text-white shadow"
      style={{ backgroundColor: isRecording ? "#EF4444" : "#92B5ED" }}
      disabled={!connected}
      onClick={onToggleMic}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      {connected ? (
        isRecording ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3 11l18-7-7 18-2.5-7.5L3 11z" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
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
        )
      ) : (
        <span className="text-xs">...</span>
      )}
    </button>
  );

  const stopResponseButton = (
    <button
      className="rounded-full p-3 text-white disabled:opacity-50"
      style={{ backgroundColor: "#1F4D99" }}
      disabled={!connected || !isResponding}
      onClick={onStopResponse}
      aria-label={isResponding ? "Stop response" : "Play response"}
    >
      {isResponding ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="8,5 19,12 8,19" />
        </svg>
      )}
    </button>
  );

  if (isFloating) {
    return (
      <div className="flex items-center justify-end gap-2">
        {recordButton}
        {showStopResponse && stopResponseButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {recordButton}
        {showStopResponse && stopResponseButton}
      </div>
      {status && <div className="text-xs text-slate-500">{status}</div>}
    </div>
  );
}
