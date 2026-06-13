-- ============================================================
-- ACTIVAR SUPABASE REALTIME para matches y goals
-- Esto permite que cuando un admin guarda un marcador,
-- los demas dispositivos vean el cambio sin recargar.
-- Idempotente: si ya estaba activado, no hace nada.
-- ============================================================

do $$
begin
  -- matches
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    execute 'alter publication supabase_realtime add table public.matches';
  end if;

  -- goals
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goals'
  ) then
    execute 'alter publication supabase_realtime add table public.goals';
  end if;
end $$;

-- Asegurar REPLICA IDENTITY FULL para que el payload incluya los valores viejos
alter table matches replica identity full;
alter table goals replica identity full;

-- Verificar
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
