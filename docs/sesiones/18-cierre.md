# Sesión 18 · Cierre tras H8 (Project de Claude) · 26/11/2026

Conversación «Actualización del whiteboard del proyecto» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md`.*

Ya está la sesión 17. transcripción en el repo. Te adjunto los docs del repo y vemos como seguimos

## ● Claude

*Herramientas: lee sus notas de preferencias del Project; lee `PRUEBA.md` del Project; actualiza `PROCESO.md` en el Project; actualiza `DECISIONES.md` en el Project; actualiza `claude/CLAUDE.md` en el Project; lee `PROCESO.md`; lee `DECISIONES.md`; lee `CLAUDE.md`; lee `claude/CLAUDE.md` del Project; lee `PROCESO.md` del Project; lee `DECISIONES.md` del Project.*

Ya he subido al Project el `CLAUDE.md` nuevo. `PROCESO.md` y `DECISIONES.md` son demasiado grandes para subirlos desde aquí, igual que en la sesión 14. Sustitúyelos tú en el Project con los que me has pasado.

**Dónde estamos:** H0–H8 hechos. El run #27 llegó hasta el merge con el usuario de prueba, y lint, tipos, Vitest y el E2E están en verde. Queda poco, y casi todo es tuyo:

1. **Límite de gasto en la Console de Anthropic.** Haz esto antes de pasar el enlace. Con `RUNS_PER_DAY=50` y Claude primero en las tres cadenas, cualquiera con el usuario de prueba puede lanzar runs de pago.
2. **Arreglos de documentación que vienen de las sesiones 12 y 14 y nunca se hicieron:**
   - La sesión 08 sigue teniendo los apartados de D37 (Anthropic) y del push de prueba a `master`. Los dos son de la sesión 11, así que quien lea el proceso en orden verá D37 antes de que exista.
   - D10 («infraestructura gratuita») no tiene ningún extra que remita a D37 y D49.
3. **Whiteboard al día con H5–H8.** Desde el Project no se puede editar, así que tiene que ser desde un chat abierto en su propia página, como en la sesión 12.
4. **Las 4 preguntas cortas.** Pégamelas cuando tengas la página de entrega y te preparo los borradores con lo que hay en los docs.
5. **Antes de enviar, entra como lo haría un evaluador**, en una ventana privada: login, portada, el README en GitHub, los dos repos públicos (`crm-demo` tiene que serlo por D5) y ningún PR ni rama `run/*` abiertos en `crm-demo`.

Una cosa a tener en cuenta: el run #27 usó «recuento de presupuestos», así que solo quedan tres sugerencias sin usar (ciudad, filtro de presupuestos y ordenar clientes), más la de rechazo. Si entran varios evaluadores se acabarán pronto, pero pueden escribir sus propias peticiones, y eso ya lo dice D50.

Este es el primer fragmento. Arregla el cierre de la sesión 17 de `PROCESO.md`, que ahora ya tiene transcripción. Sustituye las dos últimas líneas por:

```markdown
**Resultado:** H8 hecho. Criterios 1 a 6 comprobados; el 5 en producción con el run #27. Transcripción en [`sesiones/17-h8-entrega.md`](./sesiones/17-h8-entrega.md).

**Pendiente del humano:** límite de gasto en la Console de Anthropic, Whiteboard con H5–H8 y las 4 preguntas cortas de la página de entrega.
```

Si te parece, el siguiente fragmento es el del punto 2: pasar los dos apartados de la sesión 08 a la 11 y el extra de D10.

## ❯ Usuario

Si

## ● Claude

Son tres cambios, los dos primeros en `PROCESO.md` y el tercero en `DECISIONES.md`:

**1. Sesión 08: borra este bloque**, que está justo antes de «**Hecho por el humano:** clave de Gemini…»:

```markdown
- **Anthropic como respaldo de pago (D37):** para no parar H5 hasta el día siguiente, el humano propuso usar sus créditos de Anthropic con la interfaz común.
  - Claude añadió `AnthropicClient`, que va detrás de Gemini en las tres cadenas ([crm-agents#3](https://github.com/daboy-dev/crm-agents/pull/3)).
  - Claude propuso Opus; el humano eligió Sonnet, porque basta con mostrar cómo se trabaja.
  - En el run #17 respondió las 4 llamadas reales: plan, división y las dos de Develop. La llamada grande de Develop costó unos 5 céntimos.
- **Push de prueba a `master`:** se hizo con commits vacíos creados con `git commit-tree`, para que un fallo del ruleset no dejara nada en `master`. Ninguno quedó en una rama.
```

**2. Sesión 11: pon cada parte en su sitio.**

a) En «Verificación en producción», criterio 5, sustituye la primera línea por esta:

```markdown
   - Un push directo a `master` falla por el ruleset, tanto por SSH con la cuenta del humano como por la API con el `GH_TOKEN` del panel: «Changes must be made through a pull request» (422). Se probó con commits vacíos creados con `git commit-tree`, para que un fallo del ruleset no dejara nada en `master`; ninguno quedó en una rama. ✅
```

b) En «Qué salió mal y qué se corrigió», justo después de la línea «Groq no puede ser respaldo de Develop con su capa gratuita (extra de D36).», añade:

```markdown
- **Anthropic como respaldo de pago (D37):** para no parar H5 hasta el día siguiente, el humano propuso usar sus créditos de Anthropic con la interfaz común.
  - Claude añadió `AnthropicClient`, que va detrás de Gemini en las tres cadenas ([crm-agents#3](https://github.com/daboy-dev/crm-agents/pull/3)).
  - Claude propuso Opus; el humano eligió Sonnet, porque basta con mostrar cómo se trabaja.
  - En el run #17 respondió las 4 llamadas reales: plan, división y las dos de Develop. La llamada grande de Develop costó unos 5 céntimos.
```

**3. D10: añade el extra** al final, después de «Ninguna clave en el repo: solo un `.env.example`.»:

```markdown

**Extra (26/11/2026, sesión 18):** la infraestructura sigue en planes gratuitos (Vercel Hobby, Neon, Blob y Actions), pero los LLM ya no del todo. Anthropic entra como respaldo de pago en H5 (D37) y va el primero en las tres cadenas para la entrega (D49). Para volver a la cadena gratuita (Gemini y Groq) basta con quitar las `LLM_CHAIN_*`.
```

He llamado a este chat «sesión 18». Al terminar te paso su entrada para `PROCESO.md`. Lo siguiente pendiente es tuyo: el límite de gasto en la Console y el Whiteboard. Cuando tengas las 4 preguntas, pégamelas.

## ❯ Usuario

Ya está el limite de gasto (30$). Ahora dime el prompt para actualizar el whiteboard

## ● Claude

Abre el Whiteboard en su propia página, inicia un chat ahí y pega esto:

```
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
```

Cuando esté, pásame las 4 preguntas.

## ❯ Usuario

Vale pues ya está el Whiteboard al día. ¿Queda algo pendiente de actualizar o comprobar? ¿Los README de los repos están al día?

## ● Claude

*Herramientas: lee https://github.com/daboy-dev/crm-agents; lee https://github.com/daboy-dev/crm-demo.*

No he podido leer los README: GitHub ha cortado las peticiones por límite de frecuencia dos veces seguidas. Si me adjuntas el `README.md` de cada repo, los reviso contra los docs. Esto es lo que miraría:

**README de `crm-agents`:**
- La URL del panel y que diga que el usuario y la contraseña de prueba se dan en la entrega, sin que aparezcan escritos.
- **Que hay que tener abierta la página del run.** El `sweep()` solo corre con la pestaña visible (D22). Si un evaluador cierra la pestaña a mitad de un run, este se queda parado hasta que vuelva. Es la limitación que más fácilmente puede confundir a un evaluador, así que debería estar bien a la vista y no solo en «límites conocidos».
- Que los evaluadores pueden fusionar (D50) y que el cambio acaba en producción de `crm-demo`, con el enlace al CRM.
- Las dos cadenas (D49): Claude primero por fiabilidad, y la gratuita con Gemini y Groq, que funcionó en H4–H6.
- Los límites con las cifras actuales: 1 run activo y el resto en cola, 50 runs al día (en la práctica unos 20–30 por los despliegues de Vercel Hobby) y 24 llamadas por run. También que un run que espera aprobación se cancela a las 24 h.
- Cómo se usaron Claude Code y el Project, con enlaces a `PROCESO.md`, `DECISIONES.md`, `docs/sesiones/` y `docs/evals/`. Esto responde a un requisito literal de la prueba («cuéntanos cómo los usaste»).

**README de `crm-demo`:** no sé si existe. Si no existe, o es el de `create-next-app`, merece la pena uno corto. Un evaluador va a llegar ahí desde los PRs. Bastaría con que dijera qué es (el CRM que modifican los agentes), el enlace a `crm-agents`, que los PRs `run/<id>` los abre el panel, qué hacen `pr-check.yml`, `preview-e2e.yml` y `neon-cleanup.yml`, y que `AGENTS.md` y `e2e/criteria/` son lo que leen los agentes.

**Lo demás que queda:**
- Comprobar que has aplicado los fragmentos de antes (cierre de la sesión 17, sesión 08 → 11 y extra de D10) y luego sustituir `PROCESO.md` y `DECISIONES.md` en el Project.
- La prueba como evaluador en una ventana privada que te dije: login, portada, repos públicos y nada abierto en `crm-demo`.
- Las 4 preguntas.
- La entrada de esta sesión 18 en `PROCESO.md`. Te la paso al final, cuando hayamos hecho los README y las preguntas.

## ❯ Usuario

*Adjuntos: `README.md`.*

No quiero poner credenciales directamente en el repo, las entregaré personalmente a los evaluadores. si veo que no puedo adjuntarlas, entonces sí lo pondré en el repo pero por el momento no las dejamos públicas. Te adjunto ambos README

## ● Claude

Me parece bien no poner las credenciales en el repo. La línea 8 del README de `crm-agents` ya lo dice así, solo la afino un poco. Los dos README están bien encaminados. Te paso los cambios en orden, cada uno para copiar y pegar.

## README de `crm-agents`

**1. Línea 8**, para que no dependa de que la página de entrega tenga un sitio para las credenciales:

```markdown
Las credenciales del usuario de prueba se entregan aparte. No están en el repo.
```

**2. Paso 5**, porque ahora no dice qué pasa tras las 3 iteraciones:

```markdown
5. **Testing** comprueba cada criterio en esa vista previa con Playwright. Si alguno falla, explica el fallo a Develop, que lo corrige. Si una tarea no pasa en 3 iteraciones, se bloquea y decides tú: reintentar o abandonar.
```

**3. Después del párrafo de la línea 19**, añade estos dos párrafos. Es lo más importante que falta: hoy lo del `sweep()` solo aparece de pasada en «Cómo funciona», y es justo lo que puede hacer creer a un evaluador que el sistema se ha colgado.

```markdown
**Deja abierta una página del panel (`/runs` o la del run) mientras trabaja.** No hay cron, porque Vercel Hobby solo lo ejecuta una vez al día. El run avanza con los webhooks de GitHub, y la página abierta retoma los pasos que se quedan a medias. Con la pestaña cerrada o en segundo plano, un run puede quedarse parado. Al volver a abrirla, sigue solo.

Para ver el bucle entre Develop y Testing sin esperar a que un modelo se equivoque, abre **Opciones avanzadas** en el formulario y marca «Simular fallo de criterio». El panel rompe un `data-testid` en la primera entrega de Develop, Testing explica el fallo y Develop lo corrige en la iteración siguiente.
```

**4. Línea 41.** Ahora dice que Develop «escribe con la Git Data API», pero quien hace los commits es el panel. Sustituye el principio de la frase:

```markdown
- **Un PR por run y un commit por tarea (D20).** Develop no ejecuta nada: devuelve archivos completos y el panel hace los commits con la Git Data API. `pr-check.yml` le devuelve los errores de tipos y lint, y genera la migración si cambia el esquema (D31, D33). Las tareas demasiado grandes se dividen (D34).
```

**5. Tabla de modelos.** La columna dice «Cadena gratuita», pero incluye Claude, que es de pago. Además, en H4 Claude aún no estaba en la cadena. Cambia la cabecera a:

```markdown
| Agente | Cadena por defecto (gratuita, con Claude de respaldo) | Cadena de la entrega (D49) |
```

En la línea 56, cambia «el día de la prueba» por «durante el desarrollo». Si no, se puede leer como el día en que la prueban los evaluadores.

**6. «Límites conocidos»**, añade al final:

```markdown
- **Runs que esperan aprobación:** se cancelan solos a las 24 h, para no bloquear la cola (D23).
- **Sin cron:** retomar un paso que se ha quedado a medias necesita una página del panel abierta (D22).
```

**7. Compruébalo en la portada:** que la sugerencia fuera de alcance se llame de verdad «Desactivar los tests», como dice la línea 19.

## README de `crm-demo`

**1. «Despliegue» tiene un error.** Dice que la rama de Neon «se borra al borrar la rama de Git», y en H1 se vio que eso no pasa (extra de D11). Sustituye esas frases por:

```markdown
Producción usa la rama principal de Neon. Cada vista previa usa una rama `preview/...`, que se crea con el despliegue y que `neon-cleanup.yml` borra al cerrarse el PR. Los datos de prueba se cargan una vez en producción y las ramas los heredan.
```

**2. Falta lo que un evaluador busca al llegar desde un PR.** Añade esta sección antes de «Stack»:

```markdown
## Cómo lo modifican los agentes

- El panel de `crm-agents` abre una rama `run/<id>` y un PR por petición, con un commit por tarea. `master` tiene un ruleset que exige PR.
- [`AGENTS.md`](./AGENTS.md) tiene las convenciones que recibe el agente Develop en cada tarea: dónde va cada cosa, los `data-testid` y las rutas que no puede tocar.
- Workflows de GitHub Actions:
  - `pr-check.yml`: en cada push a un PR, genera la migración con `drizzle-kit` si cambió `src/db/schema.ts` y comprueba tipos y lint. El commit de la migración es de `github-actions[bot]`.
  - `preview-e2e.yml`: cuando la vista previa está lista, lanza Playwright contra ella (E2E, criterios de aceptación y capturas a 1280 y 390 px) y deja los resultados en un artifact que descarga el panel.
  - `neon-cleanup.yml`: borra la rama de Neon de la vista previa al cerrarse el PR.
- `e2e/criteria/run-<id>.json` son los pasos que escribió el agente Testing para cada run fusionado. `e2e/criteria.spec.ts` los ejecuta en cada vista previa, así que funcionan como pruebas de regresión.

Muchas funciones del CRM (NIF, buscador, facturas vencidas, página de contacto, filtros…) las han añadido los agentes. Están en los PRs `run/*` de este repo.
```

**3. Línea 7:** convierte `crm-agents/docs/` en enlace: `[crm-agents/docs/](https://github.com/daboy-dev/crm-agents/tree/master/docs)`.

**4. Revisa tú la lista de «Qué hace».** Describe el CRM de H1. Puedes ponerla al día o dejarla como está, porque la frase del final del punto 2 ya dice que los agentes han añadido más funciones.

Estos cambios son de texto: puedes hacerlos a mano, o pasárselos a Claude Code en una sesión corta.
