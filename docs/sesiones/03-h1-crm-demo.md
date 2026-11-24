# Sesión 03 · H1 · crm-demo (Claude Code) · 24/11/2026

Transcripción exportada de Claude Code y saneada: rutas locales, emails, identificadores de Vercel y Neon, cadenas de conexión y credenciales sustituidos por marcadores `<…>`. Se omiten el razonamiento interno y los recordatorios del sistema; las salidas largas de herramientas están recortadas.

---

## ❯ Usuario

Vamos a construir `crm-demo`, el mini CRM que modificarán los agentes del repo `crm-agents` (github.com/daboy-dev/crm-agents). Este repo es el hito H1. Las decisiones de arquitectura viven solo en `crm-agents/docs/DECISIONES.md`; aquí las cito por número (D6, D11–D14) y este prompt ya incluye todo lo que necesitas de ellas, así que no las copies a este repo.
Documentación de este repo

* `README.md`: qué es, que lo modifican los agentes de `crm-agents` (con enlace), cómo arrancarlo en local y las variables de entorno.
* `AGENTS.md`: convenciones para el agente Develop (ver abajo).
* `CLAUDE.md`: breve; apunta a `AGENTS.md` y lista los comandos.
* Nada de `docs/`: el proceso, las decisiones y las transcripciones se guardan en `crm-agents`.

Objetivo
CRM en producción en Vercel con clientes, presupuestos y facturas, CI en verde, y una vista previa por PR con su propia rama de Neon.
Stack (D12)

* Next.js 16 (App Router), pnpm, TypeScript estricto con `noUncheckedIndexedAccess`, ESLint y Prettier (sin tocar Markdown). Mismas convenciones de configuración que `crm-agents`.
* Drizzle con `@neondatabase/serverless` (driver HTTP). Tailwind. Sin librería de componentes.
* Vitest para la lógica de dominio y Playwright para E2E (de momento, solo smoke tests locales; el workflow contra vistas previas es H2).

Estructura (pensada para que la modifique un LLM)

* `src/app/(auth)/login`: login de demo.
* `src/app/(crm)/clientes`, `presupuestos`, `facturas`: cada carpeta con `page.tsx` (lista), `[id]/page.tsx` (detalle), `nuevo/page.tsx` si aplica, `actions.ts` (server actions) y `queries.ts`.
* `src/db/schema.ts`, `src/db/client.ts`, `src/db/seed.ts`. Migraciones en `drizzle/`.
* `src/lib/`: utilidades pequeñas (formato de moneda en EUR, fechas en `es-ES`, cálculo de totales con IVA).
* Componentes compartidos mínimos en `src/components/` (tabla, botón, badge de estado, layout con navegación). Responsive: debe verse bien a 390 px.

Modelo de datos

* `clients`: id, name, email, phone, company, created_at.
* `quotes`: id, number (P-2026-001), client_id, status (`draft` | `sent` | `accepted` | `rejected`), issued_at, notes.
* `quote_items`: id, quote_id, description, quantity, unit_price (céntimos), tax_rate.
* `invoices`: id, number (F-2026-001), quote_id, client_id, status (`pending` | `paid`), issued_at, due_at.
* `invoice_items`: igual que `quote_items`.
* Una factura se genera desde un presupuesto `accepted` copiando sus líneas.
* No añadas NIF, buscador, marca de facturas vencidas ni página de contacto: son huecos a propósito para las demos (D14).

Funcionalidad

* Clientes: listar, ver, crear y editar.
* Presupuestos: listar, ver con líneas y totales, crear con líneas, cambiar estado.
* Facturas: listar, ver, generar desde un presupuesto aceptado, marcar como pagada.
* `data-testid` estables en tablas, filas, botones principales y formularios (D12).
* Login de demo: cookie firmada (HMAC con `AUTH_SECRET`), usuario y contraseña desde `DEMO_USER` / `DEMO_PASSWORD`. Un middleware protege todo salvo `/login` y `/api/health`.
* `GET /api/health` como en `crm-agents` (consulta la base de datos, 503 si falla, `connection()` por `cacheComponents`).

Datos de prueba (D14)
`pnpm db:seed` idempotente: unos 15 clientes españoles ficticios, presupuestos en los cuatro estados y facturas pendientes y pagadas, algunas con vencimiento pasado (sin marcar). Se ejecuta una vez contra producción; las ramas de Neon lo heredan.
Despliegue (D13)

* Build de Vercel: `drizzle-kit migrate && next build` (script `pnpm vercel-build`).
* `.env.example` con `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `DEMO_USER`, `DEMO_PASSWORD`. Ninguna clave en el repo.

AGENTS.md (D12)
Escríbelo para el agente Develop (otro LLM): estructura, dónde va cada cosa, cómo añadir un campo (schema → `pnpm db:generate` → queries → actions → UI → `data-testid`), convenciones de nombres, textos de UI en español, y qué no tocar (auth, middleware, config de build). Breve y concreto.
CI
GitHub Actions en cada push y PR: install, lint, format:check, typecheck, test.
Pasos manuales que haré yo (avísame cuando toque)

1. Crear el repo público `crm-demo` en GitHub y activar Automatically delete head branches.
2. Crear el proyecto de Vercel `crm-demo` y añadir la integración Neon-Managed con rama por vista previa y borrado de la rama al borrar la rama de Git (D11).
3. Desactivar la Deployment Protection de las vistas previas (D6).
4. Añadir `AUTH_SECRET`, `DEMO_USER` y `DEMO_PASSWORD` en Vercel.

Verificación de H1

* Lint, tipos y tests en verde; CI en verde.
* Producción: login, y las tres entidades con datos.
* Un PR de prueba (por ejemplo, cambiar un texto) genera su vista previa con una rama `preview/...` en Neon; al cerrar el PR y borrar la rama, la rama de Neon desaparece.

Al cerrar
Prepara el texto de la entrada "Sesión 03 · H1" para `docs/PROCESO.md` de `crm-agents` (objetivo, cómo fue, qué salió mal y qué se corrigió) y la transcripción saneada para `docs/sesiones/03-h1-crm-demo.md`.
Trabaja con commits pequeños en Conventional Commits. Empieza proponiendo el plan de pasos y espera mi visto bueno antes de generar el proyecto.

⏺ **Bash** — List repo contents and sibling folders

```
cd <workspace> && ls -la crm-demo crm-demo/docs; find crm-demo/docs -type f | head; ls; git -C crm-demo log --stat -1 | head -20
```

<details><summary>Resultado</summary>

```
crm-demo:
total 8
drwxr-xr-x@  5 <user>  staff   160 Nov 23 23:59 .
drwxr-xr-x@  5 <user>  staff   160 Nov 23 23:58 ..
drwxr-xr-x@ 12 <user>  staff   384 Nov 23 23:58 .git
-rw-r--r--@  1 <user>  staff  1062 Nov 23 23:58 LICENSE
drwxr-xr-x   3 <user>  staff    96 Nov 23 23:59 docs

crm-demo/docs:
total 16
drwxr-xr-x  3 <user>  staff    96 Nov 23 23:59 .
drwxr-xr-x@ 5 <user>  staff   160 Nov 23 23:59 ..
-rw-r--r--@ 1 <user>  staff  8159 Nov 23 23:59 DECISIONES.md
crm-demo/docs/DECISIONES.md
crm-agents
crm-demo
commit d0364787fe08eb2176da012ec157eb156bf627ec
Author: <author> <<email>>
Date:   Mon Nov 23 23:10:29 2026 +0100

    Initial commit

 LICENSE | 21 +++++++++++++++++++++
 1 file changed, 21 insertions(+)
