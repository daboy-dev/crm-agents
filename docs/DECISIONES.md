# Decisiones

Registro de decisiones de arquitectura (formato ADR corto). Se toman en el Project de Claude dedicado a la prueba y se implementan con Claude Code. Cada entrada indica la fecha, el contexto, las opciones, la decisión y sus consecuencias.

---

## D1 · Develop escribe código real mediante PRs
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Contexto:** la prueba pide que el agente Develop haga las tareas de desarrollo. En Vercel no se puede editar código ni recompilar en tiempo de ejecución.

**Opciones:**
- A. CRM declarativo: Develop edita una especificación JSON en la base de datos. Es seguro y rápido, pero no escribe código.
- B. Develop crea una rama y un PR en el repo del CRM, y Vercel genera una vista previa por PR.
- C. Develop genera componentes como texto y se ejecutan en un iframe aislado.

**Decisión:** B. La prueba pide código y es como se trabaja en un proyecto real. Claude recomendó inicialmente la A por seguridad y velocidad; se descartó porque no cumple el requisito literal.

**Consecuencias:**
- Cada iteración tarda lo que un build de Vercel (minutos).
- Hace falta un token de GitHub en el servidor.
- Hay que limitar el número de iteraciones por tarea.
- El historial de PRs de los agentes queda visible para los evaluadores.

## D2 · El CRM vive en un repo y un proyecto de Vercel separados (`crm-demo`)
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Contexto:** si Develop escribe en el mismo repo que el panel de agentes, un cambio mal hecho puede romper la herramienta que lo controla.

**Decisión:**
- `crm-agents`: el panel, los agentes y su base de datos.
- `crm-demo`: el CRM (clientes, presupuestos, facturas), que es lo que los agentes modifican.

**Consecuencias:**
- El token de GitHub solo tiene acceso a `crm-demo`.
- Hay dos proyectos en Vercel.
- El README de `crm-agents` enlaza a `crm-demo` y a sus PRs.

## D3 · Token de GitHub de permisos finos limitado a `crm-demo`
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:** un PAT de permisos finos con acceso solo a `crm-demo` (permisos *Contents* y *Pull requests* de lectura y escritura). Se guarda solo en las variables de entorno de Vercel.

**Mejora futura:** una GitHub App con tokens de instalación de corta duración.

## D4 · Todos los eventos entran por un webhook de GitHub
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Contexto:** las funciones de Vercel Hobby duran como máximo 300 s, así que no pueden esperar en vivo a que termine un build.

**Decisión:**
- Los runs son una **máquina de estados persistida en Neon**.
- Los pasos avanzan con eventos: `pull_request`, `deployment_status` (Vercel publica ahí el estado de cada vista previa) y `workflow_run` (Actions).
- Un único endpoint de webhook de GitHub, con firma HMAC verificada.

**Consecuencias:**
- Cada paso debe poder repetirse sin efectos duplicados.
- Hace falta un log de eventos en el que solo se añaden filas, que la UI lee por polling.

## D5 · El navegador de testing corre en GitHub Actions, no en Vercel
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Contexto:** Chromium sin interfaz es demasiado pesado para una función del plan gratuito de Vercel.

**Decisión:**
- Cuando una vista previa está lista, un workflow de Actions en `crm-demo` lanza Playwright contra su URL: tests E2E y capturas a 1280 px y 390 px.
- Los resultados vuelven al panel.
- El agente Testing (LLM) evalúa los criterios de aceptación con esos resultados y capturas.

**Consecuencias:**
- `crm-demo` debe ser público para que los minutos de Actions sean gratis.
- Máximo 3 iteraciones Develop↔Testing por tarea; al llegar al tope, la tarea pasa al humano.

## D6 · Vistas previas de `crm-demo` sin protección de Vercel
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:** se desactiva la Deployment Protection de las vistas previas de `crm-demo` para que el panel pueda mostrarlas en un iframe y Actions pueda acceder. Es aceptable porque solo contiene datos ficticios. El CRM tiene su propio login de demo.

## D7 · Bases de datos en dos proyectos de Neon
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:**
- Proyecto de Neon `crm-agents`: runs, tareas, eventos y resultados.
- Proyecto de Neon `crm-demo`: los datos del CRM, con una **rama de Neon por vista previa** gracias a la integración Neon–Vercel. Así Develop puede cambiar el esquema (por ejemplo, añadir el NIF) sin tocar producción.

**Comprobado (23/11/2026):** el plan gratuito da 100 proyectos y 10 ramas por proyecto. El límite de ramas se gestiona en D11.

## D8 · Capa de LLM intercambiable
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:**
- Una interfaz `LLMProvider` con `GeminiProvider` (capa gratuita) y `MockProvider` (respuestas deterministas para CI y como plan B si se agota la cuota).
- Salidas de los agentes en JSON validado con Zod.
- Presupuesto de llamadas por run y reintentos con espera ante el error 429.

## D9 · Aprobación humana en dos puntos
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:** el cliente aprueba el **plan** del orquestador antes de que se escriba código y la **vista previa final** antes del merge. Su feedback vuelve al orquestador, que replanifica sobre la misma rama.

## D10 · Infraestructura gratuita y seguridad básica
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:**
- Next.js (App Router) en Vercel Hobby.
- Login con un usuario de prueba y un middleware que protege todas las rutas.
- Límite de runs al día.
- Ninguna clave en el repo: solo un `.env.example`.

## D11 · Limpieza de ramas de Neon y un solo run activo
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Contexto:** el plan gratuito de Neon permite 10 ramas por proyecto. Cuando se llenan, la integración no puede crear la rama de la vista previa y el despliegue de Vercel falla antes de compilar. Con agentes abriendo PRs, el tope se alcanza rápido.

**Decisión:**
- Integración **Neon-Managed** en el proyecto de Vercel `crm-demo`, con borrado de la rama de Neon cuando se borra la rama de Git.
- En GitHub, `crm-demo` borra automáticamente la rama al hacer merge.
- El panel borra la rama de Git (y con ella la de Neon) cuando un run se rechaza o se abandona.
- Como máximo **1 run activo** a la vez y 3 PRs abiertos.

**Consecuencias:**
- Nunca se pasa de unas pocas ramas a la vez, lejos del tope de 10.
- Las peticiones simultáneas se encolan; la UI debe mostrar la cola.

**Extra (24/11/2026, sesión 03):**
- **Comprobado en H1:** la integración no borra la rama de Neon cuando se borra la de Git. Solo la marca como obsoleta, y la borra en el **siguiente despliegue de vista previa**. Mientras no haya vistas previas nuevas, las ramas obsoletas se acumulan con su compute activo.
- **Workflow nuevo:** `crm-demo` tiene `.github/workflows/neon-cleanup.yml`. Al cerrarse un PR, con merge o sin él, borra la rama `preview/<rama>` con `neondatabase/delete-branch-action`. Usa los secrets `NEON_API_KEY` y `NEON_PROJECT_ID` y no falla si la rama ya no existe. La limpieza automática de la integración se mantiene como respaldo.
- **Para el panel:** basta con cerrar el PR o borrar su rama de Git (GitHub cierra el PR y se dispara el workflow).

## D12 · `crm-demo` con el mismo stack y una estructura pensada para un LLM
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Contexto:** quien modifica `crm-demo` es el agente Develop (Gemini). Cuanto más predecible sea el código, más fiables serán sus cambios.

**Decisión:**
- Next.js 16 (App Router), TypeScript estricto, Drizzle, Neon y Tailwind, sin librería de componentes.
- Estructura plana: una carpeta por entidad (`clientes`, `presupuestos`, `facturas`) con su página, server actions y queries.
- Un `AGENTS.md` en `crm-demo` con las convenciones; Develop lo recibe en cada tarea.
- `data-testid` estables en los elementos clave, para los tests de Playwright.

## D13 · Las migraciones se aplican en el build
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:** el comando de build de Vercel es `drizzle-kit migrate && next build`. Cada vista previa migra su propia rama de Neon y producción migra al hacer merge.

