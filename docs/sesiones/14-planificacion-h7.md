# Sesión 14 · Planificación de H7 (Project de Claude) · 26/11/2026

Conversación «Run 24 cancelado y PROCESO.md» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md`.*

H6 ya ha terminado, aunque el run 24 lo hemos cancelado. Te adjunto las docs del repo

## ● Claude

Actualizo las copias del Project con las del repo y repaso lo que queda abierto para empezar H7.

*Herramientas: actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; actualiza `claude/CLAUDE.md` en el Project; lee sus notas de preferencias del Project; lee `PRUEBA.md` del Project; lee `claude/PLAN.md` del Project; lee `DECISIONES.md`; lee `PROCESO.md`; lee `CLAUDE.md`; lee `claude/CLAUDE.md` del Project; lee `claude/PROCESO.md` del Project; lee `claude/DECISIONES.md` del Project; actualiza `claude/PLAN.md` en el Project.*

<details><summary>claude/PLAN.md</summary>

```markdown
# Plan — prueba técnica Speed Paradigm

Estado al 26/11/2026: **H0–H6 hechos**. El Orquestador planifica, Develop escribe código real en `crm-demo` y Testing comprueba cada criterio en la vista previa. Siguiente: **H7 · panel completo**, por planificar.

Copias en el proyecto de los documentos del repo `crm-agents`:
- `claude/DECISIONES.md` ← `docs/DECISIONES.md`
- `claude/PROCESO.md` ← `docs/PROCESO.md`
- `claude/CLAUDE.md` ← `CLAUDE.md`

## Resumen
- **Orquestador** (Gemini → Anthropic → Groq): divide la petición en tareas con criterios, `data-testid` y referencias. Replanifica con el feedback del cliente y rechaza lo que está fuera de alcance, sin crear rama ni PR.
- **Develop** (Gemini → Anthropic):
  - Escribe código real en `crm-demo`: rama `run/<id>`, un commit por tarea y un PR por run.
  - El panel formatea con Prettier lo que escribe antes del commit (D41).
  - Las tareas demasiado grandes vuelven al Orquestador para dividirse.
- **pr-check.yml** (GitHub Actions): genera la migración y devuelve a Develop los errores de tipos y de lint antes del build de Vercel.
- **Testing** (Gemini → Groq → Anthropic):
  - Traduce cada criterio e2e a pasos JSON declarativos (`e2e/criteria/run-<id>.json`).
  - Un spec fijo de `crm-demo` (`e2e/criteria.spec.ts`) los ejecuta con Playwright en Actions contra la vista previa, en escritorio y a 390 px.
  - **El veredicto lo da el ejecutor, no el LLM.** El LLM solo escribe los pasos y explica los fallos.
  - Máximo 3 iteraciones por tarea. Los JSON fusionados quedan como pruebas de regresión.
  - De momento solo hay criterios e2e: lo visual lo revisa el cliente en la aprobación final.
- **Máquina de estados**: los webhooks de GitHub mueven el run, guardado en Neon, con CAS, lease y sweep (sin cron).
- Repos, proyectos de Vercel y de Neon separados para `crm-agents` (panel) y `crm-demo` (CRM, con una rama de Neon por vista previa).
- Límites: 5 runs al día y 16 llamadas al LLM por run.

## Flujo de un run
1. **Petición** del cliente.
2. **Orquestador** planifica tareas, criterios, `data-testid` y referencias. Si la petición está fuera de alcance, se rechaza sin crear rama ni PR.
3. **El cliente aprueba el plan**. Si da feedback, el Orquestador replanifica.
4. **Testing escribe los pasos**: cada criterio e2e se traduce a pasos JSON.
5. **Develop** escribe el código, con un commit por tarea en `run/<id>` y un PR. Si una tarea no cabe, vuelve al Orquestador para dividirse.
6. **pr-check**: migración, tipos y lint. Si hay errores, vuelven a Develop.
7. **Vista previa** de Vercel.
8. **Webhook → Playwright** en Actions ejecuta `e2e/criteria.spec.ts` con los pasos de este run y de los anteriores. El ejecutor decide si cada criterio pasa. Si algo falla, Testing explica el fallo y vuelve a Develop (máximo 3 iteraciones por tarea).
9. **El cliente aprueba la vista previa final**, incluida la revisión visual. Después, merge squash y producción.

## Hitos
H0 base ✅ · H1 CRM demo ✅ · H2 tubería sin IA ✅ · H3 motor de runs ✅ · H4 Orquestador ✅ · H5 Develop ✅ · H6 Testing ✅ · H7 panel completo · H8 entrega.

## Pendiente
- H7: panel completo y run real de principio a fin en móvil y escritorio. Necesita una petición de demo nueva.
- H8: entrega, incluidas las 4 preguntas.

