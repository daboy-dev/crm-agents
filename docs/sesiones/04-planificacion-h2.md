# Sesión 04 · Planificación de H2 (Project de Claude) · 24/11/2026

Conversación «Hito 1 y sesión H2» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `DECISIONES.md`, `PROCESO.md`.*

El hito 1 está completado, aquí te dejo la nueva documentación. La nueva sesión también ha quedado ya en crm-agents. El CLAUDE.md de crm-agents marca que el h1 está en proceso, habría que marcarlo ya como terminado.

## ● Claude

Voy a actualizar los documentos del Project con las versiones nuevas y a marcar H1 como hecho en `CLAUDE.md`.

*Herramientas: lee `claude/CLAUDE.md` del Project; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; actualiza `claude/CLAUDE.md` en el Project; lee `claude/DECISIONES.md` del Project; lee `claude/PROCESO.md` del Project.*

The uploaded files are supersets of these; retrying the writes now.

*Herramientas: actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project.*

He actualizado los tres documentos del Project:

- **`DECISIONES.md` y `PROCESO.md`:** ahora son tus versiones nuevas, con la sesión 03, H1 marcado como hecho y el extra de D11 sobre `neon-cleanup.yml`.
- **`CLAUDE.md`:** la sección "Estado" marca H0 y H1 como hechos y H2 como siguiente paso.

El `CLAUDE.md` que está dentro del repo `crm-agents` no lo he tocado, porque desde aquí no llego a él. Puedes pedírselo a Claude Code al empezar la sesión de H2, o pegar tú esto en la sección "Estado":

```markdown
## Estado
- H0 hecho (23/11/2026).
- H1 hecho (24/11/2026): `crm-demo` en producción, con vista previa y rama de Neon por PR, borrada al cerrar el PR (`neon-cleanup.yml`).
- Siguiente: H2 · tubería sin IA (vista previa → webhook → capturas de Actions → panel).
```

**Resumen de H1:** `crm-demo` ya está en producción, cada PR tiene su vista previa con su propia rama de Neon, y la rama se borra al cerrar el PR. La integración de Neon no borraba sola las ramas obsoletas, así que se ha añadido un workflow que lo hace. De la sesión quedan dos cosas para H2: el test de escritura sirve de base para el E2E, y `byTestId()` sirve para las páginas ocultas de Next 16.

## ❯ Usuario

Lo he actualizado yo manualmente. Vamos con la sesión de H2

## ● Claude

*Herramientas: lee `claude/PLAN.md` del Project; lee `PRUEBA.md` del Project.*

Antes de proponer el diseño de H2, compruebo los límites actuales de Vercel Blob y cómo se lanza Actions desde las vistas previas de Vercel.

*Herramientas: busca en la web «Vercel Blob Hobby plan limits storage free»; busca en la web «GitHub Actions on deployment_status Vercel preview Playwright target_url».*

Te propongo cómo plantear H2. Hay un punto de seguridad que conviene decidir ya, antes de que Develop escriba en `crm-demo`.

## El flujo

1. Se abre un PR en `crm-demo` y Vercel despliega su vista previa.
2. Cuando la vista previa termina bien, Vercel publica un `deployment_status`. Eso lanza un workflow `preview-e2e.yml` en `crm-demo`. Es el patrón estándar: el workflow se dispara con `deployment_status`, filtra por estado `success` y entorno `Preview`, y toma la URL de la vista previa de `github.event.deployment_status.target_url`.
3. Playwright ejecuta el smoke y el flujo de escritura de H1. Hace capturas JPEG a 1280 px y a 390 px de una lista de páginas en `e2e/pages.ts`, y lo empaqueta todo en un artifact `e2e-results` (`results.json`, `meta.json` y capturas) que caduca en 1 día.
4. Al terminar el workflow, el webhook `workflow_run` llega al panel. El panel descarga el artifact con el PAT, sube las capturas a Vercel Blob y guarda el informe en Neon.
5. Una página `/pipeline` del panel muestra cada PR con su vista previa, el estado de los tests y las capturas.

