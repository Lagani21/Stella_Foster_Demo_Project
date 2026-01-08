import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") || undefined;

  const [emotions, externals, saved, worries] = await Promise.all([
    prisma.emotionalLog.findMany({
      where: { userId: session.user.id, ...(sessionId ? { sessionId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
    prisma.externalizedThought.findMany({
      where: { userId: session.user.id, ...(sessionId ? { sessionId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
    prisma.savedSession.findMany({
      where: { userId: session.user.id, ...(sessionId ? { sessionId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
    prisma.parkedWorry.findMany({
      where: { userId: session.user.id, ...(sessionId ? { sessionId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
  ]);

  const insights = [
    ...emotions.map((item) => ({
      id: item.id,
      title: `Emotion: ${item.emotion}`,
      detail: `Intensity ${item.intensity}, triggers: ${JSON.stringify(item.triggers)}`,
      meta: "Emotional State",
    })),
    ...externals.map((item) => ({
      id: item.id,
      title: item.summary,
      detail: JSON.stringify(item.structured),
      meta: "Externalized Thoughts",
    })),
    ...saved.map((item) => ({
      id: item.id,
      title: item.sessionSummary,
      detail: `Stressor: ${item.keyStressor} • Micro-step: ${item.microStep || "N/A"}`,
      meta: "Saved Session",
    })),
    ...worries.map((item) => ({
      id: item.id,
      title: `Parked worry: ${item.worry}`,
      detail: `Review: ${item.reviewTime}`,
      meta: "Parked Worry",
    })),
  ];

  return new Response(JSON.stringify(insights), {
    headers: { "Content-Type": "application/json" },
  });
}
