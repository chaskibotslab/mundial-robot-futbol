import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Trophy, Users, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = createClient();

  const [{ count: teamsCount }, { count: tournamentsCount }, { count: matchesCount }, { data: liveMatches }] =
    await Promise.all([
      supabase.from("teams").select("*", { count: "exact", head: true }),
      supabase.from("tournaments").select("*", { count: "exact", head: true }),
      supabase.from("matches").select("*", { count: "exact", head: true }),
      supabase.from("matches").select("id, home_score, away_score").eq("status", "live").limit(5)
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={<Users />} label="Equipos" value={teamsCount ?? 0} href="/admin/teams" />
        <Stat icon={<Trophy />} label="Torneos" value={tournamentsCount ?? 0} href="/admin/tournaments" />
        <Stat icon={<Calendar />} label="Partidos" value={matchesCount ?? 0} href="/admin/matches" />
      </div>
      {liveMatches && liveMatches.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold mb-2 text-red-400">🔴 EN VIVO</h3>
          <p className="text-sm text-slate-400">{liveMatches.length} partido(s) en juego.</p>
          <Link href="/admin/matches" className="btn-primary mt-3">Ver partidos</Link>
        </div>
      )}
      <div className="card p-6">
        <h3 className="font-bold mb-2">Inicio rápido</h3>
        <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
          <li>Crea equipos en <Link href="/admin/teams" className="text-brand">Equipos</Link>.</li>
          <li>Asígnale a cada equipo 1, 2 o 3 países.</li>
          <li>Ve a <Link href="/admin/tournaments" className="text-brand">Torneos</Link>, crea uno y elige el formato (16/24/32/48).</li>
          <li>Sortea los grupos y genera el bracket con un clic.</li>
          <li>Registra resultados en <Link href="/admin/matches" className="text-brand">Partidos</Link>.</li>
        </ol>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card p-4 hover:border-brand transition flex items-center gap-3">
      <div className="text-brand">{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs uppercase text-slate-400">{label}</div>
      </div>
    </Link>
  );
}
