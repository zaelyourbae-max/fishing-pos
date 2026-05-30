import { requireCashier, requireOwner } from "@/lib/auth-session";
import {
  buildDailyClosingSnapshot,
  closingDateFromInput,
  DAILY_CLOSING_STATUS,
  dateInputValue,
  getDailyClosing,
} from "@/lib/daily-closing";
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
    closing_date: dateInputValue(closing.closingDate),
    status: closing.status,
    expected_cash: closing.expectedCash,
    actual_cash: closing.actualCash,
    difference: closing.difference,
    gross_omzet: closing.grossOmzet,
    net_omzet: closing.netOmzet,
    transaction_count: closing.transactionCount,
    payment_summary: closing.paymentSummary,
    return_value: closing.returnValue,
    notes: closing.notes,
    closed_at: closing.closedAt?.toISOString() ?? null,
    closed_by: closing.closedBy
      ? {
          id: closing.closedBy.id,
          name: closing.closedBy.name,
          email: closing.closedBy.email,
        }
      : null,
    reopened_at: closing.reopenedAt?.toISOString() ?? null,
    reopened_by: closing.reopenedBy
      ? {
          id: closing.reopenedBy.id,
          name: closing.reopenedBy.name,
          email: closing.reopenedBy.email,
        }
      : null,
    reopen_reason: closing.reopenReason,
    logs: closing.logs.map((log) => ({
      id: log.id,
      action: log.action,
      reason: log.reason,
      note: log.note,
      created_at: log.createdAt.toISOString(),
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email,
          }
        : null,
    })),
  };
}

function parseDateFromRequest(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawDate = searchParams.get("date") ?? dateInputValue(new Date());

  return {
    rawDate,
    closingDate: closingDateFromInput(rawDate),
  };
}

export async function GET(req: Request) {
  const auth = await requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { rawDate, closingDate } = parseDateFromRequest(req);

  if (!closingDate) {
    return NextResponse.json(
      { message: "Tanggal closing tidak valid." },
      { status: 422 },
    );
  }

  const closing = await getDailyClosing(prisma, closingDate);
  const status = closing?.status ?? DAILY_CLOSING_STATUS.OPEN;
  const isOwner =
    auth.session.role === "owner" || auth.session.role === "developer";

  return NextResponse.json({
    data: {
      date: rawDate,
      status,
      is_closed: status === DAILY_CLOSING_STATUS.CLOSED,
      can_checkout: status !== DAILY_CLOSING_STATUS.CLOSED,
      closing: isOwner ? serializeClosing(closing) : closing ? { id: closing.id, status } : null,
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json().catch(() => ({}));
  const rawDate = String(body.date ?? dateInputValue(new Date())).trim();
  const closingDate = closingDateFromInput(rawDate);
  const actualCash = Number(body.actual_cash ?? body.actualCash ?? 0);
  const notes = String(body.notes ?? "").trim();

  if (!closingDate) {
    return NextResponse.json(
      { message: "Tanggal closing tidak valid." },
      { status: 422 },
    );
  }

  if (!Number.isFinite(actualCash) || actualCash < 0) {
    return NextResponse.json(
      { message: "Cash aktual tidak valid." },
      { status: 422 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.dailyClosing.findUnique({
          where: {
            closingDate,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (existing?.status === DAILY_CLOSING_STATUS.CLOSED) {
          throw new Error("DAILY_CLOSING_ALREADY_CLOSED");
        }

        const snapshot = await buildDailyClosingSnapshot(tx, closingDate);
        const now = new Date();
        const actualCashInt = Math.round(actualCash);
        const difference = actualCashInt - snapshot.expectedCash;
        const data = {
          status: DAILY_CLOSING_STATUS.CLOSED,
          expectedCash: snapshot.expectedCash,
          actualCash: actualCashInt,
          difference,
          grossOmzet: snapshot.grossOmzet,
          netOmzet: snapshot.netOmzet,
          transactionCount: snapshot.transactionCount,
          paymentSummary: snapshot.paymentSummary as Prisma.InputJsonValue,
          returnValue: snapshot.returnValue,
          notes: notes || null,
          closedAt: now,
          closedById: auth.session.sub,
        };

        const closing = existing
          ? await tx.dailyClosing.update({
              where: {
                id: existing.id,
              },
              data,
            })
          : await tx.dailyClosing.create({
              data: {
                closingDate,
                ...data,
              },
            });

        await tx.dailyClosingLog.create({
          data: {
            dailyClosingId: closing.id,
            action: "CLOSE",
            note: notes || null,
            userId: auth.session.sub,
          },
        });

        return getDailyClosing(tx, closingDate);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/dashboard");

    return NextResponse.json(
      {
        data: serializeClosing(result),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Closing gagal.";

    if (message === "DAILY_CLOSING_ALREADY_CLOSED") {
      return NextResponse.json(
        {
          message:
            "Tanggal ini sudah closing. Reopen terlebih dahulu sebelum closing ulang.",
        },
        {
          status: 409,
        },
      );
    }

    console.error(error);

    return NextResponse.json(
      { message: "Closing gagal." },
      { status: 500 },
    );
  }
}
