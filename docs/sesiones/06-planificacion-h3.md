# Sesión 06 · Planificación de H3 (Project de Claude) · 24/11/2026

Conversación «Hito 2 y hito 3 (CRM)» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `DECISIONES.md`, `PROCESO.md`.*

El hito 2 está terminado. Te dejo la nueva documentación (la sesión ha quedado en crm-agents). ¿Procedemos al 3?

## ● Claude

Primero subo tu documentación nueva al Project y repaso el plan y la prueba para preparar la planificación de H3.

*Herramientas: lee `claude/PLAN.md` del Project; lee `PRUEBA.md` del Project; lee `claude/CLAUDE.md` del Project; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; busca en la web «Vercel Hobby cron jobs frequency limit»; lee `claude/DECISIONES.md` del Project; lee `claude/PROCESO.md` del Project.*

He subido tus `DECISIONES.md` y `PROCESO.md` nuevos al Project. Para H3 propongo lo siguiente. Cuando me des el visto bueno, lo apunto como D20–D25 y añado la sesión 06 a `PROCESO.md`.

## Propuesta para H3 · Motor de runs

**D20 · Un PR por run, un commit por tarea y un build por iteración**
- Cada run tiene su rama, `run/<id>`. Como el nombre sale del id, repetir un paso nunca crea una rama nueva.
- Develop hace cada tarea en su propia llamada al LLM. El panel sube todas las tareas juntas con la Git Data API: un commit por tarea, pero la rama se actualiza una sola vez. Así Vercel compila solo el último commit.
- Testing revisa los criterios de cada tarea con un único informe de Playwright. Las tareas que fallan vuelven a Develop. Cada tarea tiene como mucho 3 iteraciones (D5).
- Descarto un build por tarea porque serían N builds de varios minutos. Descarto un PR por tarea porque choca con el límite de 3 PRs abiertos y con las ramas de Neon.

**D21 · Estados**
- Estados del run: `queued → planning → awaiting_plan_approval → developing → awaiting_preview → testing → awaiting_final_approval → merging → done`.
  - Desde `testing` se puede volver a `developing` o pasar a `blocked`.
  - El feedback del cliente, sea en el plan o en la vista previa final, devuelve el run a `planning` sobre la misma rama (D9).
  - Estados finales: `done`, `rejected`, `cancelled` y `failed`.
- Estados de la tarea: `pending → developing → testing → passed | failed | blocked`.
- Las transiciones van en una función pura `transition(estado, evento) → { estado, efectos }`, probada con una tabla en Vitest.
- `run_events` es un log en el que solo se añaden filas. Es la línea de tiempo de la UI: qué agente hace qué.

**D22 · Cómo avanzan los pasos: compare-and-swap, lease y sweep, sin cron**
- Cada transición es un `UPDATE … WHERE id = $1 AND version = $2` más el insert en `run_events`, todo en una `sql.transaction([...])` no interactiva de Neon. Si no cambia ninguna fila, otro proceso ya avanzó el run y este paso no hace nada. Así, un doble clic en «Aprobar» no duplica nada.
- Los pasos con LLM se ejecutan en `after()` y reservan el run con `lease_until`.
- En Hobby, el cron de Vercel solo se ejecuta una vez al día (lo he comprobado), así que no sirve para recuperar pasos caídos. En su lugar:
  - El polling de la UI cada 5 s llama a un `sweep()` barato que relanza los pasos con el lease caducado.
  - Hay también un botón de reintentar.
- Los efectos se pueden repetir sin duplicar nada:
  - Antes de crear el PR se busca uno abierto por rama.
  - Solo se hace commit si la rama sigue en el sha esperado.
  - La salida de cada llamada al LLM se guarda en `agent_steps` por (run, tarea, iteración, agente), así que un reintento no vuelve a llamar al LLM.
- El procesamiento de H2 ya guarda `previews` y `test_reports`. Al terminar, avisa al run que tenga esa rama **y ese mismo sha**, para que los informes viejos no cuenten.
- Un `deployment_status` en `failure` o `error` también se procesa: es un build roto que vuelve a Develop (D13).
- Si en 15 min no llega la vista previa, el run pasa a `blocked`.

