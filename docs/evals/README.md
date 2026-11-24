# Evals del Orquestador (`pnpm eval:plan`)

Generado el 2026-11-24 contra Gemini, con el contexto real de `crm-demo` en `fa884d7` (D27, D30). Cada plan está completo en su JSON.

| Petición | Viable | Tareas | Criterios (e2e / visual) | Llamadas | Modelo | Tokens (entrada → salida) | Latencia |
|---|---|---|---|---|---|---|---|
| [nif](plan-nif.json) | sí | 2 | 4 (3 / 1) | 1 | gemini-3.6-flash | 5144 → 865 | 5.0 s |
| [buscador](plan-buscador.json) | sí | 2 | 3 (2 / 1) | 1 | gemini-3.6-flash | 5132 → 694 | 20.6 s |
| [facturas-vencidas](plan-facturas-vencidas.json) | sí | 1 | 2 (1 / 1) | 1 | gemini-3.6-flash | 5145 → 547 | 9.3 s |
| [contacto](plan-contacto.json) | sí | 2 | 4 (3 / 1) | 1 | gemini-3.6-flash | 5138 → 619 | 18.1 s |

## nif

> Añade el NIF a los clientes: se introduce en el formulario de alta y edición y se ve en el detalle y en la lista.

Se añadirá el campo NIF (nif) a la entidad de clientes. Estará disponible en el formulario de alta y edición, en la vista de detalle del cliente y en la tabla del listado de clientes.

Supuestos:
- El campo NIF será opcional (texto) para permitir clientes sin NIF asignado o con datos incompletos.
- El campo se colocará visible en el formulario como field-nif y en el listado/detalle como data-testid client-nif o dentro de las columnas existentes.

1. **Añadir columna NIF al esquema de base de datos y migración** · `src/db/schema.ts`, `drizzle/0001_add_client_nif.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0001_snapshot.json`, `src/db/seed.ts`
   - `c1` e2e: La vista previa compila y la ruta /clientes carga correctamente mostrando la tabla clients-table.

2. **Actualizar validación, consultas y UI del cliente con NIF** · `src/app/(crm)/clientes/validation.ts`, `src/app/(crm)/clientes/queries.ts`, `src/app/(crm)/clientes/client-form.tsx`, `src/app/(crm)/clientes/page.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`, `src/app/(crm)/clientes/[id]/editar/page.tsx`
   - `c2` e2e: En /clientes/nuevo, el formulario client-form contiene el campo con data-testid field-nif.
   - `c3` e2e: En /clientes, la tabla clients-table incluye el encabezado NIF.
   - `c4` visual: En las capturas de clientes y cliente-detalle, el campo NIF se visualiza correctamente formateado.

## buscador

> Añade un buscador en la lista de clientes que filtre por nombre o por email.

Se añadirá un campo de búsqueda en la página principal de clientes (`/clientes`) que permitirá filtrar en tiempo real o mediante query string por el nombre o el correo electrónico del cliente.

Supuestos:
- El término de búsqueda se pasará a través del parámetro de consulta `q` en la URL de `/clientes` para permitir navegación por SSR y refresco adecuado bajo React Server Components y Suspense.
- El filtro buscará coincidencias parciales sin distinción entre mayúsculas y minúsculas (ilike/or) tanto en el nombre como en el email del cliente.
- Se usará un input con `data-testid="search-input"` para permitir la introducción de texto en la vista de clientes.

1. **Añadir filtrado por término de búsqueda en la consulta de clientes** · `src/app/(crm)/clientes/queries.ts`, `src/app/(crm)/clientes/page.tsx`
   - `c1` e2e: La vista de clientes `/clientes` carga correctamente y muestra la tabla con `data-testid="clients-table"`.

2. **Añadir componente input de búsqueda en la lista de clientes** · `src/app/(crm)/clientes/page.tsx`
   - `c2` e2e: En `/clientes`, el elemento con `data-testid="search-input"` está presente en el DOM.
   - `c3` visual: En la captura de la página de clientes `/clientes`, el campo de búsqueda se muestra correctamente integrado junto al encabezado o sobre la tabla.

## facturas-vencidas

> Marca las facturas vencidas: las que siguen pendientes de pago con la fecha de vencimiento ya pasada deben destacarse en la lista de facturas.

Se añadirá una utilidad para comprobar si una factura está vencida (estado pendiente y fecha de vencimiento previa a la fecha actual) y se actualizará la lista de facturas para marcar visualmente las facturas vencidas con un distintivo o texto de aviso.

Supuestos:
- Una factura se considera vencida cuando su estado es 'pending' y su fecha 'dueAt' es estrictamente anterior a la fecha actual (YYYY-MM-DD en la zona horaria local/servidor).
- Las facturas con estado 'paid' nunca se marcarán como vencidas.
- El distintivo o etiqueta de vencida aparecerá junto al estado o fecha en la tabla de la lista de facturas sin alterar la estructura básica de los elementos existentes.

1. **Añadir función para calcular estado de vencimiento e integrarla en la interfaz de facturas** · `src/lib/dates.ts`, `src/lib/dates.test.ts`, `src/app/(crm)/facturas/page.tsx`
   - `c1` e2e: La vista de facturas en /facturas carga correctamente la tabla invoices-table.
   - `c2` visual: En la lista de facturas (/facturas), las facturas pendientes con fecha de vencimiento anterior a la fecha actual muestran una marca o badge indicando 'Vencida'.

## contacto

> Añade una página de contacto con el email y el teléfono de la empresa, enlazada desde el menú.

Se creará una nueva página de contacto accesible desde el menú principal de navegación con la información de contacto (email y teléfono) de la empresa. Se actualizarán los enlaces de navegación del CRM y la lista de capturas para las pruebas de UI.

Supuestos:
- La información de contacto mostrará valores descriptivos estándar como contacto@ejemplo.com y +34 900 000 000.
- La nueva página se ubicará en la ruta /contacto dentro del layout principal del CRM.

1. **Añadir enlace de contacto a la barra de navegación** · `src/components/nav-links.tsx`
   - `c1` e2e: En la barra de navegación de `/clientes` se visualiza el enlace 'Contacto' que apunta a `/contacto`.

2. **Crear página de contacto y registrar en capturas e2e** · `src/app/(crm)/contacto/page.tsx`, `e2e/pages.ts`
   - `c2` e2e: La página `/contacto` carga correctamente y muestra el título con data-testid 'page-title' que contiene el texto 'Contacto'.
   - `c3` e2e: En `/contacto` existen los elementos con data-testid 'contact-email' y 'contact-phone' con la información de contacto de la empresa.
   - `c4` visual: La página `/contacto` se renderiza correctamente tanto a 1280 px como a 390 px de ancho.
