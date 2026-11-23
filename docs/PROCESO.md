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
| H1 · CRM demo | `crm-demo` en producción con clientes, presupuestos y facturas | Pendiente |
| H2 · Tubería sin IA | Un commit de prueba genera vista previa, webhook y capturas de Actions que llegan al panel | Pendiente |
| H3 · Panel y motor de runs | Login y un run completo con `MockProvider` | Pendiente |
| H4 · Orquestador | Plan con criterios de aceptación que el cliente aprueba o rechaza | Pendiente |
| H5 · Develop | PR real que compila en su vista previa | Pendiente |
| H6 · Testing | Un fallo provocado vuelve a Develop y se corrige o se bloquea | Pendiente |
| H7 · Panel completo | Run real de principio a fin en móvil y escritorio | Pendiente |
| H8 · Entrega | README, documentación, transcripciones saneadas y respuestas | Pendiente |

---

## Sesión 00 · Planificación (Project de Claude) · 23/11/2026

**Objetivo:** entender la prueba y la oferta, y decidir la arquitectura y el plan por hitos antes de escribir código.

**Cómo fue:**
- Se leyeron la prueba y la oferta.
- El producto elegido es un mini CRM (clientes, presupuestos, facturas), por cercanía a lo que hace la empresa.
- Se definieron los agentes: Orquestador, Develop y Testing, más la aprobación humana.

**Qué cambió por el camino:**
- Claude propuso primero un CRM declarativo, en el que Develop editaría una especificación JSON (es seguro y rápido). Se descartó: la prueba pide que Develop escriba código, así que se eligió el flujo real de rama, PR y vista previa en Vercel (D1).
- La revisión visual en escritorio y móvil necesita un navegador. Chromium en una función de Vercel gratuita se consideró demasiado pesado, así que Playwright pasa a GitHub Actions contra la URL de la vista previa (D5).
- Para no arriesgar el panel, el CRM se separa en su propio repo, proyecto de Vercel y proyecto de Neon (D2, D7).

**Resultado:** decisiones D1–D10, plan de hitos H0–H8 y un Whiteboard con el flujo de un run. Resumen de la sesión en [`sesiones/00-planificacion.md`](./sesiones/00-planificacion.md).

**Siguiente paso:** sesión 01 de Claude Code (H0): esqueleto del repo, CI y primer despliegue.

## Sesión 01 · H0 · Base del repo (Claude Code) · 23/11/2026

**Objetivo:** dejar el esqueleto de `crm-agents` listo, con CI y desplegado en Vercel, sin lógica de agentes todavía.

**Cómo fue:**
- Next.js 16.4 (App Router) generado con `create-next-app` y pnpm, con TypeScript estricto (más `noUncheckedIndexedAccess`), ESLint y Prettier.
- Estructura `src/app` y `src/server/{db,runs,agents,llm,github}`. `llm` ya tiene la interfaz `LLMProvider`; el resto, un README con el hito en que se implementa.
- Drizzle con el driver HTTP de `@neondatabase/serverless`, la tabla `app_meta` y la migración `0000_init`, aplicada en el proyecto de Neon `crm-agents`.
- `GET /api/health` consulta `app_meta`, así que también falla si falta la migración. Devuelve `{ ok, db, version }` y un 503 si la base de datos no responde. La lógica está separada de la ruta para probarla con una base de datos simulada en Vitest.
- GitHub Actions ejecuta install, lint, comprobación de formato, tipos y tests en cada push y PR.
- Verificado en producción: `https://crm-agents.vercel.app/api/health` devuelve `{"ok":true,"db":true,"version":"0.1.0+02f0d10"}`.

**Qué salió mal y qué se corrigió:**
- `create-next-app` no acepta un directorio con archivos, así que se generó en una carpeta temporal y se copió al repo.
- pnpm bloqueó los scripts de instalación de esbuild (lo necesitan drizzle-kit y Vitest); se permitió explícitamente en `pnpm-workspace.yaml`.
- Next.js 16 trae `cacheComponents` activo, que intenta prerenderizar los route handlers. El health check llama a `connection()` para ejecutarse siempre en cada petición.
- `pnpm format` reformateó los documentos escritos a mano (`CLAUDE.md`, `docs/`). Se restauraron y Prettier deja de tocar el Markdown.
- La primera CI pasó con un aviso de acciones sobre Node 20 obsoleto; se subieron `checkout`, `setup-node` y `pnpm/action-setup` a sus versiones mayores actuales.
- La cadena de conexión acabó en `.env` en lugar de `.env.local`; `drizzle.config.ts` lee los dos y ambos están ignorados por git.

**Resultado:** H0 cerrado. Transcripción en [`sesiones/01-h0-base.md`](./sesiones/01-h0-base.md).

**Siguiente paso:** H1 · `crm-demo` en producción con clientes, presupuestos y facturas.
