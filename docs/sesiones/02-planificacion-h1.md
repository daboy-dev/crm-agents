# Sesión 02 · Planificación de H1 (Project de Claude) · 23/11/2026

Conversación «Hito 1 del proyecto» del Project de claude.ai donde se planificaba y se decidía. Exportada de claude.ai y revisada: no contiene claves ni datos personales, y el enlace privado al Whiteboard se sustituye por un marcador. Se omiten el razonamiento interno, las salidas de herramientas y el texto de los adjuntos que son copias de `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md` o `README.md` (están en el repo). Las acciones de Claude con herramientas se resumen en una línea; los documentos nuevos que escribe (prompts de las sesiones de Claude Code, el plan) se incluyen plegados.

---

## ❯ Usuario

*Adjuntos: `DECISIONES.md`, `PROCESO.md`, `CLAUDE.md`.*

El hito 0 ya está completado. Te adjunto aquí la documentación actualizada del repo, para que la actualices aquí en el proyecto también, y continuemos con el hito 1.

## ● Claude

Actualizo los documentos del proyecto con tu versión del repo y luego preparamos el H1.

*Herramientas: consulta los archivos del Project; lee `claude/PLAN.md` del Project; lee `PRUEBA.md` del Project; busca en la web «Neon free plan limits projects branches per project»; busca en la web «Neon Vercel integration preview branch per deployment free plan»; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project; actualiza `claude/CLAUDE.md` en el Project; actualiza `claude/PLAN.md` en el Project.*

<details><summary>claude/PLAN.md</summary>

```markdown
# Plan — prueba técnica Speed Paradigm

Estado al 23/11/2026: **H0 hecho** (`crm-agents` desplegado, `/api/health` en verde, CI en verde). Siguiente: **H1 · `crm-demo`**.

Copias en el proyecto de los documentos del repo `crm-agents`:
- `claude/DECISIONES.md` ← `docs/DECISIONES.md`
- `claude/PROCESO.md` ← `docs/PROCESO.md`
- `claude/CLAUDE.md` ← `CLAUDE.md`

## Resumen
- Develop escribe código real en el repo `crm-demo` (rama + PR) y Vercel genera la vista previa.
- Un webhook de GitHub mueve la máquina de estados del run, guardada en Neon.
- Playwright corre en GitHub Actions: tests y capturas a 1280 px y 390 px. Testing (Gemini) evalúa; máximo 3 iteraciones.
- El cliente aprueba el plan y la vista previa final; al aprobar, merge y producción.
- Repos, proyectos de Vercel y proyectos de Neon separados para `crm-agents` (panel) y `crm-demo` (CRM, con una rama de Neon por vista previa).
- PAT de permisos finos limitado a `crm-demo`. Vistas previas de `crm-demo` sin protección de Vercel.

## Hitos (lunes–viernes, ~4 h/día)
H0 base del repo ✅ · H1 CRM demo · H2 tubería sin IA (riesgo principal) · H3 panel y motor de runs · H4 Orquestador · H5 Develop · H6 Testing · H7 panel completo · H8 entrega.

## Pendiente
- Las 4 preguntas de la entrega (al final).
- Límites de Neon Free (comprobado 23/11/2026): 100 proyectos, **10 ramas por proyecto**, 1 GB y 100 CU-h por proyecto. Si se llenan las 10 ramas, las vistas previas de Vercel dejan de compilar → hay que limpiar ramas (propuesta D11 en la planificación de H1).

Whiteboard: [enlace privado al Whiteboard]
```

</details>

*Herramientas: lee `claude/DECISIONES.md` del Project.*

He sincronizado el proyecto. `DECISIONES.md` ya estaba igual que la versión del repo, así que no lo he tocado. He añadido `PROCESO.md` y `CLAUDE.md`, y en `PLAN.md` he marcado el H0 como hecho.

## H1 · `crm-demo`

