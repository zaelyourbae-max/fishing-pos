import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/login-form";
import { getServerSession } from "@/lib/server-session";

export default async function LoginPage() {
  const session = await getServerSession();

  if (session?.role === "owner" || session?.role === "developer") {
    redirect("/dashboard");
  }

  if (session?.role === "cashier") {
    redirect("/cashier");
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <LoginForm />
      </div>
    </main>
  );
}
