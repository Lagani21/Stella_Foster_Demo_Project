// API route for handling speech-to-text (STT) requests
// Receives audio, returns transcript

export async function POST(req: Request) {
  // Parse multipart form data
  const formData = await req.formData();
  const audio = formData.get('audio');
  if (!audio || !(audio instanceof Blob)) {
    return new Response(JSON.stringify({ error: 'No audio provided' }), { status: 400 });
  }

  // Prepare request to Deepgram STT
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing Deepgram API key' }), { status: 500 });
  }

  const audioBuffer = await audio.arrayBuffer();
  const deepgramRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': audio.type || 'audio/webm',
    },
    body: Buffer.from(audioBuffer),
  });

  if (!deepgramRes.ok) {
    const err = await deepgramRes.text();
    return new Response(
      JSON.stringify({ error: 'Deepgram STT failed', details: err }),
      { status: deepgramRes.status }
    );
  }

  const result = await deepgramRes.json();
  const transcript =
    result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  return new Response(JSON.stringify({ transcript }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