**Consecuencias:**
- Las ramas de Neon se copian de producción, así que traen los datos de prueba sin volver a sembrarlos.
- Una migración que falla rompe el build, y eso se ve como un fallo del despliegue que Testing puede devolver a Develop.

## D14 · Datos de prueba y huecos funcionales a propósito
**Fecha:** 23/11/2026 · **Estado:** aceptada

**Decisión:**
- Datos de prueba realistas: unos 15 clientes y presupuestos y facturas en todos los estados.
- El CRM deja fuera a propósito funciones fáciles de pedir y de comprobar visualmente: NIF de clientes, buscador, facturas vencidas marcadas y página de contacto.

**Consecuencias:** los evaluadores tienen peticiones de demo preparadas con resultados visibles en la vista previa.

**Extra (25/11/2026, sesión 12):** las cuatro peticiones de D14 ya están fusionadas en `master` desde H5. Para H6 y H7, el humano pidió a Claude una lista nueva, con funciones fáciles de comprobar en el DOM y que cubran los casos del motor:
- **Filtro de facturas por estado:** un desplegable en `/facturas` que filtra la lista. Es interacción sin cambio de esquema.
- **Notas internas del cliente:** un campo de texto en el formulario que se ve en el detalle. Cambia el esquema, así que hay commit de migración.
- **Duplicar un presupuesto:** un botón en el detalle que crea un borrador con las mismas líneas. Es interacción con escritura.
- **Página de resumen:** una página nueva, `/resumen`, con el número de clientes, los presupuestos enviados y el importe pendiente de cobro. Es una página nueva en `e2e/pages.ts`.

Los pasos de Testing (D38) no deben depender de cifras exactas del seed: las vistas previas acumulan los datos que crean `write-flow.spec.ts` y los propios pasos. Una cifra solo se comprueba si se ha creado en el mismo test.

## D15 · Actions arranca con el `deployment_status` de Vercel
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** hay que lanzar Playwright cuando una vista previa de `crm-demo` está lista, sin que el panel tenga que esperar ni disparar nada.

**Decisión:**
- Workflow `preview-e2e.yml` en `crm-demo`, con `on: deployment_status`. Solo se ejecuta si el estado es `success` y el entorno empieza por `Preview`, porque Vercel a veces añade el nombre del proyecto.
- La URL de la vista previa sale de `github.event.deployment_status.target_url`.
- Un grupo de `concurrency` por rama cancela la ejecución anterior si llega un commit nuevo.

**Consecuencias:**
- El PAT no necesita permiso para lanzar workflows.
- Hay que comprobar que los eventos `deployment_status` están activos en la configuración Git del proyecto de Vercel `crm-demo`.

**Extra (24/11/2026, sesión 05):**
- **Comprobado en H2:** Vercel no creaba GitHub Deployments hasta activar sus eventos de despliegue en el proyecto `crm-demo`.
- Vercel pone el **sha** en `deployment.ref` y deja el `payload` vacío: el evento no trae la rama. El workflow tiene un job `resolve` que la busca con `GET /commits/{sha}/branches-where-head`, y el job `e2e` usa `concurrency` por esa rama. `meta.json.ref` lleva la rama.
- El entorno llega como `Preview` (y `Production` en `master`). El despliegue de producción también lanza el workflow con los jobs saltados; el panel ignora las ejecuciones `skipped`.
- El evento `workflow_run` sí trae `head_branch` y el número de PR.

## D16 · Los resultados vuelven al panel por `workflow_run` y un artifact
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** los workflows de `deployment_status` ejecutan el código del commit desplegado, y los PRs de Develop salen del mismo repo, no de un fork. Cualquier secreto de `crm-demo` está al alcance de un workflow o un test modificado por Develop.

**Opciones:**
- A. Actions sube las capturas a Vercel Blob y hace un POST firmado al panel. Es más directo, pero guarda en `crm-demo` el token de Blob y el secreto de ingesta.
- B. Actions deja los resultados en un artifact. El panel, al recibir el webhook `workflow_run`, descarga el artifact con el PAT y procesa los resultados.

**Decisión:** B.
- El artifact `e2e-results` contiene `results.json` (reporter JSON de Playwright), `meta.json` (sha, PR, rama, URL) y las capturas. Caduca en 1 día.
- El PAT de D3 añade el permiso *Actions: lectura*.

**Consecuencias:**
- `crm-demo` no guarda ningún secreto del panel, y todo sigue entrando por el webhook firmado (D4).
- Unos segundos más por descargar y descomprimir el artifact en el panel.
- Los secretos que sí están en `crm-demo` (`NEON_API_KEY` y las credenciales de demo) siguen expuestos a código de Develop. **Regla para H5:** el panel rechaza cualquier cambio de Develop que toque `.github/**` o los helpers de `e2e/`.

## D17 · Webhook idempotente que responde rápido
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** GitHub da por fallida una entrega que tarda más de 10 s en responder, y puede reenviar entregas.

**Decisión:**
- `POST /api/webhooks/github` verifica la firma HMAC, inserta el evento en `github_events` con `X-GitHub-Delivery` como clave única (`on conflict do nothing`) y responde 200. El procesamiento sigue en `after()`.
- Los eventos sin procesar (`processed_at` nulo) se pueden reprocesar a mano.
- Tablas mínimas: `github_events` (solo se añaden filas), `previews` (sha, PR, rama, URL y estado), `test_reports` y `screenshots`. Se relacionan por el sha del commit; en H3 los runs se enlazan por rama y PR.

**Consecuencias:** reenviar una entrega desde GitHub no duplica nada.

## D18 · Capturas en Vercel Blob y flujo de escritura contra vistas previas
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- El panel sube las capturas a un store de Vercel Blob conectado a `crm-agents`. Hobby (comprobado 24/11/2026): 1 GB de almacenamiento, 10 GB de transferencia y 2.000 operaciones avanzadas (`put()`) al mes.
- El store `crm-agents-blob` es **privado** y usa autenticación OIDC (`BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`), sin token estático de lectura y escritura.
- El panel sirve las capturas con una ruta propia, `GET /api/screenshots/[id]`, protegida por el login (D19), que lee el blob en el servidor y lo devuelve con caché privada. Las URLs de Blob nunca llegan al navegador.
- Capturas en JPEG a 1280 px y 390 px de las páginas listadas en `e2e/pages.ts`.
- El flujo de escritura de H1 se sube al repo: escribe en la rama de Neon de la vista previa y se salta si la URL es la de producción.

**Consecuencias:** con unas 6 capturas por ejecución caben más de 300 ejecuciones al mes.

## D19 · El login del panel se adelanta a H2
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:** el login de D10 se implementa en H2 copiando la sesión HMAC de `crm-demo`, con sus tests, para que `/pipeline` no quede pública. El proxy protege todo salvo `/login`, `/api/health` y `/api/webhooks/github`.

**Consecuencias:** H3 queda solo para el motor de runs.

## D20 · Un PR por run, un commit por tarea y un build por iteración
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** cada build de una vista previa tarda minutos y hay como mucho 3 PRs abiertos y 10 ramas de Neon (D11).

**Opciones:**
- A. Un PR por tarea. Choca con el límite de PRs y de ramas de Neon.
- B. Un PR por run y un build por tarea. Son N builds de minutos por iteración.
- C. Un PR por run, un commit por tarea y un solo build por iteración.

**Decisión:** C.
- Cada run tiene la rama `run/<id>`. El nombre sale del id, así que repetir un paso no crea ramas nuevas.
- Develop hace cada tarea en su propia llamada al LLM. El panel crea un commit por tarea con la Git Data API y actualiza la ref una sola vez, así que Vercel compila solo la cabeza.
- Testing evalúa los criterios de cada tarea con el mismo informe de Playwright. Las tareas que fallan vuelven a Develop, con un máximo de 3 iteraciones por tarea (D5).

**Consecuencias:** el historial del PR muestra un commit por tarea y cada iteración cuesta un solo build.

