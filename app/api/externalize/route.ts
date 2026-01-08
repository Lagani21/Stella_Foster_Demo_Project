import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { summary, structured_view, sessionId } = body;

  if (!summary || !structured_view) {
    return new Response(JSON.stringify({ error: "Invalid payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = await prisma.externalizedThought.create({
    data: {
      summary,
      structured: structured_view,
      userId: session.user.id,
      sessionId: sessionId || null,
    },
  });

  return new Response(JSON.stringify(record), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
