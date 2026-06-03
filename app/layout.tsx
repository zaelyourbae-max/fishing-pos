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
        {/* Terapkan tema & palet SEBELUM paint pertama supaya tidak ada kedip
            teal/terang saat refresh atau pindah halaman. Harus berjalan sinkron
            sebelum konten body dirender. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;if(localStorage.getItem('fishing_pos_theme')==='dark')d.classList.add('dark');var p=localStorage.getItem('fishing_pos_palette');var v=['teal','forest','sage','ocean','turquoise','taxi','sunset','crimson','pastel'];d.setAttribute('data-palette',v.indexOf(p)>-1?p:'teal');}catch(e){document.documentElement.setAttribute('data-palette','teal');}})();`,
          }}
        />
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