## D21 · Estados del run y de la tarea
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- Run: `queued → planning → awaiting_plan_approval → developing → awaiting_preview → testing → awaiting_final_approval → merging → done`.
  - Desde `testing` se vuelve a `developing` o se pasa a `blocked` (decide el humano: reintentar o abandonar).
  - El feedback del cliente en el plan o en la vista previa final devuelve el run a `planning` sobre la misma rama (D9).
  - Estados finales: `done`, `rejected`, `cancelled` y `failed`.
- Tarea: `pending → developing → testing → passed | failed | blocked`.
- Las transiciones son una función pura `transition(estado, evento) → { estado, efectos }`, probada con una tabla en Vitest.
- `run_events` es un log en el que solo se añaden filas y es la línea de tiempo de la UI (D4).

**Extra (24/11/2026, sesión 10):** transición nueva `developing → planning` con el evento `task_too_large` (D34), sin pasar por `awaiting_plan_approval`. Estado de tarea nuevo, `split`: final y sustituido por sus subtareas.

## D22 · Pasos con compare-and-swap, lease y sweep, sin cron
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** en Hobby, el cron de Vercel solo se ejecuta una vez al día (comprobado 24/11/2026), así que no sirve para recuperar pasos que se caen.

**Decisión:**
- Cada transición es un `UPDATE … WHERE id = $1 AND version = $2` más el insert en `run_events`, en una `sql.transaction([...])` no interactiva de Neon. Si no cambia ninguna fila, otro proceso ya avanzó el run y el paso no hace nada.
- Los pasos con LLM se ejecutan en `after()` y reservan el run con `lease_until`.
- Recuperación: el polling de la UI (cada 5 s) llama a un `sweep()` barato que relanza los pasos con el lease caducado. También hay un botón para reintentar.
- Efectos que se pueden repetir:
  - Antes de crear el PR se busca uno abierto para la rama.
  - Solo se hace commit si la ref sigue en el sha esperado.
  - La salida de cada llamada al LLM se guarda en `agent_steps` por (run, tarea, iteración, agente), así que un reintento no vuelve a llamar al LLM.
- El procesamiento de H2 avisa al run que tenga esa rama **y el mismo sha**; los informes de commits anteriores se ignoran.
- Un `deployment_status` en `failure` o `error` cuenta como build roto y vuelve a Develop (D13).
- Si en 15 minutos no llega la vista previa, el run pasa a `blocked`.

**Consecuencias:** un doble clic en «Aprobar» o un webhook reenviado no duplican nada.

**Extra (24/11/2026, sesión 07):**
- **CAS en una sola sentencia.** En lugar de un `sql.transaction([...])` de varias sentencias, cada transición es un `WITH upd AS (UPDATE runs … WHERE id AND version [AND lease_token] RETURNING …)` del que cuelgan el insert de eventos (uno solo, para que conserven el orden) y los cambios de `tasks`. Así los eventos y las tareas solo se escriben si el run cambió; con varias sentencias, un insert «condicionado a la versión nueva» se colaría cuando otro proceso hubiera ganado esa versión.
- **Lease:** 90 s en el propio run (`lease_until`, `lease_token`). Un paso que falla conserva el lease y el sweep lo reintenta cuando caduca; a los 3 fallos seguidos el run pasa a `failed`.
- **Commits que se pueden repetir:** antes de mover la rama se guarda en el run el sha objetivo de la cadena de commits; un reintento lo reutiliza si la rama sigue en el sha esperado.
- **Comprobado en H3:** Vercel publica `failure` (o `inactive`) en el primer despliegue de una rama nueva y, en el mismo GitHub Deployment, `success` segundos después. Un `deployment_status` en `failure` ya no vuelve a Develop al momento: queda como nota y el sweep lo da por build roto si a los 3 minutos no lo ha sustituido un `success`.
- **Comprobado en H3:** el informe de una vista previa puede llegar antes de que el run la espere (pasó con la caída simulada). Al entrar en `awaiting_preview` el motor busca ya el informe o el build roto de su sha, sin esperar al sweep.
- El polling (y con él el sweep) solo corre con la pestaña visible; la recuperación sin cron necesita el panel abierto.

## D23 · Cola y límites en la base de datos
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- Un índice único parcial sobre los runs que no están en `queued` ni en un estado final garantiza un solo run activo (D11). Al terminar un run se arranca el más antiguo de la cola.
- Los runs que esperan aprobación cuentan como activos. El `sweep` los cancela tras 24 h, y hay un botón para cancelar, para que un run abandonado no bloquee la cola.
- Límites: N runs al día (D10) y un máximo de llamadas al LLM por run (D8). Al llegar a cualquiera de los dos, el run pasa a `blocked`.

**Extra (24/11/2026, sesión 07):** el límite diario (`RUNS_PER_DAY`, 10 por defecto, día UTC) lo aplica el formulario: no se crea el run, porque un run bloqueado ocuparía la cola. El de llamadas al LLM (`LLM_CALLS_PER_RUN`, 30) sí bloquea el run.

## D24 · `MockProvider` con escenarios sobre GitHub real
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- En H3 todo es real (rama, commits, PR, vista previa, Actions y merge) salvo el LLM.
- El escenario se elige en el formulario, que solo lo muestra cuando el proveedor es el mock: `ok`, `fail-once`, `blocked` y `forbidden`.
- El Develop simulado escribe `agent-runs/<run>/<tarea>.md`, que no afecta a la app. Los runs `ok` hacen merge real en `master` de `crm-demo`.
- El Testing simulado sigue el escenario, pero si el E2E real falla, marca fallo igualmente.
- Los contratos Zod se definen ya: plan, salida de Develop (archivos completos y mensaje de commit por tarea) y veredicto de Testing. En H4–H6 solo cambian el proveedor y los prompts.
- La regla de D16 se aplica ya en la capa que hace los commits: se rechaza cualquier ruta bajo `.github/**` o en los helpers de `e2e/`. El escenario `forbidden` lo comprueba.

**Consecuencias:** `master` de `crm-demo` acumula archivos `agent-runs/`, inofensivos.

**Extra (24/11/2026, sesión 07):**
- El escenario `forbidden` hace que la tarea 2 escriba `.github/workflows/agent.yml`. La tarea y el run pasan a `blocked` al momento, sin commit ni build: una violación de seguridad no se reintenta.
- Rutas prohibidas: `.github/**`, `e2e/helpers.ts` y `e2e/screenshots.spec.ts` (las que lista el `AGENTS.md` de `crm-demo`), además de rutas absolutas o con `..`.
- El formulario del mock tiene la casilla «Simular caída tras el commit»: el paso de Develop falla una vez justo después de mover la rama, para comprobar en producción que un lease caducado se reanuda sin repetir commits.

## D25 · UI mínima de runs
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- `/runs`: formulario de petición nueva, cola y runs recientes.
- `/runs/[id]`: línea de tiempo por agente, tareas con su estado e iteración, enlaces al PR y a la vista previa, y botones de aprobar o rechazar con feedback, reintentar y cancelar. Polling cada 5 s, como `/pipeline`.
- `/pipeline` se queda como vista de depuración. La UI completa llega en H7.

## D26 · `GeminiProvider` con una lista de modelos por agente
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** Google ya no publica las cuotas gratuitas y remite a AI Studio. Comprobado el 24/11/2026 en el proyecto de la clave:

| Modelo | RPM | TPM | RPD |
|---|---|---|---|
| `gemini-3.8-flash` | 5 | 250K | 20 |
| `gemini-3.6-flash` | 5 | 250K | 20 |
| `gemini-3.5-flash-lite` | 15 | 250K | 500 |

Las cuotas son por modelo y por proyecto (no por clave), y las diarias se reinician a medianoche del Pacífico (las 9:00 en Madrid). Un run real gasta entre 5 y 10 llamadas, así que con un solo modelo Flash caben 2–4 runs al día, contando los de los evaluadores.

**Opciones:**
- A. Solo Flash. Mejor calidad, pero la cuota se agota en pocos runs.
- B. Solo Flash-Lite. Cuota de sobra, peor calidad.
- C. Una lista de modelos por agente: cuando uno agota su cuota diaria, se pasa al siguiente.

