-- =============================================================
-- MUNDIAL ROBOT FUTBOL - Esquema Supabase
-- Ejecutar en SQL Editor del proyecto Supabase
-- =============================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- ENUMS
do $$ begin
  create type category_kind as enum ('pro', 'amateur');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tournament_format as enum ('t16','t24','t32','t48');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tournament_status as enum ('draft','groups','knockout','finished');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_stage as enum ('group','r32','r16','qf','sf','third','final');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('scheduled','live','finished','walkover');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin','judge','viewer');
exception when duplicate_object then null; end $$;

-- =============================================================
-- USUARIOS / ROLES
-- =============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role user_role not null default 'viewer',
  created_at timestamptz default now()
);

-- Trigger para crear profile al registrarse
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================================
-- CATALOGOS
-- =============================================================
create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fifa_code text unique,
  flag_url text
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category category_kind not null,
  logo_url text,
  contact_email text,
  notes text,
  created_at timestamptz default now(),
  unique (name, category)
);

-- Un equipo puede representar 1..N paises
create table if not exists team_countries (
  team_id uuid references teams(id) on delete cascade,
  country_id uuid references countries(id) on delete cascade,
  primary key (team_id, country_id)
);

-- =============================================================
-- TORNEOS
-- =============================================================
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category category_kind not null,
  format tournament_format not null,
  status tournament_status not null default 'draft',
  starts_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  letter text not null,
  unique (tournament_id, letter)
);

-- Cupo dentro del grupo. country_id puede repetirse en otros torneos pero
-- es unico por torneo (un pais juega una sola vez en el torneo)
create table if not exists group_slots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  country_id uuid not null references countries(id) on delete restrict,
  team_id uuid references teams(id) on delete set null,
  position int not null check (position between 1 and 4),
  unique (group_id, position)
);

create unique index if not exists ux_group_slots_country
  on group_slots(group_id, country_id);

-- =============================================================
-- PARTIDOS
-- =============================================================
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  stage match_stage not null,
  group_id uuid references groups(id) on delete set null,
  round_index int,           -- orden dentro de la etapa (0..n)
  bracket_slot int,          -- slot en el bracket eliminatorio
  home_country uuid references countries(id),
  away_country uuid references countries(id),
  home_team uuid references teams(id),
  away_team uuid references teams(id),
  home_score int default 0,
  away_score int default 0,
  home_pen int,
  away_pen int,
  status match_status not null default 'scheduled',
  scheduled_at timestamptz,
  venue text,
  judge_id uuid references profiles(id),
  -- alimenta a estos partidos cuando este se cierre
  feeds_winner_match uuid references matches(id),
  feeds_loser_match uuid references matches(id),
  feeds_winner_slot text,    -- 'home' | 'away'
  feeds_loser_slot text,
  notes text,
  updated_at timestamptz default now()
);

create index if not exists ix_matches_tournament on matches(tournament_id);
create index if not exists ix_matches_stage on matches(tournament_id, stage);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  country_id uuid not null references countries(id),
  team_id uuid references teams(id),
  player_name text,
  minute int,
  own_goal boolean default false,
  created_at timestamptz default now()
);

-- =============================================================
-- VISTA DE POSICIONES POR GRUPO
-- =============================================================
create or replace view v_group_standings as
with played as (
  select
    m.tournament_id,
    m.group_id,
    m.home_country as country_id,
    m.home_score as gf,
    m.away_score as gc,
    case when m.status in ('finished','walkover') then
      case when m.home_score > m.away_score then 3
           when m.home_score = m.away_score then 1
           else 0 end
    else 0 end as pts,
    case when m.status in ('finished','walkover') then 1 else 0 end as pj
  from matches m
  where m.stage = 'group'
  union all
  select
    m.tournament_id,
    m.group_id,
    m.away_country as country_id,
    m.away_score as gf,
    m.home_score as gc,
    case when m.status in ('finished','walkover') then
      case when m.away_score > m.home_score then 3
           when m.home_score = m.away_score then 1
           else 0 end
    else 0 end as pts,
    case when m.status in ('finished','walkover') then 1 else 0 end as pj
  from matches m
  where m.stage = 'group'
)
select
  p.tournament_id,
  p.group_id,
  g.letter as group_letter,
  p.country_id,
  c.name as country_name,
  c.flag_url,
  sum(p.pj)::int as pj,
  sum(case when p.pts=3 then 1 else 0 end)::int as pg,
  sum(case when p.pts=1 then 1 else 0 end)::int as pe,
  sum(case when p.pj=1 and p.pts=0 then 1 else 0 end)::int as pp,
  sum(p.gf)::int as gf,
  sum(p.gc)::int as gc,
  (sum(p.gf) - sum(p.gc))::int as dg,
  sum(p.pts)::int as pts
