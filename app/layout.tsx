import "./globals.css";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import ThemeInitializer from "@/components/layout/theme-initializer";
import { DEFAULT_APP_TIMEZONE } from "@/lib/date-format";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-app",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appTimeZone = process.env.APP_TIMEZONE?.trim() || DEFAULT_APP_TIMEZONE;

  return (
    <html
      lang="id"
      className={inter.variable}
      data-app-timezone={appTimeZone}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
