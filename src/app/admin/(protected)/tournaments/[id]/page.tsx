import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TournamentManager from "./TournamentManager";

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: tournament } = await supabase
    .from("tournaments").select("*").eq("id", params.id).maybeSingle();
  if (!tournament) notFound();

  const [{ data: countries }, { data: teams }, { data: entries }, { data: groups }, { data: slots }, { data: matches }] = await Promise.all([
    supabase.from("countries").select("*").order("name"),
    supabase.from("teams").select("*").eq("category", tournament.category).order("name"),
    supabase.from("tournament_entries").select("*").eq("tournament_id", params.id),
    supabase.from("groups").select("*").eq("tournament_id", params.id).order("letter"),
    supabase.from("group_slots").select("*"),
    supabase.from("matches").select("*").eq("tournament_id", params.id)
  ]);

  return (
    <TournamentManager
      tournament={tournament}
      countries={countries ?? []}
      teams={teams ?? []}
      entries={entries ?? []}
      groups={groups ?? []}
      slots={slots ?? []}
      matches={matches ?? []}
    />
  );
}
