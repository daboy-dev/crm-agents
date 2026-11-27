# Sesión 10 · Planificación de H5 (Project de Claude) · 24/11/2026

Conversación «Decisión sobre migraciones Drizzle» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `CLAUDE.md`, `PROCESO.md`, `DECISIONES.md`.*

El hito 4 ya está terminado, y esta es la última doc del repo. Su sesión exportada tb está en el repo.

## ● Claude

*Herramientas: lee sus notas de preferencias del Project; consulta los archivos del Project.*

Actualizo las tres copias del Project con las versiones del repo.

*Herramientas: actualiza `claude/CLAUDE.md` en el Project; actualiza `claude/PROCESO.md` en el Project; actualiza `claude/DECISIONES.md` en el Project; lee `claude/CLAUDE.md` del Project; lee `claude/PROCESO.md` del Project; lee `claude/DECISIONES.md` del Project.*

Ya he leído las versiones anteriores. Ahora las sustituyo por las del repo.

*Herramientas: actualiza `claude/CLAUDE.md` en el Project; actualiza `claude/PROCESO.md` en el Project; actualiza `claude/DECISIONES.md` en el Project.*

He sustituido `CLAUDE.md`, `PROCESO.md` y `DECISIONES.md` del Project por las versiones del repo. Ya incluyen la sesión 09, el H4 marcado como hecho y los extras de D26–D29.

**Resumen del H4:**
- El Orquestador planifica con Gemini usando el contexto real de `crm-demo`. Las 4 peticiones de D14 dieron planes válidos a la primera. El feedback produce una revisión 2 que lo recoge, y una petición fuera de alcance acaba en `rejected` sin rama ni PR.
- Lo más útil que salió de la sesión es la robustez ante Gemini. Los errores 503 y 504 hacen saltar al siguiente modelo, hay un retroceso de MINIMAL a LOW en `thinkingLevel`, y los criterios del plan solo se pueden comprobar en el DOM o en las capturas.
- Se gastaron 11 llamadas de las 40 diarias de Flash. Todas las respuestas llegaron de `gemini-3.6-flash`, porque `gemini-3.8-flash` daba 503 una y otra vez.

**Pendientes que pasan a H5:**
- **Quitar `RUNS_PER_DAY=15` en Vercel** para volver a 5. Lo pusiste de forma temporal.
- **Migraciones escritas por Develop:** la revisión 2 del NIF le pide ejecutar `pnpm db:generate`, y Develop solo puede escribir archivos. Hay que elegir antes de abrir Claude Code: o Develop escribe a mano la migración SQL y el snapshot de Drizzle, o el Orquestador deja de pedir comandos. Es la primera decisión de la planificación de H5.
- **El Whiteboard del plan** sigue sin actualizar desde la sesión 06.

¿Empezamos la planificación de H5 por lo de las migraciones?

## ❯ Usuario

Ninguna de las opciones sugeridas es la correcta. Orquestador nunca debería pedir comandos. Es develop quién modificará tanto el código como el schema de la base de datos (el de drizzle) y por tanto el action de la PR será quien ejecute el generate y si hay cambios generará un commit con la migración.

## ● Claude

De acuerdo, tiene más sentido que mis dos opciones. Develop solo toca `src/db/schema.ts`, la migración la genera la herramienta y no el LLM, y el Orquestador vuelve a hablar solo de lo que se ve en la vista previa. Antes de escribirlo como D31 hay que cerrar cuatro puntos que cambian el motor y la seguridad:

**1. El run tiene que esperar al commit de la migración.**
Ahora el motor mueve `run/<id>` a un sha X y espera el informe de X. Con la action, X es un sha intermedio: Vercel lo compila, pero la app usa una columna que su rama de Neon aún no tiene, así que su E2E falla. Después la action sube un sha Y con la migración. Propongo que el run no pase a esperar la vista previa hasta que llegue el `workflow_run` de esa action para X. Entonces el panel lee la rama: si se ha movido a un hijo de X, adopta Y como `head_sha` con un CAS; si no, se queda con X. Los informes de X se ignoran.

**2. El build de X se gasta.**
Cuando el esquema cambia, cada iteración cuesta dos builds y no uno (D20). Se puede evitar con un *Ignored Build Step* en Vercel que se salte el build si la migración está pendiente, pero hay que comprobar qué `deployment_status` publica Vercel en ese caso, si publica alguno. Mi propuesta: aceptar el doble build en H5, que solo pasa cuando cambia el esquema, y dejar el *Ignored Build Step* como mejora.

