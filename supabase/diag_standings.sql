-- ============================================================
-- DIAGNOSTICO: por que la tabla de posiciones no suma puntos
-- Corre este script en Supabase SQL Editor para ver el estado.
-- ============================================================

-- 1) Cuantos partidos hay por estado en cada torneo
select t.name, m.status, count(*) as cantidad
from matches m
join tournaments t on t.id = m.tournament_id
where m.stage = 'group'
group by t.name, m.status
order by t.name, m.status;

-- ^ Para que sumen puntos en la tabla, el status debe ser 'finished' o 'walkover'.
--   Si todos estan en 'scheduled' o 'live', PTS sera 0 en la vista publica.

-- 2) Resumen de la vista de posiciones (debe coincidir con lo que se ve en /pro o /amateur)
select t.name as torneo, s.group_letter as grupo, s.country_name, s.pj, s.pg, s.pe, s.pp, s.gf, s.gc, s.dg, s.pts
from v_group_standings s
join tournaments t on t.id = s.tournament_id
order by t.name, s.group_letter, s.pts desc, s.dg desc, s.gf desc;

-- 3) Si quieres FORZAR que todos los partidos de grupo ya jugados (con score > 0 en alguno)
--    pasen a status='finished', descomenta lo siguiente:
-- update matches set status = 'finished'
-- where stage = 'group'
--   and status in ('scheduled','live')
--   and (home_score > 0 or away_score > 0);