**El límite de Neon que pedía comprobar D7:** el plan gratuito permite 100 projects, 10 branches each, 100 CU-hours per project, and 1 GB storage per project. Proyectos sobran. El problema son las ramas: alguien que llegó a 10 de 10 contó que the Vercel Neon integration step "Create database branch for deployment" failed, y entonces las vistas previas no llegan ni a compilar. Con agentes abriendo PRs, ese tope se alcanza en un día.

**Decisiones que propongo para H1:**

- **D11 · Limpieza de ramas de Neon.** Usar la integración Neon-Managed, porque Neon-Managed deletes the database branch when the Git branch is deleted. A eso se suma activar en GitHub el borrado automático de la rama al hacer merge, y que el panel borre la rama cuando un run se rechaza o se abandona. Además, como mucho 1 run activo a la vez (y hasta 3 PRs abiertos), así nunca se pasa de 10.
- **D12 · Mismo stack que `crm-agents`, pensado para que Gemini lo entienda.** Next.js 16, Drizzle, Neon y Tailwind, sin librería de componentes. La estructura sería plana y predecible: una carpeta por entidad (`clientes`, `presupuestos`, `facturas`) con página, server actions y queries. Llevaría su propio `AGENTS.md` con las convenciones, que el agente Develop leerá en cada tarea, y `data-testid` estables para Playwright.
- **D13 · Las migraciones se aplican en el build.** El comando de build de Vercel sería `drizzle-kit migrate && next build`. Cada vista previa migra su propia rama de Neon y producción migra al hacer merge. Las ramas se copian de producción, así que traen ya los datos de prueba.
- **D14 · El CRM tiene huecos a propósito.** Datos de prueba realistas (unos 15 clientes y presupuestos y facturas en distintos estados) y, a la vez, funciones que faltan adrede: sin NIF, sin buscador, sin facturas vencidas marcadas y sin página de contacto. Así los evaluadores tienen peticiones de demo que dan resultados visibles.

**Modelo de datos:**
- `clients`: nombre, email, teléfono y empresa.
- `quotes` y `quote_items`: borrador, enviado, aceptado o rechazado.
- `invoices` e `invoice_items`: se generan desde un presupuesto aceptado; pendiente o pagada, con fecha de vencimiento.

El login de demo usaría una cookie firmada y un usuario que se configura en variables de entorno.

**Criterio de verificación** (amplío el de PROCESO): `crm-demo` en producción con las tres entidades, CI en verde y **un PR de prueba que genere su vista previa con su propia rama de Neon y la borre al cerrarlo**. Así D11 queda comprobada antes de H2, que es el hito con más riesgo.

**Resumen:**
1. Neon gratuito solo da 10 ramas por proyecto: limpieza automática y 1 run activo como máximo.
2. `crm-demo` con el mismo stack y una estructura plana, con `AGENTS.md` y `data-testid`, para que lo modifique un LLM.
3. Migraciones en el build y huecos a propósito para las demos.

¿Apruebas D11–D14 tal cual o cambias algo? En cuanto me digas, las añado a `DECISIONES.md` y `PROCESO.md` y te preparo el prompt de arranque de la sesión 02 de Claude Code.

## ❯ Usuario

Lo apruebo así.

## ● Claude

*Herramientas: ejecuta un comando en su entorno; escribe `DECISIONES.md`.*

Now PROCESO.md.

*Herramientas: edita `PROCESO.md`; lee `PROCESO.md`; actualiza `claude/DECISIONES.md` en el Project; actualiza `claude/PROCESO.md` en el Project.*

Now the prompt for Claude Code.

*Herramientas: escribe `prompt-sesion-03-h1.md`.*

<details><summary>prompt-sesion-03-h1.md</summary>

