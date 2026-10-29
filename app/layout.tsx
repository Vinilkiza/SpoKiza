import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/anton/400.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/400-italic.css";
import "@fontsource/space-mono/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vinilkiza Música",
  description: "Editor de posters, polaroids y placas a partir de canciones, álbumes y playlists",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
