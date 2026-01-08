"use client";

type InsightItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
};

type InsightsPanelProps = {
  loading: boolean;
  insights: InsightItem[];
};

export default function InsightsPanel({ loading, insights }: InsightsPanelProps) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white/70 p-4 text-sm text-slate-700 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
        Memory & Insights
      </div>
      <div className="mt-3 space-y-3">
        {loading ? (
          <div className="text-xs text-slate-500">Loading insights...</div>
        ) : insights.length === 0 ? (
          <div className="text-xs text-slate-500">
            Insights will appear here after a few conversations.
          </div>
        ) : (
          insights.map((item) => (
            <div key={item.id} className="rounded-xl border border-blue-100 bg-white p-3">
              <div className="text-xs font-semibold text-slate-900">{item.title}</div>
              <div className="mt-1 text-xs text-slate-600">{item.detail}</div>
              {item.meta && (
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  {item.meta}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
