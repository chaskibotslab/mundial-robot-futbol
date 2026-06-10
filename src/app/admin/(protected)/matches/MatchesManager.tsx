"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Country, Match, MatchStatus, Team, Tournament, TournamentEntry } from "@/lib/types";
import { Save, Plus } from "lucide-react";

interface Group { id: string; letter: string; tournament_id?: string }
interface Props {
  tournaments: Tournament[];
  initialMatches: Match[];
  countries: Country[];
  groups: Group[];
  teams: Team[];
  entries: TournamentEntry[];
}

const STAGE_LABEL: Record<string, string> = {
  group: "Fase de grupos", r32: "32avos", r16: "Octavos", qf: "Cuartos", sf: "Semifinales", third: "Tercer puesto", final: "Final"
};

export default function MatchesManager({ tournaments, initialMatches, countries, groups, teams, entries }: Props) {
  const supabase = createClient();
  const [tournamentId, setTournamentId] = useState<string>(tournaments[0]?.id ?? "");
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const countryById = useMemo(() => Object.fromEntries(countries.map(c => [c.id, c])), [countries]);
  const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
  const teamById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);

  // Mapa: tournament_id -> country_id -> team_id (derivado en vivo de tournament_entries)
  const teamByCountryInTournament = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    entries.forEach(e => {
      if (!e.country_id) return;
      (m[e.tournament_id] ||= {})[e.country_id] = e.team_id;
    });
    return m;
  }, [entries]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("matches").select("*").order("stage").order("round_index");
    setMatches((data as Match[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, refresh]);

  const filtered = matches.filter(m => m.tournament_id === tournamentId);

  // Partidos de fase de grupos agrupados por letra de grupo y jornada
  const groupMatches = filtered.filter(m => m.stage === "group");
  const groupsForTournament = groups.filter(g => g.tournament_id === tournamentId || groupMatches.some(m => m.group_id === g.id));
  const knockoutByStage: Record<string, Match[]> = {};
  filtered.filter(m => m.stage !== "group").forEach(m => {
    (knockoutByStage[m.stage] ||= []).push(m);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Partidos</h1>
        <select
          value={tournamentId}
          onChange={e => setTournamentId(e.target.value)}
          className="mt-3 bg-slate-950 border border-slate-700 rounded p-2"
        >
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="card p-6 text-center text-slate-400">
          Este torneo aún no tiene partidos. Sortea grupos en la página del torneo.
        </div>
      )}

      {groupsForTournament.length > 0 && groupMatches.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-3">🏆 Fase de grupos</h2>
          <div className="grid lg:grid-cols-2 gap-4">
            {groupsForTournament.sort((a, b) => a.letter.localeCompare(b.letter)).map(group => {
              const gms = groupMatches.filter(m => m.group_id === group.id);
              const byRound: Record<number, Match[]> = {};
              gms.forEach(m => { (byRound[m.round_index ?? 0] ||= []).push(m); });
              return (
                <div key={group.id} className="card p-3">
                  <h3 className="font-bold text-brand mb-2">Grupo {group.letter}</h3>
                  {Object.entries(byRound).sort(([a], [b]) => Number(a) - Number(b)).map(([round, list]) => (
                    <div key={round} className="mb-3">
                      <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Jornada {Number(round) + 1}</p>
                      <div className="space-y-1">
                        {list.map(m => (
                          <MatchRow key={m.id} match={m} countryById={countryById} groupById={groupById} teamById={teamById} teamByCountry={teamByCountryInTournament[m.tournament_id] ?? {}} onSaved={refresh} compact />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {Object.entries(knockoutByStage).map(([stage, list]) => (
        <section key={stage}>
          <h2 className="text-2xl font-bold mb-3">🔥 {STAGE_LABEL[stage] ?? stage}</h2>
          <div className="space-y-2">
            {list.map(m => (
              <MatchRow key={m.id} match={m} countryById={countryById} groupById={groupById} teamById={teamById} teamByCountry={teamByCountryInTournament[m.tournament_id] ?? {}} onSaved={refresh} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchRow({
  match, countryById, groupById, teamById, teamByCountry, onSaved, compact
}: { match: Match; countryById: Record<string, Country>; groupById: Record<string, Group>; teamById: Record<string, Team>; teamByCountry: Record<string, string>; onSaved: () => void; compact?: boolean }) {
  const supabase = createClient();
  const [home, setHome] = useState(match.home_score);
  const [away, setAway] = useState(match.away_score);
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [busy, setBusy] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [goals, setGoals] = useState<any[]>([]);

  const homeCountry = match.home_country ? countryById[match.home_country] : null;
  const awayCountry = match.away_country ? countryById[match.away_country] : null;
  // Derivar team desde tournament_entries (mas robusto que confiar en match.home_team que puede ser null)
  const homeTeamId = match.home_team ?? (match.home_country ? teamByCountry[match.home_country] : null);
  const awayTeamId = match.away_team ?? (match.away_country ? teamByCountry[match.away_country] : null);
  const homeTeam = homeTeamId ? teamById[homeTeamId] : null;
  const awayTeam = awayTeamId ? teamById[awayTeamId] : null;
  const groupLabel = match.group_id ? groupById[match.group_id]?.letter : null;
  const playable = !!homeCountry && !!awayCountry;

  const statusBorder = status === "live" ? "border-emerald-600 ring-1 ring-emerald-600/40"
    : status === "finished" ? "border-slate-700 opacity-80"
    : status === "walkover" ? "border-amber-700 opacity-70"
    : "border-slate-800";

  async function loadGoals() {
    const { data } = await supabase.from("goals").select("*").eq("match_id", match.id).order("minute", { ascending: true });
    setGoals(data ?? []);
  }
  useEffect(() => { if (showGoals) loadGoals(); }, [showGoals]);

  async function save(forceStatus?: MatchStatus) {
    setBusy(true);
    const newStatus = forceStatus ?? status;
    const { error } = await supabase.from("matches").update({
      home_score: home, away_score: away, status: newStatus
    }).eq("id", match.id);
    setBusy(false);
    if (error) return alert(error.message);
    if (forceStatus) setStatus(forceStatus);
    onSaved();
  }

  async function addGoal(form: HTMLFormElement) {
    const fd = new FormData(form);
    const country_id = fd.get("country_id") as string;
    const player_name = (fd.get("player_name") as string) || null;
    const minute = parseInt(fd.get("minute") as string) || null;
    if (!country_id) return;
    // sumar al marcador
    const isHome = country_id === match.home_country;
    const { error } = await supabase.from("goals").insert({ match_id: match.id, country_id, player_name, minute });
    if (error) return alert(error.message);
    if (isHome) setHome(h => h + 1); else setAway(a => a + 1);
    await supabase.from("matches").update({
      home_score: isHome ? home + 1 : home,
      away_score: isHome ? away : away + 1,
      status: "live"
    }).eq("id", match.id);
    setStatus("live");
    form.reset();
    loadGoals();
    onSaved();
  }

  return (
    <div className={`card p-3 border ${statusBorder} transition-colors`}>
      {/* Cabecera: tags */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {!compact && groupLabel && <span className="text-xs bg-slate-800 px-2 py-0.5 rounded font-bold">Grupo {groupLabel}</span>}
        {status === "live" && <span className="text-xs bg-emerald-700 text-white px-2 py-0.5 rounded animate-pulse">EN VIVO</span>}
        {status === "finished" && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">FINAL</span>}
        {status === "walkover" && <span className="text-xs bg-amber-700 text-amber-100 px-2 py-0.5 rounded">W.O.</span>}
      </div>

      {/* Equipos + score (siempre visibles, layout en grid) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
        <Side country={homeCountry} team={homeTeam} />
        <div className="flex items-center gap-1">
          <input type="number" min={0} value={home} onChange={e => setHome(parseInt(e.target.value) || 0)}
            className="w-12 bg-slate-950 border border-slate-700 rounded p-1 text-center font-bold text-lg" disabled={!playable} />
          <span className="text-slate-500">-</span>
          <input type="number" min={0} value={away} onChange={e => setAway(parseInt(e.target.value) || 0)}
            className="w-12 bg-slate-950 border border-slate-700 rounded p-1 text-center font-bold text-lg" disabled={!playable} />
        </div>
        <Side country={awayCountry} team={awayTeam} reverse />
      </div>

      {/* Controles abajo */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <select value={status} onChange={e => setStatus(e.target.value as MatchStatus)} className="bg-slate-950 border border-slate-700 rounded p-1">
          <option value="scheduled">Programado</option>
          <option value="live">En vivo</option>
          <option value="finished">Finalizado</option>
          <option value="walkover">Walkover</option>
        </select>
        <button onClick={() => save()} disabled={busy || !playable} className="btn-ghost">
          <Save size={14} /> Guardar
        </button>
        {playable && status !== "finished" && (
          <button onClick={() => save("finished")} disabled={busy} className="btn-primary" title="Marca el partido como finalizado y suma los puntos a la tabla">
            ✅ Finalizar
          </button>
        )}
        {playable && (
          <button onClick={() => setShowGoals(s => !s)} className="btn-ghost">
            ⚽ Goles
          </button>
        )}
      </div>
      {showGoals && playable && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
          <ul className="text-sm space-y-1">
            {goals.map(g => (
              <li key={g.id} className="flex items-center gap-2">
                <span>{g.minute ? `${g.minute}'` : ""}</span>
                <img src={countryById[g.country_id]?.flag_url ?? ""} className="w-4 h-3 object-cover" alt="" />
                <span className="flex-1">{g.player_name ?? "—"}</span>
                <button onClick={async () => {
                  await supabase.from("goals").delete().eq("id", g.id);
                  loadGoals();
                }} className="text-red-400 text-xs">Eliminar</button>
              </li>
            ))}
            {goals.length === 0 && <li className="text-slate-500">Sin goles registrados</li>}
          </ul>
          <form onSubmit={e => { e.preventDefault(); addGoal(e.currentTarget); }} className="flex gap-1 flex-wrap text-sm">
            <select name="country_id" required className="bg-slate-950 border border-slate-700 rounded p-1">
              <option value="">Equipo...</option>
              <option value={match.home_country!}>{homeCountry?.name}</option>
              <option value={match.away_country!}>{awayCountry?.name}</option>
            </select>
            <input name="player_name" placeholder="Goleador (opcional)" className="bg-slate-950 border border-slate-700 rounded p-1 flex-1" />
            <input name="minute" type="number" min={1} placeholder="Min" className="w-16 bg-slate-950 border border-slate-700 rounded p-1" />
            <button type="submit" className="btn-primary text-sm"><Plus size={14} /> Gol</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Side({ country, team, reverse }: { country: Country | null; team?: Team | null; reverse?: boolean }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${reverse ? "flex-row-reverse text-right" : ""}`}>
      {country?.flag_url && <img src={country.flag_url} alt="" className="w-5 h-3 object-cover shrink-0" />}
      <div className="min-w-0">
        <div className="truncate font-medium">{country?.name ?? "TBD"}</div>
        {team && <div className="text-[10px] text-slate-400 truncate">🤖 {team.name}</div>}
      </div>
    </div>
  );
}
