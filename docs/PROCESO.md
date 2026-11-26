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
| H4 · Orquestador | Plan con criterios de aceptación que el cliente aprueba o rechaza | Hecho |
| H5 · Develop | PR real que compila en su vista previa | Hecho |
| H6 · Testing | Un fallo provocado vuelve a Develop y se corrige o se bloquea | Hecho |
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

## Sesión 08 · Planificación de H4 (Project de Claude) · 24/11/2026

**Objetivo:** decidir cómo se conecta Gemini al Orquestador, qué contexto recibe y qué devuelve, antes de abrir Claude Code.

**Cómo fue:**
- Se comprobó la cuota gratuita de Gemini. Google ya no la publica; en AI Studio, el proyecto de la clave muestra 5 RPM y 20 peticiones al día para `gemini-3.8-flash` y `gemini-3.6-flash`, y 15 RPM y 500 al día para `gemini-3.5-flash-lite`, con reinicio a las 9:00 de Madrid.
- Se definieron el contexto del Orquestador (D27), el contrato del plan (D28) y cómo se replanifica con feedback (D29).

**Qué cambió por el camino:**
- Con 20 peticiones al día por modelo Flash, un run real (5–10 llamadas) dejaba sitio para 2–4 runs diarios, y el tope de 30 llamadas por run superaba la cuota entera. Se pasa a una lista de modelos por agente que salta al siguiente al agotar la cuota diaria, y se bajan los límites a 5 runs al día y 12 llamadas por run (D26).
- Un 429 por minuto no espera dentro de la función: aplaza el lease y lo retoma el sweep, sin contar como fallo (D26).
- El Orquestador puede rechazar una petición fuera de alcance; el run termina en `rejected` sin crear rama (D28).

**Resultado:** decisiones D26–D30 aceptadas. Criterio de H4:
1. En producción, las cuatro peticiones de D14 (NIF, buscador, facturas vencidas y página de contacto) dan planes válidos de 1 a 4 tareas con criterios comprobables.
2. Un plan rechazado con feedback da una revisión 2 que lo recoge; al aprobarlo, el run sigue con Develop y Testing simulados hasta `done`.
3. Una petición fuera de alcance acaba en `rejected` con su motivo, sin rama ni PR.
4. Repetir un paso no vuelve a llamar a Gemini, y las llamadas cuentan en `LLM_CALLS_PER_RUN`.
5. Modelo, tokens y latencia de cada llamada visibles en la línea de tiempo.