**3. La action ejecuta código de Develop con permiso de escritura.**
Por la misma razón que D16, el job hace `pnpm install` y `drizzle-kit generate` con el código de la rama, y además necesita `contents: write` para hacer el commit. Propongo:
- Que el job no tenga ningún secret y solo tenga el permiso `contents: write`.
- Instalar con `--ignore-scripts` y llamar a `drizzle-kit` directamente, no a un script de `package.json`.
- Añadir a `paths.ts` las rutas `drizzle/**` (las migraciones solo las escribe la action), `drizzle.config.ts`, `package.json` y `pnpm-lock.yaml`. Esto tiene una consecuencia: Develop no puede añadir dependencias, porque tampoco podría actualizar el lockfile. Para las peticiones de D14 no hace falta.

**4. `drizzle-kit generate` hace preguntas.**
Si un cambio es ambiguo (renombrar una columna o borrarla y crear otra), pide una respuesta por consola. En CI se quedaría colgado. Propongo:
- Una regla en `AGENTS.md`: solo cambios que añaden, sin renombrar ni borrar columnas.
- Un timeout corto en el job.
- Si el job falla, el motor lo trata como build roto con su mensaje y vuelve a Develop.

Un dato a favor: los commits hechos con `GITHUB_TOKEN` no lanzan otros workflows, así que no hay bucle. Y Vercel sí despliega Y, porque despliega por su propia app de GitHub, no por Actions.

¿Te valen las propuestas de los puntos 1 a 4? Con tu visto bueno escribo D31 y la entrada de la sesión 10 en `PROCESO.md`.

## ❯ Usuario

Sí, me parece bien. Que quede anotada y bien documentada la decisión de estos dos últimos mensajes (propuesta inicial tuya, que propuse yo y decisión final).

## ● Claude

*Herramientas: ejecuta un comando en su entorno; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

La decisión es la D31 en `DECISIONES.md`, y `PROCESO.md` tiene una entrada nueva: la sesión 10, planificación de H5. Los dos están actualizados en el Project, y te he enviado los archivos para que los copies en `docs/` del repo.

**Resumen de D31:**
- **Propuestas de partida:** las mías eran que Develop escribiera la migración a mano o que el Orquestador no pidiera nada que necesitara comandos. Tú descartaste las dos.
- **Decisión:** el Orquestador nunca pide comandos. Develop cambia el código y `src/db/schema.ts`, y una action del PR ejecuta `drizzle-kit generate` y sube un commit con la migración si hay cambios.
- **Cómo se aplica (aprobado por ti):**
  - El run espera a esa action y adopta el commit de la migración como cabeza.
  - Si el esquema cambia, la iteración cuesta dos builds.
  - La action no tiene secrets e instala sin ejecutar scripts.
  - Develop no puede tocar `drizzle/**`, `drizzle.config.ts`, `package.json` ni `pnpm-lock.yaml`. Por eso no puede añadir dependencias.
  - Solo se permiten cambios de esquema que añaden, para que `drizzle-kit` no se quede esperando una respuesta en CI.

La sesión 10 queda abierta. Lo siguiente es decidir qué contexto recibe Develop, su contrato, su prompt y su lista de modelos.

## ❯ Usuario

Vale, con qué seguimos entonces?

## ● Claude

Seguimos con la planificación de H5. Su criterio es «PR real que compila en su vista previa». Para cerrarla quedan cinco puntos, en este orden:

1. **Qué ve Develop.**
2. **Cómo se entera Develop de que su código no compila.**
3. **Qué devuelve.** El contrato de salida se definió en D24 y ahora hay que revisarlo.
4. **Modelos, tiempos y cuota.**
5. **Criterio de verificación de H5.**

Te propongo el punto 1. Lo hago corto porque se parece a D27:

**Contexto de Develop.** Una llamada por tarea, como fija D20, con:
- La tarea: título, descripción, archivos previstos y criterios.
- El `AGENTS.md` de `crm-demo` y el árbol del repo.
- El contenido completo de los archivos previstos de la tarea, más `src/db/schema.ts`. Se leen en la cabeza de `run/<id>` y no en `base_sha`, para que la tarea 2 vea lo que hizo la tarea 1. Un archivo previsto que no existe se trata como archivo nuevo.
- A partir de la iteración 2: los criterios que fallaron, el motivo que dé Testing y los errores de compilación (los del punto 2).

El problema de fondo está en el punto 2. Si el build de Vercel falla, Develop solo recibe el `deployment_status` con una descripción genérica, sin el error. Sin el error no puede corregirlo, y el criterio de H5 depende justo de eso. Hay dos caminos:
- **A. Leer el log del build con la API de Vercel.** Hace falta un token de Vercel en el panel. Esos tokens no se pueden limitar a un solo proyecto, así que el panel tendría acceso a toda la cuenta.
- **B. Aprovechar la action de D31.** Como el run ya la espera, puede hacer también `tsc --noEmit` y lint, y dejar los errores en un artifact que el panel descarga al recibir el `workflow_run`, con el mismo patrón que D16. Con un error de tipos, el run vuelve a Develop sin esperar al build de Vercel. Es más rápido y no necesita ningún token nuevo.

