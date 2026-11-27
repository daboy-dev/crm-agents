# Sesión 00 · Planificación (Project de Claude) · 23/11/2026

Conversación «Plan técnica CRM agentes» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

Vamos a empezar a preparar la prueba técnica. En PRUEBA.md tienes la prueba técnica solicitada, y en OFERTA.md la oferta de empleo como contexto.

1. Flujo de trabajo: en este Project pensamos y decidimos. La implementación se hará con Claude Code y en mi repo (crm-agents). Todo lo que decidimos aquí debe acabar resumido en el repo (docs/PROCESO.md y docs/DECISIONES.MD), de esta forma los evaluadores tienen un paso a paso de como trabajamos ya que verán el repo.


2. Producto: los agentes trabajarán sobre un mini CRM (clientes, presupuestos, facturas), para conectar con lo que hace la empresa.


3. Los agentes serán: 

* Orquestador: que divida la petición en las distintas tareas, con sus criterios de aceptación, y las asigne.
* Develop: que haga los cambios necesarios en el propio CRM.
* Testing: comprueba que los criterios de aceptación se cumplen, revisión con LLM (escritorio y móvil). Que devuelva cada fallo, si los encuentra. Rate limit para evitar bucles infinitos.
* Aprobación humana: el orquestador muestra el plan y una vista previa final, el usuario (cliente) a prueba o da feedback para que vuelva al ciclo.


4. UI: panel del run con los 3 agentes y su estado actual, sus tareas (también con su estado), log de eventos, vista previa del proyecto en escritorio y móvil, resultado de testing y la pantalla de aprobación y feedback.


5. Stack e infra (gratis)

* Next.js con App Router desplegado en Vercel.
* LLM de los agentes: Gemini, con interfaz común para ofrecer la posibilidad de cambiar de cambiar de proveedor.
* Base de datos: Neon.
* Protección: inicio de sesión con usuario de prueba


6. Documentación en PROCESO.md con una entrada por cada sesión de Code (objetivo, como ha ido, que se ha hecho mal, qué se ha corredigo, etc), transcripciones en docs/sesiones/ (sin info sensible) y CLAUDE.md actualizado con cada hito. 


Revisa los documentos del project y dime si necesitas más información. Propón un plan por hitos verificables. Cuándo validemos el plan, empezamos a trabajar con Code.

## ● Claude

Voy a leer los dos documentos del Project antes de proponerte nada.

*Herramientas: lee `PRUEBA.md` del Project; lee `OFERTA.md` del Project; lee sus notas de preferencias del Project; busca en la web «Gemini API free tier rate limits models»; busca en la web «Vercel Hobby plan function max duration fluid compute».*

He leído PRUEBA.md y OFERTA.md. Tu planteamiento cumple todos los requisitos de la prueba y suma lo que más pesa en la oferta: CRM, pruebas en escritorio y móvil, y demo con feedback del cliente. Antes del plan hay tres puntos que cambian la arquitectura y conviene decidirlos ya.

## 1. Cómo cambia Develop el CRM (la decisión clave)

En Vercel no se puede editar código ni recompilar mientras la app está funcionando. Hay tres formas de resolverlo:

- **A. CRM declarativo (la que recomiendo).** El CRM se genera a partir de una especificación guardada en Neon: entidades, campos, validaciones, vistas y páginas. Develop no escribe código: genera operaciones tipadas sobre esa especificación, validadas con Zod. Cada run trabaja en una **rama** (una copia de la especificación). La vista previa muestra esa rama y, al aprobar, se fusiona con la versión de producción. Es seguro, reversible, se puede testear, es gratis y se parece a cómo se adapta un software a medida.
  - Límite: Develop solo puede hacer lo que permita el catálogo de componentes, por ejemplo añadir el NIF a clientes, un filtro por estado de factura, el cálculo del IVA o una página de contacto.
  - Para peticiones fuera del catálogo habría un bloque de contenido libre (markdown saneado).
- **B. Develop abre PRs en GitHub y Vercel crea un despliegue de vista previa.** Es lo más realista, pero cada iteración tarda 1–2 minutos de build. Además gasta la cuota de builds de Hobby, necesita un token de GitHub en el servidor y los evaluadores acabarían creando PRs en tu repo.
- **C. Develop genera componentes React como texto y los ejecuta en un iframe aislado.** Es flexible, pero cuesta mucho testearlo y asegurarlo.

Mi propuesta es la A, y dejar escrita la B en DECISIONES.md como siguiente paso natural.

## 2. Los runs duran minutos y Vercel corta antes

En el plan gratuito (Hobby), las funciones tienen una duración máxima de 300 s (5 minutos). Por eso propongo:

- Una **máquina de estados en Neon**, donde cada paso de agente es una llamada corta que se puede repetir sin efectos duplicados.
- Los pasos los avanza un endpoint `/tick`, y se encadenan con `after()`.
- La UI lee el estado con consultas periódicas cada 1–2 s.
- El log de eventos es una tabla a la que solo se añaden filas. Enlaza bien con tu experiencia en Event Sourcing y se puede contar en la entrevista.

## 3. Testing en escritorio y móvil necesita capturas, y Gemini gratis tiene cuota

- **Testing en dos capas:**
  - (a) Comprobaciones automáticas: los criterios de aceptación se convierten en verificaciones sobre la especificación y el HTML renderizado. Por ejemplo, que la ruta exista, que el campo sea obligatorio o que el email se valide.
  - (b) Revisión visual con Gemini de capturas a 1280 px y 390 px.
- **Capturas:** probaría Chromium sin interfaz dentro de una función de Vercel. Si es demasiado pesado, el plan B es capturar desde el navegador del usuario con html-to-image. Esto conviene comprobarlo pronto (hito H2).
- **Cuota de Gemini:** los límites se aplican por proyecto, no por API key, y la cuota diaria se reinicia a medianoche hora del Pacífico. Además, los modelos preview y experimentales tienen límites más restrictivos. Las cifras exactas hay que mirarlas en AI Studio. Propongo:
  - Un presupuesto por run: máximo de llamadas y como mucho 3 iteraciones Develop↔Testing por tarea. Si se agota, la tarea queda bloqueada y pasa al humano.
  - Reintentos con espera ante el error 429.
  - Un **MockProvider** detrás de la interfaz común. Sirve para tests deterministas en CI y como plan B si la cuota se agota durante la evaluación.

