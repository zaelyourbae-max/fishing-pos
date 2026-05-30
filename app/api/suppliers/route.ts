import { requireOwner } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

function supplierCode() {
  return `SUP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
}

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const suppliers = await prisma.supplier.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      phone: true,
      address: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: suppliers,
  });
}

export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const type = String(body.type ?? "SUPPLIER").trim().toUpperCase();

    if (!name) {
      return NextResponse.json(
        {
          message: "Nama supplier wajib diisi.",
        },
        {
          status: 422,
        },
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        code: supplierCode(),
        name,
        type: type === "DISTRIBUTOR" ? "DISTRIBUTOR" : "SUPPLIER",
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        phone: true,
        address: true,
        notes: true,
        createdAt: true,
      },
    });

    revalidatePath("/suppliers");
    revalidatePath("/purchases");

    return NextResponse.json(
      {
        data: supplier,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Gagal membuat supplier.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await req.json();
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          message: "Supplier tidak valid.",
        },
        {
          status: 422,
        },
      );
    }

    const supplier = await prisma.supplier.update({
      where: {
        id,
      },
      data: {
        ...(body.name !== undefined
          ? { name: String(body.name ?? "").trim() }
          : {}),
        ...(body.phone !== undefined
          ? { phone: String(body.phone ?? "").trim() || null }
          : {}),
        ...(body.address !== undefined
          ? { address: String(body.address ?? "").trim() || null }
          : {}),
        ...(body.notes !== undefined
          ? { notes: String(body.notes ?? "").trim() || null }
          : {}),
        ...(body.type !== undefined
          ? {
              type:
                String(body.type ?? "").trim().toUpperCase() === "DISTRIBUTOR"
                  ? "DISTRIBUTOR"
                  : "SUPPLIER",
            }
          : {}),
        ...(body.isActive !== undefined
          ? { isActive: Boolean(body.isActive) }
          : {}),
        ...(body.isActive === false ? { deletedAt: new Date() } : {}),
        ...(body.isActive === true ? { deletedAt: null } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        phone: true,
        address: true,
        notes: true,
        isActive: true,
        createdAt: true,
      },
    });

    revalidatePath("/suppliers");
    revalidatePath("/purchases");

    return NextResponse.json({
      data: supplier,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Gagal update supplier.",
      },
      {
        status: 500,
      },
    );
  }
}