Mi recomendación es la B, y dejar el `deployment_status` en `failure` como último recurso para errores que solo se vean en el build de Vercel, como una migración que falla. Para esos casos Develop solo recibiría el mensaje genérico.

¿Te vale el contexto del punto 1, y vamos con la B en el punto 2?

## ❯ Usuario

1. Develop también debería ver además de los archivos previsto los imports del os mismos, así también puede ver sus tipos si los está importando. Incluso si es algo 'nuevo' debería incluir una funcionalidad, página o lo que corresponda que ya existra. Así la forma de trabajar siempre será la misma. 


2. b)

## ● Claude

Me parece bien, así Develop trabaja siempre igual: con un modelo a la vista. Lo concreto así:

**1. Contexto de Develop**
- **Imports a un nivel.** De cada archivo previsto que ya exista se leen también sus imports locales, los relativos y los de `@/`. Se resuelven `.ts`, `.tsx` e `index.ts`, y no se leen los de paquetes de `node_modules`. Solo se baja un nivel, sin seguir los imports de los imports, para que el contexto no crezca sin control.
- **Referencias.** Cada tarea del plan lleva un campo nuevo, `references`: de 1 a 3 archivos que ya existen y sirven de modelo. Por ejemplo, `src/app/clientes/page.tsx` y sus actions para la página de contacto, o el formulario de cliente para el campo NIF. Las elige el Orquestador, que ya ve el árbol. El `superRefine` comprueba que existen en el árbol y, si alguno falla, va a la llamada de reparación. De las referencias también se leen sus imports locales, al mismo nivel. Esto cambia el contrato del plan, así que se añade como extra a D28.
- **Tope de tamaño.** Por ejemplo, unos 150 KB de archivos. Si se pasa, primero se recortan los imports y luego las referencias, nunca los archivos previstos. Hay margen: el TPM es de 250K.
- Todo se lee en la cabeza de `run/<id>`.

**2. Opción B, en detalle**
Un workflow `pr-check.yml` en `crm-demo`, con dos jobs:
- **`migrate`**, con `contents: write`: ejecuta `drizzle-kit generate` y, si hay cambios, hace el commit de D31.
- **`check`**, con permiso de solo lectura: se ejecuta sobre la cabeza resultante, hace `tsc` y lint, y deja `check.json` en un artifact. Ahí van el sha comprobado, el sha de la migración si la hay y los errores recortados.

Separo los jobs porque `next typegen` y ESLint cargan la configuración de la rama, así que conviene que eso corra sin permiso de escritura. El panel recibe el `workflow_run`, adopta el commit de la migración y, si hay errores, devuelve la tarea a Develop con ellos. Eso gasta una iteración y no espera al build de Vercel.

**Una cosa que se nos escapó en D31.** `drizzle-kit` ejecuta `schema.ts`, que escribe Develop, y lo hace con un token con permiso de escritura. Como `master` no tiene protección, un `schema.ts` malicioso podría hacer push directo a `master`, por ejemplo por una inyección en el prompt. Propongo añadir en `crm-demo` un ruleset sobre `master` que exija PR. El merge squash del panel por la API sigue funcionando, porque es el merge de un PR. Tendrías que hacerlo tú en GitHub.

Si te parece bien, escribo D32 (contexto de Develop), D33 (`pr-check` y errores de compilación) y los extras de D28 (`references`) y de D31 (jobs separados y ruleset), y lo anoto en la sesión 10.

## ❯ Usuario

Sí, adelante

## ● Claude

*Herramientas: ejecuta un comando en su entorno; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

He añadido D32 y D33 a `DECISIONES.md`, junto con los extras de D28 y D31, y he anotado todo en la sesión 10 de `PROCESO.md`. Los dos están actualizados en el Project y te los he enviado para copiarlos al repo. En cada decisión queda qué propuse yo, qué cambiaste tú y qué se decidió al final.

**Resumen:**
- **D32 · Qué ve Develop:** además de la tarea y los archivos previstos, ve sus imports locales a un nivel y las referencias que elige el Orquestador en el plan, con un tope de unos 150 KB. Todo se lee en la cabeza de la rama `run/<id>`. El campo `references` va como extra en D28.
- **D33 · `pr-check.yml`:** el job `migrate` puede escribir y genera la migración. El job `check` es de solo lectura, comprueba tipos y lint, y deja los errores en un artifact. El panel devuelve esos errores a Develop sin esperar al build de Vercel.
- **Extra de D31:** para cerrar el hueco del push directo a `master`, hace falta un ruleset en `crm-demo` que exija PR. Esto lo tienes que configurar tú en GitHub.

