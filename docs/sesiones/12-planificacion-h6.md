# Sesión 12 · Planificación de H6 (Project de Claude) · 25/11/2026

Conversación «Hito 5 y proveedor Anthropic» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `CLAUDE.md`, `DECISIONES.md`, `PROCESO.md`.*

Ya está el hito 5 listo. Como Gemini no paraba de dar problemas por saturación y demás, hemos puesto como tercera opción Anthropic mediante API Key. Tengo crédito que no utilizo, así que nos saltamos temporalmente esa regla de que todo sea gratuito ya que quiero terminar pronto la prueba técnica y esperando a Gemini no vamos a llegar. Te adjunto la doc actualizada. Su sesión también seh a exportado y está en el repo.

## ● Claude

Voy a subir al Project las tres copias actualizadas y revisar si hay algo que corregir antes de planificar H6.

*Herramientas: lee sus notas de preferencias del Project; actualiza `claude/CLAUDE.md` en el Project; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; lee `claude/CLAUDE.md` del Project; lee `claude/DECISIONES.md` del Project; lee `claude/PROCESO.md` del Project; lee `CLAUDE.md`; lee `DECISIONES.md`; lee `PROCESO.md`.*

Ya he subido al Project las copias de `CLAUDE.md`, `DECISIONES.md` y `PROCESO.md` que me has pasado.

**Resumen de H5:** Develop ya escribe código real con la cadena Gemini → Anthropic. `pr-check` genera la migración y le devuelve los errores de tipos a Develop sin esperar al build de Vercel. Las tareas que no caben se dividen solas, y los 6 criterios están comprobados en producción. Saltarte la regla de que todo sea gratis está bien justificado en D37: Gemini solo cobra si responde Anthropic, hay límite de gasto en la Console, y de paso el servicio de pago no tiene el problema de los términos de la capa gratuita para usuarios del Espacio Económico Europeo.

**Cosas que corregiría en el repo** (en el Project no las he tocado, para que las copias sigan iguales al repo):
- **`PROCESO.md`:** los apartados «Anthropic como respaldo de pago (D37)» y «Push de prueba a `master`» han caído dentro de la sesión 08 (planificación de H4), justo después de los criterios. Van en la sesión 11. Falta también una línea en blanco antes de `## Sesión 11`.
- **D10** sigue diciendo «Infraestructura gratuita» sin ninguna excepción. Añadiría un extra que remita a D37, para que los evaluadores vean que la regla se relajó a propósito y con un límite de gasto.
- **`CLAUDE.md`, apartado Stack:** sigue diciendo solo `GeminiProvider` y `MockProvider`. Pondría la cadena por agente con Gemini, Anthropic y Groq.
- **`RUNS_PER_DAY=15`:** en la sesión 09 quedó como temporal. Comprueba si ya está de vuelta en 5 en Vercel.

**Lo que hay que decidir en H6:**
1. **Cómo se comprueban los criterios `e2e` nuevos.** Es lo más importante. Ahora Playwright solo pasa los tests que ya existen y hace las capturas, así que nadie mira en el DOM el `data-testid` de lo que acaba de añadir Develop. Las opciones son, por ejemplo, que Actions guarde también una instantánea del DOM o del árbol de accesibilidad de cada página de `pages.ts`, o que Testing genere comprobaciones que se ejecuten en Actions.
2. **El contrato del veredicto:** qué devuelve Testing por cada criterio (pasa o falla, motivo, prueba) y qué le llega a Develop en la iteración siguiente.
3. **El modelo y su cadena:** tiene que ver imágenes, así que valen Gemini Flash y Anthropic y Groq queda fuera. También hay que mirar cuántos tokens gastan las capturas.
4. **El fallo provocado del criterio de H6:** una casilla nueva en el formulario, por ejemplo que Develop se deje un `data-testid` en la iteración 1.
5. **`LLM_CALLS_PER_RUN`:** en D35 quedó pendiente revisarlo cuando Testing fuera real.

