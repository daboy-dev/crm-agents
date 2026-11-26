# CLAUDE.md · crm-agents

## Qué es
Prueba técnica para Speed Paradigm: un equipo de 3 agentes de IA (Orquestador, Develop y Testing) y un humano que aprueba. Juntos modifican un mini CRM (clientes, presupuestos, facturas) a partir de peticiones en lenguaje natural.

- **Este repo (`crm-agents`):** el panel web, el motor de runs y los agentes.
- **`crm-demo` (otro repo):** el CRM que los agentes modifican mediante ramas y PRs.

Decisiones: `docs/DECISIONES.md` · Proceso e hitos: `docs/PROCESO.md`.

## Stack
- Next.js (App Router) + TypeScript estricto, desplegado en Vercel Hobby.
- Neon (Postgres) con Drizzle ORM y el driver serverless de Neon. Proyecto de Neon propio, distinto del de `crm-demo`.
- LLM: interfaz `LLMProvider`, elegida por agente: `ChainProvider` con una cadena de eslabones Gemini (`@google/genai`), Groq y Anthropic (D36, D37, D40), o `MockProvider`. Salidas validadas con Zod.
- Tests: Vitest (dominio) y Playwright (E2E del panel, en local contra la rama `e2e` de Neon). CI en GitHub Actions.

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
  - `/runs` (portada de D48: introducción, peticiones sugeridas de `demo-requests.ts`, simulaciones plegadas, runs que quedan hoy, aviso de cuota y posición en la cola) y `/runs/[id]` (tarjetas por agente de D42, barra de acción del humano, tareas y criterios de D43, línea de tiempo filtrable de D44 y vista previa de D45; pestañas en móvil y dos columnas en escritorio, D46). Las acciones del humano envían lo que aprueban (D47). Su polling llama a `sweep()` (D22) y solo corre con la pestaña visible.
  - `/api/health`, `/api/webhooks/github` (D17) y `/api/screenshots/[id]` (D18).
- `src/proxy.ts`: protege todo salvo `/login`, `/api/health` y `/api/webhooks/github`.
- `src/server/auth.ts` (copia de `crm-demo`) y `src/server/session.ts`.
- `src/server/db`: esquema y cliente de Drizzle. Migraciones en `drizzle/`.
- `src/server/github`: firma de webhooks, registro idempotente de eventos, cliente de artifacts y configuración (`DEMO_REPO`, `preview-e2e.yml`).
- `src/server/pipeline`: clasificación de eventos, upserts de `previews`, lectura del artifact (con los resultados de cada criterio y la prueba del fallo, D38), informes y capturas en Blob, resultados de `pr-check` en `pr_checks` (`checks.ts`, D33), consultas de `/pipeline` y reprocesado.
- `src/server/runs`: `agent-cards.ts` (D42), `task-view.ts` (D43), `timeline.ts` (D44), `human.ts` (precondiciones de D47), `demo-requests.ts` (D48; las peticiones de los evaluadores, extra de D14, con una fuera de alcance), `machine.ts` (transiciones puras, D21; `awaiting_check` y la división de D34), `store.ts` (CAS en una sentencia con CTE y lease, D22), `cache.ts` (salidas de `agent_steps` y cuenta de llamadas), `engine.ts` (pasos, una llamada de Develop por invocación de D35, espera a `pr-check`, división, efectos, cola, limpieza y `sweep()`), `commits.ts` (archivos normalizados, tareas sin cambios de D34 y simulación de fallo de criterio de D40), `format.ts` (Prettier sobre lo que escribe Develop, D41), `criteria.ts` (JSON de `e2e/criteria/run-<id>.json`, revisiones vigentes, veredicto del ejecutor y feedback para Develop, D38 y D39), `notify.ts` (eventos de GitHub → run por sha o por rama `run/<id>`), `queries.ts` y `limits.ts`.
- `src/server/agents`: contratos Zod (`contracts.ts`: plan de D28 con `references` y `testIds` por criterio, división y salida de Develop de D34, pasos y explicación de Testing de D38 y D39), `data-testid` en el código y simulación (`test-ids.ts`), llamadas a los agentes (`index.ts`), contexto del Orquestador (`context.ts`, D27) y de Develop (`develop-context.ts`, D32), prompts (`prompts/`: orquestador, división, Develop, Testing y el mapa de `data-testid` de `crm-demo` en `app-map.ts`) y rutas prohibidas para Develop (`paths.ts`, D16, D31 y D38).
- `src/server/llm`: `LLMProvider` y sus errores (`provider.ts`), `MockProvider` con escenarios (D24), `ChainProvider` con la cadena por agente, ajustes por agente y reparación (`chain.ts`, D36), eslabones `GeminiClient` (`gemini.ts`, D26), `AnthropicClient` (`anthropic.ts`, D37) y `GroqClient` (`groq.ts`), eslabones agotados en `app_meta` (`quota.ts`), adónde va la próxima llamada de cada agente y si es un respaldo (`quota-status.ts`, D48 y D49), proveedor por agente y `getProvider()` (`index.ts`). Respuestas en `fixtures/gemini/`, `fixtures/anthropic/` y `fixtures/groq/`.
- `src/server/github/repo.ts`: Git Data API y PRs de `crm-demo` (ramas `run/<id>`, merge squash fijado al sha).
- `e2e/`: Playwright del panel (H7) a 1280 y 390 px. `env.ts` (rama de Neon y guarda contra producción), `seed.ts` (runs de ejemplo en los estados que esperan al humano) y `panel.spec.ts`.
- Next.js 16: la doc de la versión instalada está en `node_modules/next/dist/docs/` (ver `AGENTS.md`). `cacheComponents` está activo: los route handlers que deban ejecutarse en cada petición llaman a `connection()`, y los componentes que leen la base de datos van dentro de `<Suspense>`.

