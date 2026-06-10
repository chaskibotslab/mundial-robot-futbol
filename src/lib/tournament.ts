/**
 * Logica de generacion del torneo:
 *  - drawGroups: sortea paises en grupos
 *  - generateGroupMatches: round-robin por grupo
 *  - generateBracket: crea partidos eliminatorios encadenados (feeds_*)
 *
 * Nota: Esta logica devuelve "borradores" (objetos sin id) listos para
 * insertar en Supabase. La asignacion de IDs y el linkeo definitivo se hace
 * en src/app/admin/.../actions.ts donde tenemos acceso a la DB.
 */

import { FORMAT_CONFIG, type MatchStage, type TournamentFormat } from "./types";
import { shuffle, groupLetter } from "./utils";

export interface DrawInputCountry {
  countryId: string;
  pot?: 1 | 2 | 3 | 4; // bombo opcional. Si no se da, sortea aleatorio.
  /** ID del equipo (robot) al que pertenece. Si dos paises del mismo equipo se sortean,
   *  intentamos que NO caigan en el mismo grupo. */
  teamId?: string | null;
}

export interface DrawnGroup {
  letter: string;
  countries: string[]; // ids en orden de bombo
}

export function drawGroups(
  countries: DrawInputCountry[],
  format: TournamentFormat
): DrawnGroup[] {
  const cfg = FORMAT_CONFIG[format];
  if (countries.length !== cfg.teams) {
    throw new Error(
      `Se requieren exactamente ${cfg.teams} paises para formato ${format}, recibidos ${countries.length}.`
    );
  }

  const teamOf: Record<string, string | null> = {};
  countries.forEach(c => { teamOf[c.countryId] = c.teamId ?? null; });

  // Intentamos varias veces buscar un sorteo donde ningun grupo tenga 2 paises del mismo equipo.
  const MAX_ATTEMPTS = 200;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const groups = tryDraw(countries, cfg);
    const ok = groups.every(g => {
      const teamsInGroup = g.countries.map(cid => teamOf[cid]).filter(Boolean);
      return new Set(teamsInGroup).size === teamsInGroup.length;
    });
    if (ok) return groups;
  }
  // Si no se logra (muchos paises del mismo equipo), devolvemos el ultimo intento.
  return tryDraw(countries, cfg);
}

function tryDraw(countries: DrawInputCountry[], cfg: typeof FORMAT_CONFIG[TournamentFormat]): DrawnGroup[] {
  const shuffled = shuffle(countries.map(c => c.countryId));
  const pots: string[][] = [];
  for (let p = 0; p < cfg.perGroup; p++) {
    pots.push(shuffled.slice(p * cfg.groups, (p + 1) * cfg.groups));
  }
  const groups: DrawnGroup[] = Array.from({ length: cfg.groups }, (_, i) => ({
    letter: groupLetter(i),
    countries: []
  }));
  for (let p = 0; p < cfg.perGroup; p++) {
    const pot = pots[p];
    for (let g = 0; g < cfg.groups; g++) {
      groups[g].countries.push(pot[g]);
    }
  }
  return groups;
}

export interface DraftMatch {
  stage: MatchStage;
  group_letter?: string;
  round_index: number;
  bracket_slot?: number;
  home_country_id: string | null;
  away_country_id: string | null;
  feeds_winner_slot_index?: number;
  feeds_winner_side?: "home" | "away";
  feeds_loser_slot_index?: number;
  feeds_loser_side?: "home" | "away";
}

/** Round-robin: soporta grupos de 3 o 4 equipos. */
export function generateGroupMatches(group: DrawnGroup): DraftMatch[] {
  const cs = group.countries;
  let fixtures: [string, string][][] = [];
  if (cs.length === 4) {
    const [a, b, c, d] = cs;
    // J1: A-B, C-D | J2: A-C, B-D | J3: A-D, B-C
    fixtures = [
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]]
    ];
  } else if (cs.length === 3) {
    const [a, b, c] = cs;
    fixtures = [[[a, b]], [[a, c]], [[b, c]]];
  } else {
    // round-robin generico (1 partido por jornada)
    const all: [string, string][] = [];
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        all.push([cs[i], cs[j]]);
      }
    }
    fixtures = all.map(p => [p]);
  }
  const matches: DraftMatch[] = [];
  fixtures.forEach((round, ri) => {
    round.forEach(([h, aw]) => {
      matches.push({
        stage: "group",
        group_letter: group.letter,
        round_index: ri,
        home_country_id: h,
        away_country_id: aw
      });
    });
  });
  return matches;
}

/**
 * Genera el bracket eliminatorio para un formato dado.
 * Devuelve los "matches" en orden topologico, indexados por bracket_slot.
 * Los partidos se llenaran con paises despues de la fase de grupos.
 */
export function generateBracket(format: TournamentFormat): DraftMatch[] {
  const cfg = FORMAT_CONFIG[format];
  const matches: DraftMatch[] = [];

  const stages: { stage: MatchStage; size: number }[] = [];
  if (cfg.knockoutStart === "r32") stages.push({ stage: "r32", size: 16 });
  if (["r32", "r16"].includes(cfg.knockoutStart)) stages.push({ stage: "r16", size: 8 });
  stages.push({ stage: "qf", size: 4 });
  stages.push({ stage: "sf", size: 2 });
  stages.push({ stage: "third", size: 1 });
  stages.push({ stage: "final", size: 1 });

  // Index global por slot
  let slot = 0;
  const stageOffsets: Record<string, number> = {};
  for (const s of stages) {
    stageOffsets[s.stage] = slot;
    for (let i = 0; i < s.size; i++) {
      matches.push({
        stage: s.stage,
        round_index: i,
        bracket_slot: slot,
        home_country_id: null,
        away_country_id: null
      });
      slot++;
    }
  }

  // Cablear feeds (ganador del partido i en stage X -> partido floor(i/2) de stage Y)
  for (let i = 0; i < stages.length - 2; i++) {
    const cur = stages[i];
    const next = stages[i + 1].stage === "third" ? stages[i + 2] : stages[i + 1];
    const off = stageOffsets[cur.stage];
    const nextOff = stageOffsets[next.stage];
    for (let k = 0; k < cur.size; k++) {
      const target = nextOff + Math.floor(k / 2);
      matches[off + k].feeds_winner_slot_index = target;
      matches[off + k].feeds_winner_side = k % 2 === 0 ? "home" : "away";
    }
  }
  // Semis -> Final + Tercer puesto
  const sfOff = stageOffsets["sf"];
  const finalOff = stageOffsets["final"];
  const thirdOff = stageOffsets["third"];
  for (let k = 0; k < 2; k++) {
    matches[sfOff + k].feeds_winner_slot_index = finalOff;
    matches[sfOff + k].feeds_winner_side = k === 0 ? "home" : "away";
    matches[sfOff + k].feeds_loser_slot_index = thirdOff;
    matches[sfOff + k].feeds_loser_side = k === 0 ? "home" : "away";
  }

  return matches;
}
