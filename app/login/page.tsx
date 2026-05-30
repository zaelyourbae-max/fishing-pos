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
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,_#faffff_0%,_#edf8f6_45%,_#dcebe7_100%)] px-3 py-5 text-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-md items-center justify-center sm:min-h-[calc(100vh-4rem)] lg:max-w-7xl">
        <div className="grid w-full items-stretch lg:min-h-[620px] lg:grid-cols-[52fr_48fr] lg:overflow-hidden lg:rounded-[2.15rem] lg:border lg:border-white/90 lg:bg-white lg:shadow-[0_30px_110px_rgba(15,118,110,0.16)]">
          <section
            className="relative hidden overflow-hidden bg-[#eaf8f5] lg:flex"
            style={{
              backgroundImage: "url('/login/meijrverse-login-landscape.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/28 via-white/8 to-transparent" />
            <div className="absolute bottom-0 left-0 h-40 w-[74%] bg-[radial-gradient(ellipse_at_bottom_left,_rgba(15,23,42,0.36)_0%,_rgba(15,23,42,0.16)_48%,_rgba(15,23,42,0)_76%)]" />

            <div className="relative z-20 h-full w-full">
              <div className="absolute left-12 right-8 top-12 text-slate-900">
                <h1 className="font-sans whitespace-nowrap text-[3.15rem] font-black leading-none tracking-tight">
                  MEIJRVERSE&deg;
                </h1>
                <p className="mt-3 text-base font-medium tracking-[0.04em] text-slate-700">
                  Retail Operating System
                </p>
              </div>

              <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center space-y-2.5 rounded-2xl bg-slate-950/34 px-5 py-3 text-center text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] ring-1 ring-white/15 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-[0.82rem] font-semibold">
                  <span>Aman</span>
                  <span className="text-white/70">&bull;</span>
                  <span>Cepat</span>
                  <span className="text-white/70">&bull;</span>
                  <span>Terpercaya</span>
                </div>
                <p className="text-[0.8rem] font-medium text-white/85">
                  &copy; 2026 MEIJRVERSE&deg;. All rights reserved.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center lg:min-h-[620px] lg:bg-white lg:px-14 lg:py-10">
            <div className="w-full lg:max-w-[360px]">
              <LoginForm />
              <p className="mt-5 text-center text-xs font-semibold text-slate-500 lg:hidden">
                &copy; 2026 MEIJRVERSE&deg;. All rights reserved.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