Siguiente punto: el contrato de salida de Develop (D24). Hay que decidir si devuelve archivos completos o diffs, si puede escribir fuera de los archivos previstos y cuánto puede ocupar la salida. ¿Lo vemos?

## ❯ Usuario

Sí

## ● Claude

Te propongo el contrato de Develop para cada tarea, siguiendo D24 con los cambios que piden D31–D33.

**Salida de Develop**
- `files`: de 1 a 8 archivos, cada uno con `path` y su contenido completo, sin diffs.
- `commitMessage`: en inglés y con formato Conventional Commits, comprobado con una regex.
- `notes`: en español, para el humano y para Testing: qué ha hecho y qué ha supuesto.
- `evidence`: para cada criterio de la tarea, dónde verlo. Por ejemplo: «`data-testid="client-nif"` en `/clientes/[id]`». Así Testing (H6) sabe qué buscar en el DOM y en las capturas. El `superRefine` comprueba que hay una entrada por cada criterio.

**Por qué archivos completos y no diffs.** Los LLM se equivocan con los números de línea, y si un bloque de buscar y reemplazar no coincide, la edición falla de una forma difícil de reparar. La Git Data API pide el blob entero de todas formas. Lo que cuesta son los tokens de salida, y con archivos de este tamaño sobra margen.

**Qué archivos puede escribir.** Esta es la regla que más importa:
- Siempre fuera de las rutas prohibidas de `paths.ts` (D16 y D31).
- Puede escribir un archivo si está entre los previstos, si estaba en su contexto (un import o una referencia) o si es nuevo. **Nunca sobrescribe un archivo que existe y que no ha visto**, porque estaría reescribiendo a ciegas un contenido que no conoce y lo borraría. Si lo intenta, la salida va a la llamada de reparación con ese error.
- Los archivos que escriba fuera de los previstos se aceptan, y la UI los marca como «fuera del plan».
- No puede borrar archivos. Ninguna petición de D14 lo necesita.

**Límites y casos raros**
- Como mucho 60 KB por archivo y `maxOutputTokens` configurado en la llamada.
- Si Gemini corta la respuesta por tokens (`finishReason: MAX_TOKENS`), el JSON llega incompleto y una reparación no lo arregla. El paso falla con ese motivo, sin llamada de reparación.
- Si todos los archivos que devuelve son idénticos a los actuales, no hay commit. En la iteración 1 es un error. En las siguientes cuenta como iteración fallida, con la nota «Develop no cambió nada».
- Antes de cada commit, el panel normaliza los saltos de línea y añade una línea final si falta.

¿Te vale así, o quieres que Develop pueda borrar archivos?

## ❯ Usuario

Las evidence que pueda dejar develop son útiles, pero no debería decidir Develop qué es lo que se testea y lo que no. Sobre un fallo de max tokens, lo que debería ocurrir es que la tarea debería volver y repartirse en otras más pequeñas, según convenga.

## ● Claude

Tienes razón en las dos cosas. Si Develop dijera qué criterios se comprueban, estaría corrigiendo su propio examen. Lo replanteo así:

**`evidence`, solo como pistas**
- El campo es opcional y no hace falta una entrada por criterio. Develop indica dónde ha dejado cada cosa, por ejemplo un `data-testid` o una ruta.
- Testing (H6) siempre evalúa **todos** los criterios del plan aprobado, contra el informe y las capturas. Las pistas le ayudan a buscar, pero no cuentan como prueba: una pista que no se ve en el DOM o en las capturas no da nada por bueno.

**`MAX_TOKENS`: la tarea vuelve al Orquestador para dividirse**
- Si la respuesta de Develop se corta por `MAX_TOKENS`, el run vuelve a `planning` en un tercer modo, `split`, además de `replace` y `amend` de D29. El modo lo decide el evento y no `head_sha`.
- El Orquestador recibe la tarea, sus archivos y el motivo, y devuelve de 2 a 3 subtareas que la sustituyen en la revisión n+1. La tarea original queda marcada como dividida.
- **Los criterios se reparten pero no cambian.** El `superRefine` comprueba que cada criterio de la tarea original acaba en exactamente una subtarea y que no aparece ninguno nuevo. Las otras tareas del plan no se tocan.
- **Sin nueva aprobación del humano.** Como los criterios no cambian, el alcance que aprobó el cliente es el mismo y la división es solo de organización. La línea de tiempo la muestra. Las tareas anteriores que ya estaban hechas reutilizan su salida guardada en `agent_steps`.
- **Límites:**
  - Una tarea solo se divide una vez. Si una subtarea vuelve a cortarse, se bloquea y decide el humano.
  - Tras dividir, el plan puede pasar de las 4 tareas de D28, con un tope de 6.
  - Las subtareas empiezan en la iteración 1.
  - La respuesta cortada y la llamada del Orquestador cuentan en `LLM_CALLS_PER_RUN`.

