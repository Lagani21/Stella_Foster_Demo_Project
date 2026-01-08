"use client";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import ChatControls from "./components/ChatControls";
import ChatMessages from "./components/ChatMessages";
import EmptyState from "./components/EmptyState";
import EventLog from "./components/EventLog";
import SessionSidebar from "./components/SessionSidebar";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Session = {
  id: string;
  title: string;
  messages: ChatMessage[];
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

function VoiceAgent() {
  const { data: authSession, status: authStatus } = useSession();
  const userName = authSession?.user?.name || authSession?.user?.email || null;
  const isAuthed = authStatus === "authenticated";

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
  const sessionsRef = useRef<Session[]>(sessions);
  const activeSessionIdRef = useRef(activeSessionId);

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeMessages = activeSession?.messages ?? [];
  const hasMessages = activeMessages.length > 0;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const updateActiveMessages = (
    updater: (messages: ChatMessage[]) => ChatMessage[]
  ) => {
    if (!activeSessionId) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? { ...session, messages: updater(session.messages) }
          : session
      )
    );
  };

  const resetSessionState = () => {
    pendingUserMessageIdRef.current = null;
    assistantMessageIdRef.current = null;
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

  const persistMessage = async (sessionId: string, role: string, text: string) => {
    if (!isAuthed) return;
    await fetch(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, text }),
    });
  };

  const createSessionRemote = async (title?: string) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to create session");
    }
    return (await res.json()) as Session;
  };

  const createSession = async () => {
    if (isAuthed) {
      const created = await createSessionRemote();
      setSessions((prev) => [...prev, created]);
      setActiveSessionId(created.id);
      resetSessionState();
      return;
    }
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
    resetSessionState();
  };

  const switchSession = (id: string) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    resetSessionState();
  };

  const deleteSession = async (id: string) => {
    if (sessions.length === 1) {
      setStatus("You need at least one session.");
      return;
    }
    if (isAuthed) {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    }
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((session) => session.id !== id);
      if (remaining[0]) {
        setActiveSessionId(remaining[0].id);
      }
    }
    resetSessionState();
  };

  const startRenameSession = (id: string) => {
    const current = sessions.find((session) => session.id === id);
    setEditingSessionId(id);
    setEditingTitle(current?.title || "");
  };

  const commitRenameSession = async (id: string) => {
    const nextName = editingTitle.trim();
    if (!nextName) return;
    if (isAuthed) {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextName }),
      });
    }
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, title: nextName } : session
      )
    );
    setEditingSessionId(null);
    setEditingTitle("");
  };

  useEffect(() => {
    const loadSessions = async () => {
      if (!isAuthed) return;
      const res = await fetch("/api/sessions");
      if (!res.ok) return;
      const data = (await res.json()) as Session[];
      if (data.length === 0) {
        const created = await createSessionRemote();
        setSessions([created]);
        setActiveSessionId(created.id);
        resetSessionState();
        return;
      }
      setSessions(data);
      setActiveSessionId(data[0].id);
      resetSessionState();
    };

    loadSessions();
  }, [isAuthed]);

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
        micTrack.enabled = false;
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
              const assistantId = assistantMessageIdRef.current;
              if (sessionId && assistantId) {
                const session = sessionsRef.current.find(
                  (item) => item.id === sessionId
                );
                const message = session?.messages.find((msg) => msg.id === assistantId);
                if (message?.text) {
                  persistMessage(sessionId, "assistant", message.text);
                }
              }
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
        const pendingId = pendingUserMessageIdRef.current;
        if (pendingId) {
          updateActiveMessages((prev) =>
            prev.map((msg) =>
              msg.id === pendingId ? { ...msg, text: finalTranscript } : msg
            )
          );
          pendingUserMessageIdRef.current = null;
        }
        const sessionId = activeSessionIdRef.current;
        if (sessionId && finalTranscript) {
          persistMessage(sessionId, "user", finalTranscript);
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

  const stopResponse = () => {
    dcRef.current?.send(JSON.stringify({ type: "response.cancel" }));
    audioRef.current?.pause();
    setIsResponding(false);
    assistantMessageIdRef.current = null;
    setStatus("Response stopped.");
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          editingSessionId={editingSessionId}
          editingTitle={editingTitle}
          menuSessionId={menuSessionId}
          authStatus={authStatus}
          userName={userName}
          onCreateSession={createSession}
          onSwitchSession={switchSession}
          onStartRename={(id) => {
            setMenuSessionId(null);
            startRenameSession(id);
          }}
          onCommitRename={commitRenameSession}
          onCancelRename={() => {
            setEditingSessionId(null);
            setEditingTitle("");
          }}
          onDeleteSession={(id) => {
            setMenuSessionId(null);
            deleteSession(id);
          }}
          onToggleMenu={(id) =>
            setMenuSessionId((prev) => (prev === id ? null : id))
          }
          onEditingTitleChange={setEditingTitle}
          onSignOut={() => signOut({ callbackUrl: "/login" })}
        />

        <main className="flex-1 md:pr-4">
          <div className="rounded-3xl border border-blue-100 bg-white/70 p-6 shadow-sm backdrop-blur">
            {!hasMessages && !isRecording ? (
              <EmptyState connected={connected} status={status} onStart={toggleMic} />
            ) : (
              <ChatControls
                connected={connected}
                isRecording={isRecording}
                isResponding={isResponding}
                audioPaused={audioPaused}
                status={status}
                onToggleMic={toggleMic}
                onToggleAudio={toggleAudioPlayback}
                onStopResponse={stopResponse}
              />
            )}

            {lastError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 whitespace-pre-wrap">
                {lastError}
              </div>
            )}
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

            <ChatMessages
              messages={activeMessages}
              isRecording={isRecording}
              liveTranscript={liveTranscript}
            />
          </div>

          <EventLog events={eventLog} />
        </main>
      </div>

      {isRecording && (
        <ChatControls
          connected={connected}
          isRecording={isRecording}
          isResponding={isResponding}
          audioPaused={audioPaused}
          status={null}
          isFloating
          showAudioToggle={false}
          onToggleMic={toggleMic}
          onToggleAudio={toggleAudioPlayback}
          onStopResponse={stopResponse}
        />
      )}
    </div>
  );
}

export default VoiceAgent;