¿Empezamos por el punto 1? De él depende casi todo lo demás. Cuando cerremos H6 actualizo también el Whiteboard del plan, que va retrasado desde H3.

## ❯ Usuario

Sí, vamos a ello

## ● Claude

El problema es este: un criterio `e2e` como «el buscador filtra por nombre» o «un NIF inválido muestra un error» solo se puede comprobar haciendo algo en la página. Ahora mismo Actions solo pasa los tests que ya existen y hace capturas, así que nadie comprueba lo nuevo. Además, buena parte de los criterios de D14 piden interacción: escribir en el buscador o enviar el formulario con un NIF inválido.

## Opciones

**A. Instantánea del DOM.** `screenshots.spec.ts`, que Develop no puede tocar, guarda también el HTML o el `ariaSnapshot` de cada página de `pages.ts`. Testing lo lee junto con las capturas y decide.
- A favor: es barato, no ejecuta código nuevo y sigue el patrón de D16.
- En contra: solo ve las páginas en reposo. «Filtra al escribir» o «muestra un error al guardar» se quedan sin comprobar, o Testing los da por buenos sin pruebas.

**B. Testing escribe tests de Playwright.** Sube un `.spec.ts` a la rama y Actions lo ejecuta.
- A favor: cubre cualquier interacción.
- En contra: es código generado por un LLM que corre en un workflow con los secrets de `crm-demo` (el mismo riesgo de D16, ahora también por parte de Testing). Si el test está mal, el fallo parece de Develop y se gastan iteraciones. Y si el commit va aparte, cuesta un build más.

**C. Comprobaciones declarativas con un ejecutor fijo.** Testing traduce cada criterio `e2e` a pasos en un JSON cerrado: `goto`, `fill`, `click`, `expectVisible`, `expectText` y `expectCount`, siempre por `data-testid` y validados con Zod. En `crm-demo` hay un spec fijo, `e2e/criteria.spec.ts`, protegido en `paths.ts` como los helpers, que lee ese JSON y lo ejecuta.
- El JSON va a `e2e/criteria/run-<id>.json` dentro de la misma cadena de commits que las tareas, así que no hay build extra (D20). Develop no puede escribirlo.
- No se ejecuta código generado: el ejecutor está escrito por nosotros y solo admite esos pasos.
- Las comprobaciones salen de los criterios aprobados, no del código de Develop, así que Develop no se corrige a sí mismo (D34).
- Cuando una comprobación falla, el ejecutor guarda el `ariaSnapshot` de la página (la parte útil de A). Testing explica a Develop qué faltaba con esa prueba delante.
- Los criterios `visual` siguen como hasta ahora: Testing los evalúa con un modelo que ve las capturas.
- Efecto secundario: al hacer merge, los JSON se quedan en `master` y cada petición deja sus pruebas de regresión.

## Recomendación

La C. Es la única que comprueba interacciones sin ejecutar código de un LLM, y encaja con lo que ya tenemos: rutas protegidas, artifacts y un commit por tarea. Lo que cuesta es escribir el ejecutor y el contrato del JSON, más o menos medio día en Claude Code.

Hay que vigilar dos cosas:
- **Los `data-testid` tienen que conocerse antes de que exista el código.** Propongo que el Orquestador los fije en el plan para cada criterio `e2e` (D28 ya habla de `data-testid`) y que Develop esté obligado a usarlos. El `superRefine` del contrato de Develop podría comprobar que aparecen en los archivos que devuelve.
- **Regresiones:** si un run posterior cambia la interfaz, los JSON antiguos fallarán como cualquier E2E existente. Me parece lo correcto, pero conviene saberlo.

## Lo que tienes que decidir

1. **¿Te vale la C?**
2. **¿Quién escribe las comprobaciones?**
   - (a) Testing, con una llamada por revisión del plan justo después de aprobarlo. Se guarda en `agent_steps` y se reutiliza en todas las iteraciones. Cada agente hace lo suyo: el Orquestador define qué se pide y Testing cómo se comprueba.
   - (b) El Orquestador, dentro del propio plan. Se ahorra una llamada y el humano ve las comprobaciones al aprobar, pero el plan crece y el Orquestador hace también de tester.

   Me inclino por la (a).