Lo que más afecta al flujo de D9 es lo de la aprobación. ¿Te parece bien que la división no vuelva a pasar por el humano mientras los criterios no cambien? Si me das el visto bueno, escribo D34 (contrato de Develop) y los extras de D21 y D29, y lo anoto en la sesión 10.

## ❯ Usuario

Claro, eso seria lo ideal

## ● Claude

*Herramientas: ejecuta un comando en su entorno; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

He escrito D34 en `DECISIONES.md` con mi propuesta, tus dos correcciones y la decisión final, y la he anotado en la sesión 10 de `PROCESO.md`. Los dos están actualizados en el Project y te los he enviado para el repo.

**Resumen de D34:**
- **Qué devuelve Develop:** los archivos completos, un mensaje de commit, notas y pistas opcionales. Testing evalúa siempre todos los criterios del plan, y las pistas le ayudan a buscar, pero no cuentan como prueba.
- **Qué puede escribir:**
  - Archivos previstos, archivos de su contexto o archivos nuevos, siempre fuera de las rutas prohibidas.
  - Nunca sobrescribe un archivo que existe y que no ha visto.
  - No puede borrar archivos.
- **Si la respuesta se corta por `MAX_TOKENS`:**
  - La tarea vuelve al Orquestador, que la divide en 2 o 3 subtareas sin cambiar sus criterios y sin pasar otra vez por ti.
  - Cada tarea solo se divide una vez, y el plan puede llegar a 6 tareas.
  - Esto añade una transición nueva a D21, `developing → planning`, el modo `split` a D29 y el tope de 6 tareas a D28.

Quedan dos puntos de H5:
- **Modelos, tiempos y cuota de Develop.** Develop comparte la cuota de los modelos Flash con el Orquestador. Además, el timeout de 60 s probablemente se queda corto para generar archivos completos.
- **El criterio de verificación de H5.**

¿Seguimos con los modelos?

## ❯ Usuario

Sí

## ● Claude

Te propongo esto para Develop. Lo más delicado es el tiempo, no la cuota.

**1. Una llamada al LLM por invocación**
Hoy el paso `developing` hace todas las tareas seguidas en una misma función. Con Develop, cada llamada puede tardar uno o dos minutos, y con tres tareas y alguna llamada de reparación se pasa de los 300 s de Vercel. Propongo:
- Cada invocación hace una sola llamada, ya sea de una tarea o de una reparación.
- La salida se guarda en `agent_steps`, y el paso se vuelve a lanzar con `after()` para la siguiente.
- Cuando todas las tareas tienen salida, se hace la cadena de commits y la rama se mueve una sola vez, como fija D20.

Todo esto ya encaja con la caché por tarea de H3. Lo único que cambia es que el paso se trocea.

**2. Tiempos**
- Timeout de 150 s por llamada de Develop. Los 60 s de D26 se quedan para el Orquestador.
- **El lease tiene que durar más que el timeout.** Hoy se renueva a 90 s antes de cada petición. Con una llamada de 150 s, el lease caducaría a mitad de la llamada y el sweep lanzaría otra igual en paralelo, gastando cuota dos veces. Propongo que el lease sea el timeout más 30 s, es decir, 180 s para Develop.

**3. Parámetros de la llamada**
- `thinkingLevel: LOW`, con el mismo retroceso por modelo de D26. Escribir código compensa algo de razonamiento, y el mínimo es para planificar.
- `maxOutputTokens` a 32K. En Gemini, los tokens de razonamiento cuentan dentro de ese límite. Si se pasa, se divide la tarea, como fija D34.

**4. Modelos y cuota**
- `GEMINI_MODELS_DEVELOP` con el mismo orden que el Orquestador: `gemini-3.8-flash`, luego `gemini-3.6-flash` y, como último recurso, `gemini-3.5-flash-lite`. Si una tarea la resuelve Lite, la línea de tiempo lo marca, para que se vea que una iteración fallida puede venir de ahí.
- La cuota es por modelo, así que ordenar las listas de otra forma no da más llamadas. El límite real son las 40 llamadas diarias de Flash, compartidas por los tres agentes.
- Un run del NIF sin fallos gasta unas 4 llamadas: 1 de plan, 2 de Develop y 1 de Testing en H6. Con una iteración fallida, unas 7. Caben 5 o 6 runs reales al día, en línea con `RUNS_PER_DAY` = 5.
- `LLM_CALLS_PER_RUN` = 12 se queda justo con 3 iteraciones y alguna llamada de reparación o una división, pero está pensado para que un run que no avanza se pare. Propongo mantenerlo y revisarlo en H6, cuando Testing sea real.

