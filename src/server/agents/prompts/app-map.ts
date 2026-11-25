/**
 * Where the existing data-testid of crm-demo live (H6). The orchestrator
 * lists them in the criteria and Testing builds the steps with them (D38):
 * the first eval showed both agents guessing pages and inventing names. Keep
 * it in sync with AGENTS.md when crm-demo changes.
 */
export const APP_MAP = `## Mapa de crm-demo (data-testid que ya existen)
- Tras iniciar sesión se llega a /clientes. Cada página tiene page-title. El menú tiene un enlace nav-<ruta> por página (nav-clientes, nav-facturas…): lo genera el menú a partir de la ruta, así que una página nueva /resumen tiene nav-resumen, sin otro nombre.
- /clientes: new-client-button (abre /clientes/nuevo), client-search-input, clients-table y una fila client-row por cliente (el nombre es el enlace al detalle).
- Detalle de un cliente (page cliente-detalle, o la página a la que lleva guardar el alta): client-detail, edit-client-button (abre el formulario de edición), new-quote-for-client-button, client-quotes-table, client-invoices-table.
- /clientes/nuevo y la edición: client-form, un campo field-<name> por campo (field-name, field-email, field-company…) y save-button. Guardar lleva al detalle.
- /presupuestos: new-quote-button, quotes-table y filas quote-row.
- Detalle de un presupuesto (page presupuesto-detalle): quote-detail, status-badge (con data-status), field-status y change-status-button, generate-invoice-button, items-table con filas item-row, total-total.
- /facturas: invoices-table, filas invoice-row con su status-badge. Detalle de una factura: invoice-detail, status-badge, mark-paid-button.
- status-badge muestra la etiqueta en español: Borrador, Enviado, Aceptado o Rechazado en los presupuestos, y Pendiente o Pagada en las facturas. El valor interno (draft, sent, accepted, rejected, pending, paid) solo está en data-status y en los value de field-status: expectText compara la etiqueta.`;