## Decisiones que propongo

**D15 · Actions arranca con el `deployment_status` de Vercel.**
- No hace falta lanzar workflows desde el panel, así que el PAT no necesita permiso para ejecutar Actions.
- Se usa un grupo de `concurrency` por rama, que cancela la ejecución anterior si llega un commit nuevo.
- Para filtrar el entorno se usa `startsWith('Preview')`, porque Vercel a veces le añade el nombre del proyecto.
- Hay que comprobar que la opción de eventos `deployment_status` está activa en `crm-demo`, porque Vercel permite desactivarlos.

**D16 · Los resultados vuelven por el webhook `workflow_run` y un artifact, no con un POST desde Actions.** Esta es la decisión importante.
- **El problema del POST:** que Actions suba directamente a Blob y avise al panel parece más simple. Pero obliga a guardar secretos del panel (token de Blob y secreto de ingesta) en `crm-demo`. Los workflows de `deployment_status` usan el código del commit desplegado, y los PRs de Develop salen del mismo repo, no de un fork. Un PR de Develop podría cambiar el workflow o un test y leer esos secretos.
- **Con el artifact:** `crm-demo` no guarda ningún secreto del panel, todo entra por el webhook firmado (D4 no cambia) y el PAT solo gana *Actions: lectura*.
- **El coste:** una descarga y una descompresión en el panel, unos segundos.
- **Lo que no elimina:** los secretos que ya tiene `crm-demo` (`NEON_API_KEY` y las credenciales de demo). Por eso propongo dejar fijada ya una regla para H5: el panel rechaza cualquier cambio de Develop que toque `.github/**` o los helpers de `e2e/`.

**D17 · Webhook idempotente que responde rápido.**
- GitHub da por caído un webhook que tarda más de 10 s en responder. El endpoint verifica la firma HMAC, inserta el evento en `github_events` usando `X-GitHub-Delivery` como clave única (con `on conflict do nothing`) y responde 200. El resto se procesa en `after()`.
- Los eventos que no se hayan podido procesar se pueden reprocesar a mano. Así, si reenvías una entrega desde GitHub, no se duplica nada.
- Tablas mínimas: `github_events`, `previews` (sha, PR, rama, URL y estado), `test_reports` y `screenshots`. Se relacionan por el sha del commit. En H3, los runs se enlazarán por rama y PR.

**D18 · Capturas en Vercel Blob.**
- El plan Hobby da 1 GB de almacenamiento y 10 GB de transferencia de Blob al mes, y cada `put()` cuenta para las 2.000 operaciones gratuitas al mes.
- Con unas 6 capturas por ejecución salen más de 300 ejecuciones al mes, de sobra para la prueba.
- Las capturas van en JPEG para no gastar espacio.
- El flujo de escritura de H1 por fin se puede subir: escribe en la rama de Neon de la vista previa, nunca en producción. Para asegurarlo, se salta si la URL es la de producción.

## Lo que tendrás que hacer tú (fuera del alcance de Claude Code)
- **En `crm-demo`:** crear el webhook del repo apuntando a `https://crm-agents.vercel.app/api/webhooks/github`, con secreto y los eventos *Pull requests*, *Deployment statuses* y *Workflow runs*.
- **El PAT de D3:** crearlo con *Actions: lectura* añadido y guardarlo en las variables de entorno de `crm-agents` en Vercel.
- **Vercel Blob:** crear un store y conectarlo a `crm-agents`.
- **Secrets de Actions en `crm-demo`:** las credenciales de demo, para el login de Playwright.

## Criterio de H2, más concreto
H2 está hecho cuando:
- Un PR de prueba en `crm-demo` aparece en `/pipeline` con su vista previa, el resultado de los tests y las capturas en los dos tamaños.
- Un test roto a propósito aparece como fallo.
- Reenviar un webhook desde GitHub no duplica nada.