**Decisión:** C.
- SDK `@google/genai` con `generateContent`, `responseMimeType: "application/json"` y un JSON Schema generado desde el contrato Zod. La respuesta se valida con Zod; si no valida, se hace **una** llamada de reparación con el error, que cuenta en el presupuesto. La doc de Google tiene ejemplos que no coinciden con los tipos del SDK actual: se siguen los tipos instalados.
- Orquestador: `GEMINI_MODELS_ORCHESTRATOR=gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite`. Develop y Testing tendrán su lista en H5 y H6.
- Proveedor por agente: `LLM_PROVIDER_ORCHESTRATOR=gemini`; Develop y Testing siguen en `mock` hasta H5 y H6. El selector de escenario del formulario se muestra mientras alguno de los dos sea el mock.
- **429 por minuto:** el paso no espera dentro de la función. Aplaza el lease hasta el `retryDelay` de la respuesta y el sweep lo retoma. No cuenta como fallo para los 3 de D22.
- **429 diario:** se pasa al siguiente modelo de la lista. Si no queda ninguno, el run pasa a `blocked` con «Cuota de Gemini agotada; se renueva a las 9:00» y el botón de reintentar.
- Timeout de 60 s por llamada y razonamiento al mínimo en el Orquestador.
- `agent_steps` guarda el modelo, los tokens y la latencia de cada llamada, y la línea de tiempo los muestra.
- Límites nuevos (D23): `RUNS_PER_DAY` = 5 y `LLM_CALLS_PER_RUN` = 12.
- `GEMINI_API_KEY` es de un proyecto de Google **sin facturación**, para no salir de la capa gratuita. En esa capa Google puede usar los prompts; es aceptable porque los datos son ficticios.

**Consecuencias:**
- 40 llamadas al día con Flash entre los dos modelos, y 500 con Flash-Lite de respaldo.
- Plan B si todo se agota: `LLM_PROVIDER=mock` (D8).

**Extra (24/11/2026, sesión 09):**
- **Qué cuenta en `LLM_CALLS_PER_RUN`:** cada petición que el modelo responde, reparación incluida, y se suma en el momento. Los 429 y los errores del servidor no cuentan. El tope se comprueba antes de cada petición.
- **Lease:** antes de cada petición se renueva a 90 s, porque una llamada y su reparación pueden pasar de un minuto cada una.
- **Modelos agotados:** se apuntan en `app_meta` con la fecha del Pacífico, y el resto del día se saltan sin gastar una petición.
- **Razonamiento:** `gemini-3.8-flash` rechaza `thinkingLevel: MINIMAL` con un 400 (comprobado). Se prueba MINIMAL y, si el modelo lo rechaza, LOW, y se recuerda por modelo.
- **Modelo saturado:** un 500, 503 («high demand») o 504 pasa al siguiente modelo de la lista sin marcar el anterior como agotado. Si todos fallan, el paso falla y lo reintenta el sweep (cuenta para los 3 fallos de D22). Comprobado en H4: `gemini-3.8-flash` dio 503 varias veces y todas las respuestas llegaron de `gemini-3.6-flash`.
- El 429 por minuto añade 2 s de margen al `retryDelay`. Si la respuesta no trae `retryDelay`, se espera un minuto.

**Extra (24/11/2026, sesión 10):**
- **Términos de la capa gratuita, riesgo conocido y aceptado.** Los términos adicionales de la API de Gemini (en vigor desde el 23/03/2026) solo permiten servicios de pago cuando una aplicación se pone a disposición de usuarios del Espacio Económico Europeo, y el panel lo usan los evaluadores desde España. Claude recomendó activar la facturación (cumple los términos y quita el tope diario). El humano decidió seguir en la capa gratuita porque es una prueba técnica con muy pocos usuarios. Se documenta para que quede claro que se decidió sabiéndolo.
- **Un proyecto de AI Studio por agente:** el humano lo planteó para repartir la cuota, que es por proyecto. Claude señaló que los términos de las APIs de Google (sección 2d) piden no intentar saltarse los límites, y crear proyectos solo para multiplicar la cuota gratuita encaja con eso. Se queda un solo proyecto.
- La lista de modelos por agente pasa a ser una cadena de `proveedor:modelo` con Groq como respaldo (D36).

**Extra (25/11/2026, sesión 11):** con todos los eslabones saturados (500, 503 o 504), el paso ya no falla. El error es `Overloaded`: se aplaza 90 s sin contar para los 3 fallos de D22 y, si el run lleva 30 minutos en el mismo estado, pasa a `blocked` con el botón de reintentar. Motivo: el 25/11 Gemini respondió 503 en todos los modelos durante más de una hora y el run #15 acabó en `failed` por algo ajeno a él.

## D27 · Qué ve el Orquestador
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- Recibe la petición, el `AGENTS.md` de `crm-demo`, el árbol de rutas del repo (Git Trees API), `src/db/schema.ts` y `e2e/pages.ts`.
- Todo se lee en el sha de `master` al empezar el run, y ese sha se guarda en el run como base de la rama `run/<id>`.
- No lee el código completo: planifica, no programa. Así el prompt es pequeño y estable.
- La UI muestra qué archivos ha leído el agente.

**Extra (24/11/2026, sesión 09):** el árbol excluye `agent-runs/`, que crece con cada run simulado. El sha se guarda en `runs.base_sha` la primera vez que se planifica y todas las revisiones lo reutilizan. El contexto solo se lee si `agent_steps` no tiene ya el plan.

## D28 · Contrato del plan
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:** el contrato Zod de H3 se amplía:
- `feasible: false` y un motivo: el Orquestador rechaza peticiones fuera del CRM, que toquen `.github/**` o los helpers de `e2e/`, o que necesiten claves o servicios de pago. El run pasa a `rejected` sin crear rama ni PR (transición nueva `planning → rejected`).
- `summary` para el cliente y `assumptions`, en español.
- De 1 a 4 tareas, cada una con:
  - título y descripción para Develop;
  - archivos previstos, comprobados ya contra `paths.ts` (D16);
  - criterios de aceptación con id y tipo: `e2e` (se comprueba en el DOM con `data-testid`) o `visual` (se comprueba con las capturas).
- Si la petición crea una página, la tarea incluye añadirla a `e2e/pages.ts` para que salga en las capturas.

**Extra (24/11/2026, sesión 09):**
- Es un objeto plano y no una unión discriminada, porque Gemini lo lleva mejor. Las reglas que un JSON Schema no expresa van en un `superRefine` y vuelven en la llamada de reparación: motivo obligatorio y sin tareas si no es viable, rutas de `paths.ts`, ids `c1`, `c2`… únicos en el plan y, con el árbol, una página nueva que no está en `e2e/pages.ts`.
- Los criterios deben poder comprobarse en la vista previa: el DOM para `e2e` y las capturas para `visual`, nunca el código. Lo pide el prompt tras ver criterios sobre el esquema en el primer eval.
- Un plan no viable en una replanificación tras la vista previa también lleva a `rejected`, y la limpieza cierra el PR.

**Extra (24/11/2026, sesión 10):** cada tarea lleva un campo nuevo, `references`, con 1 a 3 archivos que ya existen y sirven de modelo a Develop (D32). Por ejemplo, `src/app/clientes/page.tsx` y sus actions para una página nueva, o el formulario de cliente para un campo nuevo. Los elige el Orquestador, que ya ve el árbol. El `superRefine` comprueba que existen en el árbol, y si alguno falla va a la llamada de reparación.

**Extra (24/11/2026, sesión 10):** tras una división (D34) el plan puede pasar de 4 tareas, con un tope de 6.

## D29 · Replanificación con feedback
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- **Feedback en el plan** (aún no hay código): el Orquestador hace un plan completo que sustituye al anterior.
- **Feedback en la vista previa final:** el plan solo añade tareas nuevas o correctivas sobre la misma rama. El Orquestador recibe el plan anterior, el estado de cada tarea y el feedback.

**Extra (24/11/2026, sesión 09):** el modo lo decide `head_sha`: sin código en la rama es `replace` y con código es `amend`. Las tareas nuevas van en la revisión n+1, y Testing solo evalúa esas.

