"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Team, Category } from "@/lib/types";
import { Plus, Trash2, Pencil, Check } from "lucide-react";

interface Props {
  initialTeams: Team[];
}

/**
 * Pool global de robots/equipos.
 * - Solo nombres y categoria. La asignacion de pais se hace POR TORNEO en /admin/tournaments/[id].
 * - Soporta crear, renombrar, borrar 1, borrar todos los de la pestania.
 */
export default function TeamsManager({ initialTeams }: Props) {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [tab, setTab] = useState<Category>("pro");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = teams.filter(t => t.category === tab);

  async function addTeam() {
    if (!newName.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("teams").insert({ name: newName.trim(), category: tab })
      .select().single();
    setBusy(false);
    if (error) return alert(error.message);
    setTeams(t => [...t, data as Team]);
    setNewName("");
  }

  async function deleteTeam(id: string) {
    if (!confirm("Eliminar este equipo? Tambien se borran sus inscripciones en torneos.")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return alert(error.message);
    setTeams(t => t.filter(x => x.id !== id));
  }

  async function deleteAllInTab() {
    if (filtered.length === 0) return;
    if (!confirm(`Eliminar TODOS los ${filtered.length} equipos ${tab.toUpperCase()}? Tambien se borran sus inscripciones en torneos.`)) return;
    setBusy(true);
    const ids = filtered.map(t => t.id);
    const { error } = await supabase.from("teams").delete().in("id", ids);
    setBusy(false);
    if (error) return alert(error.message);
    setTeams(t => t.filter(x => x.category !== tab));
  }

  async function renameTeam(id: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("teams").update({ name: trimmed }).eq("id", id);
    if (error) return alert(error.message);
    setTeams(t => t.map(x => x.id === id ? { ...x, name: trimmed } : x));
  }

  async function bulkAdd() {
    const txt = prompt(`Pega varios nombres de equipos (1 por linea) para crear en ${tab.toUpperCase()}:`);
    if (!txt) return;
    const names = txt.split("\n").map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    const rows = names.map(name => ({ name, category: tab }));
    const { data, error } = await supabase.from("teams").insert(rows).select();
    setBusy(false);
    if (error) return alert(error.message);
    setTeams(t => [...t, ...(data as Team[])]);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-xl font-bold">Pool global de robots</h2>
          <p className="text-slate-400 text-sm">
            Solo crea aqui los robots. La asignacion de pais se hace al inscribirlos en un torneo.
          </p>
          <p className="text-slate-500 text-xs mt-1">Total {tab.toUpperCase()}: {filtered.length}</p>
        </div>
        <div className="flex gap-2">
          <button className={tab === "pro" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("pro")}>Pro</button>
          <button className={tab === "amateur" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("amateur")}>Amateur</button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTeam()}
          placeholder={`Nombre del equipo ${tab}`}
          className="flex-1 min-w-[200px] bg-slate-950 border border-slate-700 rounded p-2"
        />
        <button onClick={addTeam} disabled={busy} className="btn-primary">
          <Plus size={16} /> Agregar
        </button>
        <button onClick={bulkAdd} disabled={busy} className="btn-ghost text-sm" title="Crear varios a la vez (1 nombre por linea)">
          Agregar varios
        </button>
        {filtered.length > 0 && (
          <button onClick={deleteAllInTab} disabled={busy}
            className="text-sm px-3 py-2 rounded border border-red-700 text-red-400 hover:bg-red-900/30">
            <Trash2 size={14} className="inline mr-1" /> Eliminar todos ({filtered.length})
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="card p-6 text-center text-slate-400 sm:col-span-2 lg:col-span-3">
            Sin equipos en esta categoria.
          </div>
        )}
        {filtered.map(team => (
          <div key={team.id} className="card p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <TeamNameEditor name={team.name} onSave={n => renameTeam(team.id, n)} />
            </div>
            <button onClick={() => deleteTeam(team.id)} className="text-red-400 hover:text-red-300 p-1" title="Eliminar">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamNameEditor({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  if (!editing) {
    return (
      <button onClick={() => { setVal(name); setEditing(true); }}
        className="flex items-center gap-2 group w-full text-left">
        <span className="font-semibold truncate">{name}</span>
        <Pencil size={11} className="opacity-0 group-hover:opacity-100 text-slate-400" />
      </button>
    );
  }
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(val); setEditing(false); }} className="flex gap-1">
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { onSave(val); setEditing(false); }}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm flex-1 min-w-0" />
      <button type="submit" className="text-emerald-400 px-1"><Check size={14} /></button>
    </form>
  );
}
