import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "crm-agents",
  description: "Equipo de agentes de IA que modifica un mini CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
