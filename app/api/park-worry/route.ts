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
  const { worry, review_time, sessionId } = body;

  if (!worry || !review_time) {
    return new Response(JSON.stringify({ error: "Invalid payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = await prisma.parkedWorry.create({
    data: {
      worry,
      reviewTime: review_time,
      userId: session.user.id,
      sessionId: sessionId || null,
    },
  });

  return new Response(JSON.stringify(record), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
