# Sesión 08 · Planificación de H4 (Project de Claude) · 24/11/2026

Conversación «Hito 3 y límites de modelos» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `CLAUDE.md`, `DECISIONES.md`, `PROCESO.md`.*

El hito 3 está terminado. En docs de crm-agents está la sesion de Claude Code exportada, y aquí te dejo las últimas docs del repo actualizadas para que sigamos trabajando en el siguiente hito

## ● Claude

Actualizo los docs del Project con estas versiones y preparo la planificación de H4 (Orquestador con `GeminiProvider`).

*Herramientas: actualiza `claude/CLAUDE.md` en el Project; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; lee `claude/PLAN.md` del Project; lee `PRUEBA.md` del Project; lee sus notas de preferencias del Project; lee `claude/CLAUDE.md` del Project; lee `claude/DECISIONES.md` del Project; lee `claude/PROCESO.md` del Project.*

Ya los tengo leídos; ahora sí los sustituyo por tus versiones nuevas.

*Herramientas: actualiza `claude/CLAUDE.md` en el Project; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; busca en la web «Gemini API free tier rate limits models»; busca en la web «Gemini API structured output responseJsonSchema @google/genai»; lee https://ai.google.dev/gemini-api/docs/rate-limits; lee https://imisofts.com/blog/gemini-api-free-tier-limits/.*

He subido al Project tus versiones nuevas de CLAUDE.md, DECISIONES.md y PROCESO.md. Antes de proponerte nada para H4 he comprobado la cuota gratuita de Gemini, y cambia bastante el planteamiento.

## La cuota gratuita de Gemini es muy justa

- Google ya no publica las cifras y te manda a mirarlas en AI Studio. Las cuotas diarias se reinician a medianoche hora del Pacífico (las 9:00 en Madrid) y se aplican por proyecto, no por clave.
- Un artículo que copió lo que AI Studio mostraba para un proyecto gratuito el 21/10 da 5 RPM y 20 peticiones al día para Gemini 3.8 Flash, 3.6 Flash, 3 Flash y 2.5 Flash; 15 RPM y 500 al día para 3.5 Flash-Lite y 3.1 Flash-Lite; y 0 para los Pro.
- **Qué supone para nosotros:** un run real hace como mínimo un plan, una llamada de Develop por tarea y una de Testing por iteración, unas 5 a 10 llamadas. Con Flash solo caben 2 a 4 runs al día, contando los de los evaluadores. Además, el tope actual de 30 llamadas por run es mayor que toda la cuota diaria de Flash.

## Propuesta para H4

**Alcance:** el Orquestador pasa a usar Gemini de verdad. Develop y Testing siguen con el mock, así que un run con un plan real llega hasta el merge escribiendo `agent-runs/…`.

**D26 · `GeminiProvider` y cuota**
- SDK `@google/genai` con `generateContent`. Gemini recibe un JSON Schema sacado del contrato Zod y después validamos con Zod. Si no valida, se hace una sola llamada de reparación con el error.
  - Hay quejas de que los ejemplos de la doc no coinciden con los tipos del SDK actual. Claude Code tendrá que mirar los tipos instalados.
- Cada agente tiene una lista de modelos en una variable: `GEMINI_MODELS_ORCHESTRATOR=gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite`. Cuando uno agota su cuota diaria, se pasa al siguiente. Esto supone que la cuota es por modelo, y está por confirmar.
- `agent_steps` guarda el modelo, los tokens y la latencia de cada llamada.
- **429 por minuto:** el paso no se queda esperando. Se aplaza el lease hasta el `retryDelay` que da la API y el sweep lo retoma. No cuenta para los 3 fallos de D22.
- **429 diario en el último modelo de la lista:** el run pasa a `blocked` con el mensaje «Cuota de Gemini agotada, se renueva a las 9:00», y queda el botón de reintentar.
- Cada llamada tiene un timeout de 60 s, y el Orquestador piensa lo mínimo.
- La clave va en un proyecto de Google sin facturación. Si el proyecto tiene facturación, deja de ser gratis.
- En la capa gratuita Google puede usar los prompts. Es aceptable porque los datos son ficticios, y conviene anotarlo.