- **Anthropic como respaldo de pago (D37):** para no parar H5 hasta el día siguiente, el humano propuso usar sus créditos de Anthropic con la interfaz común.
  - Claude añadió `AnthropicClient`, que va detrás de Gemini en las tres cadenas ([crm-agents#3](https://github.com/daboy-dev/crm-agents/pull/3)).
  - Claude propuso Opus; el humano eligió Sonnet, porque basta con mostrar cómo se trabaja.
  - En el run #17 respondió las 4 llamadas reales: plan, división y las dos de Develop. La llamada grande de Develop costó unos 5 céntimos.
- **Push de prueba a `master`:** se hizo con commits vacíos creados con `git commit-tree`, para que un fallo del ruleset no dejara nada en `master`. Ninguno quedó en una rama.

**Hecho por el humano:** clave de Gemini en un proyecto de Google sin facturación y `GEMINI_API_KEY` en Vercel.

**Siguiente paso:** sesión 09 de Claude Code (H4), en `crm-agents`.

## Sesión 09 · H4 · Orquestador con `GeminiProvider` (Claude Code) · 24/11/2026

**Objetivo:** el Orquestador planifica con Gemini de verdad (D26–D30). Develop y Testing siguen con el mock, así que un run con plan real llega hasta el merge escribiendo `agent-runs/`.

**Cómo fue:**
- Claude propuso 12 commits y las decisiones de detalle y empezó tras el visto bueno. Todo directo a `master`.
- **Contrato (D28):** `feasible`, `rejectionReason`, `summary`, `assumptions` y de 1 a 4 tareas con `files` y criterios `{ id, type: e2e | visual, text }`. Las comprobaciones que un JSON Schema no expresa (motivo obligatorio, rutas de `paths.ts`, ids únicos y una página nueva que no está en `e2e/pages.ts`) van en un `superRefine`; la del árbol solo cuando se conoce el árbol. Migración 0003: columnas nuevas y conversión de los criterios de H3.
- **Máquina:** transición `planning → rejected` (`plan_infeasible`), con limpieza si ya había rama.
- **`GeminiProvider` (D26):** `@google/genai` 3.6.1, `responseJsonSchema` generado con `z.toJSONSchema` y podado al subconjunto que acepta Gemini, una llamada de reparación con los errores de Zod, la lista de modelos con salto ante el 429 diario (recordado en `app_meta` hasta las 9:00) y `RateLimited` ante el 429 por minuto, sin reintentos del SDK. `LLMProvider` devuelve el detalle de cada llamada y recibe ganchos para contarlas y renovar el lease.
- **Proveedor por agente:** `LLM_PROVIDER_<AGENTE>` y `LLM_PROVIDER=mock` como plan B; se guarda en `runs.providers`.
- **Contexto (D27):** árbol con la Git Trees API (sin `agent-runs/`) y `AGENTS.md`, `src/db/schema.ts` y `e2e/pages.ts` leídos en `runs.base_sha`, que es también la base de `run/<id>`.
- **Prompt** en `src/server/agents/prompts/orchestrator.ts`, con las rutas prohibidas importadas de `paths.ts` y los modos `replace` y `amend` (D29). El modo lo decide `head_sha`.
- **Motor:** caché de `agent_steps` extraída a `cache.ts` y probada en memoria; cada petición respondida suma en `llm_calls` y renueva el lease; el 429 por minuto aplaza el lease sin contar como fallo; la cuota agotada y el tope de llamadas bloquean el run. `agent_steps` guarda modelo, tokens, latencia y el detalle de las llamadas, y los eventos las llevan para la línea de tiempo.
- **UI:** plan con resumen, supuestos, archivos y criterios con su tipo; motivo del rechazo; archivos leídos; modelo, tokens y latencia de cada llamada en la línea de tiempo. El selector de escenario solo sale si Develop o Testing son el mock, y hay una casilla nueva, «Simular caída tras planificar».
- **Pruebas (D30):** 199 tests de Vitest con el mock, respuestas grabadas y cuerpos de error con el formato de Google. `pnpm eval:plan` lanzó las 4 peticiones de D14 contra Gemini: los planes están en [`evals/`](./evals/README.md) y las respuestas en bruto en `src/server/llm/fixtures/gemini/recorded/`.

**Verificación en producción** (con `RUNS_PER_DAY=15` temporal, porque ya había 6 runs del día):
1. **Peticiones de D14:** `pnpm eval:plan` con el contexto real de `crm-demo`: NIF (2 tareas), buscador (2), facturas vencidas (1) y contacto (2, con `e2e/pages.ts`). Todas viables, válidas a la primera y con criterios que se comprueban en la vista previa. El run #11 planificó además el NIF en producción.
2. **Feedback en el plan** (run #11): «El NIF debe ser obligatorio y validarse con el formato español: 8 dígitos y una letra». La revisión 2 lo hace obligatorio, con la regex `^[0-9]{8}[A-Za-z]$` y NIF válidos en el seed. Aprobada, siguió con el mock: PR [crm-demo#9](https://github.com/daboy-dev/crm-demo/pull/9), 2 commits, vista previa con 24/24 E2E, aprobación final, merge y `done`.
3. **Fuera de alcance** (run #12): «Cambia el workflow de GitHub Actions…» acabó en `rejected` con el motivo «requiere modificar los workflows de GitHub Actions (`.github/workflows/**`)…», sin rama `run/12` ni PR.
4. **Sin repetir llamadas:** con «Simular caída tras planificar», el paso cayó después de guardar el plan; el sweep lo reanudó al caducar el lease y el evento muestra «de la caché, sin llamar de nuevo», con `llm_calls` aún en 1. El run #11 terminó con 6 llamadas contadas (2 de Gemini y 4 del mock) en `LLM_CALLS_PER_RUN`.
5. **Línea de tiempo:** cada llamada muestra modelo, tokens y latencia, por ejemplo `gemini-3.6-flash · llamada · 5303 → 983 tokens · 27,3 s` ([captura](./evals/h4-run-11-timeline.jpg)).

**Cuota de Gemini gastada:** 11 peticiones respondidas, todas de `gemini-3.6-flash` (8 del eval y 3 de producción), de las 40 diarias de Flash. Unas 8 más no llegaron a generar respuesta (400, 503 y 504).

**Qué salió mal y qué se corrigió:**
- **`thinkingLevel: MINIMAL`:** `gemini-3.8-flash` lo rechaza con un 400 (los tipos del SDK lo aceptan). El proveedor prueba MINIMAL y, ante ese 400 concreto, repite con LOW y lo recuerda para el modelo.
- **Gemini saturado:** `gemini-3.8-flash` respondió 503 («high demand») y otro modelo 504 (DEADLINE_EXCEEDED). Ahora 500, 503 y 504 pasan al siguiente modelo de la lista sin marcarlo como agotado; si todos fallan, el paso falla y el sweep lo reintenta. Por eso todas las respuestas vinieron de `gemini-3.6-flash`.
- **Criterios que no se pueden comprobar:** en la primera ronda del eval, tres planes tenían un criterio sobre el código (una columna del esquema, una consulta, una función de `dates.ts`) marcado como `e2e`. El prompt dice ahora que Testing solo ve el DOM y las capturas; en la segunda ronda todos los criterios se ven en la vista previa.
- **Plan antiguo durante la replanificación:** mientras se preparaba la revisión 2, la tarjeta del plan mostraba el resumen de la 1. Ahora muestra «El Orquestador está preparando la revisión N».
- **Sweep con la pestaña oculta:** como en H3, la caída simulada esperó a que la pestaña volviera a estar visible para reanudarse (D22).
- **Pendiente para H5:** la revisión 2 del NIF pide a Develop que ejecute `pnpm db:generate`, algo que Develop no puede hacer (solo escribe archivos). El prompt de Develop tendrá que pedir la migración SQL y el snapshot escritos a mano, o el Orquestador no debe pedir comandos.

**Hecho por el humano:** `LLM_PROVIDER_ORCHESTRATOR=gemini` en Vercel, `vercel env pull` en local y `RUNS_PER_DAY=15` temporal (hay que quitarlo para volver a 5).

**Resultado:** H4 hecho. Transcripción en [`sesiones/09-h4-orquestador.md`](./sesiones/09-h4-orquestador.md).

**Siguiente paso:** H5 · Develop con `GeminiProvider`.

## Sesión 10 · Planificación de H5 (Project de Claude) · 24/11/2026

**Objetivo:** decidir cómo trabaja Develop con Gemini antes de abrir Claude Code, empezando por lo pendiente de H4: la revisión 2 del NIF pedía a Develop ejecutar `pnpm db:generate`, algo que Develop no puede hacer.

**Cómo fue:**
- Se actualizaron en el Project las copias de `CLAUDE.md`, `PROCESO.md` y `DECISIONES.md` con las del repo tras H4.
- Se trató primero cómo llegan al repo las migraciones cuando Develop cambia el esquema.

**Qué cambió por el camino:**
- Claude propuso dos salidas: que Develop escribiera a mano la migración SQL y el snapshot de Drizzle, o que el Orquestador no pidiera nada que necesitara comandos.
- El humano descartó las dos: el Orquestador nunca debe pedir comandos; Develop cambia el código y `src/db/schema.ts`, y una action del PR ejecuta `drizzle-kit generate` y sube un commit con la migración si hay cambios.
- Claude detalló lo que eso implica y el humano lo aprobó:
  - El run espera a la action y adopta el commit de la migración como cabeza.
  - Cuando cambia el esquema, la iteración cuesta dos builds.
  - La action no tiene secrets, instala sin scripts y Develop no puede tocar `drizzle/**`, `drizzle.config.ts`, `package.json` ni `pnpm-lock.yaml`.
  - Solo hay cambios de esquema que añaden, para que `drizzle-kit` no haga preguntas en CI.

- **Contexto de Develop:** Claude propuso que viera la tarea, `AGENTS.md`, el árbol, `schema.ts` y los archivos previstos. El humano pidió añadir los imports de esos archivos, para ver sus tipos, y archivos que ya existan como modelo también cuando la tarea crea algo nuevo, para que Develop trabaje siempre igual. Claude lo concretó: imports locales a un nivel, un campo `references` en cada tarea del plan que elige el Orquestador, y un tope de unos 150 KB (D32 y extra de D28).
- **Errores de compilación:** el `deployment_status` no trae el error del build. Claude planteó leer el log con la API de Vercel o ampliar la action de D31 con la comprobación de tipos y el lint en un artifact. El humano eligió lo segundo (D33).
- Al separar en `pr-check.yml` el job que escribe del que comprueba, Claude vio un hueco en D31: `drizzle-kit` ejecuta el `schema.ts` de Develop con un token que puede escribir, y `master` no tenía protección. Se añade un ruleset que exige PR en `master` (extra de D31).

- **Contrato de Develop:** Claude propuso archivos completos, mensaje de commit, notas y un campo `evidence` obligatorio por criterio, y que una respuesta cortada por `MAX_TOKENS` hiciera fallar el paso. El humano corrigió dos cosas: Develop no debe decidir qué se comprueba (las pistas son opcionales y Testing evalúa todos los criterios del plan), y una tarea que no cabe debe volver al Orquestador para dividirse. Claude concretó la división (modo `split`, los mismos criterios repartidos, una sola vez por tarea, hasta 6 tareas) y el humano aprobó que no vuelva a pasar por él mientras los criterios no cambien (D34 y extras de D21, D28 y D29).

- **Tiempos de Develop:** Claude vio que el paso `developing` no cabía en los 300 s de Vercel con llamadas de uno o dos minutos, y que con un lease de 90 s una llamada de 150 s acabaría duplicada por el sweep. Se pasa a una llamada por invocación y un lease mayor que el timeout (D35).
- **Cuota y proveedores:** el humano propuso un proyecto de AI Studio por agente para repartir la cuota y recordó que Groq debía ser el respaldo. Claude comprobó los términos:
  - Los de las APIs de Google piden no saltarse los límites, así que se queda un solo proyecto.
  - Los de Gemini solo permiten servicios de pago cuando la aplicación se ofrece a usuarios del Espacio Económico Europeo. Claude recomendó activar la facturación; el humano decidió seguir en la capa gratuita por ser una prueba técnica, y queda anotado como riesgo aceptado (extra de D26).
  - Groq gratis tiene 8.000 tokens por minuto: vale de respaldo para el Orquestador, pero no para Develop. Se generaliza la lista de modelos a una cadena de `proveedor:modelo` que salta los eslabones donde la petición no cabe (D36).

**Resultado:** D31–D36 aceptadas, con extras en D21, D26, D28, D29 y D31.

**Criterio de H5:**
- **Antes de producción, `pnpm eval:develop`** (a mano y gasta cuota, como `eval:plan`): se repite `pnpm eval:plan`, porque los planes guardados no llevan `references` (D32). Develop resuelve las tareas de cada plan de D14, la salida se aplica sobre un clon local de `crm-demo` en `base_sha` y se hace lo mismo que `pr-check` (`drizzle-kit generate`, `tsc` y lint). Salidas y resultados se guardan en `docs/evals/`. Unas 11 llamadas; mejor a primera hora, tras el reinicio de las 9:00.
- **En producción:**
  1. **NIF (cambia el esquema):** un commit por tarea más el de la migración de `github-actions[bot]`, `pr-check` en verde, vista previa que compila con los 24 E2E existentes (Testing sigue siendo el mock), el campo visible en la vista previa y la columna en producción tras aprobar y fusionar.
  2. **Página de contacto (sin cambio de esquema):** sin commit de migración, un solo build por iteración y la página nueva en las capturas por estar en `e2e/pages.ts`. La UI muestra los archivos leídos, referencias incluidas.
  3. **Error de compilación:** con la casilla «Simular error de tipos», que inyecta un error en la salida de la iteración 1, `pr-check` devuelve el error y la iteración 2 lo corrige sin esperar al build de Vercel.
  4. **Tarea demasiado grande:** con la casilla «Simular MAX_TOKENS», el Orquestador real divide la tarea con los mismos criterios, sin pasar por el humano, y el run sigue.
  5. **Seguridad y repetición:** un push directo a `master` falla por el ruleset; una salida que sobrescribe un archivo no visto acaba en la reparación (Vitest con respuestas grabadas); con una caída simulada tras la llamada de Develop, el paso se reanuda sin repetir la llamada ni el commit.
  6. **Groq:** una llamada real del Orquestador con la cadena forzada a `groq:` en `eval:plan` da un plan válido. En CI, con respuestas grabadas, el salto de un eslabón donde la petición no cabe y los 429 de Groq.
- Las simulaciones van en el formulario, como las de H3 y H4, porque esperar a que Gemini se equivoque o se corte no es reproducible.

**Hecho por el humano** (25/11/2026):
- Ruleset en `crm-demo` que exige PR para `master`.
- Cuenta de Groq y `GROQ_API_KEY` en Vercel.

**Siguiente paso:** sesión 11 de Claude Code (H5), en `crm-demo` (`pr-check.yml`, `AGENTS.md`) y `crm-agents`.
## Sesión 11 · H5 · Develop con `GeminiProvider` (Claude Code) · 25/11/2026

**Objetivo:** Develop escribe código real con Gemini (D31–D36): un PR que compila en su vista previa, con la migración generada por `pr-check` cuando cambia el esquema.

**Cómo fue:**
- Claude propuso un plan en bloques y el humano aprobó cada uno antes de seguir.
- **`crm-demo`** (PR [crm-demo#10](https://github.com/daboy-dev/crm-demo/pull/10)): `pr-check.yml` con tres jobs (extra de D31) y `AGENTS.md` con las reglas de Develop: sin comandos, cambios de esquema que solo añaden y rutas que no se tocan.
- **`crm-agents`** (PR [crm-agents#1](https://github.com/daboy-dev/crm-agents/pull/1)):
  - Cadena `proveedor:modelo` por agente con `GeminiClient` y `GroqClient`, salto de los eslabones donde la petición no cabe y ajustes por agente (D35, D36).
  - Contexto de Develop (D32) y contrato de D34: archivos completos y nunca uno existente que no haya visto.
  - Modo `split` y estado `awaiting_check` (D34, D33). Una llamada de Develop por invocación (D35).
  - Resultados de `pr-check` en `pr_checks` y casillas «Simular error de tipos» y «Simular MAX_TOKENS».
  - Migraciones 0004 y 0005, aplicadas en producción con el OK del humano.
  - 289 tests de Vitest.
- **Evals:**
  - `pnpm eval:plan` se repitió con `references` (D32), con Gemini y con la cadena forzada a Groq: 4 de 4 planes válidos con `openai/gpt-oss-120b`, unos 5.500 tokens de entrada.
  - `pnpm eval:develop` aplicó la salida de Develop sobre un worktree de `crm-demo` y pasó las comprobaciones de `pr-check`: 4 de 4 en verde a la primera iteración ([`evals/DEVELOP.md`](./evals/DEVELOP.md)).

**Verificación en producción:**
1. **NIF** (run #13, [crm-demo#12](https://github.com/daboy-dev/crm-demo/pull/12)): un commit por tarea más `chore(db): generate migration…` de `github-actions[bot]`, `pr-check` en verde, 24/24 E2E y el campo en las capturas. Tras aprobar y fusionar, el build de producción de `crm-demo` (`drizzle-kit migrate && next build`) pasó con la columna nueva. ✅
2. **Contacto** (run #14, [crm-demo#13](https://github.com/daboy-dev/crm-demo/pull/13)): sin commit de migración, un solo build, la página en las capturas a 1280 y 390 px, 26/26 E2E. La UI muestra los archivos leídos, referencias incluidas. ✅
3. **Error de tipos:**
   - En el run #15 el bucle funcionó: `pr-check` devolvió `TS2322` y Develop recibió el error en la iteración 2.
   - La iteración 2 no llegó a hacerse porque Gemini respondió 503 en todos los modelos y el run acabó en `failed` (se corrigió, ver abajo).
   - El run #16 se bloqueó por saturación antes de la iteración 1 y se reintentó con Anthropic en la cadena (D37).
     - La iteración 1 la escribió Flash-Lite, que volvió a responder. `pr-check` devolvió el error simulado (`TS2322`) y otro real de Flash-Lite, un import vacío (`TS2307`).
     - La iteración 2 la hizo `claude-sonnet-5-5`: corrigió los dos errores y pasó el buscador a un componente cliente.
     - `pr-check` en verde y 26/26 E2E, sin esperar al build de Vercel para el error ([crm-demo#15](https://github.com/daboy-dev/crm-demo/pull/15), fusionado). ✅
4. **MAX_TOKENS** (run #17, facturas vencidas, [crm-demo#16](https://github.com/daboy-dev/crm-demo/pull/16)):
   - La primera llamada de Develop simuló el corte.
   - El Orquestador dividió la tarea en 2 subtareas con los mismos criterios (revisión 2), sin pasar por el humano: `isOverdue` en `src/lib/dates.ts` y la página de facturas.
   - El run siguió solo hasta 26/26 E2E y el merge. ✅
5. **Seguridad y repetición:**
   - Un push directo a `master` falla por el ruleset, tanto por SSH con la cuenta del humano como por la API con el `GH_TOKEN` del panel: «Changes must be made through a pull request» (422). ✅
   - La reparación ante una salida que sobrescribe un archivo no visto está cubierta en Vitest. ✅
   - **Caída tras el commit** (run #17, en el mismo run que el criterio 4): el sweep reanudó el paso al caducar el lease.
     - Las salidas de Develop salieron de `agent_steps` (`cached: true`) y `llm_calls` no subió.
     - El PR tiene exactamente los 2 commits. ✅
6. **Groq:** plan válido con la cadena forzada a Groq (`eval:plan`). Los tests con respuestas grabadas cubren el salto de un eslabón donde la petición no cabe y los 429. ✅

**Qué salió mal y qué se corrigió:**
- **`drizzle-kit generate` sale con 0** cuando no puede preguntar (renombrar una columna en CI). `pr-check` daba por buena la migración. Ahora exige el mensaje de éxito y ninguna línea que empiece por `Error`. Se probó con un PR de prueba que renombraba una columna ([crm-demo#11](https://github.com/daboy-dev/crm-demo/pull/11), cerrado).
- **Runs en `action_required`:** el push de `github-actions[bot]` lanza `pr-check` y CI, que GitHub deja esperando aprobación. El panel los ignora; el resultado que cuenta es el del job `check` del run que hizo el commit.
- **Respuesta grabada obsoleta:** la de `plan-ok` listaba `drizzle/0004_client_nif.sql`, ahora prohibida para Develop. Se volvieron a grabar las respuestas.
- **Gemini saturado (503) en todos los modelos:** el run #15 gastó sus 3 intentos de D22 y acabó en `failed`. Arreglo ([crm-agents#2](https://github.com/daboy-dev/crm-agents/pull/2)): si ningún eslabón responde y alguno estaba saturado, el error es `Overloaded`. El paso se aplaza 90 s sin gastar intentos y, tras 30 minutos en el mismo estado, el run pasa a `blocked` con el botón de reintentar (extra de D26). Comprobado con el run #16.
- **Sin modelos para Develop el 25/11:**
  - `gemini-3.8-flash` y `gemini-3.6-flash` agotaron su cuota diaria (eval y runs #13–#16).
  - `gemini-3.5-flash-lite` respondió 503 durante más de una hora. Se reprodujo en local con la petición exacta del run #16 y también con una mínima, así que el fallo está en Google y no en la petición.
  - Groq no puede ser respaldo de Develop con su capa gratuita (extra de D36).
- **Sweep con la pestaña oculta (D22):** con el panel en segundo plano, el run #15 estuvo 13 minutos con el lease caducado. En el #16 los reintentos de 90 s se separaron hasta 15 minutos. Es la limitación conocida de D22; no se cambia en H5.
- **Ruido en la línea de tiempo:** cada reintento por saturación registra otra vez «lee 8 archivos». Pendiente: registrar el contexto solo cuando cambia.
- **Eval de `facturas-vencidas`:** la primera ejecución falló en `tsc` (`TS7053` en `status-badge.tsx`) y pasó al repetirla. El JSON guardado es el de la segunda; el fallo queda anotado aquí.
- **Límite de la verificación:** la `DATABASE_URL` de `.env.local` de `crm-demo` es la de desarrollo, así que la columna en producción se comprobó por el build de producción, que aplica las migraciones antes de compilar.
- **Notas para H6:**
  - En el run #15 el Orquestador escribió un criterio sobre el código, no sobre la vista previa.
  - En el run #14 Develop leyó `src/app/(auth)/login/actions.ts` como import de `nav-links`. Es correcto, pero se lleva parte del presupuesto de contexto.

**Hecho por el humano:**
- `GROQ_API_KEY` en `.env.local` y en Vercel, y `LLM_PROVIDER_DEVELOP=gemini` en producción.
- Login en el panel, aprobación de planes y aprobaciones finales.
- Merges de los PRs de `crm-agents` y de `crm-demo#10`.
- Clave de Anthropic en `.env.local` y en Vercel.

**Resultado:** H5 hecho. Los 6 criterios comprobados en producción. Transcripción en [`sesiones/11-h5-develop.md`](./sesiones/11-h5-develop.md).

**Siguiente paso:** H6 · Testing con un modelo real.

## Sesión 12 · Planificación de H6 (Project de Claude) · 25/11/2026

**Objetivo:** decidir cómo trabaja Testing con un modelo real antes de abrir Claude Code.

**Cómo fue:**
- Se actualizaron en el Project las copias de `CLAUDE.md`, `PROCESO.md` y `DECISIONES.md` con las del repo tras H5.
- Se trató primero cómo se comprueban los criterios `e2e` nuevos. Hasta ahora Actions solo ejecutaba los tests que ya existían y hacía capturas, así que nada comprobaba lo que pedía cada plan.

**Qué cambió por el camino:**
- Claude planteó tres opciones: una instantánea del DOM que lee Testing, specs de Playwright escritos por Testing, o pasos declarativos que ejecuta un spec fijo de `crm-demo`. Recomendó la tercera, porque es la única que comprueba interacciones sin ejecutar código de un LLM. El humano la eligió (D38).
- Sobre quién escribe los pasos, Claude planteó que lo hiciera Testing en una llamada por revisión del plan, o el Orquestador dentro del plan. El humano eligió Testing: es el único agente que testea.

- **Veredicto:** Claude propuso que los criterios `e2e` los decida el ejecutor y no el LLM, que los `visual` los decida el LLM con las capturas, y que haya un `needs_human` para lo que no se ve. El humano lo aceptó, pero dejó solo criterios `e2e` por ahora: lo visual lo revisa él en la aprobación final. Testing solo llama al LLM para escribir los pasos y para explicar los fallos, y Develop no ve la lista de pasos (D39).

- **Cadena y límites:** como Testing ya no ve imágenes, Groq vuelve a valer para su cadena y va antes que Anthropic. El fallo provocado se simula desde el panel, como el error de tipos de H5, y `LLM_CALLS_PER_RUN` sube a 16 (D40).
- **Peticiones de demo agotadas:** las cuatro de D14 (NIF, buscador, facturas vencidas y contacto) ya están fusionadas en `master` desde H5. Hacen falta peticiones nuevas para H6 y H7.

**Resultado:** D38–D40 aceptadas. El Whiteboard del plan, que se había quedado en H4, se actualizó desde un chat abierto en su propia página, porque desde el Project no se puede editar.

**Criterio de H6:**
- **Antes de producción, `pnpm eval:testing`** (a mano y gasta cuota): se repite `pnpm eval:plan` con las peticiones nuevas, porque los criterios ahora llevan sus `data-testid`, y Testing escribe los pasos de cada plan. Todo valida con Zod y se guarda en `docs/evals/`. Una ejecución con la cadena forzada a `groq:` también da pasos válidos.
- **En producción:**
  1. **Run sin fallos:** el plan lleva los `data-testid` de cada criterio, Testing escribe los pasos en una sola llamada, `e2e/criteria/run-<id>.json` entra en la cadena de commits sin un build extra, `results.json` trae un test por criterio en escritorio y a 390 px, y no hay ninguna llamada más de Testing. Tras el merge, el JSON queda en `master`.
  2. **Fallo corregido:** con «Simular fallo de criterio», el criterio falla en la iteración 1, Testing explica el fallo con el paso y el `ariaSnapshot`, y Develop lo corrige en la iteración 2 sin ver la lista de pasos.
  3. **Fallo que se bloquea:** con «Simular fallo persistente», la tarea pasa a `blocked` tras 3 iteraciones y el humano decide.
  4. **Regresión:** en el run siguiente, el JSON del criterio 1 se ejecuta también y sale en `results.json`.
  5. **Seguridad:** se rechaza una salida de Develop que escribe en `e2e/criteria/**` o en `e2e/criteria.spec.ts`, y también un plan con un criterio `visual` (Vitest con respuestas grabadas). Los pasos no admiten selectores CSS ni URLs absolutas (Vitest).
  6. **Repetición:** con una caída simulada tras escribir los pasos, el paso se reanuda sin volver a llamar a Testing, y las llamadas cuentan contra el tope de 16.

**Pendiente del humano:**
- Peticiones de demo nuevas: las propuso Claude a petición del humano (extra de D14). En H6: el filtro de facturas para el criterio 1 (y el 4 en el run siguiente), las notas del cliente para el criterio 2 y duplicar un presupuesto para el criterio 3. La página de resumen queda para el run completo de H7.
- `LLM_PROVIDER_TESTING=gemini` y `LLM_CALLS_PER_RUN=16` en Vercel cuando el código esté listo.
- En el repo: pasar los apartados de D37 y del push de prueba de la sesión 08 a la sesión 11, añadir a D10 un extra que remita a D37, actualizar la línea de LLM del Stack en `CLAUDE.md` y comprobar que `RUNS_PER_DAY` ha vuelto a 5.

**Siguiente paso:** sesión 13 de Claude Code (H6), en `crm-demo` (ejecutor, `AGENTS.md` y rutas protegidas) y `crm-agents`.

## Sesión 13 · H6 · Testing con un modelo real (Claude Code) · 25–26/11/2026

**Objetivo:** Testing comprueba los criterios `e2e` de cada plan en la vista previa con pasos declarativos y un ejecutor fijo (D38), explica los fallos a Develop (D39) y lo hace con su propia cadena (D40).

**Cómo fue:**
- Claude propuso el plan por bloques y el humano lo aprobó.
- **`crm-demo`:**
  - Ejecutor `e2e/criteria.spec.ts` ([crm-demo#17](https://github.com/daboy-dev/crm-demo/pull/17)), protegido en `AGENTS.md` y `paths.ts`.
  - Tres arreglos que salieron de los runs: [#18](https://github.com/daboy-dev/crm-demo/pull/18), [#20](https://github.com/daboy-dev/crm-demo/pull/20) y [#22](https://github.com/daboy-dev/crm-demo/pull/22).
- **`crm-agents`** ([crm-agents#5](https://github.com/daboy-dev/crm-agents/pull/5)):
  - Contratos de los pasos y de la explicación, con `stepsSchemaFor` y `explainSchemaFor`.
  - `data-testid` por criterio en el plan, y el mapa de `crm-demo` en los prompts.
  - `ensureSteps` en una invocación propia, el JSON al final de la cadena de commits y el veredicto del ejecutor (`criteria.ts`).
  - `agent_steps.scope` para guardar por separado los pasos y cada explicación.
  - Casillas «Simular fallo de criterio» y «Simular fallo persistente», y migración 0006, aplicada en producción con el OK del humano.
- **Prettier (D41):** el panel formatea lo que escribe Develop, para que `format:check` de `crm-demo` siga en verde tras cada merge.
- **Eval:** `pnpm eval:testing` dio 4 de 4 planes y pasos válidos ([`evals/TESTING.md`](./evals/TESTING.md)).
  - Los pasos los escribió Groq (`openai/gpt-oss-120b`), con unos 3.100 tokens de entrada y menos de 3 s.
  - La primera ejecución sacó páginas que no existían, `data-testid` inventados y `expectCount` con `min: 0`. Se añadieron el mapa de `crm-demo` y reglas al validador.

**Verificación en producción:**
1. **Run sin fallos** (run #20, filtro de facturas, [crm-demo#23](https://github.com/daboy-dev/crm-demo/pull/23)):
   - Plan con `data-testid` y pasos en una llamada (Groq).
   - El JSON entró en la cadena de commits sin despliegue extra, con los resultados de cada criterio en escritorio y a 390 px.
   - Ninguna llamada de explicación, 4 llamadas en total, y `run-20.json` está en `master`. ✅
2. **Fallo corregido** (run #23, página de resumen, [crm-demo#26](https://github.com/daboy-dev/crm-demo/pull/26)):
   - `pr-check` devolvió la iteración 1 por un error real de Develop, mientras la simulación renombraba `summary-detail`.
   - En la iteración 2 los dos criterios fallaron en la vista previa. Testing (una llamada) lo explicó con el paso que fallaba (`expectVisible summary-detail`) y leyó bien el `ariaSnapshot`.
   - En la iteración 3, Develop puso el `data-testid` en el contenedor sin ver los pasos: 50 de 50 tests y 6 llamadas.
   - El fallo llegó en la iteración 2 y no en la 1, porque `pr-check` gastó la primera. ✅
3. **Fallo que se bloquea** (run #24, recuento de presupuestos del cliente):
   - El criterio falló en la iteración 1 y Testing lo explicó.
   - En las iteraciones 2 y 3 la simulación deshizo el arreglo, así que no hubo commit (D34).
   - La tarea pasó a `blocked` con 7 llamadas y la decisión volvió al humano. ✅
4. **Regresión** (run #21, notas del cliente, [crm-demo#24](https://github.com/daboy-dev/crm-demo/pull/24)): sus resultados incluyen los criterios del run #20 en los dos tamaños, todos en verde. Los runs #22 y #23 también ejecutaron los JSON anteriores. ✅
5. **Seguridad** (Vitest): se rechazan una salida de Develop que escribe en `e2e/criteria/**` o en `e2e/criteria.spec.ts`, un plan con un criterio `visual` (respuesta grabada), selectores CSS, JavaScript y URLs absolutas. ✅
6. **Repetición:**
   - En Vitest, un paso reanudado lee los pasos guardados y no gasta ninguna llamada; los pasos y cada explicación tienen su propia clave.
   - En producción, el run #21 se reanudó tras guardar los pasos sin volver a llamar a Testing, y las llamadas de Testing cuentan contra el tope de 16 (runs #23 y #24).
   - No se hizo una caída simulada justo después de escribir los pasos. ✅ (parcial en producción)

**Qué salió mal y qué se corrigió:**
- **Run #18 (cancelado):**
  - `expectText` con `all` comprobaba la lista antes de que el filtro la actualizara ([crm-demo#20](https://github.com/daboy-dev/crm-demo/pull/20)).
  - La explicación de Testing contradecía el `ariaSnapshot`. Ahora el prompt le pide mirarlo antes de culpar al código ([crm-agents#6](https://github.com/daboy-dev/crm-agents/pull/6)).
- **Run #19 (cancelado):**
  - `select` no admitía la opción de value vacío ([crm-demo#22](https://github.com/daboy-dev/crm-demo/pull/22) y [crm-agents#7](https://github.com/daboy-dev/crm-agents/pull/7)).
  - Siguiendo una explicación mala, Develop quitó `"use client"` y falló el build de Vercel. Los errores de build de Vercel no llegan a Develop: es una limitación conocida.
- **Run #21:**
  - Gemini respondió 400 «too many states» con el esquema de los pasos ([crm-agents#9](https://github.com/daboy-dev/crm-agents/pull/9)).
  - A Develop se le exigía `nav-clientes` aunque su tarea no tocaba el menú ([crm-agents#10](https://github.com/daboy-dev/crm-agents/pull/10)).
  - La simulación no encontraba `testId: "client-notes"` porque solo buscaba comillas dobles ([crm-agents#11](https://github.com/daboy-dev/crm-agents/pull/11)).
  - Antes, la simulación renombraba un `data-testid` que ya existía ([crm-agents#8](https://github.com/daboy-dev/crm-agents/pull/8)).
- **Run #22 (duplicar presupuesto):** `pr-check` devolvió la iteración 1 y la simulación, que era solo de esa iteración, se perdió. Ahora dura hasta que Testing juzga la primera vista previa ([crm-agents#12](https://github.com/daboy-dev/crm-agents/pull/12)). La función salió bien y se fusionó.
- **Run #24:**
  - Groq escribió `click` sobre `client-row`, que no navega, y `expectText` con `{{any}}`. Con esos pasos el criterio habría fallado sin la simulación. El validador rechaza ahora las dos cosas.
  - En las iteraciones sin cambios, la línea de tiempo decía «Develop no ha cambiado ningún archivo», aunque quien deshacía el arreglo era la simulación. Ahora lo dice así.
- **Aprobaciones con la versión vieja:** si el run había cambiado mientras la página estaba abierta, el botón no hacía nada y el humano tenía que recargar.
- **Scripts temporales `.mts`:** rompían `typecheck`. Se pasaron a `.mjs` sin seguimiento y se borraron al cerrar.

**Limitaciones que quedan:**
- Los errores de build de Vercel no vuelven a Develop, solo los de `pr-check`.
- `sweep()` necesita una pestaña de `/runs` visible (D22).
- Los planes de Flash-Lite son flojos: a veces nombran en la descripción solo parte de los `data-testid` del criterio.

**Hecho por el humano:**
- `LLM_PROVIDER_TESTING=gemini` en Vercel.
- Login en el panel, aprobaciones de planes y finales, rechazos con feedback y cancelaciones.
- Merges de todos los PRs de `crm-agents` y `crm-demo`.

**Resultado:** H6 hecho. Los criterios 1 a 5 están comprobados en producción, y el 6 en Vitest y en parte en producción. Transcripción en [`sesiones/13-h6-testing.md`](./sesiones/13-h6-testing.md).

**Siguiente paso:** H7 · panel completo. La página de resumen, que estaba reservada para H7, se usó en el criterio 2 y ya está en `master`, así que H7 necesita otra petición.
