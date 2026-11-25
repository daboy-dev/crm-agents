# Evals de Testing (`pnpm eval:testing`)

Generado el 2026-11-25 con el contexto real de `crm-demo` en `c97dafd`. El Orquestador planifica cada petición con los `data-testid` de sus criterios (D38) y Testing escribe los pasos con su cadena (D40). Todo valida con Zod; los planes y los pasos están completos en sus JSON.

| Petición | Tareas | Criterios | Pasos | Plan (llamadas · modelo · tokens · latencia) | Pasos (llamadas · modelo · tokens · latencia) |
|---|---|---|---|---|---|
| [filtro-facturas](plan-h6-filtro-facturas.json) | 1 | 2 | [9](steps-filtro-facturas.json) | 1 · gemini:gemini-3.5-flash-lite · 6694 → 556 · 3.2 s | 1 · groq:openai/gpt-oss-120b · 3100 → 403 · 1.3 s |
| [notas-cliente](plan-h6-notas-cliente.json) | 2 | 3 | [21](steps-notas-cliente.json) | 1 · gemini:gemini-3.5-flash-lite · 6694 → 872 · 6.3 s | 1 · groq:openai/gpt-oss-120b · 3241 → 844 · 2.4 s |
| [duplicar-presupuesto](plan-h6-duplicar-presupuesto.json) | 2 | 3 | [11](steps-duplicar-presupuesto.json) | 1 · gemini:gemini-3.5-flash-lite · 6591 → 740 · 3.6 s | 1 · groq:openai/gpt-oss-120b · 3120 → 601 · 1.7 s |
| [resumen](plan-h6-resumen.json) | 1 | 3 | [8](steps-resumen.json) | 1 · gemini:gemini-3.5-flash-lite · 6593 → 604 · 6.8 s | 1 · groq:openai/gpt-oss-120b · 3014 → 380 · 1.3 s |

## filtro-facturas

> Añade un filtro por estado en la lista de facturas: un desplegable que deja ver solo las pendientes, las pagadas o todas.

Se añade un desplegable de filtro por estado (todas, pendientes, pagadas) en la página de lista de facturas utilizando parámetros de búsqueda en la URL.

1. **Añadir filtro por estado en la lista de facturas** · `src/app/(crm)/facturas/queries.ts`, `src/app/(crm)/facturas/page.tsx`
   - `c1`: la página de facturas muestra el selector de filtro por estado · `nav-facturas`, `field-status-filter`, `invoices-table`
     - `{"action":"goto","page":"facturas"}`
     - `{"action":"expectVisible","testId":"nav-facturas"}`
     - `{"action":"expectVisible","testId":"field-status-filter"}`
     - `{"action":"expectVisible","testId":"invoices-table"}`
   - `c2`: al seleccionar facturas pendientes en el filtro, la tabla muestra solo las facturas con estado pendiente · `nav-facturas`, `field-status-filter`, `invoices-table`, `invoice-row`
     - `{"action":"goto","page":"facturas"}`
     - `{"action":"expectVisible","testId":"nav-facturas"}`
     - `{"action":"select","testId":"field-status-filter","value":"pending"}`
     - `{"action":"expectVisible","testId":"invoices-table"}`
     - `{"action":"expectCount","testId":"invoice-row","min":1}`

## notas-cliente

> Añade un campo de notas internas a los clientes: se escribe en el formulario de alta y edición y se ve en el detalle del cliente.

Se añade el campo de notas internas a la tabla de clientes en el esquema y se actualizan queries, validaciones, acciones, formularios y la vista de detalle para permitir crearlas, editarlas y consultarlas.

1. **feat: add notes column to clients schema, queries, validation, and seed** · `src/db/schema.ts`, `src/app/(crm)/clientes/queries.ts`, `src/app/(crm)/clientes/validation.ts`, `src/db/seed.ts`
   - `c1`: La tabla de clientes y las consultas devuelven correctamente el registro con notas. · `clients-table`, `client-row`
     - `{"action":"goto","page":"clientes"}`
     - `{"action":"expectVisible","testId":"clients-table"}`
     - `{"action":"expectCount","testId":"client-row","min":1}`

