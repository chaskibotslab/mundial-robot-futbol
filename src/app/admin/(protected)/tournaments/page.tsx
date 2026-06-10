import { createClient } from "@/lib/supabase/server";
import TournamentsManager from "./TournamentsManager";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const supabase = createClient();
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  return <TournamentsManager initialTournaments={tournaments ?? []} />;
}