**Extra (24/11/2026, sesión 10):** tercer modo, `split`, que decide el evento `task_too_large` y no `head_sha` (D34). El Orquestador recibe la tarea que no cupo, sus archivos y el motivo, y devuelve de 2 a 3 subtareas que la sustituyen en la revisión n+1. No vuelve a pasar por el humano porque los criterios no cambian.

## D30 · Probar el Orquestador sin gastar cuota
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Decisión:**
- CI solo usa el mock y respuestas de Gemini grabadas (fixtures) para probar el parseo, la reparación, la lista de modelos y los dos tipos de 429.
- `pnpm eval:plan`, a mano: lanza las cuatro peticiones de D14 contra Gemini y guarda los planes en `docs/evals/` como prueba para los evaluadores.

## D31 · Develop cambia el esquema y una action de `crm-demo` genera la migración
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** en H4, la revisión 2 del plan del NIF pedía a Develop que ejecutara `pnpm db:generate`. Develop solo escribe archivos y no puede ejecutar comandos, y las migraciones de Drizzle (el SQL, el snapshot y el journal de `drizzle/`) las genera `drizzle-kit` a partir de `src/db/schema.ts`.

**Opciones:**
- A. Develop escribe a mano el SQL de la migración, el snapshot y la entrada del journal. *Propuesta inicial de Claude.*
- B. El Orquestador no pide nada que necesite comandos. *Propuesta inicial de Claude.*
- C. El Orquestador nunca pide comandos. Develop cambia el código y `src/db/schema.ts`, y una action del PR ejecuta `drizzle-kit generate` y, si hay cambios, sube un commit con la migración. *Propuesta del humano.*

**Decisión:** C. Develop solo toca el esquema, la migración la genera la herramienta y no el LLM, y el Orquestador vuelve a hablar solo de lo que se ve en la vista previa. A obligaba a Gemini a escribir a mano un snapshot de Drizzle, que es frágil. B dejaba fuera peticiones de D14 como el NIF.

**Cómo se aplica** (Claude lo detalló a partir de C y el humano lo aprobó):
1. **El run espera al commit de la migración.** Tras mover `run/<id>` a un sha X, el run no espera la vista previa hasta que llega el `workflow_run` de la action para X. El panel lee entonces la rama:
   - Si se ha movido a un hijo de X (el commit de la migración, Y), adopta Y como `head_sha` con un CAS.
   - Si no se ha movido, se queda con X.
   - Los informes de X se ignoran cuando hay Y: la app de X usa una columna que su rama de Neon todavía no tiene.
2. **Doble build cuando cambia el esquema.** Vercel compila X y después Y, así que esa iteración cuesta dos builds y no uno (D20). Se acepta en H5 porque solo pasa cuando cambia el esquema. Mejora futura: un *Ignored Build Step* que se salte el build si la migración está pendiente, después de comprobar qué `deployment_status` publica Vercel en ese caso.
3. **Seguridad de la action** (como en D16, el job ejecuta código de la rama de Develop, y aquí además con permiso de escritura):
   - El job no tiene ningún secret y solo tiene el permiso `contents: write`.
   - Instala con `pnpm install --frozen-lockfile --ignore-scripts` y llama a `drizzle-kit` directamente, no a un script de `package.json`.
   - `paths.ts` añade a las rutas prohibidas para Develop `drizzle/**` (las migraciones solo las escribe la action), `drizzle.config.ts`, `package.json` y `pnpm-lock.yaml`.
4. **`drizzle-kit generate` hace preguntas.** Ante un cambio ambiguo (renombrar una columna o borrarla y crear otra) pide una respuesta por consola, y en CI se quedaría colgado.
   - `AGENTS.md` de `crm-demo`: solo cambios de esquema que añaden; nada de renombrar ni borrar columnas.
   - Timeout corto en el job.
   - Si el job falla, el motor lo trata como build roto, con el mensaje del job, y la tarea vuelve a Develop.

**Consecuencias:**
- Develop no puede añadir dependencias, porque tampoco podría actualizar el lockfile. Para las peticiones de D14 no hace falta.
- El historial del PR muestra un commit por tarea y, si el esquema cambió, un commit de la migración de `github-actions[bot]`.
- Sin bucles: los commits hechos con `GITHUB_TOKEN` no lanzan otros workflows. Vercel sí despliega Y, porque despliega con su propia app de GitHub y no con Actions.
- Con un solo run activo (D11), `master` solo avanza con los merges de los runs, así que el journal de `drizzle/` no choca entre ramas.
- El prompt del Orquestador deja de pedir comandos; el de Develop explica que basta con cambiar `src/db/schema.ts`.

**Extra (24/11/2026, sesión 10):**
- La action es el job `migrate` del workflow `pr-check.yml` (D33). Es el único job con `contents: write`; la comprobación de tipos y el lint corren en otro job, sin permiso de escritura.
- **Hueco detectado:** `drizzle-kit` ejecuta `src/db/schema.ts`, que escribe Develop, con un token que puede escribir. Como `master` no tenía protección (sesión 06), un `schema.ts` malicioso, por ejemplo por una inyección en el prompt, podría hacer push directo a `master`. Se añade en `crm-demo` un **ruleset sobre `master` que exige PR**. El merge squash del panel por la API sigue funcionando porque es el merge de un PR. Lo configura el humano en GitHub.

**Extra (25/11/2026, sesión 11):**
- `pr-check.yml` tiene **tres jobs**, no dos: `generate` (solo lectura) ejecuta `drizzle-kit` y deja un parche como artifact; `commit` (`contents: write`, sin checkout del código de la rama ni ejecución) valida que el parche solo añade archivos de `drizzle/` con nombre de migración, o modifica `drizzle/meta/_journal.json`, y hace el commit; `check` comprueba tipos y lint. Así nada que escriba Develop se ejecuta con permiso de escritura.
- `drizzle-kit generate` sale con 0 aunque falle al no poder preguntar. `generate` exige su mensaje de éxito y ninguna línea que empiece por `Error`.
- El panel adopta el commit de la migración solo si `run/<id>` apunta a él y su padre es la cabeza que subió el motor.

## D32 · Qué ve Develop
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** Develop hace cada tarea en su propia llamada (D20) y escribe archivos completos (D24). Para escribir código que compile necesita ver los tipos que usa y cómo está hecho lo que ya existe.

**Opciones:**
- A. Solo la tarea, `AGENTS.md`, el árbol y el contenido de los archivos previstos, más `src/db/schema.ts`. *Propuesta inicial de Claude.*
- B. Lo mismo, más los imports de esos archivos y, siempre, archivos que ya existen y sirven de modelo, también cuando la tarea crea algo nuevo. *Propuesta del humano:* así Develop ve los tipos que importa y trabaja siempre igual, imitando algo que ya funciona.

**Decisión:** B. Develop recibe, por tarea:
- La tarea: título, descripción, archivos previstos, `references` (extra de D28) y criterios.
- El `AGENTS.md` de `crm-demo`, el árbol del repo y `src/db/schema.ts`.
- El contenido completo de los archivos previstos que ya existen. Un archivo previsto que no existe se trata como archivo nuevo.
- El contenido de las referencias.
- **Imports a un nivel** de los archivos previstos y de las referencias: solo los locales (relativos y `@/`), resolviendo `.ts`, `.tsx` e `index.ts`. No se leen paquetes de `node_modules` ni los imports de los imports.
- A partir de la iteración 2: los criterios que fallaron, el motivo de Testing y los errores de `pr-check` (D33).

Todo se lee en la **cabeza de `run/<id>`**, no en `base_sha`, para que una tarea vea lo que hicieron las anteriores.

**Tope de tamaño:** unos 150 KB de archivos. Si se pasa, primero se recortan los imports y luego las referencias; los archivos previstos nunca se recortan. Hay margen: el TPM es de 250K (D26).

**Consecuencias:**
- El prompt de Develop es más grande que el del Orquestador, pero estable: la forma de trabajar es siempre la misma.
- La UI muestra qué archivos ha leído Develop en cada tarea, como en D27.