from played p
join groups g on g.id = p.group_id
join countries c on c.id = p.country_id
group by p.tournament_id, p.group_id, g.letter, p.country_id, c.name, c.flag_url;

-- =============================================================
-- AVANCE AUTOMATICO DEL BRACKET
-- Al terminar un partido eliminatorio, propaga ganador/perdedor.
-- =============================================================
create or replace function propagate_match_result() returns trigger
language plpgsql as $$
declare
  winner uuid;
  loser uuid;
begin
  if new.status not in ('finished','walkover') then
    return new;
  end if;

  if new.home_score = new.away_score and (new.home_pen is null or new.away_pen is null) then
    -- empate sin penales: no propaga
    return new;
  end if;

  if coalesce(new.home_pen,0) > coalesce(new.away_pen,0)
     or new.home_score > new.away_score then
    winner := new.home_country;
    loser := new.away_country;
  else
    winner := new.away_country;
    loser := new.home_country;
  end if;

  if new.feeds_winner_match is not null and new.feeds_winner_slot is not null then
    if new.feeds_winner_slot = 'home' then
      update matches set home_country = winner where id = new.feeds_winner_match;
    else
      update matches set away_country = winner where id = new.feeds_winner_match;
    end if;
  end if;

  if new.feeds_loser_match is not null and new.feeds_loser_slot is not null then
    if new.feeds_loser_slot = 'home' then
      update matches set home_country = loser where id = new.feeds_loser_match;
    else
      update matches set away_country = loser where id = new.feeds_loser_match;
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists trg_propagate_match on matches;
create trigger trg_propagate_match
  after update of status, home_score, away_score, home_pen, away_pen on matches
  for each row execute procedure propagate_match_result();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
alter table profiles enable row level security;
alter table countries enable row level security;
alter table teams enable row level security;
alter table team_countries enable row level security;
alter table tournaments enable row level security;
alter table groups enable row level security;
alter table group_slots enable row level security;
alter table matches enable row level security;
alter table goals enable row level security;

-- Helper: es admin?
create or replace function is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_judge_or_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin','judge')
  );
$$;

-- LECTURA PUBLICA
do $$ begin
  create policy "public read profiles" on profiles for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public read countries" on countries for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read teams" on teams for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read team_countries" on team_countries for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read tournaments" on tournaments for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read groups" on groups for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read group_slots" on group_slots for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read matches" on matches for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read goals" on goals for select using (true);
exception when duplicate_object then null; end $$;

-- ESCRITURA: solo admin (todo) / juez (solo matches+goals)
do $$ begin
  create policy "admin write countries" on countries for all
    using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write teams" on teams for all
    using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write team_countries" on team_countries for all
    using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write tournaments" on tournaments for all
    using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write groups" on groups for all
    using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write group_slots" on group_slots for all
    using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write profiles" on profiles for update
    using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;

-- Jueces y admin pueden actualizar partidos y goles
do $$ begin
  create policy "judge update matches" on matches for update
    using (is_judge_or_admin()) with check (is_judge_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin insert matches" on matches for insert
    with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin delete matches" on matches for delete
    using (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "judge write goals" on goals for all
    using (is_judge_or_admin()) with check (is_judge_or_admin());
exception when duplicate_object then null; end $$;

-- Realtime: habilitar en Dashboard -> Database -> Replication
-- (matches, goals, group_slots, groups, tournaments)
