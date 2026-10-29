export type MusicKind = "track" | "album" | "playlist";

export interface TrackLine {
  name: string;
  durationMs: number;
}

/** Datos normalizados de una canción, álbum o playlist de Spotify. */
export interface MusicItem {
  kind: MusicKind;
  id: string;
  uri: string; // spotify:track:xxxx
  url: string; // https://open.spotify.com/...
  title: string;
  artists: string;
  album?: string;
  releaseDate?: string; // YYYY-MM-DD o YYYY
  durationMs?: number;
  totalTracks?: number;
  coverUrl?: string;
  tracks?: TrackLine[];
  genres?: string[]; // géneros del artista principal (si Spotify los entrega)
  label?: string; // sello, sacado del copyright del álbum
  features?: string[]; // artistas invitados en el álbum
}

export type ProductId = "poster-album" | "poster-cancion" | "polaroid" | "placa";
export type ThemeId = "claro" | "oscuro" | "portada";
export type FontId = "moderna" | "condensada" | "editorial" | "impacto" | "mono";
export type AlbumStyle = "minimal" | "titular" | "noche" | "franja" | "degradado";
export type Lang = "es" | "en";

/** Contenido editable de cada diseño del lote. */
export interface DesignContent {
  title: string;
  artists: string;
  subtitle: string; // fecha, álbum, etc.
  dedication: string; // frase/dedicatoria escrita por el cliente
  tracklist: string; // una canción por línea
  elapsed: string; // tiempo de la barra, ej 1:24
  duration: string; // duración total, ej 3:45
  photoDataUrl?: string; // imagen propia (reemplaza la portada)
  // Ficha del álbum (vacío = automático desde Spotify)
  genre?: string;
  label?: string;
  release?: string;
  length?: string;
  feat?: string;
}

export interface BatchEntry {
  key: string;
  item: MusicItem;
  content: DesignContent;
}

/** Ajustes globales del lote (se aplican a todos los diseños). */
export interface DesignSettings {
  product: ProductId;
  widthCm: number;
  heightCm: number;
  bleedMm: number;
  dpi: number;
  theme: ThemeId;
  font: FontId;
  showCode: boolean;
  showPalette: boolean;
  showPlayer: boolean;
  albumStyle: AlbumStyle;
  lang: Lang;
}
