import { createClient } from "@/lib/supabase/server";
import TeamsManager from "./TeamsManager";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const supabase = createClient();
  const { data: teams } = await supabase
    .from("teams").select("*").order("category").order("name");
  return <TeamsManager initialTeams={teams ?? []} />;
}
