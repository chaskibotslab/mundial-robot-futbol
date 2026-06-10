export type Category = "pro" | "amateur";
export type TournamentFormat = "t8" | "t12" | "t16" | "t24" | "t32" | "t48";
export type TournamentStatus = "draft" | "groups" | "knockout" | "finished";
export type MatchStage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";
export type MatchStatus = "scheduled" | "live" | "finished" | "walkover";

export interface Country {
  id: string;
  name: string;
  fifa_code: string | null;
  flag_url: string | null;
}

export interface Team {
  id: string;
  name: string;
  category: Category;
  logo_url: string | null;
}

/** Inscripcion de un team a un torneo, con (opcionalmente) un pais asignado.
 *  Un team puede tener varias entries en el mismo torneo (multi-pais). */
export interface TournamentEntry {
  id: string;
  tournament_id: string;
  team_id: string;
  country_id: string | null;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  category: Category;
  format: TournamentFormat;
  status: TournamentStatus;
  starts_at: string | null;
}

export interface Group {
  id: string;
  tournament_id: string;
  letter: string;
}

export interface GroupSlot {
  id: string;
  group_id: string;
  country_id: string;
  team_id: string | null;
  position: number;
}

export interface Match {
  id: string;
  tournament_id: string;
  stage: MatchStage;
  group_id: string | null;
  round_index: number | null;
  bracket_slot: number | null;
  home_country: string | null;
  away_country: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number;
  away_score: number;
  home_pen: number | null;
  away_pen: number | null;
  status: MatchStatus;
  scheduled_at: string | null;
  venue: string | null;
  feeds_winner_match: string | null;
  feeds_loser_match: string | null;
  feeds_winner_slot: "home" | "away" | null;
  feeds_loser_slot: "home" | "away" | null;
}

export interface Standing {
  tournament_id: string;
  group_id: string;
  group_letter: string;
  country_id: string;
  country_name: string;
  flag_url: string | null;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

export const FORMAT_CONFIG: Record<TournamentFormat, {
  teams: number;
  groups: number;
  perGroup: number;
  qualifyPerGroup: number;
  bestThirds: number;
  knockoutStart: MatchStage;
}> = {
  t8:  { teams: 8,  groups: 2, perGroup: 4, qualifyPerGroup: 2, bestThirds: 0, knockoutStart: "qf" },
  t12: { teams: 12, groups: 4, perGroup: 3, qualifyPerGroup: 2, bestThirds: 0, knockoutStart: "qf" },
  t16: { teams: 16, groups: 4, perGroup: 4, qualifyPerGroup: 2, bestThirds: 0, knockoutStart: "qf" },
  t24: { teams: 24, groups: 6, perGroup: 4, qualifyPerGroup: 2, bestThirds: 4, knockoutStart: "r16" },
  t32: { teams: 32, groups: 8, perGroup: 4, qualifyPerGroup: 2, bestThirds: 0, knockoutStart: "r16" },
  t48: { teams: 48, groups: 12, perGroup: 4, qualifyPerGroup: 2, bestThirds: 8, knockoutStart: "r32" }
};
