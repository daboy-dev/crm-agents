# Sesión 16 · Planificación de H8 (Project de Claude) · 26/11/2026

Conversación «Sesión 15 y prueba técnica» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `PROCESO.md`, `DECISIONES.md`, `CLAUDE.md`.*

Terminada la sesión 15 y el h7. Te adjunto los últimos docs actualizados. Decisión relevante a tener en cuenta: he puesto Anthropic en prioridad 1, y los runs per day en 50. Quiero terminar pronto la prueba técnica para no extenderla más.

## ● Claude

*Herramientas: lee sus notas de preferencias del Project; consulta los archivos del Project; busca en la web «Vercel Hobby plan deployments per day limit»; lee `PRUEBA.md` del Project; actualiza `PROCESO.md` en el Project; actualiza `DECISIONES.md` en el Project; actualiza `claude/CLAUDE.md` en el Project.*

Ya tengo los tres documentos. Sobre lo que has decidido: con Claude primero, los evaluadores no se van a encontrar Gemini sin cuota ni saturado, que fue justo lo que atascó el run #25. Pero hay dos cosas que conviene dejar escritas antes de entregar.

**1. Con 50 runs al día, el límite real lo pone Vercel.** El plan Hobby tiene un tope de 100 despliegues cada 24 horas por cuenta, y cuentan también las vistas previas. Como `crm-agents` y `crm-demo` son de tu cuenta, comparten ese tope. Cada run genera unos 3–5 despliegues: 1–2 por iteración y el de producción tras el merge. Así que caben unos 20–30 runs al día, no 50. Si se pasa, hay gente en el foro de Vercel a la que se le quedó bloqueado más de 24 horas. Te recomiendo bajarlo a 20. Si lo dejas en 50, no pasa nada siempre que nadie abuse, pero que quede anotado.

**2. La prueba dice «no hace falta gastar dinero».** No lo prohíbe, pero en el README y en las respuestas conviene explicar que todo funciona gratis con Gemini y Groq (H4–H6) y que Claude va primero solo por fiabilidad. Volver a la cadena gratuita es cambiar `LLM_CHAIN_*`, sin tocar código. Asegúrate también de tener puesto el límite de gasto en la Console.

Aquí tienes el fragmento para `DECISIONES.md`:

```markdown
## D49 · Anthropic primero en las tres cadenas para la entrega
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Contexto:** en el run #25 (sesión 15) los dos Gemini Flash estaban agotados y Groq encadenó 11 avisos de límite por minuto y una respuesta fuera de contrato. Para la entrega, los evaluadores no deben encontrarse la cuota agotada ni modelos saturados.

**Decisión** (del humano):
- `anthropic:claude-sonnet-5-5` va el primero en `LLM_CHAIN_ORCHESTRATOR`, `LLM_CHAIN_DEVELOP` y `LLM_CHAIN_TESTING`. Gemini y Groq quedan detrás como respaldo gratuito, en el orden que tenían (D36, D40).
- `RUNS_PER_DAY` = 50. `LLM_CALLS_PER_RUN` sigue en 24 (sesión 15).
- Sin cambios de código: solo variables de entorno en Vercel.

**Consecuencias:**
- Coste: un run cuesta menos de 0,50 $ (D37), así que el máximo teórico ronda los 25 $ al día. Lo que de verdad lo frena es el límite de gasto de la Console.
- El riesgo de los términos de la capa gratuita de Gemini (extra de D26) casi desaparece: Gemini solo responde si Anthropic falla.
- La prueba pide planes gratuitos. El README explica que el sistema funciona con Gemini y Groq (H4–H6) y que Claude va primero por fiabilidad. Para volver a la cadena gratuita basta con cambiar `LLM_CHAIN_*`.
- Límite real: Vercel Hobby permite 100 despliegues al día por cuenta, vistas previas incluidas y sumando los dos proyectos. Un run genera unos 3–5, así que caben unos 20–30 runs al día aunque `RUNS_PER_DAY` sea mayor.
- Quedan desfasados el aviso de cuota de la portada (D48: «se usa el respaldo de pago hasta las 9:00») y la marca de «respaldo de pago» en tarjetas y línea de tiempo. Se cambian en H8.
```

