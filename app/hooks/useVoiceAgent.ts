"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

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
  const [liveTranscript, setLiveTranscript] = useState("");
  const [audioPaused, setAudioPaused] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const pendingUserMessageIdRef = useRef<string | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const assistantTextRef = useRef<string>("");
  const liveFinalRef = useRef<string>("");
  const activeSessionIdRef = useRef(activeSessionId);
  const updateActiveMessagesRef = useRef(updateActiveMessages);
  const persistMessageRef = useRef(persistMessage);
  const isAuthedRef = useRef(isAuthed);
  const setupInProgressRef = useRef(false);

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

  const reset = () => {
    pendingUserMessageIdRef.current = null;
    assistantMessageIdRef.current = null;
    assistantTextRef.current = "";
    liveFinalRef.current = "";
    setLiveTranscript("");
    setStatus(null);
    setLastError(null);
    setError(null);
    setIsResponding(false);
    if (isRecording && micTrackRef.current) {
      micTrackRef.current.enabled = false;
      setIsRecording(false);
    }
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
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
            }
            if (event.type === "response.completed") {
              setStatus("Response complete.");
              setIsResponding(false);
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
            }
            if (
              event.type === "response.function_call" &&
              event.name === "log_emotional_state"
            ) {
              void (async () => {
                try {
                  const payload = event.arguments
                    ? JSON.parse(event.arguments)
                    : null;
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
                  dc.send(
                    JSON.stringify({
                      type: "response.function_result",
                      name: "log_emotional_state",
                      result: { status: "ok" },
                    })
                  );
                }
              })();
            }
            if (
              event.type === "response.function_call" &&
              event.name === "externalize_thoughts"
            ) {
              void (async () => {
                try {
                  const payload = event.arguments
                    ? JSON.parse(event.arguments)
                    : null;
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
                  dc.send(
                    JSON.stringify({
                      type: "response.function_result",
                      name: "externalize_thoughts",
                      result: { status: "ok" },
                    })
                  );
                }
              })();
            }
            if (event.type === "response.function_call" && event.name === "save_session") {
              void (async () => {
                try {
                  const payload = event.arguments
                    ? JSON.parse(event.arguments)
                    : null;
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
                  dc.send(
                    JSON.stringify({
                      type: "response.function_result",
                      name: "save_session",
                      result: { status: "ok" },
                    })
                  );
                }
              })();
            }
            if (
              event.type === "response.function_call" &&
              event.name === "retrieve_related_sessions"
            ) {
              void (async () => {
                try {
                  const payload = event.arguments
                    ? JSON.parse(event.arguments)
                    : null;
                  if (payload?.query) {
                    const res = await fetch(
                      `/api/related-sessions?query=${encodeURIComponent(
                        payload.query
                      )}&limit=${encodeURIComponent(payload.limit ?? 3)}`
                    );
                    const data = res.ok ? await res.json() : [];
                    dc.send(
                      JSON.stringify({
                        type: "response.function_result",
                        name: "retrieve_related_sessions",
                        result: { sessions: data },
                      })
                    );
                  } else {
                    dc.send(
                      JSON.stringify({
                        type: "response.function_result",
                        name: "retrieve_related_sessions",
                        result: { sessions: [] },
                      })
                    );
                  }
                } catch {
                  dc.send(
                    JSON.stringify({
                      type: "response.function_result",
                      name: "retrieve_related_sessions",
                      result: { sessions: [] },
                    })
                  );
                }
              })();
            }
            if (
              event.type === "response.function_call" &&
              event.name === "park_worry_for_later"
            ) {
              void (async () => {
                try {
                  const payload = event.arguments
                    ? JSON.parse(event.arguments)
                    : null;
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
                  dc.send(
                    JSON.stringify({
                      type: "response.function_result",
                      name: "park_worry_for_later",
                      result: { status: "ok" },
                    })
                  );
                }
              })();
            }
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
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      micTrackRef.current?.stop();
      pcRef.current = null;
      dcRef.current = null;
      audioRef.current = null;
      micTrackRef.current = null;
      micStreamRef.current = null;
      mediaRecorderRef.current = null;
      recognitionRef.current = null;
    };
  }, [isAuthed]);

  const ensureSpeechRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return null;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      let finalText = liveFinalRef.current;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += (finalText ? " " : "") + result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      liveFinalRef.current = finalText;
      setLiveTranscript(`${finalText}${interim ? ` ${interim}` : ""}`.trim());
    };
    recognitionRef.current = recognition;
    return recognition;
  };

  const startTranscriptionCapture = () => {
    const stream = micStreamRef.current;
    if (!stream) {
      setStatus("Microphone stream not ready.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setStatus("MediaRecorder not supported in this browser.");
      return;
    }
    const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? { mimeType: "audio/webm;codecs=opus" }
      : MediaRecorder.isTypeSupported("audio/webm")
      ? { mimeType: "audio/webm" }
      : undefined;
    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;
    mediaChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) mediaChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(mediaChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      mediaRecorderRef.current = null;
      if (!blob.size) {
        setStatus("No audio captured.");
        return;
      }
      if (blob.size < 8000) {
        setStatus("Audio too short for transcription.");
        return;
      }
      setStatus("Transcribing...");
      try {
        const formData = new FormData();
        const filename = recorder.mimeType?.includes("opus")
          ? "audio.webm"
          : "audio.webm";
        formData.append("audio", blob, filename);
        const res = await fetch("/api/stt", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          const details = data.details ? `\n${data.details}` : "";
          throw new Error(`${data.error || "Transcription failed"}${details}`);
        }
        const finalTranscript = data.transcript || "";
        const pendingId = pendingUserMessageIdRef.current;
        if (pendingId) {
          updateActiveMessagesRef.current((prev) =>
            prev.map((msg) =>
              msg.id === pendingId ? { ...msg, text: finalTranscript } : msg
            )
          );
          pendingUserMessageIdRef.current = null;
        }
        const sessionId = activeSessionIdRef.current;
        if (sessionId && finalTranscript) {
          void persistMessageRef.current(sessionId, "user", finalTranscript);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transcription error";
        setError(message);
        setLastError(message);
      }
    };

    recorder.start();
  };

  const startMic = () => {
    if (!micTrackRef.current) return;
    micTrackRef.current.enabled = true;
    setIsRecording(true);
    setStatus(null);
    setLiveTranscript("");
    liveFinalRef.current = "";
    recordingStartedAtRef.current = Date.now();
    const recognition = ensureSpeechRecognition();
    if (recognition) recognition.start();
    startTranscriptionCapture();
  };

  const stopMic = () => {
    if (!micTrackRef.current) return;
    micTrackRef.current.enabled = false;
    setIsRecording(false);
    recognitionRef.current?.stop();
    const startedAt = recordingStartedAtRef.current;
    recordingStartedAtRef.current = null;
    const elapsedMs = startedAt ? Date.now() - startedAt : 0;
    if (elapsedMs < 200) {
      setStatus("Recording too short. Hold to speak a bit longer.");
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      return;
    }
    const userText =
      liveFinalRef.current.trim() ||
      liveTranscript.trim() ||
      "Processing transcript...";
    const userMessageId = crypto.randomUUID();
    pendingUserMessageIdRef.current = userMessageId;
    updateActiveMessagesRef.current((prev) => [
      ...prev,
      { id: userMessageId, role: "user", text: userText },
    ]);
    setLiveTranscript("");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
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