## Dos cosas que decidir
1. **¿Te parece bien D16 (artifact + `workflow_run`)** frente al POST directo desde Actions? Yo voy con el artifact por lo de los secretos.
2. **El login del panel: ¿lo adelantamos a H2?** Es copiar la sesión HMAC de `crm-demo`, que ya tiene tests, y evita que `/pipeline` quede pública. El webhook quedaría excluido del proxy. Yo lo adelantaría y dejaría H3 solo para el motor de runs.

Cuando me confirmes, añado D15–D18 a `DECISIONES.md` y la sesión 04 a `PROCESO.md`.

## ❯ Usuario

1. Sí, mejor con el workflow_run.
2. Lo adelantamos a H2 si es necesario.

## ● Claude

*Herramientas: ejecuta un comando en su entorno; lee `DECISIONES.md`; lee `PROCESO.md`; edita `DECISIONES.md`; edita `PROCESO.md`; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

He añadido D15–D19 a `DECISIONES.md` y la sesión 04 a `PROCESO.md`, en el Project y en los dos archivos que te he pasado para copiar a `docs/`. En la tabla de hitos, H2 queda "En curso" con el criterio concreto, y H3 pasa a ser solo el motor de runs.

**Resumen:**
- **D15:** Actions arranca con el `deployment_status` de Vercel.
- **D16:** los resultados vuelven en un artifact que el panel descarga al recibir el webhook `workflow_run`. Así `crm-demo` no guarda ningún secreto del panel que un PR de Develop pudiera leer.
- **D17–D19:** el webhook es idempotente y responde enseguida, las capturas van a Vercel Blob y el login del panel se adelanta a H2.

Antes de abrir Claude Code te tocan cuatro cosas, apuntadas también al final de la sesión 04:
1. Crear el webhook en `crm-demo`.
2. Añadir *Actions: lectura* al PAT y guardarlo en las variables de entorno de `crm-agents`.
3. Crear el store de Blob y conectarlo a `crm-agents`.
4. Guardar las credenciales de demo como secrets de Actions en `crm-demo`.

¿Quieres que te prepare el prompt de arranque de la sesión 05 para Claude Code?

## ❯ Usuario

En Vercel he creado la env de GH_WEBHOOK_SECRET en crm-demo y el token para crm-agents como GH_TOKEN. También el blob crm-agents-blob. También los secrets DEMO_USER y DEMO_PASSWORD en crm-demo.

## ● Claude

Casi todo está listo, pero hay una variable en el proyecto equivocado.

**`GH_WEBHOOK_SECRET` tiene que estar en `crm-agents`, no en `crm-demo`.** Quien verifica la firma es el endpoint `/api/webhooks/github`, y ese vive en el panel. En el proyecto de Vercel de `crm-demo` no la lee nadie. Muévela a `crm-agents` (al menos en Production) y bórrala de `crm-demo`.

Lo demás parece bien. Antes de abrir Claude Code, comprueba esto:

- **El webhook del repo:** no me lo has mencionado. Se crea en GitHub, en `crm-demo` → *Settings* → *Webhooks*:
  - *Payload URL:* `https://crm-agents.vercel.app/api/webhooks/github`
  - *Content type:* `application/json`
  - *Secret:* el mismo valor que `GH_WEBHOOK_SECRET`.
  - *Events:* *Pull requests*, *Deployment statuses* y *Workflow runs*.

  Hasta que exista el endpoint, las entregas fallarán con 404. No pasa nada: luego las reenvías desde la pestaña *Recent Deliveries*, y eso sirve además para probar la idempotencia.
- **`GH_TOKEN`:** asegúrate de que solo tiene acceso a `crm-demo` y de que lleva *Contents*, *Pull requests* y *Actions: lectura*, que es el permiso que pide D16 para descargar el artifact.
- **`crm-agents-blob`:** tiene que estar conectado al proyecto `crm-agents`. Si lo está, verás `BLOB_READ_WRITE_TOKEN` en sus variables de entorno.
- **Los eventos `deployment_status`:** en el proyecto de Vercel de `crm-demo`, mira en la configuración de Git que no estén desactivados.
- **Para tu Claude Code local:** cuando el humano haga `vercel env pull` en `crm-agents`, llegarán `GH_TOKEN`, `GH_WEBHOOK_SECRET` y `BLOB_READ_WRITE_TOKEN`. Claude Code solo tiene que documentar los nombres en `.env.example`.

