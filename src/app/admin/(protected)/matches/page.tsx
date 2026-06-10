import { createClient } from "@/lib/supabase/server";
import MatchesManager from "./MatchesManager";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const supabase = createClient();
  const [{ data: tournaments }, { data: matches }, { data: countries }, { data: groups }, { data: teams }, { data: entries }] = await Promise.all([
    supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
    supabase.from("matches").select("*").order("stage").order("round_index"),
    supabase.from("countries").select("*"),
    supabase.from("groups").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("tournament_entries").select("*")
  ]);

  return (
    <MatchesManager
      tournaments={tournaments ?? []}
      initialMatches={matches ?? []}
      countries={countries ?? []}
      groups={groups ?? []}
      teams={teams ?? []}
      entries={entries ?? []}
    />
  );
}
