# crm-agents

Prueba técnica para Speed Paradigm: un equipo de tres agentes de IA (Orquestador, Develop y Testing) y un humano que aprueba modifican un mini CRM (clientes, presupuestos y facturas) a partir de peticiones en lenguaje natural.

Este repo contiene el panel web, el motor de runs y los agentes. El CRM que modifican vive en un repo aparte, `crm-demo`.

- Decisiones de arquitectura: [`docs/DECISIONES.md`](./docs/DECISIONES.md)
- Proceso, hitos y sesiones: [`docs/PROCESO.md`](./docs/PROCESO.md)

## Estado

H0 hecho: esqueleto con Next.js, Drizzle + Neon, CI y despliegue en Vercel. Producción: <https://crm-agents.vercel.app> · comprobación en [`/api/health`](https://crm-agents.vercel.app/api/health).

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local   # rellena DATABASE_URL
pnpm db:migrate
pnpm dev
```