**D27 · Qué ve el Orquestador**
- La petición, el `AGENTS.md` de `crm-demo`, el árbol de rutas (Git Trees API), `src/db/schema.ts` y `e2e/pages.ts`. Todo se lee en el sha de `master` al empezar, y ese sha se guarda en el run como base.
- No lee el código entero: su trabajo es planificar, no programar.
- La UI enseña qué ha leído el agente.

**D28 · Contrato del plan (revisión del de H3)**
- El Orquestador puede rechazar la petición con `feasible: false` y un motivo. Sirve para peticiones fuera del CRM, que toquen `.github/**` o que pidan claves o servicios de pago. El run pasa a `rejected` sin crear rama. Hace falta una transición nueva, `planning → rejected`.
- El plan lleva:
  - `summary` para el cliente, en español.
  - `assumptions`.
  - De 1 a 4 tareas, cada una con título, descripción para Develop, archivos previstos y criterios con id.
- Cada criterio es de tipo `e2e` (se comprueba en el DOM con `data-testid`) o `visual` (se comprueba con las capturas). Si se crea una página nueva, la tarea la añade a `e2e/pages.ts` para que salga en las capturas.
- Los archivos previstos se comprueban contra `paths.ts` ya en el plan.

**D29 · Volver a planificar**
- **Feedback en el plan,** cuando aún no hay código: el Orquestador hace un plan completo que sustituye al anterior.
- **Feedback en la vista previa final:** el plan solo añade tareas nuevas o correctivas sobre la rama. El Orquestador recibe el plan anterior, el estado de cada tarea y el feedback.

**D30 · Probar sin gastar cuota**
- En CI solo se usan el mock y respuestas de Gemini grabadas. Con ellas se prueban el parseo, la reparación, la lista de modelos y los 429.
- `pnpm eval:plan` se lanza a mano: manda las 4 peticiones de D14 a Gemini y guarda los planes en `docs/evals/` como prueba para los evaluadores.

## Criterio de H4
1. En producción, las cuatro peticiones de D14 (NIF, buscador, facturas vencidas y página de contacto) dan planes válidos de 1 a 4 tareas con criterios que se pueden comprobar.
2. Un plan rechazado con feedback da una revisión 2 que lo recoge. Al aprobarlo, el run sigue con el mock hasta `done`.
3. Una petición fuera de alcance acaba en `rejected` con su motivo, sin rama ni PR.
4. Repetir un paso no vuelve a llamar a Gemini, y las llamadas cuentan para `LLM_CALLS_PER_RUN`.
5. El modelo, los tokens y la latencia de cada llamada se ven en la línea de tiempo.

**Lo que tienes que hacer tú antes de Claude Code:**
- Crear la clave en AI Studio, en un proyecto sin facturación, y apuntar los límites que te muestra. Así confirmamos si la cuota es por modelo.
- Añadir `GEMINI_API_KEY` en Vercel para Production, Preview y Development, sin pegarla nunca en el chat.

**Dos cosas que tienes que decidir tú:**
1. **Modelos del Orquestador.** Te recomiendo la lista Flash → Flash-Lite. La otra opción es Flash-Lite directamente, para guardar la cuota de Flash para Develop en H5.
2. **Límites.** Te propongo bajar `LLM_CALLS_PER_RUN` de 30 a unas 12 y `RUNS_PER_DAY` de 10 a unos 5, para que la cuota aguante el día que lo prueben los evaluadores.

Cuando lo decidas, apunto D26–D30 en DECISIONES, añado la sesión 08 a PROCESO y actualizo PLAN.md, que sigue diciendo que vamos por H0. También pondré al día el Whiteboard.

## ❯ Usuario

Ya está la clave creada y configurada en Vercel. Adelante con esos modelos si crees que es lo idóneo al igual que los límites.

Sobre los límites que aparecen en que hay en AI Studio:

