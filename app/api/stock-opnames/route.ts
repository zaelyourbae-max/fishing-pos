import { requireOwner } from "@/lib/auth-session";
import {
  createStockOpnameSession,
  getStockOpnameList,
  stockOpnameErrorPayload,
} from "@/lib/stock-opname";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireOwner(request);

  if (!auth.ok) {
    return auth.response;
  }

  const sessions = await getStockOpnameList();

  return NextResponse.json({
    data: sessions.map((session) => {
      const counted = session.items.filter(
        (item) => item.physicalStock !== null,
      ).length;
      const totalDifference = session.items.reduce(
        (sum, item) => sum + (item.difference ?? 0),
        0,
      );

      return {
        id: session.id,
        opnameNumber: session.opnameNumber,
        mode: session.mode,
        status: session.status,
        title: session.title,
        notes: session.notes,
        snapshotAt: session.snapshotAt,
        createdAt: session.createdAt,
        approvedAt: session.approvedAt,
        createdBy: session.createdBy,
        approvedBy: session.approvedBy,
        totalItems: session._count.items,
        countedItems: counted,
        remainingItems: session._count.items - counted,
        totalDifference,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await requireOwner(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const session = await createStockOpnameSession({
      userId: auth.session.sub,
      title: body.title,
      notes: body.notes,
    });

    revalidatePath("/stock-opname");

    return NextResponse.json(
      {
        message: "Sesi Stock Opname berhasil dibuat.",
        data: session,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const payload = stockOpnameErrorPayload(error);

    return NextResponse.json(payload, { status: payload.status });
  }
}