## ❯ Usuario

1. Sí, para este proyecto creo que lo más adecuado es la C. 
2. Vamos por la a). Como ya dijimos y decidimos, Testing es el único que testea.

## ● Claude

Lo registro como D38 y abro la entrada de esta sesión en `PROCESO.md`.

*Herramientas: ejecuta un comando en su entorno; edita `DECISIONES.md`; edita `PROCESO.md`; lee `DECISIONES.md`; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project.*

Guardadas D38 y la entrada de la sesión 12 en las copias de `DECISIONES.md` y `PROCESO.md` del Project.

**Resumen:** Testing traduce cada criterio `e2e` a pasos en un JSON cerrado, en una llamada por revisión del plan. Un spec fijo de `crm-demo` los ejecuta en la vista previa, así que nunca corre código generado por un LLM. Los `data-testid` los fija el Orquestador en el plan, Develop está obligado a usarlos, y los JSON se quedan en `master` como pruebas de regresión.

Hay un detalle que no he puesto en D38 porque no lo hemos hablado: **¿Develop ve los pasos de Testing?** Propongo que no. Develop recibe los criterios y sus `data-testid`. A partir de la iteración 2 recibe también el paso que falló y el `ariaSnapshot`, pero nunca la lista completa, para que programe para cumplir el criterio y no para pasar el test.

## Punto 2 · El veredicto de Testing

Mi propuesta:

**Cómo se decide cada criterio:**
- **`e2e`: lo decide el ejecutor, no el LLM.** El resultado sale de `results.json` sin interpretación. Testing no puede dar por bueno un criterio cuyo test ha fallado ni al revés. Solo redacta en español por qué ha fallado, con el paso y el `ariaSnapshot` delante.
- **`visual`: lo decide el LLM** con las capturas. Tiene que nombrar la captura en la que se basa (`clientes-390.jpg`, por ejemplo). Si no puede nombrarla, el criterio no pasa.

**Qué devuelve por cada criterio:** `{ id, task, verdict: pass | fail | needs_human, reason, evidence }`.
- `needs_human` sirve para un criterio `visual` que no se ve en ninguna captura. No gasta iteraciones de Develop: llega marcado a la aprobación final y decide el humano.
- **Regresiones:** si falla un E2E antiguo o un JSON de un run anterior, Testing tiene que asignarlo a una tarea de esta revisión según los archivos que tocó, y esa tarea vuelve a Develop.

**Cuándo se llama al LLM:**
- Solo cuando hace falta: si hay criterios `visual` o algún `e2e` ha fallado.
- Si todo es `e2e` y todo pasa, no hay llamada. Eso ahorra cuota y deja más margen en `LLM_CALLS_PER_RUN`.

**Qué recibe Develop en la iteración siguiente:** los criterios que fallaron, con su `reason`, el paso que falló y el fragmento del `ariaSnapshot`.

¿Te encaja así, o cambiarías algo? Lo que más conviene mirar es `needs_human` y lo de no llamar al LLM cuando todo pasa.

## ❯ Usuario

Me encaja así por el momento, que todo sea e2e

## ● Claude

Lo entiendo así: aceptas la propuesta del veredicto y, por ahora, todos los criterios son `e2e`, sin `visual`. Lo registro como D39 con esa lectura.

*Herramientas: edita `DECISIONES.md`; edita `PROCESO.md`; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project.*

Guardado como D39 en el Project. Los tres puntos que quedan son más pequeños, así que te los propongo juntos.

## 3 · Modelo y cadena de Testing