Y el de `PROCESO.md`, que completaremos al cerrar la sesión:

```markdown
## Sesión 16 · Planificación de H8 (Project de Claude) · 26/11/2026

**Objetivo:** cerrar la entrega cuanto antes: peticiones para los evaluadores, cadena de modelos y documentación.

**Qué cambió por el camino:**
- **Cadena para la entrega (D49):** el humano puso Claude el primero en las tres cadenas y `RUNS_PER_DAY` a 50. Claude señaló que el límite real son los 100 despliegues diarios de Vercel Hobby (unos 20–30 runs) y que la prueba pide planes gratuitos, así que el README debe explicar que la cadena gratuita sigue funcionando.
```

**Propuesta de H8 en una sola sesión de Claude Code:**
1. **`demo-requests.ts`:** el recuento de presupuestos del cliente, que sigue libre, y dos peticiones nuevas que Claude Code compruebe contra `master`, por ejemplo un campo de teléfono (con migración) y algo interactivo.
2. **Arreglar los textos de D49:** el aviso de cuota y la marca de respaldo de pago.
3. **README de `crm-agents`:** URL, flujo en un diagrama, cómo se usó Claude Code y este Project, límites conocidos y enlaces a `DECISIONES.md`, `PROCESO.md` y `evals/`. Las credenciales van en el correo, no en el repo.
4. **Repaso de las transcripciones** de `docs/sesiones/` y de `CLAUDE.md`, que aún dice `RUNS_PER_DAY` (5) y `LLM_CALLS_PER_RUN` (16).
5. **Whiteboard al día con H5–H8.** Esto toca desde su propia página.

Me faltan dos cosas para cerrar el plan:
- **¿Los evaluadores pueden fusionar?** Te recomiendo que sí. Es el final del flujo, D11 solo deja un run activo y un merge malo se puede revertir.
- **¿Cuáles son las 4 preguntas cortas?** `PRUEBA.md` no las incluye. Pégamelas y preparo las respuestas aquí.

He intentado copiar al Project los tres documentos que me pasaste, pero no he podido hacerlo desde aquí. Las copias del Project siguen siendo las anteriores: sustitúyelas tú cuando puedas.

## ❯ Usuario

Sí, los evaluadores deberían poder fusionar. Las 4 preguntas cortas aún no las tengo, entiendo que estarán en la URL donde tengo que entregar la prueba técnica así que la dejamos para el final. Sustituyo las copias del Project cuando tengamos todo lo de esta sesión decidido

## ● Claude

Perfecto, entonces los evaluadores podrán fusionar. Aquí tienes los fragmentos de esta decisión.

Para `DECISIONES.md`:

```markdown
## D50 · Los evaluadores pueden fusionar
**Fecha:** 26/11/2026 · **Estado:** aceptada

**Contexto:** la aprobación final (D9) termina en un merge squash en `master` de `crm-demo`. Para la entrega había que decidir si el usuario de prueba puede llegar hasta ahí o si el run se queda en la vista previa.

**Decisión** (del humano, que coincide con la recomendación de Claude): sí. El usuario de prueba tiene los mismos permisos que el humano durante el desarrollo, y el run de un evaluador llega hasta el merge y `done`.

**Consecuencias:**
- Los evaluadores ven el flujo completo, con el cambio en producción de `crm-demo`.
- Con un solo run activo (D11), los merges van de uno en uno y no chocan entre sí.
- La regresión con los JSON de `e2e/criteria/` (D38), `pr-check` y la CI protegen `master`. Si algo se cuela, se revierte el squash a mano.
- `master` acumula las funciones que piden los evaluadores. Cada sugerencia de la portada se marca como «ya fusionada» en cuanto se usa (D48), así que la lista debe tener margen, y los evaluadores pueden escribir sus propias peticiones.
```

Para la entrada de la sesión 16 en `PROCESO.md`, dentro de «Qué cambió por el camino»:

```markdown
- **Merge de los evaluadores (D50):** el usuario de prueba puede aprobar y fusionar, para que los evaluadores vean el flujo completo hasta producción.
```

Las 4 preguntas quedan para el final.

**Siguiente decisión: qué peticiones sugiere la portada.** En `master` ya están el NIF, el buscador, las facturas vencidas, la página de contacto, el filtro de facturas, las notas, duplicar presupuesto, el resumen y el tipo de cliente. Te propongo esta lista, con una petición para cada parte del motor:

