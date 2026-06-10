-- MIGRACION: cambia de team_countries (global) a tournament_entries (por torneo).
-- Ejecutalo UNA VEZ en Supabase SQL Editor.
-- ATENCION: borra las asignaciones de paises existentes. Los robots (teams) se mantienen.

-- 1. Borrar la tabla vieja de asignaciones globales
DROP TABLE IF EXISTS team_countries CASCADE;

-- 2. Crear tournament_entries: inscripcion + asignacion de pais por torneo
CREATE TABLE IF NOT EXISTS tournament_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES teams(id)       ON DELETE CASCADE,
  country_id    uuid REFERENCES countries(id)            ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Un pais solo puede pertenecer a 1 team por torneo
  CONSTRAINT uniq_country_per_tournament UNIQUE (tournament_id, country_id)
  -- (un mismo team puede tener varios paises en el mismo torneo: NO unique sobre team_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_team       ON tournament_entries (team_id);

-- 3. Limpiar referencias en group_slots a team_id (ya no se usa: se deriva de tournament_entries)
-- No borramos la columna por compatibilidad, pero la dejamos opcional.
ALTER TABLE group_slots ALTER COLUMN team_id DROP NOT NULL;

-- 4. RLS (igual que las demas tablas: solo admin escribe, lectura publica)
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read entries" ON tournament_entries;
CREATE POLICY "Public read entries" ON tournament_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write entries" ON tournament_entries;
CREATE POLICY "Admin write entries" ON tournament_entries FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
