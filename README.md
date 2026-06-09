# Mundial Robot Fútbol · Chaski Bots

Aplicativo web para simular el Mundial de Robot Fútbol (categorías **Pro** y **Amateur**).
Permite cargar equipos, asignarles países (un equipo puede representar 2-3 países si los cupos no se llenan), generar grupos automáticamente, registrar resultados y goles, y mostrar la fase de grupos + bracket eliminatorio en **tiempo real**.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (PostgreSQL + Auth + Realtime)
- **TailwindCSS** + **lucide-react**
- Despliegue en **Railway**, dominio recomendado: `mundial.chaskibotds.com`

## Estructura

```
mundial/
├── supabase/
│   ├── schema.sql          # tablas, RLS, triggers, vista de standings
│   └── seed_countries.sql  # paises con banderas
├── src/
│   ├── app/
│   │   ├── page.tsx        # landing (Pro / Amateur)
│   │   ├── [category]/     # vista publica del torneo (live)
│   │   └── admin/          # panel de administracion (proximamente)
│   ├── components/         # GroupTable, BracketView, MatchCard
│   └── lib/
│       ├── supabase/       # clients (browser, server, middleware)
│       ├── tournament.ts   # sorteo de grupos + generacion de bracket
│       └── types.ts        # tipos compartidos
└── railway.json
```

## Configuración inicial

### 1. Supabase

1. En tu proyecto Supabase abre el **SQL Editor**.
2. Ejecuta `supabase/schema.sql` (crea tablas, vistas, triggers y RLS).
3. Ejecuta `supabase/seed_countries.sql` (carga el catálogo de países).
4. En **Database → Replication**, habilita realtime para las tablas `matches`, `goals`, `group_slots`, `tournaments`.
5. En **Authentication → Providers**, deja habilitado `Email` (para login de admin/jueces).
6. Crea tu usuario admin desde **Authentication → Users → Add user**, luego en SQL:

```sql
update profiles set role = 'admin' where email = 'tu@correo.com';
```

### 2. Variables de entorno

Copia `.env.example` a `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Despliegue en Railway

1. Sube el repo a GitHub.
2. En Railway: **New Project → Deploy from GitHub repo** → seleccionas el repo.
3. En **Variables**, agrega las 4 variables de entorno (mismo `.env.local` pero con `NEXT_PUBLIC_SITE_URL=https://mundial.chaskibotds.com`).
4. Railway detecta Next.js y usa `railway.json` para `npm ci && npm run build` + `npm run start`.
5. En **Settings → Networking → Custom Domain**, agrega `mundial.chaskibotds.com`. Railway te dará un CNAME.
6. En el DNS de tu hosting WordPress (panel de chaskibotds.com), crea un registro **CNAME**:
   - Host: `mundial`
   - Apunta a: el CNAME que te dio Railway (algo como `xxxx.up.railway.app`)
   - TTL: 3600
7. Espera 5-30 minutos a que propague. Railway emitirá certificado SSL automáticamente.

> Tu sitio principal `www.chaskibotds.com` no se ve afectado: solo se agrega el subdominio `mundial`.

## Roles

- **viewer** (público sin login): puede ver grupos, bracket, resultados.
- **judge**: tras login puede actualizar marcadores y agregar goles.
- **admin**: gestiona equipos, países, torneos y usuarios.

## Roadmap (siguiente entrega)

- [ ] `/admin` — login + dashboard
- [ ] CRUD equipos (Pro / Amateur) con asignación de países (1..N)
- [ ] Crear torneo (elegir formato 16/24/32/48), sortear grupos, generar bracket
- [ ] Pantalla de "registrar resultado" para jueces (cancha asignada)
- [ ] Tabla de máximos goleadores
- [ ] Modo TV (pantalla fija auto-rotando grupos / partidos en vivo)

## Detección de "equipo vs sí mismo"

Cuando un equipo representa varios países y dos de sus países son emparejados,
el sistema marca automáticamente el partido en estado `walkover` y pide al admin
elegir: avance directo, sorteo o resultado manual. (Lógica en `src/lib/tournament.ts`)
