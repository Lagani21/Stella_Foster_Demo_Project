import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { role, text } = await req.json();
  if (!role || !text) {
    return new Response(JSON.stringify({ error: "Role and text are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionRow = await prisma.conversationSession.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!sessionRow) {
    return new Response(JSON.stringify({ error: "Session not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = await prisma.message.create({
    data: {
      role,
      text,
      sessionId: id,
    },
  });

  return new Response(JSON.stringify(message), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
