import { requireAuth } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: { select: { name: true, slug: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ message: "User tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await req.json();
    const wantsPasswordChange =
      body.newPassword !== undefined && String(body.newPassword) !== "";

    const data: { name?: string; phone?: string | null; password?: string } = {};

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();

      if (!name) {
        return NextResponse.json(
          { message: "Nama tidak boleh kosong." },
          { status: 422 },
        );
      }

      data.name = name;
    }

    if (body.phone !== undefined) {
      const phone = String(body.phone ?? "").trim();
      data.phone = phone === "" ? null : phone;
    }

    if (wantsPasswordChange) {
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");

      if (newPassword.length < 6) {
        return NextResponse.json(
          { message: "Kata sandi baru minimal 6 karakter." },
          { status: 422 },
        );
      }

      const current = await prisma.user.findUnique({
        where: { id: auth.session.sub },
        select: { password: true },
      });

      if (!current) {
        return NextResponse.json(
          { message: "User tidak ditemukan." },
          { status: 404 },
        );
      }

      const valid = await bcrypt.compare(currentPassword, current.password);

      if (!valid) {
        return NextResponse.json(
          { message: "Kata sandi lama salah." },
          { status: 422 },
        );
      }

      data.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: "Tidak ada perubahan." },
        { status: 422 },
      );
    }

    const user = await prisma.user.update({
      where: { id: auth.session.sub },
      data,
      select: { id: true, name: true, email: true, phone: true },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Gagal memperbarui profil." },
      { status: 500 },
    );
  }
}
