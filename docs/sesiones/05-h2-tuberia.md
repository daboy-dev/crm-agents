# Sesión 05 · H2 · Tubería sin IA (Claude Code) · 24/11/2026

Transcripción exportada de Claude Code y saneada: rutas locales, emails, identificadores de Vercel, URLs de despliegue, URLs firmadas, cadenas de conexión y credenciales sustituidos por marcadores `<…>`. Se omiten el razonamiento interno, los recordatorios del sistema, las imágenes y las llamadas de seguimiento de tareas; las salidas largas de herramientas están recortadas.

---

## ❯ Usuario

# Sesión 05 · H2 · Tubería sin IA

Lee primero `crm-agents/CLAUDE.md`, `crm-agents/docs/DECISIONES.md` (sobre todo D4 y D15–D19), `crm-agents/docs/PROCESO.md` (sesión 04) y `crm-demo/AGENTS.md`.

## Objetivo
Cada vista previa de `crm-demo` pasa Playwright en GitHub Actions y los resultados (tests y capturas) llegan al panel `crm-agents`, que los muestra en `/pipeline` tras un login. Todavía no hay IA ni runs.

## Criterio de verificación (H2)
- Un PR de prueba en `crm-demo` aparece en `https://crm-agents.vercel.app/pipeline` (con login) con el estado de su vista previa, el resultado de los tests y las capturas a 1280 px y 390 px.
- Un PR con un test roto a propósito aparece como fallo.
- Reenviar una entrega desde GitHub (Recent Deliveries → Redeliver) no duplica nada.
- CI en verde en los dos repos. Al acabar, los PRs de prueba se cierran y sus ramas de Neon se borran (D11).

## Parte 1 · `crm-demo`
- `.github/workflows/preview-e2e.yml` (D15):
  - `on: deployment_status`, solo si `state == 'success'` y `startsWith(environment, 'Preview')`.
  - `permissions: contents: read`, `concurrency` por `github.event.deployment.ref` con `cancel-in-progress`.
  - Checkout de `github.event.deployment.sha`. Instalar solo Chromium.
  - `BASE_URL` = `github.event.deployment_status.target_url`. Credenciales con los secrets `DEMO_USER` y `DEMO_PASSWORD`.
  - Generar `e2e-results/` con `results.json` (reporter JSON de Playwright), `meta.json` (sha, ref, target_url, run_id) y `screenshots/<página>-<1280|390>.jpg`.
  - Subirlo como artifact `e2e-results` con `if: always()` y `retention-days: 1`. Si los tests fallan, el workflow termina en fallo, pero el artifact se sube igual.
  - **Ningún secreto del panel en este repo** (D16).
- `e2e/pages.ts`: la lista de páginas que se capturan (listas de clientes, presupuestos y facturas, y al menos una página de detalle). Así, añadir una página es añadir una línea.
- El test de escritura de la sesión 03 se sube al repo, pero se salta si `BASE_URL` es la de producción (D18).
- Actualiza `AGENTS.md`: cómo se ejecuta el E2E contra las vistas previas, para qué sirve `e2e/pages.ts` y que `.github/**` y los helpers de `e2e/` no se tocan.

## Parte 2 · `crm-agents`
- **Login (D19):** copia la sesión HMAC de `crm-demo` con sus tests. El proxy protege todo salvo `/login`, `/api/health` y `/api/webhooks/github`. Usa los mismos nombres de variables que `crm-demo`, añádelos a `.env.example` y avísame de cuáles tengo que crear en Vercel.
- **Esquema y migración:** `github_events` (solo se añaden filas, `delivery_id` único, payload jsonb, `processed_at` y error), `previews`, `test_reports` y `screenshots`. Se relacionan por el sha del commit (D17).
- **`POST /api/webhooks/github` (D17):**
  - Lee el cuerpo en crudo y verifica `X-Hub-Signature-256` con `GH_WEBHOOK_SECRET` en tiempo constante.
  - Inserta el evento con `on conflict do nothing` y responde 200 enseguida (GitHub corta a los 10 s). El procesamiento va en `after()`.
  - Procesa `pull_request` (PR, rama, sha y estado), `deployment_status` (URL y estado de la vista previa) y `workflow_run` `completed`, este último **solo** del workflow `preview-e2e.yml`. Los eventos de CI y de neon-cleanup se ignoran.
  - Todo el procesamiento tiene que poder repetirse sin efectos duplicados.
- **Artifact (D16):** con `GH_TOKEN`, lista los artifacts del run, descarga el zip de `e2e-results` (la API redirige a una URL firmada), descomprímelo en memoria (por ejemplo con `fflate`), guarda el informe y sube las capturas al Blob privado con `@vercel/blob` y OIDC (`BLOB_STORE_ID`, sin token estático).
- **Reprocesar:** una acción tras el login que vuelve a procesar los eventos con `processed_at` nulo o con error.
- **`GET /api/screenshots/[id]` (D18):** detrás del login, lee el blob en el servidor y lo devuelve con `Cache-Control: private`. Las URLs de Blob no llegan al navegador.
- **`/pipeline`:** una lista de PRs con su vista previa (enlace), su estado, el resultado de los tests (pasados y fallidos, con el nombre de los que fallan) y una cuadrícula de capturas por tamaño. Se refresca por polling cada pocos segundos (D4). Tiene que verse bien a 390 px.
- **Tests de Vitest:** verificación de firma, idempotencia del insert, parseo de `results.json` y `meta.json`, y el filtro de `workflow_run`.

## Variables disponibles
En `crm-agents` (ya están en Vercel y en `.env.local` tras `vercel env pull`): `DATABASE_URL`, `GH_TOKEN`, `GH_WEBHOOK_SECRET`, `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` y `VERCEL_OIDC_TOKEN`. Este último caduca en local; si falla la autenticación de Blob, pídeme que repita el `pull`.
En `crm-demo`, como secrets de Actions: `DEMO_USER`, `DEMO_PASSWORD`, `NEON_API_KEY` y `NEON_PROJECT_ID`.
**Nunca me pidas claves por el chat ni las escribas en archivos versionados.**

## Cómo trabajamos
1. Antes de escribir código, propón un plan de commits para cada repo y las decisiones de detalle que veas abiertas. Espera mi visto bueno.
2. Commits pequeños con Conventional Commits, y que cada commit compile.
3. Orden sugerido: el workflow de `crm-demo` primero, para ver un artifact real; después el login, el esquema y el webhook del panel; después el procesamiento del artifact y `/pipeline`; al final, la verificación de principio a fin.
4. Si algo de las decisiones no encaja con la realidad (nombres de entorno de Vercel, formato de eventos, límites), para, cuéntamelo y propón el cambio. No lo cambies por tu cuenta.

## Al cerrar
- Entrada de la sesión 05 en `crm-agents/docs/PROCESO.md` con objetivo, cómo fue y qué salió mal y se corrigió, y H2 marcado como hecho si se cumple el criterio.
- `CLAUDE.md` de `crm-agents` actualizado: estado, estructura, comandos y variables.
- Transcripción en `docs/sesiones/05-h2-tuberia.md`, sin claves, tokens, URLs firmadas ni credenciales de demo.

⏺ **Bash** — List folder and read panel docs

```
ls && cat crm-agents/CLAUDE.md && cat crm-agents/docs/DECISIONES.md
```

<details><summary>Resultado</summary>

```
crm-agents
crm-demo
# CLAUDE.md · crm-agents

## Qué es
Prueba técnica para Speed Paradigm: un equipo de 3 agentes de IA (Orquestador, Develop y Testing) y un humano que aprueba. Juntos modifican un mini CRM (clientes, presupuestos, facturas) a partir de peticiones en lenguaje natural.

- **Este repo (`crm-agents`):** el panel web, el motor de runs y los agentes.
- **`crm-demo` (otro repo):** el CRM que los agentes modifican mediante ramas y PRs.

Decisiones: `docs/DECISIONES.md` · Proceso e hitos: `docs/PROCESO.md`.

## Stack
- Next.js (App Router) + TypeScript estricto, desplegado en Vercel Hobby.
- Neon (Postgres) con Drizzle ORM y el driver serverless de Neon. Proyecto de Neon propio, distinto del de `crm-demo`.
- LLM: interfaz `LLMProvider` con `GeminiProvider` y `MockProvider`. Salidas validadas con Zod.
- Tests: Vitest (dominio) y Playwright (E2E del panel). CI en GitHub Actions.

## Restricciones importantes
- Las funciones de Vercel duran como máximo 300 s: ningún paso espera en vivo a un build. Los runs son una máquina de estados en la base de datos que avanza con webhooks de GitHub.
- Cada paso de agente debe poder repetirse sin efectos duplicados.
- **Nunca** escribir claves en el repo. Las variables nuevas se documentan en `.env.example`.
- El token de GitHub solo tiene acceso a `crm-demo`.

## Convenciones
- UI y textos en español. Código, nombres y commits en inglés.
- Commits pequeños con formato Conventional Commits.
- Antes de dar un hito por cerrado: lint, comprobación de tipos y tests en verde, y el criterio de verificación del hito comprobado en producción.

## Al cerrar cada sesión
1. Añadir una entrada en `docs/PROCESO.md`: objetivo, cómo fue, qué salió mal y qué se corrigió.
2. Exportar la transcripción (`/export`) a `docs/sesiones/NN-titulo.md` y revisarla para quitar claves, URLs con tokens y datos personales.
3. Actualizar este archivo si cambia el stack, la estructura o los comandos.

## Estructura
- `src/app`: UI y rutas API (`/api/health`).
- `src/server/db`: esquema y cliente de Drizzle. Migraciones en `drizzle/`.
- `src/server/runs`, `src/server/agents`, `src/server/llm`, `src/server/github`: reservadas para H2–H6.
- Next.js 16: la doc de la versión instalada está en `node_modules/next/dist/docs/` (ver `AGENTS.md`). `cacheComponents` está activo: los route handlers que deban ejecutarse en cada petición llaman a `connection()`.

… (+234 líneas)
```

</details>

⏺ **Bash** — Read process log and demo agent conventions

```
sed -n '/[Ss]esión 0[34]/,$p' crm-agents/docs/PROCESO.md | head -150; echo ----; cat crm-demo/AGENTS.md
```

<details><summary>Resultado</summary>

```
**Siguiente paso:** sesión 03 de Claude Code (H1) en el repo `crm-demo`.

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
  - La vista previa se desplegó sin la autenticación de Vercel y la rama `preview/chore/preview-smoke-test` apareció en Neon.
  - Contra esa vista previa pasó, en escritorio y a 390 px, un flujo de escritura completo: crear y editar un cliente, presupuesto con dos líneas y totales, aceptarlo, generar la factura y marcarla como pagada.
  - Producción siguió con los mismos datos, así que la vista previa usaba su propia rama de Neon.
  - Al cerrar el PR y borrar la rama de Git, Neon marcó su rama como obsoleta, pero no la borró.

**Qué salió mal y qué se corrigió:**
- `pnpm add -D typescript` instaló TypeScript 7. Se fijó `^5`, como en `crm-agents`.
- **Build:** con `cacheComponents`, `next build` intentaba leer la base de datos al prerenderizar las listas y fallaba sin `DATABASE_URL`. Cada componente que lee la base de datos va dentro de `<Suspense>` y las listas llaman a `await connection()`. Está documentado en `AGENTS.md`.
- **Commits:** el layout de la app importaba la acción de logout antes de que existiera el commit de auth. Se reordenaron los commits para que todos compilen. Presupuestos y facturas se juntaron en uno porque el detalle del presupuesto genera la factura.
- **Login:** tras un error se vaciaba el campo de usuario. Ahora lo conserva.
- **Páginas ocultas de Next 16.** Con `cacheComponents`, las páginas visitadas siguen montadas aunque ocultas (React `<Activity>`). Lo destapó el test de escritura en la vista previa, que se quedaba colgado:
  - Un mismo `data-testid` aparecía dos veces en el DOM.
  - Los formularios de alta conservaban lo escrito y los errores, y el login, la contraseña oculta.
  - Arreglo: `ResetOnHide` reinicia los formularios al ocultarse, y `e2e/helpers.ts` aporta `byTestId()`, que filtra los elementos visibles. Está documentado en `AGENTS.md` para el agente de Testing (H2).
… (+122 líneas)
```

</details>

⏺ Ahora el estado real de los dos repos.

⏺ **Bash** — Inspect both repos' git state, files and e2e setup

```
cd <repos>
for r in crm-demo crm-agents; do echo "=== $r"; (cd $r && git status -sb | head -5 && git log --oneline | head -8 && git ls-files | grep -v '^drizzle/meta' | grep -vE '^public/' ); done
echo; cat crm-demo/playwright.config.ts; ls crm-demo/e2e; cat crm-demo/e2e/*.ts | head -150; cat crm-demo/.github/workflows/*.yml
```

<details><summary>Resultado</summary>

```
=== crm-demo
## master...origin/master
6094847 ci: delete the Neon preview branch when a pull request closes
609c2dc test: select only visible test ids in Playwright
a32aefc fix: reset forms when Next.js hides their page
075aa5d fix: keep the user name after a failed login
1517a4a docs: add README, AGENTS.md, CLAUDE.md and env example
805ffed ci: add lint, format, typecheck and test workflow
5239d7c test: add Playwright smoke tests
a183986 feat: add idempotent seed script
.env.example
.github/workflows/ci.yml
.github/workflows/neon-cleanup.yml
.gitignore
.prettierignore
.prettierrc.json
AGENTS.md
CLAUDE.md
LICENSE
README.md
drizzle.config.ts
drizzle/0000_init.sql
e2e/helpers.ts
e2e/smoke.spec.ts
eslint.config.mjs
next.config.ts
package.json
playwright.config.ts
pnpm-lock.yaml
pnpm-workspace.yaml
postcss.config.mjs
src/app/(auth)/login/actions.ts
src/app/(auth)/login/login-form.tsx
src/app/(auth)/login/page.tsx
src/app/(crm)/clientes/[id]/editar/page.tsx
src/app/(crm)/clientes/[id]/page.tsx
src/app/(crm)/clientes/actions.ts
src/app/(crm)/clientes/client-form.tsx
src/app/(crm)/clientes/nuevo/page.tsx
src/app/(crm)/clientes/page.tsx
… (+275 líneas)
```

</details>

⏺ **Bash** — Read demo auth and panel config files

```
cd <repos>
cat crm-demo/src/lib/auth.ts crm-demo/src/proxy.ts; cat crm-demo/.env.example; ls -a crm-demo/e2e; git -C crm-demo status --ignored -s | head -20
echo ====; cat crm-agents/package.json crm-agents/src/server/db/schema.ts crm-agents/src/server/db/client.ts crm-agents/.env.example crm-agents/next.config.ts crm-agents/src/app/page.tsx; cat crm-agents/src/server/github/README.md
```

<details><summary>Resultado</summary>

```
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
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
… (+263 líneas)
```

</details>

⏺ **Bash** — Check write test, deployments, webhooks and env names

```
cd <repos>
grep -n -i "write\|escritura\|flow.spec\|preview.spec" crm-agents/docs/sesiones/03-h1-crm-demo.md | head -30
gh api repos/daboy-dev/crm-demo/deployments --jq '.[] | [.environment, .ref, .created_at] | @tsv' 2>&1 | head
gh api repos/daboy-dev/crm-demo/environments --jq '.environments[].name' 2>&1
gh api repos/daboy-dev/crm-demo --jq '{private, default_branch, delete_branch_on_merge}'
gh api repos/daboy-dev/crm-demo/hooks --jq '.[] | {events, url: .config.url, active}' 2>&1
gh secret list -R daboy-dev/crm-demo 2>&1
ls crm-agents/.env* ; grep -o '^[A-Z_]*=' crm-agents/.env.local
```

<details><summary>Resultado</summary>

```
212:   - Las escrituras con varias sentencias (presupuesto con sus líneas, factura copiada) van en un `db.batch` atómico.
307:description: Use Next.js Proxy to rewrite, redirect, modify headers, or respond directly before a request completes.
472:    "format": "prettier --write .",
546:⏺ **Bash** — Write base app files and run checks
609:p='next.config.ts';s=open(p).read().replace("  /* config options here */\n","");open(p,'w').write(s)
639:⏺ **Bash** — Write schema, client and generate migration
719:$ prettier --write .
773:$ prettier --write .
820:$ prettier --write .
934:$ prettier --write .
1075:$ prettier --write .
1256:open(p,'w').write(s)
1283:$ prettier --write .
1346:open(p,'w').write(s)
1362:$ prettier --write .
1396:generates the invoice. Writes with lines use a single CTE statement so they
1415:⏺ **Bash** — Write idempotent seed script
1454:$ prettier --write .
1503:$ prettier --write .
1552:$ prettier --write .
1586:⏺ **Bash** — Write README, AGENTS, CLAUDE and env example
1834:open(p,'w').write(s)
1838:open(p,'w').write(s)
1848:$ prettier --write .
2437:⏺ **Bash** — Run write-flow test against the preview
2664:⏺ **Bash** — Rerun write flow with debug output
2674:open(p,'w').write(s)
2908:    open(p,'w').write(s)
2919:$ prettier --write .
2987:open(p,'w').write(s)
{"default_branch":"master","delete_branch_on_merge":true,"private":false}
{"active":true,"events":["deployment_status","pull_request","push","workflow_run"],"url":"https://crm-agents.vercel.app/api/webhooks/github"}
DEMO_PASSWORD	2026-11-24T12:51:32Z
DEMO_USER	2026-11-24T12:51:16Z
NEON_API_KEY	2026-11-24T12:08:11Z
NEON_PROJECT_ID	2026-11-24T12:08:30Z
crm-agents/.env
crm-agents/.env.example
crm-agents/.env.local
BLOB_STORE_ID=
… (+25 líneas)
```

</details>

⏺ **Bash** — Check whether Vercel creates GitHub deployments

```
cd <repos>
gh api repos/daboy-dev/crm-demo/deployments 2>&1 | head -c 400; echo
gh api 'repos/daboy-dev/crm-demo/environments' 2>&1 | head -c 300; echo
sha=$(gh pr view 2 -R daboy-dev/crm-demo --json headRefOid -q .headRefOid); echo $sha
gh api repos/daboy-dev/crm-demo/commits/$sha/statuses --jq '.[] | [.context,.state,.target_url]|@tsv' 2>&1 | head
gh api repos/daboy-dev/crm-demo/commits/$sha/check-runs --jq '.check_runs[] | [.name,.app.slug,.conclusion]|@tsv' 2>&1 | head
cat crm-demo/vercel.json 2>/dev/null; cat crm-demo/.vercel/project.json 2>/dev/null | head -c 300
```

<details><summary>Resultado</summary>

```
[]
{"total_count":0,"environments":[]}
ad7524f69dfa1b70a1248290fc8f86b27ba24631
Vercel	success	https://vercel.com/daboy-dev/crm-demo/<deployment>
Vercel	pending	https://vercel.com/daboy-dev/crm-demo/<deployment>
Vercel	failure	https://vercel.com/daboy-dev/crm-demo/<deployment>
Vercel	failure	https://vercel.com/daboy-dev/crm-demo/<deployment>
Vercel	pending	https://vercel.com/daboy-dev/crm-demo/<deployment>
delete-preview-branch	github-actions	success
Vercel Preview Comments	vercel	success
check	github-actions	success
check	github-actions	success
{"projectId":"<vercel-project-id>","orgId":"<vercel-team-id>","projectName":"crm-demo"}
```

</details>

⏺ **Bash** — Find session-03 write test in transcript

```
sed -n 2380,2470p crm-agents/docs/sesiones/03-h1-crm-demo.md; ls crm-demo/node_modules/.bin | grep -c . ; ls crm-agents/node_modules/@vercel 2>&1; grep -rl "deployment_status\|repository_dispatch" crm-agents/node_modules/next/dist/docs 2>/dev/null | head -3
```

<details><summary>Resultado</summary>

