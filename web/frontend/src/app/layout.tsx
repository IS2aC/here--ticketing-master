import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Here! · Ticketing Master",
  description: "Vos événements méritent plus qu'un simple billet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" data-theme="light" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
