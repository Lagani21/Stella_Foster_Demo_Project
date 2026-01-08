"use client";

type EmptyStateProps = {
  connected: boolean;
  status: string | null;
  onStart: () => void;
};

export default function EmptyState({ connected, status, onStart }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <button
        className="rounded-full px-8 py-4 text-lg font-semibold text-white shadow-lg"
        style={{ backgroundColor: "#92B5ED" }}
        disabled={!connected}
        onClick={onStart}
      >
        {connected ? (
          <span className="inline-flex items-center gap-2">
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
            Start Recording
          </span>
        ) : (
          "Connecting..."
        )}
      </button>
      <p className="mt-4 text-sm text-slate-500">I am here to listen.</p>
      {status && <div className="mt-2 text-xs text-slate-500">{status}</div>}
    </div>
  );
}
