# Evals de Develop (`pnpm eval:develop`)

Generado el 2026-11-25 con la cadena de Develop (D35, D36) sobre los planes de [README.md](README.md). Cada tarea se resuelve con su contexto de D32 sobre un worktree de `crm-demo` en el `baseSha` del plan, y al final se aplican las comprobaciones de `pr-check` (D31, D33). Si fallan, todas las tareas vuelven a Develop con los errores, hasta 3 iteraciones, como en el motor. El diff final está en cada `develop-<petición>.diff`.

| Petición | Tareas | Iteraciones | Llamadas | Modelos | Tokens (entrada → salida) | Migración | tsc | ESLint |
|---|---|---|---|---|---|---|---|---|
| [nif](develop-nif.json) | 3 | 1 | 3 | gemini:gemini-3.6-flash, gemini:gemini-3.8-flash | 29081 → 9852 | ✅ generada | ✅ | ✅ |
| [contacto](develop-contacto.json) | 2 | 1 | 2 | gemini:gemini-3.8-flash, gemini:gemini-3.6-flash | 13829 → 1634 | ✅ sin cambios | ✅ | ✅ |
| [facturas-vencidas](develop-facturas-vencidas.json) | 2 | 1 | 2 | gemini:gemini-3.8-flash, gemini:gemini-3.6-flash | 20068 → 4135 | ✅ sin cambios | ✅ | ✅ |
| [buscador](develop-buscador.json) | 1 | 1 | 1 | gemini:gemini-3.6-flash | 8708 → 1623 | ✅ sin cambios | ✅ | ✅ |

## nif

> Añade el NIF a los clientes: se introduce en el formulario de alta y edición y se ve en el detalle y en la lista.

### Iteración 1

1. **Añadir campo nif al esquema de base de datos y validaciones** · committed · `feat(clients): add nif field to database schema and validation`
   - Notas: He añadido la columna `nif` como `text()` opcional (nullable) en el esquema de Drizzle `clients`. También se ha actualizado el validador Zod y la constante `clientFields` en `validation.ts` para incluir `nif` como campo de texto opcional.
   - Archivos: `src/db/schema.ts`, `src/app/(crm)/clientes/validation.ts`

2. **Añadir campo NIF al formulario de alta y edición de clientes** · committed · `feat(clients): add nif field to client form and edit page`
   - Notas: Se ha añadido el campo NIF al formulario de clientes (con data-testid='field-nif' generado automáticamente por Field) y se ha pasado el valor inicial en la página de edición de clientes.
   - Archivos: `src/app/(crm)/clientes/client-form.tsx`, `src/app/(crm)/clientes/[id]/editar/page.tsx`

3. **Mostrar el NIF en la lista y detalle de clientes** · committed · `feat(clients): display NIF in list and detail views`
   - Notas: He añadido la columna NIF a la tabla de clientes en `/clientes` y el elemento correspondiente en la lista de detalles (`DetailList`) en `/clientes/[id]` con el data-testid `client-nif`. Además, he actualizado los datos del seed (`src/db/seed.ts`) para incluir NIFs de prueba en los clientes.
   - Archivos: `src/app/(crm)/clientes/page.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`, `src/db/seed.ts`

pr-check: en verde (drizzle-kit ✅ · tsc ✅ · ESLint ✅)

## contacto

> Añade una página de contacto con el email y el teléfono de la empresa, enlazada desde el menú.

### Iteración 1

1. **Añadir enlace de navegación a Contacto** · committed · `feat(nav): add contact link to navigation`
   - Notas: Se ha añadido el enlace de navegación hacia /contacto con el texto 'Contacto' en NAV_ITEMS. El atributo data-testid se genera automáticamente como nav-contacto respetando el patrón existente.
   - Archivos: `src/components/nav-links.tsx`

2. **Crear la página de contacto y registrarla en capturas E2E** · committed · `feat(contact): add contact page and register in E2E page list`
   - Notas: He creado la página de contacto en src/app/(crm)/contacto/page.tsx incluyendo tarjetas estilizadas con Tailwind para email, teléfono y horario. He añadido los testids `contact-page`, `contact-email` y `contact-phone`. Además, he registrado la ruta `/contacto` en `e2e/pages.ts` para que se capturen screenshots en Playwright.
   - Archivos: `src/app/(crm)/contacto/page.tsx`, `e2e/pages.ts`

pr-check: en verde (drizzle-kit ✅ · tsc ✅ · ESLint ✅)

## facturas-vencidas

> Marca las facturas vencidas: las que siguen pendientes de pago con la fecha de vencimiento ya pasada deben destacarse en la lista de facturas.

### Iteración 1

1. **Añadir soporte y cálculo para facturas vencidas en utilidades y componentes UI** · committed · `feat(invoices): add overdue status support and styling in StatusBadge`
   - Notas: Se ha añadido el tipo `InvoiceDisplayStatus` ('pending' | 'paid' | 'overdue') y la función `getInvoiceDisplayStatus` en `src/lib/status.ts` para determinar si una factura pendiente tiene la fecha de vencimiento superada. Además, se ha actualizado `StatusBadge` para dar soporte al estado 'overdue' con la etiqueta 'Vencida', `data-status="overdue"` y estilos en rojo (`bg-red-100 text-red-800`), aceptando opcionalmente `dueAt` o directamente el estado.
   - Archivos: `src/lib/status.ts`, `src/components/status-badge.tsx`

2. **Mostrar el distintivo de factura vencida en las vistas de listas y detalle de facturas** · committed · `feat(invoices): show overdue badge for pending invoices past due date`
   - Notas: Se ha actualizado la renderización del componente StatusBadge en las vistas de facturas (lista /facturas, detalle /facturas/[id] y lista dentro del detalle de cliente /clientes/[id]) pasando la propiedad dueAt={invoice.dueAt}. StatusBadge ya calcula automáticamente el estado 'overdue' (y muestra 'Vencida' con data-status="overdue") si la factura está en estado 'pending' y su fecha de vencimiento es anterior a la fecha actual.
   - Archivos: `src/app/(crm)/facturas/page.tsx`, `src/app/(crm)/facturas/[id]/page.tsx`, `src/app/(crm)/clientes/[id]/page.tsx`

pr-check: en verde (drizzle-kit ✅ · tsc ✅ · ESLint ✅)

## buscador

> Añade un buscador en la lista de clientes que filtre por nombre o por email.

### Iteración 1

1. **Añadir filtro por nombre o email en consultas de clientes y UI de búsqueda** · committed · `feat(clients): add search filter by name or email`
   - Notas: He actualizado la función listClients para aceptar un término de búsqueda opcional y filtrar mediante ilike por nombre o email. En la UI de /clientes, he añadido un formulario GET con el input con data-testid="client-search-input", leyendo los searchParams dentro del componente envuelto en Suspense y llamando a connection() según los requerimientos de Next.js 16.
   - Archivos: `src/app/(crm)/clientes/queries.ts`, `src/app/(crm)/clientes/page.tsx`

pr-check: en verde (drizzle-kit ✅ · tsc ✅ · ESLint ✅)
