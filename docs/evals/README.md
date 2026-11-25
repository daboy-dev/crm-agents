# Evals del Orquestador (`pnpm eval:plan`)

Generado el 2026-11-25 con la cadena del Orquestador (D36), con el contexto real de `crm-demo` en `b6c4a3c` (D27, D30). Cada plan está completo en su JSON.

| Petición | Viable | Tareas | Criterios (e2e / visual) | Llamadas | Modelo | Tokens (entrada → salida) | Latencia |
|---|---|---|---|---|---|---|---|
| [nif](plan-nif.json) | sí | 3 | 4 (3 / 1) | 1 | gemini:gemini-3.6-flash | 5731 → 992 | 5.3 s |
| [buscador](plan-buscador.json) | sí | 1 | 3 (2 / 1) | 1 | gemini:gemini-3.6-flash | 5719 → 668 | 4.3 s |
| [facturas-vencidas](plan-facturas-vencidas.json) | sí | 2 | 3 (2 / 1) | 1 | gemini:gemini-3.6-flash | 5732 → 896 | 5.3 s |
| [contacto](plan-contacto.json) | sí | 2 | 3 (2 / 1) | 1 | gemini:gemini-3.6-flash | 5725 → 662 | 3.9 s |

## nif

> Añade el NIF a los clientes: se introduce en el formulario de alta y edición y se ve en el detalle y en la lista.

Se añadirá el campo opcional NIF a los clientes. Esto incluye la actualización del esquema de la base de datos, las validaciones del formulario de alta/edición, y la visualización del NIF tanto en la lista general de clientes como en la página de detalle de cada cliente.

Supuestos:
- El campo NIF se tratará como un campo de texto opcional (nullable) para mantener retrocompatibilidad con los clientes existentes.
- El NIF se mostrará en una nueva columna en la tabla de clientes (/clientes) visible en escritorio.
- En la página de detalle del cliente (/clientes/[id]), el NIF se mostrará junto al resto de datos de contacto o información fiscal.

1. **Añadir campo nif al esquema de base de datos y validaciones** · `src/db/schema.ts`, `src/app/(crm)/clientes/validation.ts`
   - `c1` e2e: La vista previa compila correctamente y se puede acceder a la lista de clientes /clientes cargando la tabla clients-table.

2. **Añadir campo NIF al formulario de alta y edición de clientes** · `src/app/(crm)/clientes/client-form.tsx`, `src/app/(crm)/clientes/[id]/editar/page.tsx`
   - `c2` e2e: En /clientes/nuevo aparece el input de NIF con el atributo data-testid='field-nif'.

3. **Mostrar el NIF en la lista y detalle de clientes** · `src/app/(crm)/clientes/page.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`, `src/db/seed.ts`
   - `c3` e2e: En /clientes la tabla clients-table contiene la columna NIF.
   - `c4` visual: En las capturas de clientes y cliente-detalle se visualiza el campo/columna NIF correctamente integrado en el diseño.

## buscador

> Añade un buscador en la lista de clientes que filtre por nombre o por email.

Se añadirá un campo de búsqueda en la página de clientes que permitirá filtrar en tiempo real por el nombre o por el correo electrónico utilizando parámetros de búsqueda de la URL y una consulta a la base de datos con ILIKE/or.

Supuestos:
- La búsqueda filtrará de forma insensible a mayúsculas/minúsculas coincidiendo parcialmente en el nombre o en el email del cliente.
- El campo de búsqueda estará ubicado en la cabecera/parte superior de la lista de clientes con un data-testid="client-search-input".
- Al modificar el término de búsqueda se actualizará el parámetro searchQuery o q en la URL para integrarse limpiamente con Next.js App Router y Suspense.

1. **Añadir filtro por nombre o email en consultas de clientes y UI de búsqueda** · `src/app/(crm)/clientes/queries.ts`, `src/app/(crm)/clientes/page.tsx`
   - `c1` e2e: La página /clientes contiene un campo de entrada con data-testid="client-search-input" para buscar clientes.
   - `c2` e2e: Al introducir un término de búsqueda en data-testid="client-search-input", la tabla clients-table muestra únicamente los clientes cuyo nombre o email coincide con la búsqueda.
   - `c3` visual: La página /clientes renderiza correctamente el buscador arriba de la tabla clients-table sin desajustes visuales en escritorio ni móvil.

## facturas-vencidas

> Marca las facturas vencidas: las que siguen pendientes de pago con la fecha de vencimiento ya pasada deben destacarse en la lista de facturas.

Se añadirán indicadores visuales y de estado para resaltar las facturas vencidas. Las facturas en estado pendiente cuya fecha de vencimiento haya transcurrido con respecto al día actual mostrarán la etiqueta 'Vencida' con un estilo destacado tanto en la tabla principal de facturas como en la página de detalle.

Supuestos:
- Una factura se considera vencida únicamente si su estado actual es 'pending' y su fecha de vencimiento (`dueAt`) es estrictamente anterior a la fecha actual (`YYYY-MM-DD`).
- No se requiere modificar el enum `invoiceStatus` en la base de datos para no alterar el esquema existente; la condición de vencida se computará dinámicamente en UI/helper o lib/status.
- El componente StatusBadge se actualizará para aceptar la variante o estado 'overdue' / 'Vencida' manteniéndose compatible con data-status.

1. **Añadir soporte y cálculo para facturas vencidas en utilidades y componentes UI** · `src/lib/status.ts`, `src/components/status-badge.tsx`
   - `c1` e2e: La página /facturas carga correctamente la lista de facturas identificada por invoices-table.

2. **Mostrar el distintivo de factura vencida en las vistas de listas y detalle de facturas** · `src/app/(crm)/facturas/page.tsx`, `src/app/(crm)/facturas/[id]/page.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`
   - `c2` e2e: En la página /facturas, si hay facturas pendientes con fecha de vencimiento pasada, el badge status-badge muestra el texto 'Vencida' y el atributo data-status="overdue".
   - `c3` visual: En las capturas de la página facturas a 1280 px y 390 px, las facturas vencidas se destacan visiblemente con la etiqueta de estado Vencida.

## contacto

> Añade una página de contacto con el email y el teléfono de la empresa, enlazada desde el menú.

Se creará la página de contacto `/contacto` con la información de email y teléfono de la empresa, y se añadirá un enlace a la misma en el menú de navegación principal y en las capturas E2E.

Supuestos:
- La información de contacto utilizada será un email de la empresa (contacto@ejemplo.com) y un teléfono de atención (+34 900 123 456).
- La página `/contacto` es una ruta estática dentro de `(crm)` protegida por el AppShell de la aplicación.

1. **Añadir enlace de navegación a Contacto** · `src/components/nav-links.tsx`
   - `c1` e2e: El menú de navegación principal muestra el enlace a Contacto con data-testid `nav-contacto`.

2. **Crear la página de contacto y registrarla en capturas E2E** · `src/app/(crm)/contacto/page.tsx`, `e2e/pages.ts`
   - `c2` e2e: La página /contacto se renderiza con el título de página en page-title y muestra los campos contact-email y contact-phone.
   - `c3` visual: La página de contacto se visualiza correctamente centrada y responsive en las capturas de 1280px y 390px.
