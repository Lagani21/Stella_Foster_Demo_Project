"use client";

import { useRef, useState } from "react";
import type { MutableRefObject } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type UpdateActiveMessages = (
  updater: (messages: ChatMessage[]) => ChatMessage[]
) => void;

type PersistMessage = (
  sessionId: string,
  role: "user" | "assistant",
  text: string
) => Promise<void>;

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

type UseTranscriptionOptions = {
  micStreamRef: MutableRefObject<MediaStream | null>;
  activeSessionIdRef: MutableRefObject<string>;
  pendingUserMessageIdRef: MutableRefObject<string | null>;
  updateActiveMessagesRef: MutableRefObject<UpdateActiveMessages>;
  persistMessageRef: MutableRefObject<PersistMessage>;
  setStatus: (value: string | null) => void;
  setError: (value: string | null) => void;
  setLastError: (value: string | null) => void;
};

export default function useTranscription({
  micStreamRef,
  activeSessionIdRef,
  pendingUserMessageIdRef,
  updateActiveMessagesRef,
  persistMessageRef,
  setStatus,
  setError,
  setLastError,
}: UseTranscriptionOptions) {
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const liveFinalRef = useRef<string>("");

  const getCurrentTranscript = () =>
    liveFinalRef.current.trim() || liveTranscript.trim();

  const clearTranscript = () => {
    liveFinalRef.current = "";
    setLiveTranscript("");
  };

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

  const startRecorder = () => {
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

  const stopRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const startTranscription = () => {
    clearTranscript();
    const recognition = ensureSpeechRecognition();
    if (recognition) recognition.start();
    startRecorder();
  };

  const stopTranscription = () => {
    recognitionRef.current?.stop();
    stopRecorder();
  };

  const resetTranscription = () => {
    clearTranscript();
    recognitionRef.current?.stop();
    stopRecorder();
  };

  return {
    liveTranscript,
    getCurrentTranscript,
    clearTranscript,
    startTranscription,
    stopTranscription,
    resetTranscription,
  };
}
