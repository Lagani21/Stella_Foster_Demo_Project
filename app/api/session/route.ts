// API route for session persistence (save and list sessions)

export async function POST(req: Request) {
  // TODO: Save session to DB
  return new Response(null, { status: 201 });
}

export async function GET() {
  // TODO: List sessions from DB
  return new Response(JSON.stringify([]), {
    headers: { 'Content-Type': 'application/json' },
  });
}
