import Link from "next/link";
const DOCS_URL = "https://github.com/daboy-dev/crm-agents/tree/master/docs";

export default function Home() {
  return (
    <main className="home">
      <h1>crm-agents · H3</h1>
      <p>
        Equipo de agentes de IA (Orquestador, Develop y Testing) que modifica un
        mini CRM a partir de peticiones en lenguaje natural.
      </p>
      <ul>
        <li>
          <a href={DOCS_URL}>Documentación del proyecto</a>
        </li>
        <li>
          <Link href="/runs">Runs (H3)</Link>
        </li>
        <li>
          <Link href="/pipeline">Pipeline de vistas previas (H2)</Link>
        </li>
        <li>
          <a href="/api/health">Estado del servicio</a>
        </li>
      </ul>
    </main>
  );
}