Esto enlaza con el punto que queda, el criterio de H5. Ahí propondré un `pnpm eval:develop`, con la misma idea que `eval:plan`: aplicar la salida de Develop sobre los planes guardados en `docs/evals/` y comprobar los tipos en local antes de gastar builds reales.

¿Te valen los puntos 1 a 4?

## ❯ Usuario

Podriamos hacer las llamadas con otro proyecto de AI Studio? Las cuotas si no me equivoco están ligadas a cada proyecto, así 'liberamos' un poco eso. Además recuerda que deberíamos tener Groq como respaldo, por eso pusimos una interfaz común. Por lo demás todo ok

## ● Claude

*Herramientas: busca en los archivos del Project; busca en la web «Gemini API additional terms circumvent rate limits multiple projects»; lee https://discuss.ai.google.dev/t/is-it-allowed-to-use-friends-free-tier-api-keys-for-a-shared-project/190686.md; lee https://ai.google.dev/gemini-api/terms; lee https://developers.google.com/terms; busca en la web «Groq API free tier rate limits models»; busca en conversaciones anteriores; lee https://console.groq.com/docs/rate-limits.md.*

Los puntos 1 a 4 quedan aprobados; los escribo junto con esto en cuanto lo cerremos. Al revisar lo de los proyectos he encontrado algo más importante que la cuota.

**Un proyecto de AI Studio por agente**
Técnicamente funciona: la cuota es por proyecto. Pero los términos de Google lo desaconsejan. En los términos de las APIs de Google te comprometes a "You agree to, and will not attempt to circumvent, such limitations documented with each API." Crear proyectos solo para multiplicar la cuota gratuita encaja bastante con eso. Además, los términos dicen que para pasar de los límites hay que pedir permiso expreso a Google. Yo no lo haría.

**Lo importante: la capa gratuita no vale para este caso**
Los términos adicionales de la API de Gemini, "Effective March 23, 2026.", dicen "You may use only Paid Services when making API Clients available to users in the European Economic Area." El panel lo van a usar los evaluadores desde España, así que D26 tal como está, con un proyecto sin facturación, choca con eso. No soy abogado, pero la lectura parece bastante directa.

Lo veo así:
- **A. Activar la facturación en el proyecto de Gemini.** Cumple con los términos y además resuelve la cuota, porque el nivel de pago no tiene el tope de 20 peticiones al día. También deja de usar los prompts para entrenar. El gasto lo siguen limitando nuestros topes: `RUNS_PER_DAY`, `LLM_CALLS_PER_RUN` y la lista de modelos. Habría que mirar los precios actuales de Flash y poner una alerta de presupuesto en Google Cloud. Ojo, la alerta avisa, pero no corta.
- **B. Seguir en la capa gratuita** asumiendo que es una demo para pocas personas. Es una lectura arriesgada de los términos, y en una prueba técnica queda feo si alguien se fija.

Mi recomendación es la A, pero es tu dinero y tu decisión.

**Groq como respaldo**
No lo tengo en `DECISIONES.md`: D8 solo menciona Gemini y el mock, y no lo encuentro en chats anteriores. Lo anoto ahora. Hay un límite que cambia el diseño. Según la tabla de Groq, sus modelos de texto, como `openai/gpt-oss-120b`, tienen 30 | 1K | 8K | 200K: peticiones por minuto, por día, tokens por minuto y tokens por día. Esa tabla Groq la presenta como límites base del plan Developer, y otras páginas la recogen como los del plan gratuito.
- 8K tokens por minuto bastan para el Orquestador, que gastó unos 6K por llamada en H4.
- **No bastan para Develop**, cuyo contexto de D32 puede llegar a unos 40K tokens.
- Los modelos de Groq no ven imágenes, así que Testing tampoco podría evaluar capturas con ellos.

Propuesta: cambiar la lista de modelos de D26 por una cadena de `proveedor:modelo` por agente, por ejemplo `gemini:gemini-3.8-flash,gemini:gemini-3.6-flash,groq:openai/gpt-oss-120b`. Si una llamada no cabe en el límite de tokens de un eslabón, se salta ese eslabón. Así Groq sirve de respaldo real para el Orquestador, y para Develop solo si su contexto es pequeño o si se pasa a un plan de pago de Groq.

¿Qué haces con la facturación de Gemini, A o B? Con eso escribo D35 (tiempos, lease y modelos de Develop), D36 (cadena de proveedores con Groq) y el cambio de D26.

## ❯ Usuario

Optamos por B). Es una prueba técnica, recuerda.

## ● Claude

*Herramientas: ejecuta un comando en su entorno; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

