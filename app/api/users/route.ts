import { requireOwner } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const ALLOWED_ROLES = ["owner", "cashier", "developer"];

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: users,
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
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const roleSlug = String(body.role ?? "cashier").trim().toLowerCase();

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          message: "Nama, email, dan password wajib diisi.",
        },
        {
          status: 422,
        },
      );
    }

    if (!ALLOWED_ROLES.includes(roleSlug)) {
      return NextResponse.json(
        {
          message: "Role tidak valid.",
        },
        {
          status: 422,
        },
      );
    }

    const role = await prisma.role.upsert({
      where: {
        slug: roleSlug,
      },
      update: {
        name: roleSlug[0].toUpperCase() + roleSlug.slice(1),
      },
      create: {
        slug: roleSlug,
        name: roleSlug[0].toUpperCase() + roleSlug.slice(1),
      },
    });
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 10),
        roleId: role.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: user,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Gagal membuat user.",
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
    const roleSlug =
      body.role === undefined
        ? null
        : String(body.role ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          message: "User tidak valid.",
        },
        {
          status: 422,
        },
      );
    }

    if (roleSlug && !ALLOWED_ROLES.includes(roleSlug)) {
      return NextResponse.json(
        {
          message: "Role tidak valid.",
        },
        {
          status: 422,
        },
      );
    }

    const role = roleSlug
      ? await prisma.role.upsert({
          where: {
            slug: roleSlug,
          },
          update: {
            name: roleSlug[0].toUpperCase() + roleSlug.slice(1),
          },
          create: {
            slug: roleSlug,
            name: roleSlug[0].toUpperCase() + roleSlug.slice(1),
          },
        })
      : null;
    const user = await prisma.user.update({
      where: {
        id,
      },
      data: {
        ...(body.name !== undefined
          ? { name: String(body.name ?? "").trim() }
          : {}),
        ...(body.email !== undefined
          ? { email: String(body.email ?? "").trim().toLowerCase() }
          : {}),
        ...(body.isActive !== undefined
          ? { isActive: Boolean(body.isActive) }
          : {}),
        ...(role ? { roleId: role.id } : {}),
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: user,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Gagal update user.",
      },
      {
        status: 500,
      },
    );
  }
}