## Otras decisiones que doy por buenas salvo que digas lo contrario

- **Interfaz común de LLM:** `LLMProvider.generate(schema, messages)`, con `GeminiProvider` y `MockProvider`. Todas las salidas de los agentes son JSON estructurado validado con Zod.
- **Orquestador:** devuelve tareas con id, agente, criterios de aceptación verificables y dependencias. Hay dos puntos de aprobación humana: el plan y la vista previa final. El feedback vuelve al orquestador, que replanifica sobre la misma rama.
- **Datos:** Drizzle con el driver serverless de Neon. Tablas: `crm_versions`, `runs`, `tasks`, `events`, `test_results`, `approvals` y `llm_calls` (tokens y latencia, para mostrar el coste).
- **Seguridad:**
  - Un usuario de prueba con sesión en cookie firmada, y un middleware que protege todas las rutas.
  - Límite de runs al día.
  - Botón «Restaurar CRM demo» para que los evaluadores no se pisen.
- **Calidad:** Vitest para el dominio y los estados, Playwright E2E con MockProvider, y GitHub Actions.

## Plan por hitos

| Hito | Contenido | Se da por verificado cuando… |
|---|---|---|
| **H0** Base | Repo, Next.js App Router + TS, Drizzle/Neon, CI, despliegue vacío, CLAUDE.md y estructura de `docs/` | La URL de Vercel responde, CI está en verde y la migración está aplicada en Neon |
| **H1** Login y CRM base | Usuario de prueba, middleware, especificación v1 (clientes, presupuestos, facturas), renderer y datos de ejemplo | Se puede entrar con el usuario y hacer el CRUD de las 3 entidades, en escritorio y móvil |
| **H2** Prueba de riesgos | Capturas en Vercel, salida estructurada de Gemini y comportamiento ante la cuota | En producción, un endpoint devuelve 2 capturas y un JSON válido de Gemini. Queda decidido el plan B |
| **H3** Motor de runs | Interfaz de LLM, máquina de estados, `/tick`, eventos, presupuesto y límite de llamadas | Un run con MockProvider recorre todos los estados, con tests de las transiciones |
| **H4** Orquestador | Plan de tareas con criterios y aprobación del plan | Una petición real genera un plan visible que se puede aprobar o rechazar |
| **H5** Develop | Operaciones sobre la rama y vista previa | «Añade NIF a clientes» aparece en la vista previa y producción no cambia |
| **H6** Testing | Comprobaciones automáticas y revisión visual en 2 tamaños, con lista de fallos y bucle con tope | Un fallo provocado vuelve a Develop y acaba corregido, o queda bloqueado al llegar al tope |
| **H7** Panel del run | 3 agentes con su estado, tareas, log, vista previa escritorio/móvil, resultados de testing, aprobación final y fusión | Un run completo funciona en producción, desde el móvil y desde el escritorio |
| **H8** Entrega | Endurecimiento, botón de restaurar, README, las 4 respuestas, revisión de docs y transcripciones saneadas | Se cumple la checklist de entrega y salen bien 3 peticiones de demo de principio a fin |

**Documentación:** al cerrar cada sesión de Code se hace lo siguiente:

- Una entrada en PROCESO.md: objetivo, cómo ha ido, qué falló y qué se corrigió.
- La transcripción con `/export` en `docs/sesiones/NN-titulo.md`, pasando antes un script que busque claves o datos sensibles.
- CLAUDE.md actualizado en cada hito.
- Las decisiones de aquí van a DECISIONES.md en formato ADR corto: contexto, opciones, decisión y consecuencias.

## Lo que necesito saber

1. **Las 4 preguntas cortas** de la entrega: ¿las tienes? Si las conocemos ya, podemos ir dejando pruebas para responderlas desde el primer hito.
2. **Plazo** de entrega y horas que puedes dedicarle. Con eso decido si H8 se recorta o si añadimos algo extra, como una integración simulada con Holded.
3. ¿Validas la **opción A** para Develop?
4. ¿El repo `crm-agents` ya existe? ¿Está vacío y es público?

En cuanto me respondas, te dejo el resumen de decisiones y el texto inicial de DECISIONES.md y PROCESO.md listo para H0. Si conectas la carpeta del repo en la app de escritorio, lo escribo yo directamente; si no, lo guardo en el Project.

¿Quieres que lo ponga en un Whiteboard?

## ❯ Usuario

Sobre las decisiones de la arquitectura:

1. Optamos por la B). La prueba exige literalmente que el agente de develop escriba código, así que sí o sí es necesario adaptarnos a ese requerimiento porque es además como se trabajaría en un entorn oreal. En principio el plan gratis de Vercel en este caso debería bastar.
2. Trabajaría en conjunto con los webhooks de Github.
3. Creo que Chromium será demasiado pesado para Vercel, teniendo en cuenta que es el plan gratuito.


Lo que necesitas saber:

1. Aún no tengo las cuatro preguntas. Las dejaremos para el final.
2. No hay plazo de entrega definido, pero como muy tarde deberíamos entregarlo a final de semana (Estamos a lunes). +4h al día. Estamos muy a tiempo ;)
3. Cómo dije arriba, optamos por la B).
4. Sí, existe: https://github.com/daboy-dev/crm-agents


Y sí, un Whiteboard molaría para tenerlo más claro.

## ● Claude

Hecho: vamos con la B, testing fuera de Vercel y webhooks de GitHub. Te preparo el Whiteboard con la arquitectura revisada y los hitos.

