import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto card p-8">
      <h1 className="text-2xl font-bold mb-1">Acceso Admin / Juez</h1>
      <p className="text-slate-400 text-sm mb-6">Inicia sesión con tu correo registrado en Supabase.</p>
      <LoginForm />
    </div>
  );
}
