-- Seed: selecciones clasificadas al Mundial FIFA 2026 (Canada, Mexico, EE.UU.)
-- 43 directos + Irak (repechaje AFC) + 2 placeholders UEFA repesca = 46 + 2 TBD = 48.
-- Limpia primero los paises antiguos:
--   DELETE FROM countries;  -- cascadea a tournament_entries, group_slots, matches (country_id se queda NULL)
-- Luego corre este insert.

INSERT INTO countries (name, fifa_code, flag_url) VALUES
  -- CONCACAF Anfitriones (3)
  ('Canadá',            'CAN', 'https://flagcdn.com/w160/ca.png'),
  ('Estados Unidos',    'USA', 'https://flagcdn.com/w160/us.png'),
  ('México',            'MEX', 'https://flagcdn.com/w160/mx.png'),

  -- CONMEBOL (6)
  ('Argentina',         'ARG', 'https://flagcdn.com/w160/ar.png'),
  ('Brasil',            'BRA', 'https://flagcdn.com/w160/br.png'),
  ('Colombia',          'COL', 'https://flagcdn.com/w160/co.png'),
  ('Ecuador',           'ECU', 'https://flagcdn.com/w160/ec.png'),
  ('Paraguay',          'PAR', 'https://flagcdn.com/w160/py.png'),
  ('Uruguay',           'URU', 'https://flagcdn.com/w160/uy.png'),

  -- UEFA (16: 14 directos + Bosnia, Suecia)
  ('Alemania',          'GER', 'https://flagcdn.com/w160/de.png'),
  ('Austria',           'AUT', 'https://flagcdn.com/w160/at.png'),
  ('Bélgica',           'BEL', 'https://flagcdn.com/w160/be.png'),
  ('Bosnia y Herzegovina','BIH', 'https://flagcdn.com/w160/ba.png'),
  ('Croacia',           'CRO', 'https://flagcdn.com/w160/hr.png'),
  ('Escocia',           'SCO', 'https://flagcdn.com/w160/gb-sct.png'),
  ('España',            'ESP', 'https://flagcdn.com/w160/es.png'),
  ('Francia',           'FRA', 'https://flagcdn.com/w160/fr.png'),
  ('Inglaterra',        'ENG', 'https://flagcdn.com/w160/gb-eng.png'),
  ('Noruega',           'NOR', 'https://flagcdn.com/w160/no.png'),
  ('Países Bajos',      'NED', 'https://flagcdn.com/w160/nl.png'),
  ('Portugal',          'POR', 'https://flagcdn.com/w160/pt.png'),
  ('Chequia',           'CZE', 'https://flagcdn.com/w160/cz.png'),
  ('Suecia',            'SWE', 'https://flagcdn.com/w160/se.png'),
  ('Suiza',             'SUI', 'https://flagcdn.com/w160/ch.png'),
  ('Turquía',           'TUR', 'https://flagcdn.com/w160/tr.png'),

  -- CONCACAF directos (3)
  ('Curazao',           'CUW', 'https://flagcdn.com/w160/cw.png'),
  ('Haití',             'HAI', 'https://flagcdn.com/w160/ht.png'),
  ('Panamá',            'PAN', 'https://flagcdn.com/w160/pa.png'),

  -- CAF (10: 9 + RD Congo)
  ('Argelia',           'ALG', 'https://flagcdn.com/w160/dz.png'),
  ('Cabo Verde',        'CPV', 'https://flagcdn.com/w160/cv.png'),
  ('Costa de Marfil',   'CIV', 'https://flagcdn.com/w160/ci.png'),
  ('Egipto',            'EGY', 'https://flagcdn.com/w160/eg.png'),
  ('Ghana',             'GHA', 'https://flagcdn.com/w160/gh.png'),
  ('Marruecos',         'MAR', 'https://flagcdn.com/w160/ma.png'),
  ('RD Congo',          'COD', 'https://flagcdn.com/w160/cd.png'),
  ('Senegal',           'SEN', 'https://flagcdn.com/w160/sn.png'),
  ('Sudáfrica',         'RSA', 'https://flagcdn.com/w160/za.png'),
  ('Túnez',             'TUN', 'https://flagcdn.com/w160/tn.png'),

  -- AFC (8 directos + 1 repechaje Irak = 9)
  ('Arabia Saudí',      'KSA', 'https://flagcdn.com/w160/sa.png'),
  ('Australia',         'AUS', 'https://flagcdn.com/w160/au.png'),
  ('Corea del Sur',     'KOR', 'https://flagcdn.com/w160/kr.png'),
  ('Irán',              'IRN', 'https://flagcdn.com/w160/ir.png'),
  ('Japón',             'JPN', 'https://flagcdn.com/w160/jp.png'),
  ('Jordania',          'JOR', 'https://flagcdn.com/w160/jo.png'),
  ('Qatar',             'QAT', 'https://flagcdn.com/w160/qa.png'),
  ('Uzbekistán',        'UZB', 'https://flagcdn.com/w160/uz.png'),
  ('Irak',              'IRQ', 'https://flagcdn.com/w160/iq.png'),

  -- OFC (1)
  ('Nueva Zelanda',     'NZL', 'https://flagcdn.com/w160/nz.png');