Whiteboard: [enlace privado al Whiteboard]
```

</details>

Ya tengo las tres docs leídas. Pero solo he podido actualizar parte de las copias del Project:

- **Actualizados:** `claude/CLAUDE.md` y `claude/PLAN.md`. En el plan, H6 ya aparece como hecho y H7 como lo siguiente.
- **No actualizados:** `claude/DECISIONES.md` y `claude/PROCESO.md` (hoy van por D40 y por la sesión 12). La herramienta no me deja subirlos desde aquí porque son demasiado grandes y no puedo leerlos de una sola vez. Sustitúyelos tú en el Project subiendo las versiones del repo.

**Cosas sueltas que he visto en las docs:**
- Siguen pendientes dos tareas que anotamos en la sesión 12:
  - Los apartados de D37 y del push de prueba siguen dentro de la sesión 08 de `PROCESO.md`, cuando corresponden a la sesión 11.
  - A D10 le falta el extra que remite a D37.
- Habría que comprobar en Vercel que `RUNS_PER_DAY` ha vuelto a 5. En la sesión 09 lo pusimos en 15 de forma temporal.
- En la sesión 13, el criterio 3 dice que el run #24 «volvió al humano», pero no que lo cancelaste. Basta con media línea.
- El Whiteboard sigue en H6 «planificado». Como siempre, hay que actualizarlo desde su propia página.

**Para empezar H7**, el criterio es «run real de principio a fin en móvil y escritorio». La prueba pide además que en pantalla se vea qué hace cada agente y en qué estado está cada tarea. Antes de decidir qué cambia en el panel, hay tres cosas que conviene tener claras:

1. **La petición de demo para el run de H7.** Ya no queda ninguna sin usar. Dos opciones:
   - **Teléfono del cliente en la lista y en el detalle.** Cambia el esquema, así que el run de punta a punta pasa también por la migración.
   - **Ordenar la lista de clientes por nombre o por fecha.** Es interacción sin migración: más rápido y menos riesgo.

   Aparte, convendría dejar 2 o 3 peticiones más preparadas para los evaluadores, como pedía D14.
2. **Qué falla hoy en la UI y conviene arreglar en H7:**
   - El botón de aprobar no hace nada si el run ha cambiado mientras la página estaba abierta.
   - La línea de tiempo repite «lee N archivos» con cada reintento.
   - Falta revisar cómo se ve `/runs/[id]` a 390 px.
3. **Qué verá un evaluador que entra sin contexto.** Por ejemplo, una vista por agente con su estado actual, la vista previa embebida (D6 ya lo permite) y la cola visible.

¿Por dónde quieres empezar: por la petición de demo o por lo que tiene que mostrar el panel?

## ❯ Usuario

RUNS_PER_DAY ya ha vuelto a 5. Y sí, el #24 lo cancelé. 

Vamos a empezar por la petición de demo

## ● Claude

Te propongo una petición para el run de H7 y otras tres para dejar preparadas a los evaluadores. Todas cumplen la regla del extra de D14: se pueden comprobar en el DOM sin depender de cifras del seed.

**Para el run de H7, recomiendo el tipo de cliente:**

> «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo.»

- **Pasa por todo el motor en un solo run.** Saldrían dos tareas: la primera cambia el esquema y genera el commit de la migración, y la segunda es la interacción del filtro. Los JSON de runs anteriores se ejecutan también como regresión.
- **Es fácil de comprobar sin depender del seed.** Los pasos crean un cliente de tipo Empresa, filtran por Empresa y comprueban con `expectText all` que todas las filas lo dicen. Es el mismo patrón que funcionó con el filtro de facturas del run #20.
- **El resultado se ve bien a 1280 y a 390 px:** una columna o etiqueta nueva y un desplegable.
- **El riesgo es moderado.** Dos tareas con migración gastan más cuota que una petición pequeña. Si sale mal en directo, cuesta más repetirlo.

**La alternativa más segura es el recuento de presupuestos del run #24:**

> «Muestra en el detalle de un cliente cuántos presupuestos tiene.»

Como cancelaste el #24, esa petición sigue sin estar en `master`. Es una sola tarea, sin migración, y Develop ya la resolvió bien; lo que fallaba era la simulación. El inconveniente es que no enseña ni la migración ni la división en tareas.

**Para los evaluadores**, propongo dejar estas en el README:
- **Ordenar la lista de clientes** por nombre o por fecha de alta, con un desplegable. Es interacción sin esquema.
- **Teléfono del cliente** en el formulario y en el detalle. Cambia el esquema.
- **El recuento de presupuestos**, si no lo usamos en H7.
- **Una petición fuera de alcance**, como «cambia el workflow de GitHub Actions», para que vean cómo se rechaza sin crear rama ni PR.

**Una cosa a decidir más adelante, seguramente en H8:** cada petición que un evaluador fusiona deja de servir al siguiente, porque la función ya está en `master`. Habrá que pensar si los evaluadores no deben fusionar o si les damos peticiones de sobra.

¿Vamos con el tipo de cliente para H7, o prefieres la opción segura del recuento?

## ❯ Usuario

Vamos con el tipo de cliente

## ● Claude

Queda decidido: el run de H7 será el tipo de cliente.

**Resumen de la decisión:**
- **La petición de H7** es «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo».
- **Por qué esta:** en un solo run pasa por la migración, una interacción, dos tareas y la regresión de los JSON anteriores.
- **Lo que no se ha cerrado:** la lista de peticiones para los evaluadores queda como propuesta y se cierra en H8.

`PROCESO.md` no lo puedo editar desde aquí: el Project no me deja subirlo por tamaño y el repo está en Claude Code. Te dejo el texto de la entrada para el repo, y si quieres lo repites en la entrada de la sesión 14 en `PROCESO.md`:

```markdown
**Extra (26/11/2026, sesión 14):** el run de H7 usa «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo». En un solo run hay migración, interacción, dos tareas y la regresión de los JSON anteriores. Los pasos crean su propio cliente de tipo Empresa y comprueban el filtro con `expectText all`, sin depender del seed. El recuento de presupuestos del run #24 (cancelado) no está en `master` y queda libre. La lista de peticiones para los evaluadores se cierra en H8.
```

**Lo siguiente es qué muestra el panel.** Hoy ya tiene el formulario, la cola, las tareas y la línea de tiempo, pero está pensado para depurar, no para alguien que entra sin contexto. Te propongo esto, de más a menos importante:

1. **Tarjetas por agente** arriba de `/runs/[id]`: Orquestador, Develop, Testing y el humano. Cada una dice qué está haciendo ahora («Develop · tarea 2 · iteración 1»), en qué estado está y qué modelo usa. Es lo que pide la prueba de forma literal.
2. **Tareas con sus criterios**: cada tarea con su estado y su iteración, y debajo cada criterio con pass o fail en escritorio y a 390 px.
3. **Una línea de tiempo filtrable por agente**, sin el ruido de «lee N archivos» repetido.
4. **La vista previa embebida y las capturas** en la aprobación final (D6 ya lo permite).
5. **Móvil con pestañas** en `/runs/[id]` (Agentes, Tareas, Línea de tiempo, Vista previa), en vez de apilar todo.
6. **Arreglar las aprobaciones con la versión vieja**: refrescar el run y avisar, en vez de que el botón no haga nada.
7. **Una portada en `/runs` para los evaluadores**: dos líneas de cómo funciona y las peticiones sugeridas en botones que rellenan el formulario.

Los puntos 1, 2, 5 y 6 los veo imprescindibles para el criterio de H7. ¿Los entramos todos o recortamos alguno?

## ❯ Usuario

Iría con todos los puntos. Y actualiza PROCESO.md con esa línea.

## ● Claude

*Herramientas: ejecuta un comando en su entorno; lee `PROCESO.md`.*

No he podido actualizar `PROCESO.md` en el Project. La herramienta pide leer el archivo entero de una vez, y con unos 28.000 tokens pasa del límite de lectura que tengo aquí; con `DECISIONES.md` pasa lo mismo. Así que te dejo la entrada de la sesión 14 lista para pegar al final de `docs/PROCESO.md` en el repo. La copia del Project quedará al día cuando subas la versión del repo.

Ya incluye la línea del tipo de cliente y la decisión de entrar los siete puntos del panel:

```markdown
## Sesión 14 · Planificación de H7 (Project de Claude) · 26/11/2026

**Objetivo:** decidir la petición de demo del run de H7 y qué debe mostrar el panel para que alguien sin contexto vea qué hace cada agente y en qué estado está cada tarea.

**Cómo fue:**
- Se actualizaron en el Project las copias de `CLAUDE.md` y `PLAN.md` con las del repo tras H6. `DECISIONES.md` y `PROCESO.md` no se pudieron subir desde la sesión por su tamaño; las sustituye el humano.
- Comprobado por el humano: `RUNS_PER_DAY` ha vuelto a 5, y el run #24 se canceló después de bloquearse (criterio 3 de H6).

**Qué cambió por el camino:**
- **Petición de H7:** no quedaba ninguna de demo sin usar. Claude propuso dos: el tipo de cliente, que pasa por todo el motor, y el recuento de presupuestos del run #24, más segura porque es una sola tarea sin migración. El humano eligió el tipo de cliente: «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo». En un solo run hay migración, interacción, dos tareas y la regresión de los JSON anteriores. Los pasos crean su propio cliente de tipo Empresa y comprueban el filtro con `expectText all`, sin depender del seed (extra de D14). El recuento de presupuestos no está en `master` y queda libre.
- **Panel:** Claude propuso siete puntos y marcó como imprescindibles el 1, el 2, el 5 y el 6. El humano decidió entrarlos todos:
  1. Tarjetas por agente (Orquestador, Develop, Testing y el humano) con lo que hace ahora, su estado y el modelo.
  2. Tareas con sus criterios, y pass o fail en escritorio y a 390 px.
  3. Línea de tiempo filtrable por agente, sin repetir «lee N archivos».
  4. Vista previa embebida y capturas en la aprobación final (D6).
  5. Pestañas en móvil para `/runs/[id]`.
  6. Aprobaciones con la versión vieja: refrescar y avisar en vez de no hacer nada.
  7. Portada de `/runs` para los evaluadores, con cómo funciona y las peticiones sugeridas en botones.

**Pendiente:**
- Extra de D14 en `DECISIONES.md` con la petición de H7.
- En el repo, de la sesión 12: pasar los apartados de D37 y del push de prueba de la sesión 08 a la sesión 11, y añadir a D10 un extra que remita a D37.
- Lista de peticiones para los evaluadores y si pueden fusionar: en H8.
- Whiteboard del plan, que sigue en H6 planificado.