2. **feat: add internal notes field to client forms and detail view** · `src/app/(crm)/clientes/client-form.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`, `src/app/(crm)/clientes/[id]/editar/page.tsx`, `src/app/(crm)/clientes/actions.ts`
   - `c2`: Al crear un cliente rellenando el campo de notas, el detalle muestra las notas en client-notes. · `new-client-button`, `client-form`, `field-name`, `field-email`, `field-notes`, `save-button`
     - `{"action":"goto","page":"clientes"}`
     - `{"action":"click","testId":"new-client-button"}`
     - `{"action":"fill","testId":"field-name","value":"Cliente {{stamp}}"}`
     - `{"action":"fill","testId":"field-email","value":"test-{{stamp}}@example.com"}`
     - `{"action":"fill","testId":"field-notes","value":"Nota interna {{stamp}}"}`
     - `{"action":"click","testId":"save-button"}`
     - `{"action":"expectVisible","testId":"client-detail"}`
     - `{"action":"expectText","testId":"client-notes","text":"Nota interna {{stamp}}"}`
   - `c3`: El detalle del cliente muestra la sección de notas internas correctamente. · `client-detail`, `client-notes`, `edit-client-button`
     - `{"action":"goto","page":"clientes"}`
     - `{"action":"click","testId":"new-client-button"}`
     - `{"action":"fill","testId":"field-name","value":"Cliente {{stamp}}"}`
     - `{"action":"fill","testId":"field-email","value":"test-{{stamp}}@example.com"}`
     - `{"action":"fill","testId":"field-notes","value":"Notas de prueba {{stamp}}"}`
     - `{"action":"click","testId":"save-button"}`
     - `{"action":"expectVisible","testId":"client-detail"}`
     - `{"action":"expectVisible","testId":"client-notes"}`
     - `{"action":"expectText","testId":"client-notes","text":"Notas de prueba {{stamp}}"}`
     - `{"action":"expectVisible","testId":"edit-client-button"}`

## duplicar-presupuesto

> Añade un botón en el detalle de un presupuesto para duplicarlo: crea un presupuesto nuevo en borrador con el mismo cliente y las mismas líneas.

Se añade un botón en el detalle de un presupuesto para duplicarlo, creando un nuevo presupuesto en estado borrador con el mismo cliente y sus líneas de detalle.

1. **Añadir acción de duplicar presupuesto en el servidor** · `src/app/(crm)/presupuestos/actions.ts`
   - `c1`: El detalle del presupuesto muestra el botón para duplicar con data-testid duplicate-quote-button. · `duplicate-quote-button`
     - `{"action":"goto","page":"presupuesto-detalle"}`
     - `{"action":"expectVisible","testId":"duplicate-quote-button"}`
   - `c2`: Al pulsar duplicar en un presupuesto, se crea uno nuevo en borrador y se redirige a su detalle mostrando el estado borrador y las mismas líneas. · `duplicate-quote-button`, `quote-detail`, `status-badge`, `items-table`, `item-row`
     - `{"action":"goto","page":"presupuesto-detalle"}`
     - `{"action":"click","testId":"duplicate-quote-button"}`
     - `{"action":"expectVisible","testId":"quote-detail"}`
     - `{"action":"expectText","testId":"status-badge","text":"Borrador"}`
     - `{"action":"expectVisible","testId":"items-table"}`
     - `{"action":"expectCount","testId":"item-row","min":1}`

2. **Añadir el botón de duplicar en la vista de detalle de presupuesto** · `src/app/(crm)/presupuestos/[id]/page.tsx`
   - `c3`: La página de detalle del presupuesto contiene el botón duplicate-quote-button junto al resto de controles. · `quote-detail`, `duplicate-quote-button`
     - `{"action":"goto","page":"presupuesto-detalle"}`
     - `{"action":"expectVisible","testId":"quote-detail"}`
     - `{"action":"expectVisible","testId":"duplicate-quote-button"}`

## resumen

> Añade una página de resumen, enlazada desde el menú, con el número de clientes, los presupuestos enviados y el importe pendiente de cobro.

Se añade la página de resumen en /resumen con tarjetas y contadores para el número total de clientes, los presupuestos enviados y el importe pendiente de cobro de las facturas pendientes. Se incluye también en el menú de navegación lateral mediante el enlace correspondiente y se añade a la lista de páginas E2E para su captura.

1. **Añadir página de resumen y consultas de métricas** · `src/app/(crm)/resumen/page.tsx`, `src/app/(crm)/resumen/queries.ts`, `e2e/pages.ts`
   - `c1`: La página de resumen carga correctamente y muestra el título y las tarjetas de métricas. · `nav-resumen`, `page-title`, `summary-card`
     - `{"action":"goto","path":"/resumen"}`
     - `{"action":"expectVisible","testId":"page-title"}`
     - `{"action":"expectVisible","testId":"summary-card"}`
   - `c2`: Se muestra el recuento de clientes y presupuestos enviados en las tarjetas correspondientes. · `nav-resumen`, `client-count`, `sent-quotes-count`
     - `{"action":"goto","path":"/resumen"}`
     - `{"action":"expectVisible","testId":"client-count"}`
     - `{"action":"expectVisible","testId":"sent-quotes-count"}`
   - `c3`: Se muestra el importe pendiente de cobro en la tarjeta de pendientes. · `nav-resumen`, `pending-amount`
     - `{"action":"goto","path":"/resumen"}`
     - `{"action":"expectVisible","testId":"pending-amount"}`