Cuando hayas movido la variable y creado el webhook, te preparo el prompt de arranque de la sesión 05.

## ❯ Usuario

El webhook no lo había mencionado, pero está ya creado también. Ya he hecho el pull del env y han llegado todas las variables, pero de BOB solo ha llegado `BLOB_WEBHOOK_PUBLIC_KEY`y `BLOB_STORE_ID`. 

Sin embargo si me voy al propio BLOB sí que veo allí BLOB_READ_WRITE_TOKEN. ¿La añado a mano a las variables de Vercel?

## ● Claude

*Herramientas: busca en la web «Vercel Blob BLOB_STORE_ID OIDC instead of BLOB_READ_WRITE_TOKEN».*

No hace falta añadirla, y es mejor no hacerlo. Vercel Blob ya no necesita ese token cuando el código corre en Vercel: los stores conectados usan por defecto autenticación OIDC con credenciales de corta duración que rotan solas. `BLOB_STORE_ID` identifica el store y `VERCEL_OIDC_TOKEN` es un token que se emite en tiempo de ejecución. El token estático solo sirve como respaldo para código que corre fuera de Vercel o para generar tokens de subida desde el navegador.

En nuestro caso, quien sube las capturas es el panel, desde una función de Vercel, al procesar el `workflow_run`. Con OIDC le basta. Además, así no hay ninguna clave de larga duración, que encaja con D16.

Dos detalles para la sesión 05:

- **En local:** `vercel env pull` también trae `VERCEL_OIDC_TOKEN` a `.env.local` (compruébalo). Ese token caduca a las pocas horas. Si Claude Code prueba subidas en local y fallan por autenticación, basta con repetir el `pull`. `@vercel/blob` tiene que estar en una versión reciente que lea `BLOB_STORE_ID` y el token OIDC.
- **¿El store es público o privado?** Si es privado, las URLs de las capturas no se abren directamente y el panel tiene que servirlas: o con una ruta propia tras el login, o con URLs firmadas de corta duración. Si es público, cualquiera con la URL ve las capturas, aunque solo enseñan datos ficticios. Las dos opciones valen. Dime cuál elegiste y la dejo anotada en D18.

## ❯ Usuario

El Blob es privado ahora mismo.

## ● Claude

*Herramientas: edita `DECISIONES.md`; actualiza `claude/DECISIONES.md` en el Project; envía `DECISIONES.md`.*

Que sea privado está bien: encaja con tener el panel tras el login. Lo he anotado en D18, en el Project y en el `DECISIONES.md` que te acabo de pasar:

- **Autenticación:** el store usa OIDC (`BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`), sin token estático.
- **Cómo se ven las capturas:** el panel las sirve con su propia ruta, `GET /api/screenshots/[id]`. La ruta está protegida por el login, lee la imagen en el servidor y la devuelve con caché privada. Así las URLs de Blob nunca llegan al navegador.

La otra opción eran URLs firmadas de corta duración. Esas ahorran pasar los bytes por una función, pero añaden más piezas, y con capturas JPEG de unos cientos de KB no compensa.

Con esto ya está todo listo para la sesión 05. ¿Te preparo el prompt de arranque para Claude Code?

## ❯ Usuario

Sí

## ● Claude

Aquí tienes el prompt para arrancar la sesión 05. Ábrela en una carpeta desde la que Claude Code vea los dos repos (`crm-demo` y `crm-agents`), porque H2 toca ambos.

```markdown
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
```

Antes de lanzarla te faltará crear en Vercel las variables del login del panel. Claude Code te dirá los nombres exactos, que serán los mismos que en `crm-demo`, y puedes reutilizar los valores o poner otros.
