"use client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ChatMessagesProps = {
  messages: ChatMessage[];
  isRecording: boolean;
  liveTranscript: string;
};

export default function ChatMessages({
  messages,
  isRecording,
  liveTranscript,
}: ChatMessagesProps) {
  return (
    <div className="mt-6 space-y-4">
      {messages.length === 0 && (
        <div className="rounded-6xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm text-slate-500">
          Start recording to add your first message.
        </div>
      )}
      {messages.map((message) => (
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
            style={message.role === "user" ? { backgroundColor: "#92B5ED" } : undefined}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
              {message.role === "user" ? "You" : "Shanti"}
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
  );
}