Como Testing ya no ve imágenes y sus peticiones son pequeñas (criterios, `data-testid`, `pages.ts` y, si hay fallos, fragmentos del `ariaSnapshot`), propongo:
- **Cadena:** `gemini:gemini-3.8-flash` → `gemini:gemini-3.6-flash` → `groq:openai/gpt-oss-120b` → `anthropic:claude-sonnet-5-5`. Aquí Groq va **antes** de Anthropic, porque es gratis y la petición cabe en sus 8.000 tokens por minuto. Si alguna vez no cabe, la cadena lo salta sola (D36).
- **Tope del `ariaSnapshot`:** unos 2 KB por fallo, para que la petición no crezca sin control.
- **Ajustes:** timeout de 60 s y razonamiento bajo, como el Orquestador.

## 4 · El fallo provocado (criterio de H6)

Hay que probar las dos salidas: que el fallo se corrija y que se bloquee. Como con «Simular error de tipos», es el panel quien rompe la salida. No le pedimos al LLM que se equivoque, porque eso no se puede reproducir. Propongo dos casillas en el formulario:
- **«Simular fallo de criterio»:** en la iteración 1, el panel quita de la salida de Develop uno de los `data-testid` del plan después del `superRefine` y antes del commit. El ejecutor falla ese criterio, Testing lo explica y en la iteración 2 Develop lo corrige.
- **«Simular fallo persistente»:** lo mismo, pero en todas las iteraciones. A la tercera, la tarea pasa a `blocked` y decide el humano (D5).

## 5 · `LLM_CALLS_PER_RUN`

Hago la cuenta para un run del NIF (2 tareas) con un fallo:

| Llamada | Cuántas |
|---|---|
| Plan | 1 |
| Pasos de Testing | 1 |
| Develop, iteración 1 | 2 |
| Develop, corrección | 1 |
| Testing, explicar el fallo | 1 |
| **Total** | **6** |

En el peor caso, con 3 iteraciones fallando en las dos tareas, se llega a unas 10. Si sumamos alguna reparación o una división, 12 se queda corto. Propongo subirlo a **16**: sigue sirviendo para parar un run que no avanza.

¿Te valen los tres, o cambias algo? Si te encajan, el siguiente paso es dejar escrito el criterio de H6 para la sesión de Claude Code.

## ❯ Usuario

PErfecto así y con 16

## ● Claude

*Herramientas: edita `DECISIONES.md`; edita `PROCESO.md`; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

H6 ya está planificado: lo he dejado como D40 y he cerrado la entrada de la sesión 12 en `PROCESO.md`, con el criterio de H6 y lo que tienes pendiente. Ya están actualizados en el Project, y te paso `DECISIONES.md` y `PROCESO.md` para copiarlos a `docs/` del repo.

**Resumen:** Testing trabaja con la cadena Gemini → Groq → Anthropic, y Groq vuelve a valer porque ya no hace falta ver imágenes. El fallo de criterio se provoca desde el panel en dos variantes: una que Develop corrige en la iteración 2 y otra que se bloquea a la tercera. `LLM_CALLS_PER_RUN` sube a 16.

**Criterio de H6:** antes de producción, `pnpm eval:testing`. En producción, seis comprobaciones:
1. Un run sin fallos, con una sola llamada de Testing y el JSON de pasos en `master` tras el merge.
2. Un fallo provocado que Develop corrige.
3. Un fallo provocado que acaba bloqueado.
4. Una regresión: el JSON de un run anterior se vuelve a ejecutar en el siguiente.
5. Seguridad: se rechazan las salidas de Develop que escriben en `e2e/criteria/**` y los planes con criterios `visual`.
6. Repetición: tras una caída simulada, Testing no vuelve a llamar al LLM.

**Antes de abrir Claude Code hace falta una cosa:** **peticiones de demo nuevas**. Las cuatro de D14 (NIF, buscador, facturas vencidas y contacto) ya están fusionadas en `master` desde H5. Para H6 y H7 necesitamos 3 o 4 nuevas, fáciles de comprobar en el DOM. Por ejemplo:
- un teléfono en la ficha del cliente;
- un filtro de facturas por estado;
- un contador de presupuestos pendientes en la cabecera;
- notas internas en el cliente.

