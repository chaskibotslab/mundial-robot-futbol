"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Country, Match as FullMatch, Team, Tournament, TournamentEntry } from "@/lib/types";
import { FORMAT_CONFIG } from "@/lib/types";
import { drawGroups, generateGroupMatches, generateBracket } from "@/lib/tournament";
import { ArrowLeft, Shuffle, Zap, Trash2, Dice5, Plus, Save, Edit3, AlertCircle, CheckCircle2 } from "lucide-react";
import BracketTV from "@/components/BracketTV";

interface Group { id: string; tournament_id: string; letter: string }
interface Slot { id: string; group_id: string; country_id: string; team_id: string | null; position: number }
type Match = FullMatch;

interface Props {
  tournament: Tournament;
  countries: Country[];
  teams: Team[];
  entries: TournamentEntry[];
  groups: Group[];
  slots: Slot[];
  matches: Match[];
}

export default function TournamentManager({ tournament, countries, teams, entries: initialEntries, groups, slots, matches }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<TournamentEntry[]>(initialEntries);

  const cfg = FORMAT_CONFIG[tournament.format];
  const countryById = useMemo(() => Object.fromEntries(countries.map(c => [c.id, c])), [countries]);
  const teamById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);

  // Paises ya tomados en este torneo
  const usedCountries = new Set(entries.map(e => e.country_id).filter(Boolean) as string[]);
  // Robots inscritos (al menos 1 entry)
  const enrolledTeams = useMemo(() => {
    const ids = new Set(entries.map(e => e.team_id));
    return teams.filter(t => ids.has(t.id));
  }, [entries, teams]);

  const entriesWithCountry = entries.filter(e => e.country_id);
  const entriesWithoutCountry = entries.filter(e => !e.country_id);

  const groupsBuilt = groups.length > 0;
  const knockoutBuilt = matches.some(m => m.stage !== "group");

  // ============ INSCRIPCIONES ============

  async function enrollTeam(teamId: string) {
    const { data, error } = await supabase.from("tournament_entries")
      .insert({ tournament_id: tournament.id, team_id: teamId, country_id: null })
      .select().single();
    if (error) return alert(error.message);
    setEntries(e => [...e, data as TournamentEntry]);
  }

  async function enrollAllTeams() {
    const toAdd = teams.filter(t => !enrolledTeams.find(e => e.id === t.id));
    if (toAdd.length === 0) return alert("Todos los robots ya estan inscritos.");
    const rows = toAdd.map(t => ({ tournament_id: tournament.id, team_id: t.id, country_id: null }));
    const { data, error } = await supabase.from("tournament_entries").insert(rows).select();
    if (error) return alert(error.message);
    setEntries(e => [...e, ...(data as TournamentEntry[])]);
  }

  async function removeEntry(entryId: string) {
    const { error } = await supabase.from("tournament_entries").delete().eq("id", entryId);
    if (error) return alert(error.message);
    setEntries(e => e.filter(x => x.id !== entryId));
  }

  async function removeAllEntries() {
    if (entries.length === 0) return;
    if (!confirm(`Eliminar las ${entries.length} inscripciones del torneo? Tambien se borraran grupos y partidos.`)) return;
    setBusy(true);
    await supabase.from("matches").delete().eq("tournament_id", tournament.id);
    await supabase.from("groups").delete().eq("tournament_id", tournament.id);
    const { error } = await supabase.from("tournament_entries").delete().eq("tournament_id", tournament.id);
    setBusy(false);
    if (error) return alert(error.message);
    setEntries([]);
    router.refresh();
  }

  /** Asigna 1 pais al azar a cada entry sin pais. */
  async function autoAssignCountries() {
    if (entriesWithoutCountry.length === 0) return alert("Todos los inscritos ya tienen pais.");
    const pool = countries.filter(c => !usedCountries.has(c.id));
    if (pool.length < entriesWithoutCountry.length) {
      return alert(`Paises insuficientes. Faltan ${entriesWithoutCountry.length - pool.length}.`);
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setBusy(true);
    const updates = entriesWithoutCountry.map((e, i) => ({
      id: e.id,
      tournament_id: e.tournament_id,
      team_id: e.team_id,
      country_id: shuffled[i].id,
    }));
    // Un solo round-trip via upsert (evita N requests que tumban HTTP/2 en Railway)
    const { error } = await supabase.from("tournament_entries").upsert(updates);
    setBusy(false);
    if (error) return alert(error.message);
    setEntries(e => e.map(x => {
      const u = updates.find(u => u.id === x.id);
      return u ? { ...x, country_id: u.country_id } : x;
    }));
  }

  /** Agrega 1 entry extra (con pais aleatorio) a cada robot inscrito, hasta llenar cupos. */
  async function autoAddExtra() {
    const remainingSlots = cfg.teams - entries.length;
    if (remainingSlots <= 0) return alert(`Ya tienes ${entries.length} inscripciones (objetivo ${cfg.teams}).`);
    const pool = countries.filter(c => !usedCountries.has(c.id));
    if (pool.length === 0) return alert("No hay paises disponibles.");
    const teamsShuffled = [...enrolledTeams].sort(() => Math.random() - 0.5);
    const countriesShuffled = [...pool].sort(() => Math.random() - 0.5);
    const rows: { tournament_id: string; team_id: string; country_id: string }[] = [];
    let ci = 0;
    // Damos vueltas a la lista de teams. Cada team puede tener max 3 entries en este torneo.
    while (rows.length < remainingSlots && ci < countriesShuffled.length) {
      let added = false;
      for (const t of teamsShuffled) {
        if (rows.length >= remainingSlots || ci >= countriesShuffled.length) break;
        const teamCount = entries.filter(e => e.team_id === t.id).length
                       + rows.filter(r => r.team_id === t.id).length;
        if (teamCount >= 3) continue;
        rows.push({ tournament_id: tournament.id, team_id: t.id, country_id: countriesShuffled[ci].id });
        ci++;
        added = true;
      }
      if (!added) break;
    }
    if (rows.length === 0) return alert("No se pudieron asignar mas paises (limite 3 paises por robot).");
    setBusy(true);
    const { data, error } = await supabase.from("tournament_entries").insert(rows).select();
    setBusy(false);
    if (error) return alert(error.message);
    setEntries(e => [...e, ...(data as TournamentEntry[])]);
  }

  async function changeEntryCountry(entryId: string, countryId: string) {
    const { error } = await supabase.from("tournament_entries")
      .update({ country_id: countryId }).eq("id", entryId);
    if (error) return alert(error.message);
    setEntries(e => e.map(x => x.id === entryId ? { ...x, country_id: countryId } : x));
  }

  // ============ SORTEO ============

  async function drawAndCreateGroups() {
    if (entriesWithCountry.length !== cfg.teams) {
      return alert(`Necesitas exactamente ${cfg.teams} inscripciones con pais asignado. Tienes ${entriesWithCountry.length}.`);
    }
    if (!confirm(`Sortear ${cfg.teams} paises en ${cfg.groups} grupos? Se borraran grupos y partidos previos.`)) return;
    setBusy(true);
    try {
      await supabase.from("groups").delete().eq("tournament_id", tournament.id);
      await supabase.from("matches").delete().eq("tournament_id", tournament.id);

      const draw = drawGroups(
        entriesWithCountry.map(e => ({ countryId: e.country_id!, teamId: e.team_id })),
        tournament.format
      );

      const { data: insertedGroups, error: gErr } = await supabase.from("groups")
        .insert(draw.map(g => ({ tournament_id: tournament.id, letter: g.letter })))
        .select();
      if (gErr) throw gErr;

      // Map country -> team via entries
      const teamByCountryInTourn: Record<string, string> = {};
      entriesWithCountry.forEach(e => { teamByCountryInTourn[e.country_id!] = e.team_id; });

      const slotRows = draw.flatMap(g => {
        const grp = (insertedGroups ?? []).find(ig => ig.letter === g.letter)!;
        return g.countries.map((cid, idx) => ({
          group_id: grp.id, country_id: cid, team_id: teamByCountryInTourn[cid] ?? null, position: idx + 1
        }));
      });
      await supabase.from("group_slots").insert(slotRows);

      // Generate group matches
      const matchRows: any[] = [];
      draw.forEach(g => {
        const grp = (insertedGroups ?? []).find(ig => ig.letter === g.letter)!;
        generateGroupMatches(g).forEach(m => {
          const homeTeam = teamByCountryInTourn[m.home_country_id!] ?? null;
          const awayTeam = teamByCountryInTourn[m.away_country_id!] ?? null;
          matchRows.push({
            tournament_id: tournament.id, stage: "group", group_id: grp.id, round_index: m.round_index,
            home_country: m.home_country_id, away_country: m.away_country_id,
            home_team: homeTeam, away_team: awayTeam,
            status: homeTeam && homeTeam === awayTeam ? "walkover" : "scheduled"
          });
        });
      });
      const { error: mErr } = await supabase.from("matches").insert(matchRows);
      if (mErr) throw mErr;

      await supabase.from("tournaments").update({ status: "groups" }).eq("id", tournament.id);
      router.refresh();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  /** Lee standings y rellena las llaves eliminatorias (cfg.knockoutStart) con los clasificados.
   *  Pairing simple: 1A vs 2B, 1B vs 2A, 1C vs 2D, 1D vs 2C, etc. (cruzando grupos consecutivos)
   *  Para formatos con bestThirds, los terceros llenan los slots restantes en orden. */
  async function seedKnockoutFromGroups() {
    if (!confirm("Llenar las llaves de eliminatorias con los clasificados de cada grupo? Sobrescribira los pares actuales.")) return;
    setBusy(true);
    try {
      const { data: standings, error: stErr } = await supabase
        .from("v_group_standings").select("*").eq("tournament_id", tournament.id);
      if (stErr) throw stErr;
      // Agrupar por letter y ordenar por pts DESC, dg DESC, gf DESC
      const byGroup: Record<string, any[]> = {};
      (standings ?? []).forEach((row: any) => { (byGroup[row.group_letter] ||= []).push(row); });
      Object.values(byGroup).forEach(arr => {
        arr.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
      });
      const sortedLetters = Object.keys(byGroup).sort();

      // 1ros, 2dos, terceros
      const winners = sortedLetters.map(L => byGroup[L][0]?.country_id).filter(Boolean);
      const runners = sortedLetters.map(L => byGroup[L][1]?.country_id).filter(Boolean);
      const thirds = sortedLetters.map(L => byGroup[L][2]).filter(Boolean)
        .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf)
        .slice(0, cfg.bestThirds).map(t => t.country_id);

      // Pairing winner vs runner-of-next-group
      const pairs: { home: string; away: string }[] = [];
      for (let i = 0; i < winners.length; i++) {
        const opp = runners[(i + 1) % runners.length];
        if (winners[i] && opp) pairs.push({ home: winners[i], away: opp });
      }
      // Si hay best thirds, generar pares extra entre runners restantes y thirds
      // (Para t24/t48: total qualified = winners + runners + thirds; pairs.length << total)
      if (thirds.length > 0) {
        // Tomamos thirds y los emparejamos con winners/runners aun no usados
        // Logica simple: thirds vs winners (1A vs 3X)
        for (let i = 0; i < thirds.length; i++) {
          // Reemplazar el away del par i con el third (para que pelee 1ro vs 3ro)
          if (pairs[i]) pairs.push({ home: pairs[i].away, away: thirds[i] });
        }
      }

      // Obtener matches del knockoutStart stage
      const { data: ko, error: koErr } = await supabase
        .from("matches").select("*")
        .eq("tournament_id", tournament.id).eq("stage", cfg.knockoutStart)
        .order("round_index");
      if (koErr) throw koErr;

      const koMatches = ko ?? [];
      for (let i = 0; i < Math.min(pairs.length, koMatches.length); i++) {
        await supabase.from("matches").update({
          home_country: pairs[i].home, away_country: pairs[i].away
        }).eq("id", koMatches[i].id);
      }
      router.refresh();
      alert(`Bracket sembrado: ${pairs.length} cruces creados.`);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function buildBracket() {
    if (!confirm("Generar bracket eliminatorio? Se crearan partidos vacios encadenados.")) return;
    setBusy(true);
    try {
      const draft = generateBracket(tournament.format);
      const rows = draft.map(m => ({
        tournament_id: tournament.id, stage: m.stage, round_index: m.round_index,
        bracket_slot: m.bracket_slot,
        home_country: m.home_country_id, away_country: m.away_country_id,
        status: "scheduled"
      }));
      const { data: inserted, error } = await supabase.from("matches").insert(rows).select();
      if (error) throw error;
      // Resolve feeds_winner_match / feeds_loser_match using bracket_slot mapping
      const bySlot: Record<number, string> = {};
      (inserted ?? []).forEach((m: any) => { if (m.bracket_slot != null) bySlot[m.bracket_slot] = m.id; });
      for (let i = 0; i < draft.length; i++) {
        const d = draft[i];
        const m = (inserted ?? [])[i];
        if (d.feeds_winner_slot_index != null) {
          await supabase.from("matches").update({
            feeds_winner_match: bySlot[d.feeds_winner_slot_index],
            feeds_winner_slot: d.feeds_winner_side
          }).eq("id", m.id);
        }
        if (d.feeds_loser_slot_index != null) {
          await supabase.from("matches").update({
            feeds_loser_match: bySlot[d.feeds_loser_slot_index],
            feeds_loser_slot: d.feeds_loser_side
          }).eq("id", m.id);
        }
      }
      await supabase.from("tournaments").update({ status: "knockout" }).eq("id", tournament.id);
      router.refresh();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/tournaments" className="text-slate-400 hover:text-brand"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <span className="text-xs uppercase bg-slate-800 px-2 py-1 rounded">{tournament.category}</span>
        <span className="text-xs text-slate-400">{cfg.teams} equipos · {cfg.groups} grupos × {cfg.perGroup}</span>
      </div>

      {/* 1. Inscripciones */}
      <div className="card p-4">
        {/* Explicacion visual de la logica de cupos */}
        <details className="mb-3 text-xs bg-slate-900/60 rounded p-2 border border-slate-800">
          <summary className="cursor-pointer text-slate-300 font-semibold">❓ ¿Cómo funcionan los cupos? (click para abrir)</summary>
          <div className="mt-2 text-slate-400 space-y-1">
            <p>• <b>1 cupo = 1 país en el torneo</b>. Tu torneo necesita <b>{cfg.teams} cupos</b>.</p>
            <p>• <b>1 robot puede ocupar 1 o varios cupos</b>. Cada cupo = robot jugando como un país distinto.</p>
            <p>• Ejemplo: tienes 8 robots y formato T16 → necesitas 16 cupos. Cada robot ocupa 1 cupo + 1 cupo extra (8 + 8 = 16). El robot Apolo jugará como Argentina Y como Brasil (3 partidos por jornada, no 1).</p>
            <p>• Si en eliminatorias se enfrentan 2 países del mismo robot (ej. Argentina vs Brasil ambos = Apolo), gana por <b>walkover</b> automático.</p>
            <p className="text-amber-400">⚠️ Máximo 3 cupos por robot.</p>
          </div>
        </details>

        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h2 className="font-bold">
            1. Inscripciones
            <span className={`ml-2 text-sm ${entries.length === cfg.teams ? "text-emerald-400" : "text-amber-400"}`}>
              ({entries.length} / {cfg.teams} cupos)
            </span>
          </h2>
          <div className="flex gap-2 flex-wrap">
            {teams.length > 0 && enrolledTeams.length < teams.length && (
              <button onClick={enrollAllTeams} disabled={busy} className="btn-ghost text-sm">
                <Plus size={14} /> Inscribir todos los robots {tournament.category}
              </button>
            )}
            {entries.length > 0 && (
              <button onClick={removeAllEntries} disabled={busy}
                className="text-sm px-3 py-1 rounded border border-red-700 text-red-400 hover:bg-red-900/30">
                <Trash2 size={14} className="inline mr-1" /> Quitar todas
              </button>
            )}
          </div>
        </div>

        {teams.length === 0 ? (
          <p className="text-amber-400 text-sm">
            ⚠️ No tienes robots {tournament.category}. Crealos en <Link className="text-brand" href="/admin/teams">/admin/teams</Link>.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              <select onChange={e => { if (e.target.value) { enrollTeam(e.target.value); e.target.value = ""; } }}
                className="bg-slate-950 border border-slate-700 rounded p-2 text-sm" defaultValue="">
                <option value="">+ Inscribir robot...</option>
                {teams.filter(t => !enrolledTeams.find(et => et.id === t.id))
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                {/* Robots ya inscritos pueden volver a inscribirse para multi-pais */}
                {enrolledTeams.map(t => <option key={"again-" + t.id} value={t.id}>{t.name} (otro pais)</option>)}
              </select>
              <button onClick={autoAssignCountries} disabled={busy || entriesWithoutCountry.length === 0}
                className="btn-primary text-sm">
                <Dice5 size={14} /> Asignar paises al azar ({entriesWithoutCountry.length} sin pais)
              </button>
              {entries.length < cfg.teams && entries.length > 0 && (
                <button onClick={autoAddExtra} disabled={busy} className="btn-ghost text-sm">
                  <Dice5 size={14} /> Llenar cupos restantes ({cfg.teams - entries.length})
                </button>
              )}
            </div>

            {/* Indicador progreso */}
            <div className="text-sm mb-3 flex items-center gap-2">
              {entries.length >= cfg.teams && entriesWithoutCountry.length === 0 ? (
                <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14} /> Listo para sortear grupos</span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {entries.length < cfg.teams
                    ? `Faltan ${cfg.teams - entries.length} inscripciones`
                    : `Faltan ${entriesWithoutCountry.length} paises por asignar`}
                </span>
              )}
            </div>

            {/* Lista de inscritos */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {entries.map(entry => {
                const team = teamById[entry.team_id];
                const country = entry.country_id ? countryById[entry.country_id] : null;
                const availableCountries = countries.filter(c => !usedCountries.has(c.id) || c.id === entry.country_id);
                return (
                  <div key={entry.id} className="border border-slate-800 rounded p-2 text-sm flex items-center gap-2">
                    <span className="font-semibold flex-1 truncate" title={team?.name}>{team?.name ?? "?"}</span>
                    <select value={entry.country_id ?? ""}
                      onChange={e => changeEntryCountry(entry.id, e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded p-1 text-xs max-w-[140px]">
                      <option value="">— pais —</option>
                      {availableCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {country?.flag_url && <img src={country.flag_url} alt="" className="w-5 h-3 object-cover" />}
                    <button onClick={() => removeEntry(entry.id)} className="text-red-400 hover:text-red-300 p-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 2. Sorteo */}
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h2 className="font-bold">2. Sorteo de grupos</h2>
          {groupsBuilt && (
            <button onClick={drawAndCreateGroups} disabled={busy} className="btn-ghost text-sm">
              <Shuffle size={14} /> Re-sortear
            </button>
          )}
        </div>
        {!groupsBuilt ? (
          <div>
            <button onClick={drawAndCreateGroups}
              disabled={busy}
              className="btn-primary disabled:opacity-50">
              <Shuffle size={16} /> Sortear grupos
            </button>
            {entriesWithCountry.length !== cfg.teams && (
              <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                <AlertCircle size={12} />
                Necesitas exactamente {cfg.teams} inscripciones con país asignado. Actualmente tienes {entriesWithCountry.length}.
                {entries.length < cfg.teams && ` Faltan ${cfg.teams - entries.length} inscripciones.`}
                {entriesWithoutCountry.length > 0 && ` ${entriesWithoutCountry.length} sin país.`}
              </p>
            )}
          </div>
        ) : (
          <GroupsView
            groups={groups} slots={slots} countries={countries}
            countryById={countryById}
            tournamentId={tournament.id}
            entries={entries}
            teamById={teamById}
            onRefresh={() => router.refresh()}
          />
        )}
      </div>

      {/* 3. Bracket */}
      {groupsBuilt && (
        <div className="card p-4">
          <h2 className="font-bold mb-2">3. Bracket eliminatorio</h2>
          {!knockoutBuilt ? (
            <>
              <p className="text-sm text-slate-400 mb-3">
                Cuando termine la fase de grupos, genera el bracket. Se llenara automaticamente conforme avancen las llaves.
              </p>
              <button onClick={buildBracket} disabled={busy} className="btn-primary">
                <Zap size={16} /> Generar bracket
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-emerald-400">✅ Bracket creado.</p>
              <p className="text-sm text-slate-400">
                Cuando termines la fase de grupos, llena las llaves automáticamente con los clasificados:
              </p>
              <button onClick={seedKnockoutFromGroups} disabled={busy} className="btn-primary text-sm">
                <Zap size={14} /> Llenar llaves desde standings de grupos
              </button>
              <p className="text-xs text-slate-500">
                Edita los partidos uno por uno desde <Link className="text-brand" href="/admin/matches">Partidos</Link>.
                Al finalizar cada partido eliminatorio, el ganador avanza automáticamente a la siguiente ronda.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cuadro visual del bracket */}
      {knockoutBuilt && (
        <div className="card p-4">
          <h2 className="font-bold mb-3">🏆 Cuadro de eliminatorias</h2>
          <div className="overflow-x-auto">
            <BracketTV matches={matches} countries={countryById} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Vista de grupos con opcion de editar manualmente y regenerar partidos. */
function GroupsView({
  groups, slots, countries, countryById, tournamentId, entries, teamById, onRefresh
}: {
  groups: Group[]; slots: Slot[]; countries: Country[];
  countryById: Record<string, Country>;
  tournamentId: string;
  entries: TournamentEntry[];
  teamById: Record<string, Team>;
  onRefresh: () => void;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(slots.map(s => [s.id, s.country_id]))
  );
  const [saving, setSaving] = useState(false);

  const eligibleIds = new Set(entries.filter(e => e.country_id).map(e => e.country_id!));
  const eligibleCountries = countries.filter(c => eligibleIds.has(c.id));
  const teamByCountry: Record<string, string | null> = {};
  entries.forEach(e => { if (e.country_id) teamByCountry[e.country_id] = e.team_id; });

  const used = new Set(Object.values(draft));
  const duplicates = Object.values(draft).length !== used.size;

  async function applyChanges() {
    if (duplicates) return alert("Hay paises duplicados.");
    setSaving(true);
    try {
      for (const slot of slots) {
        const newCountry = draft[slot.id];
        if (newCountry !== slot.country_id) {
          await supabase.from("group_slots")
            .update({ country_id: newCountry, team_id: teamByCountry[newCountry] ?? null })
            .eq("id", slot.id);
        }
      }
      // Regenerate group matches
      await supabase.from("matches").delete()
        .eq("tournament_id", tournamentId).eq("stage", "group");
      const { data: freshSlots } = await supabase.from("group_slots")
        .select("*").in("group_id", groups.map(g => g.id));
      const matchRows: any[] = [];
      groups.forEach(g => {
        const gs = (freshSlots ?? [])
          .filter(s => s.group_id === g.id)
          .sort((a, b) => a.position - b.position);
        const ids = gs.map(s => s.country_id);
        const matches = generateGroupMatches({ letter: g.letter, countries: ids });
        matches.forEach(m => {
          const homeTeam = teamByCountry[m.home_country_id!] ?? null;
          const awayTeam = teamByCountry[m.away_country_id!] ?? null;
          matchRows.push({
            tournament_id: tournamentId, stage: "group", group_id: g.id, round_index: m.round_index,
            home_country: m.home_country_id, away_country: m.away_country_id,
            home_team: homeTeam, away_team: awayTeam,
            status: homeTeam && homeTeam === awayTeam ? "walkover" : "scheduled"
          });
        });
      });
      await supabase.from("matches").insert(matchRows);
      setEditing(false);
      onRefresh();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-2 gap-2">
        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-ghost text-xs">
            <Edit3 size={12} /> Editar grupos
          </button>
        ) : (
          <>
            <button onClick={() => { setEditing(false); setDraft(Object.fromEntries(slots.map(s => [s.id, s.country_id]))); }}
              className="btn-ghost text-xs">Cancelar</button>
            <button onClick={applyChanges} disabled={saving || duplicates} className="btn-primary text-xs">
              <Save size={12} /> {saving ? "Guardando..." : "Aplicar"}
            </button>
          </>
        )}
      </div>
      {editing && duplicates && <div className="text-red-400 text-xs mb-2">⚠️ Paises duplicados.</div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {groups.map(g => (
          <div key={g.id} className="border border-slate-800 rounded p-2">
            <h4 className="font-bold mb-1 text-sm">Grupo {g.letter}</h4>
            <ul className="text-xs space-y-1">
              {slots.filter(s => s.group_id === g.id).sort((a, b) => a.position - b.position).map(s => {
                const currentId = draft[s.id];
                const c = countryById[currentId];
                const team = teamByCountry[currentId] ? teamById[teamByCountry[currentId]!] : null;
                return (
                  <li key={s.id} className="flex items-center gap-1">
                    <span className="text-slate-500 w-4">{s.position}.</span>
                    {editing ? (
                      <select value={currentId}
                        onChange={e => setDraft(d => ({ ...d, [s.id]: e.target.value }))}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded p-1 text-xs">
                        {eligibleCountries.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    ) : (
                      <>
                        {c?.flag_url && <img src={c.flag_url} alt="" className="w-4 h-3 object-cover" />}
                        <span className="flex-1 truncate">{c?.name}</span>
                        {team && <span className="text-slate-500 truncate text-[10px]">({team.name})</span>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