## D33 · Los errores de compilación vuelven a Develop con `pr-check.yml`
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** si el build de la vista previa falla, el `deployment_status` solo trae una descripción genérica, sin el error. Sin el error, Develop no puede corregirlo, y el criterio de H5 es que el PR compile.

**Opciones:**
- A. Leer el log del build con la API de Vercel. Hace falta un token de Vercel en el panel, y esos tokens no se pueden limitar a un solo proyecto.
- B. Ampliar la action de D31 para que haga también la comprobación de tipos y el lint y deje los errores en un artifact que el panel descarga, con el patrón de D16.

**Decisión:** B (propuesta de Claude, elegida por el humano). Workflow `pr-check.yml` en `crm-demo`, en cada push a un PR, con dos jobs:
- **`migrate`** (`contents: write`, sin secrets): instala sin scripts, ejecuta `drizzle-kit generate` y, si hay cambios, hace el commit de la migración (D31).
- **`check`** (solo lectura, sin secrets): se ejecuta sobre la cabeza resultante, hace `tsc --noEmit` y lint, y deja `check.json` en el artifact `pr-check`. Lleva el sha comprobado, el sha del commit de la migración si lo hay y los errores, recortados. Va en un job aparte porque `next typegen` y ESLint cargan la configuración de la rama.

**En el panel:**
- Al recibir el `workflow_run` de `pr-check.yml`, descarga el artifact, adopta el commit de la migración como cabeza (D31) y, si hay errores, devuelve las tareas a Develop con ellos, sin esperar al build de Vercel. Gasta una iteración (D5).
- Si no hay errores, el run espera la vista previa como hasta ahora.
- Un `deployment_status` en `failure` sigue contando como build roto (extra de D22), como último recurso para errores que solo salen en Vercel, por ejemplo una migración que falla. En ese caso Develop solo recibe el mensaje genérico.

**Consecuencias:**
- Los errores de tipos llegan en un minuto o dos, antes que el build de Vercel, y sin ningún token nuevo.
- `crm-demo` sigue sin guardar ningún secreto del panel (D16).
- `.github/**` sigue prohibido para Develop, así que no puede cambiar el workflow.

## D34 · Contrato de Develop
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** D24 definió la salida de Develop (archivos completos y mensaje de commit por tarea) para el mock. Con Gemini hay que decidir qué puede escribir, cómo ayuda a Testing y qué pasa si la respuesta no cabe.

**Cómo se llegó:**
- **Propuesta inicial de Claude:** archivos completos, mensaje de commit, notas y un campo `evidence` obligatorio con una entrada por criterio, para decirle a Testing dónde mirar. Ante un `MAX_TOKENS`, el paso fallaba sin llamada de reparación.
- **Correcciones del humano:**
  - Las pistas de Develop son útiles, pero Develop no debe decidir qué se comprueba y qué no.
  - Una tarea que no cabe en la respuesta debe volver al Orquestador y dividirse en otras más pequeñas, según convenga.
- **Decisión final:** lo que sigue. Claude concretó la división y el humano aprobó que no vuelva a pasar por él mientras los criterios no cambien.

**Decisión:**
- **Salida por tarea:**
  - `files`: de 1 a 8 archivos con `path` y su contenido **completo**, sin diffs. Los LLM fallan con los números de línea y con los bloques de buscar y reemplazar, y la Git Data API pide el blob entero de todas formas.
  - `commitMessage`: en inglés, con formato Conventional Commits, comprobado con una regex.
  - `notes`: en español, para el humano y para Testing: qué ha hecho y qué ha supuesto.
  - `evidence` (opcional): pistas de dónde ha dejado cada cosa, por ejemplo un `data-testid` o una ruta.
- **Testing decide, no Develop:** Testing (H6) evalúa siempre **todos** los criterios del plan aprobado contra el informe y las capturas. Las pistas le ayudan a buscar, pero no cuentan como prueba: una pista que no se ve en el DOM o en las capturas no da nada por bueno.
- **Qué puede escribir:**
  - Nunca rutas prohibidas por `paths.ts` (D16 y D31).
  - Un archivo previsto, uno de su contexto (un import o una referencia, D32) o uno nuevo. **Nunca sobrescribe un archivo que existe y que no ha visto**, porque borraría a ciegas su contenido. Si lo intenta, la salida va a la llamada de reparación con ese error.
  - Los archivos fuera de los previstos se aceptan, y la UI los marca como «fuera del plan».
  - No borra archivos. Ninguna petición de D14 lo necesita.
- **Límites y casos raros:**
  - Como mucho 60 KB por archivo y `maxOutputTokens` configurado en la llamada.
  - Si todos los archivos que devuelve son idénticos a los actuales, no hay commit. En la iteración 1 es un error; en las siguientes cuenta como iteración fallida, con la nota «Develop no cambió nada».
  - Antes de cada commit, el panel normaliza los saltos de línea y añade una línea final si falta.
- **Respuesta cortada (`finishReason: MAX_TOKENS`) → la tarea se divide:**
  - El JSON llega incompleto y una reparación no lo arregla, así que no se repara. El run vuelve a `planning` en modo `split` (extras de D21 y D29).
  - El Orquestador devuelve de 2 a 3 subtareas que sustituyen a la original en la revisión n+1. La original queda en estado `split`.
  - **Los criterios se reparten pero no cambian:** el `superRefine` comprueba que cada criterio de la tarea original acaba en exactamente una subtarea y que no aparece ninguno nuevo. Las demás tareas del plan no se tocan.
  - **Sin nueva aprobación:** el alcance que aprobó el cliente es el mismo (D9) y la división es solo de organización. La línea de tiempo la muestra.
  - Las tareas que ya estaban hechas reutilizan su salida guardada en `agent_steps`.
  - Una tarea solo se divide una vez: si una subtarea vuelve a cortarse, se bloquea y decide el humano. Tras dividir, el plan puede llegar a 6 tareas (extra de D28). Las subtareas empiezan en la iteración 1.
  - La respuesta cortada y la llamada del Orquestador cuentan en `LLM_CALLS_PER_RUN`.

**Consecuencias:**
- El contrato Zod de Develop de D24 cambia: entran `notes` y `evidence`, y las reglas de rutas y de archivos vistos van en el `superRefine`, que necesita la lista de archivos del contexto.
- Una tarea demasiado grande no gasta iteraciones ni bloquea el run: se reorganiza sola.

## D35 · Tiempos, lease y modelos de Develop
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** una llamada de Develop devuelve archivos completos con su razonamiento y puede tardar uno o dos minutos, frente a los ~27 s del Orquestador en H4. El paso `developing` hacía todas las tareas seguidas en la misma función, y una función de Vercel dura como mucho 300 s.

**Decisión** (propuesta de Claude, aprobada por el humano):
- **Una llamada al LLM por invocación.** Cada invocación hace una sola llamada, sea de una tarea o de una reparación. La salida se guarda en `agent_steps` y el paso se vuelve a lanzar con `after()` para la siguiente. Cuando todas las tareas tienen salida, se hace la cadena de commits y la rama se mueve una sola vez (D20). Encaja con la caché por tarea de H3; solo cambia que el paso se trocea.
- **Timeout por agente:** 150 s para Develop; el Orquestador sigue con 60 s (D26).
- **El lease dura más que la llamada:** antes de cada petición se renueva al timeout del agente más 30 s, es decir, 180 s para Develop (antes eran 90 s fijos, extra de D26). Si no, el lease caducaría a mitad de una llamada larga y el sweep lanzaría otra igual en paralelo, gastando cuota dos veces.
- **Parámetros:** `thinkingLevel: LOW` (con el mismo retroceso por modelo de D26) y `maxOutputTokens` a 32K. En Gemini, los tokens de razonamiento cuentan dentro de ese límite; si se supera, la tarea se divide (D34).
- **Cadena de Develop:** `gemini:gemini-3.8-flash`, luego `gemini:gemini-3.6-flash` y, como último recurso, `gemini:gemini-3.5-flash-lite` (formato de D36). Si una tarea la resuelve Flash-Lite, la línea de tiempo lo marca, para que se vea que una iteración fallida puede venir de ahí.
- **Cuota:** es por modelo, así que el orden de las cadenas no da más llamadas; el límite real son las 40 llamadas diarias de Flash, compartidas por los tres agentes. Un run del NIF sin fallos gasta unas 4 (1 de plan, 2 de Develop y 1 de Testing en H6) y unas 7 con una iteración fallida: caben 5 o 6 runs reales al día, en línea con `RUNS_PER_DAY` = 5.
- `LLM_CALLS_PER_RUN` = 12 se mantiene. Queda justo con 3 iteraciones y alguna reparación o división, pero está para parar un run que no avanza. Se revisa en H6, cuando Testing sea real.

