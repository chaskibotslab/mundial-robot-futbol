"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import GroupTable from "@/components/GroupTable";
import BracketView from "@/components/BracketView";
import BracketTV from "@/components/BracketTV";
import type { Country, Match, Standing, Team, TournamentEntry, TournamentFormat } from "@/lib/types";

interface Props {
  tournamentId: string;
  name: string;
  status: string;
  format: TournamentFormat;
}

export default function TournamentLive({ tournamentId, name, status, format }: Props) {
  const supabase = createClient();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [countries, setCountries] = useState<Record<string, Country>>({});
  const [teamByCountry, setTeamByCountry] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"groups" | "bracket">(status === "knockout" || status === "finished" ? "bracket" : "groups");
  const [bracketMode, setBracketMode] = useState<"tv" | "list">("tv");

  const refresh = useCallback(async () => {
    const [{ data: st }, { data: ms }, { data: cs }, { data: entries }, { data: teams }] = await Promise.all([
      supabase.from("v_group_standings").select("*").eq("tournament_id", tournamentId),
      supabase.from("matches").select("*").eq("tournament_id", tournamentId).order("round_index"),
      supabase.from("countries").select("*"),
      supabase.from("tournament_entries").select("*").eq("tournament_id", tournamentId),
      supabase.from("teams").select("*"),
    ]);
    setStandings((st as Standing[]) ?? []);
    setMatches((ms as Match[]) ?? []);
    const map: Record<string, Country> = {};
    ((cs as Country[]) ?? []).forEach(c => { map[c.id] = c; });
    setCountries(map);
    // country_id -> team_name (solo entries de ESTE torneo)
    const teamMap: Record<string, Team> = {};
    ((teams as Team[]) ?? []).forEach(t => { teamMap[t.id] = t; });
    const tbc: Record<string, string> = {};
    ((entries as TournamentEntry[]) ?? []).forEach(e => {
      if (e.country_id && e.team_id && teamMap[e.team_id]) tbc[e.country_id] = teamMap[e.team_id].name;
    });
    setTeamByCountry(tbc);
  }, [supabase, tournamentId]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals" },
        () => refresh()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, tournamentId, refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{name}</h1>
          <p className="text-slate-400 text-sm uppercase tracking-wider">
            Estado: {status} · Formato: {format.replace("t", "")} equipos
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("groups")} className={tab === "groups" ? "btn-primary" : "btn-ghost"}>Grupos</button>
          <button onClick={() => setTab("bracket")} className={tab === "bracket" ? "btn-primary" : "btn-ghost"}>Eliminatorias</button>
        </div>
      </div>

      {tab === "groups" ? (
        <GroupTable standings={standings} matches={matches.filter(m => m.stage === "group")} teamByCountry={teamByCountry} />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end gap-2 text-xs">
            <button onClick={() => setBracketMode("tv")} className={bracketMode === "tv" ? "btn-primary text-xs px-3 py-1" : "btn-ghost text-xs px-3 py-1"}>Vista Mundial</button>
            <button onClick={() => setBracketMode("list")} className={bracketMode === "list" ? "btn-primary text-xs px-3 py-1" : "btn-ghost text-xs px-3 py-1"}>Vista Lista</button>
          </div>
          {bracketMode === "tv"
            ? <BracketTV matches={matches.filter(m => m.stage !== "group")} countries={countries} teamByCountry={teamByCountry} />
            : <BracketView matches={matches.filter(m => m.stage !== "group")} countries={countries} teamByCountry={teamByCountry} />}
        </div>
      )}
    </div>
  );
}
