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
  const {
    session_summary,
    emotion,
    intensity,
    key_stressor,
    micro_step,
    sessionId,
  } = body;

  if (!session_summary || !emotion || typeof intensity !== "number" || !key_stressor) {
    return new Response(JSON.stringify({ error: "Invalid payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = await prisma.savedSession.create({
    data: {
      sessionSummary: session_summary,
      emotion,
      intensity,
      keyStressor: key_stressor,
      microStep: micro_step ?? null,
      userId: session.user.id,
      sessionId: sessionId || null,
    },
  });

  return new Response(JSON.stringify(record), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
