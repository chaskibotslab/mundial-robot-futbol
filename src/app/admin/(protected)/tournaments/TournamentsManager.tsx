"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Category, Tournament, TournamentFormat } from "@/lib/types";
import { FORMAT_CONFIG } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

const FORMATS: { value: TournamentFormat; label: string }[] = [
  { value: "t8",  label: "8 equipos · 2 grupos × 4 → Cuartos" },
  { value: "t12", label: "12 equipos · 4 grupos × 3 → Cuartos" },
  { value: "t16", label: "16 equipos · 4 grupos × 4 → Octavos" },
  { value: "t24", label: "24 equipos · 6 grupos × 4 → Octavos (mejores 3ros)" },
  { value: "t32", label: "32 equipos · 8 grupos × 4 → Octavos (Mundial 2022)" },
  { value: "t48", label: "48 equipos · 12 grupos × 4 → 32avos (Mundial 2026)" }
];

export default function TournamentsManager({ initialTournaments }: { initialTournaments: Tournament[] }) {
  const supabase = createClient();
  const [list, setList] = useState<Tournament[]>(initialTournaments);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("pro");
  const [format, setFormat] = useState<TournamentFormat>("t32");

  async function create() {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ name: name.trim(), category, format, status: "draft" })
      .select().single();
    if (error) return alert(error.message);
    setList(l => [data as Tournament, ...l]);
    setName("");
  }

  async function remove(id: string) {
    if (!confirm("Eliminar torneo y todos sus partidos?")) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) return alert(error.message);
    setList(l => l.filter(t => t.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Torneos</h1>

      <div className="card p-4 grid sm:grid-cols-4 gap-2">
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Nombre del torneo"
          className="bg-slate-950 border border-slate-700 rounded p-2 sm:col-span-2"
        />
        <select value={category} onChange={e => setCategory(e.target.value as Category)} className="bg-slate-950 border border-slate-700 rounded p-2">
          <option value="pro">Pro</option>
          <option value="amateur">Amateur</option>
        </select>
        <select value={format} onChange={e => setFormat(e.target.value as TournamentFormat)} className="bg-slate-950 border border-slate-700 rounded p-2">
          {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button onClick={create} className="btn-primary sm:col-span-4">
          <Plus size={16} /> Crear torneo
        </button>
      </div>

      <div className="space-y-2">
        {list.length === 0 && <div className="card p-6 text-center text-slate-400">No hay torneos creados.</div>}
        {list.map(t => {
          const cfg = FORMAT_CONFIG[t.format];
          return (
            <div key={t.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold">{t.name}</h3>
                <p className="text-xs text-slate-400 uppercase">
                  {t.category} · {cfg.teams} equipos · {cfg.groups} grupos · estado: {t.status}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/tournaments/${t.id}`} className="btn-primary">Gestionar</Link>
                <button onClick={() => remove(t.id)} className="btn-ghost text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
