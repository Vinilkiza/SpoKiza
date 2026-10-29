import type { BatchEntry, DesignContent, Lang, MusicItem } from "./types";
import { formatDuration } from "./parse";

const year = (d?: string) => (d ? d.slice(0, 4) : "");

/** "La Tortura (feat. Alejandro Sanz)" -> "La Tortura" */
export function cleanTrack(name: string): string {
  return name
    .replace(/\s*[([](?:feat\.?|ft\.?|with|con)\s[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+(?:\d{4}\s+)?remaster(?:ed|izado)?(?:\s+\d{4})?$/i, "")
    .trim();
}

/** "Fijación Oral Volumen 1 (Expanded Edition)" -> "Fijación Oral Volumen 1" */
export function cleanAlbum(name: string): string {
  const cleaned = name
    .replace(/\s*[([][^)\]]*(?:edition|edición|deluxe|remaster|expanded|bonus|version|versión|anniversary|aniversario)[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+[^-]*(?:edition|edición|deluxe|remaster)[^-]*$/i, "")
    .trim();
  return cleaned || name;
}

/** Textos iniciales del diseño a partir de los datos de Spotify (todo se puede editar). */
export function makeContent(item: MusicItem): DesignContent {
  const n = item.totalTracks ?? item.tracks?.length ?? 0;
  const dur = item.durationMs ? formatDuration(item.durationMs) : "";
  let subtitle = "";
  if (item.kind === "album") subtitle = [year(item.releaseDate), n ? `${n} canciones` : "", dur].filter(Boolean).join(" · ");
  if (item.kind === "track") subtitle = [item.album, year(item.releaseDate)].filter(Boolean).join(" · ");
  if (item.kind === "playlist") subtitle = [n ? `${n} canciones` : "", dur].filter(Boolean).join(" · ");
  const totalMs = item.kind === "track" ? item.durationMs ?? 210_000 : item.tracks?.[0]?.durationMs ?? 210_000;
  return {
    title: item.kind === "album" ? cleanAlbum(item.title) : cleanTrack(item.title),
    artists: item.artists,
    subtitle,
    dedication: "",
    tracklist: (item.tracks ?? []).map((t) => cleanTrack(t.name)).join("\n"),
    elapsed: formatDuration(totalMs * 0.38),
    duration: formatDuration(totalMs),
    genre: (item.genres ?? []).map((g) => g.replace(/(^|\s|-)\p{L}/gu, (x) => x.toLocaleUpperCase("es"))).join(" / "),
    label: item.label ?? "",
    release: "",
    length: "",
    feat: (item.features ?? []).join(", "),
  };
}

const MONTHS: Record<Lang, string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "2023-06-29" -> "29 de junio de 2023" / "June 29th, 2023" */
export function formatRelease(date: string | undefined, lang: Lang): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  if (!m) return String(y);
  if (!d) return lang === "es" ? `${MONTHS.es[m - 1]} de ${y}` : `${MONTHS.en[m - 1]} ${y}`;
  return lang === "es" ? `${d} de ${MONTHS.es[m - 1]} de ${y}` : `${MONTHS.en[m - 1]} ${ordinal(d)}, ${y}`;
}

export interface AlbumInfo {
  year: string;
  release: string;
  length: string;
  genre: string;
  label: string;
  feat: string;
}

/** Ficha del álbum: lo que el usuario escribió o, si está vacío, lo automático. */
export function albumInfo(item: MusicItem, c: DesignContent, lang: Lang): AlbumInfo {
  const auto = {
    release: formatRelease(item.releaseDate, lang),
    length: item.durationMs ? formatDuration(item.durationMs) : "",
  };
  return {
    year: item.releaseDate?.slice(0, 4) ?? "",
    release: c.release?.trim() || auto.release,
    length: c.length?.trim() || auto.length,
    genre: c.genre?.trim() ?? "",
    label: c.label?.trim() ?? "",
    feat: c.feat?.trim() ?? "",
  };
}

export const LABELS: Record<Lang, Record<string, string>> = {
  es: {
    genre: "Género",
    release: "Fecha de lanzamiento",
    label: "Sello discográfico",
    length: "Duración",
    releasedOn: "Lanzado el",
    releasedBy: "Publicado por",
    feat: "Feat.",
    tracks: "canciones",
  },
  en: {
    genre: "Genre",
    release: "Release date",
    label: "Release label",
    length: "Length",
    releasedOn: "Released on",
    releasedBy: "Released by",
    feat: "Feat.",
    tracks: "tracks",
  },
};

let counter = 0;
export function makeEntry(item: MusicItem): BatchEntry {
  counter += 1;
  return { key: `${item.kind}-${item.id}-${Date.now()}-${counter}`, item, content: makeContent(item) };
}