**Siguiente paso:** concretar los siete puntos del panel y el criterio de H7.
```

**Resumen de la decisión:** H7 entra con los siete puntos del panel. Así se cubre lo que pide la prueba, que en pantalla se vea qué hace cada agente y en qué estado está cada tarea, y el run del tipo de cliente se puede seguir de punta a punta en móvil y escritorio.

Lo siguiente es concretar esos puntos. Empezaría por las tarjetas por agente, porque son lo que pide la prueba de forma literal. Para cada agente hay que decidir qué estados enseña («esperando», «trabajando en la tarea X, iteración Y», «hecho», «bloqueado») y de dónde salen: del estado del run, de `agent_steps` o de `run_events`. ¿Te parece?

## ❯ Usuario

Ya he actualizado PROCESO.md en el project, también lo he dejado actualizado en el repo.

## ● Claude

Perfecto, gracias. La copia de `claude/DECISIONES.md` del Project sigue siendo la de antes de H6. Cuando puedas, súbela también.

Para las tarjetas por agente propongo esto:

**De dónde sale el estado:** de los datos que ya hay, sin tablas ni columnas nuevas. Una función pura, `agentCards(run, tasks, steps, events)`, toma el estado del run (D21), las tareas con su iteración, las últimas filas de `agent_steps` por agente y los últimos `run_events`. Se prueba con una tabla en Vitest, como `machine.ts`. Así una tarjeta nunca puede contradecir a la máquina de estados.

**Qué enseña cada tarjeta:**

| Agente | Estados |
|---|---|
| **Orquestador** | Planificando (revisión N, con el modo: nuevo plan, añadir tareas o dividir) · Plan listo · Petición rechazada (con el motivo) · En espera |
| **Develop** | Escribiendo la tarea X (iteración Y) · Corrigiendo la tarea X (iteración ≥ 2, con el motivo) · Esperando `pr-check` · Hecho · Bloqueado · En espera |
| **Testing** | Escribiendo los pasos · Esperando la vista previa (build de Vercel, luego Playwright en Actions) · Explicando N fallos · Todo en verde (N de N criterios) · En espera |
| **Humano** | Tiene que aprobar el plan · Tiene que aprobar la vista previa final · Tiene que decidir sobre una tarea bloqueada · Nada pendiente |

**En cada tarjeta, además:**
- **El modelo de la última llamada** (por ejemplo `gemini-3.6-flash`), con la marca de «respaldo de pago» cuando la hace Anthropic, como ya hace la línea de tiempo.
- **Cuánto lleva en ese estado** («hace 2 min»), para que se vea que el run avanza durante las esperas largas.
- **El motivo de la espera** cuando el paso está aplazado: «Gemini saturado, se reintenta en 90 s» o «límite por minuto». Sale del último evento.
- **La tarjeta activa resaltada.** En móvil, las cuatro van en una rejilla de 2×2 encima de las pestañas, siempre visibles.

**Las esperas de GitHub y de Vercel no tendrían tarjeta propia.** Van dentro de la tarjeta del agente que espera: `pr-check` en Develop, y el build y Playwright en Testing. Una quinta tarjeta, «Infraestructura», sería más exacta, pero añade ruido, y la prueba habla de tres agentes.

Hay dos cosas a decidir:
1. ¿Las esperas de GitHub y Vercel van dentro de los agentes, como propongo, o en una tarjeta aparte?
2. ¿El estado se calcula con la función pura, como propongo, o prefieres guardarlo como una columna en el run?

## ❯ Usuario

Ya he subido también DECISIONES.md.

1. Si esas esperas interfieren en algún estado de los agentes, deberían deir dentro de los agentes claro.
2. Creo que con una función pura es suficiente.

## ● Claude

Queda decidido: las esperas van dentro de la tarjeta del agente al que afectan, y el estado se calcula con una función pura.

**Resumen:**
- Cuatro tarjetas en `/runs/[id]` (Orquestador, Develop, Testing y humano). Se calculan con `agentCards()` a partir del run, las tareas, `agent_steps` y `run_events`, sin columnas nuevas, con una tabla de casos en Vitest.
- Las esperas externas van en la tarjeta del agente que espera: `pr-check` en Develop, y el build de Vercel y Playwright en Testing.

`DECISIONES.md` y `PROCESO.md` siguen siendo demasiado grandes para que los reescriba desde aquí. Te dejo el texto de las dos cosas para el repo:

**D42, al final de `DECISIONES.md`:**
```markdown
## D42 · Tarjetas por agente calculadas con una función pura
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Contexto:** la prueba pide que en pantalla se vea qué hace cada agente y en qué estado está cada tarea. `/runs/[id]` tiene la línea de tiempo, pero no dice de un vistazo quién está trabajando ahora.

**Decisión** (propuesta de Claude, aprobada por el humano):
- Cuatro tarjetas arriba de `/runs/[id]`: Orquestador, Develop, Testing y el humano.
  - Orquestador: planificando (revisión y modo), plan listo, petición rechazada o en espera.
  - Develop: escribiendo o corrigiendo la tarea X (iteración Y), esperando `pr-check`, hecho, bloqueado o en espera.
  - Testing: escribiendo los pasos, esperando la vista previa (build de Vercel y Playwright en Actions), explicando fallos, todo en verde (N de N) o en espera.
  - Humano: aprobar el plan, aprobar la vista previa final, decidir sobre una tarea bloqueada o nada pendiente.
- Cada tarjeta muestra el modelo de la última llamada (con la marca de respaldo de pago), cuánto lleva en ese estado y el motivo de una espera aplazada (saturación o límite por minuto). La activa se resalta. En móvil van en una rejilla de 2×2 encima de las pestañas.
- Las esperas de GitHub y de Vercel no tienen tarjeta propia: van en la del agente que espera.
- El estado lo calcula una función pura, `agentCards(run, tasks, steps, events)`, con una tabla de casos en Vitest. No hay columnas ni migraciones nuevas.

