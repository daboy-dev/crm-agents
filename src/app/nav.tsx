import Link from "next/link";
import { logout } from "@/app/login/actions";

/** Header shared by the private pages. */
export function Nav({ title }: { title: string }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <nav className="row">
        <Link href="/runs">Runs</Link>
        <Link href="/pipeline">Pipeline</Link>
        <form action={logout}>
          <button
            type="submit"
            className="secondary"
            data-testid="logout-button"
          >
            Salir
          </button>
        </form>
      </nav>
    </header>
  );
}
