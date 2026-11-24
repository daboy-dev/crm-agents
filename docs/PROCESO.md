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
| H2 · Tubería sin IA | Un PR de prueba en `crm-demo` aparece en `/pipeline` (con login) con su vista previa, el resultado de los tests y las capturas a 1280 px y 390 px; un test roto a propósito aparece como fallo; reenviar un webhook no duplica nada | Hecho |
| H3 · Motor de runs | Un run completo con `MockProvider` | Hecho |
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

## Sesión 04 · Planificación de H2 (Project de Claude) · 24/11/2026

**Objetivo:** decidir cómo llegan los resultados de Playwright de cada vista previa de `crm-demo` al panel, sin IA todavía.

**Cómo fue:**
- Se comprobó el patrón estándar para probar vistas previas de Vercel: un workflow con `on: deployment_status` que lee la URL de `target_url` (D15).
- Se comprobaron los límites de Vercel Blob en Hobby: 1 GB, 10 GB de transferencia y 2.000 operaciones avanzadas al mes (D18).
- Se diseñó el webhook: idempotente por `X-GitHub-Delivery`, responde enseguida y procesa en `after()` (D17).

**Qué cambió por el camino:**
- Lo más directo era que Actions subiera las capturas a Blob y avisara al panel con un POST. Se descartó: los workflows de `deployment_status` ejecutan el código del commit desplegado, así que un PR de Develop podría leer los secretos del panel. Los resultados vuelven en un artifact que el panel descarga al recibir `workflow_run` (D16). De ahí sale una regla para H5: Develop no puede tocar `.github/**` ni los helpers de `e2e/`.
- El login del panel se adelanta de H3 a H2 para que `/pipeline` no quede pública (D19). H3 queda solo para el motor de runs.

**Resultado:** decisiones D15–D19 aceptadas y criterio de H2 concretado.

**Pendiente del humano antes de la sesión de Claude Code:**
- Webhook del repo `crm-demo` hacia `https://crm-agents.vercel.app/api/webhooks/github`, con secreto y los eventos *Pull requests*, *Deployment statuses* y *Workflow runs*.
- PAT de permisos finos (D3) con *Actions: lectura* añadido, en las variables de entorno de `crm-agents`.
- Store de Vercel Blob conectado a `crm-agents`.
- Secrets de Actions en `crm-demo` con las credenciales de demo.

**Siguiente paso:** sesión 05 de Claude Code (H2), en `crm-demo` y `crm-agents`.

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
- **Ejecución `skipped` en `master`:** el despliegue de producción también dispara `preview-e2e.yml` (con los jobs saltados) y creaba una fila sin PR y un informe «cancelado». Ahora se ignora, y las filas sobrantes se borraron.
- **Credenciales:** `results.json` incluye en sus metadatos el email del autor del commit. El panel no guarda el JSON en crudo, solo el resumen.

**Resultado:** H2 hecho. Transcripción en [`sesiones/05-h2-tuberia.md`](./sesiones/05-h2-tuberia.md).

**Siguiente paso:** H3 · motor de runs (máquina de estados con `MockProvider`), enlazando runs con `previews` y `test_reports` por rama y PR.

## Sesión 06 · Planificación de H3 (Project de Claude) · 24/11/2026

**Objetivo:** decidir cómo funciona el motor de runs antes de abrir Claude Code: estados, cómo avanzan los pasos sin esperar en vivo, la cola y qué simula `MockProvider`.

**Cómo fue:**
- Se comprobó que en Vercel Hobby el cron solo se ejecuta una vez al día, así que no sirve para recuperar pasos caídos (D22).
- Se diseñaron los estados del run y de la tarea como una función pura de transiciones con tests (D21).
- Se decidió que H3 use GitHub de verdad (rama, commits, PR, vista previa, Actions y merge) con solo el LLM simulado (D24).

**Qué cambió por el camino:**
- Un PR o un build por tarea costaba demasiados builds y chocaba con los límites de PRs y de ramas de Neon. Se pasa a un PR por run, un commit por tarea y un solo build por iteración (D20).
- Sin cron, los pasos se recuperan con un lease y un `sweep()` que lanza el polling de la UI; los efectos se protegen con compare-and-swap y con la salida del LLM guardada (D22).
- Un run esperando aprobación bloquearía la cola para siempre si nadie responde; se cancela a las 24 h (D23).
- La regla de D16 (Develop no toca `.github/**` ni los helpers de `e2e/`) se adelanta de H5 a H3, con un escenario simulado que la comprueba (D24).

**Resultado:** decisiones D20–D25 aceptadas. Criterio de H3 concretado:
1. Escenario `ok` con 2 tareas: plan aprobado → PR con 2 commits y una sola vista previa → aprobación final → merge → `done`, y la rama de Neon se borra.
2. `fail-once`: una tarea falla en la iteración 1 y pasa en la 2, visible en la línea de tiempo.
3. `blocked`: tras 3 iteraciones, el humano abandona y el PR se cierra con su rama borrada.
4. Un plan rechazado con feedback vuelve a planificarse.
5. Un segundo run queda en cola y arranca cuando acaba el primero.
6. Reenviar webhooks o hacer doble clic en aprobar no duplica nada, y un lease caducado se reanuda sin repetir el commit.

**Comprobado por el humano:** `crm-demo` permite el merge squash y no tiene reglas de protección en `master`.

**Pendiente:** el Whiteboard del plan no se pudo editar desde esta sesión. Se actualizará al día cuando esté todo terminado.

**Siguiente paso:** sesión 07 de Claude Code (H3), en `crm-agents`.

## Sesión 07 · H3 · Motor de runs (Claude Code) · 24/11/2026

