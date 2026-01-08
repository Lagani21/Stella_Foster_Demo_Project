// API route for handling agent logic (LLM)
// Receives transcript, returns agent response and optional takeaway

import { getAgentResponse } from '@/lib/agent';

export async function POST(req: Request) {
  const { transcript, context } = await req.json();
  try {
    const response = await getAgentResponse(transcript, context);
    return new Response(JSON.stringify({ response, takeaway: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