```
<details><summary>Resultado</summary>

ˋˋˋ
src/app/(auth)/login/page.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
remote:      https://github.com/daboy-dev/crm-demo/pull/new/chore/preview-smoke-test        
remote: 
https://github.com/daboy-dev/crm-demo/pull/1
ˋˋˋ

</details>

⏺ **Bash** — Wait for PR checks and read Vercel comment

ˋˋˋ
sleep 20; gh pr checks 1 -R daboy-dev/crm-demo --watch --interval 15 2>&1 | tail -8; gh pr view 1 -R daboy-dev/crm-demo --json comments --jq '.comments[].body' | head -30
ˋˋˋ

<details><summary>Resultado</summary>

ˋˋˋ
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
ˋˋˋ

</details>

⏺ Vista previa lista. Compruebo que es accesible sin la protección de Vercel y que sirve el texto nuevo.
… (+53 líneas)
```

</details>

⏺ **Bash** — Check PAT access to Actions API without printing it

```
cd <repos>/crm-agents && set -a && . ./.env.local && set +a && for p in actions/artifacts actions/runs pulls; do curl -s -o /dev/null -w "$p %{http_code}\n" -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/daboy-dev/crm-demo/$p; done; cat src/app/globals.css | head -40; cat src/app/layout.tsx
```

<details><summary>Resultado</summary>

```
actions/artifacts 200
actions/runs 200
pulls 200
:root {
  --background: #ffffff;
  --foreground: #171717;
  --link: #0b57d0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
    --link: #8ab4f8;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  line-height: 1.5;
}

a {
  color: var(--link);
}

.home {
  max-width: 40rem;
… (+18 líneas)
```

</details>

⏺ No he escrito código todavía. He leído la documentación y he revisado los dos repos, y hay que resolver una cosa antes de empezar.

## ⚠️ No encaja con D15: Vercel no crea GitHub Deployments en `crm-demo`

`GET /repos/daboy-dev/crm-demo/deployments` devuelve `[]` y no hay ningún entorno en el repo. Vercel solo publica *commit statuses* (contexto `Vercel`), y el `target_url` de esos statuses apunta al panel de Vercel, no a la vista previa. Por eso hoy no llegaría ningún `deployment_status` y `preview-e2e.yml` nunca se ejecutaría. Es justo lo que D15 pedía comprobar.

**Propuesta:** activa en Vercel los eventos de despliegue de GitHub del proyecto `crm-demo` (en Settings → Git, la opción que crea los `deployment_status`; no puedo confirmar el nombre exacto de la opción). Lo compruebo yo con el primer PR. Si esa opción no existe en Hobby, el plan B sería disparar con el evento `status` y deducir la URL de la vista previa a partir del alias de la rama. Eso supone cambiar D15, así que no lo haría sin tu visto bueno.

## Lo demás está comprobado
- El webhook de `crm-demo` está activo, apunta a `crm-agents.vercel.app` y envía `pull_request`, `deployment_status` y `workflow_run`. También envía `push`, que se ignorará.
- El `GH_TOKEN` responde 200 en `actions/artifacts`, `actions/runs` y `pulls`, así que tiene los permisos que necesita.
- Los secrets de Actions de `crm-demo` están creados.

## Variables que tienes que crear en Vercel (`crm-agents`, todos los entornos)
`AUTH_SECRET` (por ejemplo con `openssl rand -base64 32`, distinto del de `crm-demo`), `DEMO_USER` y `DEMO_PASSWORD`. Después, `vercel env pull`. Además, `.env.example` usa todavía `GITHUB_TOKEN` y `GITHUB_WEBHOOK_SECRET`: lo actualizo a `GH_*`.

## Plan de commits

**`crm-demo`** (en la rama `ci/preview-e2e`; su PR sirve como primer PR de prueba)
1. `test: add page list and screenshot spec`: `e2e/pages.ts` y `e2e/screenshots.spec.ts`
2. `test: add write flow for preview deployments`: `e2e/write-flow.spec.ts`
3. `ci: run Playwright against Vercel previews`: `preview-e2e.yml` con `meta.json` y el artifact
4. `docs: describe preview E2E in AGENTS.md`

Después, un segundo PR con un test roto a propósito. Se cierra sin merge.

**`crm-agents`** (directo a `master`, como en H0)
1. `feat: add demo login with HMAC session`: auth y sus tests, proxy, `/login`, logout y `.env.example`
2. `feat: add GitHub events and pipeline schema`: esquema y migración, aplicada con `pnpm db:migrate`
3. `feat: verify GitHub webhook signatures`, con tests
4. `feat: store webhook deliveries idempotently`: la ruta, el insert con `on conflict` y `after()`
5. `feat: process pull_request and deployment_status events`, con el filtro de `workflow_run` y sus tests
6. `feat: parse e2e-results artifact`: `fflate`, el parseo de `results.json` y `meta.json` y sus tests
7. `feat: fetch artifacts and store screenshots in Blob`
8. `feat: serve screenshots behind login`
9. `feat: add pipeline page with polling and reprocess action`
10. `docs: close H2 with session log and transcript`

## Decisiones de detalle abiertas
1. **Cuándo se salta el test de escritura.** El `.env.local` de `crm-demo` apunta a la base de datos de producción, así que en local también escribiría en producción. En vez de saltarlo solo con la URL de producción, propongo **ejecutarlo únicamente si el host es una vista previa** (`crm-demo-*.vercel.app`). Con eso se salta en producción y también en localhost.
2. **Nombre de la variable.** El workflow pasa la URL como `E2E_BASE_URL`, que es la que ya lee `playwright.config.ts`, para que no arranque `pnpm dev`. El JSON se genera con `--reporter=list,json` y no toco el reporter del config.
3. **`pages.ts`.** Cada entrada es `{ name, path }`. Las de detalle llevan además `{ fromList, rowTestId }` y abren la primera fila de la lista, en lugar de usar un id fijo. Páginas: `clientes`, `presupuestos`, `facturas`, `presupuesto-detalle` y `cliente-detalle`, a 1280 px y a 390 px, que salen de los dos proyectos que ya existen. Son unas 10 capturas JPEG por ejecución.
4. **Fuente de verdad del sha.** Se toma de `workflow_run.head_sha`. `meta.json` solo sirve para comprobar que coincide, porque el artifact lo genera código que Develop puede modificar.
5. **Filtro de `workflow_run`.** Por `workflow_run.path === ".github/workflows/preview-e2e.yml"`, `action === "completed"` y repo `daboy-dev/crm-demo`.
6. **Idempotencia.** `previews` tiene un sha único y se actualiza con upsert. Si los eventos llegan desordenados, gana el de fecha más reciente en cada grupo de campos. `test_reports` es único por `(run_id, run_attempt)`, y `screenshots` por `(report_id, page, width)`. El blob tiene una ruta fija, `screenshots/<sha>/<run_id>/<page>-<w>.jpg`, y se sobrescribe.
7. **UI del panel.** CSS plano, como el panel actual, sin añadir Tailwind. El polling se hace con un componente cliente que llama a `router.refresh()` cada 5 s.
8. **Dependencias nuevas:** solo `fflate` y `@vercel/blob`. La API de GitHub se llama con `fetch`, sin Octokit. Cuando instale `@vercel/blob` compruebo cómo funcionan con OIDC `put` y `get` privados.

¿Apruebas el plan y las decisiones, o quieres cambiar algo? Y cuando hayas activado los eventos de despliegue en Vercel, avísame.

## ❯ Usuario

Aprobado, adelante

⏺ **Bash** — Read demo scripts, list test ids and rest of write test

```
cd <repos>/crm-demo && cat package.json && grep -rn 'data-testid\|testId' src/app/\(crm\)/clientes/page.tsx src/app/\(crm\)/clientes/\[id\]/page.tsx src/components/table.tsx | head -20 && sed -n 2470,2530p ../crm-agents/docs/sesiones/03-h1-crm-demo.md
```

<details><summary>Resultado</summary>

```
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
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.2.1",
    "drizzle-orm": "^0.45.4",
    "next": "16.4.6",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.65.1",
    "@tailwindcss/postcss": "^4.3.5",
    "@types/node": "^22.20.5",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "dotenv": "^18.0.10",
    "drizzle-kit": "^0.31.11",
… (+85 líneas)
```

</details>

⏺ **Bash** — Locate final write-test version and quote/invoice test ids

```
cd <repos> && grep -n "flows.tmp\|quote-form\|item-0\|generate-invoice\|mark-paid\|change-status" crm-agents/docs/sesiones/03-h1-crm-demo.md | tail -30; grep -rn 'data-testid' crm-demo/src/app/\(crm\)/presupuestos/quote-form.tsx crm-demo/src/app/\(crm\)/presupuestos/\[id\]/page.tsx crm-demo/src/app/\(crm\)/facturas/\[id\]/page.tsx crm-demo/src/components/line-items-table.tsx | cut -c1-200
```

<details><summary>Resultado</summary>

```
2440:cat > e2e/flows.tmp.spec.ts <<'EOF'
2478:  ✘  1 [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid (30.1s)
2481:  1) [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ───────
2485:    Error Context: test-results/flows.tmp-create-client-→-quote-→-accept-→-invoice-→-paid-desktop/error-context.md
2488:    test-results/flows.tmp-create-client-→-quote-→-accept-→-invoice-→-paid-desktop/trace.zip
2491:        pnpm exec playwright show-trace test-results/flows.tmp-create-client-→-quote-→-accept-→-invoice-→-paid-desktop/trace.zip
2496:    [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ────────
2518:- Name: flows.tmp.spec.ts >> create client → quote → accept → invoice → paid
2519:- Location: e2e/flows.tmp.spec.ts:5:1
2668:p='e2e/flows.tmp.spec.ts';s=open(p).read()
2676:E2E_BASE_URL=https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app pnpm exec playwright test e2e/flows.tmp.spec.ts --project desktop 2>&1 | grep -E "after dup|client |passed|failed|Error:|Expected|Received" | head
2682:✘  1 [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid (30.1s)
2683:  1) [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ───────
2685:    [desktop] › e2e/flows.tmp.spec.ts:5:1 › create client → quote → accept → invoice → paid ────────
2874:?? e2e/flows.tmp.spec.ts
2961:?? e2e/flows.tmp.spec.ts
2972:p='e2e/flows.tmp.spec.ts';s=open(p).read()
2986:  await expect(byTestId(page, "item-0-description")).toHaveValue("");''')
3004:  ✓   1 [desktop] › e2e/flows.tmp.spec.ts:6:1 › create client → quote → accept → invoice → paid (14.9s)
3005:  ✓   8 [mobile-390] › e2e/flows.tmp.spec.ts:6:1 › create client → quote → accept → invoice → paid (13.5s)
3036:mv e2e/flows.tmp.spec.ts <scratchpad>/flows.spec.ts; rm -rf test-results; git status --short; git switch -q master; git branch --show-current
crm-demo/src/app/(crm)/presupuestos/[id]/page.tsx:45:              data-testid="view-invoice-button"
crm-demo/src/app/(crm)/presupuestos/[id]/page.tsx:51:              <Button type="submit" data-testid="generate-invoice-button">
crm-demo/src/app/(crm)/presupuestos/[id]/page.tsx:58:      <div className="space-y-8" data-testid="quote-detail">
crm-demo/src/app/(crm)/presupuestos/[id]/page.tsx:94:              data-testid="quote-status-form"
crm-demo/src/app/(crm)/presupuestos/[id]/page.tsx:104:                data-testid="field-status"
crm-demo/src/app/(crm)/presupuestos/[id]/page.tsx:115:                data-testid="change-status-button"
crm-demo/src/components/line-items-table.tsx:12:      <Table data-testid="items-table">
crm-demo/src/components/line-items-table.tsx:24:            <Tr key={item.id} data-testid="item-row" data-id={item.id}>
crm-demo/src/components/line-items-table.tsx:40:      <dl className="ml-auto max-w-xs space-y-1 text-sm" data-testid="totals">
crm-demo/src/components/line-items-table.tsx:43:          <dd data-testid="total-subtotal">{formatEur(totals.subtotal)}</dd>
crm-demo/src/components/line-items-table.tsx:47:          <dd data-testid="total-tax">{formatEur(totals.tax)}</dd>
crm-demo/src/components/line-items-table.tsx:51:          <dd data-testid="total-total">{formatEur(totals.total)}</dd>
crm-demo/src/app/(crm)/presupuestos/quote-form.tsx:61:    <form action={formAction} className="space-y-6" data-testid="quote-form">
crm-demo/src/app/(crm)/presupuestos/quote-form.tsx:104:        <ol className="space-y-3" data-testid="quote-items">
crm-demo/src/app/(crm)/presupuestos/quote-form.tsx:109:              data-testid="quote-item-row"
crm-demo/src/app/(crm)/presupuestos/quote-form.tsx:120:                  data-testid={`item-${i}-description`}
crm-demo/src/app/(crm)/presupuestos/quote-form.tsx:134:                data-testid={`item-${i}-quantity`}
crm-demo/src/app/(crm)/presupuestos/quote-form.tsx:147:                data-testid={`item-${i}-unitPrice`}
crm-demo/src/app/(crm)/presupuestos/quote-form.tsx:156:                data-testid={`item-${i}-taxRate`}
… (+6 líneas)
```

</details>

⏺ **Bash** — Read quote form, quote and invoice detail markup

```
cd <repos>/crm-demo && sed -n 55,110p "src/app/(crm)/presupuestos/quote-form.tsx"; sed -n 30,60p "src/app/(crm)/presupuestos/[id]/page.tsx"; sed -n 90,125p "src/app/(crm)/presupuestos/[id]/page.tsx"; sed -n 25,60p "src/app/(crm)/facturas/[id]/page.tsx"; cat src/components/field.tsx | head -60; grep -n "status" src/db/schema.ts | head
```

<details><summary>Resultado</summary>

```
);

  const errors = state.errors;
  const lineError = (i: number, field: string) => errors[`items.${i}.${field}`];

  return (
    <form action={formAction} className="space-y-6" data-testid="quote-form">
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <SelectField
          label="Cliente"
          name="clientId"
          defaultValue={state.values.clientId ?? defaultClientId ?? ""}
          error={errors.clientId}
          required
        >
          <option value="">Elige un cliente…</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company
                ? `${client.name} (${client.company})`
                : client.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="Fecha"
          name="issuedAt"
          type="date"
          defaultValue={state.values.issuedAt ?? defaultIssuedAt}
          error={errors.issuedAt}
          required
        />
        <div className="sm:col-span-2">
          <TextareaField
            label="Notas"
            name="notes"
            defaultValue={state.values.notes ?? ""}
            error={errors.notes}
          />
        </div>
… (+183 líneas)
```

</details>

⏺ **Bash** — Create branch, helpers, page list and screenshot spec

```
git switch -c ci/preview-e2e && mkdir -p e2e && cat > e2e/helpers.ts <<'EOF'
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Next.js keeps visited pages in the DOM, hidden (React <Activity>), so the
 * same data-testid can appear twice. Always select through this helper.
 */
export function byTestId(page: Page | Locator, testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true });
}

/** Logs in with the demo credentials (DEMO_USER / DEMO_PASSWORD). */
export async function login(page: Page) {
  await page.goto("/login");
  await byTestId(page, "field-user").fill(process.env.DEMO_USER ?? "");
  await page
    .getByTestId("field-password")
    .fill(process.env.DEMO_PASSWORD ?? "");
  await byTestId(page, "login-submit").click();
  await expect(page).toHaveURL(/\/clientes$/);
}

/**
 * Vercel preview hosts (crm-demo-git-<branch>-… or crm-demo-<hash>-…). Tests
 * that write data only run there: each preview has its own Neon branch, while
 * production and local runs (whose .env.local points at production) do not.
 */
export function isPreviewDeployment(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  const { hostname } = new URL(baseURL);
  return /^crm-demo-[a-z0-9-]+\.vercel\.app$/.test(hostname);
}
EOF
python3 - <<'EOF'
p='e2e/smoke.spec.ts';s=open(p).read()
start=s.index('async function login'); end=s.index('test("redirects')
s=s[:start]+s[end:]
s=s.replace('import { expect, test, type Page } from "@playwright/test";\nimport { byTestId } from "./helpers";','import { expect, test } from "@playwright/test";\nimport { byTestId, login } from "./helpers";')
open(p,'w').write(s)
EOF
… (+60 líneas)
```

<details><summary>Resultado</summary>

```
Cambiado a nueva rama 'ci/preview-e2e'
ugrep: warning: node_modules/playwright-core/lib/server/deviceDescriptorsSource.json: No such file or directory
Node.js v22.23.4
```

</details>

⏺ **Bash** — Check Desktop Chrome viewport width

```
f=$(find node_modules/.pnpm -name deviceDescriptorsSource.json | head -1); python3 -c "import json;print(json.load(open('$f'))['Desktop Chrome']['viewport'])"
```

<details><summary>Resultado</summary>

```
Exit code 1
Traceback (most recent call last):
  File "<string>", line 1, in <module>
    import json;print(json.load(open(''))['Desktop Chrome']['viewport'])
                                ~~~~^^^^
FileNotFoundError: [Errno 2] No such file or directory: ''
```

</details>

⏺ Estoy preparando los tests de `crm-demo` (capturas y escritura). Compruebo el ancho del viewport de escritorio.

⏺ **Bash** — Print Desktop Chrome viewport from Playwright

```
cat > /private/tmp/claude-501/vp.spec.ts 2>/dev/null; node -e 'const {devices}=require("@playwright/test");console.log(devices["Desktop Chrome"].viewport)'
```

<details><summary>Resultado</summary>

```
{ width: 1280, height: 720 }
```

</details>

⏺ **Bash** — Write preview-only write-flow spec

```
cat > e2e/write-flow.spec.ts <<'EOF'
import { expect, test } from "@playwright/test";
import { byTestId, isPreviewDeployment, login } from "./helpers";

/**
 * Full write flow. It creates data, so it only runs against a Vercel preview,
 * which has its own Neon branch (D18). Production and local runs skip it.
 */
test.describe("write flow", () => {
  test.skip(
    ({ baseURL }) => !isPreviewDeployment(baseURL),
    "writes data: runs only against Vercel previews",
  );

  test("client → quote → accept → invoice → paid", async ({ page }) => {
    const stamp = `${Date.now()}-${test.info().project.name}`;
    const email = `preview-${stamp}@example.com`;
    await login(page);

    // Client: create, reject a duplicate email, edit.
    await byTestId(page, "new-client-button").click();
    await byTestId(page, "field-name").fill(`Prueba Preview ${stamp}`);
    await byTestId(page, "field-email").fill(email);
    await byTestId(page, "save-button").click();
    await expect(page).toHaveURL(/\/clientes\/\d+$/);
    const clientUrl = page.url();

    await byTestId(page, "edit-client-button").click();
    await byTestId(page, "field-company").fill("Empresa Preview");
    await byTestId(page, "field-email").fill("lucia.fernandez@example.com");
    await byTestId(page, "save-button").click();
    await expect(
      page.getByText("Ya existe un cliente con ese email."),
    ).toBeVisible();
    await byTestId(page, "field-email").fill(email);
    await byTestId(page, "save-button").click();
    await expect(page).toHaveURL(clientUrl);
    await expect(byTestId(page, "client-company")).toHaveText(
      "Empresa Preview",
    );
… (+36 líneas)
```

<details><summary>Resultado</summary>

```
18:  taxRate: string;
27:  taxRate: "21",
53:      taxRate: Number(line.taxRate),
66:          defaultValue={state.values.clientId ?? defaultClientId ?? ""}
83:          defaultValue={state.values.issuedAt ?? defaultIssuedAt}
91:            defaultValue={state.values.notes ?? ""}
152:                name="taxRate"
153:                value={line.taxRate}
154:                onChange={(e) => update(line.key, { taxRate: e.target.value })}
155:                error={lineError(i, "taxRate")}
12:  "draft",
14:  "accepted",
41:  status: quoteStatus().notNull().default("draft"),
src/components/status-badge.tsx:24:      data-testid="status-badge"
```