**Consecuencias:**
- Una tarjeta no puede contradecir a la máquina de estados (D21), porque se deriva de ella.
- Si cambia la máquina, hay que actualizar también la tabla de casos de las tarjetas.
```

**En la sesión 14 de `PROCESO.md`, dentro de «Qué cambió por el camino»:**
```markdown
- **Tarjetas por agente (D42):** Claude propuso calcular el estado con una función pura y meter las esperas de GitHub y Vercel en la tarjeta del agente que espera, en vez de añadir una tarjeta «Infraestructura». El humano lo aprobó: si una espera afecta al estado de un agente, va en su tarjeta.
```

Para no tener que pegar trozos después de cada decisión, puedo ir acumulando y darte al final de la planificación un solo bloque con todo lo de la sesión 14. ¿Te viene mejor así?

**El siguiente punto es el 2, las tareas con sus criterios.** Propongo:
- **Cada tarea** con su estado, su iteración («2 de 3»), el enlace a su commit y los archivos que ha tocado, marcando los que quedan fuera del plan.
- **Debajo, sus criterios.** Cada uno con su texto y un resultado por tamaño (escritorio y 390 px). Si falla, aparecen el `reason` de Testing y el paso que falló.
- **Los pasos de cada criterio**, plegados. Develop no los ve (D39), pero al humano le sirven para entender qué se comprueba.
- **Las regresiones** de runs anteriores en un grupo aparte: «Regresión: 12 de 12 en verde». Solo se despliega cuando algo falla.
- **Una tarea dividida** aparece con sus subtareas debajo, para que se vea la reorganización de D34.

¿Te cuadra o cambiarías algo?

## ❯ Usuario

No te preocupes. Lo voy a añadiendo de 1 en 1.

Me cuadra.

## ● Claude

El punto 2 queda así.

**Resumen:**
- Cada tarea muestra su estado, su iteración, el enlace a su commit y los archivos que ha tocado, marcando los que quedan fuera del plan. Debajo van sus criterios con el resultado en escritorio y a 390 px, el motivo y el paso que falló, y los pasos plegados.
- Las regresiones de runs anteriores van en un grupo aparte que solo se despliega cuando algo falla. Una tarea dividida muestra sus subtareas debajo.

**D43, para `DECISIONES.md`:**
```markdown
## D43 · Tareas y criterios en `/runs/[id]`
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Decisión** (propuesta de Claude, aprobada por el humano):
- Cada tarea muestra su estado, su iteración («2 de 3»), el enlace a su commit y los archivos que ha tocado, con los que quedan fuera del plan marcados (D34).
- Debajo van sus criterios, cada uno con su texto y su resultado en escritorio y a 390 px. Si falla, se ven el `reason` de Testing y el paso que falló (D39).
- Los pasos de cada criterio se muestran plegados. Develop no los ve (D39), pero al humano le sirven para entender qué se comprueba.
- Las regresiones de runs anteriores (D38) van en un grupo aparte, «Regresión: N de N en verde», que solo se despliega si algo falla.
- Una tarea dividida (D34) muestra sus subtareas debajo.
```

**Para la sesión 14 de `PROCESO.md`:**
```markdown
- **Tareas y criterios (D43):** Claude propuso la vista de cada tarea con sus criterios, los pasos plegados para el humano y las regresiones en un grupo aparte. El humano la aprobó sin cambios.
```

**El siguiente es el punto 3, la línea de tiempo filtrable.** Propongo:
- **Filtro por agente**, con botones para Todos, Orquestador, Develop, Testing y Humano. Los eventos de GitHub y de Vercel (`pr-check`, vista previa lista, informe de Playwright) se asignan al agente que los espera, con la misma regla que las tarjetas de D42. El filtro va en la URL (`?agente=develop`), así no se pierde con el polling y se puede compartir el enlace.
- **«Lee N archivos» se arregla en el origen.** El motor solo registra el contexto si ha cambiado respecto al último registrado para esa tarea e iteración. Era el pendiente de H5 y así no se guardan eventos repetidos.
- **Los reintentos se agrupan en la UI.** «Gemini saturado» cuatro veces seguidas se ve como una sola línea, «Gemini saturado ×4 · hace 6 min», que se puede desplegar. Esos eventos sí son reales y conviene guardarlos, así que solo se agrupan al mostrarlos.
- **Separadores por iteración** («Iteración 2»), para que se vea dónde empieza cada ronda entre Develop y Testing.

¿Lo dejamos así?

## ❯ Usuario

Sí

## ● Claude

La línea de tiempo queda así.

**Resumen:**
- La línea de tiempo se filtra por agente, con el filtro en la URL. Los eventos de GitHub y de Vercel se asignan al agente que los espera, igual que en D42.
- «Lee N archivos» solo se registra si el contexto cambia. Los reintentos se agrupan al mostrarlos («×4»), y hay separadores por iteración.

**D44, para `DECISIONES.md`:**
```markdown
## D44 · Línea de tiempo filtrable y sin ruido
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Decisión** (propuesta de Claude, aprobada por el humano):
- Filtro por agente: Todos, Orquestador, Develop, Testing y Humano. Los eventos de GitHub y de Vercel (`pr-check`, vista previa lista, informe de Playwright) se asignan al agente que los espera, con la regla de D42. El filtro va en la URL (`?agente=develop`), así no se pierde con el polling y el enlace se puede compartir.
- El motor solo registra el contexto leído («lee N archivos») si ha cambiado respecto al último registrado para esa tarea e iteración. Resuelve el pendiente de ruido de la sesión 11.
- Los reintentos seguidos (saturación, límite por minuto) se guardan todos, pero la UI los agrupa en una línea que se puede desplegar: «Gemini saturado ×4 · hace 6 min».
- Separadores por iteración, para ver dónde empieza cada ronda entre Develop y Testing.
```

**Para la sesión 14 de `PROCESO.md`:**
```markdown
- **Línea de tiempo (D44):** filtro por agente en la URL, el contexto solo se registra cuando cambia (pendiente de H5) y los reintentos se agrupan en la UI sin borrar los eventos. Propuesta de Claude, aprobada por el humano.
```

**El siguiente es el punto 4, la vista previa embebida.** Aquí hay un problema que conviene ver antes de decidir.

`crm-demo` tiene su propio login con cookie (D6). Dentro de un iframe, esa cookie es de terceros, porque los subdominios de `vercel.app` cuentan como sitios distintos. Una cookie `SameSite=Lax` no se envía en el iframe, así que **el login del CRM no se mantendría dentro del panel**. Se puede marcar como `SameSite=None; Secure` (y `Partitioned`), pero Safari, y con él cualquier iPhone, restringe mucho las cookies de terceros. No puedo prometer que funcione en móvil.

Opciones:
- **A. Iframe en todas partes**, cambiando la cookie de `crm-demo`. Funciona en Chrome y Firefox de escritorio; en Safari y en iOS es dudoso.
- **B. Sin iframe.** Un botón «Abrir vista previa» en otra pestaña, más la galería de capturas a 1280 y 390 px que ya llega al panel. Es lo más robusto.
- **C. Mixta.** Iframe solo en escritorio, con un selector de ancho (escritorio o 390 px) y la cookie cambiada. En móvil, el botón y las capturas, que es lo que se ve bien en una pantalla pequeña.

Recomiendo la **C**. En escritorio el evaluador prueba la función sin salir del panel, y en móvil no dependemos de cómo trata Safari las cookies. El cambio de la cookie lo haría Claude Code a mano en `crm-demo` y habría que probarlo en Chrome y en Safari de escritorio. Si Safari tampoco la acepta, en Safari de escritorio se pasa a la versión móvil.

¿Vamos con la C?

## ❯ Usuario

Optaría por la b). Al final siempre va a ser mucho mejor la vista previa real en otra pestaña.

## ● Claude

Queda decidido: la vista previa se abre en otra pestaña y no se embebe.

**Resumen:**
- El panel no embebe la vista previa. En la aprobación final muestra un botón «Abrir vista previa» en otra pestaña y la galería de capturas a 1280 y 390 px.
- Así no hay que tocar la cookie de `crm-demo` ni depender de cómo trata Safari las cookies de terceros.

**D45, para `DECISIONES.md`:**
```markdown
## D45 · La vista previa se abre en otra pestaña, sin iframe
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Contexto:** `crm-demo` tiene su propio login con cookie (D6). Dentro de un iframe del panel es una cookie de terceros (los subdominios de `vercel.app` son sitios distintos): con `SameSite=Lax` no se envía, y con `SameSite=None` Safari y iOS la restringen.

**Opciones:**
- A. Iframe en todas partes, cambiando la cookie de `crm-demo`. Dudoso en Safari e iOS.
- B. Botón «Abrir vista previa» en otra pestaña y la galería de capturas en el panel.
- C. Iframe solo en escritorio, y B en móvil. *Recomendación de Claude.*

**Decisión:** B (elección del humano): la vista previa real en su propia pestaña siempre se ve mejor que dentro del panel.