Hecho: nos quedamos en la capa gratuita. Está en D26 como riesgo conocido y aceptado: consta mi recomendación de activar la facturación y que tú decidiste no hacerlo por ser una prueba técnica. Así, si un evaluador se fija, verá que se decidió sabiéndolo. Los documentos están actualizados en el Project y te los he enviado.

**Resumen:**
- **D35 · Tiempos de Develop:**
  - Cada invocación hace una sola llamada al LLM.
  - Timeout de 150 s y lease de 180 s, para que el sweep no duplique una llamada larga.
  - `thinkingLevel: LOW` y `maxOutputTokens` a 32K.
  - Cadena Flash → Flash → Flash-Lite. Si una tarea la resuelve Flash-Lite, la línea de tiempo lo marca.
- **D36 · Cadena de proveedores:** la lista de modelos pasa a ser una cadena de `proveedor:modelo` por agente, con Groq de respaldo. Si una llamada no cabe en el límite de tokens por minuto de un eslabón, ese eslabón se salta. Con los 8K tokens por minuto de su capa gratuita, Groq solo cubre de verdad al Orquestador.
- **Un proyecto de AI Studio por agente:** lo dejo anotado como descartado, por la sección 2d de los términos de Google. Si prefieres mantenerlo abierto, lo cambio.

**Pendiente tuyo:** el ruleset de `master` en `crm-demo`, y la cuenta de Groq con su `GROQ_API_KEY` en Vercel.

Queda el último punto de H5: su criterio de verificación, con el `pnpm eval:develop`. ¿Lo cerramos ahora o lo dejamos para mañana?

## ❯ Usuario

Ya está tanto el ruleset como ela api key de Groq

## ● Claude

*Herramientas: ejecuta un comando en su entorno; actualiza `claude/PROCESO.md` en el Project.*

Gracias, ya está anotado en la sesión 10 como hecho por ti. Con eso solo queda el criterio de H5. Te lo propongo:

**Antes de producción: `pnpm eval:develop`** (a mano y gasta cuota, como `eval:plan`)
- Primero se repite `pnpm eval:plan`. Los planes guardados en `docs/evals/` son de antes de D32 y no llevan `references`.
- Para cada plan de D14, Develop resuelve sus tareas. La salida se aplica sobre un clon local de `crm-demo` en `base_sha` y se hace lo mismo que `pr-check`: `drizzle-kit generate`, `tsc` y lint.
- Las salidas y los resultados se guardan en `docs/evals/`. Así se ajusta el prompt sin gastar builds ni runs.
- Coste: unas 11 llamadas de las 40 diarias. La cuota se renueva a las 9:00, así que conviene hacerlo a primera hora.

**En producción**
1. **Run del NIF, que cambia el esquema:**
   - El PR tiene un commit por tarea más el commit de la migración de `github-actions[bot]`.
   - `pr-check` sale en verde y la vista previa compila, con los 24 E2E existentes pasando. Testing sigue siendo el mock, que marca fallo si el E2E real falla.
   - El campo se ve en la vista previa. Tras aprobar y fusionar, producción tiene la columna.
2. **Run de la página de contacto, sin cambio de esquema:** no hay commit de migración y hay un solo build por iteración. La página nueva aparece en las capturas porque está en `e2e/pages.ts`. La UI muestra los archivos leídos, incluidas las referencias.
3. **Error de compilación:** con una casilla nueva, «Simular error de tipos», que inyecta un error en la salida de la iteración 1, `pr-check` devuelve el error y la iteración 2 lo corrige sin esperar al build de Vercel.
4. **Tarea demasiado grande:** con otra casilla, «Simular MAX_TOKENS», que finge la respuesta cortada en una tarea, el Orquestador real la divide con los mismos criterios, sin pasar por el humano, y el run sigue.
5. **Seguridad y repetición:**
   - Un push directo a `master` falla por el ruleset.
   - Una salida que sobrescribe un archivo que Develop no ha visto acaba en la llamada de reparación. Esto se prueba en Vitest con respuestas grabadas.
   - Con «Simular caída tras planificar» aplicada a Develop, el paso se reanuda sin repetir la llamada ni el commit.
6. **Groq:** una llamada real del Orquestador forzando la cadena solo a `groq:` en `eval:plan` da un plan válido. En CI se prueban, con respuestas grabadas, el salto de un eslabón donde la petición no cabe y los 429 de Groq.

Las dos simulaciones van en el formulario, como las de H3 y H4, porque esperar a que Gemini se equivoque o se corte no es reproducible.

¿Te vale así? Con tu visto bueno cierro la sesión 10 en `PROCESO.md` con este criterio y queda todo listo para abrir Claude Code con H5.

## ❯ Usuario

Sí, adelante