*Herramientas: consulta los artifacts; crea el Whiteboard del plan; actualiza el Whiteboard del plan; actualiza `PLAN.md` en el Project.*

<details><summary>PLAN.md</summary>

```markdown
# Plan y decisiones — prueba técnica Speed Paradigm

Borrador decidido en el Project (23/11/2026). Pasa al repo `daboy-dev/crm-agents` como `docs/DECISIONES.md` y primera entrada de `docs/PROCESO.md` en H0.

## Flujo de trabajo
- En el Project de Claude se piensa y se decide; la implementación se hace con Claude Code en el repo.
- Cada sesión de Code deja una entrada en `docs/PROCESO.md`: objetivo, cómo fue, qué salió mal y qué se corrigió.
- La transcripción va a `docs/sesiones/` (con `/export`, sin claves ni datos sensibles).
- `CLAUDE.md` se actualiza en cada hito.

## Decisiones

### D1 · Develop escribe código real mediante PRs (opción B)
- **Contexto:** la prueba pide que Develop haga las tareas de desarrollo, y en un entorno real eso es código.
- **Decisión:** Develop crea una rama y un PR en el repo del CRM. Vercel genera un despliegue de vista previa por PR. Al aprobar se hace merge a main y se publica en producción.
- **Descartadas:** A (CRM declarativo, sin código real) y C (código generado y ejecutado en un iframe aislado).
- **Consecuencias:** cada iteración tarda lo que tarda un build (minutos). Hace falta un token de GitHub en el servidor y un tope de iteraciones.

### D2 · Eventos por webhooks de GitHub
- Vercel publica el estado de cada despliegue como `deployment_status` en GitHub, así que basta con un único webhook de GitHub, verificado con HMAC, hacia el panel.
- Los runs son una máquina de estados en Neon que avanzan con los eventos.
- Las funciones de Vercel Hobby tienen un máximo de 300 s, así que ningún paso puede esperar en vivo a un build.

### D3 · Sin Chromium en Vercel: el navegador corre en GitHub Actions
- Al llegar la vista previa, un workflow de Actions lanza Playwright contra su URL: tests E2E y capturas a 1280 px y 390 px.
- Los resultados y las capturas vuelven al panel.
- El agente Testing (Gemini) evalúa los criterios de aceptación con esos resultados y capturas, y devuelve la lista de fallos.
- Máximo 3 iteraciones Develop↔Testing por tarea; después, la tarea pasa al humano.

### D4 · LLM
- Gemini (capa gratuita) detrás de una interfaz común `LLMProvider`, con `GeminiProvider` y `MockProvider` (para CI y como plan B).
- Salidas en JSON validadas con Zod.
- Presupuesto de llamadas por run y reintentos con espera ante el error 429.

### D5 · Infraestructura gratuita
Next.js (App Router) en Vercel Hobby, Neon, login con usuario de prueba y ninguna clave en el repo.

## Hitos (lunes–viernes, ~4 h/día)
| Hito | Verificado cuando… |
|---|---|
| H0 Plan y decisiones | Plan validado y este documento en el repo |
| H1 Repos y CRM demo | crm-demo en producción con clientes, presupuestos y facturas |
| H2 Tubería sin IA (riesgo principal) | Un commit de prueba genera preview, webhook y capturas de Actions que llegan al panel |
| H3 Panel y motor de runs | Login y un run completo con MockProvider |
| H4 Orquestador | Plan con criterios que el cliente aprueba o rechaza |
| H5 Develop | PR real que compila en su preview |
| H6 Testing | Un fallo provocado vuelve a Develop y se corrige o se bloquea |
| H7 Panel completo | Run real end-to-end en móvil y escritorio |
| H8 Entrega | README, docs, transcripciones saneadas y las 4 respuestas |

## Pendiente de decidir
- Repo del CRM separado (`crm-demo`) o monorepo.
- Token de GitHub: PAT de permisos finos o GitHub App.
- Base de datos de las vistas previas: rama de Neon por preview o base compartida.
- Protección de las vistas previas de Vercel (iframe en el panel y acceso desde Actions).
- Las 4 preguntas de la entrega: al final.

Whiteboard: [enlace privado al Whiteboard]
```

</details>

Ya tienes el Whiteboard. A la izquierda está el run completo, con el bucle Develop → PR → Vercel preview → webhook → Actions → Testing y la vuelta a Develop si algo falla (como mucho 3 veces). A la derecha, los hitos de martes a viernes. He guardado el plan y las decisiones en el Project como `PLAN.md`, para pasarlos al repo en H0.

**Resumen de decisiones:**
- Develop escribe código real: abre una rama y un PR, y Vercel genera una vista previa. Al aprobar se hace merge y se publica en producción.
- Toda la comunicación entra por un único webhook de GitHub. Vercel avisa del estado de cada despliegue a través de GitHub (`deployment_status`), así que no hace falta conectar nada más.
- No hay Chromium en Vercel: Playwright corre en GitHub Actions contra la URL de la vista previa, con tests y capturas a 1280 px y 390 px. Testing (Gemini) evalúa los criterios con esos resultados. Si el repo es público, los minutos de Actions no cuestan nada.

**Quedan 4 cosas que decidir antes de H1. Esto es lo que recomiendo:**

1. **Repo del CRM separado (`crm-demo`)** con su propio proyecto en Vercel. Si Develop escribe en `crm-agents`, un cambio mal hecho podría romper el panel que lo controla. Además, el token solo tendría acceso a un repo de demo. Los evaluadores verían los PRs de los agentes en `crm-demo` y el README de `crm-agents` enlazaría allí.
2. **Token de GitHub de permisos finos**, limitado a `crm-demo` (contenido y PRs), para empezar. Una GitHub App queda apuntada como mejora en DECISIONES.md.
3. **Una rama de Neon por cada vista previa**, para que Develop pueda cambiar el esquema (por ejemplo, añadir el NIF) sin tocar producción. La integración de Neon con Vercel lo hace sola. Hay que confirmar en H1 cuántas ramas permite el plan gratuito.
4. **Quitar la protección de las vistas previas de Vercel en `crm-demo`.** Sin eso, el iframe del panel no carga para los evaluadores y Actions no puede entrar. Como solo tiene datos ficticios, es aceptable. El CRM puede llevar su propio login de demo.