```markdown
# Prompt · Sesión 03 · H1 · crm-demo (Claude Code)

Pegar en Claude Code, abierto en la carpeta del repo nuevo `crm-demo`.

---

Vamos a construir `crm-demo`, el mini CRM que modificarán los agentes del repo `crm-agents` (ver su `docs/DECISIONES.md`, sobre todo D2, D6, D7 y D11–D14). Este repo es el hito H1.

## Objetivo
CRM en producción en Vercel con clientes, presupuestos y facturas, CI en verde, y una vista previa por PR con su propia rama de Neon.

## Stack (D12)
- Next.js 16 (App Router), pnpm, TypeScript estricto con `noUncheckedIndexedAccess`, ESLint y Prettier (sin tocar Markdown). Mismas convenciones de configuración que `crm-agents`.
- Drizzle con `@neondatabase/serverless` (driver HTTP). Tailwind. **Sin** librería de componentes.
- Vitest para la lógica de dominio y Playwright para E2E (de momento, solo smoke tests locales; el workflow contra vistas previas es H2).

## Estructura (pensada para que la modifique un LLM)
- `src/app/(auth)/login`: login de demo.
- `src/app/(crm)/clientes`, `presupuestos`, `facturas`: cada carpeta con `page.tsx` (lista), `[id]/page.tsx` (detalle), `nuevo/page.tsx` si aplica, `actions.ts` (server actions) y `queries.ts`.
- `src/db/schema.ts`, `src/db/client.ts`, `src/db/seed.ts`. Migraciones en `drizzle/`.
- `src/lib/`: utilidades pequeñas (formato de moneda en EUR, fechas en `es-ES`, cálculo de totales con IVA).
- Componentes compartidos mínimos en `src/components/` (tabla, botón, badge de estado, layout con navegación). Responsive: debe verse bien a 390 px.

## Modelo de datos
- `clients`: id, name, email, phone, company, created_at.
- `quotes`: id, number (P-2026-001), client_id, status (`draft` | `sent` | `accepted` | `rejected`), issued_at, notes.
- `quote_items`: id, quote_id, description, quantity, unit_price (céntimos), tax_rate.
- `invoices`: id, number (F-2026-001), quote_id, client_id, status (`pending` | `paid`), issued_at, due_at.
- `invoice_items`: igual que `quote_items`.
- Una factura se genera desde un presupuesto `accepted` copiando sus líneas.
- **No** añadas NIF, buscador, marca de facturas vencidas ni página de contacto: son huecos a propósito para las demos (D14).

## Funcionalidad
- Clientes: listar, ver, crear y editar.
- Presupuestos: listar, ver con líneas y totales, crear con líneas, cambiar estado.
- Facturas: listar, ver, generar desde un presupuesto aceptado, marcar como pagada.
- `data-testid` estables en tablas, filas, botones principales y formularios (D12).
- Login de demo: cookie firmada (HMAC con `AUTH_SECRET`), usuario y contraseña desde `DEMO_USER` / `DEMO_PASSWORD`. Un middleware protege todo salvo `/login` y `/api/health`.
- `GET /api/health` como en `crm-agents` (consulta la base de datos, 503 si falla, `connection()` por `cacheComponents`).

## Datos de prueba (D14)
`pnpm db:seed` idempotente: unos 15 clientes españoles ficticios, presupuestos en los cuatro estados y facturas pendientes y pagadas, algunas con vencimiento pasado (sin marcar). Se ejecuta una vez contra producción; las ramas de Neon lo heredan.

## Despliegue (D13)
- Build de Vercel: `drizzle-kit migrate && next build` (script `pnpm vercel-build`).
- `.env.example` con `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `DEMO_USER`, `DEMO_PASSWORD`. Ninguna clave en el repo.

## AGENTS.md (D12)
Escríbelo para el agente Develop (otro LLM): estructura, dónde va cada cosa, cómo añadir un campo (schema → `pnpm db:generate` → queries → actions → UI → `data-testid`), convenciones de nombres, textos de UI en español, y qué no tocar (auth, middleware, config de build). Breve y concreto. Mantén también un `CLAUDE.md` que apunte a él.

## CI
GitHub Actions en cada push y PR: install, lint, format:check, typecheck, test.

## Pasos manuales que haré yo (avísame cuando toque)
1. Crear el repo **público** `crm-demo` en GitHub y activar *Automatically delete head branches*.
2. Crear el proyecto de Vercel `crm-demo` y añadir la integración **Neon-Managed** con rama por vista previa y borrado de la rama al borrar la rama de Git (D11).
3. Desactivar la Deployment Protection de las vistas previas (D6).
4. Añadir `AUTH_SECRET`, `DEMO_USER` y `DEMO_PASSWORD` en Vercel.

