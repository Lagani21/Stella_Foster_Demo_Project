"use client";

import { useEffect, useRef, useState } from "react";
import useFunctionCalls from "./useFunctionCalls";
import useTranscription from "./useTranscription";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type UseVoiceAgentOptions = {
  isAuthed: boolean;
  activeSessionId: string;
  updateActiveMessages: (updater: (messages: ChatMessage[]) => ChatMessage[]) => void;
  persistMessage: (sessionId: string, role: "user" | "assistant", text: string) => Promise<void>;
};

export default function useVoiceAgent({
  isAuthed,
  activeSessionId,
  updateActiveMessages,
  persistMessage,
}: UseVoiceAgentOptions) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [audioPaused, setAudioPaused] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const pendingUserMessageIdRef = useRef<string | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const assistantTextRef = useRef<string>("");
  const activeSessionIdRef = useRef(activeSessionId);
  const updateActiveMessagesRef = useRef(updateActiveMessages);
  const persistMessageRef = useRef(persistMessage);
  const isAuthedRef = useRef(isAuthed);
  const setupInProgressRef = useRef(false);
  const isRespondingRef = useRef(false);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    updateActiveMessagesRef.current = updateActiveMessages;
  }, [updateActiveMessages]);

  useEffect(() => {
    persistMessageRef.current = persistMessage;
  }, [persistMessage]);

  useEffect(() => {
    isAuthedRef.current = isAuthed;
  }, [isAuthed]);

  const sendFollowupResponse = () => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    if (isRespondingRef.current) return;
    dcRef.current.send(JSON.stringify({ type: "response.create" }));
    isRespondingRef.current = true;
  };

  const sendData = (payload: Record<string, any>) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    dcRef.current.send(JSON.stringify(payload));
  };

  const { handleEvent: handleFunctionEvent } = useFunctionCalls({
    sendData,
    activeSessionIdRef,
    sendFollowupResponse,
  });

  const {
    liveTranscript,
    getCurrentTranscript,
    clearTranscript,
    startTranscription,
    stopTranscription,
    resetTranscription,
  } = useTranscription({
    micStreamRef,
    activeSessionIdRef,
    pendingUserMessageIdRef,
    updateActiveMessagesRef,
    persistMessageRef,
    setStatus,
    setError,
    setLastError,
  });

  const reset = () => {
    pendingUserMessageIdRef.current = null;
    assistantMessageIdRef.current = null;
    assistantTextRef.current = "";
    clearTranscript();
    setStatus(null);
    setLastError(null);
    setError(null);
    setIsResponding(false);
    if (isRecording && micTrackRef.current) {
      micTrackRef.current.enabled = false;
      setIsRecording(false);
    }
    resetTranscription();
  };

  const buildRelatedContext = (items: any[]) => {
    const lines = items.slice(0, 3).map((item: any, index: number) => {
      const parts = [
        item.sessionSummary ? `Summary: ${item.sessionSummary}` : null,
        item.emotion ? `Emotion: ${item.emotion}` : null,
        item.keyStressor ? `Stressor: ${item.keyStressor}` : null,
        item.microStep ? `Micro step: ${item.microStep}` : null,
      ].filter(Boolean);
      return `${index + 1}) ${parts.join(" | ")}`;
    });
    return lines.length ? `Relevant past context:\n${lines.join("\n")}` : "";
  };

  const maybeInjectRelatedContext = async (query: string) => {
    if (!isAuthedRef.current || !query.trim()) return;
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    try {
      const res = await fetch(
        `/api/related-sessions?query=${encodeURIComponent(query)}&limit=3`
      );
      if (!res.ok) return;
      const data = await res.json();
      const context = buildRelatedContext(data);
      if (!context) return;
      dcRef.current?.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: context }],
          },
        })
      );
    } catch {
      // Ignore context failures
    }
  };


  useEffect(() => {
    if (!isAuthed) {
      setConnected(false);
      return;
    }
    if (setupInProgressRef.current || pcRef.current) {
      return;
    }
    let cancelled = false;
    setupInProgressRef.current = true;

    const setup = async () => {
      try {
        setError(null);

        const tokenResponse = await fetch("/api/realtime-token");
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(errorText || "Failed to mint realtime token");
        }
        const data = await tokenResponse.json();
        const ephemeralKey = data.value as string;
        if (!ephemeralKey) {
          throw new Error("Missing ephemeral key");
        }

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const audio = new Audio();
        audio.autoplay = true;
        audio.onplay = () => setAudioPaused(false);
        audio.onpause = () => setAudioPaused(true);
        audioRef.current = audio;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const micTrack = stream.getTracks()[0];
        micTrack.enabled = false;
        micTrackRef.current = micTrack;
        pc.addTrack(micTrack);

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onopen = () => setConnected(true);
        dc.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            const eventLabel =
              event.type === "error"
                ? `${event.type}: ${event.error?.message || "unknown error"}`
                : event.type;
            setEventLog((prev) => [
              ...prev.slice(-49),
              `${new Date().toLocaleTimeString()} ${eventLabel}`,
            ]);
            if (event.type === "response.created") {
              const newId = crypto.randomUUID();
              assistantMessageIdRef.current = newId;
              assistantTextRef.current = "";
              updateActiveMessagesRef.current((prev) => [
                ...prev,
                { id: newId, role: "assistant", text: "" },
              ]);
              setIsResponding(true);
              isRespondingRef.current = true;
            }
            if (event.type === "response.output_text.delta" && event.delta) {
              setStatus("Receiving response...");
              const id = assistantMessageIdRef.current;
              if (id) {
                assistantTextRef.current += event.delta;
                updateActiveMessagesRef.current((prev) =>
                  prev.map((msg) =>
                    msg.id === id ? { ...msg, text: msg.text + event.delta } : msg
                  )
                );
              }
            }
            if (event.type === "response.output_audio_transcript.delta" && event.delta) {
              setStatus("Receiving response...");
              const id = assistantMessageIdRef.current;
              if (id) {
                assistantTextRef.current += event.delta;
                updateActiveMessagesRef.current((prev) =>
                  prev.map((msg) =>
                    msg.id === id ? { ...msg, text: msg.text + event.delta } : msg
                  )
                );
              }
            }
            if (event.type === "conversation.item.input_audio_transcription.failed") {
              const message =
                event.error?.message || event.message || "Audio transcription failed.";
              setError(message);
              setLastError(JSON.stringify(event, null, 2));
            }
            if (event.type === "response.output_audio.delta") {
              setStatus("Receiving audio...");
              const audio = audioRef.current;
              if (audio) {
                audio.muted = false;
                audio.play().catch(() => {});
              }
            }
            if (event.type === "output_audio_buffer.started") {
              const audio = audioRef.current;
              if (audio) {
                audio.muted = false;
                audio.play().catch(() => {});
              }
            }
            if (event.type === "response.completed" || event.type === "response.done") {
              setStatus("Response complete.");
              setIsResponding(false);
              isRespondingRef.current = false;
              const sessionId = activeSessionIdRef.current;
              const assistantText = assistantTextRef.current.trim();
              if (sessionId && assistantText) {
                void persistMessageRef.current(sessionId, "assistant", assistantText);
              }
              assistantMessageIdRef.current = null;
              assistantTextRef.current = "";
            }
            if (event.type === "response.output_audio_transcript.done") {
              const sessionId = activeSessionIdRef.current;
              const transcript = event.transcript?.trim?.() || "";
              if (sessionId && transcript) {
                void persistMessageRef.current(sessionId, "assistant", transcript);
              }
            }
            if (event.type === "error") {
              const errorCode = event.error?.code;
              if (errorCode === "response_cancel_not_active") {
                setStatus("No active response to stop.");
                return;
              }
              setError(event.error?.message || "Realtime error");
              setLastError(JSON.stringify(event.error || event, null, 2));
              setIsResponding(false);
              isRespondingRef.current = false;
            }
            handleFunctionEvent(event);
          } catch {
            // Ignore non-JSON events
          }
        };
        dc.onerror = () => setError("Data channel error");
        dc.onclose = () => {
          setConnected(false);
          setStatus("Realtime session ended. Refresh to reconnect.");
          setIsResponding(false);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        });

        if (!sdpResponse.ok) {
          throw new Error("Failed to establish WebRTC session");
        }

        const answer = {
          type: "answer",
          sdp: await sdpResponse.text(),
        } as RTCSessionDescriptionInit;

        await pc.setRemoteDescription(answer);

        if (!cancelled) setConnected(true);
      } catch (err) {
        if (!cancelled) {
          setConnected(false);
          setError(err instanceof Error ? err.message : "WebRTC error");
        }
      } finally {
        if (!cancelled) {
          setupInProgressRef.current = false;
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      setupInProgressRef.current = false;
      dcRef.current?.close();
      pcRef.current?.close();
      resetTranscription();
      micTrackRef.current?.stop();
      pcRef.current = null;
      dcRef.current = null;
      audioRef.current = null;
      micTrackRef.current = null;
      micStreamRef.current = null;
    };
  }, [isAuthed]);

  const startMic = () => {
    if (!micTrackRef.current) return;
    micTrackRef.current.enabled = true;
    setIsRecording(true);
    setStatus(null);
    clearTranscript();
    recordingStartedAtRef.current = Date.now();
    startTranscription();
  };

  const stopMic = () => {
    if (!micTrackRef.current) return;
    micTrackRef.current.enabled = false;
    setIsRecording(false);
    const startedAt = recordingStartedAtRef.current;
    recordingStartedAtRef.current = null;
    const elapsedMs = startedAt ? Date.now() - startedAt : 0;
    if (elapsedMs < 200) {
      setStatus("Recording too short. Hold to speak a bit longer.");
      stopTranscription();
      return;
    }
    const userText = getCurrentTranscript() || "Processing transcript...";
    const userMessageId = crypto.randomUUID();
    pendingUserMessageIdRef.current = userMessageId;
    updateActiveMessagesRef.current((prev) => [
      ...prev,
      { id: userMessageId, role: "user", text: userText },
    ]);
    clearTranscript();
    stopTranscription();
    if (isResponding) {
      setStatus("Response already in progress...");
      return;
    }
    void (async () => {
      await maybeInjectRelatedContext(userText);
      if (!dcRef.current || dcRef.current.readyState !== "open") {
        setStatus("Realtime channel not ready. Try again.");
        return;
      }
      dcRef.current.send(JSON.stringify({ type: "response.create" }));
      setIsResponding(true);
      setStatus("Audio sent. Waiting for response...");
    })();
  };

  const toggleMic = () => {
    if (isRecording) {
      stopMic();
    } else {
      startMic();
    }
  };

  const toggleAudioPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const stopResponse = () => {
    if (!isResponding) {
      setStatus("No active response to stop.");
      return;
    }
    if (!dcRef.current || dcRef.current.readyState !== "open") {
      setStatus("Realtime channel not ready.");
      return;
    }
    dcRef.current.send(JSON.stringify({ type: "response.cancel" }));
    audioRef.current?.pause();
    setIsResponding(false);
    assistantMessageIdRef.current = null;
    assistantTextRef.current = "";
    setStatus("Response stopped.");
  };

  return {
    connected,
    isRecording,
    isResponding,
    audioPaused,
    status,
    error,
    lastError,
    liveTranscript,
    eventLog,
    toggleMic,
    toggleAudioPlayback,
    stopResponse,
    reset,
  };
}