</details>

⏺ **Bash** — Run E2E against production read-only to check captures

```
pnpm exec prettier --write e2e >/dev/null && E2E_BASE_URL=https://crm-demo.vercel.app E2E_SCREENSHOTS_DIR=<scratchpad>/shots pnpm exec playwright test --trace off 2>&1 | tail -15; ls -la <scratchpad>/shots
```

<details><summary>Resultado</summary>

```
Exit code 1
    [desktop] › e2e/smoke.spec.ts:24:1 › lists clients, quotes and invoices with data ──────────────
    [desktop] › e2e/smoke.spec.ts:37:1 › shows a quote with its lines and totals ───────────────────
    [desktop] › e2e/smoke.spec.ts:46:1 › has no horizontal page scroll ─────────────────────────────
    [mobile-390] › e2e/screenshots.spec.ts:10:5 › screenshots › captures clientes ──────────────────
    [mobile-390] › e2e/screenshots.spec.ts:10:5 › screenshots › captures presupuestos ──────────────
    [mobile-390] › e2e/screenshots.spec.ts:10:5 › screenshots › captures facturas ──────────────────
    [mobile-390] › e2e/screenshots.spec.ts:10:5 › screenshots › captures cliente-detalle ───────────
    [mobile-390] › e2e/screenshots.spec.ts:10:5 › screenshots › captures presupuesto-detalle ───────
    [mobile-390] › e2e/smoke.spec.ts:4:1 › redirects to login without a session ────────────────────
    [mobile-390] › e2e/smoke.spec.ts:10:1 › rejects wrong credentials ──────────────────────────────
    [mobile-390] › e2e/smoke.spec.ts:18:1 › health endpoint is public ──────────────────────────────
    [mobile-390] › e2e/smoke.spec.ts:24:1 › lists clients, quotes and invoices with data ───────────
    [mobile-390] › e2e/smoke.spec.ts:37:1 › shows a quote with its lines and totals ────────────────
    [mobile-390] › e2e/smoke.spec.ts:46:1 › has no horizontal page scroll ──────────────────────────
  2 skipped
ls: <scratchpad>/shots: No such file or directory
```

</details>

⏺ Todos fallan, incluido el smoke que antes pasaba. Miro el primer error.

⏺ **Bash** — Show first failing test error

```
E2E_BASE_URL=https://crm-demo.vercel.app pnpm exec playwright test e2e/smoke.spec.ts -g "health" --project desktop --trace off 2>&1 | grep -v "^$" | head -30; curl -s -o /dev/null -w "%{http_code}\n" https://crm-demo.vercel.app/api/health
```

<details><summary>Resultado</summary>

```
Running 1 test using 1 worker
  ✘  1 [desktop] › e2e/smoke.spec.ts:18:1 › health endpoint is public (126ms)
  1) [desktop] › e2e/smoke.spec.ts:18:1 › health endpoint is public ────────────────────────────────
    SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
      19 |   const response = await request.get("/api/health");
      20 |   expect(response.status()).toBe(200);
    > 21 |   expect(await response.json()).toMatchObject({ ok: true, db: true });
         |          ^
      22 | });
      23 |
      24 | test("lists clients, quotes and invoices with data", async ({ page }) => {
        at <repos>/crm-demo/e2e/smoke.spec.ts:21:10
    Error Context: test-results/smoke-health-endpoint-is-public-desktop/error-context.md
  1 failed
    [desktop] › e2e/smoke.spec.ts:18:1 › health endpoint is public ─────────────────────────────────
200
```

</details>

⏺ **Bash** — Find the real crm-demo production URL

```
cd <repos> && grep -oh "https://crm-demo[a-z0-9.-]*vercel.app" crm-agents/docs/sesiones/03-h1-crm-demo.md crm-demo/README.md | sort | uniq -c
```

<details><summary>Resultado</summary>

```
9 https://crm-demo-daboy-dev.vercel.app
   2 https://crm-demo-daboy-devs-projects.vercel.app
  19 https://crm-demo-git-chore-preview-smoke-test-daboy-dev.vercel.app
   4 https://crm-demo-git-ci-neon-branch-cleanup-daboy-dev.vercel.app
```

</details>

⏺ Detalle importante: la producción es `crm-demo-daboy-dev.vercel.app`, que mi patrón de vista previa habría aceptado. Lo corrijo con una lista explícita de hosts de producción.

⏺ **Bash** — Exclude production hosts and rerun against production

```
cd <repos>/crm-demo && python3 - <<'EOF'
p='e2e/helpers.ts';s=open(p).read()
i=s.index('/**\n * Vercel preview hosts')
s=s[:i]+'''/** Production aliases of crm-demo. Never write data there. */
const PRODUCTION_HOSTS = new Set([
  "crm-demo-daboy-dev.vercel.app",
  "crm-demo-daboy-devs-projects.vercel.app",
]);

/**
 * True for Vercel preview hosts (crm-demo-git-<branch>-… or crm-demo-<hash>-…).
 * Tests that write data only run there: each preview has its own Neon branch,
 * while production and local runs (whose .env.local points at production) do
 * not.
 */
export function isPreviewDeployment(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  const { hostname } = new URL(baseURL);
  return (
    /^crm-demo-[a-z0-9-]+\\.vercel\\.app$/.test(hostname) &&
    !PRODUCTION_HOSTS.has(hostname)
  );
}
'''
open(p,'w').write(s)
EOF
tail -22 e2e/helpers.ts | head -5
SP=<scratchpad>
E2E_BASE_URL=https://crm-demo-daboy-dev.vercel.app E2E_SCREENSHOTS_DIR=$SP/shots pnpm exec playwright test --trace off 2>&1 | tail -6; ls $SP/shots
```

<details><summary>Resultado</summary>

```
}

/** Production aliases of crm-demo. Never write data there. */
const PRODUCTION_HOSTS = new Set([
  "crm-demo-daboy-dev.vercel.app",
  ✓  22 [mobile-390] › e2e/smoke.spec.ts:37:1 › shows a quote with its lines and totals (2.9s)
  ✓  23 [mobile-390] › e2e/smoke.spec.ts:46:1 › has no horizontal page scroll (2.6s)
  ✓  21 [mobile-390] › e2e/smoke.spec.ts:24:1 › lists clients, quotes and invoices with data (3.4s)

  2 skipped
  22 passed (12.8s)
cliente-detalle-1280.jpg
cliente-detalle-390.jpg
clientes-1280.jpg
clientes-390.jpg
facturas-1280.jpg
facturas-390.jpg
presupuesto-detalle-1280.jpg
presupuesto-detalle-390.jpg
presupuestos-1280.jpg
presupuestos-390.jpg
```

</details>

⏺ **Read** — `<scratchpad>/shots/presupuesto-detalle-390.jpg`

<details><summary>Resultado</summary>

```
[imagen]
```

</details>

⏺ **Bash** — Check and commit the two e2e commits

```
pnpm exec prettier --write e2e >/dev/null && pnpm lint 2>&1 | tail -3 && pnpm typecheck 2>&1 | tail -2 && pnpm format:check 2>&1 | tail -1 && rm -rf test-results &&
cp e2e/helpers.ts /tmp/h.full && python3 -c "
s=open('e2e/helpers.ts').read(); open('e2e/helpers.ts','w').write(s[:s.index('/** Production aliases')].rstrip()+'\n')" &&
git add e2e/helpers.ts e2e/pages.ts e2e/screenshots.spec.ts e2e/smoke.spec.ts && git commit -q -m "test: add page list and screenshot spec

e2e/pages.ts lists the pages captured on every preview, at 1280 and 390 px.
Detail pages open from the first list row so they do not depend on ids.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && cp /tmp/h.full e2e/helpers.ts && rm /tmp/h.full && git add e2e && git commit -q -m "test: add write flow for preview deployments

Creates a client, a quote with two lines, accepts it, generates the invoice
and marks it as paid. It writes data, so it skips any host that is not a
Vercel preview (production aliases and localhost included).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -3 && git status -s
```

<details><summary>Resultado</summary>

```
$ eslint
Generating route types...
✓ Types generated successfully
All matched files use Prettier code style!
8b911d6 test: add write flow for preview deployments
a1a7d38 test: add page list and screenshot spec
6094847 ci: delete the Neon preview branch when a pull request closes
```

</details>

⏺ **Bash** — Check JSON reporter env vars and action versions

```
grep -rhoE "PLAYWRIGHT_JSON_OUTPUT_[A-Z]+" node_modules/playwright/lib/reporters/*.js | sort -u; for r in actions/upload-artifact actions/checkout pnpm/action-setup actions/setup-node; do echo "$r $(gh api repos/$r/releases/latest --jq .tag_name)"; done
```

<details><summary>Resultado</summary>

```
(eval):1: no matches found: node_modules/playwright/lib/reporters/*.js
actions/upload-artifact v7.0.2
actions/checkout v7.0.1
pnpm/action-setup v6.1.1
actions/setup-node v7.1.0
```

</details>

⏺ **Bash** — Find JSON reporter output env var names

```
grep -rhoE "PLAYWRIGHT_JSON_OUTPUT_[A-Z]+" node_modules/.pnpm/playwright@*/node_modules/playwright/lib/ 2>/dev/null | sort -u
```

<details><summary>Resultado</summary>

```
(Bash completed with no output)
```

</details>

⏺ **Bash** — Locate playwright package and grep env names

```
d=$(node -p 'require.path=require.resolve("@playwright/test");require("path").dirname(require.resolve("playwright/package.json",{paths:[require("path").dirname(require.resolve("@playwright/test"))]}))'); echo $d; grep -rhoE "JSON_OUTPUT_[A-Z]+" "$d" | sort -u
```

<details><summary>Resultado</summary>

```
<repos>/crm-demo/node_modules/.pnpm/playwright@1.65.1/node_modules/playwright
```

</details>

⏺ Estoy escribiendo el workflow `preview-e2e.yml`. Compruebo cómo se configura la salida del reporter JSON de Playwright.

⏺ **Bash** — Grep reporter output env naming pattern

```
grep -rlE "OUTPUT_FILE|OUTPUT_NAME" node_modules/.pnpm/playwright@1.65.1/node_modules/playwright/ | head -3; grep -rhoE "\`PLAYWRIGHT_\\$\{[^}]*\}_OUTPUT_[A-Z]+|_OUTPUT_(FILE|NAME|DIR)" node_modules/.pnpm/playwright@1.65.1/node_modules/playwright/lib | sort -u | head
```

<details><summary>Resultado</summary>

```
node_modules/.pnpm/playwright@1.65.1/node_modules/playwright/lib/program.js
node_modules/.pnpm/playwright@1.65.1/node_modules/playwright/lib/runner/index.js
_OUTPUT_DIR
_OUTPUT_FILE
`PLAYWRIGHT_${name}_OUTPUT_DIR
`PLAYWRIGHT_${name}_OUTPUT_FILE
`PLAYWRIGHT_${name}_OUTPUT_NAME
```

</details>

⏺ **Write** — `<repos>/crm-demo/.github/workflows/preview-e2e.yml`

```
name: Preview E2E

# Runs Playwright against every Vercel preview once it is ready (D15) and
# leaves the results in the `e2e-results` artifact. The crm-agents panel
# downloads it when GitHub sends the workflow_run webhook (D16), so this repo
# holds no secret of the panel.

on: deployment_status

permissions:
  contents: read

concurrency:
  group: preview-e2e-${{ github.event.deployment.ref }}
  cancel-in-progress: true

jobs:
  e2e:
    # Vercel sometimes appends the project name ("Preview – crm-demo").
    if: >-
      github.event.deployment_status.state == 'success' &&
      startsWith(github.event.deployment.environment, 'Preview')
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      E2E_BASE_URL: ${{ github.event.deployment_status.target_url }}
      E2E_SCREENSHOTS_DIR: e2e-results/screenshots
      PLAYWRIGHT_JSON_OUTPUT_FILE: e2e-results/results.json
      DEMO_USER: ${{ secrets.DEMO_USER }}
      DEMO_PASSWORD: ${{ secrets.DEMO_PASSWORD }}
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.deployment.sha }}
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
… (+27 líneas)
```

<details><summary>Resultado</summary>

```
File created successfully at: <repos>/crm-demo/.github/workflows/preview-e2e.yml (file state is current in your context — no need to Read it back)
```

</details>

⏺ Ahora `AGENTS.md` y `.gitignore`.

⏺ **Bash** — Update AGENTS.md and gitignore, commit workflow and docs

```
grep -n "test-results\|playwright" .gitignore; python3 - <<'EOF'
p='AGENTS.md';s=open(p).read()
old="## Convenciones"
new='''## E2E contra las vistas previas

- Cada vista previa de Vercel lanza `.github/workflows/preview-e2e.yml` (evento
  `deployment_status`). Ejecuta Playwright contra la URL de la vista previa en escritorio (1280 px) y
  a 390 px, y sube el artifact `e2e-results` (`results.json`, `meta.json` y capturas). El panel
  `crm-agents` lo descarga y lo muestra.
- **`e2e/pages.ts`** es la lista de páginas que se capturan (`<name>-<1280|390>.jpg`). Si añades una
  página que debe verse en la revisión, añade una línea ahí; no hace falta tocar nada más.
- `e2e/write-flow.spec.ts` crea datos, así que solo se ejecuta contra vistas previas (cada una tiene
  su rama de Neon). En producción y en local se salta.
- Puedes añadir tests nuevos en `e2e/*.spec.ts` usando `byTestId` y `login` de `e2e/helpers.ts`.

## Convenciones'''
assert old in s; s=s.replace(old,new,1)
old2="- Config de build y despliegue: `next.config.ts`, `package.json` (scripts), `drizzle.config.ts`,\n  `tsconfig.json`, `eslint.config.mjs`, `.github/workflows/`, `playwright.config.ts`."
new2="- Config de build y despliegue: `next.config.ts`, `package.json` (scripts), `drizzle.config.ts`,\n  `tsconfig.json`, `eslint.config.mjs`, `playwright.config.ts`.\n- **`.github/**`** (workflows incluidos) y los helpers de `e2e/` (`helpers.ts`,\n  `screenshots.spec.ts`). El panel rechaza cualquier cambio que los toque."
assert old2 in s; s=s.replace(old2,new2,1)
open(p,'w').write(s)
EOF
grep -q '^/e2e-results' .gitignore || printf '\n# Preview E2E output (uploaded as an artifact in CI)\n/e2e-results/\n' >> .gitignore
pnpm exec prettier --check .github >/dev/null 2>&1; pnpm format:check | tail -1
git add -A && git commit -q -m "ci: run Playwright against Vercel previews

On deployment_status (success, Preview environment) run the E2E suite against
the preview URL and upload e2e-results (results.json, meta.json, screenshots)
as an artifact. The panel downloads it on workflow_run, so no panel secret
lives here (D15, D16).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- .github .gitignore && git commit -q -m "docs: describe preview E2E in AGENTS.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- AGENTS.md && git log --oneline -4 && git status -s
```

<details><summary>Resultado</summary>

```
46:# playwright
47:/test-results/
48:/playwright-report/
49:/playwright/.cache/
$ prettier --check .
All matched files use Prettier code style!
6c2bb79 docs: describe preview E2E in AGENTS.md
beb0f91 ci: run Playwright against Vercel previews
8b911d6 test: add write flow for preview deployments
a1a7d38 test: add page list and screenshot spec
```

</details>

⏺ Los 4 commits de `crm-demo` están listos. Subo la rama y abro el PR. Así compruebo también si Vercel ya crea los `deployment_status`.

⏺ **Bash** — Push branch and open the crm-demo PR

```
git push -q -u origin ci/preview-e2e 2>&1 | grep -v "^remote:" ; gh pr create -R daboy-dev/crm-demo --base master --head ci/preview-e2e --title "ci: run Playwright against Vercel previews (H2)" --body "$(cat <<'EOF'
Runs Playwright against every Vercel preview and leaves the results in the `e2e-results` artifact for the crm-agents panel (D15, D16, D18).

- `e2e/pages.ts`: pages captured at 1280 and 390 px.
- `e2e/write-flow.spec.ts`: full write flow, only on preview hosts.
- `.github/workflows/preview-e2e.yml`: `deployment_status` → Playwright → artifact (`results.json`, `meta.json`, screenshots), 1-day retention.
- `AGENTS.md`: how preview E2E works and what Develop must not touch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

<details><summary>Resultado</summary>

```
https://github.com/daboy-dev/crm-demo/pull/3
```

</details>

⏺ Mientras Vercel compila la vista previa, empiezo el login del panel.

⏺ **Bash** — Read demo login action, form, page and tests

```
cat "src/app/(auth)/login/actions.ts" "src/app/(auth)/login/login-form.tsx" "src/app/(auth)/login/page.tsx" src/lib/forms.ts; grep -n "logout" -r src | head; sed -n 1,200p src/lib/auth.test.ts | head -120
```

<details><summary>Resultado</summary>

```
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  getAuthSecret,
  safeEqual,
} from "@/lib/auth";

export type LoginState = { error: string | null; user: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const secret = getAuthSecret();
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");
  const expectedUser = process.env.DEMO_USER ?? "";
  const expectedPassword = process.env.DEMO_PASSWORD ?? "";

  // Evaluate both checks so timing does not reveal which one failed.
  const [userOk, passwordOk] = await Promise.all([
    safeEqual(user, expectedUser, secret),
    safeEqual(password, expectedPassword, secret),
  ]);
  if (!expectedUser || !expectedPassword || !userOk || !passwordOk) {
    return { error: "Usuario o contraseña incorrectos.", user };
  }

  (await cookies()).set(
    SESSION_COOKIE,
    await createSessionToken(user, secret),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
… (+172 líneas)
```

</details>

⏺ **Bash** — Check panel tsconfig paths and vitest config

```
cd <repos>/crm-agents && grep -n '"@/\*"\|paths' -A1 tsconfig.json; cat vitest.config.ts; git status -s; cat AGENTS.md | head -20
```

<details><summary>Resultado</summary>

```
21:    "paths": {
22:      "@/*": ["./src/*"]
23-    },
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
```

</details>

⏺ **Bash** — Add panel login, proxy, styles and env example; run checks

```
cd <repos> && mkdir -p crm-agents/src/app/login && 
sed -e 's|Do not modify without a human reviewer (see AGENTS.md).|Copied from crm-demo (D19). Keep both copies in sync.|' -e 's/export const SESSION_COOKIE = "crm_session";/export const SESSION_COOKIE = "agents_session";/' crm-demo/src/lib/auth.ts > crm-agents/src/server/auth.ts &&
cp crm-demo/src/lib/auth.test.ts crm-agents/src/server/auth.test.ts &&
cat > crm-agents/src/proxy.ts <<'EOF'
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth";

/**
 * Protects every route except the public ones below (D19). The GitHub
 * webhook authenticates itself with its HMAC signature.
 */
const PUBLIC_PATHS = ["/login", "/api/health", "/api/webhooks/github"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  const user = secret
    ? await verifySessionToken(
        request.cookies.get(SESSION_COOKIE)?.value,
        secret,
      )
    : null;
  if (user) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
EOF
… (+154 líneas)
```

<details><summary>Resultado</summary>

```
VERCEL_OIDC_TOKEN=

# --- Variables que llegan en hitos posteriores ---
# H4+ · LLM (capa gratuita de Gemini)
# GEMINI_API_KEY=
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
      Tests  12 passed (12)
   Start at  14:24:11
   Duration  261ms (import 82%, transform 12%, tests 3%, worker 3%)
```

</details>

⏺ **Bash** — Commit panel login and check PR deployments

```
git add -A && git commit -q -m "feat: add demo login with HMAC session

Copies the signed-cookie session from crm-demo with its tests (D19). The proxy
protects everything except /login, /api/health and /api/webhooks/github.
.env.example now lists the H2 variables with their real names (GH_*).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
gh api repos/daboy-dev/crm-demo/deployments --jq '.[] | [.id,.environment,.ref,.sha[0:7]]|@tsv'; gh pr checks 3 -R daboy-dev/crm-demo 2>&1 | head
```