## Verificación de H1
- Lint, tipos y tests en verde; CI en verde.
- Producción: login, y las tres entidades con datos.
- Un PR de prueba (por ejemplo, cambiar un texto) genera su vista previa con una rama `preview/...` en Neon; al cerrar el PR y borrar la rama, la rama de Neon desaparece.

## Al cerrar
Prepara el texto de la entrada "Sesión 03 · H1" para `docs/PROCESO.md` de `crm-agents` (objetivo, cómo fue, qué salió mal y qué se corrigió) y la transcripción saneada para `docs/sesiones/03-h1-crm-demo.md`.

Trabaja con commits pequeños en Conventional Commits. Empieza proponiendo el plan de pasos y espera mi visto bueno antes de generar el proyecto.
```

</details>

*Herramientas: envía `DECISIONES.md`, `PROCESO.md`, `prompt-sesion-03-h1.md`.*

He añadido D11–D14 a `DECISIONES.md` en el proyecto. En D7, lo que estaba pendiente de comprobar queda ya comprobado y remite a D11.

En `PROCESO.md` he puesto el H1 como «En curso», con el criterio de verificación ampliado, y he añadido la entrada «Sesión 02 · Planificación de H1». Te mando los dos archivos para que sustituyas los de `docs/` en `crm-agents`.

**Resumen:**
1. **Ramas de Neon (D11):** uso la integración Neon-Managed y la rama se borra al hacer merge o al rechazar el run. Solo hay 1 run activo a la vez, así que no se llega al tope de 10 ramas.
2. **Cómo es `crm-demo` (D12–D13):** usa el mismo stack que `crm-agents`, con una carpeta por entidad, un `AGENTS.md` para Develop y `data-testid` estables. Las migraciones se aplican en el build.
3. **Datos de prueba (D14):** el CRM trae datos ficticios realistas y deja fuera a propósito el NIF, el buscador, la marca de facturas vencidas y la página de contacto, para usarlos como peticiones de demo.

**Siguiente paso:** pega `prompt-sesion-03-h1.md` en Claude Code, abierto en la carpeta nueva de `crm-demo`. Al final del prompt están las cuatro cosas que tienes que hacer tú a mano: crear el repo público, crear el proyecto de Vercel con la integración de Neon, desactivar la protección de las vistas previas y configurar las variables de entorno. Le he pedido a Claude Code que te proponga un plan y espere tu visto bueno antes de generar nada.

## ❯ Usuario

La doc inicial de crm-demo es únicamente DECISIONES.md?

## ● Claude

*Herramientas: edita `prompt-sesion-03-h1.md`; envía `prompt-sesion-03-h1.md`.*

No. `DECISIONES.md` no se copia a `crm-demo`. Se queda solo en `crm-agents`, para que las decisiones estén en un único sitio. Tu pregunta me ha hecho ver un fallo en el prompt: le pedía a Claude Code que consultara ese archivo, pero desde la carpeta de `crm-demo` no lo puede leer. Lo he corregido, y ahora el prompt incluye todo lo que necesita de las decisiones y deja claro que no las copie.

`crm-demo` llevará solo tres documentos, sin carpeta `docs/`:

- **`README.md`**: qué es, un enlace a `crm-agents`, cómo arrancarlo en local y las variables de entorno.
- **`AGENTS.md`**: las convenciones para el agente Develop. Es el documento más importante del repo, porque Develop lo recibe en cada tarea.
- **`CLAUDE.md`**: un archivo corto que apunta a `AGENTS.md` y lista los comandos.

El proceso, las decisiones y las transcripciones, también los de la sesión de `crm-demo`, se guardan en `crm-agents`.

En el prompt he puesto el enlace al repo como `github.com/daboy-dev/crm-agents`. Si el repo tiene otra URL, cámbiala antes de pegarlo.