**Consecuencias:**
- No se toca el login de `crm-demo` ni sus cookies.
- La aprobación final muestra el botón, las capturas a 1280 y 390 px y el resultado de los criterios (D43).
- D6 deja de necesitarse para el iframe, pero la protección de las vistas previas sigue desactivada porque Actions tiene que acceder a ellas.
```

**Para la sesión 14 de `PROCESO.md`:**
```markdown
- **Vista previa (D45):** Claude vio que el login de `crm-demo` no se mantendría en un iframe (cookie de terceros, sobre todo en Safari e iOS) y recomendó un iframe solo en escritorio. El humano eligió no embeberla: botón para abrirla en otra pestaña y galería de capturas.
```

**El siguiente es el punto 5, el móvil con pestañas.** Propongo, para `/runs/[id]` por debajo de 768 px:
- **Arriba, siempre visibles,** las tarjetas en 2×2 (D42).
- **Debajo, una barra de acción del humano**, solo cuando le toca: «Aprobar plan», «Rechazar con feedback», «Aprobar y fusionar», «Reintentar» o «Abandonar». Va fija abajo para que se llegue con el pulgar. Al rechazar se despliega el campo de feedback.
- **Tres pestañas:** Tareas (el plan y las tareas con sus criterios, D43), Línea de tiempo (D44) y Vista previa (D45). La pestaña va en la URL (`?tab=`), como el filtro.
- **La pestaña inicial depende del estado del run:** Vista previa en la aprobación final y Tareas en el resto.
- **En escritorio no hay pestañas,** sino dos columnas: tareas a la izquierda y línea de tiempo a la derecha, con la vista previa encima de las tareas cuando toca aprobar.
- **La verificación es un E2E de Playwright del panel**, a 390 y a 1280 px, que compruebe que no hay scroll horizontal y que las acciones se ven en cada estado de aprobación.

¿Te encaja?

## ❯ Usuario

Sí, me suena bien

## ● Claude

El móvil con pestañas queda así.

**Resumen:**
- En móvil, `/runs/[id]` tiene arriba las tarjetas en 2×2 y una barra de acción fija abajo cuando le toca al humano. Las pestañas son Tareas, Línea de tiempo y Vista previa; la pestaña va en la URL y la inicial depende del estado del run.
- En escritorio son dos columnas. Se verifica con un E2E de Playwright del panel a 390 y 1280 px.

**D46, para `DECISIONES.md`:**
```markdown
## D46 · `/runs/[id]` en móvil y en escritorio
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Decisión** (propuesta de Claude, aprobada por el humano):
- **Móvil (< 768 px):**
  - Arriba, siempre visibles, las tarjetas de D42 en 2×2.
  - Barra de acción del humano fija abajo, solo cuando le toca: aprobar el plan, rechazar con feedback (despliega el campo), aprobar y fusionar, reintentar o abandonar.
  - Pestañas Tareas (D43), Línea de tiempo (D44) y Vista previa (D45), con la pestaña en la URL (`?tab=`). La inicial es Vista previa en `awaiting_final_approval` y Tareas en el resto.
- **Escritorio:** dos columnas, con las tareas a la izquierda y la línea de tiempo a la derecha. La vista previa va encima de las tareas cuando toca aprobar.
- **Verificación:** E2E de Playwright del panel a 390 y 1280 px, sin scroll horizontal y con las acciones visibles en cada estado que espera al humano.
```

**Para la sesión 14 de `PROCESO.md`:**
```markdown
- **Móvil y escritorio (D46):** tarjetas siempre visibles, barra de acción fija abajo, pestañas en móvil y dos columnas en escritorio, con un E2E del panel en los dos tamaños. Propuesta de Claude, aprobada por el humano.
```

**El siguiente es el punto 6, las aprobaciones con la versión vieja.** Hoy cada botón envía la `version` del run. Si el run ha cambiado mientras la página estaba abierta, el CAS (D22) no toca ninguna fila y el botón no hace nada. Pasa a menudo, porque el run avanza por cosas que el humano no ve: un webhook tardío, el sweep o un reintento.

Propongo que las acciones del humano dejen de enviar la `version` y envíen **lo que el humano está aprobando**:
- **Aprobar el plan** envía la revisión del plan que se ve en pantalla. Vale si el run sigue en `awaiting_plan_approval` con esa misma revisión.
- **Aprobar y fusionar** envía el `head_sha` que se ve. Vale si el run sigue en `awaiting_final_approval` con ese mismo sha.
- **Reintentar, abandonar y cancelar** envían el estado que se ve.

El servidor lee la versión actual y hace el CAS con ella, así que la protección de D22 sigue igual por dentro. Hay tres casos:
- **La precondición se cumple:** la acción se aplica, aunque la versión haya cambiado por algo ajeno.
- **No se cumple** (hay una revisión nueva del plan o un commit nuevo): no se aplica. El panel se refresca y avisa: «El run ha cambiado: revisa la revisión 3 antes de aprobar».
- **Ya se aplicó** (doble clic o una segunda pestaña): se avisa con «Ya estaba aprobado» y no se hace nada.

Además, el botón se desactiva mientras la acción está en curso. Así nunca se aprueba algo distinto de lo que el humano tiene en pantalla, y el botón nunca se queda sin respuesta.

¿Lo vemos bien?

## ❯ Usuario

Genial

## ● Claude

*Herramientas: lee sus notas de preferencias del Project.*

Queda decidido. Las acciones del humano envían lo que aprueba, no la versión.

**Resumen:**
- Las acciones del humano envían lo que tiene en pantalla: la revisión del plan, el `head_sha` o el estado. El servidor hace el CAS con la versión actual. Si lo que se ve ya no coincide, el panel se refresca y avisa. Si la acción ya se había aplicado, dice «Ya estaba aprobado».
- El botón se desactiva mientras la acción está en curso. Nunca se aprueba algo distinto de lo que se ve, y el botón nunca se queda sin responder.

**D47, para `DECISIONES.md`:**
```markdown
## D47 · Las acciones del humano envían lo que aprueban, no la versión
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Contexto:** cada botón enviaba la `version` del run. Si el run avanzaba mientras la página estaba abierta (por un webhook tardío, el sweep o un reintento), el CAS de D22 no tocaba ninguna fila y el botón no hacía nada (sesión 13).

**Decisión** (propuesta de Claude, aprobada por el humano):
- Cada acción envía su precondición:
  - aprobar el plan: la revisión del plan que se ve, válida si el run sigue en `awaiting_plan_approval` con esa revisión;
  - aprobar y fusionar: el `head_sha` que se ve, válido si el run sigue en `awaiting_final_approval` con ese sha;
  - reintentar, abandonar y cancelar: el estado que se ve.
- El servidor lee la versión actual y hace el CAS con ella, así que D22 no cambia por dentro.
- Si la precondición no se cumple, no se aplica nada: el panel se refresca y avisa («El run ha cambiado: revisa la revisión 3 antes de aprobar»). Si la acción ya estaba aplicada, se avisa con «Ya estaba aprobado».
- El botón se desactiva mientras la acción está en curso.