3.8 Flash: 5 RPM, 250K TPM y 20 RPD.
3.6 Flash: igual.
3.5 Flash Lite: 15 RPM, 250K TPM y 500 RPD.

3.8 y 3.6 no aparecen como Flash Lite por eso no te los menciono.

## ● Claude

Registro las decisiones D26–D30, la sesión 08 y el estado de PLAN.md. Los límites de AI Studio confirman lo que hacía falta: cada modelo tiene su propia cuota.

*Herramientas: ejecuta un comando en su entorno; consulta los artifacts; lee `DECISIONES.md`; lee `PLAN.md`; lee `PROCESO.md`; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; actualiza `claude/PLAN.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

He registrado las decisiones de H4 (D26–D30) y la entrada de la sesión 08 con su criterio. Lo tienes en el Project y en los dos archivos que te he enviado, que van a `docs/` de `crm-agents`. También he puesto `PLAN.md` al día: decía que íbamos por H0.

**Resumen de lo decidido:**
- **Modelos y cuota:** el Orquestador usa la lista `gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash-lite`. Los límites que has visto en AI Studio confirman que cada modelo tiene su propia cuota, así que salen 40 llamadas al día con Flash y 500 más con Flash-Lite. Los 429 por minuto se reintentan con el lease, sin contar como fallo. Bajan los límites a 5 runs al día y 12 llamadas por run.
- **Lo que recibe el Orquestador:** `AGENTS.md`, el árbol de rutas, el esquema y `pages.ts`, todo leído en un sha fijo de `master`. No recibe el código completo.
- **El plan:** tiene de 1 a 4 tareas con criterios `e2e` o `visual`. El Orquestador puede rechazar una petición fuera de alcance, y entonces el run termina en `rejected` sin crear rama. Con feedback en el plan rehace el plan entero; con feedback en la vista previa final solo añade tareas.

**Antes de abrir Claude Code:** desde aquí no puedo editar el Whiteboard, porque se creó en otra sesión. Para actualizarlo, ábrelo y abre un chat desde su propia página; desde ahí sí se puede cambiar.

Si te sirve, puedo redactarte el mensaje de arranque de la sesión 09 de Claude Code, con el alcance y el criterio de H4.

## ❯ Usuario

Sí

## ● Claude

Te lo dejo listo para pegar en Claude Code:

```markdown
Sesión 09 · H4 · Orquestador con GeminiProvider

Contexto: lee CLAUDE.md, docs/DECISIONES.md (sobre todo D8, D21–D24 y las nuevas D26–D30) y la entrada «Sesión 08» de docs/PROCESO.md. Antes, copia en docs/ las versiones nuevas de DECISIONES.md y PROCESO.md que te paso.

Objetivo: el Orquestador planifica con Gemini de verdad. Develop y Testing siguen con MockProvider, así que un run con plan real llega hasta el merge escribiendo agent-runs/.

Alcance:
1. GeminiProvider (D26)
   - @google/genai con generateContent, responseMimeType "application/json" y un JSON Schema generado desde el contrato Zod. Sigue los tipos del SDK instalado, no los ejemplos de la doc, que están desfasados.
   - Validar con Zod. Si no valida, una sola llamada de reparación con el error de Zod; cuenta en el presupuesto.
   - Lista de modelos por agente: GEMINI_MODELS_ORCHESTRATOR=gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite.
   - Proveedor por agente: LLM_PROVIDER_ORCHESTRATOR=gemini; Develop y Testing siguen en mock. LLM_PROVIDER=mock fuerza el mock en todos (plan B).
   - 429 por minuto: no esperar dentro de la función. Aplazar el lease hasta el retryDelay y que lo retome el sweep, sin contar como fallo para los 3 de D22.
   - 429 diario: pasar al siguiente modelo. Si no queda ninguno, el run pasa a blocked con «Cuota de Gemini agotada; se renueva a las 9:00».
   - Timeout de 60 s por llamada y razonamiento al mínimo.
   - agent_steps guarda el modelo, los tokens (entrada y salida) y la latencia.
   - Límites por defecto: RUNS_PER_DAY=5 y LLM_CALLS_PER_RUN=12.
