import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({
    message: "Logout berhasil.",
  });

  response.cookies.set("pos_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
