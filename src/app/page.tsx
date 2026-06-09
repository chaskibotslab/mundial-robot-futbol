import Link from "next/link";
import { Bot, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="text-center py-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Mundial de <span className="text-brand">Robot Fútbol</span>
        </h1>
        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
          Sigue en tiempo real la fase de grupos, el cuadro eliminatorio y los goleadores
          de cada categoría. Resultados actualizados al instante.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <Link href="/pro" className="card p-8 hover:border-brand transition">
          <Bot size={36} className="text-brand mb-3" />
          <h2 className="text-2xl font-bold">Categoría Pro</h2>
          <p className="text-slate-400 mt-2">Robots avanzados. Máxima competencia.</p>
        </Link>
        <Link href="/amateur" className="card p-8 hover:border-brand transition">
          <Users size={36} className="text-brand mb-3" />
          <h2 className="text-2xl font-bold">Categoría Amateur</h2>
          <p className="text-slate-400 mt-2">Equipos en formación. Pura emoción.</p>
        </Link>
      </section>
    </div>
  );
}
