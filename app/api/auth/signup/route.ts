import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email and password are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return new Response(JSON.stringify({ error: "Email already in use." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
    },
  });

  return new Response(JSON.stringify({ id: user.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
