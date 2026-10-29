import "server-only";
import type { MusicItem, MusicKind, TrackLine } from "./types";
import { isShortLink, parseSpotifyRef, type ParsedRef } from "./parse";

/* Conexión a la Web API de Spotify con Client Credentials.
   El Client Secret nunca sale del servidor (vive en .env.local). */

const API = "https://api.spotify.com/v1";
let cached: { token: string; expiresAt: number } | null = null;

export class SpotifyError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new SpotifyError(
      "Faltan SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en el archivo .env.local (ver README).",
      500,
    );
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new SpotifyError(
      `Spotify rechazó las credenciales (${res.status}). Revisa el Client ID/Secret y que la cuenta dueña de la app tenga Premium.`,
      401,
    );
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function api<T>(path: string, retry = true): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401 && retry) {
    cached = null;
    return api<T>(path, false);
  }
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after") ?? "2");
    if (retry && wait <= 10) {
      await new Promise((r) => setTimeout(r, wait * 1000));
      return api<T>(path, false);
    }
    throw new SpotifyError("Spotify está limitando las consultas (cuota agotada). Espera unos minutos.", 429);
  }
  if (res.status === 404) throw new SpotifyError("Spotify no encontró ese contenido.", 404);
  if (!res.ok) throw new SpotifyError(`Error de Spotify (${res.status}).`, res.status);
  return (await res.json()) as T;
}

/* ---------- Tipos mínimos de la respuesta de Spotify ---------- */
interface SImage { url: string; width: number | null; height: number | null }
interface SArtist { name: string; id?: string }
interface SAlbum {
  id: string; uri: string; name: string; release_date?: string; total_tracks?: number;
  images: SImage[]; artists: SArtist[]; external_urls?: { spotify?: string };
  copyrights?: { text: string; type: string }[];
  tracks?: { items: { name: string; duration_ms: number; artists?: SArtist[] }[]; next: string | null };
}
interface STrack {
  id: string; uri: string; name: string; duration_ms: number; artists: SArtist[];
  album: SAlbum; external_urls?: { spotify?: string };
}
interface SPlaylist {
  id: string; uri: string; name: string; description?: string; images: SImage[] | null;
  owner?: { display_name?: string }; external_urls?: { spotify?: string };
  items?: { total?: number; items?: { item?: { name: string; duration_ms: number; artists?: SArtist[] } | null }[] };
  tracks?: { total?: number };
}