## D36 · Cadena de proveedores por agente, con Groq de respaldo
**Fecha:** 24/11/2026 · **Estado:** aceptada

**Contexto:** el humano recordó que Groq debía ser el respaldo de Gemini; por eso la capa de LLM es intercambiable (D8), aunque no constaba en este registro. La capa gratuita de Groq (comprobado 24/11/2026 en su tabla de límites; la cifra exacta de cada organización está en su consola) da, por ejemplo para `openai/gpt-oss-120b`, 30 peticiones por minuto, 1.000 al día, 8.000 tokens por minuto y 200.000 al día. Los límites son por organización y por modelo.

**Decisión** (propuesta de Claude al recoger la petición del humano):
- La lista de modelos de D26 pasa a ser una **cadena de `proveedor:modelo` por agente**: `LLM_CHAIN_<AGENTE>`, por ejemplo `gemini:gemini-3.8-flash,gemini:gemini-3.6-flash,groq:openai/gpt-oss-120b`. `GEMINI_MODELS_<AGENTE>` deja de usarse.
- Las reglas de D26 se aplican a cada eslabón: el 429 diario pasa al siguiente y se recuerda en `app_meta`; el 429 por minuto aplaza el lease; los 500, 503 y 504 pasan al siguiente sin marcarlo como agotado.
- **Eslabones que no caben se saltan:** cada eslabón sabe su límite de tokens por minuto. Si la petición estimada (entrada más `maxOutputTokens`) no cabe, se salta sin gastar una petición.
- `GroqProvider` usa la API compatible con OpenAI de Groq, con la misma interfaz `LLMProvider`, el contrato Zod y la llamada de reparación. Hay que comprobar en H5 si el modelo elegido acepta JSON Schema en `response_format`; si no, JSON mode más Zod y reparación.
- Variable nueva: `GROQ_API_KEY` (en `.env.example`, sin valor).

**Consecuencias:**
- **Groq sirve de respaldo real para el Orquestador** (~6K tokens por llamada en H4), no para Develop: su contexto de D32 puede llegar a unos 40K tokens, muy por encima de 8K por minuto. Para Develop solo entraría con un plan de pago de Groq.
- Los modelos de texto de Groq no ven imágenes: para Testing (H6) solo valdría con criterios `e2e`.
- `agent_steps` y la línea de tiempo muestran proveedor y modelo de cada llamada.
- Plan B si se agota todo: `LLM_PROVIDER=mock` (D8).

**Extra (25/11/2026, sesión 11):** comprobado en la consola de Groq de la organización: ningún modelo de texto de la capa gratuita pasa de 8.000 tokens por minuto (`openai/gpt-oss-120b`, `openai/gpt-oss-20b` y `qwen/qwen3.8-27b`; los de 15.000 son clasificadores `llama-prompt-guard`). La petición de Develop del run #16 (~7.000 tokens de entrada) dejaría menos de 1.024 de salida, así que la cadena la saltaría. Develop sigue solo con Gemini; si se queda sin modelos, el run se bloquea y se reintenta tras el reinicio de cuota.

## D37 · Anthropic como respaldo de pago de la cadena
**Fecha:** 25/11/2026 · **Estado:** aceptada

**Contexto:** el 25/11 Develop se quedó sin modelos: `gemini-3.8-flash` y `gemini-3.6-flash` agotaron su cuota diaria y `gemini-3.5-flash-lite` respondió 503 durante más de una hora. Groq no sirve para Develop en su capa gratuita (extra de D36). Los criterios de H5 quedaban parados hasta el día siguiente.

**Opciones:**
- A. Esperar al reinicio de la cuota de Gemini.
- B. Activar la facturación de Gemini (recomendación de Claude en la sesión 10, descartada entonces por el humano).
- C. Un tercer proveedor en la cadena de D36, con la interfaz común. *Propuesta del humano*, que tiene créditos de Anthropic.

**Decisión:** C, con `claude-sonnet-5-5`. Claude propuso `claude-opus-5-5`; el humano eligió Sonnet porque es una prueba técnica y basta con mostrar cómo se trabaja.
- `AnthropicClient` (`src/server/llm/anthropic.ts`) con el SDK oficial `@anthropic-ai/sdk`, `output_config.format` con el JSON Schema del contrato Zod (el SDK quita las restricciones que la API no admite) y `effort: low`. Zod y la reparación de la cadena siguen validando todo.
- Sin reintentos del SDK. Errores: 429 aplaza el paso con su `retry-after`; 529 y 5xx son saturación (extra de D26); 402 (sin crédito) se trata como cuota diaria agotada; 413 salta el eslabón; `stop_reason: max_tokens` es `OutputTruncated` y divide la tarea (D34).
- Va **detrás de Gemini en las tres cadenas** (y antes de Groq en la del Orquestador): Gemini sigue siendo el principal y Anthropic solo cobra cuando Gemini no responde. También vale para Testing en H6, porque ve imágenes.
- Límites de la clave comprobados en las cabeceras: millones de tokens por minuto, así que el eslabón nunca se salta por tamaño.
- Variable nueva: `ANTHROPIC_API_KEY` (en `.env.example`, sin valor). El humano fija un límite de gasto en la Console.

**Consecuencias:**
- Coste: la llamada de Develop del run #16 (12.670 tokens de entrada y 2.105 de salida, 12 s) cuesta unos 5 céntimos. Un run completo, menos de 0,50 $.
- Con Gemini caído, los runs siguen sin esperar al día siguiente. La línea de tiempo marca las llamadas de Claude como respaldo de pago.
- Al ser un servicio de pago, ese eslabón no tiene el problema de términos de la capa gratuita de Gemini (extra de D26).

## D38 · Testing comprueba los criterios `e2e` con pasos declarativos y un ejecutor fijo
**Fecha:** 25/11/2026 · **Estado:** aceptada

**Contexto:** `preview-e2e.yml` solo ejecuta los tests que ya existen y hace capturas. Los criterios `e2e` de cada plan describen comportamiento nuevo (el buscador filtra, un NIF inválido muestra un error), y muchos piden interactuar con la página. Hay que comprobarlos en la vista previa sin ejecutar código escrito por un LLM en un workflow que tiene a su alcance los secrets de `crm-demo` (D16).

**Opciones:**
- A. Instantánea del DOM (HTML o `ariaSnapshot`) de las páginas de `pages.ts`, que Testing lee junto con las capturas. Es barata, pero solo ve las páginas en reposo, y las interacciones quedan sin comprobar.
- B. Testing escribe specs de Playwright que ejecuta Actions. Cubre cualquier interacción, pero ejecuta código de un LLM en un workflow con secrets, un test mal escrito gasta iteraciones de Develop, y en un commit aparte cuesta un build más.
- C. Testing traduce cada criterio `e2e` a pasos en un JSON cerrado, y un spec fijo de `crm-demo` los ejecuta.

