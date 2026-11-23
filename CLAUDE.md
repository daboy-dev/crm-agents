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

## Comandos
- `pnpm dev` · servidor de desarrollo.
- `pnpm build` · build de producción.
- `pnpm lint` · ESLint.
- `pnpm format` / `pnpm format:check` · Prettier (no toca el Markdown).
- `pnpm typecheck` · `next typegen` + `tsc --noEmit`.
- `pnpm test` · Vitest (`src/**/*.test.ts`).
- `pnpm db:generate` · genera una migración a partir de `src/server/db/schema.ts`.
- `pnpm db:migrate` · aplica las migraciones (lee `DATABASE_URL` de `.env.local` o `.env`).

## Estado
H0 hecho (23/11/2026). Siguiente: H1 · `crm-demo`.