**D23 · Cola y límites en la base de datos**
- Un índice único parcial garantiza que solo haya un run activo, el que no está en `queued` ni en un estado final. Cuando un run termina, se arranca el siguiente de la cola.
- Los runs que esperan aprobación también cuentan como activos. Para que un evaluador que abandona un run no bloquee la cola, el `sweep` los cancela tras 24 h y hay un botón para cancelar.
- Límites: N runs al día (D10) y un máximo de llamadas al LLM por run (D8). Al llegar a cualquiera, el run pasa a `blocked`.

**D24 · `MockProvider` con escenarios, sobre GitHub de verdad**
- En H3 todo es real (rama, commits, PR, vista previa, Actions y merge) salvo el LLM. Eso es lo que demuestra un «run completo».
- El escenario se elige en el formulario y solo aparece cuando el proveedor es el mock: `ok`, `fail-once`, `blocked` y `forbidden`.
- El Develop simulado escribe `agent-runs/<run>/<tarea>.md`, un archivo inofensivo que no afecta a la app.
- El Testing simulado sigue el escenario, pero si el E2E real falla, marca fallo igualmente. Así también se prueba el camino de los informes reales.
- Los contratos Zod se definen ya: plan, salida de Develop (archivos completos y mensaje de commit por tarea) y veredicto de Testing. En H4–H6 solo cambian el proveedor y los prompts.
- La regla de D16 se aplica ya en la capa que hace los commits: se rechaza cualquier ruta bajo `.github/**` o en los helpers de `e2e/`. El escenario `forbidden` lo comprueba.

**D25 · UI mínima de runs (la completa llega en H7)**
- `/runs`: formulario para una petición nueva, la cola y los runs recientes.
- `/runs/[id]`: la línea de tiempo por agente, las tareas con su estado y su iteración, los enlaces al PR y a la vista previa, y los botones de aprobar o rechazar con feedback, reintentar y cancelar.
- `/pipeline` se queda como vista de depuración.

## Criterio de H3, concretado
1. **`ok` con 2 tareas:** plan aprobado → PR con 2 commits y una sola vista previa → aprobación final → merge squash → `done`, y la rama de Neon se borra.
2. **`fail-once`:** una tarea falla en la iteración 1 y pasa en la 2, y se ve en la línea de tiempo.
3. **`blocked`:** tras 3 iteraciones, el humano abandona el run y el PR se cierra con su rama borrada.
4. **Plan rechazado con feedback:** el run vuelve a planificar.
5. **Cola:** un segundo run queda en cola y arranca cuando acaba el primero.
6. **Idempotencia:** reenviar webhooks o hacer doble clic en aprobar no duplica nada, y un lease caducado se reanuda sin repetir el commit.

Por tu parte, creo que solo hay que comprobar que `crm-demo` permite el merge squash y no tiene reglas de protección en `master`. El PAT ya tiene permiso de escritura en *Contents* y *Pull requests*.

Antes de empezar, confírmame tres cosas:
- **D20:** ¿te vale un PR por run con un build por iteración?
- **D23:** ¿te parece bien que los runs en espera de aprobación cuenten como activos, con la cancelación automática a las 24 h?
- **D24:** ¿te parece bien que los runs simulados hagan merge real en `master` de `crm-demo` y dejen archivos `agent-runs/`? La otra opción es que el escenario `ok` acabe cerrando el PR, sin merge.

¿Quieres que lo ponga en el Whiteboard?

## ❯ Usuario

D20: sí, creo que es lo ideal en este caso.
D23: sí
D24: sí

Y sí, el Whiteboard debería ir actualizándose según avancemos.

## ● Claude

Lo apunto en `DECISIONES.md` y `PROCESO.md` y luego actualizo el Whiteboard.

*Herramientas: ejecuta un comando en su entorno.*

Now append decisions and the session entry.

*Herramientas: ejecuta un comando en su entorno; consulta los artifacts; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; lee el Whiteboard del plan; actualiza el Whiteboard del plan.*

