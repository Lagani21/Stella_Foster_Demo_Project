"use client";

import { useEffect, useState } from "react";

type InsightItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
};

type UseInsightsOptions = {
  isAuthed: boolean;
  sessionId: string;
};

export default function useInsights({ isAuthed, sessionId }: UseInsightsOptions) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightItem[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!isAuthed) {
        setInsights([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/insights?sessionId=${sessionId}`);
        if (!res.ok) {
          setInsights([]);
          return;
        }
        const data = await res.json();
        setInsights(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isAuthed, sessionId]);

  return { loading, insights };
}
