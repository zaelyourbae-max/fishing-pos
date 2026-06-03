import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth-session";

export async function GET(request: Request) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  const groups = await prisma.expense.groupBy({
    by: ["category"],
    orderBy: { _count: { category: "desc" } },
    take: 50,
  });

  return NextResponse.json({ categories: groups.map((g) => g.category) });
}
