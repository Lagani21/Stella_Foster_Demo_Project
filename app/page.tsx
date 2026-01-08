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

type Session = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

function VoiceAgent() {
  const initialSessionIdRef = useRef<string>(crypto.randomUUID());
  const [sessions, setSessions] = useState<Session[]>(() => [
    {
      id: initialSessionIdRef.current,
      title: "Session 1",
      messages: [],
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState(
    initialSessionIdRef.current
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
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
  const liveFinalRef = useRef<string>("");

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeMessages = activeSession?.messages ?? [];
  const hasMessages = activeMessages.length > 0;

  const updateActiveMessages = (
    updater: (messages: ChatMessage[]) => ChatMessage[]
  ) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? { ...session, messages: updater(session.messages) }
          : session
      )
    );
  };

  const createSession = () => {
    const newId = crypto.randomUUID();
    setSessions((prev) => [
      ...prev,
      {
        id: newId,
        title: `Session ${prev.length + 1}`,
        messages: [],
      },
    ]);
    setActiveSessionId(newId);
    pendingUserMessageIdRef.current = null;
    assistantMessageIdRef.current = null;
    setLiveTranscript("");
    setTranscript("");
    setAgentResponse("");
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

  const deleteSession = (id: string) => {
    if (sessions.length === 1) {
      setStatus("You need at least one session.");
      return;
    }
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((session) => session.id !== id);
      if (remaining[0]) {
        switchSession(remaining[0].id);
      }
    }
  };

  const startRenameSession = (id: string) => {
    const current = sessions.find((session) => session.id === id);
    setEditingSessionId(id);
    setEditingTitle(current?.title || "");
  };

  const commitRenameSession = (id: string) => {
    const nextName = editingTitle.trim();
    if (!nextName) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, title: nextName } : session
      )
    );
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const switchSession = (id: string) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    pendingUserMessageIdRef.current = null;
    assistantMessageIdRef.current = null;
    setLiveTranscript("");
    setTranscript("");
    setAgentResponse("");
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

  // Connect to OpenAI Realtime via WebRTC using an ephemeral key
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        setError(null);

        const tokenResponse = await fetch("/api/realtime-token");
        if (!tokenResponse.ok) {
          throw new Error("Failed to mint realtime token");
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
        micTrack.enabled = false; // push-to-talk: enable only while pressed
        micTrackRef.current = micTrack;
        pc.addTrack(micTrack);

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
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
              updateActiveMessages((prev) => [
                ...prev,
                { id: newId, role: "assistant", text: "" },
              ]);
              setIsResponding(true);
            }
            if (event.type === "response.output_text.delta" && event.delta) {
              setAgentResponse((prev) => prev + event.delta);
              setStatus("Receiving response...");
              const id = assistantMessageIdRef.current;
              if (id) {
                updateActiveMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === id ? { ...msg, text: msg.text + event.delta } : msg
                  )
                );
              }
            }
            if (event.type === "input_audio_transcription.delta" && event.delta) {
              setTranscript((prev) => prev + event.delta);
            }
            if (event.type === "input_audio_transcription.completed" && event.text) {
              setTranscript(event.text);
            }
            if (event.type === "conversation.item.input_audio_transcription.completed" && event.text) {
              setTranscript(event.text);
            }
            if (event.type === "conversation.item.input_audio_transcription.failed") {
              const message =
                event.error?.message ||
                event.message ||
                "Audio transcription failed.";
              setError(message);
              setLastError(JSON.stringify(event, null, 2));
            }
            if (event.type === "response.output_audio.delta") {
              setStatus("Receiving audio...");
            }
            if (event.type === "response.completed") {
              setStatus("Response complete.");
              setIsResponding(false);
              assistantMessageIdRef.current = null;
            }
            if (event.type === "error") {
              setError(event.error?.message || "Realtime error");
              setLastError(JSON.stringify(event.error || event, null, 2));
              setIsResponding(false);
            }
          } catch {
            // Ignore non-JSON events
          }
        };
        dc.onopen = () => {
          setConnected(true);
        };
        dc.onerror = () => setError("Data channel error");

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
      }
    };

    setup();

    return () => {
      cancelled = true;
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
  }, []);

  const ensureSpeechRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
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
    const options = MediaRecorder.isTypeSupported("audio/webm")
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
      setStatus("Transcribing...");
      try {
        const formData = new FormData();
        formData.append("audio", blob, "audio.webm");
        const res = await fetch("/api/stt", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          const details = data.details ? `\n${data.details}` : "";
          throw new Error(`${data.error || "Transcription failed"}${details}`);
        }
        const finalTranscript = data.transcript || "";
        setTranscript(finalTranscript);
        const pendingId = pendingUserMessageIdRef.current;
        if (pendingId) {
          updateActiveMessages((prev) =>
            prev.map((msg) =>
              msg.id === pendingId ? { ...msg, text: finalTranscript } : msg
            )
          );
          pendingUserMessageIdRef.current = null;
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
    setTranscript("");
    setAgentResponse("");
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
    const userText = liveFinalRef.current.trim() || liveTranscript.trim() || "Processing transcript...";
    const userMessageId = crypto.randomUUID();
    pendingUserMessageIdRef.current = userMessageId;
    updateActiveMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", text: userText },
    ]);
    setLiveTranscript("");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (!isResponding) {
      dcRef.current?.send(JSON.stringify({ type: "response.create" }));
      setIsResponding(true);
      setStatus("Audio sent. Waiting for response...");
    } else {
      setStatus("Response already in progress...");
    }
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

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background:
          "linear-gradient(135deg, #E9EEF7 0%, #F6F9FF 45%, #E9EEF7 100%)",
        fontFamily: '"Space Grotesk", "Avenir Next", "Helvetica Neue", sans-serif',
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row">
        <aside className="w-full md:w-56 md:ml-[-24px]">
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Sessions
              </div>
              <button
                className="rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-900"
                style={{ backgroundColor: "#92B5ED" }}
                onClick={createSession}
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
                        onClick={() => switchSession(session.id)}
                        className="w-full text-left"
                      >
                        {isEditing ? (
                          <input
                            className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-sm text-slate-900"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRenameSession(session.id);
                              if (e.key === "Escape") {
                                setEditingSessionId(null);
                                setEditingTitle("");
                              }
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
                        onClick={() =>
                          setMenuSessionId((prev) =>
                            prev === session.id ? null : session.id
                          )
                        }
                        className="rounded-full px-2 py-1 text-slate-500 hover:text-slate-700"
                        aria-label="Session options"
                      >
                        &#8942;
                      </button>
                    </div>
                    {isEditing && (
                      <div className="mt-2 flex gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                        <button
                          onClick={() => commitRenameSession(session.id)}
                          className="rounded-full border border-transparent px-2 py-1 hover:border-blue-200 hover:text-slate-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingSessionId(null);
                            setEditingTitle("");
                          }}
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
                          onClick={() => {
                            setMenuSessionId(null);
                            startRenameSession(session.id);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className="mt-1 w-full rounded-md px-2 py-1 text-left text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setMenuSessionId(null);
                            deleteSession(session.id);
                          }}
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

        <main className="flex-1 md:pr-4">
          <div className="rounded-3xl border border-blue-100 bg-white/70 p-6 shadow-sm backdrop-blur">
            {!hasMessages && !isRecording ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <button
                  className="rounded-full px-8 py-4 text-lg font-semibold text-white shadow-lg"
                  style={{ backgroundColor: "#92B5ED" }}
                  disabled={!connected}
                  onClick={toggleMic}
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
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow"
                    style={{ backgroundColor: isRecording ? "#1E3A8A" : "#92B5ED" }}
                    disabled={!connected}
                    onClick={toggleMic}
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
                  <button
                    className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50"
                    style={{ backgroundColor: "#1F4D99" }}
                    disabled={!connected || !audioRef.current}
                    onClick={toggleAudioPlayback}
                  >
                    {audioPaused ? "Resume Response Audio" : "Pause Response Audio"}
                  </button>
                </div>
                {status && <div className="text-xs text-slate-500">{status}</div>}
              </div>
            )}

            {lastError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 whitespace-pre-wrap">
                {lastError}
              </div>
            )}
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

            <div className="mt-6 space-y-4">
              {activeMessages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm text-slate-500">
                  Start recording to add your first message.
                </div>
              )}
              {activeMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-3xl px-4 py-3 shadow ${
                      message.role === "user"
                        ? "text-slate-900"
                        : "border border-blue-100 bg-white text-slate-900"
                    }`}
                    style={
                      message.role === "user"
                        ? { backgroundColor: "#92B5ED" }
                        : undefined
                    }
                  >
                    <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                      {message.role === "user" ? "You" : "Voice Agent"}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm">{message.text}</div>
                  </div>
                </div>
              ))}
              {isRecording && (
                <div className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-3xl px-4 py-3 text-sm text-slate-900 shadow"
                    style={{ backgroundColor: "#DCE7FB" }}
                  >
                    <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                      You (live)
                    </div>
                    <div className="mt-2 whitespace-pre-wrap">
                      {liveTranscript || "Listening..."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-white/70 p-3 text-xs text-slate-600 shadow-sm">
            <div className="text-slate-400 mb-2 uppercase tracking-[0.2em]">Realtime events</div>
            <div className="max-h-40 overflow-auto whitespace-pre-wrap">
              {eventLog.length ? eventLog.join("\n") : "No events yet."}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default VoiceAgent;
