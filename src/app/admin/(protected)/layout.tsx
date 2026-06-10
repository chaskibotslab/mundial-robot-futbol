import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LayoutDashboard, Users, Trophy, Calendar, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Si no hay sesion redirigir al login (excepto si ya estamos en /admin/login)
  if (!user) {
    redirect("/admin/login");
  }

  // Verificar rol
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "judge")) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-2">Sin permisos</h2>
        <p className="text-slate-400">Tu cuenta ({profile?.email}) no tiene rol de admin o juez.</p>
        <p className="text-slate-500 text-sm mt-4">Pídele al admin que ejecute en SQL:</p>
        <code className="block bg-slate-950 p-2 rounded mt-2 text-xs">
          update profiles set role = &apos;admin&apos; where email = &apos;{profile?.email}&apos;;
        </code>
        <form action="/admin/logout" method="post" className="mt-4">
          <button className="btn-ghost">Cerrar sesión</button>
        </form>
      </div>
    );
  }

  const isAdmin = profile.role === "admin";

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <aside className="card p-4 h-fit sticky top-20">
        <div className="text-xs uppercase text-slate-500 mb-2">Admin</div>
        <p className="text-sm truncate mb-4">{profile.full_name || profile.email}</p>
        <nav className="flex flex-col gap-1 text-sm">
          <NavLink href="/admin" icon={<LayoutDashboard size={16} />}>Dashboard</NavLink>
          {isAdmin && <NavLink href="/admin/teams" icon={<Users size={16} />}>Equipos</NavLink>}
          {isAdmin && <NavLink href="/admin/tournaments" icon={<Trophy size={16} />}>Torneos</NavLink>}
          <NavLink href="/admin/matches" icon={<Calendar size={16} />}>Partidos</NavLink>
        </nav>
        <form action="/admin/logout" method="post" className="mt-4 pt-4 border-t border-slate-800">
          <button className="btn-ghost w-full text-sm flex items-center justify-center gap-2">
            <LogOut size={14} /> Salir
          </button>
        </form>
      </aside>
      <section>{children}</section>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 transition">
      {icon} {children}
    </Link>
  );
}
