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