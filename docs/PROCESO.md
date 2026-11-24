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
| H1 · CRM demo | `crm-demo` en producción con clientes, presupuestos y facturas, CI en verde, y un PR de prueba que crea su vista previa con su propia rama de Neon y la borra al cerrarse | Hecho |
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

## Sesión 02 · Planificación de H1 (Project de Claude) · 23/11/2026

**Objetivo:** decidir cómo se construye `crm-demo` antes de abrir Claude Code y comprobar los límites de Neon pendientes de D7.

**Cómo fue:**
- Se comprobaron los límites del plan gratuito de Neon: 100 proyectos, 10 ramas por proyecto, 1 GB y 100 CU-h por proyecto.
- Se definió el modelo de datos: `clients`, `quotes` + `quote_items` (borrador, enviado, aceptado o rechazado) e `invoices` + `invoice_items` (se generan desde un presupuesto aceptado; pendiente o pagada, con vencimiento).
- Login de demo con cookie firmada y un usuario configurado en variables de entorno.

**Qué cambió por el camino:**
- El límite de 10 ramas es un riesgo real: si se llena, las vistas previas no llegan a compilar. Se añade la limpieza automática de ramas y un solo run activo (D11).
- El criterio de H1 se amplía con un PR de prueba que compruebe la rama de Neon por vista previa y su borrado, para validar D11 antes de H2.

**Resultado:** decisiones D11–D14 aceptadas (limpieza de ramas, stack y estructura de `crm-demo`, migraciones en el build, datos de prueba con huecos a propósito).

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
- **Credenciales en la sesión:** al depurar, una traza de Playwright mostró en claro las credenciales de demo de producción. Se borró la traza y la transcripción las oculta.
- **Variables de entorno:** no había CLI de Vercel en local. El humano ejecutó `vercel link` y `vercel env pull` para traer las variables de producción, y Claude nunca recibió claves por el chat.
- **Ramas de Neon obsoletas:** la integración gestionada por Neon no borra la rama `preview/...` al borrar la rama de Git. La marca como obsoleta y solo la borra en el **siguiente despliegue de vista previa**. Sin vistas previas nuevas, las ramas se acumulan con su compute activo, un riesgo para el límite de 10 ramas (D11).
  - Se añadió `.github/workflows/neon-cleanup.yml` en un segundo PR ([crm-demo#2](https://github.com/daboy-dev/crm-demo/pull/2)). Al cerrarse un PR, comprueba que su rama existe y la borra con `neondatabase/delete-branch-action`. Usa los secrets `NEON_API_KEY` y `NEON_PROJECT_ID`.
  - Verificado: la vista previa del PR 2 hizo que Neon borrara la rama obsoleta del PR 1 (su health pasó de 200 a 503). Al fusionar el PR 2, el workflow borró su propia rama en segundos.
- **Copia de `DECISIONES.md`:** apareció una copia en `crm-demo/docs/`. No se subió; las decisiones solo viven en `crm-agents`.

**Resultado:** H1 hecho. Cada PR tiene su vista previa con rama propia de Neon, y la rama se borra al cerrar el PR. El test de escritura, que no se subió porque escribe datos, queda como base para el E2E contra vistas previas de H2. Transcripción en [`sesiones/03-h1-crm-demo.md`](./sesiones/03-h1-crm-demo.md).

**Siguiente paso:** H2 · tubería sin IA. Un commit de prueba en `crm-demo` genera vista previa, webhook y capturas de Actions que llegan al panel.
