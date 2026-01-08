import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { title } = await req.json();
  const existing = await prisma.conversationSession.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });

  if (!existing) {
    return new Response(JSON.stringify({ error: "Session not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updated = await prisma.conversationSession.update({
    where: { id: params.id },
    data: { title: title?.trim() || "Untitled" },
  });

  return new Response(JSON.stringify(updated), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await prisma.conversationSession.deleteMany({
    where: { id: params.id, userId: session.user.id },
  });

  return new Response(null, { status: 204 });
}
