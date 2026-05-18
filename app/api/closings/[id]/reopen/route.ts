import { requireOwner } from "@/lib/auth-session";
import { DAILY_CLOSING_STATUS, getDailyClosing } from "@/lib/daily-closing";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

function serializeClosing(closing: Awaited<ReturnType<typeof getDailyClosing>>) {
  if (!closing) {
    return null;
  }

  return {
    id: closing.id,
    status: closing.status,
    reopened_at: closing.reopenedAt?.toISOString() ?? null,
    reopen_reason: closing.reopenReason,
  };
}

export async function POST(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const reopenReason = String(
    body.reopen_reason ?? body.reopenReason ?? "",
  ).trim();

  if (reopenReason.length < 5) {
    return NextResponse.json(
      { message: "Alasan reopen wajib diisi minimal 5 karakter." },
      { status: 422 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.dailyClosing.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            status: true,
            closingDate: true,
          },
        });

        if (!existing) {
          throw new Error("DAILY_CLOSING_NOT_FOUND");
        }

        if (existing.status !== DAILY_CLOSING_STATUS.CLOSED) {
          throw new Error("DAILY_CLOSING_NOT_CLOSED");
        }

        const reopenedAt = new Date();

        await tx.dailyClosing.update({
          where: {
            id,
          },
          data: {
            status: DAILY_CLOSING_STATUS.REOPENED,
            reopenedAt,
            reopenedById: auth.session.sub,
            reopenReason,
          },
        });

        await tx.dailyClosingLog.create({
          data: {
            dailyClosingId: id,
            action: "REOPEN",
            reason: reopenReason,
            userId: auth.session.sub,
          },
        });

        return getDailyClosing(tx, existing.closingDate);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/dashboard");

    return NextResponse.json({
      data: serializeClosing(result),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reopen gagal.";

    if (message === "DAILY_CLOSING_NOT_FOUND") {
      return NextResponse.json(
        { message: "Closing tidak ditemukan." },
        { status: 404 },
      );
    }

    if (message === "DAILY_CLOSING_NOT_CLOSED") {
      return NextResponse.json(
        { message: "Hanya closing berstatus CLOSED yang bisa di-reopen." },
        { status: 422 },
      );
    }

    console.error(error);

    return NextResponse.json(
      { message: "Reopen gagal." },
      { status: 500 },
    );
  }
}
