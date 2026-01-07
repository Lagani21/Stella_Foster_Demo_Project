// API route for handling text-to-speech (TTS) requests
// Receives text, returns audio

export async function POST(req: Request) {
  // TODO: Implement TTS integration (OpenAI/ElevenLabs)
  return new Response(null, {
    status: 501,
    statusText: 'Not Implemented',
  });
}