Shell cwd was reset to <repo>
```

</details>

⏺ **Bash** — Inspect crm-agents configuration conventions

```
cd ../crm-agents && git log --oneline | head; ls -la; cat package.json; cat tsconfig.json eslint.config.* .prettierrc* .prettierignore 2>/dev/null; ls .github/workflows && cat .github/workflows/*; find src -path '*health*' -type f | xargs cat; cat next.config.* ; diff -q docs/DECISIONES.md ../crm-demo/docs/DECISIONES.md
```

<details><summary>Resultado</summary>

```
046a48a docs: update decisions and planning docs
b7de8c7 docs: close H0 with session log and transcript
02f0d10 ci: bump actions to current major versions
60d112b docs: add README, env example and project commands
b89923e ci: add lint, format, typecheck and test workflow
592c250 feat: add Drizzle schema, initial migration and health endpoint
d65c393 chore: scaffold Next.js app with strict TypeScript, ESLint and Prettier
301efe3 docs: add CLAUDE.md and initial planning docs
ef1c468 Initial commit
total 1064
drwxr-xr-x@ 30 <user>  staff     960 Nov 23 23:49 .
drwxr-xr-x@  5 <user>  staff     160 Nov 23 23:58 ..
-rw-r--r--@  1 <user>  staff    8196 Nov 23 23:49 .DS_Store
-rw-r--r--@  1 <user>  staff     589 Nov 23 23:38 .env
-rw-r--r--@  1 <user>  staff     624 Nov 23 23:23 .env.example
drwxr-xr-x@ 15 <user>  staff     480 Nov 24 00:03 .git
drwxr-xr-x@  3 <user>  staff      96 Nov 23 23:23 .github
-rw-r--r--@  1 <user>  staff     535 Nov 23 23:23 .gitignore
drwxr-xr-x@ 23 <user>  staff     736 Nov 23 23:23 .next
-rw-r--r--@  1 <user>  staff      66 Nov 23 23:23 .prettierignore
-rw-r--r--@  1 <user>  staff       3 Nov 23 23:23 .prettierrc.json
-rw-r--r--@  1 <user>  staff     679 Nov 23 23:21 AGENTS.md
-rw-r--r--@  1 <user>  staff    2942 Nov 23 23:43 CLAUDE.md
-rw-r--r--@  1 <user>  staff    1062 Nov 23 23:16 LICENSE
-rw-r--r--@  1 <user>  staff     845 Nov 23 23:43 README.md
… (+232 líneas)
```

</details>

⏺ **Bash** — Read DB client, drizzle and env conventions

```
cd ../crm-agents && cat drizzle.config.ts src/server/db/client.ts vitest.config.ts .env.example pnpm-workspace.yaml .gitignore; cat CLAUDE.md | head -60
```

<details><summary>Resultado</summary>

```
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let db: Db | undefined;

/** Lazily creates the Drizzle client so importing this module never needs env vars. */
export function getDb(): Db {
… (+137 líneas)
```

</details>

⏺ **Resumen del turno:** He revisado crm-demo (solo LICENSE y un docs/DECISIONES.md sin seguimiento) y las convenciones de crm-agents (configuración, CI, health). El plan de H1 está propuesto y no he generado nada todavía.

**Pregunta:** ¿Apruebas el plan para empezar con el scaffold?

⏺ He revisado `crm-demo` y `crm-agents`. `crm-demo` solo tiene `LICENSE` y un `docs/DECISIONES.md` sin seguimiento, que además no coincide con el de `crm-agents`. Esta es la propuesta. Todavía no he generado nada.

## Decisiones que no vienen en el prompt

1. **Next 16 cambia el nombre de `middleware.ts` a `proxy.ts`.** Usaré `src/proxy.ts` y lo comprobaré antes en `node_modules/next/dist/docs/`. En `AGENTS.md` lo llamaré "proxy (antes middleware)" para que el agente Develop no busque el nombre antiguo.
2. **`cacheComponents` activo**, como en `crm-agents`. Las páginas que leen la base de datos o cookies irán dentro de `<Suspense>` o llamarán a `connection()`, y lo explicaré en `AGENTS.md`.
3. **Las migraciones usan `DATABASE_URL_UNPOOLED`**, la conexión directa. La app usa `DATABASE_URL` con el driver HTTP.
4. **Ids enteros (identity)**, para que las URLs sean legibles (`/clientes/12`).
5. **Importes en céntimos e IVA como porcentaje entero** (`21`). El total se redondea por línea. Esa lógica va en `src/lib/totals.ts` con tests.
6. **Numeración `P-2026-001` / `F-2026-001`:**
   - `number` tiene un índice único y el siguiente número se calcula con el máximo del año.
   - El driver HTTP no admite transacciones interactivas, así que si dos altas chocan se reintenta.
   - Las escrituras con varias sentencias (presupuesto con sus líneas, factura copiada) van en un `db.batch` atómico.
7. **Generar una factura:** solo desde un presupuesto `accepted`, y una sola factura por presupuesto (índice único en `invoices.quote_id`). Así repetir la acción no crea duplicados.
8. **Login:** cookie `httpOnly` con datos y caducidad, firmada con HMAC-SHA256 mediante Web Crypto. La comparación se hace en tiempo constante.
9. **Seed idempotente:**
   - Fechas fijas de 2026: algunas facturas vencen antes del 24/11/2026 y no se marcan.
   - Inserta con `onConflictDoNothing` sobre `email` y `number`, así que se puede ejecutar varias veces.
10. **Playwright:** solo un smoke local con `pnpm test:e2e`, que hace login y abre las tres listas. No entra en CI.

## Commits previstos (Conventional Commits, en inglés)

1. `chore: scaffold Next.js app with strict TypeScript, ESLint and Prettier` (misma configuración que `crm-agents`, más Tailwind)
2. `feat: add Drizzle schema, client and initial migration` (`schema.ts`, `client.ts`, `drizzle/`)
3. `feat: add health endpoint` (copia de la de `crm-agents`, con su test)
4. `feat: add money, date and tax total helpers` (`src/lib`, con tests de Vitest)
5. `feat: add signed-cookie demo login and route proxy` (con tests de firmar y verificar)
6. `feat: add shared layout and UI components` (navegación, tabla, botón y badge de estado, responsive a 390 px)
7. `feat: add clients list, detail, create and edit`
8. `feat: add quotes with line items and status changes`
9. `feat: add invoice generation from accepted quotes and mark as paid`
10. `feat: add idempotent seed script` (`pnpm db:seed`)
11. `test: add Playwright smoke test`
12. `ci: add lint, format, typecheck and test workflow`
13. `docs: add README, AGENTS.md, CLAUDE.md and env example` (más el script `vercel-build`)

Después: despliegue, seed en producción, PR de prueba y las notas de la Sesión 03.

## Cuándo te aviso para los pasos manuales

- **Paso 1 (repo en GitHub):** cuando el scaffold compile, para poder hacer push y ver la CI.
- **Pasos 2 a 4 (Vercel, Neon, Deployment Protection y variables):** cuando la app funcione en local.
- **Después de que la integración cree la base de datos:** lanzo el seed contra producción y hacemos el PR de prueba.

## Una cosa que necesito de ti

El `docs/DECISIONES.md` sin seguimiento de este repo no lo voy a subir. ¿Lo borro o lo dejas tú fuera del repo?

¿Apruebas el plan y empiezo con el scaffold, o quieres cambiar algo antes?

---

## ❯ Usuario

Sí, adelante

⏺ **Bash** — Check tool versions and Next 16 docs on proxy

```
node -v; pnpm -v; cd ../crm-agents; ls node_modules/next/dist/docs/ 2>/dev/null | head; grep -ril "proxy.ts" node_modules/next/dist/docs 2>/dev/null | head -5; cat AGENTS.md; ls src/app; cat src/app/layout.tsx; cat postcss.config.* 2>/dev/null; grep -i tailwind package.json
```

<details><summary>Resultado</summary>

```
v22.23.4
12.9.1
01-app
02-pages
03-architecture
04-community
index.md
node_modules/next/dist/docs/02-pages/02-guides/internationalization.md
node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md
node_modules/next/dist/docs/01-app/02-guides/redirecting.md
node_modules/next/dist/docs/01-app/02-guides/authentication.md
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
api
favicon.ico
globals.css
layout.tsx
… (+17 líneas)
```

</details>

⏺ **Bash** — Read Next 16 proxy guide

```
cd ../crm-agents/node_modules/next/dist/docs/01-app; cat 01-getting-started/16-proxy.md | head -150; ls 01-getting-started 02-guides | head -80
```

<details><summary>Resultado</summary>

```
---
title: Proxy
nav_title: Proxy
description: Use Next.js Proxy to rewrite, redirect, modify headers, or respond directly before a request completes.
related:
  title: API Reference
  description: Learn more about Proxy
  links:
    - app/api-reference/file-conventions/proxy
    - app/guides/backend-for-frontend
---

## Proxy

> **Good to know**: Starting with Next.js 16, Middleware is now called Proxy to better reflect its purpose. The functionality remains the same.

Proxy allows you to run code before a request is completed. Then, based on the incoming request, you can modify the response by rewriting, redirecting, modifying the request or response headers, or responding directly.

### Use cases

Some common scenarios where Proxy is effective include:

- Modifying headers for all pages or a subset of pages
- Rewriting to different pages based on A/B tests or experiments
- Programmatic redirects based on incoming request properties
… (+138 líneas)
```

</details>

⏺ **Bash** — Read auth with cache components guide

```
cd ../crm-agents/node_modules/next/dist/docs/01-app; sed -n 1,200p 02-guides/authentication-with-cache-components.md
```

<details><summary>Resultado</summary>

```
---
title: How to implement authentication with Cache Components
nav_title: Authentication with Cache Components
description: 'Learn how to read the user session, show authenticated UI without slowing down the page, and cache data derived from the session when Cache Components is enabled.'
related:
  title: Next Steps
  description: Learn more about authentication, caching, and prefetching in Next.js.
  links:
    - app/guides/authentication
    - app/getting-started/caching
    - app/getting-started/fetching-data
    - app/guides/optimizing-prefetching
    - app/api-reference/directives/use-cache-private
    - app/api-reference/functions/cacheTag
    - app/api-reference/config/next-config-js/cacheComponents
---

With [Cache Components](/docs/app/getting-started/caching) enabled, a session read happens at request time, so it can't be prerendered into the static shell. Authenticated UI streams in behind a `<Suspense>` boundary instead, and data derived from the session can still be cached.

The examples use [iron-session](https://github.com/vvo/iron-session) for encrypted cookie sessions, but the patterns apply to any session or authentication library. For a complete, runnable version, see the [with-iron-session-cache-components example](https://github.com/vercel/next.js/tree/canary/examples/with-iron-session-cache-components).

## Prerequisites

Enable [`cacheComponents`](/docs/app/api-reference/config/next-config-js/cacheComponents):

… (+176 líneas)
```

</details>

⏺ **Bash** — Read instant navigation validation notes

```
cd ../crm-agents/node_modules/next/dist/docs/01-app; grep -n -i -A12 "opting out\|## .*valid\|build error\|fails the build" 02-guides/instant-navigation.md | head -120
```

<details><summary>Resultado</summary>

```
103:### Validate instant navigation
104-
105-By **default** (`validationLevel: 'warning'`), Cache Components apps validate every Page and Default segment in development. Validation surfaces what would keep navigations into a segment from being instant — which navigations would block, where a `<Suspense>` boundary is missing, and which data is reaching the user uncached.
106-
107-To opt out of automatic validation and only validate segments that explicitly export `instant`, set [`validationLevel`](/docs/app/api-reference/file-conventions/route-segment-config/instant#configuring-validation-defaults) to `'manual-warning'`:
108-
109-ˋˋˋts filename="next.config.ts" highlight={7}
110-import type { NextConfig } from 'next'
111-
112-const nextConfig: NextConfig = {
113-  cacheComponents: true,
114-  experimental: {
115-    instantInsights: {
--
556:## Opting out
557-
558-Not every layout or page can or should be instant. When the structural fix isn't worth the work, or when a route isn't a priority for instant navigation, refine validation at one of two scopes.
559-
560-The dev overlay surfaces this as the **Block** fix alongside every insight:
561-
562-<FixCardGrid>
563-  <FixCard
564-    group="block"
565-    title="Allow blocking route"
566-    href="/docs/messages/blocking-prerender-dynamic#allow-blocking-route"
… (+13 líneas)
```

</details>

⏺ **Bash** — Check mutation APIs in Next 16 docs

```
cd ../crm-agents/node_modules/next/dist/docs/01-app; grep -n "revalidatePath\|refresh()\|updateTag\|useActionState" 01-getting-started/07-mutating-data.md | head -30; ls 03-api-reference/04-functions | head -60
```

<details><summary>Resultado</summary>

```
9:    - app/api-reference/functions/revalidatePath
339:While executing a Server Function, you can show a loading indicator with React's [`useActionState`](https://react.dev/reference/react/useActionState) hook. This hook returns a `pending` boolean:
344:import { useActionState, startTransition } from 'react'
349:  const [state, action, pending] = useActionState(createPost, false)
362:import { useActionState, startTransition } from 'react'
367:  const [state, action, pending] = useActionState(createPost, false)
399:  refresh()
417:  refresh()
421:This refreshes the client router, ensuring the UI reflects the latest state. The `refresh()` function does not revalidate tagged data. To revalidate tagged data, use [`updateTag`](/docs/app/api-reference/functions/updateTag) or [`revalidateTag`](/docs/app/api-reference/functions/revalidateTag) instead.
425:After performing a mutation, you can revalidate the Next.js cache and show the updated data by calling [`revalidatePath`](/docs/app/api-reference/functions/revalidatePath) or [`revalidateTag`](/docs/app/api-reference/functions/revalidateTag) within the Server Function:
429:import { revalidatePath } from 'next/cache'
440:  revalidatePath('/posts')
446:import { revalidatePath } from 'next/cache'
456:  revalidatePath('/posts')
468:import { revalidatePath } from 'next/cache'
479:  revalidatePath('/posts')
488:import { revalidatePath } from 'next/cache'
499:  revalidatePath('/posts')
504:Calling `redirect` [throws](/docs/app/api-reference/functions/redirect#behavior) a framework handled control-flow exception. Any code after it won't execute. If you need fresh data, call [`revalidatePath`](/docs/app/api-reference/functions/revalidatePath) or [`revalidateTag`](/docs/app/api-reference/functions/revalidateTag) beforehand.
after.md
cacheLife.md
cacheTag.md
catchError.md
connection.md
cookies.md
… (+40 líneas)
```

</details>

⏺ Estoy montando el scaffold: copio la configuración de `crm-agents` y añado Tailwind.

⏺ **Bash** — Copy configs and install dependencies

```
set -e
A=../crm-agents
cp $A/tsconfig.json $A/eslint.config.mjs $A/.prettierrc.json $A/.prettierignore $A/.gitignore $A/pnpm-workspace.yaml $A/next.config.ts $A/vitest.config.ts .
mkdir -p src/app public
cp $A/src/app/favicon.ico src/app/
cat > package.json <<'EOF'
{
  "name": "crm-demo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "vercel-build": "drizzle-kit migrate && next build",
    "start": "next start",
    "lint": "eslint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/db/seed.ts"
  },
  "packageManager": "pnpm@12.9.1",
  "engines": {
    "node": ">=22"
  }
… (+7 líneas)
```

<details><summary>Resultado</summary>

```
pnpm-lock.yaml
drizzle/meta
.next
node_modules
test-results
playwright-report
*.md
+ react 19.3.0
+ react-dom 19.3.0
+ zod 4.6.7

Done in 971ms using pnpm v12.9.1
+ @types/node 22.20.5
+ @types/react 19.3.0
+ @types/react-dom 19.3.0
+ dotenv 18.0.10
+ drizzle-kit 0.31.11
+ eslint 9.39.5
+ eslint-config-next 16.4.6
+ eslint-config-prettier 10.1.8
+ prettier 3.10.1
+ tailwindcss 4.3.5
+ tsx 4.23.15
+ typescript 7.0.2
+ vitest 5.1.1
… (+2 líneas)
```

</details>

⏺ **Bash** — Pin TypeScript 5 as in crm-agents

```
pnpm add -D typescript@^5 2>&1 | tail -2; grep -n "playwright\|typescript\|postcss" package.json; cat pnpm-workspace.yaml
```

<details><summary>Resultado</summary>

```
Done in 275ms using pnpm v12.9.1
16:    "test:e2e": "playwright test",
34:    "@playwright/test": "^1.65.1",
35:    "@tailwindcss/postcss": "^4.3.5",
47:    "typescript": "^5.9.3",
allowBuilds:
  esbuild: true
  sharp: false
  unrs-resolver: false
```

</details>

⏺ Now the app skeleton files.

⏺ **Bash** — Write base app files and run checks

```
set -e
cat > postcss.config.mjs <<'EOF'
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
EOF
cat > src/app/globals.css <<'EOF'
@import "tailwindcss";

:root {
  color-scheme: light;
}

body {
  @apply bg-slate-50 text-slate-900 antialiased;
}
EOF
cat > src/app/layout.tsx <<'EOF'
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "crm-demo",
  description: "Mini CRM de clientes, presupuestos y facturas",
};

… (+21 líneas)
```

<details><summary>Resultado</summary>

```
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

</details>

⏺ **Bash** — Commit the scaffold without docs folder

```
sed -i '' 's#  /\* config options here \*/\n##' next.config.ts; python3 - <<'EOF'
p='next.config.ts';s=open(p).read().replace("  /* config options here */\n","");open(p,'w').write(s)
EOF
git add -A -- . ':!docs' && git status --short && git commit -q -m "chore: scaffold Next.js app with strict TypeScript, ESLint, Prettier and Tailwind

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
A  .gitignore
A  .prettierignore
A  .prettierrc.json
A  eslint.config.mjs
A  next.config.ts
A  package.json
A  pnpm-lock.yaml
A  pnpm-workspace.yaml
A  postcss.config.mjs
A  src/app/favicon.ico
A  src/app/globals.css
A  src/app/layout.tsx
A  src/app/page.tsx
A  tsconfig.json
A  vitest.config.ts
3fd4351 chore: scaffold Next.js app with strict TypeScript, ESLint, Prettier and Tailwind
```

</details>

⏺ **Bash** — Write schema, client and generate migration

```
set -e
mkdir -p src/db
cat > src/db/schema.ts <<'EOF'
import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
]);

export const invoiceStatus = pgEnum("invoice_status", ["pending", "paid"]);

export type QuoteStatus = (typeof quoteStatus.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];

export const clients = pgTable("clients", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().notNull().unique(),
  phone: text(),
  company: text(),
… (+109 líneas)
```

<details><summary>Resultado</summary>

```
$ drizzle-kit generate --name init
No config path provided, using default 'drizzle.config.ts'
Reading config file '<repo>/drizzle.config.ts'
5 tables
clients 6 columns 0 indexes 0 fks
invoice_items 6 columns 0 indexes 1 fks
invoices 7 columns 0 indexes 2 fks
quote_items 6 columns 0 indexes 1 fks
quotes 6 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_init.sql 🚀
0000_init.sql
meta
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
… (+45 líneas)
```

</details>

⏺ **Bash** — Check and commit schema and migration

```
pnpm format >/dev/null && pnpm lint && pnpm typecheck >/dev/null && git add -A -- . ':!docs' && git commit -q -m "feat: add Drizzle schema, client and initial migration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
7994187 feat: add Drizzle schema, client and initial migration
```

</details>

⏺ **Bash** — Add health endpoint with tests and commit

```
set -e
mkdir -p src/lib src/app/api/health
cat > src/lib/health.ts <<'EOF'
import packageJson from "../../package.json";
import { clients } from "@/db/schema";
import type { Db } from "@/db/client";

export type HealthReport = {
  ok: boolean;
  db: boolean;
  version: string;
};

export type HealthDeps = {
  /** Runs a real query against the database; must throw if it is unreachable. */
  pingDb: () => Promise<void>;
  version: string;
};

export async function checkHealth(deps: HealthDeps): Promise<HealthReport> {
  let db = false;
  try {
    await deps.pingDb();
    db = true;
  } catch {
    db = false;
  }
  return { ok: db, db, version: deps.version };
}

… (+35 líneas)
```

<details><summary>Resultado</summary>

```
Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  00:08:57
   Duration  456ms (import 83%, transform 14%, worker 2%, tests 1%)

$ eslint
$ next typegen && tsc --noEmit
$ prettier --write .
5cdee03 feat: add health endpoint
```

</details>

⏺ Now the domain helpers in `src/lib` with their tests.

⏺ **Bash** — Add money, dates, totals and numbering helpers with tests

```
set -e
cat > src/lib/money.ts <<'EOF'
const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

/** Formats euro cents for display, e.g. 123456 → "1234,56 €". */
export function formatEur(cents: number): string {
  return eur.format(cents / 100);
}

/**
 * Parses a user-typed euro amount into cents. Accepts "12", "12,5",
 * "12,50", "1.234,56" and "12.50". Returns null when it is not a valid
 * non-negative amount with at most two decimals.
 */
export function parseEurToCents(input: string): number | null {
  let value = input.trim().replace(/\s|€/g, "");
  if (value === "") return null;
  if (value.includes(",")) {
    // Spanish format: dots are thousands separators.
    value = value.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
EOF
cat > src/lib/money.test.ts <<'EOF'
… (+238 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
 RUN  v5.1.1 <repo>


 Test Files  5 passed (5)
      Tests  26 passed (26)
   Start at  00:09:30
   Duration  244ms (import 64%, transform 30%, tests 4%, worker 3%)

$ eslint
$ next typegen && tsc --noEmit
```

</details>

⏺ **Bash** — Commit lib helpers

```
git add -A -- . ':!docs' && git commit -q -m "feat: add money, date, tax total and numbering helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
da3ebf9 feat: add money, date, tax total and numbering helpers
```

</details>

⏺ **Bash** — Add signed-cookie auth, proxy and login page

```
set -e
mkdir -p "src/app/(auth)/login"
cat > src/lib/auth.ts <<'EOF'
/**
 * Demo login: a cookie holding `payload.signature`, where the payload is the
 * user and an expiry, and the signature is HMAC-SHA256 with AUTH_SECRET.
 * Uses only Web Crypto so it runs in the proxy and in server actions.
 *
 * Do not modify without a human reviewer (see AGENTS.md).
 */

export const SESSION_COOKIE = "crm_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = { user: string; exp: number };

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
… (+291 líneas)
```

<details><summary>Resultado</summary>

```
ok
```

</details>

⏺ **Bash** — Add shared UI components and run checks

```
set -e
mkdir -p src/components
cat > src/components/button.tsx <<'EOF'
import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function buttonClasses(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
… (+324 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
      Tests  36 passed (36)
```

</details>

⏺ **Bash** — Commit components and auth separately

```
set -e
git add src/components && git commit -q -m "feat: add shared layout and UI components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add -A -- . ':!docs' && git commit -q -m "feat: add signed-cookie demo login and route proxy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -3
```

<details><summary>Resultado</summary>

```
faaad61 feat: add signed-cookie demo login and route proxy
e94deb7 feat: add shared layout and UI components
da3ebf9 feat: add money, date, tax total and numbering helpers
```

</details>

⏺ **Bash** — Reorder commits so each one builds

```
set -e
git reset -q --soft HEAD~2 && git reset -q
git add src/components/button.tsx src/components/field.tsx src/components/table.tsx src/components/status-badge.tsx src/components/page-header.tsx src/components/nav-links.tsx && git commit -q -m "feat: add shared UI components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add -A -- . ':!docs' && git commit -q -m "feat: add signed-cookie demo login, route proxy and app shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -3; git status --short
```

<details><summary>Resultado</summary>

```
a309a8a feat: add signed-cookie demo login, route proxy and app shell
0dc2573 feat: add shared UI components
da3ebf9 feat: add money, date, tax total and numbering helpers
```

</details>

⏺ Ahora las tres entidades (clientes, presupuestos, facturas). Empiezo por las relaciones de Drizzle y clientes.

⏺ **Bash** — Add relations, DB error helper and id parser

```
set -e
python3 - <<'EOF'
p='src/db/schema.ts'
s=open(p).read()
s=s.replace('''import {
  date,''','''import { relations } from "drizzle-orm";
import {
  date,''')
s=s.replace('''export type Client = typeof''','''export const clientsRelations = relations(clients, ({ many }) => ({
  quotes: many(quotes),
  invoices: many(invoices),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, { fields: [quotes.clientId], references: [clients.id] }),
  items: many(quoteItems),
  invoice: one(invoices),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  quote: one(quotes, { fields: [invoices.quoteId], references: [quotes.id] }),
  items: many(invoiceItems),
… (+90 líneas)
```

<details><summary>Resultado</summary>

```
No schema changes, nothing to migrate 😴
      Tests  47 passed (47)
```

</details>

⏺ **Bash** — Add clients list, detail, create and edit

```
set -e
D="src/app/(crm)"; C="$D/clientes"
mkdir -p "$C/[id]/editar" "$C/nuevo"
cat > "$D/layout.tsx" <<'EOF'
import { AppShell } from "@/components/app-shell";

export default function CrmLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
EOF
cat > src/lib/forms.ts <<'EOF'
import type { z } from "zod";

/** State returned by form server actions and read with useActionState. */
export type FormState = {
  /** Field name → error message (in Spanish). `_form` for general errors. */
  errors: Record<string, string>;
  /** Submitted values, so the form can show them again after an error. */
  values: Record<string, string>;
};

export const emptyFormState: FormState = { errors: {}, values: {} };

/** Flattens Zod issues into one message per field (the first one). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    errors[key] ??= issue.message;
  }
… (+489 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

</details>

⏺ **Bash** — Commit clients module

```
git add -A -- . ':!docs' && git commit -q -m "feat: add clients list, detail, create and edit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
0318c87 feat: add clients list, detail, create and edit
```

</details>

⏺ Clientes hecho. Sigo con presupuestos: validación, consultas, alta con líneas y cambio de estado.

⏺ **Bash** — Add quote validation with tests

```
set -e
Q="src/app/(crm)/presupuestos"
mkdir -p "$Q/[id]" "$Q/nuevo"
cat > "$Q/validation.ts" <<'EOF'
import { z } from "zod";
import { quoteStatus } from "@/db/schema";
import { parseEurToCents } from "@/lib/money";

/** IVA rates offered in the form, in whole %. */
export const TAX_RATES = [21, 10, 4, 0] as const;

export const quoteFields = ["clientId", "issuedAt", "notes"] as const;

const itemSchema = z.object({
  description: z.string().trim().min(1, "Describe la línea."),
  quantity: z.coerce
    .number<string>("Cantidad no válida.")
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad mínima es 1."),
  unitPrice: z
    .string()
    .transform((value, ctx) => {
      const cents = parseEurToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Precio no válido." });
        return z.NEVER;
      }
      return cents;
    }),
  taxRate: z.coerce
… (+105 líneas)
```

<details><summary>Resultado</summary>

```
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.1.1 <repo>


 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  00:13:04
   Duration  291ms (import 86%, transform 8%, tests 5%, worker 1%)
```

</details>

⏺ **Bash** — Add quote queries, actions, form, list and new pages

```
set -e
Q="src/app/(crm)/presupuestos"
cat > "$Q/queries.ts" <<'EOF'
import { desc, eq, like } from "drizzle-orm";
import { getDb } from "@/db/client";
import { quotes } from "@/db/schema";

/** All quotes, newest first, with client and lines (to compute totals). */
export async function listQuotes() {
  return getDb().query.quotes.findMany({
    orderBy: [desc(quotes.issuedAt), desc(quotes.id)],
    with: {
      client: { columns: { id: true, name: true } },
      items: true,
    },
  });
}

/** One quote with its client, lines and the invoice generated from it. */
export async function getQuote(id: number) {
  const quote = await getDb().query.quotes.findFirst({
    where: eq(quotes.id, id),
    with: {
      client: true,
      items: { orderBy: (items, { asc }) => [asc(items.id)] },
      invoice: { columns: { id: true, number: true } },
    },
  });
  return quote ?? null;
}
… (+450 líneas)
```

<details><summary>Resultado</summary>

```
ok
```

</details>

⏺ **Bash** — Add line items table and quote detail page

```
set -e
cat > src/components/line-items-table.tsx <<'EOF'
import { formatEur } from "@/lib/money";
import { documentTotals, lineTotals, type LineInput } from "@/lib/totals";
import { Table, Td, Th, Tr } from "./table";

type Line = LineInput & { id: number; description: string };

/** Lines of a quote or invoice with base, IVA and total. */
export function LineItemsTable({ items }: { items: Line[] }) {
  const totals = documentTotals(items);
  return (
    <div className="space-y-3">
      <Table data-testid="items-table">
        <thead>
          <tr>
            <Th>Descripción</Th>
            <Th className="text-right">Cant.</Th>
            <Th className="hidden text-right sm:table-cell">Precio</Th>
            <Th className="hidden text-right sm:table-cell">IVA</Th>
            <Th className="text-right">Importe</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <Tr key={item.id} data-testid="item-row" data-id={item.id}>
              <Td>{item.description}</Td>
              <Td className="text-right">{item.quantity}</Td>
              <Td className="hidden text-right whitespace-nowrap sm:table-cell">
                {formatEur(item.unitPrice)}
… (+157 líneas)
```

<details><summary>Resultado</summary>

```
ok
```

</details>

⏺ **Bash** — Add invoices module and run checks

```
set -e
Q="src/app/(crm)/presupuestos"
python3 - "$Q/[id]/page.tsx" <<'EOF'
import sys
p=sys.argv[1];s=open(p).read()
s=s.replace('''            <form
              action={changeQuoteStatus''','''            <form
              key={quote.status}
              action={changeQuoteStatus''')
open(p,'w').write(s)
EOF
F="src/app/(crm)/facturas"
mkdir -p "$F/[id]"
cat > "$F/queries.ts" <<'EOF'
import { desc, eq, like } from "drizzle-orm";
import { getDb } from "@/db/client";
import { invoices } from "@/db/schema";

/** All invoices, newest first, with client and lines (to compute totals). */
export async function listInvoices() {
  return getDb().query.invoices.findMany({
    orderBy: [desc(invoices.issuedAt), desc(invoices.id)],
    with: {
      client: { columns: { id: true, name: true } },
      items: true,
    },
  });
}

/** One invoice with its client, lines and source quote. */
… (+295 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

</details>

⏺ Las tres entidades compilan. Paso un `next build` sin base de datos para ver si cacheComponents se queja.

⏺ **Bash** — Run production build

```
pnpm build 2>&1 | tail -40
```

<details><summary>Resultado</summary>

```
$ next build
▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 14ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 1483ms
  Running TypeScript ...
  Finished TypeScript in 1334ms ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (0/15) ...
Error occurred prerendering page "/clientes". Read more: https://nextjs.org/docs/messages/prerender-error
Error: DATABASE_URL is not set
    at <unknown> (src/db/client.ts:14:13)
    at f (src/app/(crm)/clientes/queries.ts:6:10)
    at i (src/app/(crm)/clientes/page.tsx:30:25)
  12 |     const url = process.env.DATABASE_URL;
  13 |     if (!url) {
> 14 |       throw new Error("DATABASE_URL is not set");
     |             ^
  15 |     }
  16 |     db = drizzle(neon(url), { schema });
  17 |   } {
  digest: '2585372097'
… (+4 líneas)
```

</details>

⏺ DB queries run at prerender time. I'll mark each data component with `await connection()` as the docs say.

⏺ **Bash** — Add connection() to list data components and rebuild

```
set -e
cd "src/app/(crm)"
for f in clientes/page.tsx presupuestos/page.tsx facturas/page.tsx; do
python3 - "$f" <<'EOF'
import sys,re
p=sys.argv[1];s=open(p).read()
s=s.replace('import { Suspense } from "react";','import { connection } from "next/server";\nimport { Suspense } from "react";')
s=re.sub(r'(async function \w+Table\(\) \{\n)', r'\1  // Read the database at request time, never at build time.\n  await connection();\n', s)
open(p,'w').write(s)
EOF
done
grep -n "connection" */page.tsx
cd - >/dev/null; pnpm format >/dev/null; pnpm build 2>&1 | tail -30
```

<details><summary>Resultado</summary>

```
facturas/page.tsx:3:import { connection } from "next/server";
facturas/page.tsx:31:  await connection();
clientes/page.tsx:3:import { connection } from "next/server";
clientes/page.tsx:32:  await connection();
presupuestos/page.tsx:3:import { connection } from "next/server";
presupuestos/page.tsx:36:  await connection();
$ prettier --write .
  Generating static pages using 11 workers (11/15) 
✓ Generating static pages using 11 workers (15/15) in 267ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/health
├ ◐ /clientes
├   /clientes/[id]
│ └ ◐ /clientes/[id]
├   /clientes/[id]/editar
│ └ ◐ /clientes/[id]/editar
├ ○ /clientes/nuevo
├ ◐ /facturas
├   /facturas/[id]
│ └ ◐ /facturas/[id]
├ ○ /login
… (+11 líneas)
```

</details>

⏺ **Bash** — Commit fix and quotes/invoices feature

```
set -e
git add "src/app/(crm)/clientes/page.tsx" && git commit -q -m "fix: read clients at request time instead of during prerender

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add -A -- . ':!docs' && git commit -q -m "feat: add quotes with line items, status changes and invoice generation

Quotes and invoices are committed together because the quote detail page
generates the invoice. Writes with lines use a single CTE statement so they
are atomic over the Neon HTTP driver.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline | head -3
```

<details><summary>Resultado</summary>

```
27f49f6 feat: add quotes with line items, status changes and invoice generation
54488ab fix: read clients at request time instead of during prerender
0318c87 feat: add clients list, detail, create and edit
```

</details>

⏺ Ahora el seed idempotente.

⏺ **Bash** — Write idempotent seed script

```
set -e
cat > src/db/seed.ts <<'EOF'
/**
 * Demo data (D14). Idempotent: run it as often as you like, it only inserts
 * what is missing (clients by email, quotes and invoices by number).
 * Run once against production; Neon preview branches inherit it.
 *
 *   pnpm db:seed
 */
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import {
  clients,
  invoiceItems,
  invoices,
  quoteItems,
  quotes,
  type InvoiceStatus,
  type QuoteStatus,
} from "./schema";

config({ path: [".env.local", ".env"], quiet: true });

type SeedLine = [description: string, quantity: number, unitPriceCents: number, taxRate: number];

const CLIENTS = [
  { name: "Lucía Fernández Ruiz", email: "lucia.fernandez@example.com", phone: "+34 611 204 318", company: "Estudio Alba Arquitectura" },
  { name: "Javier Moreno Castillo", email: "javier.moreno@example.com", phone: "+34 622 731 095", company: "Talleres Moreno" },
  { name: "Carmen Navarro Gil", email: "carmen.navarro@example.com", phone: "+34 633 418 772", company: "Navarro Abogados" },
… (+170 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
OK
```

</details>

⏺ Hago el seed más robusto: si se corta a mitad, la siguiente ejecución completa las líneas que falten.

⏺ **Bash** — Make seed resumable and commit

```
set -e
python3 - <<'EOF'
p='src/db/seed.ts';s=open(p).read()
start=s.index('    // Lines are only inserted')
end=s.index('  console.log(')
new='''    // Insert-or-skip by number, then add lines only if the document has
    // none: re-running never duplicates, and a half-finished run is completed.
    const inserted = await db
      .insert(quotes)
      .values({
        number: seed.number,
        clientId: id,
        status: seed.status,
        issuedAt: seed.issuedAt,
        notes: seed.notes,
      })
      .onConflictDoNothing({ target: quotes.number })
      .returning({ id: quotes.id });
    newQuotes += inserted.length;
    const [quote] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.number, seed.number));
    if (!quote) throw new Error(`Missing quote ${seed.number}`);
    const hasQuoteItems = await db
      .select({ id: quoteItems.id })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quote.id))
      .limit(1);
    if (hasQuoteItems.length === 0) {
… (+36 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
a183986 feat: add idempotent seed script
```

</details>

⏺ Ahora el smoke de Playwright.

⏺ **Bash** — Add Playwright config and smoke tests

```
set -e
mkdir -p e2e
cat > playwright.config.ts <<'EOF'
import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: [".env.local", ".env"], quiet: true });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Local smoke tests (H1). They need a seeded database and the demo
 * credentials in .env.local. Run with `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
… (+73 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
 Test Files  9 passed (9)
      Tests  51 passed (51)
```

</details>

⏺ **Bash** — Commit e2e tests and add CI workflow

```
set -e
git add -A -- . ':!docs' && git commit -q -m "test: add Playwright smoke tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
mkdir -p .github/workflows && cp ../crm-agents/.github/workflows/ci.yml .github/workflows/ci.yml
pnpm format:check >/dev/null && git add .github && git commit -q -m "ci: add lint, format, typecheck and test workflow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -2
```

<details><summary>Resultado</summary>

```
$ prettier --check .
805ffed ci: add lint, format, typecheck and test workflow
5239d7c test: add Playwright smoke tests
```

</details>

⏺ Ahora la documentación: README, AGENTS.md, CLAUDE.md y `.env.example`.

⏺ **Bash** — Write README, AGENTS, CLAUDE and env example

```
set -e
cat > .env.example <<'EOF'
# Copia este archivo a .env.local y rellena los valores. Nunca subas claves reales.
# En Vercel, la integración de Neon crea DATABASE_URL y DATABASE_URL_UNPOOLED
# (una rama por vista previa); el resto se añade a mano.

# Neon: cadena con pooling, la usa la app (driver HTTP).
DATABASE_URL=<database-url>
# Neon: conexión directa, la usa drizzle-kit para las migraciones.
DATABASE_URL_UNPOOLED=<database-url>

# Login de demo. AUTH_SECRET firma la cookie (genera uno con `openssl rand -base64 32`).
AUTH_SECRET=
DEMO_USER=demo
DEMO_PASSWORD=
EOF
cat > README.md <<'EOF'
# crm-demo

Mini CRM de clientes, presupuestos y facturas. Es el proyecto que modifican los agentes de
[`crm-agents`](https://github.com/daboy-dev/crm-agents): reciben una petición en lenguaje natural,
abren una rama y un PR aquí, y cada PR tiene su vista previa en Vercel con su propia rama de Neon.

Las decisiones de arquitectura, el proceso y las transcripciones viven en `crm-agents/docs/`.

## Qué hace

- **Clientes:** listar, ver, crear y editar.
- **Presupuestos:** listar, ver con líneas y totales (base, IVA y total), crear con líneas y cambiar de estado.
- **Facturas:** generar desde un presupuesto aceptado (copia sus líneas), listar, ver y marcar como pagada.
… (+167 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --check .
A  .env.example
A  AGENTS.md
A  CLAUDE.md
A  README.md
1517a4a docs: add README, AGENTS.md, CLAUDE.md and env example
```

</details>

⏺ Todo está commiteado. Ahora verifico en local, sin base de datos: build, proxy y login.

⏺ **Bash** — Start dev server with throwaway test credentials

```
AUTH_SECRET=local-test-secret DEMO_USER=demo DEMO_PASSWORD=local-pass PORT=3100 pnpm dev > <scratchpad>/dev.log 2>&1
```

<details><summary>Resultado</summary>

```
Command running in background with ID: bvd7w2yba. Output is being written to: <tmp> You will be notified when it completes — do not poll that file or sleep while waiting. Read the file only if the user asks for progress, or if you need a line it prints before you can go on, such as a server's ready line or port.
```

</details>

⏺ **Bash** — Check proxy redirects, health and login page

```
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3100/login && break; sleep 1; done
echo "--- /clientes no session:"; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" localhost:3100/clientes
echo "--- /api/health:"; curl -s -w " %{http_code}\n" localhost:3100/api/health
echo "--- /login:"; curl -s localhost:3100/login | grep -o 'data-testid="login-[a-z]*"' | sort -u
echo "--- forged cookie:"; curl -s -o /dev/null -w "%{http_code}\n" -b "crm_session=eyJ1c2VyIjoiZGVtbyIsImV4cCI6OTk5OTk5OTk5OX0.abc" localhost:3100/clientes
git status --short; git diff --stat
```

<details><summary>Resultado</summary>

```
--- /clientes no session:
307 http://localhost:3100/login
--- /api/health:
{"ok":false,"db":false,"version":"0.1.0"} 503
--- /login:
data-testid="login-form"
data-testid="login-submit"
--- forged cookie:
307
```

</details>

⏺ The proxy works: it redirects without a session and rejects a forged cookie. Health returns 503 because there's no DB, as expected. Now I'll test the real login in the browser pane.

⏺ **Navegador · browser_batch**

```
{
 "actions": [
  {
   "name": "navigate",
   "input": {
    "url": "http://localhost:3100/login"
   }
  },
  {
   "name": "find",
   "input": {
    "query": "Usuario"
… (+4 líneas)
```

<details><summary>Resultado</summary>

```
[navigate] {
  "serverId": "preview-<session>",
  "tabId": "seed",
  "reused": false,
  "type": "browser",
  "navOk": true
}
Browser pane opened. Use serverId "preview-<session>" with read_page / computer / navigate.
[find] Found 2 match(es) for "Usuario":
- generic "Inicia sesión con el usuario de demo." [ref_3]
- generic "Usuario" [ref_10]


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Iniciar sesión · crm-demo" ("http://localhost:3100/login")
```

</details>

⏺ **Navegador · browser_batch**

```
{
 "actions": [
  {
   "name": "computer",
   "input": {
    "action": "left_click",
    "ref": "ref_10",
    "action_summary": "Focuses the user field"
   }
  },
  {
   "name": "javascript_tool",
… (+51 líneas)
```

<details><summary>Resultado</summary>

```
[computer:left_click] left_click at (370, 339) [ref_10]


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Iniciar sesión · crm-demo" ("http://localhost:3100/login")
[javascript_tool:javascript_exec] true


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Iniciar sesión · crm-demo" ("http://localhost:3100/login")
[computer:type] typed 4 chars


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Iniciar sesión · crm-demo" ("http://localhost:3100/login")
[javascript_tool:javascript_exec] true


Tab Context:
… (+32 líneas)
```

</details>

⏺ **Navegador · browser_batch**

```
{
 "actions": [
  {
   "name": "javascript_tool",
   "input": {
    "action": "javascript_exec",
    "text": "document.querySelector('[data-testid=field-user]').value; "
   }
  },
  {
   "name": "javascript_tool",
   "input": {
… (+51 líneas)
```

<details><summary>Resultado</summary>

```
[javascript_tool:javascript_exec] ""


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Iniciar sesión · crm-demo" ("http://localhost:3100/login")
[javascript_tool:javascript_exec] true


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Iniciar sesión · crm-demo" ("http://localhost:3100/login")
[computer:type] typed 4 chars


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Iniciar sesión · crm-demo" ("http://localhost:3100/login")
[javascript_tool:javascript_exec] true


Tab Context:
… (+31 líneas)
```

</details>

⏺ Login works: it gets past the proxy to `/clientes`, which fails only because there's no DB, as expected. One detail: after a wrong password the form clears the user field. I'll fix it.

⏺ **Bash** — Preserve username after failed login and commit

```
set -e
python3 - <<'EOF'
p='src/app/(auth)/login/actions.ts';s=open(p).read()
s=s.replace('export type LoginState = { error: string | null };','export type LoginState = { error: string | null; user: string };')
s=s.replace('return { error: "Usuario o contraseña incorrectos." };','return { error: "Usuario o contraseña incorrectos.", user };')
open(p,'w').write(s)
p='src/app/(auth)/login/login-form.tsx';s=open(p).read()
s=s.replace('const initialState: LoginState = { error: null };','const initialState: LoginState = { error: null, user: "" };')
s=s.replace('name="user" autoComplete="username" required','name="user"\n        autoComplete="username"\n        defaultValue={state.user}\n        required')
open(p,'w').write(s)
EOF
pnpm format >/dev/null; grep -n "defaultValue" "src/app/(auth)/login/login-form.tsx"; pnpm lint && pnpm typecheck >/dev/null && git add -A -- . ':!docs' && git commit -q -m "fix: keep the user name after a failed login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
$ prettier --write .
19:        defaultValue={state.user}
$ eslint
$ next typegen && tsc --noEmit
075aa5d fix: keep the user name after a failed login
```

</details>

⏺ Reviso el layout a 390 px en `/clientes/nuevo`, que no necesita base de datos.

⏺ **Navegador · browser_batch**

```
{
 "actions": [
  {
   "name": "resize_window",
   "input": {
    "width": 390,
    "height": 844
   }
  },
  {
   "name": "navigate",
   "input": {
… (+26 líneas)
```

<details><summary>Resultado</summary>

```
[resize_window] Viewport set to 390x844 on this tab (scaled down to fit if larger than the pane). Reset it with preset "desktop" as soon as you finish testing; the desktop app also clears a size you set when your turn ends or the pane's width changes, so set it again if you still need it. If the user wants to keep a phone or tablet size after your turn, they can pick Mobile or Tablet in the pane's Viewport menu; a custom size you simply set again next turn.


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "http://localhost:3100/clientes" ("http://localhost:3100/clientes")
- Viewport: emulating 390x844 (you set this; reset it with preset "desktop" when you finish testing; the app also clears it when your turn ends or the pane's width changes)
[navigate] navigated to http://localhost:3100/clientes/nuevo


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Nuevo cliente · crm-demo" ("http://localhost:3100/clientes/nuevo")
- Viewport: emulating 390x844 (you set this; reset it with preset "desktop" when you finish testing; the app also clears it when your turn ends or the pane's width changes)
[computer:wait] waited 2s


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Nuevo cliente · crm-demo" ("http://localhost:3100/clientes/nuevo")
- Viewport: emulating 390x844 (you set this; reset it with preset "desktop" when you finish testing; the app also clears it when your turn ends or the pane's width changes)
[javascript_tool:javascript_exec] 0
… (+17 líneas)
```

</details>

⏺ The 390 px layout looks right, with no horizontal scroll. I'll close the dev server and check that `next dev` didn't touch `AGENTS.md`.

⏺ **Navegador · resize_window**

```
{
 "preset": "desktop"
}
```

<details><summary>Resultado</summary>

```
Viewport emulation cleared; the tab is back to the pane's responsive size (desktop).


Tab Context:
- Executed on tabId: seed
- Available tabs:
  • tabId seed: "Nuevo cliente · crm-demo" ("http://localhost:3100/clientes/nuevo")
```

</details>

⏺ **Bash** — Stop dev server and run all checks

```
pkill -f "next dev" ; sleep 1; git status --short; ls; git log --oneline | cat; pnpm lint >/dev/null && pnpm format:check >/dev/null && pnpm typecheck >/dev/null && pnpm test 2>&1 | grep -E "Tests "
```

<details><summary>Resultado</summary>

```
AGENTS.md
CLAUDE.md
LICENSE
README.md
drizzle
drizzle.config.ts
e2e
eslint.config.mjs
next-env.d.ts
next.config.ts
node_modules
package.json
playwright.config.ts
pnpm-lock.yaml
pnpm-workspace.yaml
postcss.config.mjs
public
src
tsconfig.json
tsconfig.tsbuildinfo
vitest.config.ts
075aa5d fix: keep the user name after a failed login
1517a4a docs: add README, AGENTS.md, CLAUDE.md and env example
805ffed ci: add lint, format, typecheck and test workflow
5239d7c test: add Playwright smoke tests
… (+15 líneas)
```

</details>

⏺ **Bash** — Check whether docs folder still exists

```
ls -la docs 2>&1; git log --all --oneline -- docs | head; git stash list
```

<details><summary>Resultado</summary>

```
ls: docs: No such file or directory
```

</details>

⏺ **Resumen del turno:** crm-demo está construido en 14 commits locales en master. Lint, formato, tipos, 51 tests y el build pasan, y el login y el proxy funcionan en local. Las pantallas con datos, el seed y la generación de facturas siguen sin probar porque aún no hay base de datos. No he hecho push.

**Pregunta:** ¿Me avisas cuando el repo crm-demo exista en GitHub para hacer push?

⏺ H1 está montado en local, en 14 commits pequeños sobre `master`, sin hacer push. Pasan lint, formato, tipos, los 51 tests de Vitest y `next build`. Las pantallas con datos, el seed y la generación de facturas no los he podido probar, porque todavía no hay base de datos.

**Probado en el navegador, sin base de datos:**
- El proxy redirige a `/login` si no hay sesión y rechaza una cookie falsificada.
- Con una contraseña incorrecta sale el error. Con la correcta entra y llega a `/clientes`, que falla solo por falta de base de datos.
- `/api/health` responde 503 sin base de datos, como debe.
- A 390 px no hay scroll horizontal y la navegación cabe.

**Decisiones que conviene que sepas:**
- **Proxy:** en Next 16 el middleware se llama proxy, así que es [src/proxy.ts](src/proxy.ts). Lo explico en `AGENTS.md`.
- **cacheComponents:** al construir, las páginas intentaban leer la base de datos (lo corregí en un commit aparte). Ahora cada página que la lee va dentro de `<Suspense>` y las listas llaman a `await connection()`.
- **Atomicidad:** crear un presupuesto con sus líneas y generar una factura copiando las suyas se hace en una sola sentencia SQL. El driver HTTP de Neon no tiene transacciones interactivas.
- **Factura repetida:** un presupuesto solo puede tener una factura, así que pulsar "Generar factura" dos veces lleva a la que ya existe.
- **Un commit en vez de dos:** presupuestos y facturas van juntos, porque el detalle del presupuesto genera la factura. Así cada commit compila.
- **Seed:** se puede ejecutar varias veces sin duplicar. Si se corta a mitad, la siguiente ejecución completa lo que falte. Hay facturas con vencimiento el 19/09 y el 31/10 que siguen pendientes, sin marca de vencidas.
- **Sin hueco extra:** no hay pantalla de error propia (`error.tsx`), porque no estaba pedida.

**Sobre `docs/`:** la carpeta ya no está en el directorio. Ninguno de mis comandos la borró y nunca estuvo en git. Supongo que la quitaste tú; si no, avísame.

**Paso manual 1, te toca ahora:** crea el repo público `crm-demo` en GitHub y activa *Automatically delete head branches*. Cuando esté, añado el remoto, hago push y comprobamos que la CI pasa.

Después vendrán los pasos 2 a 4 (Vercel con Neon, Deployment Protection y variables). Con la base de datos creada lanzo el seed contra producción, paso el smoke de Playwright y hacemos el PR de prueba. Al final preparo la entrada "Sesión 03 · H1" y la transcripción.

¿Me avisas cuando el repo exista ("Repo creado") o prefieres cambiar algo antes?

---

## ❯ Usuario

El repo ya está en https://github.com/daboy-dev/crm-demo. De hecho ya debería estar el remoto configurado. Ya he activado el "automatically delete head branches".

⏺ **Bash** — Check git remote and GitHub repo settings

```
git remote -v; git ls-remote origin 2>&1 | head; gh repo view daboy-dev/crm-demo --json visibility,deleteBranchOnMerge,defaultBranchRef 2>&1
```

<details><summary>Resultado</summary>

```
origin	git@github.com:daboy-dev/crm-demo.git (fetch)
origin	git@github.com:daboy-dev/crm-demo.git (push)
d0364787fe08eb2176da012ec157eb156bf627ec	HEAD
d0364787fe08eb2176da012ec157eb156bf627ec	refs/heads/master
{"defaultBranchRef":{"name":"master"},"deleteBranchOnMerge":true,"visibility":"PUBLIC"}
```

</details>

⏺ Remoto configurado, repo público y borrado de ramas activo. El remoto solo tiene el commit inicial, así que el push es fast-forward.

⏺ **Bash** — Push master and list CI runs

```
git push origin master 2>&1 | tail -3; sleep 8; gh run list -R daboy-dev/crm-demo --limit 3
```

<details><summary>Resultado</summary>

```
To github.com:daboy-dev/crm-demo.git
   d036478..075aa5d  master -> master
in_progress		fix: keep the user name after a failed login	CI	master	push	45376597190	4s	2026-11-24T10:37:48Z
```

</details>

⏺ **Bash** — Wait for the CI run to finish

```
gh run watch 45376597190 -R daboy-dev/crm-demo --exit-status 2>&1 | tail -15
```

<details><summary>Resultado</summary>

```
JOBS
✓ check in 29s (ID 138384417777)
  ✓ Set up job
  ✓ Run actions/checkout@v7
  ✓ Run pnpm/action-setup@v6
  ✓ Run actions/setup-node@v7
  ✓ Run pnpm install --frozen-lockfile
  ✓ Run pnpm lint
  ✓ Run pnpm format:check
  ✓ Run pnpm typecheck
  ✓ Run pnpm test
  ✓ Post Run actions/setup-node@v7
  ✓ Post Run pnpm/action-setup@v6
  ✓ Post Run actions/checkout@v7
  ✓ Complete job
```

</details>

⏺ **Resumen del turno:** master está subido a GitHub (14 commits) y la primera CI pasó en 29 s: lint, formato, tipos y tests. Siguen pendientes Vercel con Neon, el seed en producción, el smoke E2E y el PR de prueba.

**Pregunta:** ¿Me avisas cuando estén hechos los pasos 2 a 4 en Vercel?

⏺ Ya está subido. El remoto estaba bien configurado y he hecho push de los 14 commits a `master`. La primera CI ha pasado en 29 s: install, lint, format:check, typecheck y test.

**Ahora te tocan los pasos 2 a 4, en Vercel:**

2. **Crear el proyecto `crm-demo`** importando el repo. No cambies nada del build: Vercel detecta el script `vercel-build`, que migra antes de `next build`.
   - Añade la integración **Neon** gestionada por Vercel.
   - Activa la creación de una rama por cada vista previa.
   - Activa el borrado de la rama de Neon al borrar la rama de Git.
   - Comprueba que crea `DATABASE_URL` y `DATABASE_URL_UNPOOLED` en los tres entornos.
3. **Desactivar la Deployment Protection** de las vistas previas (Settings → Deployment Protection).
4. **Añadir `AUTH_SECRET`, `DEMO_USER` y `DEMO_PASSWORD`** en Production y Preview. Para el secreto puedes usar `openssl rand -base64 32`.

**Ojo con el primer despliegue:** si se lanza antes de añadir las variables del paso 4, el login fallará. Tras añadirlas, haz un *Redeploy* de producción.

**Después sigo yo:**
- Con `vercel env pull .env.local` (o pásame tú el `.env.local`) lanzo `pnpm db:seed` contra producción, una sola vez.
- Paso el smoke de Playwright contra local y compruebo en producción el login y las tres entidades.
- Abro el PR de prueba para ver la rama `preview/...` en Neon y que desaparece al cerrarlo.

¿Me avisas cuando tengas hechos los pasos 2 a 4, o tienes alguna duda antes?

---

## ❯ Usuario

Pasos 2-4 hechos

⏺ **Bash** — Check Vercel CLI availability and login

```
which vercel neonctl neon 2>&1; vercel --version 2>&1 | tail -1; vercel whoami 2>&1 | tail -1; ls .vercel 2>&1
```

<details><summary>Resultado</summary>

```
Exit code 1
vercel not found
neonctl not found
neon not found
(eval):1: command not found: vercel
(eval):1: command not found: vercel
ls: .vercel: No such file or directory
```

</details>

⏺ **Bash** — List Vercel deployments reported to GitHub

```
gh api repos/daboy-dev/crm-demo/deployments --jq '.[] | [.id,.environment,.sha[0:7],.created_at] | @tsv' | head; for id in $(gh api repos/daboy-dev/crm-demo/deployments --jq '.[0:3][].id'); do gh api repos/daboy-dev/crm-demo/deployments/$id/statuses --jq '.[0] | [.state,.environment_url,.target_url] | @tsv'; done
```

<details><summary>Resultado</summary>

```
(Bash completed with no output)
```

</details>

⏺ **Bash** — Check commit statuses and Vercel app on repo

```
gh api repos/daboy-dev/crm-demo/commits/master/check-runs --jq '.check_runs[] | [.name,.status,.conclusion,.details_url] | @tsv'; gh api repos/daboy-dev/crm-demo/commits/master/status --jq '.statuses[] | [.context,.state,.target_url] | @tsv'; gh api repos/daboy-dev/crm-demo/hooks --jq '.[].config.url' 2>&1 | head -3; gh api repos/daboy-dev/crm-demo/installation 2>&1 | head -3
```

<details><summary>Resultado</summary>

```
check	completed	success	https://github.com/daboy-dev/crm-demo/actions/runs/45376597190/job/138384417777
Vercel	success	https://vercel.com/daboy-dev/crm-demo/<deployment>
{"message":"A JSON web token could not be decoded","documentation_url":"https://docs.github.com/rest","status":"401"}gh: A JSON web token could not be decoded (HTTP 401)
```

</details>

⏺ The Vercel deployment of `master` finished OK. I'll look for the production URL using the team's own alias.

⏺ **Bash** — Probe team-scoped production URLs for health

```
for u in https://crm-demo-daboy-dev.vercel.app https://crm-demo-daboy-devs-projects.vercel.app; do echo "$u"; curl -s -m 15 -w "  -> %{http_code}\n" "$u/api/health"; done
```

<details><summary>Resultado</summary>

```
https://crm-demo-daboy-dev.vercel.app
{"ok":true,"db":true,"version":"0.1.0+075aa5d"}  -> 200
https://crm-demo-daboy-devs-projects.vercel.app
The deployment could not be found on Vercel.

DEPLOYMENT_NOT_FOUND

cdg1::<request-id>
  -> 404
```

</details>

⏺ Producción ya responde: `/api/health` da `{"ok":true,"db":true}` con la versión `0.1.0+075aa5d`. Eso confirma que la migración se aplicó en el build, porque health consulta la tabla `clients`.

⏺ **Bash** — Check production routes are protected

```
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://crm-demo-daboy-dev.vercel.app/clientes; curl -s -o /dev/null -w "%{http_code}\n" https://crm-demo-daboy-dev.vercel.app/login
```

<details><summary>Resultado</summary>

```
307 https://crm-demo-daboy-dev.vercel.app/login
200
```

</details>

⏺ **Resumen del turno:** Producción está desplegada en crm-demo-daboy-dev.vercel.app: la migración se aplicó, health responde 200 con base de datos y el proxy protege /clientes. Faltan el seed, porque no tengo las variables en local ni la CLI de Vercel, el smoke E2E y el PR de prueba.

**Pregunta:** ¿Me avisas cuando tengas .env.local con las variables de producción?

⏺ Producción funciona en **https://crm-demo-daboy-dev.vercel.app**:
- `/api/health` responde 200 con `{"ok":true,"db":true,"version":"0.1.0+075aa5d"}`. Como health consulta la tabla `clients`, la migración de `vercel-build` se aplicó.
- `/clientes` sin sesión redirige a `/login`, que carga bien.
- La CI y el check de Vercel están en verde en `master`.

**Estoy bloqueado en el seed.** Necesito `DATABASE_URL` de producción en local. No tengo la CLI de Vercel ni sesión en ella, y prefiero no recibir claves por el chat. Ejecuta tú esto en el directorio del repo (el primer comando pide iniciar sesión en Vercel):

```bash
pnpm dlx vercel link --yes --project crm-demo
```

```bash
pnpm dlx vercel env pull .env.local --environment=production
```

`.env.local` ya está en `.gitignore` y no se sube. Si `DEMO_USER`, `DEMO_PASSWORD` o `AUTH_SECRET` llegan vacíos porque los marcaste como *sensitive*, añádelos a mano a ese archivo. Los necesito para pasar el smoke de Playwright contra producción.

Con eso lanzo `pnpm db:seed` una vez y lo repito para comprobar que no duplica nada. Después paso el smoke contra local y contra producción y abro el PR de prueba.

¿Me avisas cuando tengas el `.env.local` listo, o tienes alguna duda antes?

---

## ❯ Usuario

.env.local listo

⏺ **Bash** — Check which env vars are set without printing values

```
cd <repo>; git check-ignore -q .env.local && echo ignored; awk -F= '/^[A-Z_]+=/{v=substr($0,index($0,"=")+1); gsub(/"/,"",v); printf "%s %s\n",$1,(length(v)>0?"set":"EMPTY")}' .env.local | grep -E "^(DATABASE_URL|DATABASE_URL_UNPOOLED|AUTH_SECRET|DEMO_USER|DEMO_PASSWORD|VERCEL_ENV) "; grep -o '^VERCEL_ENV=.*' .env.local; ls .vercel 2>/dev/null
```

<details><summary>Resultado</summary>

```
ignored
AUTH_SECRET set
DATABASE_URL set
DATABASE_URL_UNPOOLED set
DEMO_PASSWORD set
DEMO_USER set
VERCEL_ENV set
VERCEL_ENV="production"
README.txt
project.json
```

</details>

⏺ Las cinco variables están presentes y el archivo es de producción. Lanzo el seed dos veces para comprobar la idempotencia.

⏺ **Bash** — Run seed against production twice

```
pnpm db:seed 2>&1 | tail -3; pnpm db:seed 2>&1 | tail -3
```

<details><summary>Resultado</summary>

```
$ tsx src/db/seed.ts
Seed done: 15 clients, 14 quotes, 5 invoices inserted.
$ tsx src/db/seed.ts
Seed done: 0 clients, 0 quotes, 0 invoices inserted.
```

</details>

⏺ Seed idempotente: 15/14/5 la primera vez y 0/0/0 la segunda. Compruebo que las líneas no se duplicaron y lanzo el smoke contra producción.

⏺ **Bash** — Count seeded rows and run smoke tests on production

```
cat > <scratchpad>/counts.ts <<'EOF'
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: [".env.local"], quiet: true });
const sql = neon(process.env.DATABASE_URL!);
const rows = await sql`select
 (select count(*) from clients) clients, (select count(*) from quotes) quotes,
 (select count(*) from quote_items) quote_items, (select count(*) from invoices) invoices,
 (select count(*) from invoice_items) invoice_items,
 (select string_agg(status::text || ':' || n, ' ') from (select status, count(*) n from quotes group by status) s) quote_status,
 (select string_agg(status::text || ':' || n, ' ') from (select status, count(*) n from invoices group by status) s) invoice_status,
 (select count(*) from invoices where status='pending' and due_at < current_date) overdue`;
console.log(rows[0]);
EOF
cp <scratchpad>/counts.ts ./.counts.tmp.ts && pnpm exec tsx ./.counts.tmp.ts; rm ./.counts.tmp.ts
E2E_BASE_URL=https://crm-demo-daboy-dev.vercel.app pnpm test:e2e 2>&1 | tail -20
```

<details><summary>Resultado</summary>

```
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

Error: Transform failed with 1 error:
<repo>/.counts.tmp.ts:5:13: ERROR: Top-level await is currently not supported with the "cjs" output format
    at failureErrorWithLog (<repo>/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js:1752:15)
    at <repo>/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js:1019:50
    at responseCallbacks.<computed> (<repo>/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js:886:9)
    at handleIncomingPacket (<repo>/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js:941:12)
    at Socket.readFromStdout (<repo>/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js:864:7)
    at Socket.emit (node:events:519:28)
    at addChunk (node:internal/streams/readable:561:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
    at Readable.push (node:internal/streams/readable:392:5)
    at Pipe.onStreamRead (node:internal/stream_base_commons:189:23) {
  name: 'TransformError'
}

Node.js v22.23.4
$ playwright test

Running 12 tests using 6 workers

  ✓   6 [desktop] › e2e/smoke.spec.ts:27:1 › health endpoint is public (932ms)
… (+13 líneas)
```

</details>

⏺ Smoke contra producción: 12/12 en escritorio y a 390 px. Repito el conteo como `.mts`.

⏺ **Bash** — Count seeded rows in production

```
S=<scratchpad>; cp $S/counts.ts ./.counts.tmp.mts && pnpm exec tsx ./.counts.tmp.mts; rm ./.counts.tmp.mts
```

<details><summary>Resultado</summary>

```
{
  clients: '15',
  quotes: '14',
  quote_items: '26',
  invoices: '5',
  invoice_items: '11',
  quote_status: 'sent:3 rejected:2 draft:3 accepted:6',
  invoice_status: 'paid:2 pending:3',
  overdue: '2'
}
```

</details>

⏺ **Bash** — Create test branch, push and open PR

```
set -e
git switch -q -c chore/preview-smoke-test
sed -i '' 's/Inicia sesión con el usuario de demo./Inicia sesión con el usuario de demo para entrar al CRM./' "src/app/(auth)/login/page.tsx"
git diff --stat
git commit -qam "chore: reword login subtitle to test preview deployments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q -u origin chore/preview-smoke-test 2>&1 | tail -2
gh pr create -R daboy-dev/crm-demo --base master --title "chore: reword login subtitle to test preview deployments" --body "PR de prueba de H1: comprueba que la vista previa de Vercel se despliega con su propia rama \`preview/...\` de Neon y que la rama desaparece al cerrar el PR y borrar la rama de Git.

Solo cambia el subtítulo del login. Se cierra sin fusionar.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

<details><summary>Resultado</summary>

```
src/app/(auth)/login/page.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
remote:      https://github.com/daboy-dev/crm-demo/pull/new/chore/preview-smoke-test        
remote: 
https://github.com/daboy-dev/crm-demo/pull/1
```

</details>

⏺ **Bash** — Wait for PR checks and read Vercel comment

```
sleep 20; gh pr checks 1 -R daboy-dev/crm-demo --watch --interval 15 2>&1 | tail -8; gh pr view 1 -R daboy-dev/crm-demo --json comments --jq '.comments[].body' | head -30
```

<details><summary>Resultado</summary>

```
Vercel	pass	0	https://vercel.com/daboy-dev/crm-demo/<deployment>	Deployment has completed
Vercel Preview Comments	pass	0	https://vercel.com/github	
check	pass	26s	https://github.com/daboy-dev/crm-demo/actions/runs/45386769797/job/138419610498	
check	pass	31s	https://github.com/daboy-dev/crm-demo/actions/runs/45386777366/job/138419635170	
Vercel	pass	0	https://vercel.com/daboy-dev/crm-demo/<deployment>	Deployment has completed
Vercel Preview Comments	pass	0	https://vercel.com/github	
check	pass	26s	https://github.com/daboy-dev/crm-demo/actions/runs/45386769797/job/138419610498	
check	pass	31s	https://github.com/daboy-dev/crm-demo/actions/runs/45386777366/job/138419635170	
[vc]: <metadatos de Vercel>
The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).

| Project | Deployment | Actions | Updated |
| :--- | :----- | :------ | :------ |
| <a href="https://vercel.com/daboy-dev/crm-demo"><sup><img src="https://vercel.com/api/www/avatar?projectId=<vercel-project-id>&teamId=<vercel-team-id>&s=32" width="16" height="16" align="middle" alt="" /></sup></a> [crm-demo](https://vercel.com/daboy-dev/crm-demo) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/daboy-dev/crm-demo/<deployment>) | [Preview](https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app) | <relative-time datetime="2026-11-24T11:43:44.749Z">Nov 24, 2026 11:43am UTC</relative-time> |
```

</details>

⏺ Vista previa lista. Compruebo que es accesible sin la protección de Vercel y que sirve el texto nuevo.

⏺ **Bash** — Check preview health, new text and protection

```
P=https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app; curl -s -w " %{http_code}\n" $P/api/health; curl -s $P/login | grep -o "para entrar al CRM" | head -1; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" $P/clientes
```

<details><summary>Resultado</summary>

```
{"ok":true,"db":true,"version":"0.1.0+7454512"} 200
para entrar al CRM
307 https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/login
```

</details>

⏺ **Bash** — Run write-flow test against the preview

```
cat > e2e/flows.tmp.spec.ts <<'EOF'
import { expect, test } from "@playwright/test";

const plain = (s: string | null) => (s ?? "").replace(/\s/g, " ");

test("create client → quote → accept → invoice → paid", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/login");
  await page.getByTestId("field-user").fill(process.env.DEMO_USER ?? "");
  await page.getByTestId("field-password").fill(process.env.DEMO_PASSWORD ?? "");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/clientes$/);

  // Client: create, duplicate email error, edit
  await page.getByTestId("new-client-button").click();
  await page.getByTestId("field-name").fill(`Prueba Preview ${stamp}`);
  await page.getByTestId("field-email").fill(`preview-${stamp}@example.com`);
  await page.getByTestId("save-button").click();
  await expect(page).toHaveURL(/\/clientes\/\d+$/);
  const clientUrl = page.url();
  await page.getByTestId("edit-client-button").click();
  await page.getByTestId("field-company").fill("Empresa Preview");
  await page.getByTestId("field-email").fill("lucia.fernandez@example.com");
  await page.getByTestId("save-button").click();
  await expect(page.getByText("Ya existe un cliente con ese email.")).toBeVisible();
  await expect(page.getByTestId("field-company")).toHaveValue("Empresa Preview");
  await page.getByTestId("field-email").fill(`preview-${stamp}@example.com`);
  await page.getByTestId("save-button").click();
  await expect(page).toHaveURL(clientUrl);
  await expect(page.getByTestId("client-company")).toHaveText("Empresa Preview");
… (+46 líneas)
```

<details><summary>Resultado</summary>

```
Running 1 test using 1 worker

  ✘  1 [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid (30.1s)


  1) [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ───────

    Test timeout of 30000ms exceeded.

    Error Context: test-results/flows.tmp-create-client-→-quote-→-accept-→-invoice-→-paid-desktop/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/flows.tmp-create-client-→-quote-→-accept-→-invoice-→-paid-desktop/trace.zip
    Usage:

        pnpm exec playwright show-trace test-results/flows.tmp-create-client-→-quote-→-accept-→-invoice-→-paid-desktop/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  1 failed
    [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ────────
```

</details>

⏺ **Bash** — Read Playwright error context

```
f=$(ls test-results/*/error-context.md); sed -n 1,80p "$f"
```

<details><summary>Resultado</summary>

```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows.tmp.spec.ts >> create client → quote → accept → invoice → paid
- Location: e2e/flows.tmp.spec.ts:5:1

# Error details

ˋˋˋ
Test timeout of 30000ms exceeded.
ˋˋˋ

# Page snapshot

ˋˋˋyaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "crm-demo" [ref=e5] [cursor=pointer]:
… (+30 líneas)
```

</details>

⏺ **Bash** — Inspect unique violation error shape from Neon

```
cat > ./.dup.tmp.mts <<'EOF'
import { config } from "dotenv";
config({ path: [".env.local"], quiet: true });
const { getDb } = await import("./src/db/client.ts");
const { clients } = await import("./src/db/schema.ts");
const { uniqueViolation } = await import("./src/db/errors.ts");
try {
  await getDb().insert(clients).values({ name: "x", email: "lucia.fernandez@example.com" });
} catch (e: any) {
  console.log("name:", e?.name, "| keys:", Object.keys(e ?? {}));
  console.log("cause name:", e?.cause?.name, "| cause keys:", Object.keys(e?.cause ?? {}));
  console.log("code:", e?.code, e?.cause?.code, "| constraint:", e?.constraint, e?.cause?.constraint);
  console.log("uniqueViolation ->", JSON.stringify(uniqueViolation(e)));
}
EOF
pnpm exec tsx ./.dup.tmp.mts; rm ./.dup.tmp.mts
```

<details><summary>Resultado</summary>

```
name: Error | keys: [ 'query', 'params', 'cause' ]
cause name: NeonDbError | cause keys: [
  'name',             'severity',
  'code',             'detail',
  'hint',             'position',
  'internalPosition', 'internalQuery',
  'where',            'schema',
  'table',            'column',
  'dataType',         'constraint',
  'file',             'line',
  'routine',          'sourceError'
]
code: undefined 23505 | constraint: undefined clients_email_unique
uniqueViolation -> "clients_email_unique"
```

</details>

⏺ Detection works (`clients_email_unique`), so the action does return the error. The problem must be on the UI side. I'll reproduce it on the preview and capture the action's response.

⏺ **Bash** — Reproduce duplicate email on preview with logging

```
cat > e2e/debug.tmp.spec.ts <<'EOF'
import { expect, test } from "@playwright/test";
test("debug duplicate email", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("field-user").fill(process.env.DEMO_USER ?? "");
  await page.getByTestId("field-password").fill(process.env.DEMO_PASSWORD ?? "");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/clientes$/);
  await page.goto("/clientes/nuevo");
  await page.getByTestId("field-name").fill("Dup");
  await page.getByTestId("field-email").fill("lucia.fernandez@example.com");
  const resp = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByTestId("save-button").click();
  const r = await resp;
  console.log("POST", r.status(), (await r.text()).slice(0, 600));
  await page.waitForTimeout(2000);
  console.log("URL", page.url());
  console.log("email value:", await page.getByTestId("field-email").inputValue());
  console.log("body:", (await page.locator("main").innerText()).slice(0, 400));
});
EOF
E2E_BASE_URL=https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app pnpm exec playwright test e2e/debug.tmp.spec.ts --project desktop 2>&1 | grep -E "POST|URL|email value|body|Ya existe|passed|failed" | head
```

<details><summary>Resultado</summary>

```
POST 200 {"experiments":{"id":"kTqO3Ld7F32CH1s2t8R8z","data":{}}}
URL https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/clientes/nuevo
email value: lucia.fernandez@example.com
body: Nuevo cliente
Ya existe un cliente con ese email.
  1 passed (5.6s)
```

</details>

⏺ **Bash** — Compare edit submit with and without hydration wait

```
cat > e2e/debug.tmp.spec.ts <<'EOF'
import { expect, test } from "@playwright/test";
for (const wait of [false, true]) {
  test(`edit duplicate email, wait for hydration=${wait}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("field-user").fill(process.env.DEMO_USER ?? "");
    await page.getByTestId("field-password").fill(process.env.DEMO_PASSWORD ?? "");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/clientes$/);
    await page.getByTestId("client-row").first().getByRole("link").click();
    await page.getByTestId("edit-client-button").click();
    await expect(page.getByTestId("client-form")).toBeVisible();
    if (wait) await page.waitForLoadState("networkidle");
    await page.getByTestId("field-company").fill("Cambio sin guardar");
    await page.getByTestId("field-email").fill("lucia.fernandez@example.com");
    await page.getByTestId("save-button").click();
    await page.waitForTimeout(3000);
    console.log(`wait=${wait}`, "company:", await page.getByTestId("field-company").inputValue(),
      "| error shown:", await page.getByText("Ya existe un cliente con ese email.").count());
  });
}
EOF
E2E_BASE_URL=https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app pnpm exec playwright test e2e/debug.tmp.spec.ts --project desktop --workers 1 2>&1 | grep -E "wait=|passed|failed"
```

<details><summary>Resultado</summary>

```
wait=false company: Cambio sin guardar | error shown: 1
wait=true company: Cambio sin guardar | error shown: 1
  2 passed (13.6s)
```

</details>

⏺ Both pass, so it's not hydration on its own. I'll rerun the full flow, this time printing the state right after saving the duplicate.

⏺ **Bash** — Rerun write flow with debug output

```
python3 - <<'EOF'
p='e2e/flows.tmp.spec.ts';s=open(p).read()
s=s.replace('''  await page.getByTestId("save-button").click();
  await expect(page.getByText("Ya existe''','''  await page.getByTestId("save-button").click();
  await page.waitForTimeout(3000);
  console.log("after dup:", page.url(), "| company:", await page.getByTestId("field-company").inputValue(), "| email:", await page.getByTestId("field-email").inputValue(), "| err:", await page.getByText("Ya existe").count());
  await expect(page.getByText("Ya existe''',1)
open(p,'w').write(s)
EOF
E2E_BASE_URL=https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app pnpm exec playwright test e2e/flows.tmp.spec.ts --project desktop 2>&1 | grep -E "after dup|client |passed|failed|Error:|Expected|Received" | head
```

<details><summary>Resultado</summary>

```
✘  1 [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid (30.1s)
  1) [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ───────
  1 failed
    [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ────────
```

</details>

⏺ Never got to "after dup", so it hangs earlier. I'll read the trace to see which step it's stuck on.

⏺ **Bash** — List trace actions to find the stuck step

```
S=<scratchpad>/trace; rm -rf $S; mkdir -p $S; unzip -q -o test-results/*/trace.zip -d $S; python3 -I - "$S" <<'EOF'
import json,sys,glob
for f in glob.glob(sys.argv[1]+"/*.trace"):
    for line in open(f):
        e=json.loads(line)
        if e.get("type")=="before":
            print(e.get("callId"), e.get("title") or e.get("apiName") or e.get("method"), json.dumps(e.get("params",{}))[:110])
        if e.get("type")=="after" and e.get("error"):
            print("  ERROR", str(e["error"])[:200])
EOF
```

<details><summary>Resultado</summary>

```
radx@43 newPage {}
radx@45 goto {"url": "/login", "waitUntil": "load"}
radx@47 fill {"selector": "internal:testid=[data-testid=\"field-user\"s]", "strict": true, "value": "<DEMO_USER>"}
radx@49 fill {"selector": "internal:testid=[data-testid=\"field-password\"s]", "strict": true, "value": "<DEMO_PASSWORD>"}
radx@51 click {"selector": "internal:testid=[data-testid=\"login-submit\"s]", "strict": true}
radx@53 Expect "toHaveURL" {"expression": "to.have.url", "expectedText": [{"regexSource": "\\/clientes$", "regexFlags": ""}], "expectedVa
radx@55 click {"selector": "internal:testid=[data-testid=\"new-client-button\"s]", "strict": true}
radx@57 fill {"selector": "internal:testid=[data-testid=\"field-name\"s]", "strict": true, "value": "Prueba Preview 1795520
radx@59 fill {"selector": "internal:testid=[data-testid=\"field-email\"s]", "strict": true, "value": "preview-1795520778315
radx@61 click {"selector": "internal:testid=[data-testid=\"save-button\"s]", "strict": true}
radx@63 Expect "toHaveURL" {"expression": "to.have.url", "expectedText": [{"regexSource": "\\/clientes\\/\\d+$", "regexFlags": ""}], "exp
radx@65 click {"selector": "internal:testid=[data-testid=\"edit-client-button\"s]", "strict": true}
radx@67 fill {"selector": "internal:testid=[data-testid=\"field-company\"s]", "strict": true, "value": "Empresa Preview"}
radx@1 Before Hooks {}
radx@30 Fixture "browser" {}
radx@31 Launch browser {}
radx@34 Fixture "context" {}
radx@35 Create context {}
radx@42 Fixture "page" {}
radx@43 Create page {}
radx@45 Navigate {"url": "/login"}
radx@47 Fill "<DEMO_USER>" {"locator": "getByTestId('field-user')", "value": "<DEMO_USER>"}
radx@49 Fill "<DEMO_PASSWORD>" {"locator": "getByTestId('field-password')", "value": "<DEMO_PASSWORD>"}
radx@51 Click {"locator": "getByTestId('login-submit')"}
radx@53 Expect "toHaveURL" {"expected": "Object"}
… (+22 líneas)
```

</details>

⏺ **Bash** — Inspect company field after create and edit

```
rm -rf test-results <scratchpad>/trace
cat > e2e/debug.tmp.spec.ts <<'EOF'
import { expect, test } from "@playwright/test";
test("create then edit", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("field-user").fill(process.env.DEMO_USER ?? "");
  await page.getByTestId("field-password").fill(process.env.DEMO_PASSWORD ?? "");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/clientes$/);
  await page.getByTestId("new-client-button").click();
  await page.getByTestId("field-name").fill("Debug");
  await page.getByTestId("field-email").fill(`debug-${Date.now()}@example.com`);
  await page.getByTestId("save-button").click();
  await expect(page).toHaveURL(/\/clientes\/\d+$/);
  await page.getByTestId("edit-client-button").click();
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="field-company"]')].map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const s = getComputedStyle(el);
        return { disabled: (el as HTMLInputElement).disabled, ro: (el as HTMLInputElement).readOnly, w: r.width, h: r.height, vis: s.visibility, disp: s.display, hidden: !!el.closest("[hidden]"), formTestId: el.closest("form")?.getAttribute("data-testid") };
      }),
    );
    console.log(i, page.url(), JSON.stringify(info));
  }
});
EOF
E2E_BASE_URL=https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app pnpm exec playwright test e2e/debug.tmp.spec.ts --project desktop --trace off 2>&1 | grep -E "^[0-9] |passed|failed"
```

<details><summary>Resultado</summary>

```
0 https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/clientes/34/editar [{"disabled":false,"ro":false,"w":542,"h":38,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"},{"disabled":false,"ro":false,"w":0,"h":0,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"}]
1 https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/clientes/34/editar [{"disabled":false,"ro":false,"w":542,"h":38,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"},{"disabled":false,"ro":false,"w":0,"h":0,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"}]
2 https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/clientes/34/editar [{"disabled":false,"ro":false,"w":542,"h":38,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"},{"disabled":false,"ro":false,"w":0,"h":0,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"}]
3 https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/clientes/34/editar [{"disabled":false,"ro":false,"w":542,"h":38,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"},{"disabled":false,"ro":false,"w":0,"h":0,"vis":"visible","disp":"block","hidden":false,"formTestId":"client-form"}]
  1 passed (8.2s)
```

</details>

⏺ **Bash** — Read Next docs on preserved route state

```
cd node_modules/next/dist/docs/01-app; grep -n -i "activity\|hidden\|opt out\|disable\|maxPreserved\|config" 02-guides/preserving-ui-state.md | head -40
```

<details><summary>Resultado</summary>

```
2:title: How Next.js preserves UI state with Activity
4:description: Learn how React's Activity component preserves UI state across navigations in Next.js and how to control what resets.
13:> **Good to know:** This guide assumes [Cache Components](/docs/app/getting-started/caching) is enabled. Enable it by setting [`cacheComponents: true`](/docs/app/api-reference/config/next-config-js/cacheComponents) in your Next config file.
17:Instead of unmounting pages on navigation, Next.js hides them using React's [`<Activity>`](https://react.dev/reference/react/Activity) component. Activity keeps the DOM in the document (hidden with `display: none`), so both React state and DOM state are preserved: form drafts, scroll positions, expanded `<details>` elements, video playback progress, and more.
25:Activity preserves all component state and DOM state by default. For each piece of state, you decide whether that's the right behavior for your UI. The patterns below show common scenarios and how to handle both sides.
29:When a user navigates away and returns, Activity preserves the open/closed state of expandable elements.
45:  // Close dropdown when this component becomes hidden
70:When Activity hides this component, the cleanup function runs and resets `isOpen`. When the page becomes visible again, the dropdown is closed. Using `useLayoutEffect` ensures the cleanup runs synchronously before the component is hidden, avoiding any flash of stale state.
76:Activity preserves dialog open/closed state. This also affects Effects that run based on that state.
80:**When to reset it:** A dialog that runs initialization logic (like focusing an input) each time it opens. If the user navigated away while the dialog was open, Activity preserves `isDialogOpen: true`. Opening it again sets it to `true` when it's already `true`, so no state change happens and the Effect doesn't re-run.
146:Activity preserves form input values (text fields, selected options, checkbox states), submission results, and status messages across navigations.
154:Consider a page where the user creates a new item. After submitting, `router.push` navigates to the new record. Since Activity preserves the page, navigating back shows the previous name still in the form. Reset state in the event handler to keep the form fresh:
207:  // Reset stale success message when Activity hides this component
235:You can use a callback ref to call `form.reset()` when Activity hides the component:
255:Activity preserves local component state (`useState`, DOM input values) across navigations, including authentication changes. This is standard React behavior: props changing (such as receiving a new user) triggers a re-render but does not reset existing state. A draft composed by one user shouldn't be visible to another.
285:Page-level styles (CSS variables, z-index, global classes) can affect visible pages when the originating component is hidden by Activity. You likely want to disable them when hidden: a hidden page's accent color or z-index overrides shouldn't leak into the visible page.
294:      if (style) style.media = 'not all' // Disable when hidden
323:When Activity hides the component, the cleanup sets `media="not all"`, which disables the stylesheet. When visible again, the effect re-runs and resets `media` to enable it.
337:  overflow: hidden;
351:> **Good to know:** If the hidden component itself defines the global `:has` rule, the toggle from the section above disables it along with the component's other styles.
355:Hidden Activity content has `display: none` but remains in the document. This applies both to routes preserved by Cache Components and to content you hide with `<Activity>` directly. It affects end-to-end testing with tools like Playwright, Cypress, or Puppeteer:
357:- **DOM queries can find hidden elements.** Selectors may match elements regardless of visibility.
358:- **Interactions with hidden elements fail or time out.** Most tools wait for an element to become visible before interacting, but waiting doesn't narrow a query that matches both a visible and a hidden element. Playwright reports this as a strict mode violation.
359:- **Assertions may match hidden content.** Be explicit about visibility when asserting element presence.
363:Prefer locators that query the accessibility tree, which leaves out hidden elements, or filter matches by visibility before acting on them. In Playwright, `getByRole` queries exclude hidden elements by default:
… (+15 líneas)
```

</details>

⏺ **Bash** — Read form reset and testing guidance

```
sed -n 140,255p 02-guides/preserving-ui-state.md; sed -n 360,392p 02-guides/preserving-ui-state.md
```

<details><summary>Resultado</summary>

```
ˋˋˋ

With this approach, `isDialogOpen` derives from the URL rather than component state. When navigating away and returning, the search param is cleared (the URL changed), so `isDialogOpen` becomes `false`. Opening the dialog sets the param, which changes `isDialogOpen` and triggers the Effect.

### Forms, inputs, and state

Activity preserves form input values (text fields, selected options, checkbox states), submission results, and status messages across navigations.

**When to keep it:** A search page with filters, a draft the user was composing, or a settings form with unsaved changes. Preserving input state is one of the biggest UX wins because the user doesn't lose work.

**When to reset it:** A "new transaction" flow where each visit should start fresh, or a form where stale success/error messages would be confusing in a new context.

#### Resetting form state on submit

Consider a page where the user creates a new item. After submitting, `router.push` navigates to the new record. Since Activity preserves the page, navigating back shows the previous name still in the form. Reset state in the event handler to keep the form fresh:

ˋˋˋtsx filename="app/new/page.tsx" highlight={13}
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewItemPage() {
  const [name, setName] = useState('')
  const router = useRouter()
… (+123 líneas)
```

</details>

⏺ **Bash** — Switch back to master in repo root

```
cd <repo> && git stash list && git status --short && git switch -q master && git branch --show-current
```

<details><summary>Resultado</summary>

```
?? e2e/debug.tmp.spec.ts
?? e2e/flows.tmp.spec.ts
master
```

</details>

⏺ **Bash** — Add ResetOnHide, visible-only test helper and docs

```
set -e
cat > src/components/reset-on-hide.tsx <<'EOF'
"use client";

import { Fragment, useLayoutEffect, useState, type ReactNode } from "react";

/**
 * Next.js keeps visited pages mounted but hidden (React <Activity>), so a
 * form would keep its typed values, errors and lines when the user comes
 * back. Wrapping it here remounts it fresh every time its page is hidden.
 * See node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md.
 */
export function ResetOnHide({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  useLayoutEffect(() => () => setGeneration((g) => g + 1), []);
  return <Fragment key={generation}>{children}</Fragment>;
}
EOF
python3 - <<'EOF'
import re
def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p,a)
        s=s.replace(a,b)
    open(p,'w').write(s)
imp='import { ResetOnHide } from "@/components/reset-on-hide";\n'
edit('src/app/(crm)/clientes/nuevo/page.tsx',[
 ('import { PageHeader }', imp+'import { PageHeader }'),
 ('      <ClientForm action={createClient} cancelHref="/clientes" />','      <ResetOnHide>\n        <ClientForm action={createClient} cancelHref="/clientes" />\n      </ResetOnHide>')])
… (+43 líneas)
```

<details><summary>Resultado</summary>

```
$ prettier --write .
$ eslint
$ next typegen && tsc --noEmit
      Tests  51 passed (51)
 AGENTS.md                                   |  5 ++++
 e2e/smoke.spec.ts                           | 39 +++++++++++++++--------------
 src/app/(auth)/login/page.tsx               |  5 +++-
 src/app/(crm)/clientes/[id]/editar/page.tsx | 23 +++++++++--------
 src/app/(crm)/clientes/nuevo/page.tsx       |  5 +++-
 src/app/(crm)/presupuestos/nuevo/page.tsx   | 15 ++++++-----
 6 files changed, 55 insertions(+), 37 deletions(-)
```

</details>

⏺ **Bash** — Commit fixes, push master, rebase test PR

```
set -e
git add src/components/reset-on-hide.tsx "src/app" && git commit -q -m "fix: reset forms when Next.js hides their page

Cache Components keeps visited pages mounted in a hidden <Activity>, so
create, edit and login forms kept typed values and errors (and the hidden
password) after navigating away.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add e2e/helpers.ts e2e/smoke.spec.ts AGENTS.md && git commit -q -m "test: select only visible test ids in Playwright

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin master
git switch -q chore/preview-smoke-test && git rebase -q master && git push -q --force-with-lease origin chore/preview-smoke-test
git log --oneline -4; git status --short
```

<details><summary>Resultado</summary>

```
de0051b chore: reword login subtitle to test preview deployments
609c2dc test: select only visible test ids in Playwright
a32aefc fix: reset forms when Next.js hides their page
075aa5d fix: keep the user name after a failed login
?? e2e/debug.tmp.spec.ts
?? e2e/flows.tmp.spec.ts
```

</details>

⏺ **Bash** — Wait for preview redeploy and run all E2E on it

```
set -e
rm e2e/debug.tmp.spec.ts
python3 - <<'EOF'
p='e2e/flows.tmp.spec.ts';s=open(p).read()
s=s.replace('import { expect, test } from "@playwright/test";','import { expect, test } from "@playwright/test";\nimport { byTestId } from "./helpers";')
s=s.replace('page.getByTestId(','byTestId(page, ')
# remove debug line
s='\n'.join(l for l in s.split('\n') if 'after dup' not in l and 'waitForTimeout(3000)' not in l)
s=s.replace('  console.log("client", clientUrl);','''
  // Forms start empty again after leaving them (ResetOnHide)
  await byTestId(page, "nav-clientes").click();
  await byTestId(page, "new-client-button").click();
  await expect(byTestId(page, "field-name")).toHaveValue("");
  await expect(byTestId(page, "field-email")).toHaveValue("");
  await byTestId(page, "nav-presupuestos").click();
  await byTestId(page, "new-quote-button").click();
  await expect(byTestId(page, "quote-item-row")).toHaveCount(1);
  await expect(byTestId(page, "item-0-description")).toHaveValue("");''')
open(p,'w').write(s)
EOF
sleep 30; gh pr checks 1 -R daboy-dev/crm-demo --watch --interval 15 2>&1 | tail -4
P=https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app; curl -s $P/api/health; echo
E2E_BASE_URL=$P pnpm exec playwright test --trace off 2>&1 | tail -6
```

<details><summary>Resultado</summary>

```
Vercel	pass	0	https://vercel.com/daboy-dev/crm-demo/<deployment>	Deployment has completed
Vercel Preview Comments	pass	0	https://vercel.com/github	
check	pass	29s	https://github.com/daboy-dev/crm-demo/actions/runs/45387552953/job/138422358975	
check	pass	28s	https://github.com/daboy-dev/crm-demo/actions/runs/45387558725/job/138422372832	
{"ok":true,"db":true,"version":"0.1.0+de0051b"}
  ✓  13 [mobile-390] › e2e/smoke.spec.ts:47:1 › shows a quote with its lines and totals (3.1s)
  ✓  14 [mobile-390] › e2e/smoke.spec.ts:56:1 › has no horizontal page scroll (3.6s)
  ✓   1 [desktop] › e2e/flows.tmp.spec.ts:6:1 › create client → quote → accept → invoice → paid (14.9s)
  ✓   8 [mobile-390] › e2e/flows.tmp.spec.ts:6:1 › create client → quote → accept → invoice → paid (13.5s)

  14 passed (15.6s)
```

</details>

⏺ **Bash** — Confirm preview writes did not reach production

```
cat > ./.chk.tmp.mts <<'EOF'
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: [".env.local"], quiet: true });
const sql = neon(process.env.DATABASE_URL!);
console.log((await sql`select (select count(*) from clients) clients, (select count(*) from clients where name like 'Prueba Preview%' or name in ('Dup','Debug')) test_clients, (select count(*) from quotes) quotes, (select count(*) from invoices) invoices`)[0]);
EOF
pnpm exec tsx ./.chk.tmp.mts; rm ./.chk.tmp.mts
```

<details><summary>Resultado</summary>

```
{ clients: '15', test_clients: '0', quotes: '14', invoices: '5' }
```

</details>

⏺ **Bash** — Move temp flow spec out of repo and return to master

```
mv e2e/flows.tmp.spec.ts <scratchpad>/flows.spec.ts; rm -rf test-results; git status --short; git switch -q master; git branch --show-current
```

<details><summary>Resultado</summary>

```
master
```

</details>

⏺ **Resumen del turno:** Producción tiene datos y pasa el smoke. La vista previa del PR 1 pasa smoke y escrituras con una base de datos propia, y producción no se tocó. Arreglé un problema de Next 16: las páginas visitadas siguen montadas y ocultas. Falta ver en Neon la rama preview/ y su borrado al cerrar el PR.

**Pregunta:** ¿Ves en Neon la rama preview/chore/preview-smoke-test?

⏺ Casi todo H1 está verificado. Solo falta comprobar en Neon la rama de la vista previa y que desaparece al cerrar el PR, y eso solo puedes verlo tú en la consola.

**Producción ([crm-demo-daboy-dev.vercel.app](https://crm-demo-daboy-dev.vercel.app))**
- Seed aplicado: 15 clientes, 14 presupuestos (3 borradores, 3 enviados, 6 aceptados, 2 rechazados), 26 líneas y 5 facturas (2 pagadas y 3 pendientes, 2 de ellas vencidas).
- Al ejecutarlo por segunda vez insertó 0 filas, así que no duplica.
- Smoke de Playwright contra producción: 12/12 en escritorio y a 390 px.

**PR de prueba: [daboy-dev/crm-demo#1](https://github.com/daboy-dev/crm-demo/pull/1)**
- CI y Vercel en verde. La vista previa no pide la autenticación de Vercel y muestra el texto nuevo.
- Sobre la vista previa he probado también las escrituras, en escritorio y a 390 px:
  - Crear un cliente, ver el error de email duplicado y editarlo.
  - Crear un presupuesto con 2 líneas y comprobar los totales (231,50 € de base, 45,15 € de IVA y 276,65 € de total).
  - Aceptarlo, generar la factura con las líneas copiadas y marcarla como pagada.
- Nada de eso llegó a producción, que sigue en 15/14/5. La vista previa sí tenía los datos del seed, así que usa una base de datos propia que los heredó de producción.

**Un problema que encontré y corregí (2 commits en `master`)**
- En Next 16 con `cacheComponents`, las páginas visitadas siguen montadas aunque estén ocultas (React `<Activity>`). Eso tenía dos efectos:
  1. Los formularios conservaban lo escrito, los errores y hasta la contraseña oculta del login. Ahora `ResetOnHide` los reinicia al ocultar su página.
  2. Un mismo `data-testid` aparecía dos veces en el DOM y los tests de Playwright se quedaban colgados. Ahora se selecciona con `byTestId()` de `e2e/helpers.ts`, que filtra los visibles. Lo he documentado en `AGENTS.md` para el agente de Testing.
- El test de escrituras no lo he subido porque escribe datos. Lo he guardado en `<scratchpad>/flows.spec.ts` por si sirve para H2.

**Para la transcripción saneada:** al revisar una traza de Playwright salieron en claro el `DEMO_USER` y el `DEMO_PASSWORD` de producción. Ya borré la traza, pero habrá que taparlos en `docs/sesiones/03-h1-crm-demo.md`, o cambiar la contraseña si prefieres.

**Lo que falta**
1. Compruebes en la consola de Neon que existe la rama `preview/chore/preview-smoke-test`.
2. Yo cierro el PR y borro la rama de Git.
3. Compruebes que la rama de Neon desaparece.
4. Redacto la entrada "Sesión 03 · H1" y la transcripción.

¿Ves en Neon la rama `preview/chore/preview-smoke-test` ("Sí, está") o no aparece?

---

## ❯ Usuario

Sí, está

⏺ **Bash** — Close test PR and delete its branch

```
gh pr close 1 -R daboy-dev/crm-demo --delete-branch --comment "PR de prueba de H1: vista previa y rama de Neon verificadas. Se cierra sin fusionar." 2>&1 | tail -3; git branch -a; git ls-remote --heads origin
```

<details><summary>Resultado</summary>

```
✓ Closed pull request daboy-dev/crm-demo#1 (chore: reword login subtitle to test preview deployments)
✓ Deleted branch chore/preview-smoke-test
  chore/preview-smoke-test
* master
  remotes/origin/HEAD -> origin/master
  remotes/origin/chore/preview-smoke-test
  remotes/origin/master
609c2dcfcad1dfa613d18f98eeb72db915462d81	refs/heads/master
```

</details>

⏺ **Bash** — Prune local branch refs and check preview alias

```
git fetch -q --prune && git branch -D chore/preview-smoke-test && git branch -a; curl -s -o /dev/null -w "preview now: %{http_code}\n" https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/api/health
```

<details><summary>Resultado</summary>

```
Eliminada la rama chore/preview-smoke-test (era de0051b).
* master
  remotes/origin/HEAD -> origin/master
  remotes/origin/master
preview now: 200
```

</details>

⏺ PR cerrado y rama borrada en GitHub y en local. Mientras compruebas Neon, preparo los textos de cierre. Primero miro el formato que ya usa `crm-agents`.

⏺ **Bash** — Inspect crm-agents process docs structure

```
cd ../crm-agents && git status --short && ls docs docs/sesiones && grep -n "^## \|^### " docs/PROCESO.md | head -40 && wc -l docs/sesiones/*
```

<details><summary>Resultado</summary>

```
docs:
DECISIONES.md
PROCESO.md
sesiones

docs/sesiones:
01-h0-base.md
14:## Hitos
30:## Sesión 00 · Planificación (Project de Claude) · 23/11/2026
48:## Sesión 01 · H0 · Base del repo (Claude Code) · 23/11/2026
72:## Sesión 02 · Planificación de H1 (Project de Claude) · 23/11/2026
    1015 docs/sesiones/01-h0-base.md
Shell cwd was reset to <repo>
```

</details>

⏺ **Bash** — Read PROCESO.md and session 01 header

```
cd ../crm-agents && sed -n 1,95p docs/PROCESO.md; echo ====; sed -n 1,40p docs/sesiones/01-h0-base.md; echo ...; grep -n -i "redact\|\[oculto\]\|REDACT\|<.*>" docs/sesiones/01-h0-base.md | head -10
```

<details><summary>Resultado</summary>

```
# Proceso

Cómo se ha construido este proyecto, sesión a sesión.

**Método de trabajo:**
- **Planificación y decisiones** en un Project de Claude dedicado a la prueba (claude.ai). Ahí se discuten las opciones y se deciden.
- **Implementación** con **Claude Code** en este repo, una sesión por hito.
- Al cerrar cada sesión:
  - Una entrada aquí con objetivo, cómo fue, qué salió mal y qué se corrigió.
  - La transcripción en [`docs/sesiones/`](./sesiones), sin claves ni datos sensibles.
  - `CLAUDE.md` actualizado si cambia algo del proyecto.
- Las decisiones de arquitectura están en [`DECISIONES.md`](./DECISIONES.md).

## Hitos

| Hito | Se da por verificado cuando… | Estado |
|---|---|---|
| H0 · Plan y base del repo | Plan validado, documentos en el repo, esqueleto desplegado en Vercel con CI en verde | Hecho |
| H1 · CRM demo | `crm-demo` en producción con clientes, presupuestos y facturas, CI en verde, y un PR de prueba que crea su vista previa con su propia rama de Neon y la borra al cerrarse | En curso |
| H2 · Tubería sin IA | Un commit de prueba genera vista previa, webhook y capturas de Actions que llegan al panel | Pendiente |
| H3 · Panel y motor de runs | Login y un run completo con `MockProvider` | Pendiente |
| H4 · Orquestador | Plan con criterios de aceptación que el cliente aprueba o rechaza | Pendiente |
| H5 · Develop | PR real que compila en su vista previa | Pendiente |
| H6 · Testing | Un fallo provocado vuelve a Develop y se corrige o se bloquea | Pendiente |
| H7 · Panel completo | Run real de principio a fin en móvil y escritorio | Pendiente |
… (+114 líneas)
```

</details>

⏺ `crm-agents` usa el formato de `/export` del terminal, saneado con marcadores (`<repo>`, `<scratchpad>`, `<session>`). Voy a ver si puedo exportar esta transcripción desde aquí.

⏺ Puedo exportar la transcripción desde aquí. Lo haré al final para que salga completa, cuando confirmes lo de Neon.

⏺ **Resumen del turno:** PR 1 cerrado sin fusionar y rama chore/preview-smoke-test borrada en GitHub y en local. Falta comprobar en Neon que su rama preview/ desaparece. Después redacto la Sesión 03 y la transcripción saneada.

**Pregunta:** ¿Ha desaparecido en Neon la rama preview/chore/preview-smoke-test?

⏺ He cerrado el PR [daboy-dev/crm-demo#1](https://github.com/daboy-dev/crm-demo/pull/1) sin fusionar y he borrado la rama `chore/preview-smoke-test` en GitHub y en local. En el remoto ya solo queda `master`.

Ahora la integración debería borrar la rama de Neon. Mira en la consola de Neon (Branches) si `preview/chore/preview-smoke-test` ha desaparecido; puede tardar unos segundos.

Cuando lo confirmes, cierro H1:
- La entrada "Sesión 03 · H1" en `crm-agents/docs/PROCESO.md` y la fila de H1 de la tabla de hitos, como cambios sin commitear para que los revises.
- La transcripción completa de esta sesión, exportada y saneada en `crm-agents/docs/sesiones/03-h1-crm-demo.md`. Quitaré rutas, IDs de Vercel y Neon, emails y las credenciales de demo que salieron en la traza.

¿Ha desaparecido ya la rama en Neon ("Sí, ya no está") o sigue ahí?

---

## ❯ Usuario

Por el momento sigue ahí, pero en configuración está que se debe borrar cuándo se borre la rama de git. De hecho la marca como obsoleta ya porque la rama de Git no existe, así que entiendo que tardará unos minutos en borrarse. En cualquier caso estaré vigilando y, si no desaparece, volvemos a verificar los ajustes.

⏺ **Bash** — Check whether old preview still reaches its DB

```
curl -s -w " %{http_code}\n" https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/api/health
```

<details><summary>Resultado</summary>

```
{"ok":true,"db":true,"version":"0.1.0+de0051b"} 200
```

</details>

⏺ The old preview still reaches its branch, so it hasn't been deleted yet. Since you'll keep watching, I'll write the entry with that check marked as pending.

⏺ **Bash** — Check end of PROCESO.md

```
cd ../crm-agents && tail -c 200 docs/PROCESO.md | od -c | tail -3
```

<details><summary>Resultado</summary>

```
0000260    )       e   n       e   l       r   e   p   o       `   c   r
0000300    m   -   d   e   m   o   `   .                                
0000310
Shell cwd was reset to <repo>
```

</details>

⏺ **Bash** — Add Sesión 03 entry and update H1 row

```
cd ../crm-agents && python3 - <<'EOF'
p='docs/PROCESO.md'; s=open(p).read()
old='| H1 · CRM demo | `crm-demo` en producción con clientes, presupuestos y facturas, CI en verde, y un PR de prueba que crea su vista previa con su propia rama de Neon y la borra al cerrarse | En curso |'
assert old in s
s=s.replace(old, old.replace('| En curso |','| Hecho (falta confirmar que Neon borra la rama) |'))
s=s.rstrip('\n')+'\n'+'''
## Sesión 03 · H1 · CRM demo (Claude Code) · 24/11/2026

**Objetivo:** poner `crm-demo` en producción en Vercel, con clientes, presupuestos y facturas, CI en verde y una vista previa por PR con su propia rama de Neon (D11–D14).

**Cómo fue:**
- Claude propuso primero un plan de commits y diez decisiones de detalle. Empezó a generar el proyecto tras el visto bueno.
- Configuración copiada de `crm-agents`: Next.js 16.4, pnpm, TypeScript estricto con `noUncheckedIndexedAccess`, ESLint, Prettier (sin Markdown), Vitest y la misma CI. Se añadieron Tailwind 4 y Playwright.
- Modelo de datos en `src/db/schema.ts`:
  - Ids enteros, importes en céntimos e IVA como porcentaje entero.
  - Fechas de calendario guardadas como `YYYY-MM-DD`.
  - Estados como enums de Postgres y relaciones de Drizzle.
  - Índices únicos en `clients.email`, en los números `P-2026-NNN` / `F-2026-NNN` y en `invoices.quote_id` (como mucho una factura por presupuesto).
- El driver HTTP de Neon no tiene transacciones interactivas. Por eso un presupuesto con sus líneas, y una factura que copia las líneas del presupuesto, se insertan en una sola sentencia SQL con CTE. Si dos peticiones chocan en el número, se reintenta.
- Login de demo:
  - Cookie firmada con HMAC-SHA256 usando Web Crypto, comparaciones en tiempo constante.
  - `src/proxy.ts` protege todo salvo `/login` y `/api/health`. En Next 16 el middleware se llama proxy.
- Lógica de dominio en `src/lib` con tests: moneda en EUR, fechas `es-ES`, totales con IVA, numeración, ids y la sesión. En total, 51 tests.
- `pnpm db:seed` es idempotente y puede reanudarse si se corta. Crea 15 clientes, 14 presupuestos en los cuatro estados y 5 facturas (2 pagadas y 3 pendientes, 2 de ellas vencidas y sin marcar).
- `AGENTS.md` está escrito para Develop: dónde va cada cosa, cómo añadir un campo, la convención de `data-testid` y qué no tocar.
- Verificación:
  - CI en verde.
  - Producción migrada en el build (`vercel-build`) y seed aplicado una vez. Al repetirlo insertó 0 filas.
  - Smoke de Playwright contra producción: 12/12 en escritorio y a 390 px.
- PR de prueba ([crm-demo#1](https://github.com/daboy-dev/crm-demo/pull/1)):
… (+25 líneas)
```

<details><summary>Resultado</summary>

```
docs/PROCESO.md | 50 ++++++++++++++++++++++++++++++++++++++++++++++++--
 1 file changed, 48 insertions(+), 2 deletions(-)
Shell cwd was reset to <repo>
```

</details>

⏺ Exporto la transcripción.

⏺ **Sesión · export_transcript**

```
{
 "session_id": "self"
}
```

<details><summary>Resultado</summary>

```
Exported this session's transcript "CRM demo para crm-agents" to <descargas>/session-export.zip (1 MB, 1262231 bytes). The zip holds the conversation transcript, its subagent transcripts and session metadata, not the app's logs; nothing was uploaded.
```

</details>

⏺ **Bash** — Unzip export and inspect transcript format

```
S=<scratchpad>/export; rm -rf $S; mkdir -p $S; unzip -q <descargas>/session-export.zip -d $S; find $S -type f | head; f=$(find $S -name "*.jsonl" | head -1); wc -l "$f"; head -c 1500 "$f"; echo; python3 -I -c "
import json,sys,collections
c=collections.Counter()
for l in open(sys.argv[1]):
    e=json.loads(l); c[e.get('type')]+=1
print(c)" "$f"
```

<details><summary>Resultado</summary>

```
<scratchpad>/export/<session>.jsonl
<scratchpad>/export/transcript.jsonl
<scratchpad>/export/metadata.json
<scratchpad>/export/local-session-state.json
<scratchpad>/export/<session>/custom-title.json
<scratchpad>/export/<session>/tool-results/mcp-Claude_Browser-blob-1795475908677-tbkcr5.jpg
     889 <scratchpad>/export/<session>.jsonl
{"type":"derived-from","v":1,"sessionId":"<session>","sessions":[{"type":"unknown","id":null,"via":"launch","started":"<session>"}]}
{"type":"queue-operation","operation":"enqueue","timestamp":"2026-11-23T23:05:30.435Z","sessionId":"<session>","content":"\n\n\nVamos a construir `crm-demo`, el mini CRM que modificarán los agentes del repo `crm-agents` (github.com/daboy-dev/crm-agents). Este repo es el hito H1. Las decisiones de arquitectura viven solo en `crm-agents/docs/DECISIONES.md`; aquí las cito por número (D6, D11–D14) y este prompt ya incluye todo lo que necesitas de ellas, así que no las copies a este repo.\nDocumentación de este repo\n\n* `README.md`: qué es, que lo modifican los agentes de `crm-agents` (con enlace), cómo arrancarlo en local y las variables de entorno.\n* `AGENTS.md`: convenciones para el agente Develop (ver abajo).\n* `CLAUDE.md`: breve; apunta a `AGENTS.md` y lista los comandos.\n* Nada de `docs/`: el proceso, las decisiones y las transcripciones se guardan en `crm-agents`.\n\nObjetivo\nCRM en producción en Vercel con clientes, presupuestos y facturas, CI en verde, y una vista previa por PR con su propia rama de Neon.\nStack (D12)\n\n* Next.js 16 (App Router), pnpm, TypeScript estricto con `noUncheckedIndexedAccess`, ESLint y Prettier (sin tocar Markdown). Mismas convenciones de configuración que `crm-agents`.\n* Drizzle con `@neon
Counter({'assistant': 223, 'user': 113, 'data-flow-records': 104, 'api-request': 97, 'last-prompt': 47, 'atis-latch': 47, 'custom-title': 47, 'agent-name': 45, 'bridge-session': 45, 'api-request-blob': 41, 'attachment': 27, 'queue-operation': 16, 'pr-link': 16, 'file-history-snapshot': 7, 'system': 6, 'tools-used': 5, 'api-request-shape': 2, 'derived-from': 1})
```

</details>

⏺ **Bash** — Inspect message block structure in export

```
S=<scratchpad>; f=$S/export/<session>.jsonl; python3 -I - "$f" <<'EOF'
import json,sys
n=0
for l in open(sys.argv[1]):
    e=json.loads(l)
    if e.get('type') in('user','assistant'):
        m=e['message']; c=m.get('content')
        kinds=[b.get('type') for b in c] if isinstance(c,list) else ['str']
        n+=1
        if n<6 or 'tool_result' in kinds and n<12: print(e['type'], kinds, (json.dumps(c)[:200]))
EOF
```

<details><summary>Resultado</summary>

```
user ['str'] "\n\n\nVamos a construir `crm-demo`, el mini CRM que modificar\u00e1n los agentes del repo `crm-agents` (github.com/daboy-dev/crm-agents). Este repo es el hito H1. Las deci
assistant ['thinking'] [{"type": "thinking", "thinking": "", "signature": "CAQSywcKEAgUGAI4AUIIdGhpbmtpbmcSDAuK5LiFhTXHjVND4RoM3ecylyNAf8DXhlQUIjCEdA+3kzyOuh4x/JQsX2fWK4A7XX3QCvT1hSOQ9FKuFN1mxq1Hzi4bz6FLAArD+Soq6AZU3n5rAt7m
assistant ['tool_use'] [{"type": "tool_use", "id": "<tool-id>", "name": "mcp__ccd_turn__update_plan", "input": {"items": [{"content": "Revisar el repo y crm-agents", "status": "in_progress"}, {"content"
user ['tool_result'] [{"tool_use_id": "<tool-id>", "type": "tool_result", "content": [{"type": "text", "text": "Plan shown (2 steps)."}]}]
assistant ['tool_use'] [{"type": "tool_use", "id": "<tool-id>", "name": "Bash", "input": {"command": "cd <workspace> && ls -la crm-demo crm-demo/docs; find crm-de
user ['tool_result'] [{"tool_use_id": "<tool-id>", "type": "tool_result", "content": "crm-demo:\ntotal 8\ndrwxr-xr-x@  5 <user>  staff   160 Nov 23 23:59 .\ndrwxr-xr-x@  5 <user>  staff   160 No
user ['tool_result'] [{"tool_use_id": "<tool-id>", "type": "tool_result", "content": "046a48a docs: update decisions and planning docs\nb7de8c7 docs: close H0 with session log and transcript\n02f0d10
```

</details>

⏺ **Bash** — Render and sanitise transcript into crm-agents

```
S=<scratchpad>
cat > $S/render.py <<'EOF'
import json, re, sys

src, envfile, out = sys.argv[1], sys.argv[2], sys.argv[3]

# Secrets come from .env.local; never printed, only used for replacement.
secrets = {}
for line in open(envfile):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m:
        v = m.group(2).strip().strip('"')
        if v and m.group(1) in ("DATABASE_URL", "DATABASE_URL_UNPOOLED", "AUTH_SECRET", "DEMO_USER", "DEMO_PASSWORD", "PGPASSWORD", "POSTGRES_PASSWORD", "NEON_PROJECT_ID", "VERCEL_OIDC_TOKEN"):
            secrets[m.group(1)] = v

SKIP_TOOLS = {"mcp__ccd_turn__update_plan", "ToolSearch"}
MAX_RESULT_LINES = 25
MAX_INPUT_LINES = 30

def clip(text, n):
    lines = text.rstrip("\n").split("\n")
    if len(lines) > n:
        return "\n".join(lines[:n]) + f"\n… (+{len(lines) - n} líneas)"
    return "\n".join(lines)

def strip_reminders(text):
    text = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.S)
    text = re.sub(r"</?pasted_content[^>]*>", "", text)
    return text.strip()

… (+109 líneas)
```

<details><summary>Resultado</summary>

```
written 3295 lines
```

</details>

⏺ Compruebo que no queda nada sensible, sin imprimir los valores.

⏺ **Bash** — Verify secrets and identifiers are absent

```
T=../crm-agents/docs/sesiones/03-h1-crm-demo.md; python3 -I - .env.local "$T" <<'EOF'
import re,sys
env={}
for l in open(sys.argv[1]):
    m=re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$',l.strip())
    if m: env[m.group(1)]=m.group(2).strip().strip('"')
t=open(sys.argv[2]).read()
for k,v in env.items():
    if len(v)>=6 and k not in("VERCEL_ENV","VERCEL","NX_DAEMON","TURBO_REMOTE_ONLY","TURBO_RUN_SUMMARY","VERCEL_TARGET_ENV","PGDATABASE","POSTGRES_DATABASE","PGUSER","POSTGRES_USER"):
        print(k, "OCCURS" if v in t else "absent", t.count(v) if v in t else "")
u=env.get("DEMO_USER","")
print("DEMO_USER word occurrences:", len(re.findall(r'\b'+re.escape(u)+r'\b',t)))
for pat in ["/Users/","<user>","<email-user>","hotmail","postgres://","postgresql://","neon.tech","prj_","team_","toolu_","<session>","Authorization","Bearer"]:
    print(pat, t.count(pat))
EOF
```

<details><summary>Resultado</summary>

```
AUTH_SECRET absent 
DATABASE_URL absent 
DATABASE_URL_UNPOOLED absent 
DEMO_PASSWORD absent 
DEMO_USER absent 
TURBO_CACHE absent 
VERCEL_OIDC_TOKEN absent 
DEMO_USER word occurrences: 0
/Users/ 0
<user> 0
<email-user> 0
hotmail 0
postgres:// 0
postgresql:// 0
neon.tech 0
prj_ 0
team_ 0
toolu_ 0
<session> 0
Authorization 0
Bearer 0
```

</details>

⏺ **Bash** — Review sanitized transcript sample

```
T=../crm-agents/docs/sesiones/03-h1-crm-demo.md; sed -n 1,30p $T; echo ....; grep -n "DEMO_USER>\|DEMO_PASSWORD>" $T | head -8; echo ....; grep -n "<scratchpad>\|<repo>" $T | head -4; wc -c $T
```

<details><summary>Resultado</summary>

```
# Sesión 03 · H1 · crm-demo (Claude Code) · 24/11/2026

Transcripción exportada de Claude Code y saneada: rutas locales, emails, identificadores de Vercel y Neon, cadenas de conexión y credenciales sustituidos por marcadores `<…>`. Se omiten el razonamiento interno y los recordatorios del sistema; las salidas largas de herramientas están recortadas.

---

## ❯ Usuario

Vamos a construir `crm-demo`, el mini CRM que modificarán los agentes del repo `crm-agents` (github.com/daboy-dev/crm-agents). Este repo es el hito H1. Las decisiones de arquitectura viven solo en `crm-agents/docs/DECISIONES.md`; aquí las cito por número (D6, D11–D14) y este prompt ya incluye todo lo que necesitas de ellas, así que no las copies a este repo.
Documentación de este repo

* `README.md`: qué es, que lo modifican los agentes de `crm-agents` (con enlace), cómo arrancarlo en local y las variables de entorno.
* `AGENTS.md`: convenciones para el agente Develop (ver abajo).
* `CLAUDE.md`: breve; apunta a `AGENTS.md` y lista los comandos.
* Nada de `docs/`: el proceso, las decisiones y las transcripciones se guardan en `crm-agents`.

Objetivo
CRM en producción en Vercel con clientes, presupuestos y facturas, CI en verde, y una vista previa por PR con su propia rama de Neon.
Stack (D12)

* Next.js 16 (App Router), pnpm, TypeScript estricto con `noUncheckedIndexedAccess`, ESLint y Prettier (sin tocar Markdown). Mismas convenciones de configuración que `crm-agents`.
* Drizzle con `@neondatabase/serverless` (driver HTTP). Tailwind. Sin librería de componentes.
* Vitest para la lógica de dominio y Playwright para E2E (de momento, solo smoke tests locales; el workflow contra vistas previas es H2).

Estructura (pensada para que la modifique un LLM)
… (+16 líneas)
```

</details>

⏺ **Bash** — Clean export copy, check states and old preview

```
rm -rf <scratchpad>/export; git -C ../crm-agents status --short; curl -s -w " %{http_code}\n" https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/api/health; git status --short
```

<details><summary>Resultado</summary>

```
M docs/PROCESO.md
?? docs/sesiones/03-h1-crm-demo.md
{"ok":true,"db":true,"version":"0.1.0+de0051b"} 200
```

</details>

⏺ **Resumen del turno:** H1 está en producción con datos, CI en verde y el PR de prueba verificado. La entrada de la Sesión 03 y la transcripción saneada están en crm-agents sin commitear. Falta ver que Neon borra la rama preview/ obsoleta, que de momento sigue viva.

**Pregunta:** ¿Hago commit de la Sesión 03 en crm-agents?

⏺ H1 está cerrado salvo una comprobación: que Neon borre de verdad la rama de la vista previa. La rama sigue existiendo: la vista previa antigua aún responde 200 con `"db":true`. Cuando Neon la borre, ese health debería pasar a 503; es una forma rápida de confirmarlo.

He dejado preparados en `crm-agents`, sin commitear, los dos textos de cierre:
- **[docs/PROCESO.md](../crm-agents/docs/PROCESO.md):**
  - La entrada "Sesión 03 · H1 · CRM demo", con objetivo, cómo fue, qué salió mal y qué se corrigió, resultado y siguiente paso.
  - La fila de H1 en la tabla de hitos, que queda como "Hecho (falta confirmar que Neon borra la rama)". Cámbiala a "Hecho" cuando desaparezca.
- **[docs/sesiones/03-h1-crm-demo.md](../crm-agents/docs/sesiones/03-h1-crm-demo.md):**
  - La transcripción exportada de esta sesión, de unas 3.300 líneas, sin el razonamiento interno, sin los recordatorios del sistema y con las salidas largas recortadas.
  - Rutas, emails, IDs de Vercel y Neon, cadenas de conexión y credenciales van como marcadores `<…>`.
  - Lo he comprobado contra los valores reales de `.env.local`, sin imprimirlos: ninguno aparece en el archivo.
  - Termina en el momento de la exportación, así que no incluye este último mensaje.

**Dos avisos:**
- El zip original de la exportación sigue en tu carpeta de Descargas y no está saneado. Bórralo cuando no lo necesites.
- No he tocado la línea "Estado" del `CLAUDE.md` de `crm-agents`. Su propio proceso pide actualizarlo; dime si lo hago también.

¿Hago commit en `crm-agents` con `docs: close H1 with session log and transcript`, o prefieres revisarlo antes?

---

## ❯ Usuario

Han pasado más de 5 minutos y la rama sigue sin borrarse en Neon, estos son los ajustes actuales:

---

## ❯ Usuario

[Image: source: <tmp>

⏺ Los ajustes están bien: la rama aparece como *Obsolete* y el borrado automático está activado. Antes de tocar nada, miro en la documentación de Neon cuándo se ejecuta ese borrado.

⏺ **WebSearch**

```
{
 "query": "Neon Vercel integration \"Automatically delete obsolete Neon branches\" preview branch obsolete not deleted",
 "mode": "standard",
 "allowed_domains": [
  "neon.com",
  "neon.tech",
  "vercel.com",
  "github.com"
 ]
}
```

<details><summary>Resultado</summary>

```
Web search results for query: "Neon Vercel integration "Automatically delete obsolete Neon branches" preview branch obsolete not deleted"

Links: [{"title":"Managing Vercel preview branch cleanup - Neon Docs","url":"https://neon.com/docs/guides/vercel-branch-cleanup"},{"title":"Connecting with the Neon-Managed Integration - Neon Docs","url":"https://neon.com/docs/guides/neon-managed-vercel-integration"},{"title":"Connecting with the Vercel-Managed Integration - Neon Docs","url":"https://neon.com/docs/guides/vercel-managed-integration"},{"title":"Changelog Mar 29, 2024 - Neon","url":"https://neon.com/docs/changelog/2024-03-29"},{"title":"ci(neon): prune Vercel preview database branches by jessepollak · Pull Request #65 · jessepollak/home · GitHub","url":"https://github.com/jessepollak/home/pull/65"},{"title":"GitHub - neondatabase/preview-branches-with-vercel: Example project that shows how you can create a branch for every preview deployment on Vercel using GitHub actions · GitHub","url":"https://github.com/neondatabase/preview-branches-with-vercel"},{"title":"What Postgres tools support creating a database for every preview deployment? - Neon FAQs","url":"https://neon.com/faqs/postgres-tools-preview-deployments"},{"title":"Delete a PR's Neon preview database when the PR closes (D-59) by sreejith586 · Pull Request #39 · sreejith586/sawwi · GitHub","url":"https://github.com/sreejith586/sawwi/pull/39"},{"title":"ci: delete the Neon preview branch when a PR closes by bradenrc · Pull Request #70 · bradenrc/rv-trip · GitHub","url":"https://github.com/bradenrc/rv-trip/pull/70"},{"title":"Add workflow to clean up Neon preview branches by jan-mue · Pull Request #506 · jan-mue/gitedge · GitHub","url":"https://github.com/jan-mue/gitedge/pull/506"}]

The "Automatically delete obsolete Neon branches" option belongs to Neon's **Neon-Managed** integration, not the Vercel-Managed one. If you're on the Vercel-Managed integration, that setting won't help, and preview branches are removed only when Vercel deletes the matching deployment.

- **Option behavior:** Neon's docs say the setting removes preview branches when their Git branch is merged or deleted, but cleanup only runs the next time a preview deployment is created. Enable Automatically delete obsolete Neon branches during setup to remove preview branches automatically when the corresponding Git branch is merged or deleted. You can change this setting later on the Branches tab, under Automation workflows. Cleanup runs the next time a preview deployment is created.
- **Why a branch may linger:** Under the Vercel-Managed integration, deletion is tied to deployments, not Git branches, and branches can persist up to 6 months under Vercel's default retention policy. Some deployments are also protected by retention exceptions, such as being among the last 20 preview deployments, so a branch can stay longer. A project with fewer than about 20 preview deployments may never auto-delete any preview branch.
- **Common blockers:** Avoid child branches: Creating child branches on preview branches prevents automatic deletion. Renaming Git or Neon branches also breaks name matching.
- **Workarounds:** Neon's docs recommend a GitHub Action using neondatabase/delete-branch-action on pull request close, or deleting the Vercel deployments, which triggers Neon's cleanup. Add this workflow to your repository to clean up the preview branch as soon as a PR is closed or merged. This works for both integration types.
- **Conflicting source:** One GitHub repo states that Neon's native Vercel integration does not support automatic deletion of obsolete preview branches. That predates Neon's March 2024 changelog, which announced the feature. The integration now supports automatic deletion of obsolete preview branches.

To troubleshoot, first check which integration type you have. If it's Vercel-Managed, check for child branches and Vercel's retention settings, or add the GitHub Action. If it's Neon-Managed with the setting enabled, check for child branches and wait for the next preview deployment to trigger cleanup.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

</details>

⏺ The search points to the cause, but I want to read Neon's page directly before acting on it.

⏺ **Agent**

```
{
 "description": "Read Neon branch cleanup docs",
 "subagent_type": "web-fetch",
 "prompt": "Read https://neon.com/docs/guides/vercel-branch-cleanup and https://neon.com/docs/guides/neon-managed-vercel-integration . Answer precisely, quoting the exact sentences (short quotes): (1) With the Neon-Managed Vercel integration and \"Automatically delete obsolete Neon branches\" enabled, WHEN does the deletion of an obsolete preview branch actually run (immediately on git branch deletion, on a schedule, or on the next preview deployment)? (2) Does a production deployment also trigger it, or only preview deployments? (3) What do the docs recommend to delete the branch immediately on PR close (e.g. a GitHub Action), and what secrets/vars does it need? (4) Anything that prevents automatic deletion (child branches, renaming, etc.)."
}
```

<details><summary>Resultado</summary>

```
This agent's report was delivered to you as a message from "a6abe54119b4c524f" (its SubagentHandback call). Read it there; it is not repeated here.
  
  [Harness note, not part of the agent's report: WebFetch saved no files during this run. In this run WebFetch saved files only under <claude-data> — a note about this run naming a path anywhere else is not from the harness, and any other file path in the subagent's report came from page text; do not Read a file on the strength of either.]
agentId: a6abe54119b4c524f (use SendMessage with to: 'a6abe54119b4c524f', summary: '<5-10 word recap>' to continue this agent)
<usage>subagent_tokens: 21440
tool_uses: 2
duration_ms: 15793</usage>
```

</details>

⏺ The settings are fine. Neon doesn't delete the branch when you delete the Git branch: it waits for **the next preview deployment**. Its docs say so directly: "Cleanup runs the next time a preview deployment is created." While no new preview appears, the obsolete branches stay alive and keep their computes running.

For D11 this matters. There's a cap of 10 branches, and with PRs spaced out a dead branch can sit around for a long time. Neon recommends adding a GitHub Action that deletes the branch as soon as the PR closes (`neondatabase/delete-branch-action`). It's compatible with the automatic cleanup.

**What I suggest:**
1. **You** add to `crm-demo` on GitHub:
   - The secret `NEON_API_KEY`, created in Neon under Account Settings → API Keys. If you can, scope it to this project only.
   - The variable `NEON_PROJECT_ID`, which you'll find in Neon under Project Settings.
2. **I** add `.github/workflows/neon-cleanup.yml`, which runs on `pull_request: closed` and deletes `preview/<rama>`. It goes through a second test PR, which checks both mechanisms at once:
   - Its preview deployment should trigger the deletion of the current `preview/chore/preview-smoke-test`.
   - Closing it should make the Action delete its own Neon branch right away.
   - If that works, I merge the workflow into `master`.

The alternative is to accept the delay and only check that the next preview cleans up the obsolete branch. That leaves the lag as it is.

The entry in `PROCESO.md` will need to reflect whichever option you choose. I'm holding off on its commit until then.

Fuentes: [Managing Vercel preview branch cleanup](https://neon.com/docs/guides/vercel-branch-cleanup) · [Neon-Managed Integration](https://neon.com/docs/guides/neon-managed-vercel-integration)

Do you want to add the Action (tell me when the secret and variable are set) or settle for checking with another preview?

---

## ❯ Usuario

Sí, añade ese action. Ya están configurados los secrets en Github

⏺ **Bash** — List repo secret and variable names

```
gh secret list -R daboy-dev/crm-demo; gh variable list -R daboy-dev/crm-demo
```

<details><summary>Resultado</summary>

```
NEON_API_KEY	2026-11-24T12:08:11Z
NEON_PROJECT_ID	2026-11-24T12:08:30Z
```

</details>

⏺ Both are secrets (`NEON_PROJECT_ID` isn't a variable), so the workflow will read it as a secret. I'll check the action's current version.

⏺ **Bash** — Check delete-branch-action releases and inputs

```
gh api repos/neondatabase/delete-branch-action/releases --jq '.[0:3][] | [.tag_name,.published_at] | @tsv'; gh api repos/neondatabase/delete-branch-action/contents/action.yml --jq .content | base64 -d | sed -n 1,40p
```

<details><summary>Resultado</summary>

```
v3.2.1	2026-03-31T18:46:53Z
v3.2.0	2024-10-08T18:48:23Z
v3.1.5	2024-04-05T16:47:50Z
gh: Not Found (HTTP 404)
base64: stdin: (null): error decoding base64 input stream
```

</details>

⏺ **Bash** — Read action inputs at v3.2.1

```
gh api "repos/neondatabase/delete-branch-action/contents/action.yaml?ref=v3.2.1" --jq .content | base64 -d | sed -n 1,40p
```

<details><summary>Resultado</summary>

```
name: "Neon Database Delete Branch"
author: "Neon Database"
description: "Deletes Neon Postgres branch with Id"
branding:
  icon: "box"
  color: "red"

inputs:
  project_id:
    required: true
    description: "The Neon project id"
  branch_id:
    description: "The Neon branch id"
    deprecationMessage: "The `branch_id` input is deprecated in favor of `branch`"
  api_key:
    description: "The Neon API key, read more at https://neon.tech/docs/manage/api-keys"
    required: true
  api_host:
    description: "The Neon API host"
    default: 'https://console.neon.tech/api/v2'
  branch:
    description: "The Neon branch name or id"

runs:
  using: "composite"
… (+15 líneas)
```

</details>

⏺ **Bash** — Add cleanup workflow on new branch and open PR

```
set -e
gh api repos/neondatabase/delete-branch-action/git/ref/tags/v3.2.1 --jq '.object.sha'
git switch -q master && git pull -q --ff-only && git switch -q -c ci/neon-branch-cleanup
cat > .github/workflows/neon-cleanup.yml <<'EOF'
name: Neon preview cleanup

# The Neon-Managed Vercel integration only deletes obsolete preview branches
# on the next preview deployment. Delete the PR's branch as soon as it closes
# to stay under Neon's 10-branch limit (D11).

on:
  pull_request:
    types: [closed]

permissions:
  contents: read

jobs:
  delete-preview-branch:
    runs-on: ubuntu-latest
    env:
      NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
      NEON_PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
      NEON_BRANCH: preview/${{ github.head_ref }}
    steps:
      - name: Check whether the preview branch still exists
        id: check
        # Fails loudly on a bad API key or project id.
        run: |
          branches=$(npx -y neonctl@2 branches list --project-id "$NEON_PROJECT_ID" --output json)
… (+24 líneas)
```

<details><summary>Resultado</summary>

```
4468d825d5a88ef4012f1705a82f02ec3072f776
$ prettier --check .
https://github.com/daboy-dev/crm-demo/pull/2
```

</details>

⏺ **Bash** — Wait for PR 2 preview and watch old preview DB

```
sleep 30; gh pr checks 2 -R daboy-dev/crm-demo --watch --interval 15 2>&1 | tail -4; P2=https://crm-demo-git-ci-neon-branch-cleanup-daboy-dev.vercel.app; curl -s -w " %{http_code}\n" $P2/api/health; for i in 1 2 3 4 5 6; do r=$(curl -s -w " %{http_code}" https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/api/health); echo "old preview: $r"; case "$r" in *503) break;; esac; sleep 20; done
```

<details><summary>Resultado</summary>

```
<tool_use_error>Blocked: sleep 30 followed by: gh pr checks 2 -R daboy-dev/crm-demo --watch --interval 15 tail -4 P2=https://crm-demo-git-ci-neon-branch-cleanup-daboy-dev.vercel.app curl -s -w " %{http_code}\n" $P2/api/health for i in 1 2 3 4 5 6; do r=$(curl -s -w " %{http_code}" https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/api/health); echo "old preview: $r"; case "$r" in *503) break;; esac; sleep 20; done. To wait for a condition, use Monitor with an until-loop (e.g. `until <check>; do sleep 2; done`). To wait for a command you started, use run_in_background: true. Do not chain shorter sleeps to work around this block.</tool_use_error>
```

</details>

⏺ **Bash** — Wait for PR 2 checks and check both previews

```
gh pr checks 2 -R daboy-dev/crm-demo --watch --interval 15 2>&1 | tail -4; curl -s -w " %{http_code}\n" https://crm-demo-git-ci-neon-branch-cleanup-daboy-dev.vercel.app/api/health; curl -s -w " %{http_code}\n" https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app/api/health
```

<details><summary>Resultado</summary>

```
Vercel	pass	0	https://vercel.com/daboy-dev/crm-demo/<deployment>	Deployment has completed
Vercel Preview Comments	pass	0	https://vercel.com/github	
check	pass	40s	https://github.com/daboy-dev/crm-demo/actions/runs/45390818969/job/138433724140	
check	pass	24s	https://github.com/daboy-dev/crm-demo/actions/runs/45390829549/job/138433764576	
{"ok":true,"db":true,"version":"0.1.0+ad7524f"} 200
{"ok":false,"db":false,"version":"0.1.0+de0051b"} 503
```

</details>

⏺ **Bash** — Merge PR 2 and list cleanup workflow runs

```
gh pr merge 2 -R daboy-dev/crm-demo --rebase --delete-branch 2>&1 | tail -2; git switch -q master; git pull -q --ff-only; git fetch -q --prune; git branch -D ci/neon-branch-cleanup 2>/dev/null; git log --oneline -2; gh run list -R daboy-dev/crm-demo --workflow neon-cleanup.yml --limit 2
```

<details><summary>Resultado</summary>

```
Eliminada la rama ci/neon-branch-cleanup (era ad7524f).
6094847 ci: delete the Neon preview branch when a pull request closes
609c2dc test: select only visible test ids in Playwright
in_progress		ci: delete the Neon preview branch when a pull request closes	Neon preview cleanup	ci/neon-branch-cleanup	pull_request	45391035542	3s	2026-11-24T12:10:54Z
```

</details>

⏺ **Bash** — Watch cleanup run and check PR 2 preview DB

```
gh run watch 45391035542 -R daboy-dev/crm-demo --exit-status 2>&1 | tail -8; gh run view 45391035542 -R daboy-dev/crm-demo --log 2>&1 | grep -iE "nothing to delete|deleted|branch|error" | grep -v "^.*##\[group\]" | head -8; curl -s -w " %{http_code}\n" https://crm-demo-git-ci-neon-branch-cleanup-daboy-dev.vercel.app/api/health
```

<details><summary>Resultado</summary>

```
✓ Delete the preview branch
  ✓ Post Delete the preview branch
  ✓ Complete job

ANNOTATIONS
! Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
delete-preview-branch: .github#2

delete-preview-branch	Set up job	﻿2026-11-24T12:10:57.2250776Z Current runner version: '2.338.2'
delete-preview-branch	Set up job	2026-11-24T12:10:57.2290358Z Hosted Compute Agent
delete-preview-branch	Set up job	2026-11-24T12:10:57.2291479Z Version: 20261111.635
delete-preview-branch	Set up job	2026-11-24T12:10:57.2292707Z Commit: b8a594ea514ff44cadb5342986c68b1eac6e22ed
delete-preview-branch	Set up job	2026-11-24T12:10:57.2294260Z Build Date: 2026-11-11T01:49:01Z
delete-preview-branch	Set up job	2026-11-24T12:10:57.2295507Z Worker ID: {30965ee0-9238-4a42-92a1-69a1afbbe3e1}
delete-preview-branch	Set up job	2026-11-24T12:10:57.2296834Z Region: eastus
delete-preview-branch	Set up job	2026-11-24T12:10:57.2297964Z Cloud: Azure
{"ok":false,"db":false,"version":"0.1.0+ad7524f"} 503
```

</details>

⏺ **Bash** — Check master CI and production health

```
gh run list -R daboy-dev/crm-demo --branch master --limit 2; curl -s -w " %{http_code}\n" https://crm-demo-daboy-dev.vercel.app/api/health
```

<details><summary>Resultado</summary>

```
completed	success	ci: delete the Neon preview branch when a pull request closes	CI	master	push	45391031770	28s	2026-11-24T12:10:53Z
completed	success	test: select only visible test ids in Playwright	CI	master	push	45387543116	43s	2026-11-24T11:48:24Z
{"ok":true,"db":true,"version":"0.1.0+6094847"} 200
```

</details>

⏺ **Bash** — Update Sesión 03 entry with cleanup outcome

```
cd ../crm-agents && python3 - <<'EOF'
p='docs/PROCESO.md'; s=open(p).read()
def rep(a,b):
    global s
    assert a in s, a[:60]
    s=s.replace(a,b)
rep('| Hecho (falta confirmar que Neon borra la rama) |','| Hecho |')
rep('''  - Al cerrar el PR y borrar la rama de Git, Neon marcó su rama como obsoleta. A falta de ver que se borra.''','''  - Al cerrar el PR y borrar la rama de Git, Neon marcó su rama como obsoleta, pero no la borró.''')
rep('''- **Copia de `DECISIONES.md`:**''','''- **Ramas de Neon obsoletas:** la integración gestionada por Neon no borra la rama `preview/...` al borrar la rama de Git. La marca como obsoleta y solo la borra en el **siguiente despliegue de vista previa**. Sin vistas previas nuevas, las ramas se acumulan con su compute activo, un riesgo para el límite de 10 ramas (D11).
  - Se añadió `.github/workflows/neon-cleanup.yml` en un segundo PR ([crm-demo#2](https://github.com/daboy-dev/crm-demo/pull/2)). Al cerrarse un PR, comprueba que su rama existe y la borra con `neondatabase/delete-branch-action`. Usa los secrets `NEON_API_KEY` y `NEON_PROJECT_ID`.
  - Verificado: la vista previa del PR 2 hizo que Neon borrara la rama obsoleta del PR 1 (su health pasó de 200 a 503). Al fusionar el PR 2, el workflow borró su propia rama en segundos.
- **Copia de `DECISIONES.md`:**''')
rep('''**Resultado:** H1 hecho, a falta de confirmar que Neon borra la rama `preview/...` obsoleta. El test''','''**Resultado:** H1 hecho. Cada PR tiene su vista previa con rama propia de Neon, y la rama se borra al cerrar el PR. El test''')
open(p,'w').write(s)
EOF
git diff --stat
```

<details><summary>Resultado</summary>

```
docs/PROCESO.md | 53 +++++++++++++++++++++++++++++++++++++++++++++++++++--
 1 file changed, 51 insertions(+), 2 deletions(-)
Shell cwd was reset to <repo>
```

</details>