Si me das el visto bueno a estos cuatro, preparo el prompt de arranque de H0 para Claude Code y el primer `PROCESO.md`/`DECISIONES.md`.

## ❯ Usuario

Adelante. Con la bbdd del CRM separada en otro proyecto de Neon

## ● Claude

Perfecto: el CRM tendrá su propio proyecto de Neon. Preparo los documentos iniciales del repo y el prompt de la primera sesión de Code.

*Herramientas: ejecuta un comando en su entorno; escribe `DECISIONES.md`; escribe `PROCESO.md`; escribe `00-planificacion.md`.*

<details><summary>00-planificacion.md</summary>

```markdown
# Sesión 00 · Planificación en el Project de Claude

**Fecha:** 23/11/2026 · **Herramienta:** Project de Claude (claude.ai) · **Formato:** resumen fiel de la conversación, sin datos sensibles.

## 1. Planteamiento inicial (usuario)
- Flujo: en el Project se piensa y se decide; la implementación se hace con Claude Code en `crm-agents`. Todo se resume en `docs/PROCESO.md` y `docs/DECISIONES.md`.
- Producto: un mini CRM con clientes, presupuestos y facturas.
- Agentes:
  - Orquestador: divide la petición en tareas con criterios de aceptación y las asigna.
  - Develop: cambia el CRM.
  - Testing: comprueba los criterios en escritorio y móvil, devuelve los fallos y tiene un tope para evitar bucles.
  - Aprobación humana: del plan y de la vista previa final, con feedback.
- UI: panel del run con los agentes y su estado, las tareas, el log de eventos, la vista previa en escritorio y móvil, los resultados de testing y la pantalla de aprobación.
- Stack gratuito: Next.js App Router en Vercel, Gemini detrás de una interfaz común, Neon y login con usuario de prueba.

## 2. Primera propuesta (Claude)
Claude señaló tres riesgos de arquitectura:
1. **Cómo modifica Develop el CRM** si Vercel no permite editar código en ejecución. Opciones:
   - A: CRM declarativo con especificación JSON.
   - B: PRs con vistas previas de Vercel.
   - C: código ejecutado en un iframe aislado.
   Claude recomendó la A.
2. **Duración de los runs** frente al límite de 300 s de las funciones de Vercel Hobby: máquina de estados persistida y pasos cortos.
3. **Capturas para Testing y cuota de Gemini:** comprobaciones automáticas más revisión visual, presupuesto por run y un `MockProvider`.

Propuso hitos H0–H8 verificables y preguntó por las 4 preguntas de la entrega, el plazo y el repo.

## 3. Decisiones del usuario
- **Opción B:** la prueba exige que Develop escriba código y es como se trabaja en real.
- Integración mediante **webhooks de GitHub**.
- **Sin Chromium en Vercel** por el peso en el plan gratuito.
- Plazo: entrega a final de semana, unas 4 h al día. Las 4 preguntas se dejan para el final.

## 4. Arquitectura revisada (Claude)
- Develop hace commit en una rama y abre un PR en `crm-demo`, y Vercel genera la vista previa.
- `deployment_status` llega por webhook de GitHub y lanza GitHub Actions con Playwright (1280 px y 390 px).
- Testing evalúa los criterios; si fallan, vuelve a Develop (máximo 3 veces).
- Al final, aprobación del cliente, merge y producción.
- Se creó un Whiteboard con el flujo y los hitos.

Recomendaciones pendientes:
- Repo del CRM separado.
- PAT de permisos finos.
- Una rama de Neon por vista previa.
- Vistas previas sin protección de Vercel.

## 5. Cierre
El usuario aceptó las cuatro recomendaciones y añadió que **la base de datos del CRM vaya en un proyecto de Neon distinto**. Queda reflejado en D2–D7 de `DECISIONES.md`.
```

</details>

*Herramientas: escribe `CLAUDE.md`; escribe `PROMPT-sesion-01-H0.md`.*

<details><summary>PROMPT-sesion-01-H0.md</summary>

```markdown
# Prompt para Claude Code · Sesión 01 · H0 (base del repo)

> Pegar en Claude Code dentro de `crm-agents`, después de copiar al repo `CLAUDE.md` y la carpeta `docs/`. Empezar en modo plan.

---

Vamos a empezar el hito **H0** del proyecto. Lee primero `CLAUDE.md`, `docs/DECISIONES.md` y `docs/PROCESO.md`.

**Objetivo de H0:** dejar el esqueleto de `crm-agents` listo, con CI y desplegado en Vercel, sin lógica de agentes todavía.

**Alcance:**
1. Next.js (última versión estable, App Router) con TypeScript estricto, ESLint y Prettier. Usa pnpm.
2. Estructura de carpetas pensada para lo que viene, vacía o con un mínimo:
   - `src/app` (UI y rutas API)
   - `src/server/db` (Drizzle)
   - `src/server/runs` (máquina de estados)
   - `src/server/agents`
   - `src/server/llm` (interfaz `LLMProvider`)
   - `src/server/github`
3. Drizzle + `@neondatabase/serverless`:
   - Configuración y una primera migración con una tabla `app_meta` (para el health check).
   - Scripts `db:generate` y `db:migrate`.
4. `GET /api/health`: devuelve `{ ok, db: true|false, version }` haciendo una consulta real a Neon.
5. Página inicial mínima en español: «crm-agents · H0», con enlace a la documentación.
6. Vitest con un test de ejemplo del health check (base de datos simulada).
7. GitHub Actions `ci.yml`: install, lint, comprobación de tipos y tests en cada push y PR.
8. `.env.example` con `DATABASE_URL` y las variables que vendrán, comentadas: `GEMINI_API_KEY`, `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `AUTH_SECRET`, `DEMO_USER`, `DEMO_PASSWORD`. Ninguna clave real.
9. `README.md` corto: qué es, enlace a `docs/` y estado.
10. Completa la sección «Comandos» de `CLAUDE.md`.

