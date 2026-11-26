# crm-agents

Prueba técnica para Speed Paradigm: tres agentes de IA (**Orquestador**, **Develop** y **Testing**) y un humano que aprueba modifican un mini CRM (clientes, presupuestos y facturas) a partir de peticiones en lenguaje natural.

- **Panel (este repo):** <https://crm-agents.vercel.app>. Contiene el motor de runs, los agentes y la UI.
- **CRM que modifican:** [`crm-demo`](https://github.com/daboy-dev/crm-demo), en producción en <https://crm-demo-daboy-dev.vercel.app>.

El usuario de prueba está en la página de entrega. No hay credenciales en el repo.

## Cómo probarlo

1. Entra en el panel con el usuario de prueba. Llegas a `/runs`.
2. Elige una de las **peticiones sugeridas** (rellenan el campo, no lo envían) o escribe la tuya, y envíala.
3. El **Orquestador** propone un plan con tareas y criterios de aceptación. **Apruébalo**, o devuélvelo con comentarios y lo rehace.
4. **Develop** escribe el código en la rama `run/<id>` de `crm-demo`, un commit por tarea, y abre un PR. Vercel crea una vista previa con su propia base de datos.
5. **Testing** comprueba cada criterio en esa vista previa con Playwright. Si alguno falla, explica el fallo a Develop, que lo corrige (hasta 3 iteraciones por tarea).
6. Revisa la vista previa y las capturas a 1280 y 390 px, y **aprueba el merge**. El cambio llega a producción de `crm-demo` (D50).

Un run tarda unos minutos, sobre todo por los builds de Vercel. La página se actualiza sola. La última sugerencia, «Desactivar los tests», está fuera de alcance: sirve para ver cómo el Orquestador rechaza una petición sin crear rama.

## Cómo funciona

```mermaid
flowchart LR
  H([Humano]) -- petición --> O[Orquestador]
  O -- plan --> A1{¿Aprueba el plan?}
  A1 -- comentarios --> O
  A1 -- sí --> D[Develop]
  D -- commits en run/id --> GH[(GitHub · crm-demo)]
  GH -- PR --> V[Vista previa en Vercel<br/>+ rama de Neon]
  GH -- pr-check: tipos, lint<br/>y migración --> D
  V -- deployment_status --> GA[GitHub Actions<br/>Playwright]
  GA -- workflow_run + artifact --> T[Testing]
  T -- fallo explicado --> D
  T -- todo pasa --> A2{¿Aprueba la vista previa?}
  A2 -- comentarios --> O
  A2 -- sí --> M[Merge squash en master]
```

- **Máquina de estados en la base de datos (D21, D22).** Las funciones de Vercel duran como mucho 300 s, así que ningún paso espera a un build. Cada run es una fila con su estado, y avanza con los webhooks de GitHub (D4, D17) y con un `sweep()` que se ejecuta mientras el panel de un run está abierto, sin cron. Cada paso usa compare-and-swap con *lease*, así que repetirlo no duplica nada.
- **Un PR por run y un commit por tarea (D20).** Develop no tiene acceso al sistema de archivos. Escribe con la Git Data API, y `pr-check.yml` le devuelve los errores de tipos y lint y genera la migración si cambia el esquema (D31, D33). Las tareas demasiado grandes se dividen (D34).
- **Testing no decide el veredicto (D38, D39).** El LLM escribe pasos declarativos por criterio. Un ejecutor fijo de `crm-demo` los lanza, y el resultado de Playwright es el veredicto. Los JSON de cada run fusionado quedan como regresión.
- **El humano aprueba en dos puntos (D9, D47):** el plan y la vista previa final. Cada acción envía exactamente lo que aprueba (revisión del plan o sha), así que no se puede aprobar algo que cambió mientras se miraba.
- **Un solo run activo a la vez y una cola (D11, D23).** Así se respetan las 10 ramas de Neon del plan gratuito.

## Agentes y modelos

Cada agente usa una cadena de `proveedor:modelo` (D36). Si un eslabón agota su cuota o no puede con la petición, se pasa al siguiente. Las salidas se validan con Zod y, si no cumplen el contrato, hay una llamada de reparación.

| Agente | Cadena gratuita (H4–H6, por defecto) | Cadena de la entrega (D49) |
|---|---|---|
| Orquestador | Gemini Flash → Claude → Groq | **Claude Sonnet** → Gemini → Groq |
| Develop | Gemini Flash → Claude | **Claude Sonnet** → Gemini |
| Testing | Gemini Flash → Groq → Claude | **Claude Sonnet** → Gemini → Groq |

El sistema se construyó y se comprobó con la capa gratuita de Gemini y Groq, y Claude solo como respaldo de pago (D37). Para la entrega, Claude va el primero, por fiabilidad: el día de la prueba, los modelos gratuitos llegaron a estar agotados o saturados durante un run entero (run #25, sesión 15). Volver a la cadena gratuita no requiere código: basta con quitar las variables `LLM_CHAIN_*` en Vercel. El panel marca como «respaldo» cualquier llamada que no haya usado el primer modelo de la cadena.

Las evaluaciones de los prompts con la cadena gratuita están en [`docs/evals/`](./docs/evals).

## Límites conocidos

- **Despliegues de Vercel Hobby:** 100 al día por cuenta, sumando los dos proyectos. Un run genera unos 3–5, así que caben unos 20–30 runs al día, aunque `RUNS_PER_DAY` sea 50.
- **Un run activo:** las peticiones simultáneas esperan en la cola, que muestra su posición.
- **Llamadas al LLM por run:** 24 como máximo. Si un run las agota, se bloquea y decide el humano.
- **Solo criterios comprobables en el DOM (D39).** El aspecto visual lo revisa el humano con las capturas en la aprobación final.
- **Alcance de Develop (D16, D31, D38):** no puede tocar los workflows, las migraciones (las genera `pr-check`), la configuración de build, lint y tests, las dependencias ni el ejecutor de criterios.
- **Las capturas** se guardan en Vercel Blob privado y solo se ven tras el login.

## Cómo se construyó

- **Planificación y decisiones** en un Project de Claude (claude.ai). Ahí se discutían las opciones y el humano decidía. El resultado son las 50 decisiones de [`docs/DECISIONES.md`](./docs/DECISIONES.md), cada una con su contexto y sus consecuencias.
- **Implementación con Claude Code**, una sesión por hito (H0–H8), con un criterio de verificación en producción que tenía que cumplirse para dar el hito por cerrado. [`CLAUDE.md`](./CLAUDE.md) da a cada sesión el contexto del proyecto.
- **Registro:** [`docs/PROCESO.md`](./docs/PROCESO.md) recoge cada sesión (objetivo, qué salió mal y qué se corrigió). Las transcripciones de Claude Code están en [`docs/sesiones/`](./docs/sesiones), revisadas para quitar claves y datos personales.

## Stack

Next.js 16 (App Router) con TypeScript estricto en Vercel Hobby · Neon (Postgres) con Drizzle · Gemini, Groq y Anthropic detrás de una interfaz `LLMProvider`, con un `MockProvider` para tests y simulaciones · Vitest para el dominio y Playwright para el E2E del panel · GitHub Actions.

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local   # rellena las variables (ver comentarios)
pnpm db:migrate
pnpm dev
```

```bash
pnpm lint && pnpm typecheck && pnpm test   # nada de esto llama a un LLM
pnpm e2e                                   # E2E del panel contra la rama e2e de Neon (.env.e2e)
```

Con `LLM_PROVIDER=mock`, los tres agentes usan el mock y no hace falta ninguna clave de LLM.
