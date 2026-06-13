-- ============================================================
-- DIAGNOSTICO + FIX: avance automatico del bracket
-- Corre cada bloque PASO A PASO en Supabase SQL Editor.
-- NO borra datos, NO toca grupos ni sorteos.
-- ============================================================

-- ============================================================
-- PASO 1: ver el estado de los partidos eliminatorios
-- ============================================================
select
  t.name as torneo,
  m.stage,
  count(*) as total,
  count(*) filter (where m.status in ('finished','walkover')) as finalizados,
  count(*) filter (where m.home_country is null or m.away_country is null) as con_tbd,
  count(*) filter (where m.feeds_winner_match is not null) as con_feed_winner
from matches m
join tournaments t on t.id = m.tournament_id
where m.stage <> 'group'
group by t.name, m.stage
order by t.name, m.stage;

-- Que mirar:
--  - "con_feed_winner" debe ser > 0 en r16/r32/qf/sf. Si es 0 -> el bracket
--    se creo sin cablear el avance (bug viejo). El PASO 3 lo arregla.
--  - "finalizados" muestra cuantos partidos diste por terminados.


-- ============================================================
-- PASO 2: ver el cableado actual entre partidos
-- (te muestra desde-hasta para que veas si esta bien)
-- ============================================================
select
  t.name as torneo,
  m.stage,
  m.bracket_slot,
  m.home_country,
  m.away_country,
  m.status,
  m.home_score, m.away_score,
  m.feeds_winner_match,
  m.feeds_winner_slot
from matches m
join tournaments t on t.id = m.tournament_id
where m.stage <> 'group'
order by t.name, m.bracket_slot;


-- ============================================================
-- PASO 3 (OPCIONAL - solo si PASO 1 muestra con_feed_winner = 0):
-- Re-cablea el avance entre partidos basandose en bracket_slot.
-- ============================================================
-- Funcion temporal: dado un bracket_slot global, devuelve el id del partido.
do $$
declare
  r record;
  target_slot int;
  target_side text;
begin
  for r in
    select m.id, m.tournament_id, m.stage, m.bracket_slot
    from matches m
    where m.stage <> 'group'
    order by m.tournament_id, m.bracket_slot
  loop
    target_slot := null;
    target_side := null;

    -- r32 (slots 0..15) -> r16 (slots 16..23)
    if r.stage = 'r32' then
      target_slot := 16 + (r.bracket_slot / 2);
      target_side := case when r.bracket_slot % 2 = 0 then 'home' else 'away' end;
    elsif r.stage = 'r16' then
      -- r16 en t32: slots 0..7 -> qf 8..11
      -- r16 en t24/t48: ajustar segun stageOffsets. Tomamos el siguiente stage existente.
      target_slot := (
        select min(bracket_slot) from matches
        where tournament_id = r.tournament_id and stage = 'qf'
      ) + ((r.bracket_slot - (select min(bracket_slot) from matches where tournament_id = r.tournament_id and stage = 'r16')) / 2);
      target_side := case when (r.bracket_slot - (select min(bracket_slot) from matches where tournament_id = r.tournament_id and stage = 'r16')) % 2 = 0 then 'home' else 'away' end;
    elsif r.stage = 'qf' then
      target_slot := (
        select min(bracket_slot) from matches
        where tournament_id = r.tournament_id and stage = 'sf'
      ) + ((r.bracket_slot - (select min(bracket_slot) from matches where tournament_id = r.tournament_id and stage = 'qf')) / 2);
      target_side := case when (r.bracket_slot - (select min(bracket_slot) from matches where tournament_id = r.tournament_id and stage = 'qf')) % 2 = 0 then 'home' else 'away' end;
    elsif r.stage = 'sf' then
      target_slot := (select bracket_slot from matches where tournament_id = r.tournament_id and stage = 'final' limit 1);
      target_side := case when (r.bracket_slot - (select min(bracket_slot) from matches where tournament_id = r.tournament_id and stage = 'sf')) = 0 then 'home' else 'away' end;
    end if;

    if target_slot is not null then
      update matches set
        feeds_winner_match = (select id from matches where tournament_id = r.tournament_id and bracket_slot = target_slot limit 1),
        feeds_winner_slot = target_side
      where id = r.id;
    end if;

    -- semis -> 3er puesto (perdedor)
    if r.stage = 'sf' then
      update matches set
        feeds_loser_match = (select id from matches where tournament_id = r.tournament_id and stage = 'third' limit 1),
        feeds_loser_slot = case when (r.bracket_slot - (select min(bracket_slot) from matches where tournament_id = r.tournament_id and stage = 'sf')) = 0 then 'home' else 'away' end
      where id = r.id;
    end if;
  end loop;
end $$;


-- ============================================================
-- PASO 4: RE-DISPARAR la propagacion para partidos YA finalizados
-- (esto "empuja" los ganadores a la siguiente etapa)
-- ============================================================
-- Trick: hacemos un update no-op para que el trigger AFTER UPDATE corra.
update matches set updated_at = now()
where stage <> 'group' and status in ('finished','walkover');


-- ============================================================
-- PASO 5: verificar que las siguientes rondas ya tienen equipos
-- ============================================================
select
  t.name as torneo,
  m.stage,
  m.bracket_slot,
  ch.name as home_country_name,
  ca.name as away_country_name,
  m.status
from matches m
join tournaments t on t.id = m.tournament_id
left join countries ch on ch.id = m.home_country
left join countries ca on ca.id = m.away_country
where m.stage <> 'group'
order by t.name, m.bracket_slot;