**Objetivo:** motor de runs con `MockProvider` sobre GitHub real (D20–D25), verificado en producción con los 6 criterios de la sesión 06.

**Cómo fue:**
- Claude propuso 10 commits y 16 decisiones de detalle; empezó tras el visto bueno. Todo directo a `master`.
- Esquema: `runs` (versión, lease, sha de cabeza y sha objetivo, PR, limpieza pendiente), `tasks` (por revisión del plan), `run_events` (solo se añaden filas) y `agent_steps` (único por run, tarea, iteración y agente, con `NULLS NOT DISTINCT`). Un índice único parcial sobre `(true)` impide dos runs activos.
- `machine.ts`: `transition(estado, evento) → { estado, tareas, efectos }` pura, con una tabla de 32 transiciones y 41 tests en total. Los efectos son `run_step`, `check_preview`, `cleanup` y `start_next`.
- `store.ts`: cada transición es una sola sentencia con CTE (ver el extra de D22). `engine.ts`: pasos `planning`, `developing`, `testing` y `merging` bajo lease, salida del LLM cacheada en `agent_steps`, cadena de commits con la Git Data API y una sola actualización de la rama, PR reutilizado, merge squash fijado al sha, limpieza (cerrar el PR y borrar la rama), cola y `sweep()` limitado a uno cada 4 s.
- Contratos Zod de los tres agentes y `MockProvider` con los escenarios `ok`, `fail-once`, `blocked` y `forbidden`. La regla de D16 se comprueba antes de escribir nada en GitHub.
- El procesamiento de H2 avisa al run que espera ese sha (`notify.ts`); el PR de `run/<id>` cerrado o fusionado desde GitHub también mueve el run.
- UI: `/runs` (formulario, activo, cola y terminados) y `/runs/[id]` (resumen, decisión, tareas y línea de tiempo). Las acciones llevan la versión del run. El login lleva ahora a `/runs`.
- 154 tests de Vitest. El CAS, el lease y el índice de un run activo se probaron además contra Neon con un test temporal que no se subió.

**Verificación en producción:**
1. **`ok`** (run #4): plan aprobado, PR [crm-demo#5](https://github.com/daboy-dev/crm-demo/pull/5) con 2 commits y una sola vista previa (24/24 E2E), aprobación final, merge squash, `done`; GitHub borró `run/4` y `neon-cleanup` su rama de Neon.
2. **`fail-once`** (run #8, PR [crm-demo#7](https://github.com/daboy-dev/crm-demo/pull/7)): la tarea 2 falla en la iteración 1 y pasa en la 2, con un solo commit nuevo; todo avanzó por webhooks.
3. **`blocked`** (run #9, PR [crm-demo#8](https://github.com/daboy-dev/crm-demo/pull/8)): tras 3 iteraciones la tarea 2 queda bloqueada; «Abandonar» cerró el PR y borró la rama (y `neon-cleanup` la de Neon).
4. **Plan rechazado con feedback** (run #5): vuelve a `planning` y el plan de la revisión 2 recoge el feedback.
5. **Cola:** el run #5 se creó con el #4 activo, esperó en cola y arrancó en el mismo segundo en que el #4 terminó; igual el #9 tras el #8.
6. **Sin duplicados:** doble clic en «Aprobar plan» y en «Aprobar y fusionar», con un solo evento cada vez. Cinco entregas reenviadas desde GitHub recibieron 200 y siguieron con 1 fila y 1 intento, sin eventos, informes ni capturas nuevas. Con la caída simulada (run #4), el sweep reanudó el paso al caducar el lease y la rama siguió con los mismos 2 commits.
- Además: `forbidden` (run #10) bloqueó al intentar escribir `.github/workflows/agent.yml`, sin commit ni rama; un rechazo sin feedback (run #5) cerró el PR [crm-demo#6](https://github.com/daboy-dev/crm-demo/pull/6) y borró la rama; un run con un paso que falla 3 veces (run #3) pasó a `failed`.
- Al final no quedan ramas `run/*` ni PRs abiertos en `crm-demo`; `master` tiene los `agent-runs/` de los runs #4 y #8.

**Qué salió mal y qué se corrigió:**
- **PAT sin escritura:** el primer run (#3) falló con `403 Resource not accessible by personal access token` al crear el árbol. El humano dio al PAT *Contents* y *Pull requests* de lectura y escritura (el valor no cambia, así que no hubo que tocar Vercel). El run #3 acabó en `failed` tras 3 intentos, lo que de paso probó ese camino.
- **Informe antes de tiempo:** con la caída simulada, Vercel y Playwright terminaron antes de que el run pasara a `awaiting_preview`; el webhook se ignoró y el run esperó al sweep, que no corría porque la pestaña estaba oculta. Ahora, al entrar en `awaiting_preview`, el motor busca el informe de su sha (efecto `check_preview`).
- **Falsos builds rotos:** Vercel publica `failure` en el primer despliegue de una rama y `success` después en el mismo deployment. El run #5 gastó sus 3 iteraciones en esos falsos fallos. Ahora el fallo es provisional durante 3 minutos (extra de D22); en el run #9 se vio la nota y no se gastó ninguna iteración. El run #5 se rechazó y el criterio 2 se repitió con el #8.
- **Orden de la línea de tiempo:** los eventos de una transición se insertaban en CTE distintas y salían desordenados. Ahora van en un solo insert con su orden.
- **SQL de Drizzle:** al meter el `UPDATE` de Drizzle dentro de `sql` salía entre dobles paréntesis, que Postgres no acepta en un CTE. Se usa `.getSQL()`.

**Resultado:** H3 hecho. Transcripción en [`sesiones/07-h3-motor-runs.md`](./sesiones/07-h3-motor-runs.md).

**Siguiente paso:** H4 · Orquestador con `GeminiProvider`.