<details><summary>Resultado</summary>

```
317f87d feat: add demo login with HMAC session
8029128261	Preview	6c2bb79bba387eb6724303d924bcc8d4f867607c	6c2bb79
e2e	pending	0	https://github.com/daboy-dev/crm-demo/actions/runs/45403048280/job/138476356704	
Vercel	pass	0	https://vercel.com/daboy-dev/crm-demo/<deployment>	Deployment has completed
Vercel Preview Comments	pass	0	https://vercel.com/github	
check	pass	29s	https://github.com/daboy-dev/crm-demo/actions/runs/45402971444/job/138476092888	
check	pass	28s	https://github.com/daboy-dev/crm-demo/actions/runs/45402984727/job/138476135889
```

</details>

⏺ Vercel ya crea deployments (lo has activado 👍) y el workflow `e2e` está en marcha. Pero hay una sorpresa: `deployment.ref` es el **sha**, no la rama. Miro qué más trae el deployment.

⏺ **Bash** — Inspect deployment object and statuses

```
gh api repos/daboy-dev/crm-demo/deployments/8029128261 --jq '{ref,sha,task,environment,original_environment,description,payload,transient_environment,production_environment}'; gh api repos/daboy-dev/crm-demo/deployments/8029128261/statuses --jq '.[] | {state, environment, target_url: (.target_url|sub("//[^.]*";"//<host>")), environment_url: (.environment_url|sub("//[^.]*";"//<host>")), log_url: (.log_url|tostring|.[0:30])}'
```

<details><summary>Resultado</summary>

```
{"description":null,"environment":"Preview","original_environment":"Preview","payload":{},"production_environment":false,"ref":"6c2bb79bba387eb6724303d924bcc8d4f867607c","sha":"6c2bb79bba387eb6724303d924bcc8d4f867607c","task":"deploy","transient_environment":false}
{"environment":"Preview","environment_url":"https://\u003chost\u003e.vercel.app","log_url":"https://crm-demo-<deployment>-dab","state":"success","target_url":"https://\u003chost\u003e.vercel.app"}
{"environment":"Preview","environment_url":"https://\u003chost\u003e.vercel.app","log_url":"https://crm-demo-<deployment>-dab","state":"inactive","target_url":"https://\u003chost\u003e.vercel.app"}
```

</details>

⏺ Vercel pone el sha en `ref` y deja el `payload` vacío, así que en el evento no viene la rama. Espero a que acabe la primera ejecución para revisar el artifact real antes de contártelo.

⏺ **Bash** — Wait for preview E2E run and list its artifact

```
cd <repos> && gh run watch 45403048280 -R daboy-dev/crm-demo --exit-status --interval 10 >/dev/null 2>&1; echo exit=$?; gh run view 45403048280 -R daboy-dev/crm-demo --json conclusion,headBranch,headSha,event,path,name --jq .; gh api repos/daboy-dev/crm-demo/actions/runs/45403048280/artifacts --jq '.artifacts[] | {name,size_in_bytes,expired}'
```

<details><summary>Resultado</summary>

```
exit=0
Unknown JSON field: "path"
Available fields:
  attempt
  conclusion
  createdAt
  databaseId
  displayTitle
  event
  headBranch
  headSha
  jobs
  name
  number
  startedAt
  status
  updatedAt
  url
  workflowDatabaseId
  workflowName
{"expired":false,"name":"e2e-results","size_in_bytes":355114}
```

</details>

⏺ **Bash** — Download artifact and inspect meta and results structure

```
SP=<scratchpad>; gh api repos/daboy-dev/crm-demo/actions/runs/45403048280 --jq '{conclusion,head_branch,head_sha,event,path,name,run_attempt,pull_requests}'; rm -rf $SP/art && mkdir -p $SP/art && gh run download 45403048280 -R daboy-dev/crm-demo -n e2e-results -D $SP/art && ls -R $SP/art | head -20 && cat $SP/art/meta.json && python3 -I -c "
import json,sys;r=json.load(open(sys.argv[1]));print(r.keys());print(r['stats'])
def walk(s,d=0):
  for sp in s.get('specs',[]):
    for t in sp['tests']: print(' '*d, sp['title'], t['projectName'], t['status'], [x['status'] for x in t['results']])
  for c in s.get('suites',[]): walk(c,d+1)
for s in r['suites']: print(s['title']); walk(s,1)
print(json.dumps(r['config'])[:300])" $SP/art/results.json
```

<details><summary>Resultado</summary>

```
{"conclusion":"success","event":"deployment_status","head_branch":"ci/preview-e2e","head_sha":"6c2bb79bba387eb6724303d924bcc8d4f867607c","name":"Preview E2E","path":".github/workflows/preview-e2e.yml","pull_requests":[{"base":{"ref":"master","repo":{"id":1469363235,"name":"crm-demo","url":"https://api.github.com/repos/daboy-dev/crm-demo"},"sha":"6094847571c82714e0c12963b72c4e57b3ed023d"},"head":{"ref":"ci/preview-e2e","repo":{"id":1469363235,"name":"crm-demo","url":"https://api.github.com/repos/daboy-dev/crm-demo"},"sha":"6c2bb79bba387eb6724303d924bcc8d4f867607c"},"id":5472980871,"number":3,"url":"https://api.github.com/repos/daboy-dev/crm-demo/pulls/3"}],"run_attempt":1}
meta.json
results.json
screenshots

<scratchpad>/art/screenshots:
cliente-detalle-1280.jpg
cliente-detalle-390.jpg
clientes-1280.jpg
clientes-390.jpg
facturas-1280.jpg
facturas-390.jpg
presupuesto-detalle-1280.jpg
presupuesto-detalle-390.jpg
presupuestos-1280.jpg
presupuestos-390.jpg
{
  "sha": "6c2bb79bba387eb6724303d924bcc8d4f867607c",
  "ref": "6c2bb79bba387eb6724303d924bcc8d4f867607c",
  "target_url": "https://crm-demo-<deployment>-daboy-dev.vercel.app",
  "run_id": 45403048280,
  "run_attempt": 1
}
dict_keys(['config', 'suites', 'errors', 'stats'])
{'startTime': '2026-11-24T13:24:55.729Z', 'duration': 46710.037000000004, 'expected': 24, 'skipped': 0, 'unexpected': 0, 'flaky': 0}
screenshots.spec.ts
   captures clientes desktop expected ['passed']
   captures clientes mobile-390 expected ['passed']
   captures presupuestos desktop expected ['passed']
   captures presupuestos mobile-390 expected ['passed']
   captures facturas desktop expected ['passed']
   captures facturas mobile-390 expected ['passed']
   captures cliente-detalle desktop expected ['passed']
   captures cliente-detalle mobile-390 expected ['passed']
   captures presupuesto-detalle desktop expected ['passed']
   captures presupuesto-detalle mobile-390 expected ['passed']
smoke.spec.ts
  redirects to login without a session desktop expected ['passed']
  redirects to login without a session mobile-390 expected ['passed']
  rejects wrong credentials desktop expected ['passed']
… (+13 líneas)
```

</details>

⏺ **Bash** — Inspect results.json config and test shape

```
SP=<scratchpad>; python3 -I -c "
import json,sys;r=json.load(open(sys.argv[1]));c=r['config'];print(list(c.keys()));print(c.get('metadata'));print([p['name'] for p in c['projects']])
t=r['suites'][0]['specs'][0]['tests'][0];print(t.keys());print(t['results'][0].keys());print(r['suites'][0]['specs'][0].keys())" $SP/art/results.json; grep -c -i "password\|DEMO_" $SP/art/results.json
```

<details><summary>Resultado</summary>

```
Traceback (most recent call last):
  File "<string>", line 3, in <module>
    t=r['suites'][0]['specs'][0]['tests'][0];print(t.keys());print(t['results'][0].keys());print(r['suites'][0]['specs'][0].keys())
      ~~~~~~~~~~~~~~~~~~~~~~~^^^
IndexError: list index out of range
['argv', 'configFile', 'rootDir', 'failOnFlakyTests', 'forbidOnly', 'fullyParallel', 'globalSetup', 'globalTeardown', 'globalTimeout', 'grep', 'grepInvert', 'maxFailures', 'metadata', 'preserveOutput', 'projects', 'filteredProjects', 'quiet', 'reporter', 'reportSlowTests', 'shard', 'tags', 'updateSnapshots', 'updateSourceMethod', 'version', 'workers', 'webServer']
{'ci': {'commitHref': 'https://github.com/daboy-dev/crm-demo/commit/6c2bb79bba387eb6724303d924bcc8d4f867607c', 'commitHash': '6c2bb79bba387eb6724303d924bcc8d4f867607c', 'buildHref': 'https://github.com/daboy-dev/crm-demo/actions/runs/45403048280'}, 'gitCommit': {'shortHash': '6c2bb79', 'hash': '6c2bb79bba387eb6724303d924bcc8d4f867607c', 'subject': 'docs: describe preview E2E in AGENTS.md', 'body': 'docs: describe preview E2E in AGENTS.md\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n', 'author': {'name': 'daboy-dev', 'email': '<email>', 'time': 1795526608000}, 'committer': {'name': 'daboy-dev', 'email': '<email>', 'time': 1795526608000}, 'branch': 'HEAD'}, 'actualWorkers': 2}
['desktop', 'mobile-390']
0
```

</details>

⏺ **Pregunta al humano:** D15 no encaja con la realidad: Vercel pone el sha en deployment.ref (no la rama) y deja el payload vacío, así que `concurrency` por `deployment.ref` agrupa por commit y nunca cancela la ejecución de un commit anterior del mismo PR; además meta.json.ref sale como sha. (El evento workflow_run sí trae head_branch y el número de PR, así que el panel no se ve afectado.) ¿Qué hacemos?

- **Job previo que resuelve la rama (Recommended)**: Un job ligero `resolve` busca con GITHUB_TOKEN (contents: read) la rama cuyo head es ese sha; el job e2e usa concurrency por esa rama y meta.json lleva ref = rama. ~10 s más. Actualizo D15.
- **Aceptar agrupar por sha**: Sin cambios en el workflow: no se cancelan ejecuciones de commits antiguos (más minutos de Actions, inofensivo). meta.json.ref = sha; la rama sale de workflow_run.head_branch. Anoto el matiz en D15.

**Respuesta del humano:** Job previo que resuelve la rama (Recommended)

⏺ Implemento el job `resolve`.

⏺ **Bash** — Add branch-resolve job, commit and push

```
cd <repos>/crm-demo && python3 - <<'EOF'
p='.github/workflows/preview-e2e.yml';s=open(p).read()
old_c='''concurrency:
  group: preview-e2e-${{ github.event.deployment.ref }}
  cancel-in-progress: true

jobs:
  e2e:
    # Vercel sometimes appends the project name ("Preview – crm-demo").
    if: >-
      github.event.deployment_status.state == 'success' &&
      startsWith(github.event.deployment.environment, 'Preview')
    runs-on: ubuntu-latest
    timeout-minutes: 15
'''
new_c='''jobs:
  # Vercel sets deployment.ref to the commit sha, not the branch, so look the
  # branch up to cancel the run of an older commit on the same branch.
  resolve:
    # Vercel sometimes appends the project name ("Preview – crm-demo").
    if: >-
      github.event.deployment_status.state == 'success' &&
      startsWith(github.event.deployment.environment, 'Preview')
    runs-on: ubuntu-latest
    timeout-minutes: 2
    outputs:
      branch: ${{ steps.branch.outputs.branch }}
    steps:
      - id: branch
        env:
          GH_TOKEN: ${{ github.token }}
          SHA: ${{ github.event.deployment.sha }}
        run: |
          branch=$(gh api "repos/$GITHUB_REPOSITORY/commits/$SHA/branches-where-head" --jq '.[0].name // empty')
          echo "branch=${branch:-$SHA}" >> "$GITHUB_OUTPUT"

  e2e:
    needs: resolve
    concurrency:
      group: preview-e2e-${{ needs.resolve.outputs.branch }}
… (+17 líneas)
```

<details><summary>Resultado</summary>

```
All matched files use Prettier code style!
b9a60a2 ci: group preview E2E runs by branch
```

</details>

⏺ Ya está subido. Mientras se ejecuta, sigo con el panel: instalo `fflate` y `@vercel/blob` y reviso cómo autentica Blob con OIDC.

⏺ **Bash** — Install deps and inspect Blob OIDC support

```
cd <repos>/crm-agents && pnpm add fflate @vercel/blob 2>&1 | tail -4; d=node_modules/@vercel/blob; cat $d/package.json | grep '"version"'; ls $d/dist | head; grep -rn "BLOB_STORE_ID\|OIDC\|oidc" $d/dist/*.d.ts | head -20; ls $d/*.md
```

<details><summary>Resultado</summary>

```
+ @vercel/blob 2.9.0
+ fflate 0.8.3

Done in 754ms using pnpm v12.9.1
  "version": "2.9.0",
chunk-RUHXEFX2.cjs
chunk-RUHXEFX2.cjs.map
chunk-VIBDXTF6.js
chunk-VIBDXTF6.js.map
client.cjs
client.cjs.map
client.d.cts
client.d.ts
client.js
client.js.map
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:7:     * When supplied, this takes priority over process.env.VERCEL_OIDC_TOKEN and process.env.BLOB_READ_WRITE_TOKEN.
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:12:     * Define your Vercel OIDC token for store-scoped blob operations.
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:13:     * Use this together with `storeId` (or `BLOB_STORE_ID`) when you want to pass OIDC credentials explicitly.
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:14:     * @defaultvalue process.env.VERCEL_OIDC_TOKEN
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:16:    oidcToken?: string;
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:18:     * Blob store id. Used to override process.env.BLOB_STORE_ID when Vercel OIDC token is available.
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:19:     * @defaultvalue process.env.BLOB_STORE_ID
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:144: * storing it. Requires OIDC authentication.
node_modules/@vercel/blob/dist/create-folder-DoYODb65.d.ts:383: * (`POST /signed-token`). Use OIDC (`VERCEL_OIDC_TOKEN` + `storeId` / `BLOB_STORE_ID`)
node_modules/@vercel/blob/dist/index.d.ts:14:     * Only the optimized output is stored. Requires OIDC authentication and is
node_modules/@vercel/blob/dist/index.d.ts:208: * - If a pathname is provided, constructs the URL from the resolved store ID (from the read-write token or `BLOB_STORE_ID`).
node_modules/@vercel/blob/dist/index.d.ts:227: *   - oidcToken - (Optional) Vercel OIDC token for authentication with `storeId` (or `BLOB_STORE_ID`); overrides `VERCEL_OIDC_TOKEN`.
node_modules/@vercel/blob/dist/index.d.ts:228: *   - storeId - (Optional) Store id when using Vercel OIDC token for authentication; overrides `BLOB_STORE_ID`.
node_modules/@vercel/blob/dist/index.d.ts:229: *   - token - (Optional) Read-write token when not using Vercel OIDC token for authentication, or set `BLOB_READ_WRITE_TOKEN`.
node_modules/@vercel/blob/dist/index.d.ts:325: *   - token - (Optional) A string specifying the token to use when making requests. It defaults to process.env.BLOB_READ_WRITE_TOKEN when deployed on Vercel. Ignored when Vercel OIDC token is available and either process.env.BLOB_STORE_ID or options.storeId is set.
node_modules/@vercel/blob/dist/index.d.ts:326: *   - oidcToken - (Optional) Vercel OIDC token for authentication with `storeId` (or `BLOB_STORE_ID`); overrides `VERCEL_OIDC_TOKEN`.
node_modules/@vercel/blob/dist/index.d.ts:327: *   - storeId - (Optional) Blob store id. Used to override process.env.BLOB_STORE_ID when Vercel OIDC token is available.
node_modules/@vercel/blob/dist/index.d.ts:447: * result is stored. Requires OIDC authentication. Billed as an image
node_modules/@vercel/blob/dist/index.d.ts:460: *   - token - (Optional) A string specifying the token to use when making requests. It defaults to process.env.BLOB_READ_WRITE_TOKEN when deployed on Vercel. Ignored when Vercel OIDC token is available and either process.env.BLOB_STORE_ID or options.storeId is set.
node_modules/@vercel/blob/dist/index.d.ts:461: *   - oidcToken - (Optional) Vercel OIDC token for authentication with `storeId` (or `BLOB_STORE_ID`); overrides `VERCEL_OIDC_TOKEN`.
node_modules/@vercel/blob/README.md
node_modules/@vercel/blob/license.md
```

</details>

⏺ **Bash** — Inspect Blob get/put private API and OIDC source

```
d=node_modules/@vercel/blob; grep -A8 '"dependencies"' $d/package.json; grep -n "^declare function get\b\|^declare function get(\|access: 'private'\|access?:\|GetBlobResult\|interface GetCommandOptions" -A3 $d/dist/index.d.ts | head -60; grep -n "getVercelOidcToken\|x-vercel-oidc-token" $d/dist/*.js | head -5
```

<details><summary>Resultado</summary>

```
"dependencies": {
    "@vercel/oidc": "^3.6.1",
    "async-retry": "^1.3.3",
    "is-buffer": "^2.0.5",
    "is-node-process": "^1.2.0",
    "throttleit": "^2.1.0",
    "undici": "^6.23.0"
  },
  "devDependencies": {
137:interface GetCommandOptions extends BlobCommandOptions {
138-    /**
139-     * Whether the blob is publicly accessible or private.
140-     * - 'public': The blob is publicly accessible via its URL.
--
163:interface GetBlobResultBlobBase {
164-    url: string;
165-    downloadUrl: string;
166-    pathname: string;
--
178:type GetBlobResult = {
179-    /** HTTP 200: Full response with stream and complete metadata. */
180-    statusCode: 200;
181-    /** The readable stream from the fetch response. */
--
186:    blob: GetBlobResultBlobBase & {
187-        contentType: string;
188-        size: number;
189-    };
--
198:    blob: GetBlobResultBlobBase & {
199-        contentType: null;
200-        size: null;
201-    };
--
215: * const { stream, headers, blob } = await get('user123/avatar.png', { access: 'private' });
216- *
217- * // Bypass the CDN cache and read the latest content from origin storage
218: * const { stream, headers, blob } = await get('user123/data.json', { access: 'private', useCache: false });
219- * ˋˋˋ
220- *
… (+12 líneas)
```

</details>

⏺ Blob usa `@vercel/oidc`, así que en Vercel funciona sin token estático. Hago una prueba rápida de `put`, `get` y `del` privados con las variables locales.

⏺ **Bash** — Smoke test private Blob put/get/del via OIDC

```
cat > scratch-blob.mjs <<'EOF'
import { put, get, del } from "@vercel/blob";
const r = await put("smoke/test.txt", "hola", { access: "private", allowOverwrite: true, contentType: "text/plain" });
console.log("put ok", r.pathname, r.url.startsWith("https://") );
const g = await get("smoke/test.txt", { access: "private" });
console.log("get", g?.statusCode, await new Response(g.stream).text());
await del(r.pathname);
console.log("del ok");
EOF
node --env-file=.env.local scratch-blob.mjs 2>&1 | sed -E 's#https://[^ ]+#<url>#g' | head; rm scratch-blob.mjs
```

<details><summary>Resultado</summary>

```
file://<repos>/crm-agents/node_modules/.pnpm/@vercel+blob@2.9.0/node_modules/@vercel/blob/dist/chunk-VIBDXTF6.js:694
      error = new BlobOidcEnvironmentNotAllowedError(message);
              ^

BlobOidcEnvironmentNotAllowedError: Vercel Blob: OIDC is enabled for this project, but not for the "development" environment.
    at getBlobError (file://<repos>/crm-agents/node_modules/.pnpm/@vercel+blob@2.9.0/node_modules/@vercel/blob/dist/chunk-VIBDXTF6.js:694:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async file://<repos>/crm-agents/node_modules/.pnpm/@vercel+blob@2.9.0/node_modules/@vercel/blob/dist/chunk-VIBDXTF6.js:824:31
    at async requestApi (file://<repos>/crm-agents/node_modules/.pnpm/@vercel+blob@2.9.0/node_modules/@vercel/blob/dist/chunk-VIBDXTF6.js:768:23)
    at async put (file://<repos>/crm-agents/node_modules/.pnpm/@vercel+blob@2.9.0/node_modules/@vercel/blob/dist/chunk-VIBDXTF6.js:1563:22)
```

