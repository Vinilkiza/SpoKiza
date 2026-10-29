import type { MusicKind } from "./types";

export interface ParsedRef {
  kind: MusicKind;
  id: string;
}

const KINDS = "track|album|playlist";

/**
 * Reconoce links y URIs de Spotify:
 *  - https://open.spotify.com/track/ID?si=...
 *  - https://open.spotify.com/intl-es/album/ID
 *  - spotify:playlist:ID
 * Devuelve null si el texto no es un link directo (ej. spotify.link o una búsqueda).
 */
export function parseSpotifyRef(input: string): ParsedRef | null {
  const text = input.trim();
  const uri = text.match(new RegExp(`^spotify:(${KINDS}):([A-Za-z0-9]{10,40})$`));
  if (uri) return { kind: uri[1] as MusicKind, id: uri[2] };
  const url = text.match(
    new RegExp(`open\\.spotify\\.com/(?:intl-[a-z-]+/)?(?:embed/)?(${KINDS})/([A-Za-z0-9]{10,40})`, "i"),
  );
  if (url) return { kind: url[1].toLowerCase() as MusicKind, id: url[2] };
  return null;
}

export function isShortLink(input: string): boolean {
  return /^https?:\/\/(spotify\.link|spotify\.app\.link)\//i.test(input.trim());
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "1:24" -> segundos */
export function parseClock(text: string): number {
  const parts = text.trim().split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
