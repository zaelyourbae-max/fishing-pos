import { verifySessionToken } from "@/lib/auth-session";
import { cookies } from "next/headers";

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pos_session")?.value;

  return token ? verifySessionToken(token) : null;
}