## ● Claude

*Herramientas: ejecuta un comando en su entorno; actualiza `claude/PROCESO.md` en el Project; envía `DECISIONES.md`, `PROCESO.md`.*

La planificación de H5 está cerrada. He añadido a la sesión 10 de `PROCESO.md` el criterio de verificación y el siguiente paso, que es la sesión 11 de Claude Code para H5. Los documentos están actualizados en el Project y te he enviado la versión final de `DECISIONES.md` y `PROCESO.md` para que la copies en `docs/` antes de abrir Claude Code.

**Resumen de la sesión 10:**
- **Develop solo cambia el esquema.** Las migraciones las genera `pr-check.yml`, que también le devuelve los errores de tipos y de lint (D31 y D33).
- **Contexto de Develop:** ve la tarea, los imports de sus archivos y referencias que ya existen y le sirven de modelo (D32). Devuelve los archivos completos y nunca sobrescribe uno que no haya visto. Si su respuesta no cabe, el Orquestador divide la tarea sin cambiar los criterios (D34).
- **Proveedores y tiempos:**
  - Cada invocación hace una sola llamada al LLM, y el lease dura más que esa llamada (D35).
  - La lista de modelos pasa a ser una cadena de proveedores, con Groq de respaldo para el Orquestador (D36).
  - Seguir en la capa gratuita de Gemini queda anotado como riesgo aceptado (extra de D26).

Al empezar la sesión 11, conviene lanzar primero `pnpm eval:develop`. Ahora ya ha pasado el reinicio de cuota de las 9:00, así que tienes las 40 llamadas de Flash del día disponibles.

El Whiteboard del plan sigue sin actualizar desde la sesión 06. ¿Quieres que lo pongamos al día ahora, antes de abrir Claude Code?

## ❯ Usuario

Sí, habría que ponerlo al día

## ● Claude

*Herramientas: consulta los artifacts; lee el Whiteboard del plan.*

Desde esta conversación puedo leer el Whiteboard, pero no modificarlo: solo puedo cambiar lo que se crea aquí. Si abres un chat desde la página del Whiteboard, ese chat sí puede editarlo. Ya lo he leído y te dejo las instrucciones para que las pegues allí:

---

Actualiza este Whiteboard al estado del proyecto a 25/11/2026. Cambia solo lo que se indica y mantén la disposición y los colores:

**Tabla de hitos**
- Columna «Día» → «Estado».
  - H0: «Hecho 23/11».
  - H1, H2, H3 y H4: «Hecho 24/11».
  - H5: «Siguiente».
  - H6, H7 y H8: «Pendiente».
- Quita el color de la fila de H2 y pon el resaltado azul en la fila de H5.
- Textos de «Verificado cuando…»:
  - H2: «Commit → preview → webhook → capturas, con login».
  - H3: «Run completo con MockProvider sobre GitHub real».
  - H4: «Plan con criterios que el cliente aprueba o rechaza».
  - H6: «Un fallo provocado vuelve a Develop y se corrige o se bloquea».
- Cambia el nombre de la fila de H3 a «H3 · Motor de runs». El login se hizo en H2.

**Nota bajo la tabla**
- Sustitúyela por: «**H2 cerró el bucle** (24/11). Riesgo actual: la cuota gratuita de Gemini (40 llamadas Flash al día), con Groq de respaldo para el Orquestador.»

**Flujo «Un run, de la petición a producción»**
- **Orquestador:** cambia «tareas + criterios» por «tareas, criterios y referencias». Añade una salida, con una flecha y la etiqueta «fuera de alcance», a una píldora blanca: «Rechazada, sin rama ni PR».
- **Rama + PR:** cambia el texto por «Rama run/<id> + PR · un commit por tarea».
- **Nuevo bloque blanco entre la rama y la vista previa:** «pr-check (Actions) · migración, tipos y lint».
  - Va de la rama a este bloque y de este bloque a un bloque «Vista previa de Vercel», que lleva al de Playwright.
  - Añade una flecha color terracota de pr-check a Develop, con la etiqueta «errores».
- **Develop:** añade una flecha discontinua de Develop al Orquestador, con la etiqueta «no cabe → se divide».
- **Flecha de Testing a Develop:** cambia la etiqueta por «fallos · máx. 3 por tarea».
- **Leyenda:** cambia «Azul: agentes (Gemini)» por «Azul: agentes (Gemini, Groq de respaldo)».

Haz sitio moviendo los bloques vecinos y que ninguna flecha cruce un bloque.

---

Las flechas rojas y discontinuas son las vueltas atrás del run: errores de tipos, tareas que no caben, fallos de Testing y feedback del cliente.

Cuando lo tengas, puedes abrir la sesión 11 de Claude Code para H5.
