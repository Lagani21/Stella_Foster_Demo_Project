"use client";

import Link from "next/link";

type Session = {
  id: string;
  title: string;
  messages: { id: string }[];
};

type SessionSidebarProps = {
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
  onSignOut: () => void;
};

export default function SessionSidebar({
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
  onSignOut,
}: SessionSidebarProps) {
  return (
    <aside className="w-full md:w-64 md:ml-[-24px]">
      <div className="min-h-[520px] rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="mb-4 rounded-xl border border-blue-100 bg-white/70 p-3 text-xs text-slate-600">
          {authStatus === "authenticated" ? (
            <div className="flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Signed in
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {userName || "Account"}
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Account
                </div>
                <div className="text-sm font-semibold text-slate-900">Guest</div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-900"
                  style={{ backgroundColor: "#92B5ED" }}
                >
                  Sign up
                </Link>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Sessions
          </div>
          <button
            className="rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-900"
            style={{ backgroundColor: "#92B5ED" }}
            onClick={onCreateSession}
            aria-label="Create new session"
          >
            +
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = session.id === editingSessionId;
            const isMenuOpen = session.id === menuSessionId;
            return (
              <div
                key={session.id}
                className={`relative w-full rounded-xl border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-blue-400 bg-blue-50 text-slate-900"
                    : "border-transparent bg-white/60 text-slate-600 hover:border-blue-200 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onSwitchSession(session.id)}
                    className="w-full text-left"
                  >
                    {isEditing ? (
                      <input
                        className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-sm text-slate-900"
                        value={editingTitle}
                        onChange={(e) => onEditingTitleChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onCommitRename(session.id);
                          if (e.key === "Escape") onCancelRename();
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="text-sm font-semibold">{session.title}</div>
                    )}
                    {!isEditing && (
                      <div className="text-xs text-slate-500">
                        {session.messages.length} messages
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => onToggleMenu(session.id)}
                    className="rounded-full px-2 py-1 text-slate-500 hover:text-slate-700"
                    aria-label="Session options"
                  >
                    &#8942;
                  </button>
                </div>
                {isEditing && (
                  <div className="mt-2 flex gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                    <button
                      onClick={() => onCommitRename(session.id)}
                      className="rounded-full border border-transparent px-2 py-1 hover:border-blue-200 hover:text-slate-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={onCancelRename}
                      className="rounded-full border border-transparent px-2 py-1 hover:border-slate-200 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {isMenuOpen && (
                  <div className="absolute right-3 top-10 z-10 w-32 rounded-xl border border-blue-100 bg-white p-2 text-left text-xs text-slate-600 shadow-lg">
                    <button
                      className="w-full rounded-md px-2 py-1 text-left hover:bg-blue-50"
                      onClick={() => onStartRename(session.id)}
                    >
                      Rename
                    </button>
                    <button
                      className="mt-1 w-full rounded-md px-2 py-1 text-left text-red-600 hover:bg-red-50"
                      onClick={() => onDeleteSession(session.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