1. **Recuento de presupuestos del cliente:** «Muestra en el detalle de un cliente cuántos presupuestos tiene». Es una sola tarea, sin migración, y la más segura para el primer run. Sigue libre desde el run #24.
2. **Teléfono del cliente:** «Añade un campo de teléfono al formulario de cliente y muéstralo en el detalle». Cambia el esquema, así que pasa por el commit de migración de `pr-check`.
3. **Filtro de presupuestos por estado:** «Añade un desplegable en la lista de presupuestos para filtrar por estado». Es interacción sin cambio de esquema, con el mismo patrón que el filtro de facturas, que ya funcionó.
4. **Ordenar clientes:** «Permite ordenar la lista de clientes por nombre o por fecha de alta». Interacción con dos tareas probables.
5. **Una petición fuera de alcance**, marcada como tal: «Cambia el workflow de GitHub Actions para que no ejecute los tests». Enseña que el Orquestador la rechaza sin crear rama (run #12).

Antes de meterlas en `demo-requests.ts`, Claude Code comprobaría contra `master` que ninguna existe ya. ¿Te vale la lista, o quieres cambiar alguna?

## ❯ Usuario

Sí, me vale.

## ● Claude

Hecho. Aquí van los fragmentos de esta decisión.

Para `DECISIONES.md`, como extra al final de D14:

```markdown
**Extra (26/11/2026, sesión 16):** peticiones para los evaluadores en la portada (D48), propuestas por Claude y aprobadas por el humano. Cubren cada parte del motor:
- **Recuento de presupuestos del cliente** (libre desde el run #24): una sola tarea, sin migración. Es la más segura para un primer run.
- **Teléfono del cliente:** cambia el esquema, así que hay commit de migración (D31).
- **Filtro de presupuestos por estado:** interacción sin cambio de esquema, con el patrón del filtro de facturas.
- **Ordenar la lista de clientes** por nombre o por fecha de alta: interacción, con dos tareas probables.
- **Fuera de alcance:** «Cambia el workflow de GitHub Actions para que no ejecute los tests». El Orquestador la rechaza sin crear rama (D28, run #12). En la portada aparece marcada como ejemplo de rechazo.

Antes de añadirlas a `demo-requests.ts` se comprueba contra `master` que ninguna existe ya.
```

Para la sesión 16 en `PROCESO.md`, la línea de esta decisión y el cierre de la entrada:

```markdown
- **Peticiones para los evaluadores (extra de D14):** recuento de presupuestos del cliente, teléfono del cliente, filtro de presupuestos por estado, ordenar clientes y una petición fuera de alcance para enseñar el rechazo.

**Resultado:** D49 y D50 aceptadas y un extra en D14.

**Criterio de H8:**
1. `demo-requests.ts` tiene las cinco peticiones, comprobadas contra `master`, y la de fuera de alcance aparece marcada como tal.
2. El aviso de cuota de la portada y la marca de «respaldo de pago» reflejan la cadena de D49.
3. El README de `crm-agents` explica qué es, la URL, el flujo (con un diagrama), cómo se usaron Claude Code y el Project, la cadena gratuita frente a la de la entrega, los límites conocidos y los enlaces a `DECISIONES.md`, `PROCESO.md` y `evals/`. Sin credenciales.
4. `CLAUDE.md` está al día (variables y límites) y las transcripciones de `docs/sesiones/` están revisadas, sin claves ni datos personales.
5. Un run de una de las peticiones nuevas, lanzado con el usuario de prueba, llega hasta el merge y `done` en producción.
6. Lint, tipos, Vitest y el E2E del panel en verde.

**Pendiente del humano:**
- Límite de gasto en la Console de Anthropic.
- Whiteboard al día con H5–H8.
- Las 4 preguntas cortas, que estarán en la página de entrega. Se responden al final.

**Siguiente paso:** sesión 17 de Claude Code (H8), en `crm-agents`.
```

Con esto queda decidido todo lo de esta sesión, así que ya puedes sustituir las copias del Project. El siguiente paso es la sesión 17 en Claude Code, que debería caber en una sola sesión.
