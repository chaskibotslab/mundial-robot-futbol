import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import TournamentLive from "./TournamentLive";

export const revalidate = 0;

export default async function CategoryPage({
  params
}: {
  params: { category: string };
}) {
  const cat = params.category as Category;
  if (cat !== "pro" && cat !== "amateur") notFound();

  const supabase = createClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("category", cat)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return (
      <div className="card p-10 text-center">
        <h2 className="text-2xl font-bold mb-2">Sin torneo activo</h2>
        <p className="text-slate-400">
          Aún no se ha creado el torneo de la categoría {cat.toUpperCase()}.
          Vuelve pronto.
        </p>
      </div>
    );
  }

  return <TournamentLive tournamentId={tournament.id} name={tournament.name} status={tournament.status} format={tournament.format} />;
}
