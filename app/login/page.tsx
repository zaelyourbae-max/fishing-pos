import { redirect } from "next/navigation";

import LoginPageClient from "@/components/auth/login-page-client";
import { getServerSession } from "@/lib/server-session";

export default async function LoginPage() {
  const session = await getServerSession();

  if (session?.role === "owner" || session?.role === "developer") {
    redirect("/dashboard");
  }

  if (session?.role === "cashier") {
    redirect("/cashier");
  }

  return <LoginPageClient />;
}