2. Contexto del Orquestador (D27)
   - La petición, más AGENTS.md, el árbol de rutas (Git Trees API, recursivo), src/db/schema.ts y e2e/pages.ts de crm-demo.
   - Todo leído en el sha de master al empezar el run. Ese sha se guarda en el run como base de run/<id>.
   - Guarda las rutas leídas para que la UI las muestre.
3. Contrato del plan (D28): amplía el contrato Zod de H3.
   - feasible: false con un motivo lleva el run a rejected, sin rama ni PR. Es una transición nueva planning → rejected en machine.ts, con su fila en la tabla de tests.
   - summary y assumptions en español.
   - De 1 a 4 tareas, cada una con título, descripción para Develop, archivos previstos (comprobados contra paths.ts) y criterios con id y tipo e2e | visual.
   - Si se crea una página, la tarea incluye añadirla a e2e/pages.ts.
4. Replanificación (D29)
   - Feedback en el plan: plan completo que sustituye al anterior.
   - Feedback en la vista previa final: solo tareas nuevas o correctivas sobre la misma rama. El Orquestador recibe el plan anterior, el estado de cada tarea y el feedback.
5. Prompt del Orquestador en un archivo propio (src/server/agents/prompts/), en español, con las reglas de alcance de AGENTS.md y de paths.ts.
6. UI en /runs/[id]
   - Plan con resumen, supuestos, tareas y criterios con su tipo.
   - Motivo del rechazo cuando el plan no es viable.
   - Archivos leídos por el Orquestador.
   - En la línea de tiempo, modelo, tokens y latencia de cada llamada.
   - El selector de escenario del mock solo se muestra si Develop o Testing son el mock.
7. Pruebas (D30)
   - Vitest solo con el mock y respuestas de Gemini grabadas: parseo, reparación, salto de modelo, los dos tipos de 429, feasible: false y caché de agent_steps. Nada en CI llama a Gemini.
   - pnpm eval:plan, a mano: lanza las cuatro peticiones de D14 (NIF de clientes, buscador, facturas vencidas marcadas y página de contacto) contra Gemini y guarda los planes en docs/evals/.

Criterio de H4, comprobado en producción:
1. Las cuatro peticiones de D14 dan planes válidos de 1 a 4 tareas con criterios comprobables.
2. Un plan rechazado con feedback da una revisión 2 que lo recoge. Al aprobarlo, el run sigue con el mock hasta done.
3. Una petición fuera de alcance (por ejemplo, «cambia el workflow de GitHub Actions») acaba en rejected con su motivo, sin rama ni PR.
4. Repetir un paso no vuelve a llamar a Gemini, y las llamadas cuentan en LLM_CALLS_PER_RUN.
5. Modelo, tokens y latencia de cada llamada visibles en la línea de tiempo.

Cuota: solo hay 20 peticiones al día por modelo Flash (se renuevan a las 9:00). Cuenta las llamadas reales que vayas haciendo y no lances pruebas contra Gemini que el mock pueda cubrir.

Variables: GEMINI_API_KEY ya está en Vercel (Production, Preview y Development); tráela con vercel env pull. Documenta las variables nuevas en .env.example. Nunca me pidas la clave por el chat.

Forma de trabajar: como en sesiones anteriores, propón primero el plan de commits y las decisiones de detalle, y empieza tras mi visto bueno. Antes de cerrar: lint, tipos y tests en verde, el criterio comprobado en producción, la entrada en PROCESO.md, la transcripción saneada en docs/sesiones/09-h4-orquestador.md y CLAUDE.md actualizado.
```

He añadido dos cosas que no estaban en la sesión 08:
- **Petición fuera de alcance:** el criterio 3 lleva un ejemplo concreto para que se pueda reproducir.
- **Cuota:** hay un aviso para que Claude Code no gaste las 20 llamadas diarias de Flash probando con Gemini lo que el mock ya cubre.