function bestImage(images: SImage[] | null | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  return [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url;
}
const names = (a: SArtist[]) => a.map((x) => x.name).join(", ");

function fromTrack(t: STrack): MusicItem {
  return {
    kind: "track",
    id: t.id,
    uri: t.uri,
    url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
    title: t.name,
    artists: names(t.artists),
    album: t.album?.name,
    releaseDate: t.album?.release_date,
    durationMs: t.duration_ms,
    coverUrl: bestImage(t.album?.images),
  };
}

/** "℗ 2023 Rimas Entertainment LLC" -> "Rimas Entertainment LLC" */
function labelFromCopyrights(c?: { text: string; type: string }[]): string | undefined {
  if (!c?.length) return undefined;
  const pick = c.find((x) => x.type === "P") ?? c[0];
  const clean = pick.text
    .replace(/[℗©]|\((?:P|C)\)/gi, "")
    .replace(/^\s*(?:\d{4}\s*)+/, "")
    .replace(/\s*,?\s*(?:under exclusive license to|bajo licencia exclusiva de|distributed by)[\s\S]*$/i, "")
    .trim();
  return clean || undefined;
}

async function artistGenres(id?: string): Promise<string[]> {
  if (!id) return [];
  try {
    const a = await api<{ genres?: string[] }>(`/artists/${id}`);
    return (a.genres ?? []).slice(0, 3);
  } catch {
    return [];
  }
}

async function getAlbum(id: string): Promise<MusicItem> {
  const a = await api<SAlbum>(`/albums/${id}`);
  type STr = { name: string; duration_ms: number; artists?: SArtist[] };
  const raw: STr[] = [...(a.tracks?.items ?? [])];
  let next = a.tracks?.next ?? null;
  while (next && raw.length < 200) {
    const page = await api<{ items: STr[]; next: string | null }>(next.replace(API, ""));
    raw.push(...page.items);
    next = page.next;
  }
  const tracks: TrackLine[] = raw.map((t) => ({ name: t.name, durationMs: t.duration_ms }));
  const main = new Set(a.artists.map((x) => x.name.toLowerCase()));
  const features = [...new Set(raw.flatMap((t) => (t.artists ?? []).map((x) => x.name)))]
    .filter((n) => !main.has(n.toLowerCase()))
    .slice(0, 8);
  return {
    kind: "album",
    id: a.id,
    uri: a.uri,
    url: a.external_urls?.spotify ?? `https://open.spotify.com/album/${a.id}`,
    title: a.name,
    artists: names(a.artists),
    releaseDate: a.release_date,
    totalTracks: a.total_tracks ?? tracks.length,
    durationMs: tracks.reduce((s, t) => s + t.durationMs, 0),
    coverUrl: bestImage(a.images),
    tracks,
    genres: await artistGenres(a.artists[0]?.id),
    label: labelFromCopyrights(a.copyrights),
    features,
  };
}

async function getPlaylist(id: string): Promise<MusicItem> {
  const p = await api<SPlaylist>(`/playlists/${id}`);
  // Desde feb-2026 Spotify solo entrega las canciones de playlists propias de la cuenta.
  // Para playlists ajenas llega solo nombre, portada y dueño: la lista se escribe a mano.
  const tracks: TrackLine[] = (p.items?.items ?? [])
    .map((x) => x.item)
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((t) => ({ name: t.artists?.length ? `${t.name} — ${names(t.artists)}` : t.name, durationMs: t.duration_ms }));
  return {
    kind: "playlist",
    id: p.id,
    uri: p.uri,
    url: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
    title: p.name,
    artists: p.owner?.display_name ?? "",
    totalTracks: p.items?.total ?? p.tracks?.total ?? tracks.length,
    durationMs: tracks.length ? tracks.reduce((s, t) => s + t.durationMs, 0) : undefined,
    coverUrl: bestImage(p.images),
    tracks,
  };
}

export async function getItem(ref: ParsedRef): Promise<MusicItem> {
  if (ref.kind === "track") return fromTrack(await api<STrack>(`/tracks/${ref.id}`));
  if (ref.kind === "album") return getAlbum(ref.id);
  return getPlaylist(ref.id);
}

/** Convierte un spotify.link corto en su link largo siguiendo la redirección. */
async function expandShortLink(url: string): Promise<ParsedRef | null> {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  const direct = parseSpotifyRef(res.url);
  if (direct) return direct;
  const html = await res.text();
  const m = html.match(/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]{10,40})/);
  return m ? { kind: m[1] as MusicKind, id: m[2] } : null;
}

export async function resolveInput(input: string): Promise<MusicItem> {
  let ref = parseSpotifyRef(input);
  if (!ref && isShortLink(input)) ref = await expandShortLink(input.trim());
  if (!ref) throw new SpotifyError(`No reconozco este link: ${input}`, 400);
  return getItem(ref);
}

export async function search(q: string, type: "track" | "album" | "playlist"): Promise<MusicItem[]> {
  const params = new URLSearchParams({ q, type, limit: "10", market: "CO" });
  const data = await api<{
    tracks?: { items: (STrack | null)[] };
    albums?: { items: (SAlbum | null)[] };
    playlists?: { items: (SPlaylist | null)[] };
  }>(`/search?${params}`);
  if (type === "track") return (data.tracks?.items ?? []).filter(Boolean).map((t) => fromTrack(t!));
  if (type === "album")
    return (data.albums?.items ?? []).filter(Boolean).map((a) => ({
      kind: "album" as const,
      id: a!.id,
      uri: a!.uri,
      url: a!.external_urls?.spotify ?? `https://open.spotify.com/album/${a!.id}`,
      title: a!.name,
      artists: names(a!.artists),
      releaseDate: a!.release_date,
      totalTracks: a!.total_tracks,
      coverUrl: bestImage(a!.images),
    }));
  return (data.playlists?.items ?? []).filter(Boolean).map((p) => ({
    kind: "playlist" as const,
    id: p!.id,
    uri: p!.uri,
    url: p!.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p!.id}`,
    title: p!.name,
    artists: p!.owner?.display_name ?? "",
    coverUrl: bestImage(p!.images),
  }));
}