**Decisión:** C (propuesta de Claude, elegida por el humano).
- **Pasos:** `goto` (una página de `pages.ts` o una ruta relativa), `fill`, `click`, `expectVisible`, `expectText` y `expectCount`, siempre por `data-testid` y con `byTestId()`. Contrato Zod, sin selectores CSS, sin JavaScript y sin URLs absolutas.
- **Ejecutor:** `e2e/criteria.spec.ts` en `crm-demo`, escrito a mano y protegido como los helpers (`paths.ts` y `AGENTS.md`). Lee `e2e/criteria/*.json` y crea un test por criterio, con su id en el título, en escritorio y a 390 px. Sus resultados salen en el mismo `results.json` (D16).
- **Dónde va el JSON:** `e2e/criteria/run-<id>.json`. Lo escribe el panel en la misma cadena de commits que las tareas (D20), así que no hay build extra. Develop no puede escribir en `e2e/criteria/**`.
- **Quién lo escribe: Testing**, el único agente que testea. Hace una llamada por revisión del plan, justo después de aprobarla, y la salida se guarda en `agent_steps` y vale para todas las iteraciones. Una revisión `amend` (D29) solo añade los pasos de sus criterios nuevos. Una división (D34) no cambia los criterios, así que reutiliza los pasos. El Orquestador define qué se pide y Testing cómo se comprueba.
- **Los `data-testid` se fijan en el plan:** cada criterio `e2e` lleva los `data-testid` que va a necesitar (extra de D28). Develop tiene que usarlos: el `superRefine` de su salida comprueba que aparecen en los archivos que devuelve, y si falta alguno va a la llamada de reparación. Testing solo usa en sus pasos los `data-testid` del plan.
- **Prueba del fallo:** si un paso falla, el ejecutor guarda en el artifact el `ariaSnapshot` de la página. Testing lo usa para explicar a Develop qué falta.
- **Datos:** los pasos pueden crear datos. El ejecutor solo corre contra vistas previas, con la misma regla de host que `write-flow.spec.ts`, así que escribe en la rama de Neon de la vista previa.
- **Criterios `visual`:** Testing los sigue evaluando con las capturas y un modelo que ve imágenes.

**Consecuencias:**
- Las interacciones se comprueban sin ejecutar código generado.
- Develop no se corrige a sí mismo: los pasos salen de los criterios aprobados y no de su código (D34).
- Al fusionar, los JSON se quedan en `master` como pruebas de regresión. Un run posterior que rompa un criterio antiguo falla igual que un E2E de los que ya existían.
- En H6 hay que escribir el ejecutor y el contrato de los pasos, y actualizar `AGENTS.md`, `paths.ts` y el prompt del Orquestador.

## D39 · Veredicto de Testing y solo criterios `e2e` por ahora
**Fecha:** 25/11/2026 · **Estado:** aceptada

**Contexto:** con D38, los criterios `e2e` se comprueban de forma determinista en la vista previa. Falta decidir qué devuelve Testing, cuándo hace falta llamar al LLM y qué le llega a Develop cuando algo falla.

**Decisión** (propuesta de Claude, aprobada por el humano):
- **Solo criterios `e2e` por ahora.** El tipo `visual` sigue en el contrato del plan para más adelante, pero el `superRefine` lo rechaza y va a la llamada de reparación. El prompt del Orquestador pide que cada criterio se pueda comprobar en el DOM. Por ejemplo, «las vencidas se marcan en rojo» pasa a ser «la etiqueta de estado dice Vencida». Lo visual (el diseño, cómo se ve a 390 px) lo revisa el humano con las capturas en la aprobación final (D9).
- **El veredicto de cada criterio lo da el ejecutor, no el LLM.** Sale de `results.json` tal cual. Testing no puede dar por bueno un criterio cuyo test ha fallado, ni al revés.
- **Salida de Testing por criterio:** `{ id, task, verdict: pass | fail, reason, evidence }`. `reason` va en español y `evidence` lleva el paso que falló. El valor `needs_human` queda para cuando vuelvan los criterios `visual`.
- **Regresiones:** si falla un E2E de los que ya existían o el JSON de un run anterior (D38), Testing lo asigna a una tarea de esta revisión según los archivos que tocó, y esa tarea vuelve a Develop.
- **Llamadas al LLM:** una por revisión del plan, para escribir los pasos (D38), y otra en cada iteración con algún fallo, para explicarlo y asignar las regresiones. Si todo pasa, no hay llamada.
- **Qué recibe Develop en la iteración siguiente:** los criterios que fallaron, con su `reason`, el paso que falló y el fragmento del `ariaSnapshot`. Nunca la lista completa de pasos, para que programe para cumplir el criterio y no para pasar el test.

**Consecuencias:**
- Testing no necesita ver imágenes, así que Groq vuelve a valer para su cadena si la petición cabe en 8.000 tokens por minuto (extra de D36).
- Un run en el que todo pasa a la primera gasta una sola llamada de Testing.
- Las capturas siguen haciéndose y llegando al panel, pero para el humano, no para Testing.

## D40 · Cadena, simulaciones y límites de Testing
**Fecha:** 25/11/2026 · **Estado:** aceptada

**Decisión** (propuesta de Claude, aprobada por el humano):
- **Cadena de Testing:** `gemini:gemini-3.8-flash`, `gemini:gemini-3.6-flash`, `groq:openai/gpt-oss-120b` y `anthropic:claude-sonnet-5-5`, en ese orden. Groq va antes que Anthropic porque es gratis y las peticiones de Testing son pequeñas (D39). Si alguna no cabe en sus 8.000 tokens por minuto, la cadena lo salta (D36).
- **Ajustes:** timeout de 60 s y razonamiento bajo, como el Orquestador. Como mucho unos 2 KB de `ariaSnapshot` por cada fallo.
- **Simulaciones en el formulario**, como «Simular error de tipos»: el panel rompe la salida de Develop, porque esperar a que el LLM se equivoque no se puede reproducir.
  - «Simular fallo de criterio»: en la iteración 1, el panel quita de la salida de Develop uno de los `data-testid` del plan, después del `superRefine` y antes del commit. El criterio falla y en la iteración 2 Develop debe corregirlo.
  - «Simular fallo persistente»: lo mismo en todas las iteraciones. A la tercera, la tarea pasa a `blocked` y decide el humano (D5).
- **`LLM_CALLS_PER_RUN` sube de 12 a 16** (D26 y D35). Un run de 2 tareas con un fallo gasta unas 6 llamadas, y el peor caso con 3 iteraciones fallidas en las dos tareas llega a unas 10, sin contar reparaciones ni divisiones.

## D41 · El panel formatea con Prettier lo que escribe Develop
**Fecha:** 25/11/2026 · **Estado:** aceptada

**Contexto:** el código de Develop no pasa por Prettier. Al fusionar un run, `ci.yml` de `crm-demo` falla en `pnpm format:check` (en H6 hubo que formatear a mano `clientes/validation.ts` y `contacto/page.tsx`). De las 17 respuestas de Develop grabadas en H5, 6 no cumplían el formato.

**Opciones:**
- A. El job `commit` de `pr-check.yml` ejecuta `prettier --write` sobre los archivos del PR y lo sube en el commit del bot. Ese job tiene un token de escritura, y Prettier lee su configuración de la rama: un `prettier.config.mjs` escrito por Develop sería código ejecutado con ese token (D31). Además, el commit del bot es un despliegue más de Vercel.
- B. El panel formatea cada archivo antes del commit, en `prepareCommits`.

**Decisión:** B (propuesta de Claude).
- Prettier 3.10.1, la misma versión que el lockfile de `crm-demo`, pasa a ser una dependencia del panel con la versión fijada. Formatea el texto con las opciones de `crm-demo` (`.prettierrc.json` es `{}`) y nunca lee una configuración de la rama.
- Se formatean `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.json` y `.css`, salvo lo que ignora `.prettierignore` (el Markdown, `drizzle/meta/` y `e2e/criteria/`).
- Si Prettier no puede leer un archivo, se sube tal cual con una nota en la línea de tiempo: `pr-check` devolverá el error de sintaxis a Develop.
- Se formatea antes de las simulaciones de H5 y H6, y antes de comparar con el repo, así que una respuesta que solo cambia el formato no hace commit (D34).

**Consecuencias:**
- Sin código de la rama, sin job nuevo con permisos y sin build extra: el formato va en la misma cadena de commits (D20).
- Develop recibe en la iteración siguiente los archivos tal como quedaron en el repo.
- Si `crm-demo` cambia de versión de Prettier o de opciones, hay que cambiarlas también en el panel.
