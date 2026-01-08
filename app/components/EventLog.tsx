"use client";

type EventLogProps = {
  events: string[];
};

export default function EventLog({ events }: EventLogProps) {
  return (
    <div className="mt-6 rounded-2xl border border-blue-100 bg-white/70 p-3 text-xs text-slate-600 shadow-sm">
      <div className="text-slate-400 mb-2 uppercase tracking-[0.2em]">Realtime events</div>
      <div className="max-h-40 overflow-auto whitespace-pre-wrap">
        {events.length ? events.join("\n") : "No events yet."}
      </div>
    </div>
  );
}