**Fuera de alcance:** login, agentes, webhooks y `crm-demo`.

**Verificación (no cerrar H0 sin esto):**
- `pnpm lint && pnpm typecheck && pnpm test` en verde en local y en CI.
- Migración aplicada en el proyecto de Neon `crm-agents`.
- La URL de producción de Vercel devuelve `ok: true` y `db: true` en `/api/health`.

Yo me encargo de crear el proyecto de Neon y el de Vercel y de poner las variables de entorno; dime en qué momento las necesitas.

**Al terminar:**
- Añade a `docs/PROCESO.md` la entrada «Sesión 01 · H0» (objetivo, cómo fue, qué salió mal, qué se corrigió) y marca H0 como hecho en la tabla de hitos.
- Recuérdame que exporte la transcripción a `docs/sesiones/01-h0-base.md` y revísala buscando secretos antes del commit.
```

</details>

*Herramientas: actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PLAN.md` en el Project.*

<details><summary>claude/PLAN.md</summary>

```markdown
# Plan — prueba técnica Speed Paradigm

Estado al 23/11/2026: **plan validado**. Las decisiones D1–D10 están en `claude/DECISIONES.md`, que es la copia de `docs/DECISIONES.md` del repo.

## Resumen
- Develop escribe código real en el repo `crm-demo` (rama + PR) y Vercel genera la vista previa.
- Un webhook de GitHub mueve la máquina de estados del run, guardada en Neon.
- Playwright corre en GitHub Actions: tests y capturas a 1280 px y 390 px. Testing (Gemini) evalúa; máximo 3 iteraciones.
- El cliente aprueba el plan y la vista previa final; al aprobar, merge y producción.
- Repos, proyectos de Vercel y proyectos de Neon separados para `crm-agents` (panel) y `crm-demo` (CRM, con una rama de Neon por vista previa).
- PAT de permisos finos limitado a `crm-demo`. Vistas previas de `crm-demo` sin protección de Vercel.

## Hitos (lunes–viernes, ~4 h/día)
H0 base del repo · H1 CRM demo · H2 tubería sin IA (riesgo principal) · H3 panel y motor de runs · H4 Orquestador · H5 Develop · H6 Testing · H7 panel completo · H8 entrega.

## Pendiente
- Las 4 preguntas de la entrega (al final).
- Comprobar en H1 los límites de proyectos y ramas del plan gratuito de Neon.

Whiteboard: [enlace privado al Whiteboard]
```

</details>

*Herramientas: envía `PROMPT-sesion-01-H0.md`, `CLAUDE.md`, `DECISIONES.md`, `PROCESO.md`, `00-planificacion.md`.*

He preparado los documentos iniciales del repo y el prompt de la primera sesión de Code. Todavía no están en `crm-agents`, porque desde aquí no tengo acceso al repo.

**Resumen de lo decidido:**
- Develop escribe código real en un repo aparte, `crm-demo`, con su propio proyecto de Vercel y su propio proyecto de Neon. Cada vista previa tiene su rama de base de datos, así que Develop puede cambiar el esquema sin tocar producción.
- Un webhook de GitHub hace avanzar cada run, que se guarda en el Neon de `crm-agents`. Playwright corre en GitHub Actions para probar en escritorio y móvil.
- El token de GitHub de permisos finos solo tiene acceso a `crm-demo`, y sus vistas previas no tienen la protección de Vercel. En el repo, esto queda en `DECISIONES.md` (D1–D10).

Lo que te paso:
- **`DECISIONES.md`:** cada decisión con contexto, opciones y consecuencias. Recoge que yo propuse primero la opción A y que tú elegiste la B porque la prueba pide que Develop escriba código; a los evaluadores les servirá ver cómo se razonó.
- **`PROCESO.md`:** la tabla de hitos y la entrada de la «Sesión 00 · Planificación».
- **`sesiones/00-planificacion.md`:** un resumen de esta conversación. No es la transcripción literal, porque esta conversación no tiene un `/export` como el de Code.
- **`CLAUDE.md`:** el contexto, las restricciones y la rutina de cierre de cada sesión, para que Code la siga.
- **`PROMPT-sesion-01-H0.md`:** el alcance de H0 y cómo se verifica (CI en verde y `/api/health` respondiendo `db: true` en producción).

También he actualizado el plan y he guardado una copia de las decisiones en el Project. En H1 hay que comprobar cuántos proyectos y ramas permite el plan gratuito de Neon.

Para H0: copia `CLAUDE.md` y `docs/` al repo, pega el prompt en Claude Code y crea el proyecto de Neon `crm-agents` cuando Code te pida la `DATABASE_URL`. Si prefieres que haga yo el commit de los documentos, dímelo y conecto el repo desde aquí.

## ❯ Usuario

Actualiza este Whiteboard al estado del proyecto a 25/11/2026. Cambia solo lo que se indica y mantén la disposición y los colores:
Tabla de hitos

* Columna «Día» → «Estado».
   * H0: «Hecho 23/11».
   * H1, H2, H3 y H4: «Hecho 24/11».
   * H5: «Siguiente».
   * H6, H7 y H8: «Pendiente».
* Quita el color de la fila de H2 y pon el resaltado azul en la fila de H5.
* Textos de «Verificado cuando…»:
   * H2: «Commit → preview → webhook → capturas, con login».
   * H3: «Run completo con MockProvider sobre GitHub real».
   * H4: «Plan con criterios que el cliente aprueba o rechaza».
   * H6: «Un fallo provocado vuelve a Develop y se corrige o se bloquea».
* Cambia el nombre de la fila de H3 a «H3 · Motor de runs». El login se hizo en H2.

Nota bajo la tabla

