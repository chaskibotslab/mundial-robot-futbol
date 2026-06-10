"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs uppercase text-slate-400">Email</label>
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 mt-1"
          placeholder="tu@correo.com"
        />
      </div>
      <div>
        <label className="text-xs uppercase text-slate-400">Contraseña</label>
        <input
          type="password" required value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 mt-1"
        />
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