**Consecuencias:** nunca se aprueba algo distinto de lo que el humano tiene en pantalla, y un cambio ajeno de versión ya no deja el botón sin respuesta.
```

**Para la sesión 14 de `PROCESO.md`:**
```markdown
- **Aprobaciones (D47):** Claude propuso que las acciones del humano envíen la revisión, el sha o el estado que se ven, en vez de la versión del run. El humano lo aprobó. Arregla el botón que no hacía nada en la sesión 13.
```

**El último es el punto 7, la portada de `/runs` para los evaluadores.** Propongo:
- **Una introducción de dos o tres líneas** con el flujo: «Escribe una petición → el Orquestador planifica y tú apruebas → Develop y Testing iteran hasta que todo pasa → apruebas la vista previa → merge». Con enlaces al CRM en producción y a los dos repos.
- **Peticiones sugeridas en botones** que rellenan el formulario sin enviarlo. La lista vive en un archivo de `crm-agents` (`demo-requests.ts`), así que en H8 solo hay que editar ese archivo. Si una sugerencia ya acabó en `done`, sale marcada como «ya fusionada». Se detecta comparando el texto de la petición con los runs, sin migración.
- **Las simulaciones van en «Opciones avanzadas»,** plegadas, para que un evaluador no las active sin querer.
- **Los límites, a la vista:** «Quedan 3 runs hoy (de 5)» y, si la cuota de Gemini está agotada, «Se usa el respaldo de pago hasta las 9:00».
- **La cola, con la posición:** «Tu petición es la 2.ª en la cola».

¿Te encaja?

## ❯ Usuario

Perfecto

## ● Claude

La portada queda así.

**Resumen:**
- `/runs` lleva una introducción breve con el flujo y los enlaces, y las peticiones sugeridas en botones que rellenan el formulario. La lista sale de `demo-requests.ts`, y las sugerencias que ya acabaron en `done` salen marcadas como «ya fusionada».
- Las simulaciones van plegadas en «Opciones avanzadas», y los límites del día y la posición en la cola están a la vista.

**D48, para `DECISIONES.md`:**
```markdown
## D48 · Portada de `/runs` para los evaluadores
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Decisión** (propuesta de Claude, aprobada por el humano):
- Introducción de dos o tres líneas con el flujo (petición → plan que aprueba el humano → Develop y Testing iteran → aprobación de la vista previa → merge) y enlaces al CRM en producción y a los dos repos.
- Peticiones sugeridas en botones que rellenan el formulario sin enviarlo. La lista vive en `demo-requests.ts`, así que en H8 basta con editar ese archivo. Una sugerencia cuyo run acabó en `done` sale marcada como «ya fusionada»; se detecta por el texto de la petición, sin migración.
- Las simulaciones de H3 a H6 van plegadas en «Opciones avanzadas».
- Límites a la vista: los runs que quedan hoy (`RUNS_PER_DAY`) y un aviso si la cuota de Gemini está agotada y se usa el respaldo de pago hasta las 9:00.
- La cola muestra la posición de cada petición.
```

**Para la sesión 14 de `PROCESO.md`:**
```markdown
- **Portada de `/runs` (D48):** introducción, peticiones sugeridas que rellenan el formulario, simulaciones plegadas, límites del día y posición en la cola. Propuesta de Claude, aprobada por el humano.
```

**Con esto quedan cerrados los siete puntos. Falta el criterio de H7.** Propongo:
1. **El run de punta a punta en un móvil real.** El run del tipo de cliente se lanza, se aprueba el plan, se sigue y se aprueba la vista previa final desde el teléfono, hasta `done`. Las tarjetas reflejan en cada momento qué agente trabaja, y la columna nueva queda en producción tras el merge.
2. **El mismo run visto en escritorio.** Dos columnas, el filtro de la línea de tiempo funciona, los criterios salen en verde en los dos tamaños y el grupo de regresión muestra los JSON de runs anteriores.
3. **Las aprobaciones con la versión vieja.** Con el run abierto en dos pestañas, se aprueba en una y la otra dice «Ya estaba aprobado». Un cambio ajeno de versión no impide aprobar.
4. **La línea de tiempo sin ruido.** Con un reintento por saturación, real o simulado, no se repite «lee N archivos» y los reintentos salen agrupados.
5. **La portada.** Una sugerencia rellena el formulario, la del tipo de cliente sale como «ya fusionada» tras el run 1, y se ven los runs que quedan hoy.
6. **Las pruebas automáticas.**
   - La tabla de casos de `agentCards()` en Vitest.
   - El E2E de Playwright del panel a 390 y 1280 px, con runs de ejemplo en los estados que esperan al humano: sin scroll horizontal y con las acciones visibles. Claude Code decidirá cómo sembrar esos runs.

¿Lo damos por bueno o ajustamos algo?

## ❯ Usuario

Me parece bien!

## ● Claude

*Herramientas: actualiza `claude/PLAN.md` en el Project.*

<details><summary>claude/PLAN.md</summary>

```markdown
# Plan — prueba técnica Speed Paradigm

Estado al 26/11/2026: **H0–H6 hechos** y **H7 planificado** (sesión 14, D42–D48), pendiente de implementar con Claude Code. El Orquestador planifica, Develop escribe código real en `crm-demo` y Testing comprueba cada criterio en la vista previa.

Copias en el proyecto de los documentos del repo `crm-agents`:
- `DECISIONES.md` ← `docs/DECISIONES.md`
- `PROCESO.md` ← `docs/PROCESO.md`
- `claude/CLAUDE.md` ← `CLAUDE.md`

## Resumen
- **Orquestador** (Gemini → Anthropic → Groq): divide la petición en tareas con criterios, `data-testid` y referencias. Replanifica con el feedback del cliente y rechaza lo que está fuera de alcance, sin crear rama ni PR.
- **Develop** (Gemini → Anthropic):
  - Escribe código real en `crm-demo`: rama `run/<id>`, un commit por tarea y un PR por run.
  - El panel formatea con Prettier lo que escribe antes del commit (D41).
  - Las tareas demasiado grandes vuelven al Orquestador para dividirse.
- **pr-check.yml** (GitHub Actions): genera la migración y devuelve a Develop los errores de tipos y de lint antes del build de Vercel.
- **Testing** (Gemini → Groq → Anthropic):
  - Traduce cada criterio e2e a pasos JSON declarativos (`e2e/criteria/run-<id>.json`).
  - Un spec fijo de `crm-demo` (`e2e/criteria.spec.ts`) los ejecuta con Playwright en Actions contra la vista previa, en escritorio y a 390 px.
  - **El veredicto lo da el ejecutor, no el LLM.** El LLM solo escribe los pasos y explica los fallos.
  - Máximo 3 iteraciones por tarea. Los JSON fusionados quedan como pruebas de regresión.
  - De momento solo hay criterios e2e: lo visual lo revisa el cliente en la aprobación final.
- **Máquina de estados**: los webhooks de GitHub mueven el run, guardado en Neon, con CAS, lease y sweep (sin cron).
- Repos, proyectos de Vercel y de Neon separados para `crm-agents` (panel) y `crm-demo` (CRM, con una rama de Neon por vista previa).
- Límites: 5 runs al día y 16 llamadas al LLM por run.

## H7 · Panel completo (planificado)
- **Petición del run de H7:** «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo».
- **Tarjetas por agente** (D42): Orquestador, Develop, Testing y humano, calculadas con una función pura. Las esperas de GitHub y Vercel van en la tarjeta del agente que espera.
- **Tareas y criterios** (D43): estado, iteración, commit y archivos; criterios con su resultado en los dos tamaños; pasos plegados; regresiones aparte.
- **Línea de tiempo** (D44): filtro por agente en la URL, sin contexto repetido y con los reintentos agrupados.
- **Vista previa** (D45): botón para abrirla en otra pestaña y galería de capturas, sin iframe.
- **Móvil y escritorio** (D46): tarjetas siempre visibles, barra de acción fija, pestañas en móvil y dos columnas en escritorio.
- **Aprobaciones** (D47): envían la revisión, el sha o el estado que se ven, no la versión.
- **Portada de `/runs`** (D48): introducción, peticiones sugeridas, simulaciones plegadas, límites y posición en la cola.

## Flujo de un run
1. **Petición** del cliente.
2. **Orquestador** planifica tareas, criterios, `data-testid` y referencias. Si la petición está fuera de alcance, se rechaza sin crear rama ni PR.
3. **El cliente aprueba el plan**. Si da feedback, el Orquestador replanifica.
4. **Testing escribe los pasos**: cada criterio e2e se traduce a pasos JSON.
5. **Develop** escribe el código, con un commit por tarea en `run/<id>` y un PR. Si una tarea no cabe, vuelve al Orquestador para dividirse.
6. **pr-check**: migración, tipos y lint. Si hay errores, vuelven a Develop.
7. **Vista previa** de Vercel.
8. **Webhook → Playwright** en Actions ejecuta `e2e/criteria.spec.ts` con los pasos de este run y de los anteriores. El ejecutor decide si cada criterio pasa. Si algo falla, Testing explica el fallo y vuelve a Develop (máximo 3 iteraciones por tarea).
9. **El cliente aprueba la vista previa final**, incluida la revisión visual. Después, merge squash y producción.