</details>

⏺ **Bash** — Look up after() and maxDuration docs in Next 16

```
cd <repos>/crm-agents/node_modules/next/dist/docs && grep -rl "maxDuration" . | head -5; grep -rn "cacheComponents" -l . | grep -i "segment\|route" | head; f=$(grep -rl "^title: after" . | head -1); echo $f; sed -n 1,80p "$f" | grep -v "^$" | head -60
```

<details><summary>Resultado</summary>

```
02-pages/03-building-your-application/01-routing/07-api-routes.md
01-app/03-api-reference/04-functions/after.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md
01-app/03-api-reference/07-adapters/09-output-types.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md
01-app/03-api-reference/04-functions/use-selected-layout-segment.md
01-app/03-api-reference/04-functions/use-selected-layout-segments.md
01-app/03-api-reference/04-functions/use-router.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/dynamicParams.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/prefetch.md
01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
01-app/03-api-reference/04-functions/after.md
---
title: after
description: API Reference for the after function.
---
`after` allows you to schedule work to be executed after a response (or prerender) is finished. This is useful for tasks and other side effects that should not block the response, such as logging and analytics.
It can be used in [Server Components](/docs/app/getting-started/server-and-client-components) (including [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata)), [Server Functions](/docs/app/getting-started/mutating-data), [Route Handlers](/docs/app/api-reference/file-conventions/route), and [Proxy](/docs/app/api-reference/file-conventions/proxy).
The function accepts a callback that will be executed after the response (or prerender) is finished:
ˋˋˋtsx filename="app/layout.tsx" switcher
import { after } from 'next/server'
// Custom logging function
import { log } from '@/app/utils'
export default function Layout({ children }: { children: React.ReactNode }) {
  after(() => {
    // Execute after the layout is rendered and sent to the user
    log()
  })
  return <>{children}</>
}
ˋˋˋ
ˋˋˋjsx filename="app/layout.jsx" switcher
import { after } from 'next/server'
// Custom logging function
import { log } from '@/app/utils'
export default function Layout({ children }) {
  after(() => {
… (+32 líneas)
```

</details>

⏺ **Bash** — Read route segment config index for cacheComponents notes

```
cd <repos>/crm-agents/node_modules/next/dist/docs && grep -v "^$" 01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md | head -40
```

<details><summary>Resultado</summary>

