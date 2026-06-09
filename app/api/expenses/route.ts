import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth-session";

function generateExpenseNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `EXP-${y}${m}${d}-${rand}`;
}

export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { category, amount, description, date } = body;

  if (!category || typeof category !== "string" || category.trim() === "") {
    return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Nominal harus lebih dari 0" }, { status: 400 });
  }
  // Rupiah selalu bilangan bulat; tolak nominal tak masuk akal (salah ketik).
  const amountValue = Math.round(amount);
  if (amountValue <= 0 || amountValue > 1_000_000_000_000) {
    return NextResponse.json({ error: "Nominal tidak valid" }, { status: 400 });
  }

  const parsedDate = date ? new Date(`${date}T00:00:00`) : new Date();
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      expenseNumber: generateExpenseNumber(),
      category: category.trim(),
      amount: amountValue,
      description: description?.trim() || null,
      date: parsedDate,
      createdById: auth.session.sub,
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });

  await prisma.expense.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
