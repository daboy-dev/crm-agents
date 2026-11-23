# Proceso

Cómo se ha construido este proyecto, sesión a sesión.

**Método de trabajo:**
- **Planificación y decisiones** en un Project de Claude dedicado a la prueba (claude.ai). Ahí se discuten las opciones y se deciden.
- **Implementación** con **Claude Code** en este repo, una sesión por hito.
- Al cerrar cada sesión:
  - Una entrada aquí con objetivo, cómo fue, qué salió mal y qué se corrigió.
  - La transcripción en [`docs/sesiones/`](./sesiones), sin claves ni datos sensibles.
  - `CLAUDE.md` actualizado si cambia algo del proyecto.
- Las decisiones de arquitectura están en [`DECISIONES.md`](./DECISIONES.md).

## Hitos

| Hito | Se da por verificado cuando… | Estado |
|---|---|---|
| H0 · Plan y base del repo | Plan validado, documentos en el repo, esqueleto desplegado en Vercel con CI en verde | En curso |
| H1 · CRM demo | `crm-demo` en producción con clientes, presupuestos y facturas | Pendiente |
| H2 · Tubería sin IA | Un commit de prueba genera vista previa, webhook y capturas de Actions que llegan al panel | Pendiente |
| H3 · Panel y motor de runs | Login y un run completo con `MockProvider` | Pendiente |
| H4 · Orquestador | Plan con criterios de aceptación que el cliente aprueba o rechaza | Pendiente |
| H5 · Develop | PR real que compila en su vista previa | Pendiente |
| H6 · Testing | Un fallo provocado vuelve a Develop y se corrige o se bloquea | Pendiente |
| H7 · Panel completo | Run real de principio a fin en móvil y escritorio | Pendiente |
| H8 · Entrega | README, documentación, transcripciones saneadas y respuestas | Pendiente |

---

## Sesión 00 · Planificación (Project de Claude) · 23/11/2026

**Objetivo:** entender la prueba y la oferta, y decidir la arquitectura y el plan por hitos antes de escribir código.

**Cómo fue:**
- Se leyeron la prueba y la oferta.
- El producto elegido es un mini CRM (clientes, presupuestos, facturas), por cercanía a lo que hace la empresa.
- Se definieron los agentes: Orquestador, Develop y Testing, más la aprobación humana.

**Qué cambió por el camino:**
- Claude propuso primero un CRM declarativo, en el que Develop editaría una especificación JSON (es seguro y rápido). Se descartó: la prueba pide que Develop escriba código, así que se eligió el flujo real de rama, PR y vista previa en Vercel (D1).
- La revisión visual en escritorio y móvil necesita un navegador. Chromium en una función de Vercel gratuita se consideró demasiado pesado, así que Playwright pasa a GitHub Actions contra la URL de la vista previa (D5).
- Para no arriesgar el panel, el CRM se separa en su propio repo, proyecto de Vercel y proyecto de Neon (D2, D7).

**Resultado:** decisiones D1–D10, plan de hitos H0–H8 y un Whiteboard con el flujo de un run. Resumen de la sesión en [`sesiones/00-planificacion.md`](./sesiones/00-planificacion.md).

**Siguiente paso:** sesión 01 de Claude Code (H0): esqueleto del repo, CI y primer despliegue.