```
---
title: Route Segment Config
description: Learn about how to configure options for Next.js route segments.
---
The Route Segment Config options allow you to configure the behavior of a [Page](/docs/app/api-reference/file-conventions/page), [Layout](/docs/app/api-reference/file-conventions/layout), or [Route Handler](/docs/app/api-reference/file-conventions/route) by directly exporting the following variables:
| Option                                                                                             | Type                                                              | Default                    |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| [`dynamicParams`](/docs/app/api-reference/file-conventions/route-segment-config/dynamicParams)     | `boolean`                                                         | `true`                     |
| [`runtime`](/docs/app/api-reference/file-conventions/route-segment-config/runtime)                 | `'nodejs' \| 'edge' (deprecated)`                                 | `'nodejs'`                 |
| [`preferredRegion`](/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion) | `'auto' \| 'global' \| 'home' \| string \| string[] (deprecated)` | `'auto'`                   |
| [`maxDuration`](/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)         | `number`                                                          | Set by deployment platform |
With [Cache Components](/docs/app/api-reference/config/next-config-js/cacheComponents) enabled, pages and layouts also support the following option:
| Option                                                                                       | Type                                                               | Default  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| [`ensureStatic`](/docs/app/api-reference/file-conventions/route-segment-config/ensureStatic) | `'auto'` \| `'shell'` \| `'prefetch'` \| `'navigation'` \| `false` | `'auto'` |
## Version History
| Version      |                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v16.0.0`    | `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` removed when [Cache Components](/docs/app/api-reference/config/next-config-js/cacheComponents) is enabled. See [Caching and Revalidating (Previous Model)](/docs/app/guides/caching-without-cache-components#route-segment-config). |
| `v16.0.0`    | `export const experimental_ppr = true` removed. A [codemod](/docs/app/guides/upgrading/codemods#remove-experimental_ppr-route-segment-config-from-app-router-pages-and-layouts) is available.                                                                                                  |
| `v15.0.0-RC` | `export const runtime = "experimental-edge"` deprecated. A [codemod](/docs/app/guides/upgrading/codemods#transform-app-router-route-segment-config-runtime-value-from-experimental-edge-to-edge) is available.                                                                                 |
```

</details>

⏺ `maxDuration` sirve. Escribo el esquema.

⏺ **Bash** — Add pipeline tables and generate migration

```
cd <repos>/crm-agents && cat >> src/server/db/schema.ts <<'EOF'

// --- H2 · Pipeline (D17). Tables relate by commit sha. ---

/** Every GitHub webhook delivery, append-only. Reprocessable while unprocessed or failed. */
export const githubEvents = pgTable(
  "github_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    deliveryId: text("delivery_id").notNull().unique(),
    event: text().notNull(),
    action: text(),
    payload: jsonb().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text(),
    attempts: integer().notNull().default(0),
  },
  (t) => [index("github_events_pending_idx").on(t.processedAt)],
);

/** One row per commit: its pull request and its Vercel preview. */
export const previews = pgTable(
  "previews",
  {
    sha: text().primaryKey(),
    prNumber: integer("pr_number"),
    prTitle: text("pr_title"),
    branch: text(),
    /** open | closed | merged */
    prState: text("pr_state"),
    prUpdatedAt: timestamp("pr_updated_at", { withTimezone: true }),
    previewUrl: text("preview_url"),
    /** GitHub deployment state: pending | in_progress | success | failure | error */
    deployState: text("deploy_state"),
    deployUpdatedAt: timestamp("deploy_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
… (+53 líneas)
```

<details><summary>Resultado</summary>

```
✓ Types generated successfully
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
test_reports 15 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0001_brief_living_lightning.sql 🚀
0000_init.sql
0001_brief_living_lightning.sql
meta
```

</details>

⏺ **Bash** — Rename migration and apply it to the panel database

```
mv drizzle/0001_brief_living_lightning.sql drizzle/0001_pipeline.sql && sed -i '' 's/0001_brief_living_lightning/0001_pipeline/' drizzle/meta/_journal.json && cat drizzle/0001_pipeline.sql | head -60 && pnpm db:migrate 2>&1 | tail -3
```

<details><summary>Resultado</summary>

```
CREATE TABLE "github_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"event" text NOT NULL,
	"action" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "github_events_delivery_id_unique" UNIQUE("delivery_id")
);
--> statement-breakpoint
CREATE TABLE "previews" (
	"sha" text PRIMARY KEY NOT NULL,
	"pr_number" integer,
	"pr_title" text,
	"branch" text,
	"pr_state" text,
	"pr_updated_at" timestamp with time zone,
	"preview_url" text,
	"deploy_state" text,
	"deploy_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"page" text NOT NULL,
	"width" integer NOT NULL,
	"pathname" text NOT NULL,
	"size" integer NOT NULL,
	CONSTRAINT "screenshots_uq" UNIQUE("report_id","page","width")
);
--> statement-breakpoint
CREATE TABLE "test_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"sha" text NOT NULL,
	"run_id" bigint NOT NULL,
… (+21 líneas)
```

</details>

⏺ **Bash** — Commit schema and migration

```
pnpm format:check 2>&1 | tail -1; git add -A && git commit -q -m "feat: add GitHub events and pipeline schema

github_events is append-only with a unique delivery_id. previews, test_reports
and screenshots relate by commit sha (D17). Adds fflate and @vercel/blob for
the artifact step.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
All matched files use Prettier code style!
77628d2 feat: add GitHub events and pipeline schema
```

</details>

⏺ Ahora la verificación de firma y la ruta del webhook, con inyección de dependencias para poder probarlas sin base de datos.

⏺ **Bash** — Add webhook signature verification with tests

```
rm src/server/github/README.md && cat > src/server/github/signature.ts <<'EOF'
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies GitHub's `X-Hub-Signature-256` header (`sha256=<hex>`) against the
 * raw request body, comparing in constant time.
 */
export function verifyGithubSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header?.startsWith("sha256=") || !secret) return false;
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

/** Builds the header value GitHub would send. Used by tests. */
export function signGithubPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}
EOF
cat > src/server/github/signature.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { signGithubPayload, verifyGithubSignature } from "./signature";

const SECRET = "webhook-secret";
const BODY = JSON.stringify({ zen: "Keep it logically awesome." });

describe("verifyGithubSignature", () => {
  it("accepts a valid signature", () => {
    expect(
      verifyGithubSignature(BODY, signGithubPayload(BODY, SECRET), SECRET),
    ).toBe(true);
  });

  it("matches GitHub's documented example", () => {
… (+31 líneas)
```

<details><summary>Resultado</summary>

```
Tests  22 passed (22)
$ eslint
✓ Types generated successfully
```

</details>

⏺ **Bash** — Commit signature verification

```
git add -A && git commit -q -m "feat: verify GitHub webhook signatures

HMAC-SHA256 of the raw body with GH_WEBHOOK_SECRET, compared in constant time.
Tested against GitHub's documented example.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
d03dced feat: verify GitHub webhook signatures
```

</details>

⏺ **Bash** — Add idempotent event store, webhook handler, route and tests

```
mkdir -p src/server/pipeline src/app/api/webhooks/github && cat > src/server/github/config.ts <<'EOF'
/** The only repository the panel listens to and reads from (D3). */
export const DEMO_REPO = "daboy-dev/crm-demo";

/** Workflow whose runs carry the e2e-results artifact (D15, D16). */
export const PREVIEW_WORKFLOW_PATH = ".github/workflows/preview-e2e.yml";

export const E2E_ARTIFACT_NAME = "e2e-results";
EOF
cat > src/server/github/events.ts <<'EOF'
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { githubEvents } from "@/server/db/schema";

export type IncomingEvent = {
  deliveryId: string;
  event: string;
  action: string | null;
  payload: unknown;
};

export type RecordedEvent = {
  id: number;
  /** false when GitHub redelivered an event we already had. */
  inserted: boolean;
  processed: boolean;
};

/** Builds the idempotent insert: a redelivery hits the unique delivery_id and does nothing. */
export function insertEventQuery(db: Db, event: IncomingEvent) {
  return db
    .insert(githubEvents)
    .values(event)
    .onConflictDoNothing({ target: githubEvents.deliveryId })
    .returning({ id: githubEvents.id });
}

export async function recordEvent(
  db: Db,
  event: IncomingEvent,
… (+206 líneas)
```

<details><summary>Resultado</summary>

```
Tests  27 passed (27)
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

</details>

⏺ **Bash** — Commit webhook route

```
pnpm format:check | tail -1 && git add -A && git commit -q -m "feat: store webhook deliveries idempotently

POST /api/webhooks/github verifies the signature, inserts the event keyed by
X-GitHub-Delivery with on conflict do nothing and answers 200 at once.
Processing runs in after(); a redelivery of a processed event is ignored (D17).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
$ prettier --check .
All matched files use Prettier code style!
74070e7 feat: store webhook deliveries idempotently
```

</details>

⏺ Ahora el procesamiento de `pull_request` y `deployment_status`, con el clasificador y el filtro de `workflow_run`.

⏺ **Bash** — Write event classifier with zod payload schemas

```
cat > src/server/pipeline/classify.ts <<'EOF'
import { z } from "zod";
import { DEMO_REPO, PREVIEW_WORKFLOW_PATH } from "@/server/github/config";

const repository = z.object({ full_name: z.string() });
const timestamp = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

const pullRequestEvent = z.object({
  action: z.string(),
  repository,
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    state: z.enum(["open", "closed"]),
    merged: z.boolean().nullish(),
    updated_at: timestamp,
    head: z.object({ ref: z.string(), sha: z.string() }),
  }),
});

const deploymentStatusEvent = z.object({
  repository,
  deployment: z.object({ sha: z.string(), environment: z.string() }),
  deployment_status: z.object({
    state: z.string(),
    target_url: z.string().nullish(),
    environment_url: z.string().nullish(),
    updated_at: timestamp,
  }),
});

const workflowRunEvent = z.object({
  action: z.string(),
  repository,
  workflow_run: z.object({
    id: z.number().int(),
    run_attempt: z.number().int(),
    path: z.string(),
    head_sha: z.string(),
    head_branch: z.string().nullish(),
… (+136 líneas)
```

<details><summary>Resultado</summary>

```
(Bash completed with no output)
```

</details>

⏺ **Bash** — Add preview upserts and event processor

```
python3 - <<'EOF'
p='src/server/pipeline/classify.ts';s=open(p).read()
s=s.replace('''      if (run.path !== PREVIEW_WORKFLOW_PATH) {''','''      // GitHub may append "@<ref>" to the path.
      if (run.path.split("@")[0] !== PREVIEW_WORKFLOW_PATH) {''')
s=s.replace('previewUrl: status.environment_url || status.target_url || null,','previewUrl: status.target_url || status.environment_url || null,')
open(p,'w').write(s)
EOF
cat > src/server/pipeline/previews.ts <<'EOF'
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { previews } from "@/server/db/schema";
import type { DeploymentUpdate, PullRequestUpdate } from "./classify";

/**
 * Applies a pull_request event. Idempotent and order-safe: a field group only
 * changes when the event is at least as recent as what is stored.
 */
export async function applyPullRequest(db: Db, u: PullRequestUpdate) {
  const pr = {
    prNumber: u.prNumber,
    prTitle: u.prTitle,
    branch: u.branch,
    prState: u.prState,
    prUpdatedAt: u.updatedAt,
  };
  await db
    .insert(previews)
    .values({ sha: u.sha, ...pr })
    .onConflictDoUpdate({
      target: previews.sha,
      set: pr,
      setWhere: or(
        isNull(previews.prUpdatedAt),
        lte(previews.prUpdatedAt, u.updatedAt),
      ),
    });

  // Title and state belong to the PR, so older commits of it follow too.
  await db
    .update(previews)
… (+124 líneas)
```

<details><summary>Resultado</summary>

```
(Bash completed with no output)
```

</details>

⏺ Los tests del clasificador y del filtro de `workflow_run`:

⏺ **Bash** — Add classifier and workflow_run filter tests, run checks

```
cat > src/server/pipeline/classify.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { classifyEvent } from "./classify";

const repository = { full_name: "daboy-dev/crm-demo" };
const SHA = "6c2bb79bba387eb6724303d924bcc8d4f867607c";

function pullRequest(overrides: Record<string, unknown> = {}, action = "opened") {
  return {
    action,
    repository,
    pull_request: {
      number: 3,
      title: "ci: run Playwright against Vercel previews",
      state: "open",
      merged: false,
      updated_at: "2026-11-24T13:20:00Z",
      head: { ref: "ci/preview-e2e", sha: SHA },
      ...overrides,
    },
  };
}

function deploymentStatus(state = "success", environment = "Preview") {
  return {
    repository,
    deployment: { sha: SHA, environment },
    deployment_status: {
      state,
      target_url: "https://crm-demo-<deployment>-daboy-dev.vercel.app",
      environment_url: "https://crm-demo-<deployment>-daboy-dev.vercel.app",
      updated_at: "2026-11-24T13:22:00Z",
    },
  };
}

function workflowRun(
  path = ".github/workflows/preview-e2e.yml",
  action = "completed",
) {
… (+147 líneas)
```

<details><summary>Resultado</summary>

```
Tests  44 passed (44)
$ eslint
✓ Types generated successfully
```

</details>

⏺ **Bash** — Commit event processing

```
pnpm format:check | tail -1 && git add -A && git commit -q -m "feat: process pull_request and deployment_status events

classifyEvent keeps only crm-demo events: PR, branch, sha and state; preview
URL and state; and completed runs of preview-e2e.yml (CI and neon-cleanup are
ignored). Upserts are order-safe and idempotent. Failed events keep their error
and stay pending for reprocessing.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
$ prettier --check .
All matched files use Prettier code style!
6277f4b feat: process pull_request and deployment_status events
```

</details>

⏺ **Bash** — Check new run and results.json shape for parser

```
cd <repos> && gh run list -R daboy-dev/crm-demo -w preview-e2e.yml -L 3 --json databaseId,headSha,conclusion,status --jq '.[]|[.databaseId,.headSha[0:7],.status,.conclusion]|@tsv'; SP=<scratchpad>; python3 -I -c "
import json,sys;r=json.load(open(sys.argv[1]))
s=r['suites'][0]; print(s.keys()); sp=(s.get('specs') or s['suites'][0]['specs'])[0]; print(sp.keys()); t=sp['tests'][0]; print(t.keys()); print(t['results'][0].keys()); print(r['errors'])" $SP/art/results.json
```

<details><summary>Resultado</summary>

```
45430410262	b9a60a2	completed	success
45403048280	6c2bb79	completed	success
dict_keys(['title', 'file', 'column', 'line', 'specs', 'suites'])
dict_keys(['title', 'ok', 'tags', 'tests', 'id', 'file', 'line', 'column'])
dict_keys(['timeout', 'annotations', 'expectedStatus', 'projectId', 'projectName', 'results', 'status'])
dict_keys(['workerIndex', 'parallelIndex', 'status', 'duration', 'errors', 'stdout', 'stderr', 'retry', 'startTime', 'annotations', 'attachments'])
[]
```

</details>

⏺ La segunda ejecución, ya con el job `resolve`, también salió en verde. Ahora el parseo del artifact (`results.json` y `meta.json`) y la descarga.

⏺ **Bash** — Write artifact zip reader and results parser

```
cd <repos>/crm-agents && cat > src/server/pipeline/artifact.ts <<'EOF'
import { unzipSync } from "fflate";
import { z } from "zod";
import type { TestFailure } from "@/server/db/schema";

/** meta.json written by preview-e2e.yml. */
const metaSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  ref: z.string(),
  target_url: z.string(),
  run_id: z.number().int(),
  run_attempt: z.number().int(),
});
export type E2eMeta = z.infer<typeof metaSchema>;

export function parseMeta(json: unknown): E2eMeta {
  return metaSchema.parse(json);
}

// Subset of Playwright's JSON reporter output that the panel reads.
const resultSchema = z.object({
  status: z.string(),
  errors: z.array(z.object({ message: z.string().optional() })).default([]),
});
const testSchema = z.object({
  projectName: z.string(),
  status: z.enum(["expected", "unexpected", "flaky", "skipped"]),
  results: z.array(resultSchema).default([]),
});
const specSchema = z.object({
  title: z.string(),
  tests: z.array(testSchema),
});
type Suite = {
  title: string;
  specs?: z.infer<typeof specSchema>[];
  suites?: Suite[];
};
const suiteSchema: z.ZodType<Suite> = z.lazy(() =>
  z.object({
… (+131 líneas)
```

<details><summary>Resultado</summary>

```
(Bash completed with no output)
```

</details>

⏺ **Bash** — Add artifact parser tests with synthetic fixture

```
mkdir -p src/server/pipeline/fixtures && cat > src/server/pipeline/fixtures/results.json <<'EOF'
{
  "config": { "metadata": {} },
  "suites": [
    {
      "title": "screenshots.spec.ts",
      "file": "screenshots.spec.ts",
      "specs": [],
      "suites": [
        {
          "title": "screenshots",
          "specs": [
            {
              "title": "captures clientes",
              "ok": true,
              "tests": [
                {
                  "projectName": "desktop",
                  "status": "expected",
                  "results": [{ "status": "passed", "errors": [] }]
                },
                {
                  "projectName": "mobile-390",
                  "status": "flaky",
                  "results": [
                    { "status": "failed", "errors": [{ "message": "timeout" }] },
                    { "status": "passed", "errors": [] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "title": "smoke.spec.ts",
      "file": "smoke.spec.ts",
      "specs": [
        {
… (+202 líneas)
```

<details><summary>Resultado</summary>

```
Tests  55 passed (55)
✖ 1 problem (0 errors, 1 warning)
  0 errors and 1 warning potentially fixable with the `--fix` option.

✓ Types generated successfully
```

</details>

⏺ **Bash** — Show the lint warning

```
pnpm lint 2>&1 | grep -B2 warning | head
```

<details><summary>Resultado</summary>

```
<repos>/crm-agents/src/server/pipeline/artifact.ts
  66:7  warning  Unused eslint-disable directive (no problems were reported from 'no-control-regex')

✖ 1 problem (0 errors, 1 warning)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```

</details>

⏺ **Bash** — Fix lint warning and commit parser

```
sed -i '' '/eslint-disable-next-line no-control-regex/d' src/server/pipeline/artifact.ts && pnpm lint 2>&1 | tail -1 && pnpm format:check | tail -1 && git add -A && git commit -q -m "feat: parse e2e-results artifact

Reads the zip in memory with fflate and keeps only meta.json, results.json and
screenshots named <page>-<1280|390>.jpg. Counts passed, failed, flaky and
skipped tests and lists the failing ones with a cleaned error message.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
$ eslint
$ prettier --check .
[warn] src/server/pipeline/artifact.ts
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
[ELIFECYCLE] Command failed with exit code 1.
Checking formatting...
f9934dc feat: parse e2e-results artifact
```

</details>

⏺ El commit se hizo aunque fallaba el formato, porque el `| tail` se comía el código de salida. Lo corrijo con un amend.

⏺ **Bash** — Format and amend parser commit

```
pnpm exec prettier --write src/server/pipeline/artifact.ts >/dev/null && pnpm format:check >/dev/null && pnpm lint >/dev/null && git commit -q -a --amend --no-edit && git status -s && git log --oneline -1
```

<details><summary>Resultado</summary>

```
$ prettier --check .
$ eslint
c998dd1 feat: parse e2e-results artifact
```

</details>

⏺ Ahora la descarga del artifact con el PAT y la subida de las capturas al Blob.

⏺ **Bash** — Add GitHub artifact client and workflow_run handler

```
cat > src/server/github/client.ts <<'EOF'
import { z } from "zod";
import { DEMO_REPO } from "./config";

const API = "https://api.github.com";
const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;

function token(): string {
  const value = process.env.GH_TOKEN;
  if (!value) throw new Error("GH_TOKEN is not set");
  return value;
}

function headers(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token()}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "crm-agents",
  };
}

const artifactsSchema = z.object({
  artifacts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      size_in_bytes: z.number(),
      expired: z.boolean(),
      archive_download_url: z.string(),
    }),
  ),
});
export type RunArtifact = z.infer<typeof artifactsSchema>["artifacts"][number];

/** Finds a named artifact of a crm-demo workflow run (PAT with Actions: read, D16). */
export async function findRunArtifact(
  runId: number,
  name: string,
): Promise<RunArtifact | null> {
… (+170 líneas)
```

<details><summary>Resultado</summary>

```
(Bash completed with no output)
```

</details>

⏺ **Bash** — Add artifact download tests and run checks

```
python3 - <<'EOF'
p='src/server/pipeline/reports.ts';s=open(p).read()
s=s[:s.index('/** Used by tests and the UI')].rstrip()+'\n'
s=s.replace('import { and, eq } from "drizzle-orm";','import { eq } from "drizzle-orm";')
open(p,'w').write(s)
EOF
cat > src/server/github/client.test.ts <<'EOF'
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadArtifact, findRunArtifact } from "./client";

const artifact = {
  id: 1,
  name: "e2e-results",
  size_in_bytes: 1000,
  expired: false,
  archive_download_url:
    "https://api.github.com/repos/daboy-dev/crm-demo/actions/artifacts/1/zip",
};

describe("GitHub artifacts", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("GH_TOKEN", "test-token");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("finds the named, unexpired artifact of a run", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        artifacts: [{ ...artifact, id: 0, expired: true }, artifact],
      }),
    );
    expect(await findRunArtifact(42, "e2e-results")).toEqual(artifact);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
… (+34 líneas)
```

<details><summary>Resultado</summary>

```
Tests  58 passed (58)
$ eslint
✓ Types generated successfully
$ prettier --check .
fmt-ok
```

</details>

⏺ **Bash** — Commit artifact processing

```
git add -A && git commit -q -m "feat: fetch artifacts and store screenshots in Blob

On a completed preview-e2e.yml run, list the run's artifacts with GH_TOKEN,
follow the redirect to the signed zip URL without the token, check meta.json
against the run, upsert the report and upload screenshots to the private Blob
store via OIDC under a fixed path per run attempt (D16, D18).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

<details><summary>Resultado</summary>

```
76685e6 feat: fetch artifacts and store screenshots in Blob
```

</details>

⏺ Ahora la ruta de capturas protegida y `/pipeline`.

⏺ **Bash** — Check health route pattern and guides list

```
cat src/app/api/health/route.ts; ls node_modules/next/dist/docs/01-app/02-guides | head -50 | tr '\n' ' '
```

<details><summary>Resultado</summary>

```
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { appVersion, checkHealth, createDbPing } from "@/server/health";

export async function GET() {
  // Always evaluate at request time: the point is to hit the database now.
  await connection();
  const report = await checkHealth({
    pingDb: createDbPing(getDb),
    version: appVersion(),
  });
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
adopting-partial-prefetching.md ai-agents.md analytics.md authentication-with-cache-components.md authentication.md backend-for-frontend.md building.md caching-without-cache-components.md cdn-caching.md ci-build-caching.md client-side-data-fetching content-security-policy.md css-in-js.md custom-server.md data-security.md debugging.md deploying-to-platforms.md draft-mode.md environment-variables.md forms.md how-revalidation-works.md incremental-static-regeneration-cache-components.md incremental-static-regeneration.md index.md instant-navigation.md instrumentation.md interactive-apps.md internationalization.md json-ld.md keeping-pages-static.md lazy-loading.md local-development.md mcp.md mdx.md memory-usage.md migrating migrating-to-cache-components.md multi-tenant.md multi-zones.md offline-support.md open-telemetry.md optimizing-prefetching.md optimizing-the-static-shell.md package-bundling.md ppr-platform-guide.md prefetching.md preserving-ui-state.md preventing-flash-before-hydration.md production-checklist.md progressive-web-apps.md
```

</details>

⏺ **Bash** — Read auth with cache components guide

```
cd <repos>/crm-agents/node_modules/next/dist/docs/01-app/02-guides && grep -v "^$" authentication-with-cache-components.md | sed -n 1,80p
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
ˋˋˋts filename="next.config.ts"
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  cacheComponents: true,
}
export default nextConfig
ˋˋˋ
This guide covers code patterns for authentication with Cache Components: reading the session at request time, streaming authenticated UI, and caching session-derived data. It assumes you're comfortable with Cache Components (if not, read [Caching](/docs/app/getting-started/caching) first) and that you already have a session set on login.
For the fundamentals this builds on, we recommend two guides:
- [Authentication](/docs/app/guides/authentication) covers sign-up, login, session management, authorization, and the Data Access Layer.
- [Data Security](/docs/app/guides/data-security) covers keeping data access on the server and sensitive data off the client.
## Migrating an existing app
With Cache Components enabled, instant navigation validation flags every route that reads the session, because a request read can't be prerendered into the static shell. You don't have to resolve them all before shipping. Set [`export const instant = false`](/docs/app/guides/instant-navigation#opting-out) on the page or layout to let it keep blocking on the server, then adopt the patterns below one route at a time. For the full migration workflow, see [Migrating to Cache Components](/docs/app/guides/migrating-to-cache-components#following-validation).
## Step 1: Read the current user
Reading the current user reads the session cookie, then looks the user up. A request read can't be part of the static shell, so it always sits behind a [`<Suspense>`](/docs/app/api-reference/file-conventions/loading) boundary and streams in on every navigation.
Because a user session is valid for a period of time, adding a cache lifetime lets the framework prefetch that content ahead of time.
The server-side directives can't give it that lifetime, though: neither a plain [`use cache`](/docs/app/api-reference/directives/use-cache) nor [`use cache: remote`](/docs/app/api-reference/directives/use-cache-remote) can call `cookies()`, and you can't [extract the value and pass it in](/docs/app/getting-started/caching#passing-runtime-values-to-cached-functions) either, because:
- A session helper reads the cookie deep inside its own code, so there's nothing to lift out.
- Validating it compares a token's expiry against the current time (iron-session's `unsealData` rejects an expired seal), so the read is request- and time-dependent.
That's what [`use cache: private`](/docs/app/api-reference/directives/use-cache-private) is for: it reads `cookies()` and `headers()` directly, keeping the result in the browser only, never on the server.
… (+40 líneas)
```

</details>

⏺ **Bash** — Add session helper, screenshot route and pipeline queries

```
cd <repos>/crm-agents && mkdir -p "src/app/api/screenshots/[id]" src/app/pipeline && cat > src/server/session.ts <<'EOF'
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/**
 * The logged-in user, or null. The proxy already guards every private route;
 * route handlers and server actions check again as defence in depth.
 */
export async function currentUser(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value,
    secret,
  );
}
EOF
cat > "src/app/api/screenshots/[id]/route.ts" <<'EOF'
import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { screenshots } from "@/server/db/schema";
import { currentUser } from "@/server/session";

/**
 * Serves a screenshot from the private Blob store behind the login (D18).
 * The blob URL never reaches the browser.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/screenshots/[id]">,
) {
  await connection();
  if (!(await currentUser())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
… (+135 líneas)
```

<details><summary>Resultado</summary>

```
src/app/api/screenshots/[id]/route.ts(14,28): error TS2344: Type '"/api/screenshots/[id]"' does not satisfy the constraint 'AppRouteHandlerRoutes'.
src/app/api/screenshots/[id]/route.ts(21,21): error TS2571: Object is of type 'unknown'.
```

</details>

⏺ Ese error de tipos desaparece con `next typegen`. Sigo con la página.

⏺ **Bash** — Add reprocess server action and check refresh API

```
python3 - <<'EOF'
p='src/server/pipeline/queries.ts';s=open(p).read()
s=s.replace('import { desc, inArray, isNotNull, isNull, count, max } from "drizzle-orm";','import { count, desc, inArray, isNotNull, isNull } from "drizzle-orm";')
s=s.replace('.select({ pending: count(), lastReceived: max(githubEvents.receivedAt) })','.select({ pending: count() })')
open(p,'w').write(s)
EOF
cat > src/app/pipeline/actions.ts <<'EOF'
"use server";

import { refresh } from "next/cache";
import { reprocessPending } from "@/server/pipeline/process";
import { currentUser } from "@/server/session";

/** Reprocesses GitHub events that are unprocessed or failed. */
export async function reprocessEvents(): Promise<void> {
  if (!(await currentUser())) throw new Error("unauthorized");
  await reprocessPending();
  refresh();
}
EOF
grep -n "export.*refresh\b\|export { .*refresh" node_modules/next/cache.d.ts node_modules/next/dist/server/web/exports/*.d.ts 2>/dev/null | head -3; grep -rn "^title: refresh" node_modules/next/dist/docs | head -2
```

<details><summary>Resultado</summary>

```
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md:2:title: refresh
```

</details>

⏺ **Bash** — Read refresh() docs

```
grep -v "^$" node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md | sed -n 1,25p
```

<details><summary>Resultado</summary>

```
---
title: refresh
description: API Reference for the refresh function.
related:
  links:
    - app/guides/server-actions
---
`refresh` allows you to refresh the client router from within a [Server Action](/docs/app/guides/server-actions).
## Usage
`refresh` can **only** be called from within Server Actions. It cannot be used in Route Handlers, Client Components, or any other context.
## Parameters
ˋˋˋtsx
refresh(): void;
ˋˋˋ
## Returns
`refresh` does not return a value.
## Examples
ˋˋˋts filename="app/actions.ts" switcher
'use server'
import { refresh } from 'next/cache'
export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')
  // Create the post in your database
  const post = await db.post.create({
```

</details>

⏺ **Bash** — Add pipeline page, PR card, polling and styles; run checks

```
cat > src/app/pipeline/auto-refresh.tsx <<'EOF'
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server components every few seconds while the tab is visible (D4). */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
EOF
cat > src/app/pipeline/pr-card.tsx <<'EOF'
import { DEMO_REPO } from "@/server/github/config";
import type {
  PipelineCommit,
  PipelinePr,
  PipelineReport,
} from "@/server/pipeline/queries";

const PR_STATE: Record<string, string> = {
  open: "Abierto",
  closed: "Cerrado",
  merged: "Fusionado",
};

const DEPLOY_STATE: Record<string, string> = {
  pending: "Desplegando",
  queued: "En cola",
  in_progress: "Desplegando",
  success: "Lista",
  failure: "Fallo",
  error: "Error",
};
… (+420 líneas)
```

<details><summary>Resultado</summary>

```
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
      Tests  58 passed (58)
```

</details>

⏺ Compruebo que compila en producción.

⏺ **Bash** — Run production build of the panel

```
pnpm build 2>&1 | tail -25
```

<details><summary>Resultado</summary>

```
Finished TypeScript in 1493ms ...
  Collecting page data using 10 workers ...
  Generating static pages using 10 workers (0/8) ...
  Generating static pages using 10 workers (2/8) 
  Generating static pages using 10 workers (4/8) 
  Generating static pages using 10 workers (6/8) 
✓ Generating static pages using 10 workers (8/8) in 387ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/health
├ ƒ /api/screenshots/[id]
├ ƒ /api/webhooks/github
├ ○ /login
└ ◐ /pipeline


ƒ Proxy (Middleware)

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

</details>

⏺ Compila bien: `/pipeline` sale como prerender parcial y las rutas de API son dinámicas. Lo dejo en dos commits.

⏺ **Bash** — Commit screenshot route and pipeline page

```
pnpm format:check >/dev/null && git add src/server/session.ts "src/app/api/screenshots" && git commit -q -m "feat: serve screenshots behind login

GET /api/screenshots/[id] checks the session, reads the blob from the private
store on the server and returns it with Cache-Control: private, so Blob URLs
never reach the browser (D18).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git add -A && git commit -q -m "feat: add pipeline page with polling and reprocess action

/pipeline lists crm-demo PRs with their preview link and state, the test
report (passed and failed counts, failing test names) and the screenshots
grouped by width. It refreshes every 5 s while visible (D4). A button
reprocesses pending or failed events.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -3 && grep -c "^AUTH_SECRET=\|^DEMO_USER=\|^DEMO_PASSWORD=" .env.local
```

<details><summary>Resultado</summary>

```
$ prettier --check .
f58c3ca feat: add pipeline page with polling and reprocess action
96f9c37 feat: serve screenshots behind login
76685e6 feat: fetch artifacts and store screenshots in Blob
0
```

</details>

⏺ Subo `crm-agents` a `master`, que despliega producción, como acordamos en el plan.

⏺ **Bash** — Push panel to master and find CI run

```
git push -q origin master 2>&1 | grep -v "^remote:"; sleep 5; gh run list -R daboy-dev/crm-agents -L 1 --json databaseId,status,headSha --jq '.[]|[.databaseId,.status,.headSha[0:7]]|@tsv'
```

<details><summary>Resultado</summary>

```
45431681226	queued	f58c3ca
```

</details>

⏺ **Bash** — Wait for CI and deploy, then probe production routes

```
gh run watch 45431681226 -R daboy-dev/crm-agents --exit-status --interval 10 >/dev/null 2>&1; echo ci=$?; for i in $(seq 1 30); do s=$(gh api repos/daboy-dev/crm-agents/commits/f58c3ca/statuses --jq '[.[]|select(.context=="Vercel")][0].state'); [ "$s" = success -o "$s" = failure -o "$s" = error ] && break; sleep 10; done; echo vercel=$s; curl -s https://crm-agents.vercel.app/api/health; echo; curl -s -o /dev/null -w "pipeline %{http_code} -> %{redirect_url}\n" https://crm-agents.vercel.app/pipeline; curl -s -o /dev/null -w "shot %{http_code}\n" https://crm-agents.vercel.app/api/screenshots/1; curl -s -X POST -w " webhook %{http_code}\n" https://crm-agents.vercel.app/api/webhooks/github -d '{}'
```

<details><summary>Resultado</summary>

```
ci=0
vercel=success
{"ok":true,"db":true,"version":"0.1.0+f58c3ca"}
pipeline 307 -> https://crm-agents.vercel.app/login
shot 401
{"error":"invalid signature"} webhook 401
```

</details>

⏺ **Bash** — List recent webhook deliveries

```
hook=$(gh api repos/daboy-dev/crm-demo/hooks --jq '.[0].id'); echo hook=$hook; gh api "repos/daboy-dev/crm-demo/hooks/$hook/deliveries?per_page=100" --jq '.[] | [.id, .guid[0:8], .event, (.action//"-"), .status_code, .delivered_at, .redelivery] | @tsv' | head -40
```

<details><summary>Resultado</summary>

```
hook=716206499
3855883347364438000	2bd9a5f0	workflow_run	completed	404	2026-11-24T15:53:23.258Z	false
3855883201912250400	0295be18	workflow_run	completed	404	2026-11-24T15:52:15.546Z	false
3855883191172735000	fe2fd2aa	workflow_run	completed	404	2026-11-24T15:52:10.545Z	false
3855883175330873300	fbf13754	workflow_run	in_progress	404	2026-11-24T15:52:03.104Z	false
3855883165572800500	f85ce43a	workflow_run	in_progress	404	2026-11-24T15:51:58.63Z	false
3855883154447417300	f6ae9372	workflow_run	requested	404	2026-11-24T15:51:53.436Z	false
3855883146270638000	f3ea9d34	deployment_status	created	404	2026-11-24T15:51:49.643Z	false
3855883129556336600	ec2aee8c	workflow_run	in_progress	404	2026-11-24T15:51:41.875Z	false
3855883116897894400	ea796ec4	workflow_run	in_progress	404	2026-11-24T15:51:35.989Z	false
3855883112258994000	e9e90e4c	workflow_run	requested	404	2026-11-24T15:51:33.817Z	false
3855883104757522400	e8956a9a	workflow_run	requested	404	2026-11-24T15:51:30.287Z	false
3855883100573671400	e765976c	pull_request	synchronize	404	2026-11-24T15:51:28.342Z	false
3855883094710026000	e7067926	push	-	404	2026-11-24T15:51:25.603Z	false
3855864337751089000	8f33df54	workflow_run	completed	404	2026-11-24T13:25:51.208Z	false
3855864145180107000	58682462	workflow_run	completed	404	2026-11-24T13:24:21.567Z	false
3855864133012422700	54f3cf7a	workflow_run	in_progress	404	2026-11-24T13:24:15.927Z	false
3855864130032500700	5674af90	workflow_run	completed	404	2026-11-24T13:24:14.499Z	false
3855864124015640600	52fc5778	workflow_run	requested	404	2026-11-24T13:24:11.722Z	false
3855864110768029700	517a0896	deployment_status	created	404	2026-11-24T13:24:05.492Z	false
3855864077152837600	47ae9f02	workflow_run	in_progress	404	2026-11-24T13:23:49.901Z	false
3855864074801783000	45a462f0	workflow_run	requested	404	2026-11-24T13:23:48.811Z	false
3855864071523934000	45005994	workflow_run	in_progress	404	2026-11-24T13:23:47.246Z	false
3855864061503807500	43d4d4b4	pull_request	opened	404	2026-11-24T13:23:42.578Z	false
3855864057867288600	4335f736	workflow_run	requested	404	2026-11-24T13:23:40.935Z	false
3855864054398583000	42453b48	push	-	404	2026-11-24T13:23:39.237Z	false
3855858543154430000	4898a4cc	ping	-	404	2026-11-24T12:40:52.876Z	false
```

</details>

⏺ Ojo: los ids de las entregas pierden precisión en `jq` (acaban en ceros). Los saco en crudo con Python y reenvío en orden cronológico.

⏺ **Bash** — Redeliver failed PR/deploy/workflow deliveries oldest first

```
gh api "repos/daboy-dev/crm-demo/hooks/716206499/deliveries?per_page=100" > <scratchpad>/deliveries.json && python3 -I - <scratchpad>/deliveries.json <<'EOF' > <scratchpad>/ids.txt
import json,sys
d=json.load(open(sys.argv[1]))
for x in sorted(d,key=lambda x:x['delivered_at']):
    if x['status_code']==404 and x['event'] in ('pull_request','deployment_status','workflow_run'):
        print(x['id'])
EOF
wc -l < <scratchpad>/ids.txt; for id in $(cat <scratchpad>/ids.txt); do gh api -X POST repos/daboy-dev/crm-demo/hooks/716206499/deliveries/$id/attempts --silent && printf . ; sleep 1; done; echo
```

<details><summary>Resultado</summary>

```
23
.......................
```

</details>

⏺ **Bash** — Query panel DB for processed events and reports

```
sleep 20; cd <repos>/crm-agents && cat > <scratchpad>/q.mjs <<'EOF'
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
console.log(await sql`select event, action, count(*)::int n, count(processed_at)::int done, max(error) err from github_events group by 1,2 order by 1,2`);
console.log(await sql`select left(sha,7) sha, pr_number, branch, pr_state, deploy_state, preview_url is not null has_url from previews`);
console.log(await sql`select id, left(sha,7) sha, run_id, run_attempt, status, conclusion, passed, failed, skipped, error from test_reports`);
console.log(await sql`select report_id, count(*)::int from screenshots group by 1`);
EOF
cp <scratchpad>/q.mjs ./q.tmp.mjs && node --env-file=.env.local q.tmp.mjs; rm q.tmp.mjs
```

<details><summary>Resultado</summary>

```
[
  {
    event: 'deployment_status',
    action: 'created',
    n: 2,
    done: 2,
    err: null
  },
  { event: 'pull_request', action: 'opened', n: 1, done: 1, err: null },
  {
    event: 'pull_request',
    action: 'synchronize',
    n: 1,
    done: 1,
    err: null
  },
  {
    event: 'workflow_run',
    action: 'completed',
    n: 6,
    done: 6,
    err: null
  },
  {
    event: 'workflow_run',
    action: 'in_progress',
    n: 7,
    done: 7,
    err: null
  },
  {
    event: 'workflow_run',
    action: 'requested',
    n: 6,
    done: 6,
    err: null
  }
]
[
  {
… (+43 líneas)
```

</details>

⏺ **Bash** — Redeliver processed events and verify no duplicates

```
SP=<scratchpad>; gh api "repos/daboy-dev/crm-demo/hooks/716206499/deliveries?per_page=100" > $SP/deliveries2.json && python3 -I - $SP/deliveries2.json <<'EOF' > $SP/ids2.txt
import json,sys
d=json.load(open(sys.argv[1]))
ok=[x for x in d if x['status_code']==200]
print(len(ok), "x200", file=sys.stderr)
for x in ok:
    if x['event']=='workflow_run' and x['action']=='completed': print(x['id'])
EOF
for id in $(cat $SP/ids2.txt); do gh api -X POST repos/daboy-dev/crm-demo/hooks/716206499/deliveries/$id/attempts --silent && printf .; done; echo; sleep 15
gh api "repos/daboy-dev/crm-demo/hooks/716206499/deliveries?per_page=10" > $SP/d3.json; python3 -I -c "
import json,sys
for x in json.load(open(sys.argv[1]))[:6]: print(x['event'],x['action'],x['status_code'],x['redelivery'])" $SP/d3.json
cd <repos>/crm-agents && cat > q.tmp.mjs <<'EOF'
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
console.log(await sql`select (select count(*) from github_events)::int events, (select max(attempts) from github_events)::int max_attempts, (select count(*) from test_reports)::int reports, (select count(*) from screenshots)::int shots, (select count(*) from previews)::int previews`);
EOF
node --env-file=.env.local q.tmp.mjs; rm q.tmp.mjs
```

<details><summary>Resultado</summary>

```
23 x200
......
workflow_run completed 200 True
workflow_run completed 200 True
workflow_run completed 200 True
workflow_run completed 200 True
workflow_run completed 200 True
workflow_run completed 200 True
[ { events: 23, max_attempts: 1, reports: 2, shots: 20, previews: 2 } ]
```

</details>

⏺ **Bash** — Open stacked PR with a test broken on purpose

```
cd <repos>/crm-demo && git switch -q -c test/broken-e2e ci/preview-e2e && python3 - <<'EOF'
p='e2e/smoke.spec.ts';s=open(p).read()
old='''test("has no horizontal page scroll"'''
new='''// H2 check: this test fails on purpose so the panel shows a failed run.
test("shows a page that does not exist (broken on purpose)", async ({
  page,
}) => {
  await login(page);
  await expect(byTestId(page, "page-title")).toHaveText("Página inexistente", {
    timeout: 3000,
  });
});

test("has no horizontal page scroll"'''
assert old in s; s=s.replace(old,new,1); open(p,'w').write(s)
EOF
pnpm exec prettier --write e2e/smoke.spec.ts >/dev/null && pnpm lint >/dev/null && git commit -qam "test: break an E2E test on purpose (H2 check, do not merge)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push -q -u origin test/broken-e2e 2>&1 | grep -v "^remote:"; gh pr create -R daboy-dev/crm-demo --base ci/preview-e2e --head test/broken-e2e --title "test: broken E2E on purpose (H2 check, do not merge)" --body "Checks that a failing Playwright run shows up as a failure in the crm-agents pipeline. Will be closed without merging.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

<details><summary>Resultado</summary>

```
$ eslint
https://github.com/daboy-dev/crm-demo/pull/4
```

</details>

⏺ Mientras se ejecuta el PR roto, necesito que hagas algo en Vercel.

⏺ **Pregunta al humano:** Para entrar en https://crm-agents.vercel.app/pipeline faltan las variables del login en el proyecto de Vercel crm-agents (Production, Preview y Development): AUTH_SECRET (p. ej. `openssl rand -base64 32`, distinto del de crm-demo), DEMO_USER y DEMO_PASSWORD. Después hay que redesplegar producción (Deployments → último → Redeploy) y, si quieres que lo pruebe yo en local, hacer `vercel env pull .env.local` en crm-agents. No me pases los valores por el chat. ¿Me avisas cuando esté?

- **Hecho: creadas, redesplegado y pull**: Puedo verificar /pipeline en producción con Playwright usando las credenciales de .env.local, sin verlas.
- **Hecho, pero sin pull local**: Verifico solo lo que no necesita credenciales; tú haces login y miras /pipeline.

**Respuesta del humano:** Hecho: creadas, redesplegado y pull

⏺ **Bash** — Confirm login vars pulled and broken PR run status

```
cd <repos>/crm-agents && grep -c "^AUTH_SECRET=.\|^DEMO_USER=.\|^DEMO_PASSWORD=." .env.local; curl -s https://crm-agents.vercel.app/api/health; echo; gh run list -R daboy-dev/crm-demo -w preview-e2e.yml -L 2 --json databaseId,headSha,status,conclusion --jq '.[]|[.databaseId,.headSha[0:7],.status,.conclusion]|@tsv'
```

<details><summary>Resultado</summary>

```
0
{"ok":true,"db":true,"version":"0.1.0+f58c3ca"}
45432371063	ab0bf57	completed	failure
45430410262	b9a60a2	completed	success
```

</details>

⏺ La ejecución rota terminó en `failure`, como tocaba. Pero en `.env.local` no veo las variables del login con valor. Miro solo los nombres:

⏺ **Bash** — Check login var names and lengths without values

```
ls -la .env.local; grep -o '^[A-Z_]*=' .env.local | tr '\n' ' '; echo; for v in AUTH_SECRET DEMO_USER DEMO_PASSWORD; do grep -q "^$v=" .env.local && echo "$v present, length $(grep "^$v=" .env.local | cut -d= -f2- | tr -d '"' | wc -c)" || echo "$v missing"; done
```

<details><summary>Resultado</summary>

```
-rw-r--r--@ 1 <user>  staff  2300 Nov 24 17:05 .env.local
BLOB_STORE_ID= BLOB_WEBHOOK_PUBLIC_KEY= DATABASE_URL= GH_TOKEN= GH_WEBHOOK_SECRET= NX_DAEMON= TURBO_CACHE= TURBO_DOWNLOAD_LOCAL_ENABLED= TURBO_REMOTE_ONLY= TURBO_RUN_SUMMARY= VERCEL= VERCEL_ENV= VERCEL_GIT_COMMIT_AUTHOR_LOGIN= VERCEL_GIT_COMMIT_AUTHOR_NAME= VERCEL_GIT_COMMIT_MESSAGE= VERCEL_GIT_COMMIT_REF= VERCEL_GIT_COMMIT_SHA= VERCEL_GIT_PREVIOUS_SHA= VERCEL_GIT_PROVIDER= VERCEL_GIT_PULL_REQUEST_ID= VERCEL_GIT_REPO_ID= VERCEL_GIT_REPO_OWNER= VERCEL_GIT_REPO_SLUG= VERCEL_OIDC_TOKEN= VERCEL_TARGET_ENV= VERCEL_URL= 
AUTH_SECRET missing
DEMO_USER missing
DEMO_PASSWORD missing
```

</details>

⏺ **Bash** — Probe production login with wrong credentials

```
cd <repos>/crm-demo && cat > probe.tmp.mjs <<'EOF'
import { chromium } from "@playwright/test";
const b = await chromium.launch(); const p = await b.newPage();
await p.goto("https://crm-agents.vercel.app/login");
await p.getByTestId("field-user").fill("nadie");
await p.getByTestId("field-password").fill("incorrecta");
await p.getByTestId("login-submit").click();
await p.waitForTimeout(3000);
console.log("error shown:", await p.getByTestId("login-error").isVisible().catch(() => false), "url:", new URL(p.url()).pathname);
await b.close();
EOF
node probe.tmp.mjs; rm probe.tmp.mjs
```

<details><summary>Resultado</summary>

```
error shown: true url: /login
```

</details>

⏺ Producción tiene `AUTH_SECRET`: el login responde «Usuario o contraseña incorrectos» y no da error 500. Para probar `/pipeline` con sesión necesito las credenciales en local.

⏺ **Bash** — Check whether the Vercel CLI is installed

```
which vercel; ls ~/Library/pnpm 2>/dev/null | head -3
```

<details><summary>Resultado</summary>

```
vercel not found
package-manager-store
store
```

</details>

⏺ **Pregunta al humano:** En Vercel las 3 variables (AUTH_SECRET, DEMO_USER, DEMO_PASSWORD) parecen estar solo en Production/Preview: el `vercel env pull` (que trae Development) no las ha traído a crm-agents/.env.local. El login en producción sí funciona. ¿Cómo seguimos para verificar /pipeline con sesión?

- **Añado a Development y repito pull (Recommended)**: Marcas también Development en las 3 variables y vuelves a ejecutar `vercel env pull .env.local` en crm-agents. Yo hago login con Playwright en producción leyendo .env.local, sin ver los valores, y reviso /pipeline a 1280 y 390 px.
- **Lo verifico yo en el navegador**: Tú entras en /pipeline y me dices qué ves; yo no hago la prueba con sesión.

**Respuesta del humano:** Añado a Development y repito pull (Recommended)

⏺ **Bash** — Check pulled vars and the broken run report

```
cd <repos>/crm-agents && for v in AUTH_SECRET DEMO_USER DEMO_PASSWORD; do grep -q "^$v=..*" .env.local && echo "$v ok" || echo "$v missing"; done; cat > q.tmp.mjs <<'EOF'
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
console.log(await sql`select left(sha,7) sha, status, passed, failed, failures->0->>'title' first_failure, failures->0->>'project' project from test_reports order by id`);
console.log(await sql`select count(*)::int pending from github_events where processed_at is null`);
EOF
node --env-file=.env.local q.tmp.mjs; rm q.tmp.mjs
```

<details><summary>Resultado</summary>

```
AUTH_SECRET ok
DEMO_USER ok
DEMO_PASSWORD ok
[
  {
    sha: '6c2bb79',
    status: 'passed',
    passed: 24,
    failed: 0,
    first_failure: null,
    project: null
  },
  {
    sha: 'b9a60a2',
    status: 'passed',
    passed: 24,
    failed: 0,
    first_failure: null,
    project: null
  },
  {
    sha: 'ab0bf57',
    status: 'failed',
    passed: 24,
    failed: 2,
    first_failure: 'smoke.spec.ts › shows a page that does not exist (broken on purpose)',
    project: 'desktop'
  }
]
[ { pending: 0 } ]
```

</details>

⏺ **Bash** — Log in to production pipeline and capture at both widths

```
cd <repos>/crm-demo && SP=<scratchpad> && cat > probe.tmp.mjs <<EOF
import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const width of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  const p = await ctx.newPage();
  await p.goto("https://crm-agents.vercel.app/pipeline");
  await p.getByTestId("field-user").fill(process.env.DEMO_USER);
  await p.getByTestId("field-password").fill(process.env.DEMO_PASSWORD);
  await p.getByTestId("login-submit").click();
  await p.waitForURL(/\/pipeline$/);
  await p.getByTestId("pr-card").first().waitFor();
  await p.waitForLoadState("networkidle");
  const cards = await p.getByTestId("pr-card").count();
  const imgs = await p.locator("img").evaluateAll((els) => els.map((e) => e.naturalWidth > 0).filter(Boolean).length);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const blobUrls = (await p.content()).match(/blob\.vercel-storage\.com/g)?.length ?? 0;
  const shot = await p.request.get("/api/screenshots/1");
  console.log({ width, cards, imgsLoaded: imgs, overflow, blobUrls, shotStatus: shot.status(), cache: shot.headers()["cache-control"], type: shot.headers()["content-type"] });
  await p.screenshot({ path: "$SP/pipeline-" + width + ".png", fullPage: true });
  await ctx.close();
}
await b.close();
EOF
node --env-file=../crm-agents/.env.local probe.tmp.mjs 2>&1 | grep -v -i password; rm probe.tmp.mjs
```

<details><summary>Resultado</summary>

```
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

apiRequestContext.get: Invalid URL
    at <repos>/crm-demo/probe.tmp.mjs:17:32 {
  log: [],
  name: 'TypeError',
  code: 'ERR_INVALID_URL'
}

Node.js v22.23.4
```

</details>

⏺ **Bash** — Retry pipeline probe with a base URL

```
SP=<scratchpad> && cat > probe.tmp.mjs <<EOF
import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const width of [1280, 390]) {
  const ctx = await b.newContext({ baseURL: "https://crm-agents.vercel.app", viewport: { width, height: width === 390 ? 844 : 900 } });
  const p = await ctx.newPage();
  await p.goto("/pipeline");
  await p.getByTestId("field-user").fill(process.env.DEMO_USER);
  await p.getByTestId("field-password").fill(process.env.DEMO_PASSWORD);
  await p.getByTestId("login-submit").click();
  await p.waitForURL(/\/pipeline$/);
  await p.getByTestId("pr-card").first().waitFor();
  await p.waitForLoadState("networkidle");
  const cards = await p.getByTestId("pr-card").count();
  const imgs = await p.locator("img").evaluateAll((els) => els.filter((e) => e.naturalWidth > 0).length);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const blobUrls = (await p.content()).match(/blob\.vercel-storage\.com/g)?.length ?? 0;
  const shot = await p.request.get("/api/screenshots/1");
  console.log({ width, cards, imgsLoaded: imgs, overflow, blobUrls, shotStatus: shot.status(), cache: shot.headers()["cache-control"], type: shot.headers()["content-type"] });
  await p.screenshot({ path: "$SP/pipeline-" + width + ".png", fullPage: true });
  await ctx.close();
}
await b.close();
EOF
node --env-file=../crm-agents/.env.local probe.tmp.mjs 2>&1 | grep -v -i password; rm probe.tmp.mjs
```

<details><summary>Resultado</summary>

```
{
  width: 1280,
  cards: 2,
  imgsLoaded: 20,
  overflow: 0,
  blobUrls: 0,
  shotStatus: 200,
  cache: 'private, max-age=86400',
  type: 'image/jpeg'
}
{
  width: 390,
  cards: 2,
  imgsLoaded: 10,
  overflow: 0,
  blobUrls: 0,
  shotStatus: 200,
  cache: 'private, max-age=86400',
  type: 'image/jpeg'
}
```

</details>

⏺ **Read** — `<scratchpad>/pipeline-1280.png`

<details><summary>Resultado</summary>

```
[imagen]
```

</details>

⏺ **Read** — `<scratchpad>/pipeline-390.png`

<details><summary>Resultado</summary>

```
[imagen]
```

</details>

⏺ **Bash** — Trim error messages, tweak mobile grid, commit and push

```
cd <repos>/crm-agents && python3 - <<'EOF'
p='src/server/pipeline/artifact.ts';s=open(p).read()
old='''    .replace(/\\u001b\\[[0-9;]*m/g, "")
    .trim()'''
new='''    .replace(/\\u001b\\[[0-9;]*m/g, "")
    // Playwright appends the call log and a code frame: keep the assertion.
    .split(/\\n\\s*Call log:/)[0]!
    .trim()'''
assert old in s, s[s.index('cleanError'):s.index('cleanError')+400]
s=s.replace(old,new); open(p,'w').write(s)
p='src/server/pipeline/artifact.test.ts';s=open(p).read()
old='''    expect(cleanError(undefined)).toBe("");'''
new='''    expect(cleanError(undefined)).toBe("");
  });

  it("drops Playwright's call log and code frame", () => {
    expect(
      cleanError(
        'Error: failed\\n\\nExpected: "A"\\n\\nCall log:\\n  - waiting\\n\\n  49 | })',
      ),
    ).toBe('Error: failed\\n\\nExpected: "A"');'''
assert old in s; s=s.replace(old,new); open(p,'w').write(s)
p='src/app/globals.css';s=open(p).read()
s=s.replace("grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));","grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));")
open(p,'w').write(s)
EOF
pnpm exec prettier --write src >/dev/null; pnpm test 2>&1 | grep -E "Tests|×"; pnpm lint >/dev/null && pnpm typecheck >/dev/null && pnpm format:check >/dev/null && echo checks-ok && git add -A && git commit -q -m "fix: shorten failure messages and fit screenshots on mobile

Drop Playwright's call log and code frame from stored errors, and show
desktop screenshots two per row at 390 px.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push -q origin master 2>&1 | grep -v remote:; git log --oneline -1
```

<details><summary>Resultado</summary>

```
Tests  59 passed (59)
$ eslint
$ next typegen && tsc --noEmit
$ prettier --check .
checks-ok
22917b7 fix: shorten failure messages and fit screenshots on mobile
```

</details>

⏺ **Bash** — Check PR 3 checks, close PR 4 and watch Neon cleanup

```
cd <repos> && gh pr checks 3 -R daboy-dev/crm-demo 2>&1 | awk '{print $1,$2}'; gh pr close 4 -R daboy-dev/crm-demo --delete-branch --comment "H2 check done: the failing run shows up as a failure in the crm-agents pipeline. Closing without merging." 2>&1 | tail -2; sleep 30; gh run list -R daboy-dev/crm-demo -w neon-cleanup.yml -L 1 --json status,conclusion,headBranch --jq '.[]|[.headBranch,.status,.conclusion]|@tsv'
```

<details><summary>Resultado</summary>

```
Vercel pass
Vercel Preview
check pass
check pass
e2e pass
resolve pass
✓ Closed pull request daboy-dev/crm-demo#4 (test: broken E2E on purpose (H2 check, do not merge))
✓ Deleted branch test/broken-e2e
test/broken-e2e	completed	success
```

</details>

⏺ **Bash** — Confirm the Neon branch was actually deleted

```
id=$(gh run list -R daboy-dev/crm-demo -w neon-cleanup.yml -L 1 --json databaseId --jq '.[0].databaseId'); gh run view $id -R daboy-dev/crm-demo --log 2>/dev/null | grep -iE "nothing to delete|deleted|Delete the preview" | head -5
```

<details><summary>Resultado</summary>

```
delete-preview-branch	Check whether the preview branch still exists	2026-11-24T16:09:24.3521740Z ^[[36;1m  echo "No Neon branch named $NEON_BRANCH; nothing to delete."^[[0m
delete-preview-branch	Delete the preview branch	﻿2026-11-24T16:09:34.7705693Z ##[group]Run neondatabase/delete-branch-action@v3.2.1
delete-preview-branch	Delete the preview branch	2026-11-24T16:09:34.7706985Z with:
delete-preview-branch	Delete the preview branch	2026-11-24T16:09:34.7708120Z   project_id: ***
delete-preview-branch	Delete the preview branch	2026-11-24T16:09:34.7709058Z   branch: preview/test/broken-e2e
```

</details>

⏺ La rama de Neon `preview/test/broken-e2e` se ha borrado. Queda el PR #3, que es el trabajo de verdad: tiene los checks en verde y hay que fusionarlo para que el workflow llegue a `master`.

⏺ **Pregunta al humano:** PR crm-demo#3 (workflow preview-e2e, pages.ts, write-flow y AGENTS.md) tiene todos los checks en verde y ya se ve en /pipeline. ¿Lo fusiono a master? Al fusionarlo GitHub borra la rama y neon-cleanup borra su rama de Neon (D11).

- **Merge commit (Recommended)**: Conserva los 5 commits pequeños tal cual en master.
- **Squash**: Un solo commit en master.
- **No, lo fusiono yo**: Lo dejo abierto; tú decides cuándo.

**Respuesta del humano:** Merge commit (Recommended)

⏺ **Bash** — Merge PR 3, watch cleanup and sync local master

```
gh pr merge 3 -R daboy-dev/crm-demo --merge --delete-branch 2>&1 | tail -2; sleep 40; gh run list -R daboy-dev/crm-demo -L 4 --json workflowName,headBranch,status,conclusion --jq '.[]|[.workflowName,.headBranch,.status,.conclusion]|@tsv'; cd crm-demo && git switch -q master && git pull -q && git branch -D test/broken-e2e ci/preview-e2e 2>&1 | tail -1; git log --oneline -1
```

<details><summary>Resultado</summary>

```
Preview E2E	master	completed	skipped
Neon preview cleanup	ci/preview-e2e	completed	success
CI	master	completed	success
Neon preview cleanup	test/broken-e2e	completed	success
Eliminada la rama ci/preview-e2e (era b9a60a2).
32daf77 Merge pull request #3 from daboy-dev/ci/preview-e2e
```

</details>

⏺ **Bash** — Verify cleanup, panel CI and PR states in panel DB

```
id=$(gh run list -R daboy-dev/crm-demo -w neon-cleanup.yml -L 1 --json databaseId --jq '.[0].databaseId'); gh run view $id -R daboy-dev/crm-demo --log 2>/dev/null | grep -E "branch: preview|nothing to delete\.$" | grep -v 'echo' | head -3; gh run list -R daboy-dev/crm-agents -L 2 --json headSha,conclusion --jq '.[]|[.headSha[0:7],.conclusion]|@tsv'; cd ../crm-agents && cat > q.tmp.mjs <<'EOF'
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
console.log(await sql`select pr_number, max(pr_state) state, count(*)::int commits from previews group by 1 order by 1`);
console.log(await sql`select count(*)::int pending from github_events where processed_at is null`);
EOF
node --env-file=.env.local q.tmp.mjs; rm q.tmp.mjs
```

<details><summary>Resultado</summary>

```
delete-preview-branch	Delete the preview branch	2026-11-24T16:11:45.3796308Z   branch: preview/ci/preview-e2e
22917b7	success
f58c3ca	success
[
  { pr_number: 3, state: 'merged', commits: 2 },
  { pr_number: 4, state: 'closed', commits: 1 },
  { pr_number: null, state: null, commits: 1 }
]
[ { pending: 0 } ]
```

</details>

⏺ Una fila de `previews` no tiene PR. Miro de qué commit es:

⏺ **Bash** — Inspect the preview row without a PR

```
cat > q.tmp.mjs <<'EOF'
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const [r] = await sql`select * from previews where pr_number is null`;
console.log({ ...r, preview_url: r.preview_url && "<set>" });
console.log(await sql`select id, event, action, payload->'deployment'->>'environment' env, payload->'deployment_status'->>'state' st from github_events where payload->'deployment'->>'sha' = ${r.sha} or payload->'workflow_run'->>'head_sha' = ${r.sha}`);
EOF
node --env-file=.env.local q.tmp.mjs; rm q.tmp.mjs
```

<details><summary>Resultado</summary>

```
{
  sha: '32daf7777b6b92e35cc0a2b605ea9f6801565aa6',
  pr_number: null,
  pr_title: null,
  branch: 'master',
  pr_state: null,
  pr_updated_at: null,
  preview_url: null,
  deploy_state: null,
  deploy_updated_at: null,
  created_at: 2026-11-24T16:12:16.699Z
}
[
  {
    id: '51',
    event: 'workflow_run',
    action: 'requested',
    env: null,
    st: null
  },
  {
    id: '54',
    event: 'workflow_run',
    action: 'in_progress',
    env: null,
    st: null
  },
  {
    id: '56',
    event: 'deployment_status',
    action: 'created',
    env: 'Production',
    st: 'success'
  },
  {
    id: '57',
    event: 'workflow_run',
    action: 'requested',
    env: null,
    st: null
… (+30 líneas)
```

</details>

⏺ **Bash** — Ignore skipped runs, commit, push and clean the noise rows

```
python3 - <<'EOF'
p='src/server/pipeline/classify.ts';s=open(p).read()
old='''      if (action !== "completed") return ignored(`workflow_run ${action}`);'''
new='''      if (action !== "completed") return ignored(`workflow_run ${action}`);
      // Production deployments also start the workflow; its jobs are skipped.
      if (run.conclusion === "skipped") return ignored("workflow_run skipped");'''
assert old in s; s=s.replace(old,new); open(p,'w').write(s)
p='src/server/pipeline/reports.ts';s=open(p).read()
s=s.replace('if (run.conclusion === "cancelled" || run.conclusion === "skipped") {','if (run.conclusion === "cancelled") {')
open(p,'w').write(s)
p='src/server/pipeline/classify.test.ts';s=open(p).read()
old='''  it.each(["requested", "in_progress"])("ignores action %s", (action) => {'''
new='''  it("ignores a run whose jobs were skipped (production deployment)", () => {
    const payload = workflowRun();
    payload.workflow_run.conclusion = "skipped";
    expect(classifyEvent("workflow_run", payload)).toEqual({
      kind: "ignored",
      reason: "workflow_run skipped",
    });
  });

  it.each(["requested", "in_progress"])("ignores action %s", (action) => {'''
assert old in s; s=s.replace(old,new); open(p,'w').write(s)
EOF
pnpm exec prettier --write src >/dev/null; pnpm test 2>&1 | grep -E "Tests|×"; pnpm lint >/dev/null && pnpm typecheck >/dev/null && pnpm format:check >/dev/null && echo checks-ok && git add -A && git commit -q -m "fix: ignore skipped preview E2E runs

Production deployments also trigger preview-e2e.yml, whose jobs are skipped.
They no longer create a preview row or a cancelled report.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push -q origin master 2>&1 | grep -v remote:; cat > q.tmp.mjs <<'EOF'
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const sha = "32daf7777b6b92e35cc0a2b605ea9f6801565aa6";
console.log(await sql`delete from test_reports where sha = ${sha} returning id, status`);
console.log(await sql`delete from previews where sha = ${sha} and pr_number is null returning sha`);
EOF
node --env-file=.env.local q.tmp.mjs; rm q.tmp.mjs
```

<details><summary>Resultado</summary>

```
Tests  60 passed (60)
$ eslint
$ next typegen && tsc --noEmit
$ prettier --check .
checks-ok
[ { id: 4, status: 'cancelled' } ]
[ { sha: '32daf7777b6b92e35cc0a2b605ea9f6801565aa6' } ]
```

</details>

⏺ Pasos 6 y 7 hechos. Ahora cierro con la documentación. Primero cargo la herramienta para exportar la transcripción.

⏺ Primero escribo la documentación; la transcripción la exporto al final para que lo incluya todo.

⏺ **Bash** — Find milestone table and section headings in PROCESO

```
grep -n "^## \|H2\|Hitos\|hito" docs/PROCESO.md | head -40
```

<details><summary>Resultado</summary>

```
7:- **Implementación** con **Claude Code** en este repo, una sesión por hito.
14:## Hitos
20:| H2 · Tubería sin IA | Un PR de prueba en `crm-demo` aparece en `/pipeline` (con login) con su vista previa, el resultado de los tests y las capturas a 1280 px y 390 px; un test roto a propósito aparece como fallo; reenviar un webhook no duplica nada | En curso |
30:## Sesión 00 · Planificación (Project de Claude) · 23/11/2026
32:**Objetivo:** entender la prueba y la oferta, y decidir la arquitectura y el plan por hitos antes de escribir código.
44:**Resultado:** decisiones D1–D10, plan de hitos H0–H8 y un Whiteboard con el flujo de un run. Resumen de la sesión en [`sesiones/00-planificacion.md`](./sesiones/00-planificacion.md).
48:## Sesión 01 · H0 · Base del repo (Claude Code) · 23/11/2026
54:- Estructura `src/app` y `src/server/{db,runs,agents,llm,github}`. `llm` ya tiene la interfaz `LLMProvider`; el resto, un README con el hito en que se implementa.
72:## Sesión 02 · Planificación de H1 (Project de Claude) · 23/11/2026
83:- El criterio de H1 se amplía con un PR de prueba que compruebe la rama de Neon por vista previa y su borrado, para validar D11 antes de H2.
89:## Sesión 03 · H1 · CRM demo (Claude Code) · 24/11/2026
126:  - Arreglo: `ResetOnHide` reinicia los formularios al ocultarse, y `e2e/helpers.ts` aporta `byTestId()`, que filtra los elementos visibles. Está documentado en `AGENTS.md` para el agente de Testing (H2).
134:**Resultado:** H1 hecho. Cada PR tiene su vista previa con rama propia de Neon, y la rama se borra al cerrar el PR. El test de escritura, que no se subió porque escribe datos, queda como base para el E2E contra vistas previas de H2. Transcripción en [`sesiones/03-h1-crm-demo.md`](./sesiones/03-h1-crm-demo.md).
136:**Siguiente paso:** H2 · tubería sin IA. Un commit de prueba en `crm-demo` genera vista previa, webhook y capturas de Actions que llegan al panel.
138:## Sesión 04 · Planificación de H2 (Project de Claude) · 24/11/2026
149:- El login del panel se adelanta de H3 a H2 para que `/pipeline` no quede pública (D19). H3 queda solo para el motor de runs.
151:**Resultado:** decisiones D15–D19 aceptadas y criterio de H2 concretado.
159:**Siguiente paso:** sesión 05 de Claude Code (H2), en `crm-demo` y `crm-agents`.
```

</details>

⏺ **Bash** — Read milestone table

```
sed -n 14,28p docs/PROCESO.md
```

<details><summary>Resultado</summary>

```
## Hitos

| Hito | Se da por verificado cuando… | Estado |
|---|---|---|
| H0 · Plan y base del repo | Plan validado, documentos en el repo, esqueleto desplegado en Vercel con CI en verde | Hecho |
| H1 · CRM demo | `crm-demo` en producción con clientes, presupuestos y facturas, CI en verde, y un PR de prueba que crea su vista previa con su propia rama de Neon y la borra al cerrarse | Hecho |
| H2 · Tubería sin IA | Un PR de prueba en `crm-demo` aparece en `/pipeline` (con login) con su vista previa, el resultado de los tests y las capturas a 1280 px y 390 px; un test roto a propósito aparece como fallo; reenviar un webhook no duplica nada | En curso |
| H3 · Motor de runs | Un run completo con `MockProvider` | Pendiente |
| H4 · Orquestador | Plan con criterios de aceptación que el cliente aprueba o rechaza | Pendiente |
| H5 · Develop | PR real que compila en su vista previa | Pendiente |
| H6 · Testing | Un fallo provocado vuelve a Develop y se corrige o se bloquea | Pendiente |
| H7 · Panel completo | Run real de principio a fin en móvil y escritorio | Pendiente |
| H8 · Entrega | README, documentación, transcripciones saneadas y respuestas | Pendiente |

---
```

</details>

⏺ Escribo la entrada de PROCESO, la nota de D15 y el `CLAUDE.md`.

⏺ **Bash** — Write session 05 log, D15 note and update CLAUDE.md

```
python3 - <<'EOF'
p='docs/PROCESO.md';s=open(p).read()
s=s.replace("reenviar un webhook no duplica nada | En curso |","reenviar un webhook no duplica nada | Hecho |")
s=s.rstrip()+'''

## Sesión 05 · H2 · Tubería sin IA (Claude Code) · 24/11/2026

**Objetivo:** cada vista previa de `crm-demo` pasa Playwright en GitHub Actions y los resultados (tests y capturas) llegan al panel, que los muestra en `/pipeline` tras un login (D15–D19). Sin IA ni runs.

**Cómo fue:**
- Claude propuso un plan de commits por repo y ocho decisiones de detalle. Empezó tras el visto bueno.
- **`crm-demo`** (PR [crm-demo#3](https://github.com/daboy-dev/crm-demo/pull/3), fusionado):
  - `e2e/pages.ts` lista las páginas que se capturan: las tres listas y dos detalles, que se abren desde la primera fila para no depender de ids. `screenshots.spec.ts` guarda `<página>-<1280|390>.jpg` con los dos proyectos de Playwright que ya existían.
  - `e2e/write-flow.spec.ts`: el flujo de escritura de H1. Solo se ejecuta si el host es una vista previa (`crm-demo-*.vercel.app` y no es un alias de producción); en producción y en local se salta, porque el `.env.local` apunta a producción.
  - `preview-e2e.yml`: `deployment_status` en `success` y entorno `Preview*` → job `resolve` (busca la rama del sha) → job `e2e` con `concurrency` por rama → artifact `e2e-results` (`results.json`, `meta.json`, capturas) con `if: always()` y 1 día de retención. Sin secretos del panel.
  - `AGENTS.md`: cómo funciona el E2E de las vistas previas, para qué sirve `pages.ts` y que `.github/**` y los helpers de `e2e/` no se tocan.
- **`crm-agents`** (directo a `master`):
  - Login: sesión HMAC copiada de `crm-demo` con sus tests (cookie `agents_session`). El proxy deja públicos `/login`, `/api/health` y `/api/webhooks/github`.
  - Esquema: `github_events` (solo se añaden filas, `delivery_id` único), `previews` (una fila por sha), `test_reports` (único por `run_id` + `run_attempt`) y `screenshots`.
  - `POST /api/webhooks/github`: firma HMAC con `timingSafeEqual` sobre el cuerpo en crudo, insert con `on conflict do nothing`, 200 inmediato y procesamiento en `after()` (`maxDuration` 60 s). Si llega de nuevo un evento ya procesado, se ignora; si no se procesó, se reintenta.
  - Procesamiento: `classifyEvent` valida con Zod y filtra por repo, por entorno `Preview*` y por la ruta `.github/workflows/preview-e2e.yml`. Las actualizaciones son upserts que solo aplican datos igual o más recientes, así que el orden de llegada no importa.
  - Artifact: lista con el PAT, sigue la redirección a la URL firmada sin enviar el token, descomprime en memoria con `fflate` (solo los nombres esperados y con límites de tamaño), comprueba `meta.json` contra los datos del run y sube las capturas al Blob privado por OIDC en una ruta fija por intento. Las capturas ya guardadas no se vuelven a subir.
  - `GET /api/screenshots/[id]` comprueba la sesión, lee el blob en el servidor y responde con `Cache-Control: private`. `/pipeline` muestra cada PR con su vista previa, sus tests (con el nombre y el error de los que fallan) y las capturas por tamaño. Se refresca cada 5 s con `router.refresh()` y tiene un botón para reprocesar eventos pendientes.
  - 60 tests de Vitest: firma (incluido el ejemplo de la doc de GitHub), idempotencia del webhook y del insert, clasificador y filtro de `workflow_run`, parseo de `results.json` y `meta.json`, lectura del zip y descarga del artifact.
- **Verificación en producción:**
  - PR #3: dos commits, cada uno con vista previa e informe 24/24 (incluido el flujo de escritura en la rama de Neon de la vista previa) y 10 capturas.
  - PR [crm-demo#4](https://github.com/daboy-dev/crm-demo/pull/4), con un test roto a propósito: llegó en directo como «Tests con fallos», 24 pasados y 2 fallidos, con el nombre y el error del test en escritorio y a 390 px.
  - Reenviar seis entregas ya procesadas: GitHub recibió 200 y el panel siguió con 23 eventos, 1 intento cada uno y los mismos informes y capturas.
  - `/pipeline` con login a 1280 y 390 px: sin scroll horizontal y sin ninguna URL de Blob en el HTML. Las capturas se sirven con `private`.
  - CI en verde en los dos repos. El PR #4 se cerró sin fusionar y el #3 se fusionó; `neon-cleanup` borró `preview/test/broken-e2e` y `preview/ci/preview-e2e`.

**Qué salió mal y qué se corrigió:**
- **Vercel no creaba GitHub Deployments.** El repo no tenía ningún deployment, solo commit statuses, así que no habría llegado ningún `deployment_status`. El humano activó los eventos de despliegue en el proyecto de Vercel `crm-demo` antes del primer PR.
- **`deployment.ref` es el sha, no la rama** (y el `payload` llega vacío). Con `concurrency` por `deployment.ref` no se cancelaban los commits anteriores del mismo PR. Con el visto bueno del humano se añadió el job `resolve`, que busca la rama con `branches-where-head`, y `meta.json.ref` lleva la rama. Anotado en D15.
- **Host de producción:** `crm-demo.vercel.app` no es este proyecto; producción es `crm-demo-daboy-dev.vercel.app`, y el primer patrón de «vista previa» también lo aceptaba. Se añadió una lista explícita de hosts de producción antes del primer commit.
- **Blob por OIDC en local:** el store solo tiene OIDC activado fuera de `development`, así que la prueba local falló con `BlobOidcEnvironmentNotAllowedError`. No se cambió nada; se verificó en producción, donde funciona.
- **Webhook antes del despliegue:** las entregas del PR #3 llegaron con 404 porque el panel aún no tenía la ruta. Se reenviaron desde la API de GitHub en orden cronológico. Los ids de entrega pierden precisión en `jq` (son enteros de 64 bits) y se leyeron con Python.
- **Variables del login:** se crearon solo para Production y Preview, así que `vercel env pull` (Development) no las traía. El humano las añadió a Development para la prueba local.
- **Un commit con el formato roto:** `pnpm format:check | tail` ocultaba el código de salida. Se corrigió con un amend antes de subirlo.
- **Errores largos:** el mensaje de Playwright incluye el *call log* y el fragmento de código. Ahora se guarda solo la aserción, y a 390 px las capturas de escritorio se ven de dos en dos.
… (+44 líneas)
```

<details><summary>Resultado</summary>

```
CLAUDE.md          | 18 ++++++++++++++----
 docs/DECISIONES.md |  6 ++++++
 docs/PROCESO.md    | 45 ++++++++++++++++++++++++++++++++++++++++++++-
 3 files changed, 64 insertions(+), 5 deletions(-)
[This command modified 2 files you've previously read: CLAUDE.md, docs/PROCESO.md. Call Read before editing.]
```

</details>
