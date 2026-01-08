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
  const { emotion, intensity, primary_triggers, confidence, sessionId } = body;

  if (!emotion || typeof intensity !== "number" || !confidence) {
    return new Response(JSON.stringify({ error: "Invalid payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = await prisma.emotionalLog.create({
    data: {
      emotion,
      intensity,
      confidence,
      triggers: primary_triggers ?? [],
      userId: session.user.id,
      sessionId: sessionId || null,
    },
  });

  return new Response(JSON.stringify(record), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