## Variables
Ver `.env.example`. En Vercel y en `.env.local` (`vercel env pull`): `DATABASE_URL`, `AUTH_SECRET`, `DEMO_USER`, `DEMO_PASSWORD`, `GH_TOKEN` (PAT de `crm-demo` con Actions: lectura), `GH_WEBHOOK_SECRET`, `BLOB_STORE_ID` y `VERCEL_OIDC_TOKEN` (caduca en local; el store solo tiene OIDC fuera de `development`, así que Blob se prueba en producción). H4: `GEMINI_API_KEY` y `LLM_PROVIDER_ORCHESTRATOR=gemini`. H5: `GROQ_API_KEY` (respaldo del Orquestador, D36) y `ANTHROPIC_API_KEY` (respaldo de pago de los tres agentes, D37). Opcionales: `LLM_PROVIDER=mock` (fuerza el mock en todos), `LLM_PROVIDER_DEVELOP` y `LLM_PROVIDER_TESTING` (`mock`; `gemini` es la cadena real del agente), `LLM_CHAIN_<AGENTE>` (cadena `proveedor:modelo`, D36), `RUNS_PER_DAY` (5) y `LLM_CALLS_PER_RUN` (16, D40). H6: `LLM_PROVIDER_TESTING=gemini`. Entrega (D49): las tres `LLM_CHAIN_*` empiezan por `anthropic:claude-sonnet-5-5` y siguen con la cadena gratuita, `RUNS_PER_DAY=50` y `LLM_CALLS_PER_RUN=24`; solo en Vercel, sin cambios de código. Volver a la cadena gratuita es quitar las `LLM_CHAIN_*`. Límite real: 100 despliegues al día en Vercel Hobby (unos 20–30 runs). El PAT necesita *Contents* y *Pull requests* de lectura y escritura y *Actions* de lectura.

## Comandos
- `pnpm dev` · servidor de desarrollo.
- `pnpm build` · build de producción.
- `pnpm lint` · ESLint.
- `pnpm format` / `pnpm format:check` · Prettier (no toca el Markdown).
- `pnpm typecheck` · `next typegen` + `tsc --noEmit`.
- `pnpm test` · Vitest (`src/**/*.test.ts`). Nada llama a Gemini.
- `pnpm eval:plan` · a mano: las 4 peticiones de D14 contra Gemini → `docs/evals/` (gasta cuota; `EVAL_FORCE=1` repite las ya hechas).
- `pnpm eval:testing` · a mano: las 4 peticiones de H6 (extra de D14), plan y pasos de Testing → `docs/evals/TESTING.md` (gasta cuota; `EVAL_FORCE=1`, `EVAL_ONLY=<slug>` y `EVAL_TAG=groq` con `LLM_CHAIN_TESTING`).
- `pnpm e2e` · Playwright del panel: hace `next build` y `next start` en el puerto 3100 contra `E2E_DATABASE_URL` de `.env.e2e`, con el mock y sin claves de GitHub ni de LLM. No usa `next dev`: su HMR recargaba la página en bucle. La salida va al directorio temporal del sistema.
- `pnpm e2e:migrate` · aplica las migraciones a la rama `e2e` de Neon.
- `pnpm db:generate` · genera una migración a partir de `src/server/db/schema.ts`.
- `pnpm db:migrate` · aplica las migraciones (lee `DATABASE_URL` de `.env.local` o `.env`).

## Estado
- H0 hecho (23/11/2026).
- H1 hecho (24/11/2026): `crm-demo` en producción, con vista previa y rama de Neon por PR, borrada al cerrar el PR (`neon-cleanup.yml`).
- H2 hecho (24/11/2026): cada vista previa de `crm-demo` pasa Playwright en Actions; el panel recibe `workflow_run`, descarga el artifact `e2e-results` y muestra tests y capturas en `/pipeline` tras el login.
- H3 hecho (24/11/2026): runs con `MockProvider` sobre GitHub real (rama `run/<id>`, un commit por tarea, PR, vista previa, E2E y merge), con cola, lease, sweep y los 6 criterios comprobados en producción.
- H4 hecho (24/11/2026): el Orquestador planifica con Gemini (contexto de `crm-demo`, plan de D28, replanificación de D29 y rechazo fuera de alcance). Develop y Testing siguen con el mock. Los 5 criterios están comprobados en producción.
- H5 hecho (25/11/2026): Develop escribe código real con la cadena Gemini → Anthropic (D37). `pr-check` genera la migración y devuelve los errores de tipos y lint; las tareas demasiado grandes se dividen. Los 6 criterios están comprobados en producción.
- H6 hecho (26/11/2026): Testing escribe los pasos de cada criterio `e2e` con su cadena (Gemini → Groq → Anthropic), que ejecuta `e2e/criteria.spec.ts` de `crm-demo`, y explica los fallos a Develop. Los JSON fusionados quedan como regresión. Criterios 1 a 5 comprobados en producción; el 6 en Vitest y en parte en producción.
- H7 hecho (26/11/2026): panel completo con tarjetas por agente, tareas y criterios en los dos tamaños, línea de tiempo filtrable, vista previa, pestañas en móvil, aprobaciones por precondición (D47) y portada para los evaluadores (D42–D48). E2E del panel en Playwright contra la rama `e2e` de Neon. Criterios 1 a 4 comprobados en producción.
- H8 en curso (26/11/2026): peticiones de los evaluadores, marca de «respaldo» por posición en la cadena (D49), README y transcripciones revisadas.
