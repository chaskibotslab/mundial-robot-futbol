"use client";
import type { Country, Match, MatchStage } from "@/lib/types";

const STAGE_LABEL: Record<MatchStage, string> = {
  group: "Grupos",
  r32: "32avos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinales",
  third: "Tercer Puesto",
  final: "Final"
};
const ORDER: MatchStage[] = ["r32", "r16", "qf", "sf", "third", "final"];

export default function BracketView({ matches, countries, teamByCountry = {} }: { matches: Match[]; countries: Record<string, Country>; teamByCountry?: Record<string, string> }) {
  const stages = ORDER.filter(st => matches.some(m => m.stage === st));

  if (stages.length === 0) {
    return <div className="card p-8 text-center text-slate-400">El bracket se generará al terminar la fase de grupos.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max pb-4">
        {stages.map(stage => {
          const list = matches.filter(m => m.stage === stage).sort((a, b) => (a.round_index ?? 0) - (b.round_index ?? 0));
          return (
            <div key={stage} className="flex flex-col gap-3 min-w-[220px]">
              <h4 className="text-sm uppercase tracking-wider text-brand font-semibold">{STAGE_LABEL[stage]}</h4>
              {list.map(m => <BracketMatch key={m.id} match={m} countries={countries} teamByCountry={teamByCountry} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatch({ match, countries, teamByCountry }: { match: Match; countries: Record<string, Country>; teamByCountry: Record<string, string> }) {
  const isLive = match.status === "live";
  const isDone = match.status === "finished" || match.status === "walkover";
  const home = match.home_country ? countries[match.home_country] : null;
  const away = match.away_country ? countries[match.away_country] : null;
  return (
    <div className={`card p-3 text-sm ${isLive ? "border-red-500" : ""}`}>
      <Side country={home} team={home ? teamByCountry[home.id] : undefined} score={match.home_score} bold={isDone} />
      <Side country={away} team={away ? teamByCountry[away.id] : undefined} score={match.away_score} bold={isDone} />
      {isLive && <div className="text-xs text-red-400 mt-1 animate-pulse">EN VIVO</div>}
    </div>
  );
}

function Side({ country, team, score, bold }: { country: Country | null; team?: string; score: number; bold: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2 mt-1">
      <span className="flex items-center gap-2 min-w-0 flex-1">
        {country?.flag_url && <img src={country.flag_url} alt="" className="w-5 h-3 object-cover rounded-sm shrink-0" />}
        <span className="min-w-0">
          <span className="block truncate">{country?.name ?? "TBD"}</span>
          {team && <span className="block text-[10px] text-slate-500 truncate">🤖 {team}</span>}
        </span>
      </span>
      <span className={bold ? "font-bold" : "text-slate-500"}>{score}</span>
    </div>
  );
}
