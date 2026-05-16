import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/server-session";

export default async function HomePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "owner" || session.role === "developer") {
    redirect("/dashboard");
  }

  if (session.role === "cashier") {
    redirect("/cashier");
  }

  redirect("/login");
}
