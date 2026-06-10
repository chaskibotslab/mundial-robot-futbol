-- ============================================================
-- RESET TOTAL DE DATOS (DEJA EL ESQUEMA INTACTO)
-- Borra todos los datos para empezar limpio.
-- NO toca usuarios/profiles. NO borra tablas.
-- ============================================================

BEGIN;

-- Orden importante por foreign keys (cascadea pero hacemos explicito):
DELETE FROM goals;
DELETE FROM matches;
DELETE FROM group_slots;
DELETE FROM groups;
DELETE FROM tournament_entries;
DELETE FROM tournaments;
DELETE FROM teams;
DELETE FROM countries;

COMMIT;

-- Despues de correr este script, copia y pega el contenido de
-- seed_countries.sql para recargar los 48 paises del Mundial 2026.
