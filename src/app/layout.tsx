import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Trophy } from "lucide-react";

export const metadata: Metadata = {
  title: "Mundial Robot Fútbol | Chaski Bots",
  description: "Simulación del Mundial de Robot Fútbol - Categorías Pro y Amateur",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
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
