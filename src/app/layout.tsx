import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Trophy } from "lucide-react";

export const metadata: Metadata = {
  title: "Mundial Robot Fútbol | Chaski Bots",
  description: "Simulación del Mundial de Robot Fútbol - Categorías Pro y Amateur",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2322c55e'%3E%3Cpath d='M6 9H4.5a2.5 2.5 0 010-5H6m12 1h1.5a2.5 2.5 0 010 5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0012 0V2z'/%3E%3C/svg%3E"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans">
        <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Trophy className="text-brand" />
              <span>Mundial Robot Fútbol</span>
            </Link>
            <nav className="flex gap-2 text-sm">
              <Link className="btn-ghost" href="/pro">Pro</Link>
              <Link className="btn-ghost" href="/amateur">Amateur</Link>
              <Link className="btn-primary" href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs text-slate-500 py-8">
          Chaski Bots · {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
