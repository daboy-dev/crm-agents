# CLAUDE.md · crm-agents

## Qué es
Prueba técnica para Speed Paradigm: un equipo de 3 agentes de IA (Orquestador, Develop y Testing) y un humano que aprueba. Juntos modifican un mini CRM (clientes, presupuestos, facturas) a partir de peticiones en lenguaje natural.

- **Este repo (`crm-agents`):** el panel web, el motor de runs y los agentes.
- **`crm-demo` (otro repo):** el CRM que los agentes modifican mediante ramas y PRs.

Decisiones: `docs/DECISIONES.md` · Proceso e hitos: `docs/PROCESO.md`.

## Stack
- Next.js (App Router) + TypeScript estricto, desplegado en Vercel Hobby.
- Neon (Postgres) con Drizzle ORM y el driver serverless de Neon. Proyecto de Neon propio, distinto del de `crm-demo`.
- LLM: interfaz `LLMProvider` con `GeminiProvider` (`@google/genai`) y `MockProvider`, elegido por agente. Salidas validadas con Zod.
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
- `src/app`: UI y rutas API.
  - `/login` (sesión HMAC, D19; lleva a `/runs`) y `/pipeline` (PRs de `crm-demo`, vista previa, tests y capturas; polling cada 5 s, vista de depuración).
  - `/runs` (petición nueva, activo, cola y terminados) y `/runs/[id]` (decisión, tareas y línea de tiempo). Su polling llama a `sweep()` (D22) y solo corre con la pestaña visible.
  - `/api/health`, `/api/webhooks/github` (D17) y `/api/screenshots/[id]` (D18).
- `src/proxy.ts`: protege todo salvo `/login`, `/api/health` y `/api/webhooks/github`.
- `src/server/auth.ts` (copia de `crm-demo`) y `src/server/session.ts`.
- `src/server/db`: esquema y cliente de Drizzle. Migraciones en `drizzle/`.
- `src/server/github`: firma de webhooks, registro idempotente de eventos, cliente de artifacts y configuración (`DEMO_REPO`, `preview-e2e.yml`).
- `src/server/pipeline`: clasificación de eventos, upserts de `previews`, lectura del artifact, informes y capturas en Blob, resultados de `pr-check` en `pr_checks` (`checks.ts`, D33), consultas de `/pipeline` y reprocesado.
- `src/server/runs`: `machine.ts` (transiciones puras, D21; `awaiting_check` y la división de D34), `store.ts` (CAS en una sentencia con CTE y lease, D22), `cache.ts` (salidas de `agent_steps` y cuenta de llamadas), `engine.ts` (pasos, una llamada de Develop por invocación de D35, espera a `pr-check`, división, efectos, cola, limpieza y `sweep()`), `commits.ts` (archivos normalizados y tareas sin cambios, D34), `notify.ts` (eventos de GitHub → run por sha o por rama `run/<id>`), `queries.ts` y `limits.ts`.
- `src/server/agents`: contratos Zod (`contracts.ts`: plan de D28 con `references`, división y salida de Develop de D34), llamadas a los agentes (`index.ts`), contexto del Orquestador (`context.ts`, D27) y de Develop (`develop-context.ts`, D32), prompts (`prompts/`: orquestador, división y Develop) y rutas prohibidas para Develop (`paths.ts`, D16 y D31).
- `src/server/llm`: `LLMProvider` y sus errores (`provider.ts`), `MockProvider` con escenarios (D24), `ChainProvider` con la cadena por agente, ajustes por agente y reparación (`chain.ts`, D36), eslabones `GeminiClient` (`gemini.ts`, D26) y `GroqClient` (`groq.ts`), eslabones agotados en `app_meta` (`quota.ts`), proveedor por agente y `getProvider()` (`index.ts`). Respuestas en `fixtures/gemini/` y `fixtures/groq/`.
- `src/server/github/repo.ts`: Git Data API y PRs de `crm-demo` (ramas `run/<id>`, merge squash fijado al sha).
- Next.js 16: la doc de la versión instalada está en `node_modules/next/dist/docs/` (ver `AGENTS.md`). `cacheComponents` está activo: los route handlers que deban ejecutarse en cada petición llaman a `connection()`, y los componentes que leen la base de datos van dentro de `<Suspense>`.

## Variables
Ver `.env.example`. En Vercel y en `.env.local` (`vercel env pull`): `DATABASE_URL`, `AUTH_SECRET`, `DEMO_USER`, `DEMO_PASSWORD`, `GH_TOKEN` (PAT de `crm-demo` con Actions: lectura), `GH_WEBHOOK_SECRET`, `BLOB_STORE_ID` y `VERCEL_OIDC_TOKEN` (caduca en local; el store solo tiene OIDC fuera de `development`, así que Blob se prueba en producción). H4: `GEMINI_API_KEY` y `LLM_PROVIDER_ORCHESTRATOR=gemini`. H5: `GROQ_API_KEY` (respaldo del Orquestador, D36). Opcionales: `LLM_PROVIDER=mock` (fuerza el mock en todos), `LLM_PROVIDER_DEVELOP` y `LLM_PROVIDER_TESTING` (`mock`; `gemini` es la cadena real del agente), `LLM_CHAIN_<AGENTE>` (cadena `proveedor:modelo`, D36), `RUNS_PER_DAY` (5) y `LLM_CALLS_PER_RUN` (12). El PAT necesita *Contents* y *Pull requests* de lectura y escritura y *Actions* de lectura.

## Comandos
- `pnpm dev` · servidor de desarrollo.
- `pnpm build` · build de producción.
- `pnpm lint` · ESLint.
- `pnpm format` / `pnpm format:check` · Prettier (no toca el Markdown).
- `pnpm typecheck` · `next typegen` + `tsc --noEmit`.
- `pnpm test` · Vitest (`src/**/*.test.ts`). Nada llama a Gemini.
- `pnpm eval:plan` · a mano: las 4 peticiones de D14 contra Gemini → `docs/evals/` (gasta cuota; `EVAL_FORCE=1` repite las ya hechas).
- `pnpm db:generate` · genera una migración a partir de `src/server/db/schema.ts`.
- `pnpm db:migrate` · aplica las migraciones (lee `DATABASE_URL` de `.env.local` o `.env`).

## Estado
- H0 hecho (23/11/2026).
- H1 hecho (24/11/2026): `crm-demo` en producción, con vista previa y rama de Neon por PR, borrada al cerrar el PR (`neon-cleanup.yml`).
- H2 hecho (24/11/2026): cada vista previa de `crm-demo` pasa Playwright en Actions; el panel recibe `workflow_run`, descarga el artifact `e2e-results` y muestra tests y capturas en `/pipeline` tras el login.
- H3 hecho (24/11/2026): runs con `MockProvider` sobre GitHub real (rama `run/<id>`, un commit por tarea, PR, vista previa, E2E y merge), con cola, lease, sweep y los 6 criterios comprobados en producción.
- H4 hecho (24/11/2026): el Orquestador planifica con Gemini (contexto de `crm-demo`, plan de D28, replanificación de D29 y rechazo fuera de alcance). Develop y Testing siguen con el mock. Los 5 criterios están comprobados en producción.
- Siguiente: H5 · Develop con `GeminiProvider`.