* Sustitúyela por: «H2 cerró el bucle (24/11). Riesgo actual: la cuota gratuita de Gemini (40 llamadas Flash al día), con Groq de respaldo para el Orquestador.»

Flujo «Un run, de la petición a producción»

* Orquestador: cambia «tareas + criterios» por «tareas, criterios y referencias». Añade una salida, con una flecha y la etiqueta «fuera de alcance», a una píldora blanca: «Rechazada, sin rama ni PR».
* Rama + PR: cambia el texto por «Rama run/<id> + PR · un commit por tarea».
* Nuevo bloque blanco entre la rama y la vista previa: «pr-check (Actions) · migración, tipos y lint».
   * Va de la rama a este bloque y de este bloque a un bloque «Vista previa de Vercel», que lleva al de Playwright.
   * Añade una flecha color terracota de pr-check a Develop, con la etiqueta «errores».
* Develop: añade una flecha discontinua de Develop al Orquestador, con la etiqueta «no cabe → se divide».
* Flecha de Testing a Develop: cambia la etiqueta por «fallos · máx. 3 por tarea».
* Leyenda: cambia «Azul: agentes (Gemini)» por «Azul: agentes (Gemini, Groq de respaldo)».

Haz sitio moviendo los bloques vecinos y que ninguna flecha cruce un bloque.

## ● Claude

*Herramientas: actualiza el Whiteboard del plan; lee el Whiteboard del plan.*

He actualizado el Whiteboard al 25/11. La tabla muestra el estado de cada hito, el azul está ahora en H5 y la nota recoge el riesgo de la cuota de Gemini. En el flujo están la píldora de «Rechazada», el bloque pr-check con su flecha de errores, la vista previa de Vercel y la flecha discontinua «no cabe → se divide».

Para hacer sitio he cambiado la disposición más de lo que pediste:
- La píldora «Rechazada» va encima del Orquestador. Para dejarle hueco, todo el flujo baja unos 200 px.
- La sección del flujo es más ancha, porque pr-check y la vista previa van en una columna nueva a la derecha.
- La tabla de hitos se ha desplazado a la derecha y es algo más ancha, para que quepa la columna «Estado».

Como resultado, el tablero es bastante más ancho que antes y la vista se aleja más para que quepa entero.

Hay tres flechas que llegan al Orquestador o a Develop en un punto concreto del borde, para que no se monten unas encima de otras: la de feedback, la de «no cabe → se divide» y la de «errores». Si mueves esos bloques, esas flechas no les siguen y habrá que reajustarlas. No he comprobado cómo se ve el resultado, así que si alguna flecha pisa un bloque, dímelo y la recoloco.

## ❯ Usuario

Actualiza el plan con el estado al 25/11/2026. H4 hecho: el Orquestador planifica con Gemini, con replanificación y rechazo fuera de alcance. H5 hecho: Develop escribe código real con la cadena Gemini → Anthropic (claude-sonnet-5-5, respaldo de pago). pr-check.yml genera la migración y devuelve los errores de tipos antes del build, y las tareas demasiado grandes vuelven al Orquestador para dividirse. H6 planificado: Testing traduce cada criterio e2e a pasos JSON declarativos que ejecuta un spec fijo de crm-demo (e2e/criteria.spec.ts) en la vista previa. El veredicto lo da el ejecutor, no el LLM. Testing solo llama al LLM para escribir los pasos y para explicar los fallos, y su cadena es Gemini → Groq → Anthropic. De momento solo hay criterios e2e: lo visual lo revisa el humano en la aprobación final. En el flujo del run, añade el paso «Testing escribe los pasos» tras aprobar el plan y «pr-check» antes de la vista previa. Pendientes: H6 (implementación), H7 y H8.

## ● Claude

*Herramientas: lee `claude/PLAN.md` del Project; actualiza `claude/PLAN.md` en el Project.*

<details><summary>claude/PLAN.md</summary>

```markdown
# Plan — prueba técnica Speed Paradigm

Estado al 25/11/2026: **H0–H5 hechos**. El Orquestador planifica con Gemini y Develop escribe código real en `crm-demo`. Siguiente: **H6 · Testing**, ya planificado y pendiente de implementar.

Copias en el proyecto de los documentos del repo `crm-agents`:
- `claude/DECISIONES.md` ← `docs/DECISIONES.md`
- `claude/PROCESO.md` ← `docs/PROCESO.md`
- `claude/CLAUDE.md` ← `CLAUDE.md`

## Resumen
- **Orquestador** (Gemini): divide la petición en tareas con criterios y referencias. Replanifica con el feedback del cliente y rechaza lo que está fuera de alcance, sin crear rama ni PR.
- **Develop**:
  - Escribe código real en `crm-demo`: rama `run/<id>`, un commit por tarea y un PR por run.
  - Cadena de modelos: Gemini → Anthropic (`claude-sonnet-5-5`, respaldo de pago).
  - Las tareas demasiado grandes vuelven al Orquestador para dividirse.
- **pr-check.yml** (GitHub Actions): genera la migración y devuelve a Develop los errores de tipos y de lint antes del build de Vercel.
- **Testing** (H6, planificado):
  - Traduce cada criterio e2e a pasos JSON declarativos.
  - Un spec fijo de `crm-demo` (`e2e/criteria.spec.ts`) los ejecuta con Playwright en Actions contra la vista previa.
  - **El veredicto lo da el ejecutor, no el LLM.** El LLM solo escribe los pasos y explica los fallos.
  - Cadena de modelos: Gemini → Groq → Anthropic.
  - Máximo 3 iteraciones por tarea.
  - De momento solo hay criterios e2e: lo visual lo revisa el cliente en la aprobación final.
- **Máquina de estados**: los webhooks de GitHub mueven el run, guardado en Neon, con CAS, lease y sweep (sin cron).
- Repos, proyectos de Vercel y de Neon separados para `crm-agents` (panel) y `crm-demo` (CRM, con una rama de Neon por vista previa).
- Gemini en capa gratuita: 5 runs al día y 12 llamadas por run.

## Flujo de un run
1. **Petición** del cliente.
2. **Orquestador** planifica tareas, criterios y referencias. Si la petición está fuera de alcance, se rechaza sin crear rama ni PR.
3. **El cliente aprueba el plan**. Si da feedback, el Orquestador replanifica.
4. **Testing escribe los pasos**: cada criterio e2e se traduce a pasos JSON.
5. **Develop** escribe el código, con un commit por tarea en `run/<id>` y un PR. Si una tarea no cabe, vuelve al Orquestador para dividirse.
6. **pr-check**: migración, tipos y lint. Si hay errores, vuelven a Develop.
7. **Vista previa** de Vercel.
8. **Webhook → Playwright** en Actions ejecuta `e2e/criteria.spec.ts` con los pasos. El ejecutor decide si cada criterio pasa. Si algo falla, Testing explica el fallo y vuelve a Develop (máximo 3 iteraciones por tarea).
9. **El cliente aprueba la vista previa final**, incluida la revisión visual. Después, merge squash y producción.

## Hitos
H0 base ✅ · H1 CRM demo ✅ · H2 tubería sin IA ✅ · H3 motor de runs ✅ · H4 Orquestador ✅ · H5 Develop ✅ · H6 Testing (planificado, por implementar) · H7 panel completo · H8 entrega.

## Pendiente
- H6: implementación de Testing.
- H7: panel completo.
- H8: entrega, incluidas las 4 preguntas.

Whiteboard: [enlace privado al Whiteboard]
```