Las decisiones D20–D25 y la sesión 06 ya están en `DECISIONES.md` y `PROCESO.md`, en el Project, pero el Whiteboard no lo he podido actualizar. Desde esta conversación no tengo permiso para modificar un artifact que ya existe, solo para crear artifacts nuevos.

Tienes dos opciones:
- Abrir un chat desde la propia página del Whiteboard. Desde ahí sí se puede editar.
- Que haga un Whiteboard nuevo con todo el contenido. Si lo prefieres, dímelo y lo creo.

Los cambios para el tablero ya los tengo preparados:
- En la tabla de hitos, H0–H2 hechos y H3 renombrado a «Motor de runs», ya sin el login.
- La nota sobre H2 como riesgo principal pasa a «H2 cerrado».
- En el flujo, la caja de la rama dice «un commit por tarea → una vista previa» y la flecha de los resultados, «artifact + webhook».
- Una sección nueva con la máquina de estados del run, las vueltas a Develop y del feedback del cliente, y notas sobre cómo avanza y sobre el `MockProvider`.

**Resumen de las decisiones**
- **D20–D21:** cada run tiene un PR, un commit por tarea y un solo build por iteración. Los estados del run y de la tarea son una función pura con tests, y la línea de tiempo sale de `run_events`.
- **D22–D23:** los pasos avanzan con compare-and-swap y lease. Como en Hobby el cron solo se ejecuta una vez al día, los pasos caídos los recupera un `sweep()` que lanza el polling de la UI. Solo hay un run activo, y los que esperan aprobación se cancelan a las 24 h.
- **D24–D25:** H3 usa GitHub de verdad y solo simula el LLM, con 4 escenarios y merge real en `crm-demo`. La regla de D16 se aplica ya. La UI es mínima: `/runs` y `/runs/[id]`.

Antes de la sesión 07 en Claude Code, comprueba que `crm-demo` permite el merge squash y que `master` no tiene reglas de protección.

## ❯ Usuario

Dejamos el whiteboard pendiente de actualizar entonces, y cuándo esté todo terminado lo actualizamos al día. Y sí, crm-demo no tiene protección en master y permit el merge squash

## ● Claude

*Herramientas: ejecuta un comando en su entorno; actualiza `claude/PROCESO.md` en el Project.*

Ya no queda nada pendiente para empezar H3. En la entrada de la sesión 06 de `PROCESO.md` he marcado la comprobación de `crm-demo` como hecha y he anotado que el Whiteboard se actualizará al final.

Para abrir la sesión 07 en Claude Code, en `crm-agents`, puedes usar esto:

> Sesión 07 · H3 · Motor de runs. Lee `docs/DECISIONES.md` (sobre todo D20–D25) y la entrada de la sesión 06 en `docs/PROCESO.md`. Antes de escribir código, propón un plan de commits y las decisiones de detalle que veas, y espera mi visto bueno. El criterio de verificación es el de la sesión 06. Hay que verificar en producción contra `crm-demo` real, con `MockProvider`.

Recuerda copiar antes a `docs/` del repo los dos documentos del Project, porque D20–D25 solo están aquí por ahora.

## ❯ Usuario

*Adjuntos: `CLAUDE.md`.*

Lo único que en lo que difiere la doc del proyecto, porque se me olvidó enviártelo antes, es que el CLAUDE.md tuvo una update en el hito 2

## ● Claude

*Herramientas: actualiza `claude/CLAUDE.md` en el Project.*

He subido al Project el `CLAUDE.md` actualizado, así que `CLAUDE.md`, `DECISIONES.md` y `PROCESO.md` coinciden ya con el repo, con D20–D25 y la sesión 06 añadidas en `DECISIONES.md` y `PROCESO.md`.

Cuando cierres H3, en el `CLAUDE.md` del repo habrá que actualizar dos cosas:
- **Estructura:** `src/server/runs`, `agents` y `llm` dejan de estar reservadas, y aparecen `/runs` y `/runs/[id]`.
- **Estado:** H3 pasa a estar hecho.