## Hitos
H0 base ✅ · H1 CRM demo ✅ · H2 tubería sin IA ✅ · H3 motor de runs ✅ · H4 Orquestador ✅ · H5 Develop ✅ · H6 Testing ✅ · H7 panel completo (planificado) · H8 entrega.

## Pendiente
- H7: implementación con Claude Code (sesión 15).
- H8: entrega, incluidas las 4 preguntas, la lista de peticiones para los evaluadores y si pueden fusionar.

Whiteboard: [enlace privado al Whiteboard]
```

</details>

El criterio de H7 queda aprobado y la planificación de H7 está cerrada. He actualizado `claude/PLAN.md` en el Project con H7 planificado (D42–D48).

**Resumen:**
- H7 se da por verificado cuando el run del tipo de cliente llega a `done` desde un móvil real, se ve bien en escritorio y los arreglos se comprueban en producción: aprobaciones, línea de tiempo y portada.
- Además, las tarjetas tienen su tabla de casos en Vitest y el panel pasa un E2E a 390 y 1280 px.

**Para cerrar la sesión 14 de `PROCESO.md`** (va después de «Qué cambió por el camino» y sustituye al «Pendiente» y al «Siguiente paso» que tenía):
```markdown
**Resultado:** D42–D48 aceptadas y un extra en D14.

**Criterio de H7:**
1. **Run de punta a punta en un móvil real:** el run del tipo de cliente se lanza, se aprueba el plan, se sigue y se aprueba la vista previa final desde el teléfono, hasta `done`. Las tarjetas reflejan en cada momento qué agente trabaja, y la columna nueva queda en producción tras el merge.
2. **El mismo run en escritorio:** dos columnas, el filtro de la línea de tiempo funciona, los criterios salen en verde en los dos tamaños y el grupo de regresión muestra los JSON de runs anteriores.
3. **Aprobaciones con la versión vieja:** con el run abierto en dos pestañas, se aprueba en una y la otra dice «Ya estaba aprobado». Un cambio ajeno de versión no impide aprobar.
4. **Línea de tiempo sin ruido:** con un reintento por saturación, real o simulado, no se repite «lee N archivos» y los reintentos salen agrupados.
5. **Portada:** una sugerencia rellena el formulario, la del tipo de cliente sale como «ya fusionada» tras el criterio 1, y se ven los runs que quedan hoy.
6. **Pruebas automáticas:** la tabla de casos de `agentCards()` en Vitest y el E2E de Playwright del panel a 390 y 1280 px, con runs de ejemplo en los estados que esperan al humano: sin scroll horizontal y con las acciones visibles.

**Pendiente:**
- En el repo, de la sesión 12: pasar los apartados de D37 y del push de prueba de la sesión 08 a la sesión 11, y añadir a D10 un extra que remita a D37.
- Lista de peticiones para los evaluadores y si pueden fusionar: en H8.
- Whiteboard del plan, que sigue en H6 planificado.

**Siguiente paso:** sesión 15 de Claude Code (H7), en `crm-agents`.
```

Antes de abrir Claude Code te falta actualizar el Whiteboard desde su página: H6 hecho y H7 planificado.

## ❯ Usuario

*Adjuntos: `PROCESO.md`.*

Así qued PROCESO.md, dame el prompt para el whiteboard.

## ● Claude

El `PROCESO.md` está bien, salvo dos cosas de la sesión 14:

1. **El punto 4 de la lista del panel contradice D45.** Dice «Vista previa embebida y capturas en la aprobación final (D6)», pero al final decidiste no embeberla. Yo lo cambiaría por: «4. Vista previa: botón para abrirla en otra pestaña y galería de capturas, sin iframe (D45).»
2. **Faltan las líneas de cada decisión** (D42 a D48) que te fui dando. Sin ellas no queda constancia de lo que cambió por el camino, por ejemplo que la C del iframe era mi recomendación y elegiste la B. Si quieres que la entrada quede corta, basta con añadir al final de la lista: «Detalle de cada punto en D42–D48. En el 4, Claude recomendó un iframe solo en escritorio y el humano eligió abrir la vista previa en otra pestaña.»

**El prompt para el Whiteboard**, para pegarlo en un chat abierto desde su propia página:

```text
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
```

## ❯ Usuario

*Adjuntos: texto pegado.*

<details><summary>Texto pegado</summary>

```markdown
## Sesión 14 · Planificación de H7 (Project de Claude) · 26/11/2026

**Objetivo:** decidir la petición de demo del run de H7 y qué debe mostrar el panel para que alguien sin contexto vea qué hace cada agente y en qué estado está cada tarea.

**Cómo fue:**
- Se actualizaron en el Project las copias de `CLAUDE.md` y `PLAN.md` con las del repo tras H6. `DECISIONES.md` y `PROCESO.md` no se pudieron subir desde la sesión por su tamaño; las sustituye el humano.
- Comprobado por el humano: `RUNS_PER_DAY` ha vuelto a 5, y el run #24 se canceló después de bloquearse (criterio 3 de H6).

**Qué cambió por el camino:**
- **Petición de H7:** no quedaba ninguna de demo sin usar. Claude propuso dos: el tipo de cliente, que pasa por todo el motor, y el recuento de presupuestos del run #24, más segura porque es una sola tarea sin migración. El humano eligió el tipo de cliente: «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo». En un solo run hay migración, interacción, dos tareas y la regresión de los JSON anteriores. Los pasos crean su propio cliente de tipo Empresa y comprueban el filtro con `expectText all`, sin depender del seed (extra de D14). El recuento de presupuestos no está en `master` y queda libre.
- **Panel:** Claude propuso siete puntos y marcó como imprescindibles el 1, el 2, el 5 y el 6. El humano decidió entrarlos todos:
  1. Tarjetas por agente (Orquestador, Develop, Testing y el humano) con lo que hace ahora, su estado y el modelo.
  2. Tareas con sus criterios, y pass o fail en escritorio y a 390 px.
  3. Línea de tiempo filtrable por agente, sin repetir «lee N archivos».
  4. Vista previa embebida y capturas en la aprobación final (D6).
  5. Pestañas en móvil para `/runs/[id]`.
  6. Aprobaciones con la versión vieja: refrescar y avisar en vez de no hacer nada.
  7. Portada de `/runs` para los evaluadores, con cómo funciona y las peticiones sugeridas en botones.

**Resultado:** D42–D48 aceptadas y un extra en D14.

**Criterio de H7:**
1. **Run de punta a punta en un móvil real:** el run del tipo de cliente se lanza, se aprueba el plan, se sigue y se aprueba la vista previa final desde el teléfono, hasta `done`. Las tarjetas reflejan en cada momento qué agente trabaja, y la columna nueva queda en producción tras el merge.
2. **El mismo run en escritorio:** dos columnas, el filtro de la línea de tiempo funciona, los criterios salen en verde en los dos tamaños y el grupo de regresión muestra los JSON de runs anteriores.
3. **Aprobaciones con la versión vieja:** con el run abierto en dos pestañas, se aprueba en una y la otra dice «Ya estaba aprobado». Un cambio ajeno de versión no impide aprobar.
4. **Línea de tiempo sin ruido:** con un reintento por saturación, real o simulado, no se repite «lee N archivos» y los reintentos salen agrupados.
5. **Portada:** una sugerencia rellena el formulario, la del tipo de cliente sale como «ya fusionada» tras el criterio 1, y se ven los runs que quedan hoy.
6. **Pruebas automáticas:** la tabla de casos de `agentCards()` en Vitest y el E2E de Playwright del panel a 390 y 1280 px, con runs de ejemplo en los estados que esperan al humano: sin scroll horizontal y con las acciones visibles.