</details>

He actualizado `PLAN.md` en el Project con el estado al 25/11: H0–H5 hechos y H6 planificado. En el flujo del run he añadido «Testing escribe los pasos» después de aprobar el plan y «pr-check» antes de la vista previa.

**Resumen:**
- El Orquestador planifica con Gemini, replanifica con el feedback y rechaza lo que está fuera de alcance sin crear rama ni PR.
- Develop escribe código real con la cadena Gemini → Anthropic. pr-check le devuelve los errores antes del build, y las tareas demasiado grandes vuelven al Orquestador para dividirse.
- En Testing, el veredicto lo da el spec fijo (`e2e/criteria.spec.ts`) que ejecuta los pasos JSON, no el LLM. Lo visual lo revisa el cliente en la aprobación final.

Antes de entregar conviene revisar un punto: la prueba dice que no hace falta gastar dinero, y Anthropic es un respaldo de pago. Yo dejaría claro en DECISIONES.md y en el README que la app funciona entera en la capa gratuita y que Anthropic solo entra si se agotan los proveedores gratuitos.

Ni `docs/PROCESO.md` del repo ni la copia `claude/PROCESO.md` del Project los he tocado, y el Whiteboard tampoco. La tabla del Whiteboard sigue con H5 como «Siguiente» y las cadenas de modelos sin actualizar. ¿Lo pongo al día también?

## ❯ Usuario

Actualiza este Whiteboard del plan de la prueba técnica de Speed Paradigm con el estado al 26/11/2026. Mantén la estructura y el estilo que ya tiene; cambia solo lo necesario.

1. Hitos: H0 a H6 hechos. H7 (panel completo) planificado, pendiente de implementar. H8 (entrega) pendiente.

2. Testing (H6), ya hecho, no planificado:
   - Testing traduce cada criterio e2e a pasos JSON declarativos (e2e/criteria/run-<id>.json), que entran en la misma cadena de commits.
   - Un spec fijo de crm-demo (e2e/criteria.spec.ts) los ejecuta con Playwright en GitHub Actions contra la vista previa, en escritorio y a 390 px.
   - El veredicto lo da el ejecutor, no el LLM. El LLM solo escribe los pasos y explica los fallos a Develop.
   - Cadena de modelos: Gemini → Groq → Anthropic. Máximo 3 iteraciones por tarea.
   - Los JSON fusionados se quedan en master como pruebas de regresión de los runs siguientes.
   - El panel formatea con Prettier lo que escribe Develop antes de hacer el commit.

3. H7 · panel completo (planificado), como una nota o grupo nuevo:
   - Petición del run de H7: «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo».
   - Tarjetas por agente (Orquestador, Develop, Testing y humano) con lo que hace cada uno ahora, calculadas con una función pura. Las esperas de GitHub y Vercel van en la tarjeta del agente que espera.
   - Tareas con sus criterios (pass o fail en escritorio y a 390 px), los pasos plegados y las regresiones aparte.
   - Línea de tiempo filtrable por agente, sin eventos repetidos y con los reintentos agrupados.
   - Vista previa en otra pestaña (sin iframe) y galería de capturas.
   - Móvil con pestañas y barra de acción fija; escritorio en dos columnas.
   - Las aprobaciones envían lo que el humano tiene en pantalla, no la versión del run.
   - Portada de /runs para los evaluadores, con peticiones sugeridas, límites del día y la cola.

4. En el flujo de un run, el paso de Playwright debe decir que ejecuta los pasos del run actual y los de runs anteriores, y que el ejecutor decide si cada criterio pasa.

## ● Claude

*Herramientas: lee sus notas de preferencias del Project; actualiza el Whiteboard del plan; lee el Whiteboard del plan.*

He actualizado el Whiteboard al 26/11:
- **Tabla de hitos:** H0–H6 aparecen como hechos y H7 como «Planificado»; el resaltado azul ha pasado a H7.
- **Flujo del run:** la caja de Testing dice ahora «escribe los pasos y explica los fallos». La de Playwright dice que ejecuta los pasos de este run y de los anteriores, y que el ejecutor decide si cada criterio pasa.
- **Testing (H6):** debajo de Testing, en el flujo, hay una nota con su funcionamiento.
- **H7:** grupo nuevo bajo la tabla de hitos, con la petición del run en un bloque y la lista de lo planificado.

