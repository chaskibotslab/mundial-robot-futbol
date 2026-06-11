"use client";
import type { Country, Match, MatchStage } from "@/lib/types";
import { Trophy } from "lucide-react";

const STAGE_ORDER_LEFT: MatchStage[] = ["r32", "r16", "qf", "sf"];

interface Props {
  matches: Match[];
  countries: Record<string, Country>;
  teamByCountry?: Record<string, string>;
}

/**
 * Bracket simetrico estilo Mundial.
 * - Lado izquierdo: stages exteriores -> interiores
 * - Centro: Final + Tercer Puesto + trofeo
 * - Lado derecho: simetrico (interiores -> exteriores)
 */
export default function BracketTV({ matches, countries, teamByCountry = {} }: Props) {
  const stagesPresent = STAGE_ORDER_LEFT.filter(s => matches.some(m => m.stage === s));
  const final = matches.find(m => m.stage === "final");
  const third = matches.find(m => m.stage === "third");

  if (stagesPresent.length === 0 && !final) {
    return <div className="card p-8 text-center text-slate-400">El bracket se generará al terminar la fase de grupos.</div>;
  }

  // Para cada stage, partimos los partidos en mitad izquierda y derecha por bracket_slot
  function splitStage(stage: MatchStage) {
    const list = matches.filter(m => m.stage === stage)
      .sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0));
    const half = Math.ceil(list.length / 2);
    return { left: list.slice(0, half), right: list.slice(half) };
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
        {/* Lado izquierdo: stages outermost -> innermost */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${stagesPresent.length}, minmax(150px, 1fr))` }}>
          {stagesPresent.map(stage => {
            const { left } = splitStage(stage);
            return <StageColumn key={`L-${stage}`} stage={stage} matches={left} countries={countries} teamByCountry={teamByCountry} side="left" />;
          })}
        </div>

        {/* Centro: Final + Trofeo + Tercer puesto */}
        <CenterBlock final={final} third={third} countries={countries} teamByCountry={teamByCountry} />

        {/* Lado derecho: stages innermost -> outermost */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${stagesPresent.length}, minmax(150px, 1fr))` }}>
          {[...stagesPresent].reverse().map(stage => {
            const { right } = splitStage(stage);
            return <StageColumn key={`R-${stage}`} stage={stage} matches={right} countries={countries} teamByCountry={teamByCountry} side="right" />;
          })}
        </div>
      </div>
    </div>
  );
}

function StageColumn({
  stage, matches, countries, teamByCountry, side
}: { stage: MatchStage; matches: Match[]; countries: Record<string, Country>; teamByCountry: Record<string, string>; side: "left" | "right" }) {
  const label: Record<MatchStage, string> = {
    group: "Grupos", r32: "32avos", r16: "Octavos", qf: "Cuartos", sf: "Semis", third: "3ro", final: "Final"
  };
  return (
    <div className="flex flex-col h-full justify-around gap-2 px-1">
      <div className={`text-xs uppercase tracking-wider text-brand font-semibold mb-1 ${side === "right" ? "text-right" : ""}`}>
        {label[stage]}
      </div>
      {matches.map(m => <BracketCard key={m.id} match={m} countries={countries} teamByCountry={teamByCountry} side={side} />)}
    </div>
  );
}

function CenterBlock({
  final, third, countries, teamByCountry
}: { final?: Match; third?: Match; countries: Record<string, Country>; teamByCountry: Record<string, string> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-2 min-w-[200px]">
      <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">Final</div>
      {final
        ? <BracketCard match={final} countries={countries} teamByCountry={teamByCountry} side="center" highlight />
        : <PlaceholderCard />}
      <Trophy className="text-amber-400" size={56} />
      {third && (
        <>
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mt-2">Tercer Puesto</div>
          <BracketCard match={third} countries={countries} teamByCountry={teamByCountry} side="center" />
        </>
      )}
    </div>
  );
}

function BracketCard({
  match, countries, teamByCountry, side, highlight
}: { match: Match; countries: Record<string, Country>; teamByCountry: Record<string, string>; side: "left" | "right" | "center"; highlight?: boolean }) {
  const home = match.home_country ? countries[match.home_country] : null;
  const away = match.away_country ? countries[match.away_country] : null;
  const isLive = match.status === "live";
  const isDone = match.status === "finished" || match.status === "walkover";
  const homeWin = isDone && match.home_score > match.away_score;
  const awayWin = isDone && match.away_score > match.home_score;

  return (
    <div className={`rounded-lg border bg-slate-900/80 backdrop-blur p-2 text-xs shadow
      ${isLive ? "border-red-500 animate-pulse" : "border-slate-700"}
      ${highlight ? "border-amber-400 shadow-amber-500/20 shadow-lg p-3 text-sm" : ""}`}>
      <Row country={home} team={home ? teamByCountry[home.id] : undefined} score={match.home_score} winner={homeWin} done={isDone} reverse={side === "right"} />
      <Row country={away} team={away ? teamByCountry[away.id] : undefined} score={match.away_score} winner={awayWin} done={isDone} reverse={side === "right"} />
      {isLive && <div className="text-[10px] text-red-400 text-center mt-1">EN VIVO</div>}
    </div>
  );
}

function Row({
  country, team, score, winner, done, reverse
}: { country: Country | null; team?: string; score: number; winner: boolean; done: boolean; reverse?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""}`}>
      {country?.flag_url
        ? <img src={country.flag_url} alt="" className="w-5 h-3 object-cover rounded-sm shrink-0" />
        : <div className="w-5 h-3 bg-slate-700 rounded-sm shrink-0" />}
      <div className={`flex-1 min-w-0 ${reverse ? "text-right" : ""}`}>
        <div className={`truncate ${winner ? "font-bold text-brand" : done ? "text-slate-400" : ""}`}>
          {country?.name ?? "TBD"}
        </div>
        {team && <div className="text-[9px] text-slate-500 truncate">🤖 {team}</div>}
      </div>
      <span className={`tabular-nums w-5 text-center ${winner ? "font-bold" : "text-slate-500"}`}>
        {done || country ? score : ""}
      </span>
    </div>
  );
}

function PlaceholderCard() {
  return (
    <div className="rounded-lg border border-amber-400/40 bg-slate-900/60 p-3 text-sm text-slate-500">
      <div>TBD</div>
      <div>TBD</div>
    </div>
  );
}
