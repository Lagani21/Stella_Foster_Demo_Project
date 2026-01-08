"use client";

import { useRef } from "react";
import type { MutableRefObject } from "react";

type SendData = (payload: Record<string, any>) => void;

type UseFunctionCallsOptions = {
  sendData: SendData;
  activeSessionIdRef: MutableRefObject<string>;
  sendFollowupResponse: () => void;
};

export default function useFunctionCalls({
  sendData,
  activeSessionIdRef,
  sendFollowupResponse,
}: UseFunctionCallsOptions) {
  const functionArgsRef = useRef<Record<string, { name: string; args: string }>>({});

  const sendFunctionResult = (callId: string | null, result: any) => {
    const item: Record<string, any> = {
      type: "function_call_output",
      output: JSON.stringify(result ?? {}),
    };
    if (callId) item.call_id = callId;
    sendData({ type: "conversation.item.create", item });
  };

  const handleFunctionCall = (name: string, args: string | null, callId: string | null) => {
    if (name === "log_emotional_state") {
      void (async () => {
        try {
          const payload = args ? JSON.parse(args) : null;
          if (payload) {
            await fetch("/api/emotions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                emotion: payload.emotion,
                intensity: payload.intensity,
                primary_triggers: payload.primary_triggers,
                confidence: payload.confidence,
                sessionId: activeSessionIdRef.current,
              }),
            });
          }
        } catch {
          // Ignore storage failures
        } finally {
          sendFunctionResult(callId, { status: "ok" });
          sendFollowupResponse();
        }
      })();
    }
    if (name === "externalize_thoughts") {
      void (async () => {
        try {
          const payload = args ? JSON.parse(args) : null;
          if (payload) {
            await fetch("/api/externalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                summary: payload.summary,
                structured_view: payload.structured_view,
                sessionId: activeSessionIdRef.current,
              }),
            });
          }
        } catch {
          // Ignore storage failures
        } finally {
          sendFunctionResult(callId, { status: "ok" });
          sendFollowupResponse();
        }
      })();
    }
    if (name === "save_session") {
      void (async () => {
        try {
          const payload = args ? JSON.parse(args) : null;
          if (payload) {
            await fetch("/api/save-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_summary: payload.session_summary,
                emotion: payload.emotion,
                intensity: payload.intensity,
                key_stressor: payload.key_stressor,
                micro_step: payload.micro_step,
                sessionId: activeSessionIdRef.current,
              }),
            });
          }
        } catch {
          // Ignore storage failures
        } finally {
          sendFunctionResult(callId, { status: "ok" });
          sendFollowupResponse();
        }
      })();
    }
    if (name === "retrieve_related_sessions") {
      void (async () => {
        try {
          const payload = args ? JSON.parse(args) : null;
          if (payload?.query) {
            const res = await fetch(
              `/api/related-sessions?query=${encodeURIComponent(
                payload.query
              )}&limit=${encodeURIComponent(payload.limit ?? 3)}`
            );
            const data = res.ok ? await res.json() : [];
            sendFunctionResult(callId, { sessions: data });
            sendFollowupResponse();
          } else {
            sendFunctionResult(callId, { sessions: [] });
            sendFollowupResponse();
          }
        } catch {
          sendFunctionResult(callId, { sessions: [] });
          sendFollowupResponse();
        }
      })();
    }
    if (name === "park_worry_for_later") {
      void (async () => {
        try {
          const payload = args ? JSON.parse(args) : null;
          if (payload) {
            await fetch("/api/park-worry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                worry: payload.worry,
                review_time: payload.review_time,
                sessionId: activeSessionIdRef.current,
              }),
            });
          }
        } catch {
          // Ignore storage failures
        } finally {
          sendFunctionResult(callId, { status: "ok" });
          sendFollowupResponse();
        }
      })();
    }
  };

  const handleEvent = (event: any) => {
    if (event.type === "response.output_item.added") {
      const item = event.item || event.output_item || null;
      if (item?.type === "function_call") {
        const name = item.name;
        const args = item.arguments || "";
        const callId = item.call_id || item.id || null;
        if (name) handleFunctionCall(name, args, callId);
      }
    }
    if (event.type === "response.function_call") {
      handleFunctionCall(event.name, event.arguments || null, event.call_id || null);
    }
    if (event.type === "response.function_call_arguments.delta") {
      const callId = event.call_id || event.id || event.item_id;
      if (callId && event.name && event.delta) {
        const existing = functionArgsRef.current[callId] || {
          name: event.name,
          args: "",
        };
        existing.args += event.delta;
        functionArgsRef.current[callId] = existing;
      }
    }
    if (event.type === "response.function_call_arguments.done") {
      const callId = event.call_id || event.id || event.item_id;
      const existing = callId ? functionArgsRef.current[callId] : null;
      const name = event.name || existing?.name;
      const args = existing?.args || event.arguments || "";
      if (callId) delete functionArgsRef.current[callId];
      if (name) handleFunctionCall(name, args, callId || null);
    }
  };

  return { handleEvent };
}
