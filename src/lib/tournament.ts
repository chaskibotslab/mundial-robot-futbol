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
}

export interface DrawnGroup {
  letter: string;
  countries: string[]; // 4 ids en orden de bombo (1..4)
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

  // Si no hay bombos, los inferimos por orden recibido (4 bombos del mismo tamaño).
  const hasPots = countries.every(c => c.pot);
  let pots: string[][];
  if (hasPots) {
    pots = [1, 2, 3, 4].map(p =>
      shuffle(countries.filter(c => c.pot === p).map(c => c.countryId))
    );
  } else {
    const shuffled = shuffle(countries.map(c => c.countryId));
    const size = cfg.groups;
    pots = [
      shuffled.slice(0, size),
      shuffled.slice(size, size * 2),
      shuffled.slice(size * 2, size * 3),
      shuffled.slice(size * 3, size * 4)
    ];
  }

  const groups: DrawnGroup[] = Array.from({ length: cfg.groups }, (_, i) => ({
    letter: groupLetter(i),
    countries: []
  }));

  for (let p = 0; p < 4; p++) {
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

/** Round-robin clasico de 4 equipos: 6 partidos, 3 jornadas. */
export function generateGroupMatches(group: DrawnGroup): DraftMatch[] {
  const [a, b, c, d] = group.countries;
  // Jornada 1: A-B, C-D | J2: A-C, B-D | J3: A-D, B-C
  const fixtures: [string, string][][] = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]]
  ];
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