**Pendiente:**
- En el repo, de la sesión 12: pasar los apartados de D37 y del push de prueba de la sesión 08 a la sesión 11, y añadir a D10 un extra que remita a D37.
- Lista de peticiones para los evaluadores y si pueden fusionar: en H8.
- Whiteboard del plan, que sigue en H6 planificado.

- **Tareas y criterios (D43):** Claude propuso la vista de cada tarea con sus criterios, los pasos plegados para el humano y las regresiones en un grupo aparte. El humano la aprobó sin cambios.

- **Línea de tiempo (D44):** filtro por agente en la URL, el contexto solo se registra cuando cambia (pendiente de H5) y los reintentos se agrupan en la UI sin borrar los eventos. Propuesta de Claude, aprobada por el humano.

- **Vista previa (D45):** Claude vio que el login de `crm-demo` no se mantendría en un iframe (cookie de terceros, sobre todo en Safari e iOS) y recomendó un iframe solo en escritorio. El humano eligió no embeberla: botón para abrirla en otra pestaña y galería de capturas.

- **Móvil y escritorio (D46):** tarjetas siempre visibles, barra de acción fija abajo, pestañas en móvil y dos columnas en escritorio, con un E2E del panel en los dos tamaños. Propuesta de Claude, aprobada por el humano.

- **Aprobaciones (D47):** Claude propuso que las acciones del humano envíen la revisión, el sha o el estado que se ven, en vez de la versión del run. El humano lo aprobó. Arregla el botón que no hacía nada en la sesión 13.

- **Portada de `/runs` (D48):** introducción, peticiones sugeridas que rellenan el formulario, simulaciones plegadas, límites del día y posición en la cola. Propuesta de Claude, aprobada por el humano.

**Siguiente paso:** sesión 15 de Claude Code (H7), en `crm-agents`.
```

</details>

quedaría así la sesión 14 entonces?

## ● Claude

Casi. Hay tres cosas que corregir:

1. **Las líneas de D43 a D48 están después de «Pendiente».** Tienen que ir dentro de «Qué cambió por el camino», debajo de la lista del panel.
2. **Falta la línea de D42**, la de las tarjetas por agente.
3. **El punto 4 de la lista sigue diciendo «Vista previa embebida (D6)».** Contradice D45, que decidió no embeberla.

Así quedaría corregida:

```markdown
## Sesión 14 · Planificación de H7 (Project de Claude) · 26/11/2026

**Objetivo:** decidir la petición de demo del run de H7 y qué debe mostrar el panel para que alguien sin contexto vea qué hace cada agente y en qué estado está cada tarea.

**Cómo fue:**
- Se actualizaron en el Project las copias de `CLAUDE.md` y `PLAN.md` con las del repo tras H6. `DECISIONES.md` y `PROCESO.md` no se pudieron subir desde la sesión por su tamaño; las sustituye el humano.
- Comprobado por el humano: `RUNS_PER_DAY` ha vuelto a 5, y el run #24 se canceló después de bloquearse (criterio 3 de H6).

**Qué cambió por el camino:**
- **Petición de H7:** no quedaba ninguna de demo sin usar. Claude propuso dos: el tipo de cliente, que pasa por todo el motor, y el recuento de presupuestos del run #24, más segura porque es una sola tarea sin migración. El humano eligió el tipo de cliente: «Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo». En un solo run hay migración, interacción, dos tareas y la regresión de los JSON anteriores. Los pasos crean su propio cliente de tipo Empresa y comprueban el filtro con `expectText all`, sin depender del seed (extra de D14). El recuento de presupuestos no está en `master` y queda libre.
- **Panel:** Claude propuso siete puntos y marcó como imprescindibles el 1, el 2, el 5 y el 6. El humano decidió entrarlos todos:
  1. Tarjetas por agente (Orquestador, Develop, Testing y el humano) con lo que hace ahora, su estado y el modelo.
  2. Tareas con sus criterios, y pass o fail en escritorio y a 390 px.
  3. Línea de tiempo filtrable por agente, sin repetir «lee N archivos».
  4. Vista previa y capturas en la aprobación final.
  5. Pestañas en móvil para `/runs/[id]`.
  6. Aprobaciones con la versión vieja: refrescar y avisar en vez de no hacer nada.
  7. Portada de `/runs` para los evaluadores, con cómo funciona y las peticiones sugeridas en botones.
- **Tarjetas por agente (D42):** Claude propuso calcular el estado con una función pura y meter las esperas de GitHub y Vercel en la tarjeta del agente que espera, en vez de añadir una tarjeta «Infraestructura». El humano lo aprobó: si una espera afecta al estado de un agente, va en su tarjeta.
- **Tareas y criterios (D43):** Claude propuso la vista de cada tarea con sus criterios, los pasos plegados para el humano y las regresiones en un grupo aparte. El humano la aprobó sin cambios.
- **Línea de tiempo (D44):** filtro por agente en la URL, el contexto solo se registra cuando cambia (pendiente de H5) y los reintentos se agrupan en la UI sin borrar los eventos. Propuesta de Claude, aprobada por el humano.
- **Vista previa (D45):** Claude vio que el login de `crm-demo` no se mantendría en un iframe (cookie de terceros, sobre todo en Safari e iOS) y recomendó un iframe solo en escritorio. El humano eligió no embeberla: botón para abrirla en otra pestaña y galería de capturas.
- **Móvil y escritorio (D46):** tarjetas siempre visibles, barra de acción fija abajo, pestañas en móvil y dos columnas en escritorio, con un E2E del panel en los dos tamaños. Propuesta de Claude, aprobada por el humano.
- **Aprobaciones (D47):** Claude propuso que las acciones del humano envíen la revisión, el sha o el estado que se ven, en vez de la versión del run. El humano lo aprobó. Arregla el botón que no hacía nada en la sesión 13.
- **Portada de `/runs` (D48):** introducción, peticiones sugeridas que rellenan el formulario, simulaciones plegadas, límites del día y posición en la cola. Propuesta de Claude, aprobada por el humano.

**Resultado:** D42–D48 aceptadas y un extra en D14.

**Criterio de H7:**
1. **Run de punta a punta en un móvil real:** el run del tipo de cliente se lanza, se aprueba el plan, se sigue y se aprueba la vista previa final desde el teléfono, hasta `done`. Las tarjetas reflejan en cada momento qué agente trabaja, y la columna nueva queda en producción tras el merge.
2. **El mismo run en escritorio:** dos columnas, el filtro de la línea de tiempo funciona, los criterios salen en verde en los dos tamaños y el grupo de regresión muestra los JSON de runs anteriores.
3. **Aprobaciones con la versión vieja:** con el run abierto en dos pestañas, se aprueba en una y la otra dice «Ya estaba aprobado». Un cambio ajeno de versión no impide aprobar.
4. **Línea de tiempo sin ruido:** con un reintento por saturación, real o simulado, no se repite «lee N archivos» y los reintentos salen agrupados.
5. **Portada:** una sugerencia rellena el formulario, la del tipo de cliente sale como «ya fusionada» tras el criterio 1, y se ven los runs que quedan hoy.
6. **Pruebas automáticas:** la tabla de casos de `agentCards()` en Vitest y el E2E de Playwright del panel a 390 y 1280 px, con runs de ejemplo en los estados que esperan al humano: sin scroll horizontal y con las acciones visibles.

**Pendiente:**
- En el repo, de la sesión 12: pasar los apartados de D37 y del push de prueba de la sesión 08 a la sesión 11, y añadir a D10 un extra que remita a D37.
- Lista de peticiones para los evaluadores y si pueden fusionar: en H8.
- Whiteboard del plan, que sigue en H6 planificado.

**Siguiente paso:** sesión 15 de Claude Code (H7), en `crm-agents`.
```

Cuando hayas actualizado el Whiteboard con el prompt de antes, puedes quitar esa línea de «Pendiente».
