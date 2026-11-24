 ▐▛███▛█   Claude Code v2.1.331
▝▜██████▀  Opus 5.5 · Claude Max
 ▝▝   ▝▝   ~/Trabajo/pruebas-tecnicas/paradigma/crm-agents


❯ Sesión 09 · H4 · Orquestador con GeminiProvider                               
                                                                                
  Contexto: lee CLAUDE.md, docs/DECISIONES.md (sobre todo D8, D21–D24 y las     
  nuevas D26–D30) y la entrada «Sesión 08» de docs/PROCESO.md.                  
                                                                                
  Objetivo: el Orquestador planifica con Gemini de verdad. Develop y Testing    
  siguen con MockProvider, así que un run con plan real llega hasta el merge    
  escribiendo agent-runs/.                                                      
                                                                                
  Alcance:                                                                      
  1. GeminiProvider (D26)                                                       
     - @google/genai con generateContent, responseMimeType "application/json" y 
  un JSON Schema generado desde el contrato Zod. Sigue los tipos del SDK        
  instalado, no los ejemplos de la doc, que están desfasados.                   
     - Validar con Zod. Si no valida, una sola llamada de reparación con el     
  error de Zod; cuenta en el presupuesto.                                       
     - Lista de modelos por agente: GEMINI_MODELS_ORCHESTRATOR=gemini-3.8-flash 
  ,gemini-3.6-flash,gemini-3.5-flash-lite.                                      
     - Proveedor por agente: LLM_PROVIDER_ORCHESTRATOR=gemini; Develop y        
  Testing siguen en mock. LLM_PROVIDER=mock fuerza el mock en todos (plan B).   
     - 429 por minuto: no esperar dentro de la función. Aplazar el lease hasta  
  el retryDelay y que lo retome el sweep, sin contar como fallo para los 3 de   
  D22.                                                                          
     - 429 diario: pasar al siguiente modelo. Si no queda ninguno, el run pasa  
  a blocked con «Cuota de Gemini agotada; se renueva a las 9:00».               
     - Timeout de 60 s por llamada y razonamiento al mínimo.                    
     - agent_steps guarda el modelo, los tokens (entrada y salida) y la         
  latencia.                                                                     
     - Límites por defecto: RUNS_PER_DAY=5 y LLM_CALLS_PER_RUN=12.              
  2. Contexto del Orquestador (D27)                                             
     - La petición, más AGENTS.md, el árbol de rutas (Git Trees API,            
  recursivo), src/db/schema.ts y e2e/pages.ts de crm-demo.                      
     - Todo leído en el sha de master al empezar el run. Ese sha se guarda en   
  el run como base de run/<id>.                                                 
     - Guarda las rutas leídas para que la UI las muestre.                      
  3. Contrato del plan (D28): amplía el contrato Zod de H3.                     
     - feasible: false con un motivo lleva el run a rejected, sin rama ni PR.   
  Es una transición nueva planning → rejected en machine.ts, con su fila en la  
  tabla de tests.                                                               
     - summary y assumptions en español.                                        
     - De 1 a 4 tareas, cada una con título, descripción para Develop, archivos 
  previstos (comprobados contra paths.ts) y criterios con id y tipo e2e |       
  visual.                                                                       
     - Si se crea una página, la tarea incluye añadirla a e2e/pages.ts.         
  4. Replanificación (D29)                                                      
     - Feedback en el plan: plan completo que sustituye al anterior.            
     - Feedback en la vista previa final: solo tareas nuevas o correctivas      
  sobre la misma rama. El Orquestador recibe el plan anterior, el estado de     
  cada tarea y el feedback.                                                     
  5. Prompt del Orquestador en un archivo propio (src/server/agents/prompts/),  
  en español, con las reglas de alcance de AGENTS.md y de paths.ts.             
  6. UI en /runs/[id]                                                           
     - Plan con resumen, supuestos, tareas y criterios con su tipo.             
     - Motivo del rechazo cuando el plan no es viable.                          
     - Archivos leídos por el Orquestador.                                      
     - En la línea de tiempo, modelo, tokens y latencia de cada llamada.        
     - El selector de escenario del mock solo se muestra si Develop o Testing   
  son el mock.                                                                  
  7. Pruebas (D30)                                                              
     - Vitest solo con el mock y respuestas de Gemini grabadas: parseo,         
  reparación, salto de modelo, los dos tipos de 429, feasible: false y caché de 
  agent_steps. Nada en CI llama a Gemini.                                       
     - pnpm eval:plan, a mano: lanza las cuatro peticiones de D14 (NIF de       
  clientes, buscador, facturas vencidas marcadas y página de contacto) contra   
  Gemini y guarda los planes en docs/evals/.                                    
                                                                                
  Criterio de H4, comprobado en producción:                                     
  1. Las cuatro peticiones de D14 dan planes válidos de 1 a 4 tareas con        
  criterios comprobables.                                                       
  2. Un plan rechazado con feedback da una revisión 2 que lo recoge. Al         
  aprobarlo, el run sigue con el mock hasta done.                               
  3. Una petición fuera de alcance (por ejemplo, «cambia el workflow de GitHub  
  Actions») acaba en rejected con su motivo, sin rama ni PR.                    
  4. Repetir un paso no vuelve a llamar a Gemini, y las llamadas cuentan en     
  LLM_CALLS_PER_RUN.                                                            
  5. Modelo, tokens y latencia de cada llamada visibles en la línea de tiempo.  
                                                                                
  Cuota: solo hay 20 peticiones al día por modelo Flash (se renuevan a las      
  9:00). Cuenta las llamadas reales que vayas haciendo y no lances pruebas      
  contra Gemini que el mock pueda cubrir.                                       
                                                                                
  Variables: GEMINI_API_KEY ya está en Vercel (Production, Preview y            
  Development); tráela con vercel env pull. Documenta las variables nuevas en   
  .env.example. Nunca me pidas la clave por el chat.                            
                                                                                
  Forma de trabajar: como en sesiones anteriores, propón primero el plan de     
  commits y las decisiones de detalle, y empieza tras mi visto bueno. Antes de  
  cerrar: lint, tipos y tests en verde, el criterio comprobado en producción,   
  la entrada en PROCESO.md, la transcripción saneada en                         
  docs/sesiones/09-h4-orquestador.md y CLAUDE.md actualizado.                   

  Searched for 1 pattern, read 1 file, listed 1 directory, called ccd_turn (ctrl+o to expand)

⏺ Now the code.

  Read 4 files, ran 2 shell commands · 1 failed (ctrl+o to expand)

⏺ Sigo leyendo: ya tengo decisiones, motor y UI; ahora miro crm-demo y el SDK de
  Gemini antes de proponer el plan.

  Listed 1 directory, called ccd_turn 2 times, ran 7 shell commands (ctrl+o to expand)

⏺ He leído CLAUDE.md, las D1–D30, la sesión 08, el motor (engine.ts, machine.ts,
  store.ts), la capa LLM, la UI de runs, el AGENTS.md y el e2e/pages.ts de
  crm-demo, y los tipos de @google/genai 3.6.1, descargado en el scratchpad sin
  tocar el repo. Antes del plan, tres cosas que lo condicionan.

  Lo que he encontrado

  1. Hoy no se pueden crear runs con el límite nuevo. Hoy (UTC) ya hay 6 runs en
     la base de datos. Con RUNS_PER_DAY=5 el formulario no deja crear ninguno
     hasta las 00:00 UTC (01:00 en Madrid). Además, la cuota de Gemini se
     renueva a las 9:00, así que lo lógico es comprobar en producción mañana.
  2. No tengo GEMINI_API_KEY en local. No está en .env.local y la CLI de Vercel
     no está instalada. La forma de traerla sería pnpm dlx vercel env pull 
     .env.local, que puede pedirte iniciar sesión. Tú decides si la lanzo yo o
     la lanzas tú.
  3. Lo que hay que tener en cuenta del SDK:
     - ApiError solo trae status y message, que es el cuerpo JSON de Google. El
       retryDelay y el tipo de cuota (por minuto o por día) se sacan de ese
       JSON, de RetryInfo y QuotaFailure.violations[].quotaId.
     - Para generateContent, el SDK no reintenta salvo que se le pasen
       retryOptions. Lo fijo igualmente a attempts: 1 para que nunca espere
       dentro de la función.
     - El JSON Schema se pasa con responseJsonSchema, que acepta un subconjunto:
       sin minLength, maxLength ni pattern.
     - El razonamiento se ajusta con thinkingConfig.thinkingLevel: MINIMAL.
     - El timeout es httpOptions.timeout: 60000, más un AbortSignal.

  Decisiones de detalle

  Proveedor y llamadas (D26)
  - LLMProvider.generateObject devuelve también los metadatos de cada llamada: {
    output, calls: [{ model, inputTokens, outputTokens, latencyMs, kind: 
    "first" | "repair" }] }.
    - Recibe dos funciones de enganche. beforeCall() comprueba el presupuesto y
      renueva el lease; si se pasa de LLM_CALLS_PER_RUN, lanza BlockRun.
      onCall(meta) suma 1 a runs.llm_calls en la base de datos en ese momento.
    - Así la llamada de reparación cuenta, y un paso que se cae después no
      pierde la cuenta.
  - Un 429 no cuenta como llamada. Cuentan solo las respuestas del modelo, sean
    válidas o no.
  - Renuevo el lease (90 s) antes de cada llamada. Una llamada de 60 s más una
    reparación de 60 s pasarían de los 90 s.
  - 429 por minuto:
    - El proveedor lanza RateLimited(retryAfterMs).
    - El motor pone lease_until = now + retryDelay + 2 s, conserva el token, no
      toca step_attempts y deja en la línea de tiempo «Gemini: límite por
      minuto, se reintenta en N s». El sweep lo retoma.
    - Si el cuerpo no deja claro el tipo de cuota, lo trato como por minuto.
  - 429 diario:
    - Paso al siguiente modelo y apunto el modelo agotado en app_meta con la
      fecha del Pacífico. Así las llamadas siguientes de ese día no gastan una
      petición en descubrirlo.
    - Si no queda ningún modelo, el run pasa a blocked con «Cuota de Gemini
      agotada; se renueva a las 9:00». «Reintentar» vuelve a planning.
  - Proveedor por agente:
    - LLM_PROVIDER_{ORCHESTRATOR,DEVELOP,TESTING}, mock por defecto.
      LLM_PROVIDER=mock fuerza el mock en todos.
    - Se guarda una foto en una columna nueva, runs.providers (jsonb), al crear
      el run. La columna provider se queda como texto resumen.
  - agent_steps gana columnas: model, input_tokens, output_tokens y latency_ms
    (totales del paso) y calls (jsonb con el detalle de cada llamada).

  Contexto (D27)
  - Base del run: runs.base_sha se fija la primera vez que se planifica y se
    reutiliza en cada revisión. stepDeveloping parte de base_sha en lugar de
    getBaseSha().
  - Qué se lee:
    - El árbol con GET /git/trees/{sha}?recursive=1, solo blobs. Excluyo
      agent-runs/**, que crece con cada run y no aporta nada.
    - Los tres archivos con /contents?ref=sha.
    - Las rutas leídas se guardan en runs.context_paths.
  - Si agent_steps ya tiene el plan, no se vuelve a leer el contexto.

  Contrato (D28)
  - Un solo objeto, no una unión discriminada. Gemini lleva mejor un objeto
    plano:
    - { feasible, rejectionReason?, summary, assumptions[], tasks[] }, con
      superRefine:
      - feasible: false → motivo obligatorio y 0 tareas.
      - feasible: true → de 1 a 4 tareas.
    - Cada tarea es { title, description, files[1–10], criteria[1–6]: { id, 
      type: "e2e" | "visual", text } }.
  - Hay dos niveles de validación:
    - Esquema base: se convierte a JSON Schema para Gemini con z.toJSONSchema y
      quitando las claves que Gemini no admite.
    - Comprobación contextual con el árbol: cada files pasa checkPaths, los ids
      de criterio no se repiten, y si una tarea crea un src/app/**/page.tsx que
      no está en el árbol, alguna tarea debe incluir e2e/pages.ts.
    - Los errores de ambos niveles van a la llamada de reparación.
  - tasks.acceptance_criteria pasa de string[] a { id, type, text }[].
    - Una migración convierte los datos existentes. Cambian en consecuencia
      TaskBrief, el mock y el veredicto de Testing.
    - Las tareas guardan además files, y el run guarda plan_assumptions y
      rejected_reason.

  Máquina de estados
  - Evento nuevo plan_infeasible { reason }: planning → rejected.
    - En la primera revisión no hay rama, así que no hay cleanup.
    - Si ocurre al replanificar tras la vista previa final, la máquina ya añade
      cleanup y se cierra el PR. Es lo más simple y cumple el texto de D28. La
      alternativa, volver a awaiting_final_approval, choca con la caché por
      revisión de agent_steps.
    - Añado filas a la tabla de tests para los dos casos.

  Replanificación (D29)
  - El modo se decide por run.head_sha:
    - Nulo → replace: un plan completo nuevo.
    - Con valor → amend: solo tareas nuevas o correctivas.
  - En amend, el Orquestador recibe el plan anterior, el estado y el último
    feedback de cada tarea, y el feedback del cliente.
  - Las tareas nuevas van en la revisión n+1 sobre la misma rama. Testing evalúa
    solo esas, como ya hace el motor.

  Prompt
  - src/server/agents/prompts/orchestrator.ts: un texto en español con las
    reglas de alcance (lo que rechaza y cuándo) y el bloque «No tocar» de
    AGENTS.md resumido.
    - Las rutas prohibidas se importan de paths.ts para no duplicarlas.
    - El constructor del prompt es una función pura, con tests.

  Criterio 4 en producción
  - Añado una casilla «Simular caída tras planificar», independiente del
    proveedor y con las columnas simulate_plan_crash y plan_crashed_at.
  - Hace caer el paso una vez justo después de guardar agent_steps. Al reanudar,
    llm_calls no cambia. Es el mismo mecanismo que la caída simulada de H3.

  Pruebas (D30)
  - El cliente de Gemini se inyecta: se pasa una función generateContent falsa.
  - Fixtures en src/server/llm/fixtures/gemini/:
    - Las respuestas correctas salen de las llamadas reales de eval:plan, porque
      el eval guarda también la respuesta en bruto.
    - Los cuerpos de los 429 los escribo a mano con el formato documentado de
      Google; no tengo ninguno real. Si aparece uno, lo grabo.
  - La caché de agent_steps: extraigo la lógica de cachedCall a una interfaz de
    almacenamiento y la pruebo con una implementación en memoria.
  - pnpm eval:plan: vitest run -c vitest.eval.config.ts, que reutiliza los alias
    @/ sin dependencias nuevas.
    - Lee el contexto real de crm-demo y llama a Gemini con las 4 peticiones de
      D14.
    - Escribe docs/evals/plan-<slug>.json y un docs/evals/README.md con el
      resumen.
    - Queda fuera de pnpm test.

  Cuota prevista de Gemini
  - eval:plan: de 4 a 8 llamadas.
  - Producción: el run con feedback gasta 2 y el de fuera de alcance 1, más
    alguna reparación.
  - En total, unas 7–14 llamadas de Flash de las 40 del día.
  - Criterio 1: la propuesta es cubrirlo con eval:plan, que usa el mismo código,
    el mismo Gemini y el contexto real de crm-demo, más los 2 runs de
    producción. Lanzar las 4 peticiones como runs en producción gastaría 4 de
    los 5 runs del día. Si quieres los 4 también en producción, haría falta
    subir RUNS_PER_DAY temporalmente en Vercel.

  Plan de commits

  1. chore: add @google/genai and document H4 env vars: .env.example y límites
     por defecto 5 y 12.
  2. feat(db): add plan, context and call metrics columns: migración 0003, con
     la conversión de los criterios existentes.
  3. feat(agents): extend plan contract with feasibility and typed criteria:
     contrato, comprobación contextual, mock, TaskBrief y tests.
  4. feat(runs): add planning to rejected transition: machine.ts y su tabla de
     tests.
  5. refactor(llm): return call metadata and pick a provider per agent
  6. feat(llm): add GeminiProvider with repair, model fallback and quota 
     handling: más fixtures y tests.
  7. feat(github): read orchestrator context at the base sha
  8. feat(agents): add orchestrator prompt with replace and amend modes
  9. feat(runs): wire Gemini planning into the engine: base sha, aplazamiento
     por 429, bloqueo por cuota, métricas, lease, caída tras planificar y test
     de la caché.
  10. feat(ui): show plan, rejection, context files and call metrics: incluye el
      selector de escenario condicionado.
  11. feat: add eval:plan script and saved plans: un commit para el script y
      otro con docs/evals/ tras ejecutarlo.
  12. docs: …: extras en D26–D29, PROCESO.md, CLAUDE.md y la transcripción
      docs/sesiones/09-h4-orquestador.md.

  ¿Me das el visto bueno al plan y a las decisiones, incluido cubrir el criterio
  1 con eval:plan más 2 runs en producción, y me dices si lanzo yo pnpm dlx 
  vercel env pull .env.local o lo lanzas tú?

❯ Visto bueno                                                                   

  Called ccd_turn (ctrl+o to expand)