Hay cuatro cosas que conviene que revises:
- **Fechas:** no me las diste, así que he puesto «Hecho 25/11» para H5 y «Hecho 26/11» para H6. Corrígelas si no son esas.
- **Leyenda:** la he cambiado a «Gemini; respaldo Groq y Anthropic», porque Develop y Testing ya tiran de Anthropic.
- **Nota bajo la tabla:** no la he tocado. Sigue hablando de Groq solo como respaldo del Orquestador, así que ha quedado algo desfasada.
- **Paso «Testing escribe los pasos»:** no lo he añadido como bloque propio después de aprobar el plan. Lo cuenta la nota de H6. Si lo quieres en el diagrama, tengo que mover la fila de Develop.

## ❯ Usuario

Actualiza este Whiteboard, que es el plan de mi prueba técnica (crm-agents). Respeta la estructura y el estilo que ya tiene: cambia solo lo que se ha quedado desfasado y añade lo que falta. No borres nada que siga siendo cierto.

Estado final: los hitos H0–H8 están todos hechos (23–26/11/2026).

1. Hitos: marca como hechos H5, H6, H7 y H8, con una línea para cada uno:
   - H5 · Develop: escribe código real (archivos completos, un commit por tarea). `pr-check.yml` de crm-demo genera la migración con drizzle-kit y devuelve a Develop los errores de tipos y lint antes del build de Vercel. Las tareas que no caben en la respuesta vuelven al Orquestador, que las divide.
   - H6 · Testing: traduce cada criterio e2e a pasos declarativos en JSON (sin código). Un ejecutor fijo de crm-demo (`e2e/criteria.spec.ts`) los ejecuta en la vista previa, a 1280 y a 390 px. El veredicto lo da el ejecutor, no el LLM. Testing explica los fallos a Develop, y los JSON fusionados quedan como pruebas de regresión.
   - H7 · Panel: tarjetas por agente (Orquestador, Develop, Testing y humano), tareas con sus criterios en los dos tamaños, línea de tiempo filtrable, vista previa en otra pestaña con capturas, pestañas en móvil, aprobaciones que envían lo que el humano ve en pantalla y portada con peticiones sugeridas.
   - H8 · Entrega: README, peticiones para los evaluadores, transcripciones revisadas y un run de punta a punta con el usuario de prueba hasta el merge (run #27).

2. Flujo de un run: que el diagrama refleje el flujo final.
   petición → Orquestador planifica (puede rechazarla si está fuera de alcance) → el humano aprueba el plan (o da feedback y se replanifica) → Testing escribe los pasos de cada criterio → Develop escribe una tarea por llamada → commits en la rama run/<id> → pr-check (migración, tipos y lint; si falla, vuelve a Develop) → vista previa en Vercel → Playwright en GitHub Actions (E2E existentes, criterios y regresión) → si algo falla, Testing lo explica y vuelve a Develop (máximo 3 iteraciones por tarea; después decide el humano) → el humano aprueba la vista previa final → merge squash en master de crm-demo → done.
   Si una tarea es demasiado grande, se divide sin pasar por el humano.

3. Modelos: una cadena proveedor:modelo por agente. Para la entrega va primero Claude Sonnet (Anthropic, de pago), y detrás Gemini y Groq en su capa gratuita. El sistema funciona solo con la cadena gratuita quitando las variables LLM_CHAIN_*.

4. Límites a la vista: 1 run activo y el resto en cola, 24 llamadas al LLM por run, 50 runs al día (el límite real son los ~100 despliegues diarios de Vercel Hobby) y un límite de gasto de 30 $ en Anthropic.

Si algo del Whiteboard contradice esto, corrígelo y dime al final qué has cambiado.

## ● Claude

*Herramientas: actualiza el Whiteboard del plan; lee el Whiteboard del plan.*

He actualizado el Whiteboard con el estado final: H0–H8 están hechos y el diagrama muestra el flujo definitivo de un run. He añadido una sección nueva, «Modelos y límites», debajo del flujo.

**Qué he cambiado:**
- **Tabla de hitos:**
  - H5–H8 están hechos, con una línea cada uno; he puesto las fechas 25/11 para H5 y 26/11 para H6–H8.
  - La columna «Verificado cuando…» se llama ahora «Resultado», porque las nuevas líneas describen lo hecho.
  - He quitado el resaltado azul, porque ya no queda un hito siguiente.
- **Nota bajo la tabla:** hablaba de la cuota de Gemini como riesgo actual. Ahora dice que todo está hecho y que el run #27 llegó hasta el merge.
- **H7:** el título del grupo pasa de «planificado» a «hecho». La petición y la lista no las he tocado.
- **Flujo del run:**
  - Paso nuevo «Testing escribe los pasos de cada criterio» entre la aprobación del plan y Develop. Develop, pr-check y lo que va detrás bajan un poco para hacerle sitio.
  - Flecha de feedback desde «¿Apruebas el plan?» al Orquestador, para la replanificación.
  - Develop dice «una tarea por llamada». Playwright dice «E2E existentes, criterios y regresión; el ejecutor decide si cada criterio pasa». Testing, abajo, dice «explica los fallos a Develop».
  - La flecha hacia la aprobación final dice «todo pasa (o tras 3 intentos)», y la de «no cabe → se divide» añade «(sin el humano)».
  - La píldora final dice «Merge squash en master de crm-demo → done».
- **Contradicciones corregidas:**
  - La leyenda decía «Gemini; respaldo Groq y Anthropic». Ahora dice «Claude Sonnet → Gemini → Groq».
  - La nota de Testing llevaba la cadena antigua (Gemini → Groq → Anthropic) y hablaba de «escritorio y 390 px». Ahora dice «a 1280 y a 390 px» y que, tras 3 iteraciones, decide el humano. La cadena de modelos ha pasado a la sección nueva.

He dejado la flecha de feedback de la aprobación final hacia el Orquestador, aunque no aparece en el flujo que me pasaste. Si en la versión final ya no existe, dímelo y la quito.
