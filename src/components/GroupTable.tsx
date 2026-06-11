"use client";
import type { Match, Standing } from "@/lib/types";

interface Props {
  standings: Standing[];
  matches: Match[];
  teamByCountry?: Record<string, string>;
}

export default function GroupTable({ standings, matches, teamByCountry = {} }: Props) {
  const groups = Array.from(new Set(standings.map(s => s.group_letter))).sort();
  const sortFn = (a: Standing, b: Standing) =>
    b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.country_name.localeCompare(b.country_name);

  if (standings.length === 0) {
    return <div className="card p-8 text-center text-slate-400">No hay partidos registrados aún.</div>;
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {groups.map(letter => {
        const rows = standings.filter(s => s.group_letter === letter).sort(sortFn);
        return (
          <div key={letter} className="card p-4">
            <h3 className="font-bold text-lg mb-3">Grupo {letter}</h3>
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">#</th>
                  <th className="text-left">País</th>
                  <th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
                  <th>GF</th><th>GC</th><th>DG</th>
                  <th className="text-brand">PTS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.country_id} className="border-t border-slate-800">
                    <td className="py-1.5 text-slate-500">{i + 1}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        {r.flag_url && <img src={r.flag_url} alt="" className="w-5 h-3 object-cover rounded-sm" />}
                        <div className="leading-tight">
                          <div>{r.country_name}</div>
                          {teamByCountry[r.country_id] && (
                            <div className="text-[10px] text-slate-400">🤖 {teamByCountry[r.country_id]}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-center">{r.pj}</td>
                    <td className="text-center">{r.pg}</td>
                    <td className="text-center">{r.pe}</td>
                    <td className="text-center">{r.pp}</td>
                    <td className="text-center">{r.gf}</td>
                    <td className="text-center">{r.gc}</td>
                    <td className="text-center">{r.dg}</td>
                    <td className="text-center font-bold text-brand">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