⏺ Bash(pnpm add @google/genai@3.6.1 2>&1 | tail -5 && git status --short)
  ⎿    × adding a new package
       ╰─▶ Ignored build scripts: protobufjs@7.6.6
       help: Run "pnpm approve-builds" to pick which dependencies should be
     … +5 lines (ctrl+o to expand)
  ⎿  Updated package.json +1
      16      "db:migrate": "drizzle-kit migrate"
      17    },
      18    "dependencies": {
      19 +    "@google/genai": "3.6.1",                                  
      20      "@neondatabase/serverless": "^1.2.1",
      21      "@vercel/blob": "^2.9.0",
      22      "drizzle-orm": "^0.45.4",
  ⎿  … +1 file changed
     pnpm-lock.yaml

  Listed 1 directory (ctrl+o to expand)

⏺ Bash(cat > pnpm-workspace.yaml <<'EOF'
      allowBuilds:…)
  ⎿  Lockfile is up to date, resolution step is skipped
     Already up to date
     Done in 80ms using pnpm v12.9.1
     … +2 lines (ctrl+o to expand)
  ⎿  Updated package.json +1 -1
      16      "db:migrate": "drizzle-kit migrate"
      17    },
      18    "dependencies": {
      19 -    "@google/genai": "3.6.1",                                  
      19 +    "@google/genai": "^3.6.1",                                 
      20      "@neondatabase/serverless": "^1.2.1",
      21      "@vercel/blob": "^2.9.0",
      22      "drizzle-orm": "^0.45.4",
  ⎿  Updated pnpm-lock.yaml +1 -1
      167    .:
      168      dependencies:
      169        '@google/genai':
      170 -        specifier: 3.6.1                                      
      170 +        specifier: ^3.6.1                                     
      171          version: 3.6.1(supports-color@7.2.0)
      172        '@neondatabase/serverless':
      173          specifier: ^1.2.1
  ⎿  Updated pnpm-workspace.yaml +1
      1  allowBuilds:
      2    esbuild: true
      3 +  protobufjs: false                                             
      4    sharp: false
      5    unrs-resolver: false

⏺ Now .env.example and limits.

⏺ Bash(python3 - <<'EOF'
      p='.env.example'…)
  ⎿  f9b609e chore: add @google/genai and document H4 env vars
  ⎿  Updated .env.example +13 -8
      21  BLOB_STORE_ID=
      22  VERCEL_OIDC_TOKEN=
      23  
      24 -# H3 · Motor de runs (D10, D23, D24). Opcionales: estos son los
         - valores por defecto.                                          
      25 -# Proveedor de LLM de los runs nuevos: mock (H3) o gemini (H4+)
         -.                                                              
      26 -# LLM_PROVIDER=mock                                            
      24 +# H3 · Motor de runs (D10, D23, D24). Opcionales: estos son los
         + valores por defecto (D26).                                    
      25  # Runs nuevos por día (UTC) y llamadas al LLM por run antes de 
          bloquearlo.
      28 -# RUNS_PER_DAY=10                                              
      29 -# LLM_CALLS_PER_RUN=30                                         
      26 +# RUNS_PER_DAY=5                                               
      27 +# LLM_CALLS_PER_RUN=12                                         
      28  
      31 -# --- Variables que llegan en hitos posteriores ---            
      32 -# H4+ · LLM (capa gratuita de Gemini)                          
      33 -# GEMINI_API_KEY=                                              
      29 +# H4 · LLM (D26). Proveedor por agente: mock o gemini (Develop 
         +y Testing, gemini desde H5/H6).                                
      30 +# LLM_PROVIDER=mock fuerza el mock en todos los agentes (plan B
         + si se agota la cuota).                                        
      31 +# LLM_PROVIDER=                                                
      32 +LLM_PROVIDER_ORCHESTRATOR=gemini                               
      33 +# LLM_PROVIDER_DEVELOP=mock                                    
      34 +# LLM_PROVIDER_TESTING=mock                                    
      35 +# Clave de un proyecto de Google sin facturación (capa gratuita
         +).                                                             
      36 +GEMINI_API_KEY=                                                
      37 +# Modelos por agente, en orden: al agotar la cuota diaria de un
         +o se pasa al siguiente.                                        
      38 +# GEMINI_MODELS_ORCHESTRATOR=gemini-3.8-flash,gemini-3.6-flash,
         +gemini-3.5-flash-lite                                          
  ⎿  Updated src/server/runs/limits.ts +4 -4
       1 -/** Limits of D10 and D23, overridable from the environment. */
       1 +/** Limits of D10, D23 and D26, overridable from the environmen
         +t. */                                                          
       2  function positiveInt(name: string, fallback: number): number {
       3    const value = Number(process.env[name]);
       4    return Number.isInteger(value) && value > 0 ? value : fallbac
          k;
       5  }
       6  
       7  /** New runs accepted per day (UTC). */
       8 -export const runsPerDay = () => positiveInt("RUNS_PER_DAY", 10)
         -;                                                              
       8 +export const runsPerDay = () => positiveInt("RUNS_PER_DAY", 5);
       9  
      10 -/** LLM calls one run may make before it is blocked (D8). */   
      11 -export const llmCallsPerRun = () => positiveInt("LLM_CALLS_PER_
         -RUN", 30);                                                     
      10 +/** LLM calls one run may make before it is blocked (D8, D26). 
         +*/                                                             
      11 +export const llmCallsPerRun = () => positiveInt("LLM_CALLS_PER_
         +RUN", 12);                                                     

  Ran 1 shell command (ctrl+o to expand)

⏺ Editing the schema.

⏺ Bash(python3 - <<'EOF'
      p='src/server/db/schema.ts'…)
  ⎿  206:    files: jsonb().$type<string[]>().notNull().default([]),
  ⎿  Updated src/server/db/schema.ts +25 -2
      13    unique,
      14    uniqueIndex,
      15  } from "drizzle-orm/pg-core";
      16 +import type { AgentName, Criterion } from "@/server/agents/cont
         +racts";                                                        
      17 +import type { CallMeta, ProviderName } from "@/server/llm/provi
         +der";                                                          
      18  
      19  /** Key/value metadata about the app itself. Used by the health
           check. */
      20  export const appMeta = pgTable("app_meta", {
     ...
      125    {
      126      id: serial().primaryKey(),
      127      request: text().notNull(),
      126 -    /** LLM provider name: mock | gemini */                   
      128 +    /** Summary of the providers, e.g. "gemini+mock" (see `pro
          +viders`). */                                                  
      129      provider: text().notNull(),
      130 +    /** Provider of each agent, fixed when the run is created 
          +(D26). */                                                     
      131 +    providers: jsonb().$type<Record<AgentName, ProviderName>>(
          +),                                                            
      132      /** MockProvider scenario (D24): ok | fail-once | blocked 
           | forbidden */
      133      scenario: text(),
      134      /** Mock only: the develop step crashes once right after m
           oving the ref. */
      135      simulateCrash: boolean("simulate_crash").notNull().default
           (false),
      136      crashedAt: timestamp("crashed_at", { withTimezone: true })
           ,
      137 +    /** The planning step crashes once right after storing the
          + plan (H4). */                                                
      138 +    simulatePlanCrash: boolean("simulate_plan_crash").notNull(
          +).default(false),                                             
      139 +    planCrashedAt: timestamp("plan_crashed_at", { withTimezone
          +: true }),                                                    
      140      /** See RunStatus in src/server/runs/machine.ts. */
      141      status: text().notNull().default("queued"),
      142      version: integer().notNull().default(0),
     ...
      150      planRevision: integer("plan_revision").notNull().default(1
           ),
      151      feedback: text(),
      152      planSummary: text("plan_summary"),
      153 +    planAssumptions: jsonb("plan_assumptions").$type<string[]>
          +(),                                                           
      154 +    /** Why the orchestrator found the request not feasible (D
          +28). */                                                       
      155 +    rejectedReason: text("rejected_reason"),                  
      156 +    /** master sha the orchestrator read; base of run/<id> (D2
          +7). */                                                        
      157 +    baseSha: text("base_sha"),                                
      158 +    /** crm-demo files the orchestrator read, shown in the UI 
          +(D27). */                                                     
      159 +    contextPaths: jsonb("context_paths").$type<string[]>(),   
      160      /** Branch head the panel last pushed; previews and report
           s must match it. */
      161      headSha: text("head_sha"),
      162      /** Commit chain built but not yet pointed to by the ref (
           D22). */
     … +24 lines (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/agents/contracts.ts'…)
  ⎿  $ drizzle-kit generate --name h4_orchestrator
     No config path provided, using default 'drizzle.config.ts'
     Reading config file '~/Trabajo/pruebas-tecnicas/paradig
     … +13 lines (ctrl+o to expand)
  ⎿  Created drizzle/0003_h4_orchestrator.sql +13
       1 +ALTER TABLE "agent_steps" ADD COLUMN "model" text;--> statement
         +-breakpoint                                                    
       2 +ALTER TABLE "agent_steps" ADD COLUMN "input_tokens" integer;-->
         + statement-breakpoint                                          
       3 +ALTER TABLE "agent_steps" ADD COLUMN "output_tokens" integer;--
         +> statement-breakpoint                                         
       4 +ALTER TABLE "agent_steps" ADD COLUMN "latency_ms" integer;--> s
         +tatement-breakpoint                                            
       5 +ALTER TABLE "agent_steps" ADD COLUMN "calls" jsonb;--> statemen
         +t-breakpoint                                                   
       6 +ALTER TABLE "runs" ADD COLUMN "providers" jsonb;--> statement-b
         +reakpoint                                                      
       7 +ALTER TABLE "runs" ADD COLUMN "simulate_plan_crash" boolean DEF
         +AULT false NOT NULL;--> statement-breakpoint                   
       8 +ALTER TABLE "runs" ADD COLUMN "plan_crashed_at" timestamp with 
         +time zone;--> statement-breakpoint                             
       9 +ALTER TABLE "runs" ADD COLUMN "plan_assumptions" jsonb;--> stat
         +ement-breakpoint                                               
      10 +ALTER TABLE "runs" ADD COLUMN "rejected_reason" text;--> statem
         +ent-breakpoint                                                 
      11 +ALTER TABLE "runs" ADD COLUMN "base_sha" text;--> statement-bre
         +akpoint                                                        
      12 +ALTER TABLE "runs" ADD COLUMN "context_paths" jsonb;--> stateme
         +nt-breakpoint                                                  
      13 +ALTER TABLE "tasks" ADD COLUMN "files" jsonb DEFAULT '[]'::json
         +b NOT NULL;                                                    
  ⎿  Updated drizzle/meta/_journal.json +7
      22        "when": 1795540353010,
      23        "tag": "0002_runs",
      24        "breakpoints": true
      25 +    },                                                         
      26 +    {                                                          
      27 +      "idx": 3,                                                
      28 +      "version": "7",                                          
      29 +      "when": 1795547864174,                                   
      30 +      "tag": "0003_h4_orchestrator",                           
      31 +      "breakpoints": true                                      
      32      }
      33    ]
      34  }
  ⎿  Updated src/server/agents/contracts.ts +8
      10  
      11  // --- Orchestrator ---
      12  
      13 +/** Acceptance criterion: checked in the DOM (e2e) or in the sc
         +reenshots (visual). */                                         
      14 +export const CRITERION_TYPES = ["e2e", "visual"] as const;     
      15 +export type Criterion = {                                      
      16 +  id: string;                                                  
      17 +  type: (typeof CRITERION_TYPES)[number];                      
      18 +  text: string;                                                
      19 +};                                                             
      20 +                                                               
      21  export const planSchema = z.object({
      22    summary: z.string().min(1).max(2000),
      23    tasks: z
  ⎿  Updated src/server/llm/provider.ts +15
      14    schema: z.ZodType<T>;
      15  };
      16  
      17 +export const PROVIDER_NAMES = ["mock", "gemini"] as const;     
      18 +export type ProviderName = (typeof PROVIDER_NAMES)[number];    
      19 +                                                               
      20 +/** One request to a model, as stored in agent_steps (D26). */ 
      21 +export type CallMeta = {                                       
      22 +  model: string;                                               
      23 +  /** first answer or the single repair call after a Zod error 
         +*/                                                             
      24 +  kind: "first" | "repair";                                    
      25 +  inputTokens: number;                                         
      26 +  outputTokens: number;                                        
      27 +  latencyMs: number;                                           
      28 +  /** The answer passed the schema. */                         
      29 +  valid: boolean;                                              
      30 +};                                                             
      31 +                                                               
      32  export interface LLMProvider {
      33    readonly name: string;
      34    generateObject<T>(request: GenerateRequest<T>): Promise<T>;
  ⎿  … +1 file changed
     drizzle/meta/0003_snapshot.json

  Read 1 file (ctrl+o to expand)

⏺ Bash(cat >> drizzle/0003_h4_orchestrator.sql <<'EOF'
      --> statement-breakpoint…)
  ⎿  ok
  ⎿  Updated drizzle/0003_h4_orchestrator.sql +9 -1
      10  ALTER TABLE "runs" ADD COLUMN "rejected_reason" text;--> statem
          ent-breakpoint
      11  ALTER TABLE "runs" ADD COLUMN "base_sha" text;--> statement-bre
          akpoint
      12  ALTER TABLE "runs" ADD COLUMN "context_paths" jsonb;--> stateme
          nt-breakpoint
      13 -ALTER TABLE "tasks" ADD COLUMN "files" jsonb DEFAULT '[]'::json
         -b NOT NULL;                                                    
      13 +ALTER TABLE "tasks" ADD COLUMN "files" jsonb DEFAULT '[]'::json
         +b NOT NULL;--> statement-breakpoint                            
      14 +-- H3 criteria were plain strings: turn them into { id, type, t
         +ext } (D28).                                                   
      15 +UPDATE "tasks" SET "acceptance_criteria" = (                   
      16 +  SELECT coalesce(jsonb_agg(                                   
      17 +    jsonb_build_object('id', 'c' || c.ord, 'type', 'e2e', 'text
         +', c.value #>> '{}')                                           
      18 +    ORDER BY c.ord), '[]'::jsonb)                              
      19 +  FROM jsonb_array_elements("acceptance_criteria") WITH ORDINAL
         +ITY AS c(value, ord)                                           
      20 +) WHERE jsonb_typeof("acceptance_criteria" -> 0) = 'string';-->
         + statement-breakpoint                                          
      21 +UPDATE "runs" SET "providers" = jsonb_build_object('orchestrato
         +r', "provider", 'develop', "provider", 'testing', "provider") W
         +HERE "providers" IS NULL;                                      

⏺ Now the plan contract (D28).

  Searched for 1 pattern (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/agents/contracts.ts'…)
  ⎿  done
  ⎿  Updated src/server/agents/contracts.ts +161 -18
      1  import { z } from "zod";
      2 +import { checkPaths, PAGES_FILE } from "./paths";               
      3  
      4  /**
      5   * Agent contracts (D8, D24). Every LLM output is validated agai
         nst these
     ...
       13  
       14  /** Acceptance criterion: checked in the DOM (e2e) or in the s
           creenshots (visual). */
       15  export const CRITERION_TYPES = ["e2e", "visual"] as const;
       15 -export type Criterion = {                                     
       16 -  id: string;                                                 
       17 -  type: (typeof CRITERION_TYPES)[number];                     
       18 -  text: string;                                               
       19 -};                                                            
       16  
       21 -export const planSchema = z.object({                          
       22 -  summary: z.string().min(1).max(2000),                       
       23 -  tasks: z                                                    
       24 -    .array(                                                   
       25 -      z.object({                                              
       26 -        title: z.string().min(1).max(120),                    
       27 -        description: z.string().min(1).max(2000),             
       28 -        acceptanceCriteria: z.array(z.string().min(1).max(300)
          -).min(1).max(8),                                              
       29 -      }),                                                     
       30 -    )                                                         
       17 +export const criterionSchema = z.object({                     
       18 +  id: z                                                       
       19 +    .string()                                                 
       20 +    .regex(/^c[0-9]{1,2}$/, "El id de un criterio es c1, c2, c
          +3…")                                                          
       21 +    .describe("Identificador único en todo el plan: c1, c2, c3
          +…"),                                                          
       22 +  type: z                                                     
       23 +    .enum(CRITERION_TYPES)                                    
       24 +    .describe(                                                
       25 +      "e2e: se comprueba en el DOM con data-testid. visual: se
          + comprueba en las capturas a 1280 y 390 px.",                 
       26 +    ),                                                        
       27 +  text: z                                                     
       28 +    .string()                                                 
       29 +    .min(1)                                                   
       30 +    .max(300)                                                 
       31 +    .describe("Criterio comprobable, en español."),           
       32 +});                                                           
     … +172 lines (ctrl+o to expand)
  ⎿  Updated src/server/agents/paths.ts +5 -2
       2   * Paths Develop may never write (D16, D24): the workflows and 
          the e2e helpers
       3   * run with crm-demo's secrets. Listed in crm-demo's AGENTS.md.
       4   */
       5 -const FORBIDDEN_PREFIXES = [".github/"];                       
       6 -const FORBIDDEN_FILES = ["e2e/helpers.ts", "e2e/screenshots.spe
         -c.ts"];                                                        
       5 +export const FORBIDDEN_PREFIXES = [".github/"];                
       6 +export const FORBIDDEN_FILES = ["e2e/helpers.ts", "e2e/screensh
         +ots.spec.ts"];                                                 
       7 +                                                               
       8 +/** List of captured pages: a task that creates a page adds it 
         +here (D28). */                                                 
       9 +export const PAGES_FILE = "e2e/pages.ts";                      
      10  
      11  export type PathCheck =
      12    { ok: true } | { ok: false; path: string; reason: string };

⏺ Bash(grep -n "isNewPage = " -A1 src/server/agents/contracts.ts && python3 -
      <<'EOF'
      p='src/server/llm/mock.ts'…)
  ⎿  82:export const isNewPage = (path: string, tree: ReadonlySet<string>)
     =>
     83-  /^src\/app\/.*page\.tsx$/.test(path) && !tree.has(path);
     102:    const base = { id: c.id, criterion: c.text };
  ⎿  Updated src/server/llm/mock.ts +23 -8
      29    const feedback = input.feedback
      30      ? ` Tiene en cuenta el feedback: «${input.feedback}».`
      31      : "";
      32 +  // An amend replan (D29) only adds one corrective task.      
      33 +  const amend = input.mode === "amend";                        
      34 +  const positions = amend ? [1] : [1, 2];                      
      35    return {
      36 +    feasible: true,                                            
      37      summary: `Plan simulado${revision} para: ${input.request}.$
          {feedback}`,
      34 -    tasks: [1, 2].map((n) => ({                                
      35 -      title: `Tarea simulada ${n}`,                            
      38 +    assumptions: ["MockProvider no cambia la app: solo escribe 
         +agent-runs/."],                                                
      39 +    tasks: positions.map((n) => ({                             
      40 +      title: amend ? `Tarea correctiva ${n}` : `Tarea simulada 
         +${n}`,                                                         
      41        description: `Escribe agent-runs/${input.runId}/task-${n}
          .md. No cambia la app.`,
      42 +      files: [`agent-runs/${input.runId}/task-${n}.md`],       
      43        acceptanceCriteria: [
      38 -        `Existe agent-runs/${input.runId}/task-${n}.md`,       
      39 -        "Los tests E2E de la vista previa pasan",              
      44 +        {                                                      
      45 +          id: `c${2 * n - 1}`,                                 
      46 +          type: "e2e" as const,                                
      47 +          text: `Existe agent-runs/${input.runId}/task-${n}.md`
         +,                                                              
      48 +        },                                                     
      49 +        {                                                      
      50 +          id: `c${2 * n}`,                                     
      51 +          type: "e2e" as const,                                
      52 +          text: "Los tests E2E de la vista previa pasan",      
      53 +        },                                                     
      54        ],
      55      })),
      56    };
     ...
       98        scenario === "blocked");
       99    const e2eFailed = input.report.status !== "passed";
      100  
       87 -  const criteria = input.task.acceptanceCriteria.map((criterio
          -n, i) => {                                                    
      101 +  const criteria = input.task.acceptanceCriteria.map((c, i) =>
          + {                                                            
      102 +    const base = { id: c.id, criterion: c.text };             
      103      if (e2eFailed && i === input.task.acceptanceCriteria.lengt
           h - 1) {
      104        return {
     … +19 lines (ctrl+o to expand)

⏺ Write(src/server/agents/contracts.test.ts)
  ⎿  Wrote 106 lines to src/server/agents/contracts.test.ts
       1 import { describe, expect, it } from "vitest";
       2 import { planSchema, planSchemaFor, type Plan, type PlanTask } f
         rom "./contracts";
       3 
       4 const task = (over: Partial<PlanTask> = {}): PlanTask => ({
       5   title: "Añadir el NIF",
       6   description: "Añade la columna nif a clients",
       7   files: ["src/db/schema.ts"],
       8   acceptanceCriteria: [{ id: "c1", type: "e2e", text: "Se ve el 
         NIF" }],
     … +98 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/llm/mock.test.ts'…)
  ⎿  $ next typegen && tsc --noEmit
     Generating route types...
     ✓ Types generated successfully
     … +10 lines (ctrl+o to expand)
  ⎿  Updated src/server/llm/mock.test.ts +29 -15
       1  import { describe, expect, it } from "vitest";
       2  import { runDevelop, runOrchestrator, runTesting } from "@/serv
          er/agents";
       3 -import type { E2eSummary, TaskBrief } from "@/server/agents/con
         -tracts";                                                       
       3 +import type {                                                  
       4 +  E2eSummary,                                                  
       5 +  PlanInput,                                                   
       6 +  TaskBrief,                                                   
       7 +} from "@/server/agents/contracts";                            
       8  import { checkPaths } from "@/server/agents/paths";
       9  import { MockProvider, type MockScenario } from "./mock";
      10  
     ...
      21    failures: [],
      22  };
      23  
      24 +const planInput = (over: Partial<PlanInput> = {}): PlanInput =>
         + ({                                                            
      25 +  runId: 7,                                                    
      26 +  request: "Añadir el NIF",                                    
      27 +  planRevision: 1,                                             
      28 +  mode: "replace",                                             
      29 +  feedback: null,                                              
      30 +  previous: null,                                              
      31 +  context: { baseSha: "abc", tree: [], files: [] },            
      32 +  ...over,                                                     
      33 +});                                                            
      34 +                                                               
      35  async function brief(n: number): Promise<TaskBrief> {
      21 -  const plan = await runOrchestrator(new MockProvider("ok"), { 
      22 -    runId: 7,                                                  
      23 -    request: "Añadir el NIF",                                  
      24 -    planRevision: 1,                                           
      25 -    feedback: null,                                            
      26 -    previousSummary: null,                                     
      27 -  });                                                          
      36 +  const plan = await runOrchestrator(new MockProvider("ok"), pl
         +anInput());                                                    
      37    const t = plan.tasks[n - 1]!;
      38    return { position: n, ...t };
      39  }
     ...
      54  
      55  describe("MockProvider", () => {
      56    it("plans two tasks and carries the feedback", async () => {
     … +27 lines (ctrl+o to expand)
  ⎿  Updated src/server/runs/engine.ts +1
      89    position: t.position,
      90    title: t.title,
      91    description: t.description,
      92 +  files: t.files,                                              
      93    acceptanceCriteria: t.acceptanceCriteria,
      94  });
      95  
⏺ Bash(python3 - <<'EOF'
      p='src/server/runs/engine.ts'…)
  ⎿  $ next typegen && tsc --noEmit
     Generating route types...
     ✓ Types generated successfully
     … +17 lines (ctrl+o to expand)
  ⎿  Updated src/app/runs/[id]/page.tsx +4 -2
      135              </p>
      136              <p className="muted">{t.description}</p>
      137              <ul>
      138 -              {t.acceptanceCriteria.map((c, i) => (           
      139 -                <li key={i}>{c}</li>                          
      138 +              {t.acceptanceCriteria.map((c) => (              
      139 +                <li key={c.id}>                               
      140 +                  <code>{c.type}</code> {c.text}              
      141 +                </li>                                         
      142                ))}
      143              </ul>
      144              {t.lastFeedback && <p className="error">{t.lastFee
           dback}</p>}
  ⎿  Updated src/server/runs/engine.ts +4 -1
      149          runId: run.id,
      150          request: run.request,
      151          planRevision: run.planRevision,
      152 +        mode: "replace",                                      
      153          feedback: run.feedback,
      153 -        previousSummary: run.planSummary,                     
      154 +        previous: null,                                       
      155 +        // Read from crm-demo once the engine wires the contex
          +t in (D27).                                                   
      156 +        context: { baseSha: "", tree: [], files: [] },        
      157        }),
      158    );
      159    await db

⏺ Contrato del plan en verde (161 tests). Hago commit y sigo con la transición
  planning → rejected.

⏺ Bash(pnpm format >/dev/null && pnpm lint 2>&1 | tail -5 && git add -A && git
      commit -qm "feat(agents): extend plan contract with feasibility and typed
      criteria…)
  ⎿  $ prettier --write .
     $ eslint
     2388864 feat(agents): extend plan contract with feasibility and typed
     criteria
  ⎿  Updated src/server/agents/contracts.test.ts +14 -8
       1  import { describe, expect, it } from "vitest";
       2 -import { planSchema, planSchemaFor, type Plan, type PlanTask } 
         -from "./contracts";                                            
       2 +import {                                                       
       3 +  planSchema,                                                  
       4 +  planSchemaFor,                                               
       5 +  type Plan,                                                   
       6 +  type PlanTask,                                               
       7 +} from "./contracts";                                          
       8  
       9  const task = (over: Partial<PlanTask> = {}): PlanTask => ({
      10    title: "Añadir el NIF",
     ...
      45  
      46    it("rejects a feasible plan without tasks or with more than 4
          ", () => {
      47      expect(messages(plan({ tasks: [] }))).toHaveLength(1);
      43 -    expect(planSchema.safeParse(plan({ tasks: Array(5).fill(tas
         -k()) })).success)                                              
      44 -      .toBe(false);                                            
      48 +    expect(                                                    
      49 +      planSchema.safeParse(plan({ tasks: Array(5).fill(task()) 
         +})).success,                                                   
      50 +    ).toBe(false);                                             
      51    });
      52  
      53    it("a not feasible plan needs a reason and no tasks", () => {
     ...
       90      const tree = ["src/app/(crm)/clientes/page.tsx", "e2e/page
           s.ts"];
       91      const schema = planSchemaFor(tree);
       92      const page = "src/app/(crm)/contacto/page.tsx";
       87 -    expect(messages(plan({ tasks: [task({ files: [page] })] })
          -, schema)).toEqual(                                           
       88 -      [                                                       
       89 -        `El plan crea ${page}: una tarea debe incluir e2e/page
          -s.ts para que salga en las capturas`,                         
       90 -      ],                                                      
       91 -    );                                                        
       93 +    expect(                                                   
       94 +      messages(plan({ tasks: [task({ files: [page] })] }), sch
          +ema),                                                         
       95 +    ).toEqual([                                               
       96 +      `El plan crea ${page}: una tarea debe incluir e2e/pages.
          +ts para que salga en las capturas`,                           
       97 +    ]);                                                       
       98      expect(
       99        messages(
      100          plan({ tasks: [task({ files: [page, "e2e/pages.ts"] })
           ] }),

  Called ccd_turn, ran 1 shell command (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/runs/machine.ts'…)
  ⎿        Tests  44 passed (44)
        Start at  20:20:09
        Duration  87ms (transform 60%, import 20%, tests 14%, worker 6%)
  ⎿  Updated src/server/runs/machine.test.ts +22
      102      effects: ["start_next"],
      103    },
      104  
      105 +  // Request out of scope (D28)                               
      106 +  {                                                           
      107 +    name: "infeasible plan rejects without a branch",         
      108 +    from: run("planning"),                                    
      109 +    event: { type: "plan_infeasible", reason: "Toca .github/" 
          +},                                                            
      110 +    to: "rejected",                                           
      111 +    effects: ["start_next"],                                  
      112 +  },                                                          
      113 +  {                                                           
      114 +    name: "infeasible replan after a preview cleans the branch
          +",                                                            
      115 +    from: run("planning", { hasBranch: true }),               
      116 +    event: { type: "plan_infeasible", reason: "Fuera del CRM" 
          +},                                                            
      117 +    to: "rejected",                                           
      118 +    effects: ["cleanup", "start_next"],                       
      119 +  },                                                          
      120 +  {                                                           
      121 +    name: "infeasible only applies while planning",           
      122 +    from: run("awaiting_plan_approval"),                      
      123 +    event: { type: "plan_infeasible", reason: "x" },          
      124 +    to: null,                                                 
      125 +  },                                                          
      126 +                                                              
      127    // Feedback and rejection (D9)
      128    {
      129      name: "plan feedback replans",
  ⎿  Updated src/server/runs/machine.ts +6
      65  export type RunEvent =
      66    | { type: "start" }
      67    | { type: "plan_ready" }
      68 +  /** The orchestrator found the request out of scope (D28). */
      69 +  | { type: "plan_infeasible"; reason: string }                
      70    | { type: "approve_plan" }
      71    | { type: "reject"; feedback: string | null }
      72    | { type: "develop_done" }
     ...
      217      case "plan_ready":
      218        return s === "planning" ? result(run, "awaiting_plan_app
           roval") : null;
      219  
      220 +    case "plan_infeasible":                                   
      221 +      // No branch yet on a first plan; after a preview the cl
          +eanup closes the PR.                                          
      222 +      return s === "planning" ? result(run, "rejected") : null
          +;                                                             
      223 +                                                              
      224      case "approve_plan":
      225        if (s !== "awaiting_plan_approval") return null;
      226        if (run.tasks.length === 0) return null;

  Ran 1 shell command (ctrl+o to expand)

⏺ Now the provider interface with call metadata and per-agent selection.

  Searched for 2 patterns (ctrl+o to expand)

⏺ Write(src/server/llm/provider.ts)
  ⎿  Added 56 lines, removed 12 lines
       5   * Swappable LLM layer (D8). Implementations: MockProvider (H3)
           and
       6   * GeminiProvider (H4+). Every agent output is validated agains
          t a Zod schema.
       7   */
       8 -export type GenerateRequest<T> = {                             
       9 -  agent: AgentName;                                            
      10 -  system: string;                                              
      11 -  prompt: string;                                              
      12 -  /** Structured input behind the prompt. Only the mock reads i
         -t. */                                                          
      13 -  input: unknown;                                              
      14 -  schema: z.ZodType<T>;                                        
      15 -};                                                             
       8  
       9  export const PROVIDER_NAMES = ["mock", "gemini"] as const;
      10  export type ProviderName = (typeof PROVIDER_NAMES)[number];
      11  
      20 -/** One request to a model, as stored in agent_steps (D26). */ 
      12 +export const isProviderName = (value: unknown): value is Provid
         +erName =>                                                      
      13 +  PROVIDER_NAMES.includes(value as ProviderName);              
      14 +                                                               
      15 +/** One request answered by a model, as stored in agent_steps (
         +D26). */                                                       
      16  export type CallMeta = {
      17    model: string;
      23 -  /** first answer or the single repair call after a Zod error 
         -*/                                                             
      18 +  /** first answer, or the single repair call after a Zod error
         + */                                                            
      19    kind: "first" | "repair";
      20    inputTokens: number;
      21    outputTokens: number;
     ...
      24    valid: boolean;
      25  };
      26  
      27 +/** Called around every request, so the engine can count and ho
         +ld the run. */                                                 
      28 +export type CallHooks = {                                      
      29 +  /** Before each request: renews the lease, or throws when ove
         +r budget. */                                                   
      30 +  beforeCall?: () => Promise<void>;                            
      31 +  /** After each answered request (it counts in LLM_CALLS_PER_R
         +UN). */                                                        
      32 +  onCall?: (call: CallMeta) => Promise<void>;                  
      33 +};                                                             
      34 +                                                               
      35 +export type GenerateRequest<T> = {                             
      36 +  agent: AgentName;                                            
      37 +  system: string;                                              
      38 +  prompt: string;                                              
      39 +  /** Structured input behind the prompt. Only the mock reads i
         +t. */                                                          
      40 +  input: unknown;                                              
      41 +  schema: z.ZodType<T>;                                        
      42 +  hooks?: CallHooks;                                           
      43 +};                                                             
      44 +                                                               
      45 +export type Generated<T> = { output: T; calls: CallMeta[] };   
      46 +                                                               
      47  export interface LLMProvider {
      33 -  readonly name: string;                                       
      34 -  generateObject<T>(request: GenerateRequest<T>): Promise<T>;  
      48 +  readonly name: ProviderName;                                 
      49 +  generateObject<T>(request: GenerateRequest<T>): Promise<Gener
         +ated<T>>;                                                      
      50  }
      51 +                                                               
      52 +/** Per-minute limit: the step is postponed, not failed (D26). 
         +*/                                                             
      53 +export class RateLimited extends Error {                       
      54 +  constructor(                                                 
      55 +    readonly model: string,                                    
      56 +    readonly retryAfterMs: number,                             
      57 +  ) {                                                          
      58 +    super(                                                     
      59 +      `${model}: límite por minuto, se reintenta en ${Math.ceil
         +(retryAfterMs / 1000)} s`,                                     
      60 +    );                                                         
      61 +  }                                                            
      62 +}                                                              
      63 +                                                               
      64 +/** Every model of the agent's list is out of its daily quota (
         +D26). */                                                       
      65 +export class QuotaExhausted extends Error {                    
      66 +  constructor(readonly models: string[]) {                     
      67 +    super("Cuota de Gemini agotada; se renueva a las 9:00");   
      68 +  }                                                            
      69 +}                                                              
      70 +                                                               
      71 +/** The answer did not pass the schema, even after the repair c
         +all. */                                                        
      72 +export class InvalidOutput extends Error {                     
      73 +  constructor(                                                 
      74 +    message: string,                                           
      75 +    readonly calls: CallMeta[],                                
      76 +  ) {                                                          
      77 +    super(message);                                            
      78 +  }                                                            
      79 +}                                                              

  Ran 1 shell command (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/llm/mock.ts'…)
  ⎿  23:  hooks?: CallHooks,
     31:    hooks,
     39:  hooks?: CallHooks,
     … +3 lines (ctrl+o to expand)
  ⎿  Updated src/server/agents/index.ts +14 -4
      1 -import type { LLMProvider } from "@/server/llm/provider";       
      1 +import type {                                                   
      2 +  CallHooks,                                                    
      3 +  Generated,                                                    
      4 +  LLMProvider,                                                  
      5 +} from "@/server/llm/provider";                                 
      6  import {
      7    developOutputSchema,
      8    planSchema,
     ...
      20  export function runOrchestrator(
      21    llm: LLMProvider,
      22    input: PlanInput,
      19 -): Promise<Plan> {                                             
      23 +  hooks?: CallHooks,                                           
      24 +): Promise<Generated<Plan>> {                                  
      25    return llm.generateObject({
      26      agent: "orchestrator",
      27      system:
      28        "Eres el orquestador. Divide la petición en tareas con cr
          iterios de aceptación.",
      29      prompt: JSON.stringify(input),
      30      input,
      31 +    hooks,                                                     
      32      schema: planSchema,
      33    });
      34  }
     ...
      36  export function runDevelop(
      37    llm: LLMProvider,
      38    input: DevelopInput,
      33 -): Promise<DevelopOutput> {                                    
      39 +  hooks?: CallHooks,                                           
      40 +): Promise<Generated<DevelopOutput>> {                         
      41    return llm.generateObject({
      42      agent: "develop",
      43      system:
      44        "Eres Develop. Devuelve los archivos completos de la tare
          a y el mensaje de commit.",
      45      prompt: JSON.stringify(input),
      46      input,
      47 +    hooks,                                                     
      48      schema: developOutputSchema,
      49    });
     … +17 lines (ctrl+o to expand)
  ⎿  Updated src/server/llm/mock.ts +21 -4
       6    TestingInput,
       7    TestingVerdict,
       8  } from "@/server/agents/contracts";
       9 -import type { GenerateRequest, LLMProvider } from "./provider";
       9 +import type {                                                  
      10 +  CallMeta,                                                    
      11 +  GenerateRequest,                                             
      12 +  Generated,                                                   
      13 +  LLMProvider,                                                 
      14 +} from "./provider";                                           
      15  
      16  /** Scenarios of the simulated agents (D24). */
      17  export const MOCK_SCENARIOS = [
     ...
      139    readonly name = "mock";
      140    constructor(private readonly scenario: MockScenario) {}
      141  
      137 -  async generateObject<T>(request: GenerateRequest<T>): Promis
          -e<T> {                                                        
      138 -    const output = (() => {                                   
      142 +  async generateObject<T>(request: GenerateRequest<T>): Promis
          +e<Generated<T>> {                                             
      143 +    await request.hooks?.beforeCall?.();                      
      144 +    const started = Date.now();                               
      145 +    const raw = (() => {                                      
      146        switch (request.agent) {
      147          case "orchestrator":
      148            return mockPlan(request.input as PlanInput);
     ...
      153        }
      154      })();
      155      // Same validation path as a real provider.
      149 -    return request.schema.parse(output);                      
      156 +    const output = request.schema.parse(raw);                 
      157 +    const call: CallMeta = {                                  
      158 +      model: "mock",                                          
      159 +      kind: "first",                                          
      160 +      inputTokens: 0,                                         
      161 +      outputTokens: 0,                                        
      162 +      latencyMs: Date.now() - started,                        
      163 +      valid: true,                                            
      164 +    };                                                        
      165 +    await request.hooks?.onCall?.(call);                      
      166 +    return { output, calls: [call] };                         
     … +2 lines (ctrl+o to expand)

⏺ Write(src/server/llm/index.ts)
  ⎿  Added 58 lines, removed 8 lines
       1 +import { AGENTS, type AgentName } from "@/server/agents/contrac
         +ts";                                                           
       2  import { MockProvider, isMockScenario } from "./mock";
       2 -import type { LLMProvider } from "./provider";                 
       3 +import { isProviderName, type LLMProvider, type ProviderName } 
         +from "./provider";                                             
       4  
       4 -/** Provider for new runs. Only the mock exists until H4. */   
       5 -export function defaultProviderName(): string {                
       6 -  return process.env.LLM_PROVIDER || "mock";                   
       5 +export type AgentProviders = Record<AgentName, ProviderName>;  
       6 +                                                               
       7 +const envName = (agent: AgentName) => `LLM_PROVIDER_${agent.toU
         +pperCase()}`;                                                  
       8 +                                                               
       9 +/**                                                            
      10 + * Provider of each agent for new runs (D26): LLM_PROVIDER_<AGE
         +NT>, mock by                                                   
      11 + * default. LLM_PROVIDER=mock forces the mock on every agent (p
         +lan B, D8).                                                    
      12 + */                                                            
      13 +export function providersForNewRun(): AgentProviders {         
      14 +  const forceMock = process.env.LLM_PROVIDER === "mock";       
      15 +  return Object.fromEntries(                                   
      16 +    AGENTS.map((agent) => {                                    
      17 +      const value = process.env[envName(agent)];               
      18 +      return [agent, !forceMock && isProviderName(value) ? valu
         +e : "mock"];                                                   
      19 +    }),                                                        
      20 +  ) as AgentProviders;                                         
      21  }
      22  
       9 -export function getProvider(                                   
      10 -  name: string,                                                
      23 +/** Short label stored in runs.provider, e.g. "gemini+mock". */
      24 +export const providerSummary = (p: AgentProviders) =>          
      25 +  [...new Set(AGENTS.map((a) => p[a]))].join("+");             
      26 +                                                               
      27 +/** The mock scenario only matters when Develop or Testing is t
         +he mock (D26). */                                              
      28 +export const usesMockScenario = (p: AgentProviders) =>         
      29 +  p.develop === "mock" || p.testing === "mock";                
      30 +                                                               
      31 +/** Runs created before H4 stored a single provider name. */   
      32 +export function runProviders(run: {                            
      33 +  provider: string;                                            
      34 +  providers: AgentProviders | null;                            
      35 +}): AgentProviders {                                           
      36 +  if (run.providers) return run.providers;                     
      37 +  const name = isProviderName(run.provider) ? run.provider : "m
         +ock";                                                          
      38 +  return { orchestrator: name, develop: name, testing: name }; 
      39 +}                                                              
      40 +                                                               
      41 +/** Comma-separated model list of an agent, in fallback order (
         +D26). */                                                       
      42 +export function modelsFor(agent: AgentName): string[] {        
      43 +  const defaults: Record<AgentName, string> = {                
      44 +    orchestrator: "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5
         +-flash-lite",                                                  
      45 +    develop: "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flas
         +h-lite",                                                       
      46 +    testing: "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flas
         +h-lite",                                                       
      47 +  };                                                           
      48 +  const value =                                                
      49 +    process.env[`GEMINI_MODELS_${agent.toUpperCase()}`] || defa
         +ults[agent];                                                   
      50 +  return value                                                 
      51 +    .split(",")                                                
      52 +    .map((m) => m.trim())                                      
      53 +    .filter(Boolean);                                          
      54 +}                                                              
      55 +                                                               
      56 +export async function getProvider(                             
      57 +  name: ProviderName,                                          
      58 +  agent: AgentName,                                            
      59    scenario: string | null,
      12 -): LLMProvider {                                               
      60 +): Promise<LLMProvider> {                                      
      61    if (name === "mock") {
      62      return new MockProvider(isMockScenario(scenario) ? scenario
           : "ok");
      63    }
      16 -  throw new Error(`Unknown LLM provider: ${name}`);            
      64 +  // Loaded on demand: the SDK is only needed on the Gemini pat
         +h.                                                             
      65 +  const { createGeminiProvider } = await import("./gemini");   
      66 +  return createGeminiProvider(agent);                          
      67  }

⏺ Writing the Gemini provider.

  Ran 2 shell commands (ctrl+o to expand)

⏺ Write(src/server/llm/gemini.ts)
  ⎿  Wrote 341 lines to src/server/llm/gemini.ts
       1 import {
       2   GoogleGenAI,
       3   ThinkingLevel,
       4   type Content,
       5   type GenerateContentParameters,
       6 } from "@google/genai";
       7 import { z } from "zod";
       8 import type { AgentName } from "@/server/agents/contracts";
       9 import {
      10   InvalidOutput,
     … +331 lines (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/llm/gemini.ts'…)
  ⎿  /** Key/value metadata about the app itself. Used by the health check.
      */
     export const appMeta = pgTable("app_meta", {
     … +11 lines (ctrl+o to expand)
  ⎿  Updated src/server/llm/gemini.ts +3 -7
       5    type GenerateContentParameters,
       6  } from "@google/genai";
       7  import { z } from "zod";
       8 -import type { AgentName } from "@/server/agents/contracts";    
       8  import {
       9    InvalidOutput,
      10    QuotaExhausted,
     ...
      323  
      324  /** Provider of the app: SDK client, the agent's model list an
           d app_meta. */
      325  export async function createGeminiProvider(
      327 -  agent: AgentName,                                           
      326 +  models: string[],                                           
      327  ): Promise<GeminiProvider> {
      328    const apiKey = process.env.GEMINI_API_KEY;
      329    if (!apiKey) throw new Error("Falta GEMINI_API_KEY");
      331 -  const [{ modelsFor }, { appMetaQuota }] = await Promise.all(
          -[                                                             
      332 -    import("./index"),                                        
      333 -    import("./quota"),                                        
      334 -  ]);                                                         
      330 +  const { appMetaQuota } = await import("./quota");           
      331    const client = new GoogleGenAI({ apiKey });
      332    return new GeminiProvider({
      333      generate: (params) => client.models.generateContent(params
           ),
      338 -    models: modelsFor(agent),                                 
      334 +    models,                                                   
      335      quota: appMetaQuota(),
      336    });
      337  }
  ⎿  Updated src/server/llm/index.ts +1 -1
      63    }
      64    // Loaded on demand: the SDK is only needed on the Gemini pat
          h.
      65    const { createGeminiProvider } = await import("./gemini");
      66 -  return createGeminiProvider(agent);                          
      66 +  return createGeminiProvider(modelsFor(agent));               
      67  }
  ⎿  Created src/server/llm/quota.ts +38
       1 +import { eq } from "drizzle-orm";                              
       2 +import { getDb } from "@/server/db/client";                    
       3 +import { appMeta } from "@/server/db/schema";                  
       4 +import type { QuotaMemory } from "./gemini";                   
       5 +                                                               
       6 +/**                                                            
       7 + * Gemini's daily quotas reset at midnight Pacific time, 9:00 i
         +n Madrid                                                       
       8 + * (D26). A model marked today is skipped until then.          
       9 + */                                                            
      10 +export const quotaDay = (now = new Date()) =>                  
      11 +  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Ang
         +eles" }).format(                                               
      12 +    now,                                                       
      13 +  );                                                           
      14 +                                                               
      15 +const key = (model: string) => `gemini_quota_exhausted:${model}
         +`;                                                             
      16 +                                                               
      17 +/** Exhausted models in app_meta, so later calls today do not s
         +pend a request. */                                             
      18 +export function appMetaQuota(): QuotaMemory {                  
      19 +  const db = getDb();                                          
      20 +  return {                                                     
      21 +    async isExhausted(model) {                                 
      22 +      const [row] = await db                                   
      23 +        .select({ value: appMeta.value })                      
      24 +        .from(appMeta)                                         
      25 +        .where(eq(appMeta.key, key(model)));                   
      26 +      return row?.value === quotaDay();                        
      27 +    },                                                         
      28 +    async markExhausted(model) {                               
      29 +      await db                                                 
      30 +        .insert(appMeta)                                       
      31 +        .values({ key: key(model), value: quotaDay() })        
      32 +        .onConflictDoUpdate({                                  
      33 +          target: appMeta.key,                                 
      34 +          set: { value: quotaDay(), updatedAt: new Date() },   
      35 +        });                                                    
      36 +    },                                                         
      37 +  };                                                           
      38 +}                                                              

⏺ Now the fixtures and the provider tests.

⏺ Bash(mkdir -p ~/Trabajo/pruebas-tecnicas/paradigma/crm-agents/s
      rc/server/llm/fixtures/gemini && cd $_ && python3 - <<'EOF'
      import json…)
  ⎿  error-429-daily.json
     error-429-minute.json
     plan-infeasible.json
     … +3 lines (ctrl+o to expand)
  ⎿  Created src/server/llm/fixtures/gemini/error-429-daily.json +36
       1 +{                                                              
       2 +  "error": {                                                   
       3 +    "code": 429,                                               
       4 +    "message": "You exceeded your current quota, please check y
         +our plan and billing details. Please retry in 37.5s.",         
       5 +    "status": "RESOURCE_EXHAUSTED",                            
       6 +    "details": [                                               
       7 +      {                                                        
       8 +        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
       9 +        "violations": [                                        
      10 +          {                                                    
      11 +            "quotaMetric": "generativelanguage.googleapis.com/g
         +enerate_content_free_tier_requests",                           
      12 +            "quotaId": "GenerateRequestsPerDayPerProjectPerMode
         +l-FreeTier",                                                   
      13 +            "quotaDimensions": {                               
      14 +              "location": "global",                            
      15 +              "model": "gemini-3.8-flash"                      
      16 +            },                                                 
      17 +            "quotaValue": "20"                                 
      18 +          }                                                    
      19 +        ]                                                      
      20 +      },                                                       
      21 +      {                                                        
      22 +        "@type": "type.googleapis.com/google.rpc.Help",        
      23 +        "links": [                                             
      24 +          {                                                    
      25 +            "description": "Learn more about Gemini API quotas"
         +,                                                              
      26 +            "url": "https://ai.google.dev/gemini-api/docs/rate-
         +limits"                                                        
      27 +          }                                                    
      28 +        ]                                                      
      29 +      },                                                       
      30 +      {                                                        
      31 +        "@type": "type.googleapis.com/google.rpc.RetryInfo",   
      32 +        "retryDelay": "21s"                                    
      33 +      }                                                        
      34 +    ]                                                          
      35 +  }                                                            
      36 +}                                                              
  ⎿  Created src/server/llm/fixtures/gemini/error-429-minute.json +36
       1 +{                                                              
       2 +  "error": {                                                   
       3 +    "code": 429,                                               
       4 +    "message": "You exceeded your current quota, please check y
         +our plan and billing details. Please retry in 37.5s.",         
       5 +    "status": "RESOURCE_EXHAUSTED",                            
       6 +    "details": [                                               
       7 +      {                                                        
       8 +        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
       9 +        "violations": [                                        
      10 +          {                                                    
      11 +            "quotaMetric": "generativelanguage.googleapis.com/g
         +enerate_content_free_tier_requests",                           
      12 +            "quotaId": "GenerateRequestsPerMinutePerProjectPerM
         +odel-FreeTier",                                                
      13 +            "quotaDimensions": {                               
      14 +              "location": "global",                            
      15 +              "model": "gemini-3.8-flash"                      
      16 +            },                                                 
      17 +            "quotaValue": "5"                                  
      18 +          }                                                    
      19 +        ]                                                      
      20 +      },                                                       
      21 +      {                                                        
      22 +        "@type": "type.googleapis.com/google.rpc.Help",        
      23 +        "links": [                                             
      24 +          {                                                    
      25 +            "description": "Learn more about Gemini API quotas"
         +,                                                              
      26 +            "url": "https://ai.google.dev/gemini-api/docs/rate-
         +limits"                                                        
      27 +          }                                                    
      28 +        ]                                                      
      29 +      },                                                       
      30 +      {                                                        
      31 +        "@type": "type.googleapis.com/google.rpc.RetryInfo",   
      32 +        "retryDelay": "37s"                                    
      33 +      }                                                        
      34 +    ]                                                          
      35 +  }                                                            
      36 +}                                                              
  ⎿  Created src/server/llm/fixtures/gemini/plan-infeasible.json +22
       1 +{                                                              
       2 +  "candidates": [                                              
       3 +    {                                                          
       4 +      "content": {                                             
       5 +        "role": "model",                                       
       6 +        "parts": [                                             
       7 +          {                                                    
       8 +            "text": "{\"feasible\": false, \"rejectionReason\":
         + \"La petición pide cambiar un workflow de GitHub Actions (.git
         +hub/**), que Develop no puede tocar.\", \"summary\": \"No se pu
         +ede hacer dentro del CRM.\", \"assumptions\": [], \"tasks\": []
         +}"                                                             
       9 +          }                                                    
      10 +        ]                                                      
      11 +      },                                                       
      12 +      "finishReason": "STOP"                                   
      13 +    }                                                          
      14 +  ],                                                           
      15 +  "usageMetadata": {                                           
      16 +    "promptTokenCount": 1800,                                  
      17 +    "candidatesTokenCount": 90,                                
      18 +    "thoughtsTokenCount": 0,                                   
      19 +    "totalTokenCount": 1890                                    
      20 +  },                                                           
      21 +  "modelVersion": "gemini-3.8-flash"                           
      22 +}                                                              
  ⎿  Created src/server/llm/fixtures/gemini/plan-invalid.json +22
       1 +{                                                              
       2 +  "candidates": [                                              
       3 +    {                                                          
       4 +      "content": {                                             
       5 +        "role": "model",                                       
       6 +        "parts": [                                             
       7 +          {                                                    
       8 +            "text": "{\"feasible\": true, \"summary\": \"Se aña
         +de el NIF a los clientes: columna nueva, formulario y detalle.\
         +", \"assumptions\": [\"El NIF es opcional para no romper los cl
         +ientes existentes.\"], \"tasks\": [{\"title\": \"Columna nif en
         + clients\", \"description\": \"Añade nif: text() a clients en s
         +rc/db/schema.ts y genera la migración.\", \"files\": [\"src/db/
         +schema.ts\", \"drizzle/0004_client_nif.sql\", \".github/workflo
         +ws/ci.yml\"], \"acceptanceCriteria\": [{\"id\": \"c1\", \"type\
         +": \"e2e\", \"text\": \"La vista previa compila y migra sin err
         +ores\"}]}, {\"title\": \"NIF en el formulario y el detalle\", \
         +"description\": \"Añade el campo nif a validation.ts, al formul
         +ario y al detalle del cliente con data-testid client-nif.\", \"
         +files\": [\"src/app/(crm)/clientes/validation.ts\", \"src/app/(
         +crm)/clientes/client-form.tsx\", \"src/app/(crm)/clientes/[id]/
         +page.tsx\"], \"acceptanceCriteria\": [{\"id\": \"c1\", \"type\"
         +: \"e2e\", \"text\": \"El formulario de cliente tiene el campo 
         +field-nif\"}, {\"id\": \"c3\", \"type\": \"visual\", \"text\": 
         +\"El detalle del cliente muestra el NIF a 1280 y 390 px\"}]}]}"
       9 +          }                                                    
      10 +        ]                                                      
      11 +      },                                                       
      12 +      "finishReason": "STOP"                                   
      13 +    }                                                          
      14 +  ],                                                           
      15 +  "usageMetadata": {                                           
      16 +    "promptTokenCount": 1800,                                  
      17 +    "candidatesTokenCount": 420,                               
      18 +    "thoughtsTokenCount": 0,                                   
      19 +    "totalTokenCount": 2220                                    
      20 +  },                                                           
      21 +  "modelVersion": "gemini-3.8-flash"                           
      22 +}                                                              
  ⎿  Created src/server/llm/fixtures/gemini/plan-ok.json +22
       1 +{                                                              
       2 +  "candidates": [                                              
       3 +    {                                                          
       4 +      "content": {                                             
       5 +        "role": "model",                                       
       6 +        "parts": [                                             
       7 +          {                                                    
       8 +            "text": "{\"feasible\": true, \"summary\": \"Se aña
         +de el NIF a los clientes: columna nueva, formulario y detalle.\
         +", \"assumptions\": [\"El NIF es opcional para no romper los cl
         +ientes existentes.\"], \"tasks\": [{\"title\": \"Columna nif en
         + clients\", \"description\": \"Añade nif: text() a clients en s
         +rc/db/schema.ts y genera la migración.\", \"files\": [\"src/db/
         +schema.ts\", \"drizzle/0004_client_nif.sql\"], \"acceptanceCrit
         +eria\": [{\"id\": \"c1\", \"type\": \"e2e\", \"text\": \"La vis
         +ta previa compila y migra sin errores\"}]}, {\"title\": \"NIF e
         +n el formulario y el detalle\", \"description\": \"Añade el cam
         +po nif a validation.ts, al formulario y al detalle del cliente 
         +con data-testid client-nif.\", \"files\": [\"src/app/(crm)/clie
         +ntes/validation.ts\", \"src/app/(crm)/clientes/client-form.tsx\
         +", \"src/app/(crm)/clientes/[id]/page.tsx\"], \"acceptanceCrite
         +ria\": [{\"id\": \"c2\", \"type\": \"e2e\", \"text\": \"El form
         +ulario de cliente tiene el campo field-nif\"}, {\"id\": \"c3\",
         + \"type\": \"visual\", \"text\": \"El detalle del cliente muest
         +ra el NIF a 1280 y 390 px\"}]}]}"                              
       9 +          }                                                    
      10 +        ]                                                      
      11 +      },                                                       
      12 +      "finishReason": "STOP"                                   
      13 +    }                                                          
      14 +  ],                                                           
      15 +  "usageMetadata": {                                           
      16 +    "promptTokenCount": 1800,                                  
      17 +    "candidatesTokenCount": 420,                               
      18 +    "thoughtsTokenCount": 0,                                   
      19 +    "totalTokenCount": 2220                                    
      20 +  },                                                           
      21 +  "modelVersion": "gemini-3.8-flash"                           
      22 +}                                                              
  ⎿  … +1 file changed
     src/server/llm/fixtures/gemini/plan-truncated.json

⏺ Write(src/server/llm/gemini.test.ts)
  ⎿  Wrote 206 lines to src/server/llm/gemini.test.ts
       1 import { ApiError, type GenerateContentParameters } from "@googl
         e/genai";
       2 import { describe, expect, it, vi } from "vitest";
       3 import { planSchema } from "@/server/agents/contracts";
       4 import {
       5   classifyQuotaError,
       6   GeminiProvider,
       7   toGeminiSchema,
       8   type GeminiResponse,
       9   type QuotaMemory,
     … +197 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

⏺ Gemini tests pass; the mock tests need .output.

⏺ Bash(python3 - <<'EOF'
      import re…)
  ⎿  2:import { runDevelop, runOrchestrator, runTesting } from "@/server/ag
     ents";
     3-import type {
     … +10 lines (ctrl+o to expand)
  ⎿  Updated src/server/llm/mock.test.ts +9 -6
      33  });
      34  
      35  async function brief(n: number): Promise<TaskBrief> {
      36 -  const plan = await runOrchestrator(new MockProvider("ok"), pl
         -anInput());                                                    
      36 +  const { output: plan } = await runOrchestrator(              
      37 +    new MockProvider("ok"),                                    
      38 +    planInput(),                                               
      39 +  );                                                           
      40    const t = plan.tasks[n - 1]!;
      41    return { position: n, ...t };
      42  }
     ...
      47    iteration: number,
      48    report = passed,
      49  ) {
      47 -  return runTesting(new MockProvider(scenario), {              
      50 +  const { output } = await runTesting(new MockProvider(scenario
         +), {                                                           
      51      runId: 7,
      52      task: await brief(n),
      53      iteration,
     ...
      57  
      58  describe("MockProvider", () => {
      59    it("plans two tasks and carries the feedback", async () => {
      57 -    const plan = await runOrchestrator(                        
      60 +    const { output: plan } = await runOrchestrator(            
      61        new MockProvider("ok"),
      62        planInput({ planRevision: 2, feedback: "Hazlo obligatorio
          " }),
      63      );
     ...
      67    });
      68  
      69    it("an amend replan adds a single corrective task (D29)", asy
          nc () => {
      67 -    const plan = await runOrchestrator(                        
      70 +    const { output: plan } = await runOrchestrator(            
      71        new MockProvider("ok"),
      72        planInput({ planRevision: 2, mode: "amend", feedback: "Má
          s grande" }),
      73      );
     ...
      75    });
      76  
      77    it("develops one file per task under agent-runs", async () =>
           {
      75 -    const out = await runDevelop(new MockProvider("ok"), {     
      78 +    const { output: out } = await runDevelop(new MockProvider("
         +ok"), {                                                        
     … +11 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/llm/mock.test.ts'…)
  ⎿        Tests  24 passed (24)
        Start at  20:23:43
        Duration  169ms (import 69%, transform 20%, tests 9%, worker 2%)
  ⎿  Updated src/server/llm/mock.test.ts +1
      53      iteration,
      54      report,
      55    });
      56 +  return output;                                               
      57  }
      58  
      59  describe("MockProvider", () => {

⏺ Bash(cat > src/server/llm/index.test.ts <<'EOF'
      import { afterEach, describe, expect, it, vi } from "vitest";…)
  ⎿     Start at  20:23:57
        Duration  122ms (import 59%, transform 34%, tests 4%, worker 3%)
  ⎿  Created src/server/llm/index.test.ts +64
       1 +import { afterEach, describe, expect, it, vi } from "vitest";  
       2 +import {                                                       
       3 +  modelsFor,                                                   
       4 +  providersForNewRun,                                          
       5 +  providerSummary,                                             
       6 +  runProviders,                                                
       7 +  usesMockScenario,                                            
       8 +} from "./index";                                              
       9 +                                                               
      10 +afterEach(() => vi.unstubAllEnvs());                           
      11 +                                                               
      12 +describe("providers per agent (D26)", () => {                  
      13 +  it("defaults every agent to the mock", () => {               
      14 +    vi.stubEnv("LLM_PROVIDER_ORCHESTRATOR", "");               
      15 +    expect(providersForNewRun()).toEqual({                     
      16 +      orchestrator: "mock",                                    
      17 +      develop: "mock",                                         
      18 +      testing: "mock",                                         
      19 +    });                                                        
      20 +  });                                                          
      21 +                                                               
      22 +  it("reads LLM_PROVIDER_<AGENT>", () => {                     
      23 +    vi.stubEnv("LLM_PROVIDER", "");                            
      24 +    vi.stubEnv("LLM_PROVIDER_ORCHESTRATOR", "gemini");         
      25 +    vi.stubEnv("LLM_PROVIDER_DEVELOP", "nope");                
      26 +    const p = providersForNewRun();                            
      27 +    expect(p).toEqual({                                        
      28 +      orchestrator: "gemini",                                  
      29 +      develop: "mock",                                         
      30 +      testing: "mock",                                         
      31 +    });                                                        
      32 +    expect(providerSummary(p)).toBe("gemini+mock");            
      33 +    expect(usesMockScenario(p)).toBe(true);                    
      34 +  });                                                          
      35 +                                                               
      36 +  it("LLM_PROVIDER=mock forces the mock (plan B)", () => {     
      37 +    vi.stubEnv("LLM_PROVIDER", "mock");                        
      38 +    vi.stubEnv("LLM_PROVIDER_ORCHESTRATOR", "gemini");         
      39 +    expect(providersForNewRun().orchestrator).toBe("mock");    
      40 +  });                                                          
     … +24 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/runs/engine.ts'…)  ⎿  148:      runOrchestrator(await ctx.llm("orchestrator"), {
     203:        runDevelop(await ctx.llm("develop"), {
     361:        runTesting(await ctx.llm("testing"), {
     … +4 lines (ctrl+o to expand)
  ⎿  Updated src/server/runs/engine.ts +13 -12
      34    mergePr,
      35    moveBranch,
      36  } from "@/server/github/repo";
      37 -import { getProvider } from "@/server/llm";                    
      38 -import type { LLMProvider } from "@/server/llm/provider";      
      37 +import { getProvider, runProviders } from "@/server/llm";      
      38 +import type { Generated, LLMProvider } from "@/server/llm/provi
         +der";                                                          
      39  import { llmCallsPerRun } from "./limits";
      40  import {
      41    AWAITING_HUMAN,
     ...
      80    db: Db;
      81    run: LoadedRun;
      82    token: string;
      83 -  llm: LLMProvider;                                            
      83 +  llm: (agent: AgentName) => Promise<LLMProvider>;             
      84  };
      85  
      86  const short = (sha: string) => sha.slice(0, 7);
     ...
      101    ctx: StepContext,
      102    key: { agent: AgentName; taskId: number | null; iteration: n
           umber },
      103    schema: z.ZodType<T>,
      104 -  call: () => Promise<T>,                                     
      104 +  call: () => Promise<Generated<T>>,                          
      105  ): Promise<T> {
      106    const where = and(
      107      eq(agentSteps.runId, ctx.run.id),
     ...
      119        `Se ha llegado al máximo de ${llmCallsPerRun()} llamadas
            al LLM del run`,
      120      );
      121    }
      122 -  const output = await call();                                
      122 +  const { output } = await call();                            
      123    const [inserted] = await ctx.db
      124      .insert(agentSteps)
      125      .values({ runId: ctx.run.id, ...key, output })
     ...
      144      ctx,
      145      { agent: "orchestrator", taskId: null, iteration: run.plan
           Revision },
      146      planSchema,
      147 -    () =>                                                     
      148 -      runOrchestrator(ctx.llm, {                              
      147 +    async () =>                                               
     … +33 lines (ctrl+o to expand)

⏺ Proveedor de Gemini con sus tests listo; ahora adapto el formulario de runs al
  proveedor por agente para dejar el commit en verde.

  Ran 1 shell command (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/app/runs/page.tsx'…)
  ⎿            rows={3}
               required
               minLength={10}
     … +33 lines (ctrl+o to expand)
  ⎿  Updated src/app/runs/new-run-form.tsx +25 -7
       1  "use client";
       2  
       3  import { useActionState } from "react";
       4 +import type { AgentProviders } from "@/server/llm";            
       5  import { createRun, type FormState } from "./actions";
       5 -import { SCENARIO } from "./labels";                           
       6 +import { ACTOR, SCENARIO } from "./labels";                    
       7  
       7 -export function NewRunForm({ provider }: { provider: string }) 
         -{                                                              
       8 +export function NewRunForm({ providers }: { providers: AgentPro
         +viders }) {                                                    
       9 +  // Same rule as usesMockScenario(), which is server-only.    
      10 +  const mockScenario =                                         
      11 +    providers.develop === "mock" || providers.testing === "mock
         +";                                                             
      12    const [state, action, pending] = useActionState<FormState, Fo
          rmData>(
      13      createRun,
      14      {
     ...
      30            data-testid="request-input"
      31          />
      32        </label>
      29 -      {provider === "mock" && (                                
      30 -        <div className="row">                                  
      33 +      <div className="row">                                    
      34 +        {mockScenario && (                                     
      35            <label className="field">
      36              Escenario de MockProvider
      37              <select
     ...
      46                ))}
      47              </select>
      48            </label>
      49 +        )}                                                     
      50 +        {mockScenario && (                                     
      51            <label className="check">
      52              <input
      53                type="checkbox"
     ...
      56              />
      57              Simular caída tras el commit
      58            </label>
      53 -        </div>                                                 
      54 -      )}                                                       
      59 +        )}                                                     
     … +24 lines (ctrl+o to expand)
  ⎿  Updated src/app/runs/page.tsx +2 -2
       4  import { Suspense } from "react";
       5  import { Nav } from "@/app/nav";
       6  import { getDb } from "@/server/db/client";
       7 -import { defaultProviderName } from "@/server/llm";            
       7 +import { providersForNewRun } from "@/server/llm";             
       8  import { isFinal, type RunStatus } from "@/server/runs/machine"
          ;
       9  import { listRuns, type RunListItem } from "@/server/runs/queri
          es";
      10  import { RUN_STATUS, statusTone } from "./labels";
     ...
      92  
      93  async function Form() {
      94    await connection();
      95 -  return <NewRunForm provider={defaultProviderName()} />;      
      95 +  return <NewRunForm providers={providersForNewRun()} />;      
      96  }
      97  
      98  export default function RunsPage() {

⏺ Bash(python3 - <<'EOF'
      p='src/app/runs/actions.ts'…)
  ⎿  $ prettier --write .
     $ eslint
           Tests  183 passed (183)
  ⎿  Updated src/app/runs/actions.ts +16 -7
       6  import { z } from "zod";
       7  import { getDb } from "@/server/db/client";
       8  import { runs } from "@/server/db/schema";
       9 -import { defaultProviderName } from "@/server/llm";            
       9 +import {                                                       
      10 +  providersForNewRun,                                          
      11 +  providerSummary,                                             
      12 +  usesMockScenario,                                            
      13 +} from "@/server/llm";                                         
      14  import { MOCK_SCENARIOS } from "@/server/llm/mock";
      15  import {
      16    applyEvent,
     ...
      40      .max(2000),
      41    scenario: z.enum(MOCK_SCENARIOS).optional(),
      42    simulateCrash: z.literal("on").optional(),
      43 +  simulatePlanCrash: z.literal("on").optional(),               
      44  });
      45  
      46  /** New request from the client (D25). It waits in the queue if
           a run is active. */
     ...
      49    formData: FormData,
      50  ): Promise<FormState> {
      51    await requireUser();
      47 -  const provider = defaultProviderName();                      
      52 +  const providers = providersForNewRun();                      
      53 +  const mock = usesMockScenario(providers);                    
      54    const parsed = newRunSchema.safeParse({
      55      request: formData.get("request") ?? "",
      50 -    scenario:                                                  
      51 -      provider === "mock" ? (formData.get("scenario") ?? "ok") 
         -: undefined,                                                   
      56 +    scenario: mock ? (formData.get("scenario") ?? "ok") : undef
         +ined,                                                          
      57      simulateCrash: formData.get("simulateCrash") ?? undefined,
      58 +    simulatePlanCrash: formData.get("simulatePlanCrash") ?? und
         +efined,                                                        
      59    });
      60    if (!parsed.success) {
      61      return { error: parsed.error.issues[0]?.message ?? "Datos n
          o válidos." };
     ...
      70      .insert(runs)
      71      .values({
      72        request: parsed.data.request,
      67 -      provider,                                                
      73 +      provider: providerSummary(providers),                    
     … +19 lines (ctrl+o to expand)
  ⎿  Updated src/server/agents/index.ts +1 -5
      1 -import type {                                                   
      2 -  CallHooks,                                                    
      3 -  Generated,                                                    
      4 -  LLMProvider,                                                  
      5 -} from "@/server/llm/provider";                                 
      1 +import type { CallHooks, Generated, LLMProvider } from "@/server
        +/llm/provider";                                                 
      2  import {
      3    developOutputSchema,
      4    planSchema,
  ⎿  Updated src/server/llm/fixtures/gemini/error-429-daily.json +1 -1
      33        }
      34      ]
      35    }
      36 -}                                                              
      36 +}                                                              
  ⎿  Updated src/server/llm/fixtures/gemini/error-429-minute.json +1 -1
      33        }
      34      ]
      35    }
      36 -}                                                              
      36 +}                                                              
  ⎿  Updated src/server/llm/fixtures/gemini/plan-infeasible.json +1 -1
      19      "totalTokenCount": 1890
      20    },
      21    "modelVersion": "gemini-3.8-flash"
      22 -}                                                              
      22 +}                                                              
  ⎿  … +5 files changed
     src/server/llm/fixtures/gemini/plan-invalid.json
     src/server/llm/fixtures/gemini/plan-ok.json
     src/server/llm/fixtures/gemini/plan-truncated.json
     +2 more

  Called ccd_turn, ran 2 shell commands (ctrl+o to expand)

⏺ Bash(cat >> src/server/github/repo.ts <<'EOF'…)
  ⎿  1:import { afterEach, beforeEach, describe, expect, it, vi } from "vit
     est";
     23:describe("GitHub repo client", () => {
     … +10 lines (ctrl+o to expand)
  ⎿  Created src/server/agents/context.ts +28
       1 +import { getFilePaths, getFileText } from "@/server/github/repo
         +";                                                             
       2 +import type { PlanContext } from "./contracts";                
       3 +import { PAGES_FILE } from "./paths";                          
       4 +                                                               
       5 +/**                                                            
       6 + * What the orchestrator reads from crm-demo (D27): the convent
         +ions, the                                                      
       7 + * schema and the captured pages. It plans, it does not program
         +, so it never                                                  
       8 + * gets the whole code.                                        
       9 + */                                                            
      10 +export const CONTEXT_FILES = ["AGENTS.md", "src/db/schema.ts", 
         +PAGES_FILE];                                                   
      11 +                                                               
      12 +/** agent-runs/ grows with every simulated run and tells nothin
         +g about the app. */                                            
      13 +const IGNORED_PREFIXES = ["agent-runs/"];                      
      14 +                                                               
      15 +export const relevantPaths = (paths: string[]) =>              
      16 +  paths.filter((p) => !IGNORED_PREFIXES.some((prefix) => p.star
         +tsWith(prefix)));                                              
      17 +                                                               
      18 +/** Reads the context at a fixed sha, so every revision plans o
         +n the same base. */                                            
      19 +export async function readPlanContext(baseSha: string): Promise
         +<PlanContext> {                                                
      20 +  const tree = relevantPaths(await getFilePaths(baseSha));     
      21 +  const files = await Promise.all(                             
      22 +    CONTEXT_FILES.filter((f) => tree.includes(f)).map(async (pa
         +th) => ({                                                      
      23 +      path,                                                    
      24 +      content: (await getFileText(path, baseSha)) ?? "",       
      25 +    })),                                                       
      26 +  );                                                           
      27 +  return { baseSha, tree, files };                             
      28 +}                                                              
  ⎿  Updated src/server/github/repo.ts +29
      214    const path = `/pulls/${number}`;
      215    expectOk(await call("PATCH", path, { state: "closed" }), pat
           h);
      216  }
      217 +                                                              
      218 +const treeSchema = z.object({                                 
      219 +  truncated: z.boolean(),                                     
      220 +  tree: z.array(z.object({ path: z.string(), type: z.string() 
          +})),                                                          
      221 +});                                                           
      222 +                                                              
      223 +/** Every file path of the repo at a commit (Git Trees API, re
          +cursive; D27). */                                             
      224 +export async function getFilePaths(sha: string): Promise<strin
          +g[]> {                                                        
      225 +  const path = `/git/trees/${sha}?recursive=1`;               
      226 +  const tree = treeSchema.parse(expectOk(await call("GET", pat
          +h), path));                                                   
      227 +  return tree.tree.filter((e) => e.type === "blob").map((e) =>
          + e.path);                                                     
      228 +}                                                             
      229 +                                                              
      230 +const contentSchema = z.object({                              
      231 +  encoding: z.literal("base64"),                              
      232 +  content: z.string(),                                        
      233 +});                                                           
      234 +                                                              
      235 +/** Text of a file at a commit, or null when it does not exist
          + there. */                                                    
      236 +export async function getFileText(                            
      237 +  file: string,                                               
      238 +  sha: string,                                                
      239 +): Promise<string | null> {                                   
      240 +  const path = `/contents/${file.split("/").map(encodeURICompo
          +nent).join("/")}?ref=${sha}`;                                 
      241 +  const r = await call("GET", path);                          
      242 +  if (r.status === 404) return null;                          
      243 +  const { content } = contentSchema.parse(expectOk(r, path)); 
      244 +  return Buffer.from(content, "base64").toString("utf8");     
      245 +}                                                             

  Ran 1 shell command (ctrl+o to expand)

⏺ Leo el contexto del Orquestador desde GitHub; añado sus tests.

⏺ Bash(cat > src/server/agents/context.test.ts <<'EOF'
      import { afterEach, beforeEach, describe, expect, it, vi } from
      "vitest";…)
  ⎿        Tests  1 passed (1)
  ⎿  Created src/server/agents/context.test.ts +50
       1 +import { afterEach, beforeEach, describe, expect, it, vi } from
         + "vitest";                                                     
       2 +import { readPlanContext } from "./context";                   
       3 +                                                               
       4 +describe("readPlanContext (D27)", () => {                      
       5 +  const fetchMock = vi.fn<typeof fetch>();                     
       6 +  beforeEach(() => {                                           
       7 +    vi.stubEnv("GH_TOKEN", "test-token");                      
       8 +    vi.stubGlobal("fetch", fetchMock);                         
       9 +  });                                                          
      10 +  afterEach(() => {                                            
      11 +    vi.unstubAllEnvs();                                        
      12 +    vi.unstubAllGlobals();                                     
      13 +    fetchMock.mockReset();                                     
      14 +  });                                                          
      15 +                                                               
      16 +  it("reads the tree and the context files at the base sha", as
         +ync () => {                                                    
      17 +    const b64 = (s: string) => Buffer.from(s).toString("base64"
         +);                                                             
      18 +    fetchMock.mockImplementation(async (input) => {            
      19 +      const url = String(input);                               
      20 +      if (url.includes("/git/trees/")) {                       
      21 +        return Response.json({                                 
      22 +          truncated: false,                                    
      23 +          tree: [                                              
      24 +            { path: "AGENTS.md", type: "blob" },               
      25 +            { path: "src", type: "tree" },                     
      26 +            { path: "src/db/schema.ts", type: "blob" },        
      27 +            { path: "agent-runs/7/task-1.md", type: "blob" },  
      28 +          ],                                                   
      29 +        });                                                    
      30 +      }                                                        
      31 +      const file = decodeURIComponent(                         
      32 +        url.split("/contents/")[1]!.split("?")[0]!,            
      33 +      );                                                       
      34 +      return Response.json({ encoding: "base64", content: b64(`
         +# ${file}`) });                                                
      35 +    });                                                        
      36 +                                                               
      37 +    const ctx = await readPlanContext("base1");                
      38 +    expect(ctx.tree).toEqual(["AGENTS.md", "src/db/schema.ts"])
         +;                                                              
      39 +    // e2e/pages.ts is not in this tree, so it is not requested
         +.                                                              
      40 +    expect(ctx.files).toEqual([                                
     … +10 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

⏺ Now the orchestrator prompt.

⏺ Bash(mkdir -p ~/Trabajo/pruebas-tecnicas/paradigma/crm-agents/s
      rc/server/agents/prompts && cat >
      ~/Trabajo/pruebas-tecnicas/paradigma/c…)
  ⎿  Updated src/server/agents/index.ts +8 -6
      1  import type { CallHooks, Generated, LLMProvider } from "@/server
         /llm/provider";
      2 +import { ORCHESTRATOR_SYSTEM, orchestratorPrompt } from "./promp
        +ts/orchestrator";                                               
      3  import {
      4    developOutputSchema,
      4 -  planSchema,                                                   
      5 +  planSchemaFor,                                                
      6    verdictSchema,
      7    type DevelopInput,
      8    type DevelopOutput,
     ...
      12    type TestingVerdict,
      13  } from "./contracts";
      14  
      14 -// Prompts are placeholders until H4–H6; the mock reads `input`
         - instead.                                                      
      15 +// Develop and Testing prompts are placeholders until H5 and H6
         +; the mock                                                     
      16 +// reads `input` instead.                                      
      17  
      18  export function runOrchestrator(
      19    llm: LLMProvider,
     ...
      22  ): Promise<Generated<Plan>> {
      23    return llm.generateObject({
      24      agent: "orchestrator",
      23 -    system:                                                    
      24 -      "Eres el orquestador. Divide la petición en tareas con cr
         -iterios de aceptación.",                                       
      25 -    prompt: JSON.stringify(input),                             
      25 +    system: ORCHESTRATOR_SYSTEM,                               
      26 +    prompt: orchestratorPrompt(input),                         
      27      input,
      28      hooks,
      28 -    schema: planSchema,                                        
      29 +    // With the tree: a new page must be added to e2e/pages.ts 
         +(D28).                                                         
      30 +    schema: planSchemaFor(input.context.tree),                 
      31    });
      32  }
      33  
  ⎿  Created src/server/agents/prompts/orchestrator.ts +84
       1 +import { MAX_PLAN_TASKS, type PlanInput } from "../contracts"; 
       2 +import { FORBIDDEN_FILES, FORBIDDEN_PREFIXES, PAGES_FILE } from
         + "../paths";                                                   
       3 +                                                               
       4 +/**                                                            
       5 + * Prompt of the orchestrator (D27–D29). In Spanish, like every
         +thing the                                                      
       6 + * client reads. The forbidden paths come from paths.ts so they
         + never drift                                                   
       7 + * from what the commit layer enforces (D16).                  
       8 + */                                                            
       9 +                                                               
      10 +const forbidden = [                                            
      11 +  ...FORBIDDEN_PREFIXES.map((p) => `\`${p}**\``),              
      12 +  ...FORBIDDEN_FILES.map((f) => `\`${f}\``),                   
      13 +].join(", ");                                                  
      14 +                                                               
      15 +export const ORCHESTRATOR_SYSTEM = `Eres el Orquestador de un e
         +quipo de agentes que modifica crm-demo, un mini CRM (clientes, 
         +presupuestos y facturas) en Next.js 16, TypeScript, Tailwind y 
         +Drizzle sobre Neon. Recibes la petición de un cliente y la divi
         +des en tareas para el agente Develop, que escribe el código, y 
         +el agente Testing, que comprueba los criterios con Playwright y
         + capturas. Planificas: no escribes código.                     
      16 +                                                               
      17 +## Alcance                                                     
      18 +Responde con feasible: false y un rejectionReason claro para el
         + cliente cuando la petición:                                   
      19 +- no es un cambio del CRM (otra aplicación, preguntas generales
         +, tareas fuera del repositorio);                               
      20 +- exige tocar rutas prohibidas: ${forbidden} (workflows de GitH
         +ub Actions incluidos);                                         
      21 +- exige tocar lo que AGENTS.md marca como «No tocar»: autentica
         +ción, configuración de build y despliegue, migraciones ya subid
         +as o /api/health;                                              
      22 +- necesita claves, servicios externos o de pago, o dependencias
         + nuevas que la petición no justifica;                          
      23 +- pide borrar o alterar datos reales de producción.            
      24 +Si la petición es ambigua pero razonable, no la rechaces: elige
         + la interpretación más sencilla y anótala en assumptions.      
      25 +                                                               
      26 +## Plan                                                        
      27 +- De 1 a ${MAX_PLAN_TASKS} tareas, en el orden en que se aplica
         +n. Cada tarea es un commit: pequeña, coherente y comprobable po
         +r sí sola. Prefiere pocas tareas.                              
      28 +- title: corto. description: instrucciones concretas para Devel
         +op, con rutas, nombres de columnas y los data-testid nuevos. Si
         +gue las convenciones de AGENTS.md (estructura por entidad, dine
         +ro en céntimos, fechas YYYY-MM-DD, cacheComponents, data-testid
         + existentes intactos).                                         
      29 +- files: rutas exactas del repositorio que la tarea crea o modi
         +fica. Usa rutas del árbol que recibes o rutas nuevas que sigan 
         +su estructura. Un cambio de esquema incluye src/db/schema.ts y 
         +su migración nueva en drizzle/.                                
      30 +- Si una tarea crea una página nueva (un page.tsx que no está e
         +n el árbol), esa tarea incluye ${PAGES_FILE} en files y añade l
         +a página a la lista para que salga en las capturas.            
      31 +- acceptanceCriteria: de 1 a 6 por tarea, con id único en todo 
         +el plan (c1, c2, c3…) y tipo:                                  
      32 +  - e2e: se comprueba en el DOM de la vista previa; nombra el d
         +ata-testid o el texto exacto que debe aparecer.                
      33 +  - visual: se comprueba en las capturas a 1280 px y 390 px de 
         +las páginas de ${PAGES_FILE}; nombra la página.                
      34 +- summary: qué verá el cliente cuando esté hecho, en dos o tres
         + frases. assumptions: lo que has decidido sin que la petición l
         +o diga.                                                        
      35 +- Todo el texto (summary, assumptions, títulos, descripciones, 
         +criterios y rejectionReason) en español.                       
      36 +                                                               
      37 +Responde solo con el JSON del esquema.`;                       
      38 +                                                               
      39 +const fence = (path: string, content: string) =>               
      40 +  `### ${path}\n\`\`\`\n${content.trimEnd()}\n\`\`\``;         
     … +44 lines (ctrl+o to expand)

⏺ Bash(cat > src/server/agents/prompts/orchestrator.test.ts <<'EOF'
      import { describe, expect, it } from "vitest";…)
  ⎿  $ prettier --write .
           Tests  27 passed (27)
  ⎿  Updated src/server/agents/index.ts +4 -1
      1  import type { CallHooks, Generated, LLMProvider } from "@/server
         /llm/provider";
      2 -import { ORCHESTRATOR_SYSTEM, orchestratorPrompt } from "./promp
        -ts/orchestrator";                                               
      2 +import {                                                        
      3 +  ORCHESTRATOR_SYSTEM,                                          
      4 +  orchestratorPrompt,                                           
      5 +} from "./prompts/orchestrator";                                
      6  import {
      7    developOutputSchema,
      8    planSchemaFor,
  ⎿  Created src/server/agents/prompts/orchestrator.test.ts +88
       1 +import { describe, expect, it } from "vitest";                 
       2 +import type { PlanInput } from "../contracts";                 
       3 +import { ORCHESTRATOR_SYSTEM, orchestratorPrompt } from "./orch
         +estrator";                                                     
       4 +                                                               
       5 +const input = (over: Partial<PlanInput> = {}): PlanInput => ({ 
       6 +  runId: 7,                                                    
       7 +  request: "Añade el NIF a los clientes",                      
       8 +  planRevision: 1,                                             
       9 +  mode: "replace",                                             
      10 +  feedback: null,                                              
      11 +  previous: null,                                              
      12 +  context: {                                                   
      13 +    baseSha: "0123456789abcdef",                               
      14 +    tree: ["AGENTS.md", "src/db/schema.ts"],                   
      15 +    files: [{ path: "AGENTS.md", content: "# AGENTS.md · crm-de
         +mo\n" }],                                                      
      16 +  },                                                           
      17 +  ...over,                                                     
      18 +});                                                            
      19 +                                                               
      20 +const previous = {                                             
      21 +  summary: "NIF en clientes",                                  
      22 +  tasks: [                                                     
      23 +    {                                                          
      24 +      position: 1,                                             
      25 +      title: "Columna nif",                                    
      26 +      status: "passed",                                        
      27 +      lastFeedback: null,                                      
      28 +      acceptanceCriteria: [                                    
      29 +        { id: "c1", type: "e2e" as const, text: "Se ve field-ni
         +f" },                                                          
      30 +      ],                                                       
      31 +    },                                                         
      32 +  ],                                                           
      33 +};                                                             
      34 +                                                               
      35 +describe("orchestrator prompt", () => {                        
      36 +  it("states the scope rules with the paths of paths.ts", () =>
         + {                                                             
      37 +    for (const path of [                                       
      38 +      "`.github/**`",                                          
      39 +      "`e2e/helpers.ts`",                                      
      40 +      "`e2e/screenshots.spec.ts`",                             
     … +48 lines (ctrl+o to expand)
  ⎿  Updated src/server/agents/prompts/orchestrator.ts +9 -3
      51          ...input.previous.tasks.map((t) =>
      52            [
      53              `- Tarea ${t.position} · ${t.title} · estado: ${t.s
          tatus}`,
      54 -            ...t.acceptanceCriteria.map((c) => `  - ${c.id} (${
         -c.type}): ${c.text}`),                                         
      55 -            ...(t.lastFeedback ? [`  - Último feedback de Testi
         -ng: ${t.lastFeedback}`] : []),                                 
      54 +            ...t.acceptanceCriteria.map(                       
      55 +              (c) => `  - ${c.id} (${c.type}): ${c.text}`,     
      56 +            ),                                                 
      57 +            ...(t.lastFeedback                                 
      58 +              ? [`  - Último feedback de Testing: ${t.lastFeedb
         +ack}`]                                                         
      59 +              : []),                                           
      60            ].join("\n"),
      61          ),
      62        ].join("\n"),
     ...
      67          `## Replanificación del plan (revisión ${input.planRevi
          sion})`,
      68          "El cliente ha rechazado el plan anterior y aún no hay 
          código. Devuelve un plan completo que lo sustituye.",
      69          `Resumen del plan anterior: ${input.previous.summary}`,
      66 -        ...input.previous.tasks.map((t) => `- Tarea ${t.positio
         -n} · ${t.title}`),                                             
      70 +        ...input.previous.tasks.map(                           
      71 +          (t) => `- Tarea ${t.position} · ${t.title}`,         
      72 +        ),                                                     
      73        ].join("\n"),
      74      );
      75    }

  Read 1 file, called ccd_turn, ran 2 shell commands (ctrl+o to expand)

⏺ Now the engine wiring. First the testable call cache.

⏺ Write(src/server/runs/cache.ts)
  ⎿  Wrote 92 lines to src/server/runs/cache.ts
      1 import type { z } from "zod";
      2 import type { AgentName } from "@/server/agents/contracts";
      3 import type { CallHooks, CallMeta, Generated } from "@/server/llm
        /provider";
      4 
      5 /**
      6  * Cache of agent outputs (D22): the validated output of each LLM
         step is
      7  * stored by (run, task, iteration, agent), so a retried step nev
        er calls the
     … +85 lines (ctrl+o to expand)

⏺ Write(src/server/runs/cache.test.ts)
  ⎿  Wrote 145 lines to src/server/runs/cache.test.ts
       1 import { describe, expect, it, vi } from "vitest";
       2 import { z } from "zod";
       3 import type { CallHooks, CallMeta } from "@/server/llm/provider"
         ;
       4 import {
       5   cachedCall,
       6   CallLimitReached,
       7   totals,
       8   type StepKey,
       9   type StepStore,
     … +136 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

⏺ Now the engine itself.

  Ran 1 shell command · 1 failed (ctrl+o to expand)

⏺ Bash(grep -n "new SimulatedCrash()" src/server/runs/engine.ts && python3 -
      <<'EOF'
      p='src/server/runs/engine.ts'…)
  ⎿  419:    throw new SimulatedCrash();
     659:        events: [{ actor: "system", kind: "blocked", message: erro
     r.message }],
     $ eslint
  ⎿  Updated src/server/runs/engine.ts +29 -4
      416  
      417    if (run.simulateCrash && !run.crashedAt) {
      418      await checkpoint(db, run, token, { crashedAt: new Date() }
           );
      419 -    throw new SimulatedCrash();                               
      419 +    throw new SimulatedCrash(                                 
      420 +      "Caída simulada justo después de mover la rama. El sweep
          + reanudará el paso cuando caduque el lease.",                 
      421 +    );                                                        
      422    }
      423  
      424    // 3. One PR per run: reuse the open one (D22).
     ...
      623      await appendEvent(db, run, {
      624        actor: "system",
      625        kind: "crash",
      624 -      message:                                                
      625 -        "Caída simulada justo después de mover la rama. El swe
          -ep reanudará el paso cuando caduque el lease.",               
      626 +      message: error.message,                                 
      627      });
      628      return { applied: false };
      629    }
      629 -  if (error instanceof BlockRun) {                            
      630 +  if (error instanceof RateLimited) {                         
      631 +    // D26: no waiting inside the function and not a failure o
          +f the step. The                                               
      632 +    // lease is pushed to the retryDelay and the sweep resumes
          + it then.                                                     
      633 +    const ms = error.retryAfterMs + RATE_LIMIT_MARGIN_MS;     
      634 +    await db                                                  
      635 +      .update(runs)                                           
      636 +      .set({                                                  
      637 +        leaseUntil: sql`now() + make_interval(secs => ${Math.c
          +eil(ms / 1000)})`,                                            
      638 +      })                                                      
      639 +      .where(and(eq(runs.id, run.id), eq(runs.leaseToken, toke
          +n)));                                                         
      640 +    await appendEvent(db, run, {                              
      641 +      actor: "system",                                        
      642 +      kind: "rate_limited",                                   
      643 +      message: `Gemini: ${error.message}. El paso se reanuda s
          +olo.`,                                                        
      644 +      data: { model: error.model, retryAfterMs: error.retryAft
          +erMs },                                                       
      645 +    });                                                       
      646 +    return { applied: false };                                
      647 +  }                                                           
      648 +  if (                                                        
      649 +    error instanceof BlockRun ||                              
     … +14 lines (ctrl+o to expand)

⏺ Bash(python3 - <<'EOF'
      p='src/server/runs/engine.ts'…)
  ⎿        Tests  193 passed (193)
  ⎿  Updated src/server/runs/engine.ts +5 -5
      231    const base = baseSha;
      232    // Code on the branch: only new or corrective tasks (D29).
      233    const mode = run.headSha ? "amend" : "replace";
      234 +  let contextPaths = run.contextPaths;                        
      235  
      236    const result = await cachedCall(
      237      ctx,
     ...
      239      planSchema,
      240      async (hooks) => {
      241        const context = await readPlanContext(base);
      241 -      await checkpoint(db, run, token, {                      
      242 -        contextPaths: context.files.map((f) => f.path),       
      243 -      });                                                     
      242 +      contextPaths = context.files.map((f) => f.path);        
      243 +      await checkpoint(db, run, token, { contextPaths });     
      244        return runOrchestrator(
      245          await ctx.llm("orchestrator"),
      246          {
     ...
      268    const set = {
      269      planSummary: plan.summary,
      270      planAssumptions: plan.assumptions,
      271 -    // Older plans may lack it: the files are always the same 
          -list.                                                         
      272 -    contextPaths: run.contextPaths ?? CONTEXT_FILES,          
      271 +    // Set by the call, or by the attempt that stored the plan
          + first.                                                       
      272 +    contextPaths: contextPaths ?? CONTEXT_FILES,              
      273    };
      274  
      275    if (!plan.feasible) {

⏺ Bash(pnpm format >/dev/null; git add -A && git commit -qm "feat(runs): wire
      Gemini planning into the engine…)
  ⎿  $ prettier --write .
     cd912f3 feat(runs): wire Gemini planning into the engine
  ⎿  Updated src/server/runs/engine.ts +4 -1
      202      .select()
      203      .from(tasks)
      204      .where(
      205 -      and(eq(tasks.runId, run.id), eq(tasks.planRevision, run.
          -planRevision - 1)),                                           
      205 +      and(                                                    
      206 +        eq(tasks.runId, run.id),                              
      207 +        eq(tasks.planRevision, run.planRevision - 1),         
      208 +      ),                                                      
      209      )
      210      .orderBy(asc(tasks.position));
      211    return {

  Called ccd_turn, ran 2 shell commands (ctrl+o to expand)

⏺ Motor integrado y en verde (193 tests). Ahora la UI de /runs/[id]: plan,
  motivo del rechazo, archivos leídos y métricas por llamada.

⏺ Bash(python3 - <<'EOF'
      p='src/app/runs/[id]/page.tsx'…)
  ⎿  $ prettier --write .
     $ eslint
  ⎿  Updated src/app/globals.css +21
      346      grid-column: 1 / -1;
      347    }
      348  }
      349 +                                                              
      350 +.files {                                                      
      351 +  display: flex;                                              
      352 +  flex-wrap: wrap;                                            
      353 +  gap: 0.3rem;                                                
      354 +  font-size: 0.8rem;                                          
      355 +}                                                             
      356 +                                                              
      357 +.criteria {                                                   
      358 +  margin: 0.25rem 0;                                          
      359 +  padding-left: 1.1rem;                                       
      360 +  display: grid;                                              
      361 +  gap: 0.25rem;                                               
      362 +}                                                             
      363 +                                                              
      364 +.calls {                                                      
      365 +  margin: 0.2rem 0 0;                                         
      366 +  padding-left: 1rem;                                         
      367 +  font-size: 0.8rem;                                          
      368 +  color: color-mix(in srgb, var(--foreground) 70%, transparent
          +);                                                            
      369 +}                                                             
  ⎿  Updated src/app/runs/[id]/page.tsx +165 -43
       5  import { Suspense } from "react";
       6  import { Nav } from "@/app/nav";
       7  import { getDb } from "@/server/db/client";
       8 +import type { CallMeta } from "@/server/llm/provider";         
       9 +import { runProviders } from "@/server/llm";                   
      10  import { DEMO_REPO, runBranch } from "@/server/github/config";
      11  import { isFinal, type RunStatus } from "@/server/runs/machine"
          ;
      12  import { getRunDetail, type RunDetail } from "@/server/runs/que
          ries";
     ...
      32  const commitUrl = (sha: string) =>
      33    `https://github.com/${DEMO_REPO}/commit/${sha}`;
      34  
      35 +const fileUrl = (sha: string, path: string) =>                 
      36 +  `https://github.com/${DEMO_REPO}/blob/${sha}/${path}`;       
      37 +                                                               
      38 +const CRITERION_TYPE: Record<string, string> = {               
      39 +  e2e: "E2E",                                                  
      40 +  visual: "Visual",                                            
      41 +};                                                             
      42 +                                                               
      43 +const CALL_KIND: Record<string, string> = {                    
      44 +  first: "llamada",                                            
      45 +  repair: "reparación",                                        
      46 +};                                                             
      47 +                                                               
      48 +const tokens = new Intl.NumberFormat("es-ES");                 
      49 +const seconds = new Intl.NumberFormat("es-ES", { maximumFractio
         +nDigits: 1 });                                                 
      50 +                                                               
      51 +/** Calls stored in an event's data by the engine (D26), if any
         +. */                                                           
      52 +function eventCalls(data: unknown): { calls: CallMeta[]; cached
         +: boolean } {                                                  
      53 +  const d = data as { calls?: unknown; cached?: unknown } | nul
         +l;                                                             
      54 +  return {                                                     
      55 +    calls: Array.isArray(d?.calls) ? (d.calls as CallMeta[]) : 
         +[],                                                            
      56 +    cached: d?.cached === true,                                
      57 +  };                                                           
      58 +}                                                              
      59 +                                                               
      60  function Summary({ detail }: { detail: RunDetail }) {
      61    const { run, preview, report } = detail;
      62    return (
     ...
      70            {RUN_STATUS[run.status] ?? run.status}
     … +224 lines (ctrl+o to expand)

  Searched for 1 pattern, listed 1 directory, ran 3 shell commands (ctrl+o to expand)
⏺ UI lista. Ahora el script pnpm eval:plan, que llamará a Gemini con las 4
  peticiones de D14.

⏺ Bash(mkdir -p
      ~/Trabajo/pruebas-tecnicas/paradigma/crm-agents/scripts
      ~/Trabajo/pruebas-tecnicas/paradigma/crm-agents/docs/evals
      && cd…)
  ⎿  tsconfig.json:27:  "include": [
     tsconfig.json:35:  "exclude": ["node_modules"]
  ⎿  Updated package.json +2 -1
      13      "test": "vitest run",
      14      "test:watch": "vitest",
      15      "db:generate": "drizzle-kit generate",
      16 -    "db:migrate": "drizzle-kit migrate"                        
      16 +    "db:migrate": "drizzle-kit migrate",                       
      17 +    "eval:plan": "vitest run -c vitest.eval.config.ts"         
      18    },
      19    "dependencies": {
      20      "@google/genai": "^3.6.1",
  ⎿  Created scripts/eval-plan.eval.ts +176
        1 +import { mkdirSync, writeFileSync } from "node:fs";           
        2 +import { GoogleGenAI } from "@google/genai";                  
        3 +import { config } from "dotenv";                              
        4 +import { describe, expect, it } from "vitest";                
        5 +import { runOrchestrator } from "@/server/agents";            
        6 +import { readPlanContext } from "@/server/agents/context";    
        7 +import type { Plan, PlanContext } from "@/server/agents/contra
          +cts";                                                         
        8 +import { getBaseSha } from "@/server/github/repo";            
        9 +import { modelsFor } from "@/server/llm";                     
       10 +import {                                                      
       11 +  GeminiProvider,                                             
       12 +  type GeminiResponse,                                        
       13 +  type QuotaMemory,                                           
       14 +} from "@/server/llm/gemini";                                 
       15 +import { RateLimited, type CallMeta } from "@/server/llm/provi
          +der";                                                         
       16 +                                                              
       17 +/**                                                           
       18 + * pnpm eval:plan (D30): the four requests of D14 against Gemi
          +ni, with the                                                  
       19 + * real context of crm-demo. Saves each plan in docs/evals/ an
          +d the raw                                                     
       20 + * answers as fixtures for the Vitest suite. Spends 4 requests
          + or more of                                                   
       21 + * the daily quota: run it by hand.                           
       22 + */                                                           
       23 +                                                              
       24 +config({ path: [".env.local", ".env"], quiet: true });        
       25 +                                                              
       26 +const REQUESTS = [                                            
       27 +  {                                                           
       28 +    slug: "nif",                                              
       29 +    request:                                                  
       30 +      "Añade el NIF a los clientes: se introduce en el formula
          +rio de alta y edición y se ve en el detalle y en la lista.",  
       31 +  },                                                          
       32 +  {                                                           
       33 +    slug: "buscador",                                         
       34 +    request:                                                  
       35 +      "Añade un buscador en la lista de clientes que filtre po
          +r nombre o por email.",                                       
       36 +  },                                                          
       37 +  {                                                           
       38 +    slug: "facturas-vencidas",                                
       39 +    request:                                                  
       40 +      "Marca las facturas vencidas: las que siguen pendientes 
          +de pago con la fecha de vencimiento ya pasada deben destacarse
          + en la lista de facturas.",                                   
     … +136 lines (ctrl+o to expand)
  ⎿  Created vitest.eval.config.ts +15
       1 +import { fileURLToPath } from "node:url";                      
       2 +import { defineConfig } from "vitest/config";                  
       3 +                                                               
       4 +/** `pnpm eval:plan`: real Gemini calls, by hand only, never in
         + CI (D30). */                                                  
       5 +export default defineConfig({                                  
       6 +  resolve: {                                                   
       7 +    alias: { "@": fileURLToPath(new URL("./src", import.meta.ur
         +l)) },                                                         
       8 +  },                                                           
       9 +  test: {                                                      
      10 +    environment: "node",                                       
      11 +    include: ["scripts/**/*.eval.ts"],                         
      12 +    testTimeout: 10 * 60_000,                                  
      13 +    fileParallelism: false,                                    
      14 +  },                                                           
      15 +});                                                            

  Called ccd_turn, ran 2 shell commands (ctrl+o to expand)

⏺ Todo el código está en verde (193 tests, lint y tipos). Aplico la migración
  0003 en Neon y subo master para que Vercel despliegue, como en las sesiones
  anteriores.

  Ran 3 shell commands (ctrl+o to expand)

⏺ La parte de código está hecha y desplegada en producción (/api/health devuelve
  0.1.0+ada5003, CI en verde). Para seguir necesito que hagas tres cosas en
  Vercel; ni la clave ni la CLI de Vercel están a mi alcance.

  Estado:
  - Commits en master: contrato del plan (con la migración 0003 ya aplicada en
    Neon), transición planning → rejected, GeminiProvider, lectura del contexto
    de crm-demo, prompt del Orquestador, integración en el motor, UI de
    /runs/[id] y el script pnpm eval:plan.
  - Comprobaciones: lint, tipos y 193 tests en verde. Ningún test llama a
    Gemini: todos usan el mock o respuestas grabadas.
  - Llamadas reales a Gemini hasta ahora: 0.

  Lo que necesito de ti:
  1. En Vercel, proyecto crm-agents, entornos Production, Preview y Development:
     - Añade LLM_PROVIDER_ORCHESTRATOR=gemini.
     - Si existe LLM_PROVIDER=mock, bórrala; si se queda, fuerza el mock en
       todos los agentes.
     - Si RUNS_PER_DAY o LLM_CALLS_PER_RUN siguen con 10 y 30, bórralas para que
       se apliquen los nuevos valores por defecto, 5 y 12.
     - Vuelve a desplegar para que se apliquen los cambios.
  2. En local, trae las variables para que pnpm eval:plan tenga GEMINI_API_KEY:
  vercel env pull .env.local
  3. El límite diario bloquea las pruebas en producción hoy. Hoy (UTC) ya hay 6
     runs y el límite nuevo es 5, así que no se pueden crear runs hasta la 01:00
     de Madrid. Puedes subir RUNS_PER_DAY en Vercel solo para la verificación,
     o esperamos a mañana.

  Cuando lo tengas, lanzo eval:plan (de 4 a 8 llamadas de las 40 diarias de
  Flash) y después los dos runs de producción.

  ¿Me avisas cuando hayas hecho el vercel env pull y cambiado las variables?

❯ Como queda poco para el reset, he subido RUNS_PER_DAY a 15 temporalmente.     
  Hecho, sigue                                                                  

  Ran 1 shell command (ctrl+o to expand)

⏺ Variables en orden. Lanzo eval:plan (llamadas reales: empiezo en 0).

  Ran 1 shell command (ctrl+o to expand)

⏺ Gemini devolvió un 400 al primer intento porque gemini-3.8-flash no admite
  thinkingLevel MINIMAL; ese error no consume cuota, así que lo reintentaré con
  LOW, que será el mínimo de ese modelo. · summary

⏺ Bash(python3 - <<'EOF'
      p='src/server/llm/gemini.ts'…)
  ⎿  $ prettier --write .
           Tests  31 passed (31)
     $ eslint
  ⎿  Created src/server/llm/fixtures/gemini/error-400-thinking.json +7
      1 +{                                                               
      2 +  "error": {                                                    
      3 +    "code": 400,                                                
      4 +    "message": "Thinking level MINIMAL is not supported for this
        + model. Please retry with other thinking level.",               
      5 +    "status": "INVALID_ARGUMENT"                                
      6 +  }                                                             
      7 +}                                                               
  ⎿  Updated src/server/llm/gemini.test.ts +18
      10  } from "./gemini";
      11  import daily429 from "./fixtures/gemini/error-429-daily.json";
      12  import minute429 from "./fixtures/gemini/error-429-minute.json"
          ;
      13 +import thinking400 from "./fixtures/gemini/error-400-thinking.j
         +son";                                                          
      14  import planInfeasible from "./fixtures/gemini/plan-infeasible.j
          son";
      15  import planInvalid from "./fixtures/gemini/plan-invalid.json";
      16  import planOk from "./fixtures/gemini/plan-ok.json";
     ...
      198      expect([...t.marked]).toEqual(["flash-a", "flash-b", "lite
           "]);
      199    });
      200  
      201 +  it("falls back to LOW when the model refuses MINIMAL thinkin
          +g", async () => {                                             
      202 +    const t = setup([                                         
      203 +      new ApiError({ message: JSON.stringify(thinking400), sta
          +tus: 400 }),                                                  
      204 +      planOk,                                                 
      205 +      planOk,                                                 
      206 +    ]);                                                       
      207 +    const { calls } = await t.run();                          
      208 +    expect(calls).toHaveLength(1);                            
      209 +    expect(t.counted).toHaveLength(1);                        
      210 +    expect(                                                   
      211 +      t.requests.map((r) => r.config?.thinkingConfig?.thinking
          +Level),                                                       
      212 +    ).toEqual(["MINIMAL", "LOW"]);                            
      213 +    // Remembered for the model: the next call goes straight t
          +o LOW.                                                        
      214 +    await t.run();                                            
      215 +    expect(t.requests[2]!.config?.thinkingConfig?.thinkingLeve
          +l).toBe("LOW");                                               
      216 +  });                                                         
      217 +                                                              
      218    it("does not call the model when the budget hook refuses", a
           sync () => {
      219      const t = setup([planOk]);
      220      t.before.mockRejectedValueOnce(new Error("over budget"));
  ⎿  Updated src/server/llm/gemini.ts +43 -14
      162    };
      163  }
      164  
      165 +// --- Thinking level ---                                     
      166 +                                                              
      167 +/**                                                           
      168 + * Reasoning at the minimum the model takes (D26). Some models
          + refuse                                                       
      169 + * MINIMAL with a 400 that costs no quota; then LOW is their m
          +inimum.                                                       
      170 + */                                                           
      171 +const THINKING_LEVELS = [ThinkingLevel.MINIMAL, ThinkingLevel.
          +LOW];                                                         
      172 +                                                              
      173 +/** Lowest level each model accepted, for the life of the inst
          +ance. */                                                      
      174 +const thinkingFloor = new Map<string, number>();              
      175 +                                                              
      176 +export function isThinkingLevelRejected(error: unknown): boole
          +an {                                                          
      177 +  const e = error as { status?: unknown; message?: unknown } |
          + null;                                                        
      178 +  return e?.status === 400 && /thinking level/i.test(String(e.
          +message ?? ""));                                              
      179 +}                                                             
      180 +                                                              
      181  // --- Provider ---
      182  
      183  const responseText = (r: GeminiResponse) =>
     ...
      308      await request.hooks?.beforeCall?.();
      309      const timeout = this.options.timeoutMs ?? GEMINI_TIMEOUT_M
           S;
      310      const started = Date.now();
      295 -    const response = await this.options.generate({            
      296 -      model,                                                  
      297 -      contents,                                               
      298 -      config: {                                               
      299 -        systemInstruction: request.system,                    
      300 -        responseMimeType: "application/json",                 
      301 -        responseJsonSchema: jsonSchema,                       
      302 -        // Planning needs no long reasoning, and it keeps late
          -ncy down (D26).                                               
      303 -        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL
          - },                                                           
      304 -        // A 429 must never wait inside the function: no SDK r
          -etries.                                                       
      305 -        httpOptions: { timeout, retryOptions: { attempts: 1 } 
          -},                                                            
      306 -        abortSignal: AbortSignal.timeout(timeout),            
      307 -      },                                                      
      308 -    });                                                       
      311 +    let response: GeminiResponse | undefined;                 
     … +29 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

⏺ Gemini devuelve 503 por saturación del modelo, no por cuota, así que el
  proveedor pasa al siguiente modelo sin marcar nada como agotado; si todos
  fallan, el sweep reintenta. Lo anoto como detalle de D26. · summary

⏺ Bash(python3 - <<'EOF'
      p='src/server/llm/gemini.ts'…)
  ⎿  $ prettier --write .
           Tests  32 passed (32)
     $ eslint
  ⎿  Updated src/server/llm/gemini.test.ts +12
      182      expect([...t.marked]).toEqual(["flash-a"]);
      183    });
      184  
      185 +  it("a 503 tries the next model without marking it exhausted"
          +, async () => {                                               
      186 +    const busy = new ApiError({ message: "high demand", status
          +: 503 });                                                     
      187 +    const t = setup([busy, planOk]);                          
      188 +    const { calls } = await t.run();                          
      189 +    expect(calls.map((c) => c.model)).toEqual(["flash-b"]);   
      190 +    expect(t.marked.size).toBe(0);                            
      191 +                                                              
      192 +    // Every model busy: the step fails and the sweep retries 
          +it later.                                                     
      193 +    const all = setup([busy, busy, busy]);                    
      194 +    await expect(all.run()).rejects.toBe(busy);               
      195 +  });                                                         
      196 +                                                              
      197    it("skips models already exhausted today", async () => {
      198      const t = setup([planOk], ["flash-a", "flash-b"]);
      199      await t.run();
  ⎿  Updated src/server/llm/gemini.ts +12
      178    return e?.status === 400 && /thinking level/i.test(String(e.
           message ?? ""));
      179  }
      180  
      181 +/** Model overloaded ("high demand"): another model may answer
          + now. */                                                      
      182 +export const isOverloaded = (error: unknown) =>               
      183 +  (error as { status?: unknown } | null)?.status === 503;     
      184 +                                                              
      185  // --- Provider ---
      186  
      187  const responseText = (r: GeminiResponse) =>
     ...
      241    async generateObject<T>(request: GenerateRequest<T>): Promis
           e<Generated<T>> {
      242      const jsonSchema = toGeminiSchema(request.schema);
      243      const skipped: string[] = [];
      244 +    let overloaded: unknown = null;                           
      245      for (const model of this.options.models) {
      246        if (await this.options.quota.isExhausted(model)) {
      247          skipped.push(model);
     ...
      260          if (quota?.kind === "minute") {
      261            throw new RateLimited(model, quota.retryAfterMs);
      262          }
      263 +        if (isOverloaded(error) && model !== this.options.mode
          +ls.at(-1)) {                                                  
      264 +          // Not a quota: try the next model now, without mark
          +ing this one.                                                 
      265 +          overloaded = error;                                 
      266 +          continue;                                           
      267 +        }                                                     
      268          throw error;
      269        }
      270      }
      271 +    // The last models were out of quota but an earlier one wa
          +s only busy.                                                  
      272 +    if (overloaded) throw overloaded;                         
      273      throw new QuotaExhausted(skipped);
      274    }
      275  

⏺ Bash(git add -A && git commit -qm "fix(llm): try the next model when Gemini is
      overloaded…)
  ⎿  $ vitest run -c vitest.eval.config.ts
      RUN  v5.1.1 ~/Trabajo/pruebas-tecnicas/paradigma/crm-a
     gents
     … +16 lines (ctrl+o to expand)
  ⎿  Created docs/evals/plan-nif.json +77
       1 +{                                                              
       2 +  "request": "Añade el NIF a los clientes: se introduce en el f
         +ormulario de alta y edición y se ve en el detalle y en la lista
         +.",                                                            
       3 +  "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",       
       4 +  "plan": {                                                    
       5 +    "feasible": true,                                          
       6 +    "summary": "Se añadirá el campo NIF a la entidad de cliente
         +s. Se actualizará la base de datos, los esquemas de validación,
         + las consultas y los componentes de UI para permitir introducir
         + y editar el NIF, así como visualizarlo en la lista y en la pág
         +ina de detalle del cliente.",                                  
       7 +    "assumptions": [                                           
       8 +      "El campo NIF es opcional para mantener compatibilidad co
         +n clientes existentes sin NIF.",                               
       9 +      "No se requiere una validación de formato estricta del NI
         +F/CIF más allá de ser una cadena de texto estándar."           
      10 +    ],                                                         
      11 +    "tasks": [                                                 
      12 +      {                                                        
      13 +        "title": "Añadir columna nif a la base de datos y actua
         +lizar datos de prueba",                                        
      14 +        "description": "Añade la columna opcional `nif: text()`
         + al modelo `clients` en `src/db/schema.ts`. Genera una nueva mi
         +gración en `drizzle/0001_add_nif_to_clients.sql` y actualiza el
         + journal/meta correspondientes. Actualiza `src/db/seed.ts` para
         + asignar valores de NIF de prueba a los clientes de ejemplo.", 
      15 +        "files": [                                             
      16 +          "src/db/schema.ts",                                  
      17 +          "drizzle/0001_add_nif_to_clients.sql",               
      18 +          "drizzle/meta/_journal.json",                        
      19 +          "src/db/seed.ts"                                     
      20 +        ],                                                     
      21 +        "acceptanceCriteria": [                                
      22 +          {                                                    
      23 +            "id": "c1",                                        
      24 +            "type": "e2e",                                     
      25 +            "text": "La tabla `clients` en el esquema de base d
         +e datos incluye la columna opcional `nif`."                    
      26 +          }                                                    
      27 +        ]                                                      
      28 +      },                                                       
      29 +      {                                                        
      30 +        "title": "Actualizar esquemas de validación, consultas 
         +y acciones de clientes",                                       
      31 +        "description": "En `src/app/(crm)/clientes/validation.t
         +s`, añade `nif: z.string().optional()` al esquema Zod y a `clie
         +ntFields`. Actualiza `src/app/(crm)/clientes/queries.ts` si sel
         +ecciona columnas explícitas para asegurar que `nif` está inclui
         +do en el retorno de clientes.",                                
      32 +        "files": [                                             
      33 +          "src/app/(crm)/clientes/validation.ts",              
      34 +          "src/app/(crm)/clientes/queries.ts"                  
      35 +        ],                                                     
      36 +        "acceptanceCriteria": [                                
      37 +          {                                                    
      38 +            "id": "c2",                                        
      39 +            "type": "e2e",                                     
      40 +            "text": "El esquema de validación de clientes acept
         +a el campo opcional `nif`."                                    
     … +37 lines (ctrl+o to expand)
  ⎿  Created src/server/llm/fixtures/gemini/recorded/plan-nif.json +47
       1 +{                                                              
       2 +  "sdkHttpResponse": {                                         
       3 +    "headers": {                                               
       4 +      "alt-svc": "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=25
         +92000",                                                        
       5 +      "content-encoding": "gzip",                              
       6 +      "content-type": "application/json; charset=UTF-8",       
       7 +      "date": "Tue, 24 Nov 2026 19:39:29 GMT",                 
       8 +      "server": "scaffolding on HTTPServer2",                  
       9 +      "server-timing": "gfet4t7; dur=19413",                   
      10 +      "transfer-encoding": "chunked",                          
      11 +      "vary": "Origin, X-Origin, Referer",                     
      12 +      "x-content-type-options": "nosniff",                     
      13 +      "x-frame-options": "SAMEORIGIN",                         
      14 +      "x-gemini-service-tier": "standard",                     
      15 +      "x-xss-protection": "0"                                  
      16 +    }                                                          
      17 +  },                                                           
      18 +  "candidates": [                                              
      19 +    {                                                          
      20 +      "content": {                                             
      21 +        "parts": [                                             
      22 +          {                                                    
      23 +            "text": "{\n  \"feasible\": true,\n  \"summary\": \
         +"Se añadirá el campo NIF a la entidad de clientes. Se actualiza
         +rá la base de datos, los esquemas de validación, las consultas 
         +y los componentes de UI para permitir introducir y editar el NI
         +F, así como visualizarlo en la lista y en la página de detalle 
         +del cliente.\",\n  \"assumptions\": [\n    \"El campo NIF es op
         +cional para mantener compatibilidad con clientes existentes sin
         + NIF.\",\n    \"No se requiere una validación de formato estric
         +ta del NIF/CIF más allá de ser una cadena de texto estándar.\"\
         +n  ],\n  \"tasks\": [\n    {\n      \"title\": \"Añadir columna
         + nif a la base de datos y actualizar datos de prueba\",\n      
         +\"description\": \"Añade la columna opcional `nif: text()` al m
         +odelo `clients` en `src/db/schema.ts`. Genera una nueva migraci
         +ón en `drizzle/0001_add_nif_to_clients.sql` y actualiza el jour
         +nal/meta correspondientes. Actualiza `src/db/seed.ts` para asig
         +nar valores de NIF de prueba a los clientes de ejemplo.\",\n   
         +   \"files\": [\n        \"src/db/schema.ts\",\n        \"drizz
         +le/0001_add_nif_to_clients.sql\",\n        \"drizzle/meta/_jour
         +nal.json\",\n        \"src/db/seed.ts\"\n      ],\n      \"acce
         +ptanceCriteria\": [\n        {\n          \"id\": \"c1\",\n    
         +      \"type\": \"e2e\",\n          \"text\": \"La tabla `clien
         +ts` en el esquema de base de datos incluye la columna opcional 
         +`nif`.\"\n        }\n      ]\n    },\n    {\n      \"title\": \
         +"Actualizar esquemas de validación, consultas y acciones de cli
         +entes\",\n      \"description\": \"En `src/app/(crm)/clientes/v
         +alidation.ts`, añade `nif: z.string().optional()` al esquema Zo
         +d y a `clientFields`. Actualiza `src/app/(crm)/clientes/queries
         +.ts` si selecciona columnas explícitas para asegurar que `nif` 
         +está incluido en el retorno de clientes.\",\n      \"files\": [
         +\n        \"src/app/(crm)/clientes/validation.ts\",\n        \"
         +src/app/(crm)/clientes/queries.ts\"\n      ],\n      \"acceptan
         +ceCriteria\": [\n        {\n          \"id\": \ … [+1285 chars]
      24 +            "thoughtSignature": "Ep8BCpwBAWkUfRPu6QqNR4L9jcfumv
         +XnnenCsfowNSp8pZDIz1IYZY/SL0UiNvMviMf7O7PUpH2GPKQQtt+yrj269+4nw
         +Sk53UII7hDQNxQyKe8+AxtesRwRWpL8+qklAiVvPHgCviSKfZoFEnkulVSsil2w
         +UnZ/J8AnmOF+vSB+Yy3ksqefhN8lDfj0d6e8Kojppcx7VpcfWyzlN2njWZqz"  
      25 +          }                                                    
      26 +        ],                                                     
      27 +        "role": "model"                                        
      28 +      },                                                       
      29 +      "finishReason": "STOP",                                  
      30 +      "index": 0                                               
      31 +    }                                                          
      32 +  ],                                                           
      33 +  "modelVersion": "gemini-3.6-flash",                          
      34 +  "responseId": "3ecFa8joM5j8vdIP2a_HwA8",                     
      35 +  "usageMetadata": {                                           
      36 +    "promptTokenCount": 5057,                                  
      37 +    "candidatesTokenCount": 907,                               
      38 +    "totalTokenCount": 5964,                                   
      39 +    "promptTokensDetails": [                                   
      40 +      {                                                        
     … +7 lines (ctrl+o to expand)

⏺ nif ya tiene un plan válido de 3 tareas, usando gemini-3.6-flash porque 3.8
  estaba saturado, mientras que buscador dio un 504 de timeout. Voy a hacer que
  el proveedor trate 500, 503 y 504 como modelo no disponible para pasar al
  siguiente, y que el eval pueda reanudarse sin repetir nif. · summary

⏺ Bash(python3 - <<'EOF'
      p='src/server/llm/gemini.ts'…)
  ⎿  69:function markdown(baseSha: string, results: Result[], at: string):
     string {
     73:    `Generado el ${at} contra Gemini, con el contexto real de \`crm
     … +10 lines (ctrl+o to expand)
  ⎿  Updated scripts/eval-plan.eval.ts +15 -5
      1 -import { mkdirSync, writeFileSync } from "node:fs";             
      1 +import { existsSync, mkdirSync, readFileSync, writeFileSync } fr
        +om "node:fs";                                                   
      2  import { GoogleGenAI } from "@google/genai";
      3  import { config } from "dotenv";
      4  import { describe, expect, it } from "vitest";
     ...
      18   * pnpm eval:plan (D30): the four requests of D14 against Gemin
          i, with the
      19   * real context of crm-demo. Saves each plan in docs/evals/ and
           the raw
      20   * answers as fixtures for the Vitest suite. Spends 4 requests 
          or more of
      21 - * the daily quota: run it by hand.                            
      21 + * the daily quota: run it by hand. Requests that already have 
         +a plan are                                                     
      22 + * skipped (EVAL_FORCE=1 plans them again).                    
      23   */
      24  
      25  config({ path: [".env.local", ".env"], quiet: true });
     ...
      124      const results: Result[] = [];
      125      let requests = 0;
      126  
      126 -    for (const [i, { slug, request }] of REQUESTS.entries()) {
      127 -      if (i > 0) await sleep(PAUSE_MS);                       
      127 +    let first = true;                                         
      128 +    for (const { slug, request } of REQUESTS) {               
      129 +      const file = `docs/evals/plan-${slug}.json`;            
      130 +      if (existsSync(file) && !process.env.EVAL_FORCE) {      
      131 +        const saved = JSON.parse(readFileSync(file, "utf8")) a
          +s Result;                                                     
      132 +        results.push({ ...saved, slug });                     
      133 +        console.log(`${slug}: ya planificada, se salta`);     
      134 +        continue;                                             
      135 +      }                                                       
      136 +      if (!first) await sleep(PAUSE_MS);                      
      137 +      first = false;                                          
      138        raw = [];
      139        const input = {
      140          runId: 0,
     ...
      160        results.push({ slug, request, plan, calls });
      161  
      162        writeFileSync(
      153 -        `docs/evals/plan-${slug}.json`,                       
      163 +        file,                                                 
      164          JSON.stringify({ request, baseSha, plan, calls }, null
           , 2) + "\n",
      165        );
     … +1 line (ctrl+o to expand)
  ⎿  Updated src/server/llm/gemini.ts +7 -2
      178    return e?.status === 400 && /thinking level/i.test(String(e.
           message ?? ""));
      179  }
      180  
      181 -/** Model overloaded ("high demand"): another model may answer
          - now. */                                                      
      181 +/**                                                           
      182 + * Model unavailable on Google's side (500, 503 "high demand",
          + 504 deadline                                                 
      183 + * exceeded): another model of the list may answer now.       
      184 + */                                                           
      185  export const isOverloaded = (error: unknown) =>
      183 -  (error as { status?: unknown } | null)?.status === 503;     
      186 +  [500, 503, 504].includes(                                   
      187 +    (error as { status?: unknown } | null)?.status as number, 
      188 +  );                                                          
      189  
      190  // --- Provider ---
      191  

⏺ Bash(pnpm lint 2>&1 | tail -1; git add src scripts && git commit -qm
      "fix(llm): treat 500 and 504 from Gemini as an unavailable model…)
  ⎿  $ eslint
     $ vitest run -c vitest.eval.config.ts
      RUN  v5.1.1 ~/Trabajo/pruebas-tecnicas/paradigma/crm-a
     … +5 lines (ctrl+o to expand)
  ⎿  Created docs/evals/README.md +82
       1 +# Evals del Orquestador (`pnpm eval:plan`)                     
       2 +                                                               
       3 +Generado el 2026-11-24 contra Gemini, con el contexto real de `
         +crm-demo` en `fa884d7` (D27, D30). Cada plan está completo en s
         +u JSON.                                                        
       4 +                                                               
       5 +| Petición | Viable | Tareas | Criterios (e2e / visual) | Llama
         +das | Modelo | Tokens (entrada → salida) | Latencia |          
       6 +|---|---|---|---|---|---|---|---|                              
       7 +| [nif](plan-nif.json) | sí | 3 | 4 (3 / 1) | 1 | gemini-3.6-fl
         +ash | 5057 → 907 | 19.4 s |                                    
       8 +| [buscador](plan-buscador.json) | sí | 2 | 3 (2 / 1) | 1 | gem
         +ini-3.6-flash | 5045 → 527 | 16.4 s |                          
       9 +| [facturas-vencidas](plan-facturas-vencidas.json) | sí | 2 | 3
         + (2 / 1) | 1 | gemini-3.6-flash | 5058 → 687 | 14.7 s |        
      10 +| [contacto](plan-contacto.json) | sí | 2 | 5 (4 / 1) | 1 | gem
         +ini-3.6-flash | 5051 → 672 | 7.1 s |                           
      11 +                                                               
      12 +## nif                                                         
      13 +                                                               
      14 +> Añade el NIF a los clientes: se introduce en el formulario de
         + alta y edición y se ve en el detalle y en la lista.           
      15 +                                                               
      16 +Se añadirá el campo NIF a la entidad de clientes. Se actualizar
         +á la base de datos, los esquemas de validación, las consultas y
         + los componentes de UI para permitir introducir y editar el NIF
         +, así como visualizarlo en la lista y en la página de detalle d
         +el cliente.                                                    
      17 +                                                               
      18 +Supuestos:                                                     
      19 +- El campo NIF es opcional para mantener compatibilidad con cli
         +entes existentes sin NIF.                                      
      20 +- No se requiere una validación de formato estricta del NIF/CIF
         + más allá de ser una cadena de texto estándar.                 
      21 +                                                               
      22 +1. **Añadir columna nif a la base de datos y actualizar datos d
         +e prueba** · `src/db/schema.ts`, `drizzle/0001_add_nif_to_clien
         +ts.sql`, `drizzle/meta/_journal.json`, `src/db/seed.ts`        
      23 +   - `c1` e2e: La tabla `clients` en el esquema de base de dato
         +s incluye la columna opcional `nif`.                           
      24 +                                                               
      25 +2. **Actualizar esquemas de validación, consultas y acciones de
         + clientes** · `src/app/(crm)/clientes/validation.ts`, `src/app/
         +(crm)/clientes/queries.ts`                                     
      26 +   - `c2` e2e: El esquema de validación de clientes acepta el c
         +ampo opcional `nif`.                                           
      27 +                                                               
      28 +3. **Integrar el campo NIF en formulario, detalle y lista de cl
         +ientes** · `src/app/(crm)/clientes/client-form.tsx`, `src/app/(
         +crm)/clientes/page.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`
      29 +   - `c3` e2e: El campo de entrada para NIF está presente en el
         + formulario con data-testid field-nif.                         
      30 +   - `c4` visual: El NIF introducido se muestra correctamente e
         +n las capturas visuales de clientes y cliente-detalle.         
      31 +                                                               
      32 +## buscador                                                    
      33 +                                                               
      34 +> Añade un buscador en la lista de clientes que filtre por nomb
         +re o por email.                                                
      35 +                                                               
      36 +Se añadirá un campo de búsqueda en la lista de clientes que per
         +mitirá filtrar en tiempo real o mediante query string por el no
         +mbre o el email del cliente.                                   
      37 +                                                               
      38 +Supuestos:                                                     
      39 +- La búsqueda filtrará de forma insensible a mayúsculas/minúscu
         +las (ilike/or) coincidiendo parcialmente en nombre o email.    
      40 +- Se mantendrá el soporte con Suspense y searchParams según las
         + normas de Next.js 16 descritas en AGENTS.md.                  
     … +42 lines (ctrl+o to expand)
  ⎿  Created docs/evals/plan-buscador.json +57
       1 +{                                                              
       2 +  "request": "Añade un buscador en la lista de clientes que fil
         +tre por nombre o por email.",                                  
       3 +  "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",       
       4 +  "plan": {                                                    
       5 +    "feasible": true,                                          
       6 +    "summary": "Se añadirá un campo de búsqueda en la lista de 
         +clientes que permitirá filtrar en tiempo real o mediante query 
         +string por el nombre o el email del cliente.",                 
       7 +    "assumptions": [                                           
       8 +      "La búsqueda filtrará de forma insensible a mayúsculas/mi
         +núsculas (ilike/or) coincidiendo parcialmente en nombre o email
         +.",                                                            
       9 +      "Se mantendrá el soporte con Suspense y searchParams segú
         +n las normas de Next.js 16 descritas en AGENTS.md."            
      10 +    ],                                                         
      11 +    "tasks": [                                                 
      12 +      {                                                        
      13 +        "title": "Añadir soporte de filtrado en la consulta de 
         +clientes",                                                     
      14 +        "description": "Modificar `src/app/(crm)/clientes/queri
         +es.ts` para aceptar un parámetro de búsqueda opcional `query` q
         +ue filtre por `name` o `email` usando `ilike` o `or` en Drizzle
         +.",                                                            
      15 +        "files": [                                             
      16 +          "src/app/(crm)/clientes/queries.ts"                  
      17 +        ],                                                     
      18 +        "acceptanceCriteria": [                                
      19 +          {                                                    
      20 +            "id": "c1",                                        
      21 +            "type": "e2e",                                     
      22 +            "text": "La función `getClients` o equivalente en `
         +queries.ts` filtra la lista cuando se pasa un término de búsque
         +da."                                                           
      23 +          }                                                    
      24 +        ]                                                      
      25 +      },                                                       
      26 +      {                                                        
      27 +        "title": "Añadir el input de búsqueda en la UI de la li
         +sta de clientes",                                              
      28 +        "description": "Actualizar `src/app/(crm)/clientes/page
         +.tsx` para leer `searchParams`, pasar la búsqueda a la query y 
         +añadir un input con `data-testid=\"search-clients-input\"` en l
         +a cabecera/sección de clientes.",                              
      29 +        "files": [                                             
      30 +          "src/app/(crm)/clientes/page.tsx"                    
      31 +        ],                                                     
      32 +        "acceptanceCriteria": [                                
      33 +          {                                                    
      34 +            "id": "c2",                                        
      35 +            "type": "e2e",                                     
      36 +            "text": "El input con data-testid 'search-clients-i
         +nput' está presente en la página /clientes."                   
      37 +          },                                                   
      38 +          {                                                    
      39 +            "id": "c3",                                        
      40 +            "type": "visual",                                  
     … +17 lines (ctrl+o to expand)
  ⎿  Created docs/evals/plan-contacto.json +68
       1 +{                                                              
       2 +  "request": "Añade una página de contacto con el email y el te
         +léfono de la empresa, enlazada desde el menú.",                
       3 +  "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",       
       4 +  "plan": {                                                    
       5 +    "feasible": true,                                          
       6 +    "summary": "Se creará una nueva página de contacto dentro d
         +el CRM que mostrará el email y teléfono de la empresa, e2e e in
         +tegrada en el menú de navegación lateral/superior. También se a
         +ñadirá a la lista de capturas de Playwright.",                 
       7 +    "assumptions": [                                           
       8 +      "La información de contacto corporativa será estática en 
         +la vista de contacto (ej. contacto@empresa.com y +34 900 123 45
         +6).",                                                          
       9 +      "La ruta de la página será /contacto dentro del grupo del
         + CRM (app/(crm)/contacto/page.tsx)."                           
      10 +    ],                                                         
      11 +    "tasks": [                                                 
      12 +      {                                                        
      13 +        "title": "Añadir enlace de contacto en la navegación", 
      14 +        "description": "Modifica `src/components/nav-links.tsx`
         + para incluir la nueva ruta `/contacto` etiquetada como 'Contac
         +to' junto a Clientes, Presupuestos y Facturas.",               
      15 +        "files": [                                             
      16 +          "src/components/nav-links.tsx"                       
      17 +        ],                                                     
      18 +        "acceptanceCriteria": [                                
      19 +          {                                                    
      20 +            "id": "c1",                                        
      21 +            "type": "e2e",                                     
      22 +            "text": "El menú de navegación contiene un enlace a
         + '/contacto' con el texto 'Contacto'."                         
      23 +          }                                                    
      24 +        ]                                                      
      25 +      },                                                       
      26 +      {                                                        
      27 +        "title": "Crear página de contacto y registrarla para c
         +apturas visuales",                                             
      28 +        "description": "Crea la página `src/app/(crm)/contacto/
         +page.tsx` con un `PageHeader` (con `data-testid=\"page-title\"`
         +), email y teléfono de contacto en elementos visibles con `data
         +-testid=\"contact-email\"` y `data-testid=\"contact-phone\"`. R
         +egistra la ruta `/contacto` con el nombre 'contacto' en `e2e/pa
         +ges.ts`.",                                                     
      29 +        "files": [                                             
      30 +          "src/app/(crm)/contacto/page.tsx",                   
      31 +          "e2e/pages.ts"                                       
      32 +        ],                                                     
      33 +        "acceptanceCriteria": [                                
      34 +          {                                                    
      35 +            "id": "c2",                                        
      36 +            "type": "e2e",                                     
      37 +            "text": "La página /contacto muestra el título 'Con
         +tacto' en data-testid='page-title'."                           
      38 +          },                                                   
      39 +          {                                                    
      40 +            "id": "c3",                                        
     … +28 lines (ctrl+o to expand)
  ⎿  Created docs/evals/plan-facturas-vencidas.json +59
       1 +{                                                              
       2 +  "request": "Marca las facturas vencidas: las que siguen pendi
         +entes de pago con la fecha de vencimiento ya pasada deben desta
         +carse en la lista de facturas.",                               
       3 +  "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",       
       4 +  "plan": {                                                    
       5 +    "feasible": true,                                          
       6 +    "summary": "Se añadirá una función utilitaria para comproba
         +r si una factura está vencida y se actualizará el Badge de esta
         +do y la lista/detalle de facturas para destacar visualmente las
         + facturas pendientes cuya fecha de vencimiento haya transcurrid
         +o.",                                                           
       7 +    "assumptions": [                                           
       8 +      "Una factura se considera vencida si su estado es 'pendin
         +g' y su fecha de vencimiento (dueAt) es estrictamente anterior 
         +a la fecha actual (YYYY-MM-DD)."                               
       9 +    ],                                                         
      10 +    "tasks": [                                                 
      11 +      {                                                        
      12 +        "title": "Añadir utilidad para detectar facturas vencid
         +as y pruebas unitarias",                                       
      13 +        "description": "Crea o actualiza funciones helper en sr
         +c/lib/dates.ts para comprobar si una fecha dada en formato YYYY
         +-MM-DD es anterior al día de hoy, o para determinar si una fact
         +ura está vencida dados su estado (pending) y fecha de vencimien
         +to (dueAt). Añade tests unitarios en src/lib/dates.test.ts.",  
      14 +        "files": [                                             
      15 +          "src/lib/dates.ts",                                  
      16 +          "src/lib/dates.test.ts"                              
      17 +        ],                                                     
      18 +        "acceptanceCriteria": [                                
      19 +          {                                                    
      20 +            "id": "c1",                                        
      21 +            "type": "e2e",                                     
      22 +            "text": "Las funciones auxiliares en src/lib/dates.
         +ts devuelven true correctamente cuando la fecha de vencimiento 
         +es anterior a la fecha actual y la factura está pendiente."    
      23 +          }                                                    
      24 +        ]                                                      
      25 +      },                                                       
      26 +      {                                                        
      27 +        "title": "Actualizar StatusBadge y la lista/detalle de 
         +facturas para destacar facturas vencidas",                     
      28 +        "description": "Modifica src/components/status-badge.ts
         +x para soportar un estado visual u opción de vencida ('overdue'
         + o indicativo visual destacado, por ejemplo badge rojo/naranja 
         +con texto 'Vencida' o 'Pendiente (Vencida)'). Actualiza src/app
         +/(crm)/facturas/page.tsx y src/app/(crm)/facturas/[id]/page.tsx
         + para pasar esta condición y resaltar las filas y insignias de 
         +las facturas vencidas. Mantén intactos los data-testid existent
         +es (invoices-table, invoice-row, status-badge).",              
      29 +        "files": [                                             
      30 +          "src/components/status-badge.tsx",                   
      31 +          "src/app/(crm)/facturas/page.tsx",                   
      32 +          "src/app/(crm)/facturas/[id]/page.tsx"               
      33 +        ],                                                     
      34 +        "acceptanceCriteria": [                                
      35 +          {                                                    
      36 +            "id": "c2",                                        
      37 +            "type": "e2e",                                     
      38 +            "text": "La lista de facturas muestra un aviso o di
         +stinción visual en la fila o insignia de estado para las factur
         +as pendientes con fecha de vencimiento superada."              
      39 +          },                                                   
      40 +          {                                                    
     … +19 lines (ctrl+o to expand)
  ⎿  Created src/server/llm/fixtures/gemini/recorded/plan-buscador.json +47
       1 +{                                                              
       2 +  "sdkHttpResponse": {                                         
       3 +    "headers": {                                               
       4 +      "alt-svc": "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=25
         +92000",                                                        
       5 +      "content-encoding": "gzip",                              
       6 +      "content-type": "application/json; charset=UTF-8",       
       7 +      "date": "Tue, 24 Nov 2026 19:42:24 GMT",                 
       8 +      "server": "scaffolding on HTTPServer2",                  
       9 +      "server-timing": "gfet4t7; dur=16267",                   
      10 +      "transfer-encoding": "chunked",                          
      11 +      "vary": "Origin, X-Origin, Referer",                     
      12 +      "x-content-type-options": "nosniff",                     
      13 +      "x-frame-options": "SAMEORIGIN",                         
      14 +      "x-gemini-service-tier": "standard",                     
      15 +      "x-xss-protection": "0"                                  
      16 +    }                                                          
      17 +  },                                                           
      18 +  "candidates": [                                              
      19 +    {                                                          
      20 +      "content": {                                             
      21 +        "parts": [                                             
      22 +          {                                                    
      23 +            "text": "{\n  \"feasible\": true,\n  \"summary\": \
         +"Se añadirá un campo de búsqueda en la lista de clientes que pe
         +rmitirá filtrar en tiempo real o mediante query string por el n
         +ombre o el email del cliente.\",\n  \"assumptions\": [\n    \"L
         +a búsqueda filtrará de forma insensible a mayúsculas/minúsculas
         + (ilike/or) coincidiendo parcialmente en nombre o email.\",\n  
         +  \"Se mantendrá el soporte con Suspense y searchParams según l
         +as normas de Next.js 16 descritas en AGENTS.md.\"\n  ],\n  \"ta
         +sks\": [\n    {\n      \"title\": \"Añadir soporte de filtrado 
         +en la consulta de clientes\",\n      \"description\": \"Modific
         +ar `src/app/(crm)/clientes/queries.ts` para aceptar un parámetr
         +o de búsqueda opcional `query` que filtre por `name` o `email` 
         +usando `ilike` o `or` en Drizzle.\",\n      \"files\": [\n     
         +   \"src/app/(crm)/clientes/queries.ts\"\n      ],\n      \"acc
         +eptanceCriteria\": [\n        {\n          \"id\": \"c1\",\n   
         +       \"type\": \"e2e\",\n          \"text\": \"La función `ge
         +tClients` o equivalente en `queries.ts` filtra la lista cuando 
         +se pasa un término de búsqueda.\"\n        }\n      ]\n    },\n
         +    {\n      \"title\": \"Añadir el input de búsqueda en la UI 
         +de la lista de clientes\",\n      \"description\": \"Actualizar
         + `src/app/(crm)/clientes/page.tsx` para leer `searchParams`, pa
         +sar la búsqueda a la query y añadir un input con `data-testid=\
         +\\"search-clients-input\\\"` en la cabecera/sección de clientes
         +.\",\n      \"files\": [\n        \"src/app/(crm)/clientes/page
         +.tsx\"\n      ],\n      \"acceptanceCriteria\": [\n        {\n 
         +         \"id\": \"c2\",\n          \"type\": \"e2e\",\n       
         +   \"text\": \"El input con data-testid 'search-clients-input' 
         +está presente en la página /clientes.\"\n        },\n        {\
         +n          \"id\": \"c3\",\n          \"type\": \"visual\",\n  
         +        \"text\": \"La página 'clientes' muestra correctamente 
         +el buscador a 1280 px y 390 px.\"\n        }\n      ]\n    }\n 
         + ]\n}",                                                        
      24 +            "thoughtSignature": "Ep8BCpwBAWkUfRPKMKS9YiQjEwLZLK
         +QLCw1rugEipGfxR8JaJeZxBhJv4qgjxPmxAmAReYY3bU0R3DFIYs15Wl9kRWfjp
         +izXB5lz/nCblbmfaNg067SKI4i2iXmaNohk7adw0GJcayOJd1lIvYjiD+gt5fVT
         +F46iFOkboLlsl7D8+I1DBZMkk2q5xUuZIGVJJwQ5shCekCAeASV8O2yJYbjV"  
      25 +          }                                                    
      26 +        ],                                                     
      27 +        "role": "model"                                        
      28 +      },                                                       
      29 +      "finishReason": "STOP",                                  
      30 +      "index": 0                                               
      31 +    }                                                          
      32 +  ],                                                           
      33 +  "modelVersion": "gemini-3.6-flash",                          
      34 +  "responseId": "kOgFa7mAGau6nsEPnrnmyQk",                     
      35 +  "usageMetadata": {                                           
      36 +    "promptTokenCount": 5045,                                  
      37 +    "candidatesTokenCount": 527,                               
      38 +    "totalTokenCount": 5572,                                   
      39 +    "promptTokensDetails": [                                   
      40 +      {                                                        
     … +7 lines (ctrl+o to expand)
  ⎿  … +2 files changed
     src/server/llm/fixtures/gemini/recorded/plan-contacto.json
     src/server/llm/fixtures/gemini/recorded/plan-facturas-vencidas.json

  Listed 1 directory (ctrl+o to expand)

⏺ Las cuatro peticiones ya devolvieron planes válidos, cada una con una sola
  llamada y todas atendidas por gemini-3.6-flash, ya que 3.8 estaba saturado.
  Ahora reviso que esos planes sean realmente comprobables antes de dar por
  cumplido el criterio 1. · summary

  Searched for 1 pattern, ran 1 shell command (ctrl+o to expand)

⏺ Los archivos previstos son correctos, pero tres planes tienen criterios que no
  se pueden comprobar en la vista previa, así que ajusto el prompt y repito el
  eval. · summary

⏺ Bash(python3 - <<'EOF'
      p='src/server/agents/prompts/orchestrator.ts'…)
  ⎿  $ prettier --write .
           Tests  27 passed (27)
      Test Files  1 passed (1)
           Tests  1 passed (1)
  ⎿  Updated docs/evals/README.md +38 -41
       4  
       5  | Petición | Viable | Tareas | Criterios (e2e / visual) | Llama
          das | Modelo | Tokens (entrada → salida) | Latencia |
       6  |---|---|---|---|---|---|---|---|
       7 -| [nif](plan-nif.json) | sí | 3 | 4 (3 / 1) | 1 | gemini-3.6-fl
         -ash | 5057 → 907 | 19.4 s |                                    
       8 -| [buscador](plan-buscador.json) | sí | 2 | 3 (2 / 1) | 1 | gem
         -ini-3.6-flash | 5045 → 527 | 16.4 s |                          
       9 -| [facturas-vencidas](plan-facturas-vencidas.json) | sí | 2 | 3
         - (2 / 1) | 1 | gemini-3.6-flash | 5058 → 687 | 14.7 s |        
      10 -| [contacto](plan-contacto.json) | sí | 2 | 5 (4 / 1) | 1 | gem
         -ini-3.6-flash | 5051 → 672 | 7.1 s |                           
       7 +| [nif](plan-nif.json) | sí | 2 | 4 (3 / 1) | 1 | gemini-3.6-fl
         +ash | 5144 → 865 | 5.0 s |                                     
       8 +| [buscador](plan-buscador.json) | sí | 2 | 3 (2 / 1) | 1 | gem
         +ini-3.6-flash | 5132 → 694 | 20.6 s |                          
       9 +| [facturas-vencidas](plan-facturas-vencidas.json) | sí | 1 | 2
         + (1 / 1) | 1 | gemini-3.6-flash | 5145 → 547 | 9.3 s |         
      10 +| [contacto](plan-contacto.json) | sí | 2 | 4 (3 / 1) | 1 | gem
         +ini-3.6-flash | 5138 → 619 | 18.1 s |                          
      11  
      12  ## nif
      13  
      14  > Añade el NIF a los clientes: se introduce en el formulario de
           alta y edición y se ve en el detalle y en la lista.
      15  
      16 -Se añadirá el campo NIF a la entidad de clientes. Se actualizar
         -á la base de datos, los esquemas de validación, las consultas y
         - los componentes de UI para permitir introducir y editar el NIF
         -, así como visualizarlo en la lista y en la página de detalle d
         -el cliente.                                                    
      16 +Se añadirá el campo NIF (nif) a la entidad de clientes. Estará 
         +disponible en el formulario de alta y edición, en la vista de d
         +etalle del cliente y en la tabla del listado de clientes.      
      17  
      18  Supuestos:
      19 -- El campo NIF es opcional para mantener compatibilidad con cli
         -entes existentes sin NIF.                                      
      20 -- No se requiere una validación de formato estricta del NIF/CIF
         - más allá de ser una cadena de texto estándar.                 
      19 +- El campo NIF será opcional (texto) para permitir clientes sin
         + NIF asignado o con datos incompletos.                         
      20 +- El campo se colocará visible en el formulario como field-nif 
         +y en el listado/detalle como data-testid client-nif o dentro de
         + las columnas existentes.                                      
      21  
      22 -1. **Añadir columna nif a la base de datos y actualizar datos d
         -e prueba** · `src/db/schema.ts`, `drizzle/0001_add_nif_to_clien
         -ts.sql`, `drizzle/meta/_journal.json`, `src/db/seed.ts`        
      23 -   - `c1` e2e: La tabla `clients` en el esquema de base de dato
         -s incluye la columna opcional `nif`.                           
      22 +1. **Añadir columna NIF al esquema de base de datos y migración
         +** · `src/db/schema.ts`, `drizzle/0001_add_client_nif.sql`, `dr
         +izzle/meta/_journal.json`, `drizzle/meta/0001_snapshot.json`, `
         +src/db/seed.ts`                                                
      23 +   - `c1` e2e: La vista previa compila y la ruta /clientes carg
         +a correctamente mostrando la tabla clients-table.              
      24  
      25 -2. **Actualizar esquemas de validación, consultas y acciones de
         - clientes** · `src/app/(crm)/clientes/validation.ts`, `src/app/
         -(crm)/clientes/queries.ts`                                     
      26 -   - `c2` e2e: El esquema de validación de clientes acepta el c
         -ampo opcional `nif`.                                           
      27 -                                                               
      28 -3. **Integrar el campo NIF en formulario, detalle y lista de cl
         -ientes** · `src/app/(crm)/clientes/client-form.tsx`, `src/app/(
         -crm)/clientes/page.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`
      29 -   - `c3` e2e: El campo de entrada para NIF está presente en el
         - formulario con data-testid field-nif.                         
      30 -   - `c4` visual: El NIF introducido se muestra correctamente e
         -n las capturas visuales de clientes y cliente-detalle.         
      25 +2. **Actualizar validación, consultas y UI del cliente con NIF*
         +* · `src/app/(crm)/clientes/validation.ts`, `src/app/(crm)/clie
         +ntes/queries.ts`, `src/app/(crm)/clientes/client-form.tsx`, `sr
         +c/app/(crm)/clientes/page.tsx`, `src/app/(crm)/clientes/[id]/pa
         +ge.tsx`, `src/app/(crm)/clientes/[id]/editar/page.tsx`         
      26 +   - `c2` e2e: En /clientes/nuevo, el formulario client-form co
         +ntiene el campo con data-testid field-nif.                     
      27 +   - `c3` e2e: En /clientes, la tabla clients-table incluye el 
         +encabezado NIF.                                                
      28 +   - `c4` visual: En las capturas de clientes y cliente-detalle
         +, el campo NIF se visualiza correctamente formateado.          
     … +77 lines (ctrl+o to expand)
  ⎿  Updated docs/evals/plan-buscador.json +16 -14
       3    "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",
       4    "plan": {
       5      "feasible": true,
       6 -    "summary": "Se añadirá un campo de búsqueda en la lista de 
         -clientes que permitirá filtrar en tiempo real o mediante query 
         -string por el nombre o el email del cliente.",                 
       6 +    "summary": "Se añadirá un campo de búsqueda en la página pr
         +incipal de clientes (`/clientes`) que permitirá filtrar en tiem
         +po real o mediante query string por el nombre o el correo elect
         +rónico del cliente.",                                          
       7      "assumptions": [
       8 -      "La búsqueda filtrará de forma insensible a mayúsculas/mi
         -núsculas (ilike/or) coincidiendo parcialmente en nombre o email
         -.",                                                            
       9 -      "Se mantendrá el soporte con Suspense y searchParams segú
         -n las normas de Next.js 16 descritas en AGENTS.md."            
       8 +      "El término de búsqueda se pasará a través del parámetro 
         +de consulta `q` en la URL de `/clientes` para permitir navegaci
         +ón por SSR y refresco adecuado bajo React Server Components y S
         +uspense.",                                                     
       9 +      "El filtro buscará coincidencias parciales sin distinción
         + entre mayúsculas y minúsculas (ilike/or) tanto en el nombre co
         +mo en el email del cliente.",                                  
      10 +      "Se usará un input con `data-testid=\"search-input\"` par
         +a permitir la introducción de texto en la vista de clientes."  
      11      ],
      12      "tasks": [
      13        {
      13 -        "title": "Añadir soporte de filtrado en la consulta de 
         -clientes",                                                     
      14 -        "description": "Modificar `src/app/(crm)/clientes/queri
         -es.ts` para aceptar un parámetro de búsqueda opcional `query` q
         -ue filtre por `name` o `email` usando `ilike` o `or` en Drizzle
         -.",                                                            
      14 +        "title": "Añadir filtrado por término de búsqueda en la
         + consulta de clientes",                                        
      15 +        "description": "Actualizar `src/app/(crm)/clientes/quer
         +ies.ts` para aceptar un parámetro opcional de búsqueda `query?:
         + string`. Si `query` existe y no está vacío, filtrar con Drizzl
         +e utilizando `or(ilike(clients.name, `%${query}%`), ilike(clien
         +ts.email, `%${query}%`))`. En `src/app/(crm)/clientes/page.tsx`
         +, recibir `searchParams`, obtener el parámetro `q` dentro de Su
         +spense y pasarlo a `getClients(query)`.",                      
      16          "files": [
      16 -          "src/app/(crm)/clientes/queries.ts"                  
      17 +          "src/app/(crm)/clientes/queries.ts",                 
      18 +          "src/app/(crm)/clientes/page.tsx"                    
      19          ],
      20          "acceptanceCriteria": [
      21            {
      22              "id": "c1",
      23              "type": "e2e",
      22 -            "text": "La función `getClients` o equivalente en `
         -queries.ts` filtra la lista cuando se pasa un término de búsque
         -da."                                                           
      24 +            "text": "La vista de clientes `/clientes` carga cor
         +rectamente y muestra la tabla con `data-testid=\"clients-table\
         +"`."                                                           
      25            }
      26          ]
      27        },
      28        {
      27 -        "title": "Añadir el input de búsqueda en la UI de la li
         -sta de clientes",                                              
      28 -        "description": "Actualizar `src/app/(crm)/clientes/page
         -.tsx` para leer `searchParams`, pasar la búsqueda a la query y 
         -añadir un input con `data-testid=\"search-clients-input\"` en l
         -a cabecera/sección de clientes.",                              
      29 +        "title": "Añadir componente input de búsqueda en la lis
         +ta de clientes",                                               
      30 +        "description": "Crear o actualizar la interfaz en `src/
         +app/(crm)/clientes/page.tsx` (o mediante un componente cliente 
         +auxiliar si fuera necesario) para incluir un formulario o input
         + de búsqueda con `data-testid=\"search-input\"` y `name=\"q\"`.
         + Al cambiar el valor o enviar, debe actualizar la URL `/cliente
         +s?q=...` para filtrar los resultados de la tabla.",            
      31          "files": [
      32            "src/app/(crm)/clientes/page.tsx"
      33          ],
     … +26 lines (ctrl+o to expand)
  ⎿  Updated docs/evals/plan-contacto.json +14 -19
       3    "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",
       4    "plan": {
       5      "feasible": true,
       6 -    "summary": "Se creará una nueva página de contacto dentro d
         -el CRM que mostrará el email y teléfono de la empresa, e2e e in
         -tegrada en el menú de navegación lateral/superior. También se a
         -ñadirá a la lista de capturas de Playwright.",                 
       6 +    "summary": "Se creará una nueva página de contacto accesibl
         +e desde el menú principal de navegación con la información de c
         +ontacto (email y teléfono) de la empresa. Se actualizarán los e
         +nlaces de navegación del CRM y la lista de capturas para las pr
         +uebas de UI.",                                                 
       7      "assumptions": [
       8 -      "La información de contacto corporativa será estática en 
         -la vista de contacto (ej. contacto@empresa.com y +34 900 123 45
         -6).",                                                          
       9 -      "La ruta de la página será /contacto dentro del grupo del
         - CRM (app/(crm)/contacto/page.tsx)."                           
       8 +      "La información de contacto mostrará valores descriptivos
         + estándar como contacto@ejemplo.com y +34 900 000 000.",       
       9 +      "La nueva página se ubicará en la ruta /contacto dentro d
         +el layout principal del CRM."                                  
      10      ],
      11      "tasks": [
      12        {
      13 -        "title": "Añadir enlace de contacto en la navegación", 
      14 -        "description": "Modifica `src/components/nav-links.tsx`
         - para incluir la nueva ruta `/contacto` etiquetada como 'Contac
         -to' junto a Clientes, Presupuestos y Facturas.",               
      13 +        "title": "Añadir enlace de contacto a la barra de naveg
         +ación",                                                        
      14 +        "description": "Modifica `src/components/nav-links.tsx`
         + para incluir una opción de navegación nueva etiquetada como 'C
         +ontacto' hacia la ruta `/contacto`.",                          
      15          "files": [
      16            "src/components/nav-links.tsx"
      17          ],
     ...
      19            {
      20              "id": "c1",
      21              "type": "e2e",
      22 -            "text": "El menú de navegación contiene un enlace a
         - '/contacto' con el texto 'Contacto'."                         
      22 +            "text": "En la barra de navegación de `/clientes` s
         +e visualiza el enlace 'Contacto' que apunta a `/contacto`."    
      23            }
      24          ]
      25        },
      26        {
      27 -        "title": "Crear página de contacto y registrarla para c
         -apturas visuales",                                             
      28 -        "description": "Crea la página `src/app/(crm)/contacto/
         -page.tsx` con un `PageHeader` (con `data-testid=\"page-title\"`
         -), email y teléfono de contacto en elementos visibles con `data
         --testid=\"contact-email\"` y `data-testid=\"contact-phone\"`. R
         -egistra la ruta `/contacto` con el nombre 'contacto' en `e2e/pa
         -ges.ts`.",                                                     
      27 +        "title": "Crear página de contacto y registrar en captu
         +ras e2e",                                                      
      28 +        "description": "Crea la página `src/app/(crm)/contacto/
         +page.tsx` utilizando `PageHeader` con el título `page-title` 'C
         +ontacto' y muestra los datos de email (`contact-email`) y teléf
         +ono (`contact-phone`). Registra la ruta en `e2e/pages.ts` para 
         +capturas de pantalla.",                                        
      29          "files": [
      30            "src/app/(crm)/contacto/page.tsx",
      31            "e2e/pages.ts"
     ...
      34            {
      35              "id": "c2",
      36              "type": "e2e",
      37 -            "text": "La página /contacto muestra el título 'Con
         -tacto' en data-testid='page-title'."                           
     … +33 lines (ctrl+o to expand)
  ⎿  Updated docs/evals/plan-facturas-vencidas.json +14 -27
       3    "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",
       4    "plan": {
       5      "feasible": true,
       6 -    "summary": "Se añadirá una función utilitaria para comproba
         -r si una factura está vencida y se actualizará el Badge de esta
         -do y la lista/detalle de facturas para destacar visualmente las
         - facturas pendientes cuya fecha de vencimiento haya transcurrid
         -o.",                                                           
       6 +    "summary": "Se añadirá una utilidad para comprobar si una f
         +actura está vencida (estado pendiente y fecha de vencimiento pr
         +evia a la fecha actual) y se actualizará la lista de facturas p
         +ara marcar visualmente las facturas vencidas con un distintivo 
         +o texto de aviso.",                                            
       7      "assumptions": [
       8 -      "Una factura se considera vencida si su estado es 'pendin
         -g' y su fecha de vencimiento (dueAt) es estrictamente anterior 
         -a la fecha actual (YYYY-MM-DD)."                               
       8 +      "Una factura se considera vencida cuando su estado es 'pe
         +nding' y su fecha 'dueAt' es estrictamente anterior a la fecha 
         +actual (YYYY-MM-DD en la zona horaria local/servidor).",       
       9 +      "Las facturas con estado 'paid' nunca se marcarán como ve
         +ncidas.",                                                      
      10 +      "El distintivo o etiqueta de vencida aparecerá junto al e
         +stado o fecha en la tabla de la lista de facturas sin alterar l
         +a estructura básica de los elementos existentes."              
      11      ],
      12      "tasks": [
      13        {
      12 -        "title": "Añadir utilidad para detectar facturas vencid
         -as y pruebas unitarias",                                       
      13 -        "description": "Crea o actualiza funciones helper en sr
         -c/lib/dates.ts para comprobar si una fecha dada en formato YYYY
         --MM-DD es anterior al día de hoy, o para determinar si una fact
         -ura está vencida dados su estado (pending) y fecha de vencimien
         -to (dueAt). Añade tests unitarios en src/lib/dates.test.ts.",  
      14 +        "title": "Añadir función para calcular estado de vencim
         +iento e integrarla en la interfaz de facturas",                
      15 +        "description": "Crea o amplía una función en `src/lib/d
         +ates.ts` (o `src/lib/status.ts`) que determine si una fecha `YY
         +YY-MM-DD` está vencida respecto a hoy cuando la factura está en
         + estado `pending`. Luego modifica `src/app/(crm)/facturas/page.
         +tsx` para mostrar un distintivo o indicador 'Vencida' (usando `
         +<StatusBadge>` o un badge de advertencia rojo/naranja) en las f
         +ilas de la tabla `invoices-table` cuyas facturas cumplan dicha 
         +condición. Añade los tests unitarios correspondientes en `src/l
         +ib/dates.test.ts` si aplica.",                                 
      16          "files": [
      17            "src/lib/dates.ts",
      16 -          "src/lib/dates.test.ts"                              
      18 +          "src/lib/dates.test.ts",                             
      19 +          "src/app/(crm)/facturas/page.tsx"                    
      20          ],
      21          "acceptanceCriteria": [
      22            {
      23              "id": "c1",
      24              "type": "e2e",
      22 -            "text": "Las funciones auxiliares en src/lib/dates.
         -ts devuelven true correctamente cuando la fecha de vencimiento 
         -es anterior a la fecha actual y la factura está pendiente."    
      23 -          }                                                    
      24 -        ]                                                      
      25 -      },                                                       
      26 -      {                                                        
      27 -        "title": "Actualizar StatusBadge y la lista/detalle de 
         -facturas para destacar facturas vencidas",                     
      28 -        "description": "Modifica src/components/status-badge.ts
         -x para soportar un estado visual u opción de vencida ('overdue'
         - o indicativo visual destacado, por ejemplo badge rojo/naranja 
         -con texto 'Vencida' o 'Pendiente (Vencida)'). Actualiza src/app
         -/(crm)/facturas/page.tsx y src/app/(crm)/facturas/[id]/page.tsx
         - para pasar esta condición y resaltar las filas y insignias de 
         -las facturas vencidas. Mantén intactos los data-testid existent
         -es (invoices-table, invoice-row, status-badge).",              
      29 -        "files": [                                             
      30 -          "src/components/status-badge.tsx",                   
      31 -          "src/app/(crm)/facturas/page.tsx",                   
      32 -          "src/app/(crm)/facturas/[id]/page.tsx"               
      33 -        ],                                                     
      34 -        "acceptanceCriteria": [                                
     … +27 lines (ctrl+o to expand)
  ⎿  Updated docs/evals/plan-nif.json +22 -28
       3    "baseSha": "fa884d7c22a43c5e545ef987c478b5df6dce9abe",
       4    "plan": {
       5      "feasible": true,
       6 -    "summary": "Se añadirá el campo NIF a la entidad de cliente
         -s. Se actualizará la base de datos, los esquemas de validación,
         - las consultas y los componentes de UI para permitir introducir
         - y editar el NIF, así como visualizarlo en la lista y en la pág
         -ina de detalle del cliente.",                                  
       6 +    "summary": "Se añadirá el campo NIF (nif) a la entidad de c
         +lientes. Estará disponible en el formulario de alta y edición, 
         +en la vista de detalle del cliente y en la tabla del listado de
         + clientes.",                                                   
       7      "assumptions": [
       8 -      "El campo NIF es opcional para mantener compatibilidad co
         -n clientes existentes sin NIF.",                               
       9 -      "No se requiere una validación de formato estricta del NI
         -F/CIF más allá de ser una cadena de texto estándar."           
       8 +      "El campo NIF será opcional (texto) para permitir cliente
         +s sin NIF asignado o con datos incompletos.",                  
       9 +      "El campo se colocará visible en el formulario como field
         +-nif y en el listado/detalle como data-testid client-nif o dent
         +ro de las columnas existentes."                                
      10      ],
      11      "tasks": [
      12        {
      13 -        "title": "Añadir columna nif a la base de datos y actua
         -lizar datos de prueba",                                        
      14 -        "description": "Añade la columna opcional `nif: text()`
         - al modelo `clients` en `src/db/schema.ts`. Genera una nueva mi
         -gración en `drizzle/0001_add_nif_to_clients.sql` y actualiza el
         - journal/meta correspondientes. Actualiza `src/db/seed.ts` para
         - asignar valores de NIF de prueba a los clientes de ejemplo.", 
      13 +        "title": "Añadir columna NIF al esquema de base de dato
         +s y migración",                                                
      14 +        "description": "Añade la columna opcional `nif: text()`
         + a la tabla `clients` en `src/db/schema.ts`. Genera una nueva m
         +igración SQL en `drizzle/0001_add_client_nif.sql` (o la secuenc
         +ia equivalente) y actualiza `src/db/seed.ts` para asignar NIFs 
         +de prueba a los clientes del seed.",                           
      15          "files": [
      16            "src/db/schema.ts",
      17 -          "drizzle/0001_add_nif_to_clients.sql",               
      17 +          "drizzle/0001_add_client_nif.sql",                   
      18            "drizzle/meta/_journal.json",
      19 +          "drizzle/meta/0001_snapshot.json",                   
      20            "src/db/seed.ts"
      21          ],
      22          "acceptanceCriteria": [
      23            {
      24              "id": "c1",
      25              "type": "e2e",
      25 -            "text": "La tabla `clients` en el esquema de base d
         -e datos incluye la columna opcional `nif`."                    
      26 +            "text": "La vista previa compila y la ruta /cliente
         +s carga correctamente mostrando la tabla clients-table."       
      27            }
      28          ]
      29        },
      30        {
      30 -        "title": "Actualizar esquemas de validación, consultas 
         -y acciones de clientes",                                       
      31 -        "description": "En `src/app/(crm)/clientes/validation.t
         -s`, añade `nif: z.string().optional()` al esquema Zod y a `clie
         -ntFields`. Actualiza `src/app/(crm)/clientes/queries.ts` si sel
         -ecciona columnas explícitas para asegurar que `nif` está inclui
         -do en el retorno de clientes.",                                
      31 +        "title": "Actualizar validación, consultas y UI del cli
         +ente con NIF",                                                 
      32 +        "description": "En `src/app/(crm)/clientes/validation.t
         +s`, añade el campo `nif` (opcional/string) al esquema de Zod y 
         +a la lista de campos `clientFields`. En `src/app/(crm)/clientes
         +/queries.ts`, asegúrate de incluir el campo `nif` en las lectur
         +as si se especifican columnas. En `client-form.tsx`, añade un c
         +ampo `Field` con `name=\"nif\"` y la etiqueta correspondiente. 
         +En `src/app/(crm)/clientes/page.tsx` (lista) y `src/app/(crm)/c
         +lientes/[id]/page.tsx` (detalle), muestra la columna o dato NIF
         + del cliente usando los componentes y data-testid existentes.",
      33          "files": [
     … +53 lines (ctrl+o to expand)
  ⎿  … +6 files changed
     src/server/agents/prompts/orchestrator.test.ts
     src/server/agents/prompts/orchestrator.ts
     src/server/llm/fixtures/gemini/recorded/plan-buscador.json
     +3 more

  Ran 1 shell command (ctrl+o to expand)

⏺ Ahora todos los criterios se comprueban en la vista previa. Llamadas
  respondidas por Gemini: 8 en total, todas de gemini-3.6-flash. Añado un test
  que valida las respuestas grabadas y hago commit.

⏺ Bash(cat >> src/server/llm/gemini.test.ts <<'EOF'…)
  ⎿  $ prettier --write .
           Tests  199 passed (199)
     $ eslint
     … +2 lines (ctrl+o to expand)
  ⎿  Updated docs/evals/plan-buscador.json +1 -3
      28        {
      29          "title": "Añadir componente input de búsqueda en la lis
          ta de clientes",
      30          "description": "Crear o actualizar la interfaz en `src/
          app/(crm)/clientes/page.tsx` (o mediante un componente cliente 
          auxiliar si fuera necesario) para incluir un formulario o input
           de búsqueda con `data-testid=\"search-input\"` y `name=\"q\"`.
           Al cambiar el valor o enviar, debe actualizar la URL `/cliente
          s?q=...` para filtrar los resultados de la tabla.",
      31 -        "files": [                                             
      32 -          "src/app/(crm)/clientes/page.tsx"                    
      33 -        ],                                                     
      31 +        "files": ["src/app/(crm)/clientes/page.tsx"],          
      32          "acceptanceCriteria": [
      33            {
      34              "id": "c2",
  ⎿  Updated docs/evals/plan-contacto.json +2 -7
      12        {
      13          "title": "Añadir enlace de contacto a la barra de naveg
          ación",
      14          "description": "Modifica `src/components/nav-links.tsx`
           para incluir una opción de navegación nueva etiquetada como 'C
          ontacto' hacia la ruta `/contacto`.",
      15 -        "files": [                                             
      16 -          "src/components/nav-links.tsx"                       
      17 -        ],                                                     
      15 +        "files": ["src/components/nav-links.tsx"],             
      16          "acceptanceCriteria": [
      17            {
      18              "id": "c1",
     ...
      24        {
      25          "title": "Crear página de contacto y registrar en captu
          ras e2e",
      26          "description": "Crea la página `src/app/(crm)/contacto/
          page.tsx` utilizando `PageHeader` con el título `page-title` 'C
          ontacto' y muestra los datos de email (`contact-email`) y teléf
          ono (`contact-phone`). Registra la ruta en `e2e/pages.ts` para 
          capturas de pantalla.",
      29 -        "files": [                                             
      30 -          "src/app/(crm)/contacto/page.tsx",                   
      31 -          "e2e/pages.ts"                                       
      32 -        ],                                                     
      27 +        "files": ["src/app/(crm)/contacto/page.tsx", "e2e/pages
         +.ts"],                                                         
      28          "acceptanceCriteria": [
      29            {
      30              "id": "c2",
  ⎿  Updated src/server/llm/gemini.test.ts +18
      234      expect(t.requests).toHaveLength(0);
      235    });
      236  });
      237 +                                                              
      238 +describe("recorded answers of pnpm eval:plan (D30)", () => {  
      239 +  const recorded = import.meta.glob<GeminiResponse>(          
      240 +    "./fixtures/gemini/recorded/*.json",                      
      241 +    { eager: true, import: "default" },                       
      242 +  );                                                          
      243 +                                                              
      244 +  it.each(Object.entries(recorded))(                          
      245 +    "%s parses as a feasible plan",                           
      246 +    async (_, r) => {                                         
      247 +      const t = setup([r]);                                   
      248 +      const { output } = await t.run();                       
      249 +      expect(output.feasible).toBe(true);                     
      250 +      expect(output.tasks.length).toBeGreaterThanOrEqual(1);  
      251 +      expect(output.tasks.length).toBeLessThanOrEqual(4);     
      252 +    },                                                        
      253 +  );                                                          
      254 +});                                                           

  Called ccd_turn, claude-in-chrome 4 times, ran 1 shell command (ctrl+o to expand)

⏺ Ya tengo la sesión iniciada en el panel; ahora lanzo el run A con los
  criterios 2, 4 y 5 y la caída simulada tras planificar. · summary

  Called claude-in-chrome 7 times (ctrl+o to expand)

⏺ La página guarda la vista anterior en el DOM (<Activity>), así que leo el
  estado del run en Neon, en solo lectura.
  Ran 5 shell commands · 1 failed (ctrl+o to expand)

⏺ La llamada de planificación ya respondió con 892 tokens de salida, y la caída
  simulada ocurrió justo después de guardar el plan. El lease vence a las
  19:50:36 UTC, así que el sweep reanudará el paso sin volver a llamar a Gemini.
  · summary

  Ran 1 shell command (ctrl+o to expand)

⏺ El sweep no se ha disparado: seguramente la pestaña de Chrome no está visible,
  y el polling solo corre con la pestaña visible (D22). Recargo la página y
  miro.

  Called claude-in-chrome 3 times, ran 1 shell command (ctrl+o to expand)

⏺ El criterio 4 ya se cumple: tras la caída el sweep reanudó y el plan salió de
  caché sin nueva llamada a Gemini, con 9 llamadas respondidas en total. Ahora
  rechazo el plan con feedback para el criterio 2. · summary

  Called claude-in-chrome 3 times, ran 1 shell command (ctrl+o to expand)

⏺ La revisión 2 ya está y recoge el feedback («de carácter obligatorio»).
  Compruebo que también incluye la validación del formato.

  Ran 1 shell command (ctrl+o to expand)

⏺ Revisión 2 incorpora todo el feedback: NIF obligatorio, la regex nueva y seeds
  con NIF válidos. Aviso: la nota para H5 pide a Develop ejecutar pnpm 
  db:generate, algo que Develop no puede hacer, así que lo corrijo antes de
  aprobar el plan. · summary

  Called claude-in-chrome 4 times, ran 1 shell command (ctrl+o to expand)

⏺ Run A en awaiting_preview: rama run/11 con un commit por tarea y PR #9.
  Mientras Vercel compila, dejo en cola el run B (criterio 3, fuera de alcance).

  Called claude-in-chrome 5 times, ran 1 shell command (ctrl+o to expand)

⏺ Run #12 está en cola; mientras compila la vista previa del run A, corrijo una
  tarjeta «Plan · revisión 2» que seguía mostrando el resumen de la revisión 1
  durante la replanificación. · summary

⏺ Bash(python3 - <<'EOF'
      p='src/app/runs/[id]/page.tsx'…)
  ⎿  $ prettier --write .
     $ eslint
     5394096 fix(ui): hide the previous plan while the orchestrator replans
  ⎿  Updated src/app/runs/[id]/page.tsx +11
      140  
      141  function Plan({ detail }: { detail: RunDetail }) {
      142    const { run, tasks } = detail;
      143 +  if (run.status === "planning") {                            
      144 +    // The stored summary still belongs to the previous revisi
          +on.                                                           
      145 +    return (                                                  
      146 +      <section className="card" data-testid="run-plan">       
      147 +        <h2>Plan · revisión {run.planRevision}</h2>           
      148 +        <p className="muted">                                 
      149 +          El Orquestador está preparando la revisión {run.plan
          +Revision}.                                                    
      150 +        </p>                                                  
      151 +      </section>                                              
      152 +    );                                                        
      153 +  }                                                           
      154    if (!run.planSummary && tasks.length === 0) return null;
      155    const assumptions = run.planAssumptions ?? [];
      156    return (

  Ran 1 shell command (ctrl+o to expand)

⏺ Vista previa y E2E reales en verde (24 pasan) y Testing simulado aprueba las
  dos tareas. Apruebo la vista previa final para que se fusione.

  Called claude-in-chrome 3 times, ran 1 shell command (ctrl+o to expand)

⏺ Los cinco criterios ya están cubiertos en producción. Compruebo que run/12 no
  tiene rama ni PR y que la línea de tiempo muestra las métricas.

  Called claude-in-chrome 4 times, ran 1 shell command (ctrl+o to expand)

⏺ Los cinco criterios están comprobados en producción y la línea de tiempo
  muestra modelo, tokens y latencia de cada llamada. Paso a la documentación.

  Called ccd_turn (ctrl+o to expand)

⏺ Bash(cp "~/.claude/projects/-Users-USER-Trabajo-pruebas-te
      cnicas-paradigma-crm-agents/9d943018-b296-4ae8-ada9-2a949b14a838/tool-resu
      lts/mcp-claud…)
  ⎿  # Proceso

     Cómo se ha construido este proyecto, sesión a sesión.
     … +102 lines (ctrl+o to expand)
  ⎿  1 file changed (binary, mode only or too large to show)
     docs/evals/h4-run-11-timeline.jpg

⏺ Bash(python3 - <<'EOF'
      p='docs/PROCESO.md'…)
  ⎿  ok
  ⎿  Updated docs/PROCESO.md +41 -2
      19  | H1 · CRM demo | `crm-demo` en producción con clientes, presup
          uestos y facturas, CI en verde, y un PR de prueba que crea su v
          ista previa con su propia rama de Neon y la borra al cerrarse |
           Hecho |
      20  | H2 · Tubería sin IA | Un PR de prueba en `crm-demo` aparece e
          n `/pipeline` (con login) con su vista previa, el resultado de 
          los tests y las capturas a 1280 px y 390 px; un test roto a pro
          pósito aparece como fallo; reenviar un webhook no duplica nada 
          | Hecho |
      21  | H3 · Motor de runs | Un run completo con `MockProvider` | Hec
          ho |
      22 -| H4 · Orquestador | Plan con criterios de aceptación que el cl
         -iente aprueba o rechaza | Pendiente |                          
      22 +| H4 · Orquestador | Plan con criterios de aceptación que el cl
         +iente aprueba o rechaza | Hecho |                              
      23  | H5 · Develop | PR real que compila en su vista previa | Pendi
          ente |
      24  | H6 · Testing | Un fallo provocado vuelve a Develop y se corri
          ge o se bloquea | Pendiente |
      25  | H7 · Panel completo | Run real de principio a fin en móvil y 
          escritorio | Pendiente |
     ...
      286  
      287  **Hecho por el humano:** clave de Gemini en un proyecto de Goo
           gle sin facturación y `GEMINI_API_KEY` en Vercel.
      288  
      289 -**Siguiente paso:** sesión 09 de Claude Code (H4), en `crm-age
          -nts`.                                                         
      289 +**Siguiente paso:** sesión 09 de Claude Code (H4), en `crm-age
          +nts`.                                                         
      290 +                                                              
      291 +## Sesión 09 · H4 · Orquestador con `GeminiProvider` (Claude C
          +ode) · 24/11/2026                                             
      292 +                                                              
      293 +**Objetivo:** el Orquestador planifica con Gemini de verdad (D
          +26–D30). Develop y Testing siguen con el mock, así que un run 
          +con plan real llega hasta el merge escribiendo `agent-runs/`. 
      294 +                                                              
      295 +**Cómo fue:**                                                 
      296 +- Claude propuso 12 commits y las decisiones de detalle y empe
          +zó tras el visto bueno. Todo directo a `master`.              
      297 +- **Contrato (D28):** `feasible`, `rejectionReason`, `summary`
          +, `assumptions` y de 1 a 4 tareas con `files` y criterios `{ i
          +d, type: e2e | visual, text }`. Las comprobaciones que un JSON
          + Schema no expresa (motivo obligatorio, rutas de `paths.ts`, i
          +ds únicos y una página nueva que no está en `e2e/pages.ts`) va
          +n en un `superRefine`; la del árbol solo cuando se conoce el á
          +rbol. Migración 0003: columnas nuevas y conversión de los crit
          +erios de H3.                                                  
      298 +- **Máquina:** transición `planning → rejected` (`plan_infeasi
          +ble`), con limpieza si ya había rama.                         
      299 +- **`GeminiProvider` (D26):** `@google/genai` 3.6.1, `response
          +JsonSchema` generado con `z.toJSONSchema` y podado al subconju
          +nto que acepta Gemini, una llamada de reparación con los error
          +es de Zod, la lista de modelos con salto ante el 429 diario (r
          +ecordado en `app_meta` hasta las 9:00) y `RateLimited` ante el
          + 429 por minuto, sin reintentos del SDK. `LLMProvider` devuelv
          +e el detalle de cada llamada y recibe ganchos para contarlas y
          + renovar el lease.                                            
      300 +- **Proveedor por agente:** `LLM_PROVIDER_<AGENTE>` y `LLM_PRO
          +VIDER=mock` como plan B; se guarda en `runs.providers`.       
      301 +- **Contexto (D27):** árbol con la Git Trees API (sin `agent-r
          +uns/`) y `AGENTS.md`, `src/db/schema.ts` y `e2e/pages.ts` leíd
          +os en `runs.base_sha`, que es también la base de `run/<id>`.  
      302 +- **Prompt** en `src/server/agents/prompts/orchestrator.ts`, c
          +on las rutas prohibidas importadas de `paths.ts` y los modos `
          +replace` y `amend` (D29). El modo lo decide `head_sha`.       
      303 +- **Motor:** caché de `agent_steps` extraída a `cache.ts` y pr
          +obada en memoria; cada petición respondida suma en `llm_calls`
          + y renueva el lease; el 429 por minuto aplaza el lease sin con
          +tar como fallo; la cuota agotada y el tope de llamadas bloquea
          +n el run. `agent_steps` guarda modelo, tokens, latencia y el d
          +etalle de las llamadas, y los eventos las llevan para la línea
          + de tiempo.                                                   
      304 +- **UI:** plan con resumen, supuestos, archivos y criterios co
          +n su tipo; motivo del rechazo; archivos leídos; modelo, tokens
          + y latencia de cada llamada en la línea de tiempo. El selector
          + de escenario solo sale si Develop o Testing son el mock, y ha
          +y una casilla nueva, «Simular caída tras planificar».         
      305 +- **Pruebas (D30):** 199 tests de Vitest con el mock, respuest
          +as grabadas y cuerpos de error con el formato de Google. `pnpm
          + eval:plan` lanzó las 4 peticiones de D14 contra Gemini: los p
          +lanes están en [`evals/`](./evals/README.md) y las respuestas 
          +en bruto en `src/server/llm/fixtures/gemini/recorded/`.       
      306 +                                                              
      307 +**Verificación en producción** (con `RUNS_PER_DAY=15` temporal
          +, porque ya había 6 runs del día):                            
      308 +1. **Peticiones de D14:** `pnpm eval:plan` con el contexto rea
          +l de `crm-demo`: NIF (2 tareas), buscador (2), facturas vencid
          +as (1) y contacto (2, con `e2e/pages.ts`). Todas viables, váli
          +das a la primera y con criterios que se comprueban en la vista
          + previa. El run #11 planificó además el NIF en producción.    
      309 +2. **Feedback en el plan** (run #11): «El NIF debe ser obligat
          +orio y validarse con el formato español: 8 dígitos y una letra
          +». La revisión 2 lo hace obligatorio, con la regex `^[0-9]{8}[
          +A-Za-z]$` y NIF válidos en el seed. Aprobada, siguió con el mo
          +ck: PR [crm-demo#9](https://github.com/daboy-dev/crm-demo/pull
          +/9), 2 commits, vista previa con 24/24 E2E, aprobación final, 
          +merge y `done`.                                               
      310 +3. **Fuera de alcance** (run #12): «Cambia el workflow de GitH
          +ub Actions…» acabó en `rejected` con el motivo «requiere modif
          +icar los workflows de GitHub Actions (`.github/workflows/**`)…
          +», sin rama `run/12` ni PR.                                   
      311 +4. **Sin repetir llamadas:** con «Simular caída tras planifica
          +r», el paso cayó después de guardar el plan; el sweep lo reanu
          +dó al caducar el lease y el evento muestra «de la caché, sin l
          +lamar de nuevo», con `llm_calls` aún en 1. El run #11 terminó 
          +con 6 llamadas contadas (2 de Gemini y 4 del mock) en `LLM_CAL
          +LS_PER_RUN`.                                                  
      312 +5. **Línea de tiempo:** cada llamada muestra modelo, tokens y 
          +latencia, por ejemplo `gemini-3.6-flash · llamada · 5303 → 983
          + tokens · 27,3 s` ([captura](./evals/h4-run-11-timeline.jpg)).
      313 +                                                              
      314 +**Cuota de Gemini gastada:** 11 peticiones respondidas, todas 
          +de `gemini-3.6-flash` (8 del eval y 3 de producción), de las 4
          +0 diarias de Flash. Unas 8 más no llegaron a generar respuesta
          + (400, 503 y 504).                                            
      315 +                                                              
      316 +**Qué salió mal y qué se corrigió:**                          
     … +12 lines (ctrl+o to expand)

⏺ Now the decision extras and CLAUDE.md.

⏺ Bash(python3 - <<'EOF'
      p='docs/DECISIONES.md'…)
  ⎿   CLAUDE.md          | 16 +++++++++-------
      docs/DECISIONES.md | 17 +++++++++++++++++
      docs/PROCESO.md    | 43 +++++++++++++++++++++++++++++++++++++++++--
      3 files changed, 67 insertions(+), 9 deletions(-)
  ⎿  Updated CLAUDE.md +9 -7
      11  ## Stack
      12  - Next.js (App Router) + TypeScript estricto, desplegado en Ver
          cel Hobby.
      13  - Neon (Postgres) con Drizzle ORM y el driver serverless de Neo
          n. Proyecto de Neon propio, distinto del de `crm-demo`.
      14 -- LLM: interfaz `LLMProvider` con `GeminiProvider` y `MockProvi
         -der`. Salidas validadas con Zod.                               
      14 +- LLM: interfaz `LLMProvider` con `GeminiProvider` (`@google/ge
         +nai`) y `MockProvider`, elegido por agente. Salidas validadas c
         +on Zod.                                                        
      15  - Tests: Vitest (dominio) y Playwright (E2E del panel). CI en G
          itHub Actions.
      16  
      17  ## Restricciones importantes
     ...
      40  - `src/server/db`: esquema y cliente de Drizzle. Migraciones en
           `drizzle/`.
      41  - `src/server/github`: firma de webhooks, registro idempotente 
          de eventos, cliente de artifacts y configuración (`DEMO_REPO`, 
          `preview-e2e.yml`).
      42  - `src/server/pipeline`: clasificación de eventos, upserts de `
          previews`, lectura del artifact, informes y capturas en Blob, c
          onsultas de `/pipeline` y reprocesado.
      43 -- `src/server/runs`: `machine.ts` (transiciones puras, D21), `s
         -tore.ts` (CAS en una sentencia con CTE y lease, D22), `engine.t
         -s` (pasos, efectos, cola, limpieza y `sweep()`), `notify.ts` (e
         -ventos de GitHub → run por sha o por rama `run/<id>`), `queries
         -.ts` y `limits.ts`.                                            
      44 -- `src/server/agents`: contratos Zod (`contracts.ts`), llamadas
         - a los agentes (`index.ts`) y rutas prohibidas para Develop (`p
         -aths.ts`, D16).                                                
      45 -- `src/server/llm`: `LLMProvider`, `MockProvider` con escenario
         -s (D24) y `getProvider()`.                                     
      43 +- `src/server/runs`: `machine.ts` (transiciones puras, D21), `s
         +tore.ts` (CAS en una sentencia con CTE y lease, D22), `cache.ts
         +` (salidas de `agent_steps` y cuenta de llamadas), `engine.ts` 
         +(pasos, efectos, cola, limpieza y `sweep()`), `notify.ts` (even
         +tos de GitHub → run por sha o por rama `run/<id>`), `queries.ts
         +` y `limits.ts`.                                               
      44 +- `src/server/agents`: contratos Zod (`contracts.ts`, plan de D
         +28), llamadas a los agentes (`index.ts`), contexto del Orquesta
         +dor (`context.ts`, D27), prompts (`prompts/`) y rutas prohibida
         +s para Develop (`paths.ts`, D16).                              
      45 +- `src/server/llm`: `LLMProvider` y sus errores (`provider.ts`)
         +, `MockProvider` con escenarios (D24), `GeminiProvider` (`gemin
         +i.ts`, D26), modelos agotados en `app_meta` (`quota.ts`), prove
         +edor por agente y `getProvider()` (`index.ts`). Respuestas grab
         +adas en `fixtures/gemini/`.                                    
      46  - `src/server/github/repo.ts`: Git Data API y PRs de `crm-demo`
           (ramas `run/<id>`, merge squash fijado al sha).
      47  - Next.js 16: la doc de la versión instalada está en `node_modu
          les/next/dist/docs/` (ver `AGENTS.md`). `cacheComponents` está 
          activo: los route handlers que deban ejecutarse en cada petició
          n llaman a `connection()`, y los componentes que leen la base d
          e datos van dentro de `<Suspense>`.
      48  
      49  ## Variables
      50 -Ver `.env.example`. En Vercel y en `.env.local` (`vercel env pu
         -ll`): `DATABASE_URL`, `AUTH_SECRET`, `DEMO_USER`, `DEMO_PASSWOR
         -D`, `GH_TOKEN` (PAT de `crm-demo` con Actions: lectura), `GH_WE
         -BHOOK_SECRET`, `BLOB_STORE_ID` y `VERCEL_OIDC_TOKEN` (caduca en
         - local; el store solo tiene OIDC fuera de `development`, así qu
         -e Blob se prueba en producción). Opcionales de H3: `LLM_PROVIDE
         -R` (`mock`), `RUNS_PER_DAY` (10) y `LLM_CALLS_PER_RUN` (30). El
         - PAT necesita *Contents* y *Pull requests* de lectura y escritu
         -ra y *Actions* de lectura.                                     
      50 +Ver `.env.example`. En Vercel y en `.env.local` (`vercel env pu
         +ll`): `DATABASE_URL`, `AUTH_SECRET`, `DEMO_USER`, `DEMO_PASSWOR
         +D`, `GH_TOKEN` (PAT de `crm-demo` con Actions: lectura), `GH_WE
         +BHOOK_SECRET`, `BLOB_STORE_ID` y `VERCEL_OIDC_TOKEN` (caduca en
         + local; el store solo tiene OIDC fuera de `development`, así qu
         +e Blob se prueba en producción). H4: `GEMINI_API_KEY` y `LLM_PR
         +OVIDER_ORCHESTRATOR=gemini`. Opcionales: `LLM_PROVIDER=mock` (f
         +uerza el mock en todos), `LLM_PROVIDER_DEVELOP` y `LLM_PROVIDER
         +_TESTING` (`mock`), `GEMINI_MODELS_<AGENTE>`, `RUNS_PER_DAY` (5
         +) y `LLM_CALLS_PER_RUN` (12). El PAT necesita *Contents* y *Pul
         +l requests* de lectura y escritura y *Actions* de lectura.     
      51  
      52  ## Comandos
      53  - `pnpm dev` · servidor de desarrollo.
     ...
      55  - `pnpm lint` · ESLint.
      56  - `pnpm format` / `pnpm format:check` · Prettier (no toca el Ma
          rkdown).
      57  - `pnpm typecheck` · `next typegen` + `tsc --noEmit`.
      58 -- `pnpm test` · Vitest (`src/**/*.test.ts`).                   
      58 +- `pnpm test` · Vitest (`src/**/*.test.ts`). Nada llama a Gemin
         +i.                                                             
      59 +- `pnpm eval:plan` · a mano: las 4 peticiones de D14 contra Gem
         +ini → `docs/evals/` (gasta cuota; `EVAL_FORCE=1` repite las ya 
         +hechas).                                                       
      60  - `pnpm db:generate` · genera una migración a partir de `src/se
          rver/db/schema.ts`.
      61  - `pnpm db:migrate` · aplica las migraciones (lee `DATABASE_URL
          ` de `.env.local` o `.env`).
      62  
     ...
      65  - H1 hecho (24/11/2026): `crm-demo` en producción, con vista pr
          evia y rama de Neon por PR, borrada al cerrar el PR (`neon-clea
          nup.yml`).
      66  - H2 hecho (24/11/2026): cada vista previa de `crm-demo` pasa P
          laywright en Actions; el panel recibe `workflow_run`, descarga 
          el artifact `e2e-results` y muestra tests y capturas en `/pipel
          ine` tras el login.
      67  - H3 hecho (24/11/2026): runs con `MockProvider` sobre GitHub r
          eal (rama `run/<id>`, un commit por tarea, PR, vista previa, E2
          E y merge), con cola, lease, sweep y los 6 criterios comprobado
          s en producción.
      67 -- Siguiente: H4 · Orquestador con `GeminiProvider`.            
      68 +- H4 hecho (24/11/2026): el Orquestador planifica con Gemini (c
         +ontexto de `crm-demo`, plan de D28, replanificación de D29 y re
         +chazo fuera de alcance). Develop y Testing siguen con el mock. 
         +Los 5 criterios están comprobados en producción.               
     … +1 line (ctrl+o to expand)
  ⎿  Updated docs/DECISIONES.md +17
      350  - 40 llamadas al día con Flash entre los dos modelos, y 500 co
           n Flash-Lite de respaldo.
      351  - Plan B si todo se agota: `LLM_PROVIDER=mock` (D8).
      352  
      353 +**Extra (24/11/2026, sesión 09):**                            
      354 +- **Qué cuenta en `LLM_CALLS_PER_RUN`:** cada petición que el 
          +modelo responde, reparación incluida, y se suma en el momento.
          + Los 429 y los errores del servidor no cuentan. El tope se com
          +prueba antes de cada petición.                                
      355 +- **Lease:** antes de cada petición se renueva a 90 s, porque 
          +una llamada y su reparación pueden pasar de un minuto cada una
          +.                                                             
      356 +- **Modelos agotados:** se apuntan en `app_meta` con la fecha 
          +del Pacífico, y el resto del día se saltan sin gastar una peti
          +ción.                                                         
      357 +- **Razonamiento:** `gemini-3.8-flash` rechaza `thinkingLevel:
          + MINIMAL` con un 400 (comprobado). Se prueba MINIMAL y, si el 
          +modelo lo rechaza, LOW, y se recuerda por modelo.             
      358 +- **Modelo saturado:** un 500, 503 («high demand») o 504 pasa 
          +al siguiente modelo de la lista sin marcar el anterior como ag
          +otado. Si todos fallan, el paso falla y lo reintenta el sweep 
          +(cuenta para los 3 fallos de D22). Comprobado en H4: `gemini-3
          +.8-flash` dio 503 varias veces y todas las respuestas llegaron
          + de `gemini-3.6-flash`.                                       
      359 +- El 429 por minuto añade 2 s de margen al `retryDelay`. Si la
          + respuesta no trae `retryDelay`, se espera un minuto.         
      360 +                                                              
      361  ## D27 · Qué ve el Orquestador
      362  **Fecha:** 24/11/2026 · **Estado:** aceptada
      363  
     ...
      367  - No lee el código completo: planifica, no programa. Así el pr
           ompt es pequeño y estable.
      368  - La UI muestra qué archivos ha leído el agente.
      369  
      370 +**Extra (24/11/2026, sesión 09):** el árbol excluye `agent-run
          +s/`, que crece con cada run simulado. El sha se guarda en `run
          +s.base_sha` la primera vez que se planifica y todas las revisi
          +ones lo reutilizan. El contexto solo se lee si `agent_steps` n
          +o tiene ya el plan.                                           
      371 +                                                              
      372  ## D28 · Contrato del plan
      373  **Fecha:** 24/11/2026 · **Estado:** aceptada
      374  
     ...
      381    - criterios de aceptación con id y tipo: `e2e` (se comprueba
            en el DOM con `data-testid`) o `visual` (se comprueba con las
            capturas).
      382  - Si la petición crea una página, la tarea incluye añadirla a 
           `e2e/pages.ts` para que salga en las capturas.
      383  
      384 +**Extra (24/11/2026, sesión 09):**                            
      385 +- Es un objeto plano y no una unión discriminada, porque Gemin
          +i lo lleva mejor. Las reglas que un JSON Schema no expresa van
          + en un `superRefine` y vuelven en la llamada de reparación: mo
          +tivo obligatorio y sin tareas si no es viable, rutas de `paths
          +.ts`, ids `c1`, `c2`… únicos en el plan y, con el árbol, una p
          +ágina nueva que no está en `e2e/pages.ts`.                    
      386 +- Los criterios deben poder comprobarse en la vista previa: el
          + DOM para `e2e` y las capturas para `visual`, nunca el código.
          + Lo pide el prompt tras ver criterios sobre el esquema en el p
          +rimer eval.                                                   
      387 +- Un plan no viable en una replanificación tras la vista previ
          +a también lleva a `rejected`, y la limpieza cierra el PR.     
      388 +                                                              
      389  ## D29 · Replanificación con feedback
      390  **Fecha:** 24/11/2026 · **Estado:** aceptada
      391  
     ...
      393  - **Feedback en el plan** (aún no hay código): el Orquestador 
           hace un plan completo que sustituye al anterior.
      394  - **Feedback en la vista previa final:** el plan solo añade ta
           reas nuevas o correctivas sobre la misma rama. El Orquestador 
           recibe el plan anterior, el estado de cada tarea y el feedback
           .
      395  
      396 +**Extra (24/11/2026, sesión 09):** el modo lo decide `head_sha
          +`: sin código en la rama es `replace` y con código es `amend`.
          + Las tareas nuevas van en la revisión n+1, y Testing solo eval
          +úa esas.                                                      
      397 +                                                              
      398  ## D30 · Probar el Orquestador sin gastar cuota
      399  **Fecha:** 24/11/2026 · **Estado:** aceptada
     … +1 line (ctrl+o to expand)

  Called claude-in-chrome, ran 2 shell commands (ctrl+o to expand)

⏺ H4 está hecho y comprobado en producción. El último commit (84f8fc6) está
  desplegado, con CI en verde, y no queda ningún PR abierto en crm-demo. Lint,
  tipos y formato están en verde y pasan los 199 tests; ninguno llama a Gemini.

  Los 5 criterios en producción:
  1. Las cuatro peticiones de D14: pnpm eval:plan dio planes válidos a la
     primera, con el contexto real de crm-demo:

  | Petición          | Tareas                   |
  |-------------------|--------------------------|
  | NIF               | 2                        |
  | buscador          | 2                        |
  | facturas vencidas | 1                        |
  | contacto          | 2 (incluye e2e/pages.ts) |
     Los planes y el resumen están en docs/evals/README.md.
  2. Plan rechazado con feedback (run #11): pedí que el NIF fuera obligatorio y
     con formato español. La revisión 2 lo recoge, con la regex y el seed. Al
     aprobarla, el run siguió con el mock y llegó a done con el PR crm-demo#9
     fusionado y 24/24 E2E.
  3. Fuera de alcance (run #12): «Cambia el workflow de GitHub Actions…» acabó
     en rejected con su motivo, sin rama run/12 ni PR.
  4. Repetir un paso no llama a Gemini: el paso de planificación cayó después de
     guardar el plan (con la casilla nueva «Simular caída tras planificar») y,
     al reanudarse, el plan salió de la caché sin llamar a Gemini; llm_calls
     siguió en 1. El run #11 terminó con 6 llamadas contadas: 2 de Gemini y 4
     del mock.
  5. Línea de tiempo: cada llamada muestra modelo, tokens y latencia (captura).

  Cuota de Gemini: 11 peticiones respondidas, todas de gemini-3.6-flash (8 del
  eval y 3 de producción), de las 40 diarias de Flash. Unas 8 más no llegaron a
  generar respuesta.

  Problemas que salieron por el camino, ya corregidos y apuntados en las 
  decisiones:
  - Razonamiento al mínimo: gemini-3.8-flash rechaza thinkingLevel: MINIMAL con
    un 400, aunque los tipos del SDK lo aceptan. Ahora se prueba MINIMAL y, si
    el modelo lo rechaza, se repite con LOW y se recuerda para ese modelo.
  - Modelo saturado: gemini-3.8-flash respondió 503 («high demand») varias veces
    y otro modelo dio un 504. Ahora un 500, 503 o 504 pasa al siguiente modelo
    de la lista sin marcarlo como agotado. Esto amplía D26, que solo preveía
    saltar de modelo con el 429 diario.
  - Criterios sobre el código: en la primera ronda del eval, tres planes tenían
    un criterio que no se ve en la vista previa (el esquema, una consulta, una
    función). Ajusté el prompt y en la segunda ronda todos los criterios se
    comprueban en el DOM o en las capturas.
  - Plan antiguo en pantalla: mientras se preparaba la revisión 2, la tarjeta
    del plan seguía mostrando el resumen de la 1. Ya está corregido.

  Pendiente para H5: la revisión 2 del NIF le pide a Develop «ejecuta pnpm 
  db:generate», algo que Develop no puede hacer porque solo escribe archivos.
  Está anotado en PROCESO.md.

  PROCESO.md, DECISIONES.md (extras de D26–D30) y CLAUDE.md están actualizados.

  Te quedan dos cosas:
  - Quita RUNS_PER_DAY=15 en Vercel para volver a 5.
  - Exporta la transcripción con /export a docs/sesiones/09-h4-orquestador.md.
    Yo no puedo lanzar /export. En esta sesión no ha salido ninguna clave por el
    chat, pero cuando la exportes la reviso y la saneo antes del commit.

⏺ Remote Control not started here · another Claude Code on this machine 
  (started 1h ago) already has Remote Control for this conversation, so 
  this terminal can't see your sessions on other machines and they can't
  reach it · run /remote-control to move it to this terminal