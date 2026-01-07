// API route for handling speech-to-text (STT) requests
// Receives audio, returns transcript

export async function POST(req: Request) {
  // TODO: Implement STT integration (OpenAI/Deepgram)
  return new Response(JSON.stringify({ transcript: "" }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