¿Las eliges tú o te propongo una lista cerrada?

¿Quieres que ponga el plan en el Whiteboard? Desde la sesión 06 está pendiente de actualizar y ahora mismo va por H3.

## ❯ Usuario

Propón tu la lista, no importa qué funcionalidad elijamos mientras se demuestre el trabajo. Y sí, el plan debería ir al whiteboard. Se quedó en h4, no en h3. [enlace privado al Whiteboard]

## ● Claude

*Herramientas: consulta los artifacts; edita `DECISIONES.md`; edita `PROCESO.md`; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

He elegido cuatro peticiones nuevas para H6 y H7. Cada una pone a prueba una parte distinta del motor:

| Petición | Qué demuestra | Dónde se usa |
|---|---|---|
| **Filtro de facturas por estado** (un desplegable en `/facturas`) | Interacción, sin cambio de esquema | Run sin fallos (criterio 1) y regresión en el run siguiente (criterio 4) |
| **Notas internas del cliente** | Cambio de esquema, con su commit de migración | Fallo que Develop corrige (criterio 2) |
| **Duplicar un presupuesto** (botón en el detalle) | Interacción que escribe datos | Fallo que acaba bloqueado (criterio 3) |
| **Página `/resumen`** (clientes, presupuestos enviados e importe pendiente de cobro) | Página nueva en `e2e/pages.ts` | Run completo de H7 en móvil y escritorio |

Al elegirlas he visto un riesgo y lo he dejado como regla en el extra de D14: los pasos de Testing no deben depender de cifras exactas del seed. Las vistas previas acumulan los datos que crean `write-flow.spec.ts` y los propios pasos, así que un número solo se comprueba si se ha creado en el mismo test.

Los dos documentos ya están actualizados en el Project. Te paso `DECISIONES.md` y `PROCESO.md` para llevarlos a `docs/` del repo.

**Whiteboard:** como te decía, no puedo cambiarlo desde aquí, igual que pasó en la sesión 06. Ábrelo en su página, abre un chat desde ahí y pégale esto:

> Actualiza el plan con el estado al 25/11/2026. H4 hecho: el Orquestador planifica con Gemini, con replanificación y rechazo fuera de alcance. H5 hecho: Develop escribe código real con la cadena Gemini → Anthropic (claude-sonnet-5-5, respaldo de pago). pr-check.yml genera la migración y devuelve los errores de tipos antes del build, y las tareas demasiado grandes vuelven al Orquestador para dividirse. H6 planificado: Testing traduce cada criterio e2e a pasos JSON declarativos que ejecuta un spec fijo de crm-demo (e2e/criteria.spec.ts) en la vista previa. El veredicto lo da el ejecutor, no el LLM. Testing solo llama al LLM para escribir los pasos y para explicar los fallos, y su cadena es Gemini → Groq → Anthropic. De momento solo hay criterios e2e: lo visual lo revisa el humano en la aprobación final. En el flujo del run, añade el paso «Testing escribe los pasos» tras aprobar el plan y «pr-check» antes de la vista previa. Pendientes: H6 (implementación), H7 y H8.

Con esto la sesión 12 queda cerrada. Lo siguiente es la sesión 13 en Claude Code: el ejecutor y las rutas protegidas en `crm-demo`, y Testing en `crm-agents`.

## ❯ Usuario

Ya está actualizado el whiteboard

## ● Claude

*Herramientas: edita `PROCESO.md`; actualiza `claude/PROCESO.md` en el Project; envía `PROCESO.md`.*

He actualizado `PROCESO.md` en el Project: ya no figura como pendiente el Whiteboard, y en el resultado de la sesión 12 queda anotado que se actualizó desde su propia página. Te paso de nuevo el archivo para llevarlo a `docs/` del repo; `DECISIONES.md` no ha cambiado desde la última versión que te mandé.

Con esto el plan de H6 está completo y listo para la sesión 13 en Claude Code.
