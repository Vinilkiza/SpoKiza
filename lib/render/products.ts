import type { AlbumStyle, DesignSettings, FontId, ProductId, ThemeId } from "../types";

export interface SizePreset {
  label: string;
  w: number; // cm
  h: number; // cm
}

export interface ProductDef {
  id: ProductId;
  label: string;
  description: string;
  sizes: SizePreset[];
  bleedMm: number;
  defaults: Partial<DesignSettings>;
}

const POSTER_SIZES: SizePreset[] = [
  { label: "30 × 45 cm", w: 30, h: 45 },
  { label: "20 × 30 cm", w: 20, h: 30 },
  { label: "30 × 40 cm", w: 30, h: 40 },
  { label: "40 × 50 cm", w: 40, h: 50 },
  { label: "40 × 60 cm", w: 40, h: 60 },
  { label: "50 × 70 cm", w: 50, h: 70 },
  { label: "60 × 90 cm", w: 60, h: 90 },
  { label: "A4 · 21 × 29,7 cm", w: 21, h: 29.7 },
  { label: "A3 · 29,7 × 42 cm", w: 29.7, h: 42 },
  { label: "A2 · 42 × 59,4 cm", w: 42, h: 59.4 },
  { label: "Carta · 21,6 × 27,9 cm", w: 21.59, h: 27.94 },
];

export const PRODUCTS: ProductDef[] = [
  {
    id: "poster-album",
    label: "Poster de álbum",
    description: "Estilo póster de Pinterest: portada, paleta, canciones y ficha del álbum",
    sizes: POSTER_SIZES,
    bleedMm: 3,
    defaults: { showPalette: true, showCode: true, showPlayer: false },
  },
  {
    id: "poster-cancion",
    label: "Poster de canción",
    description: "Portada, reproductor, dedicatoria y código",
    sizes: POSTER_SIZES,
    bleedMm: 3,
    defaults: { showPalette: false, showCode: true, showPlayer: true },
  },
  {
    id: "polaroid",
    label: "Polaroid",
    description: "Foto cuadrada con canción, reproductor y código",
    sizes: [
      { label: "Clásica · 8,8 × 10,7 cm", w: 8.8, h: 10.7 },
      { label: "Mini · 5,4 × 8,6 cm", w: 5.4, h: 8.6 },
      { label: "Grande · 10 × 12 cm", w: 10, h: 12 },
    ],
    bleedMm: 2,
    defaults: { showPalette: false, showCode: true, showPlayer: true },
  },
  {
    id: "placa",
    label: "Placa tipo Spotify",
    description: "Foto, código escaneable, título y reproductor",
    sizes: [
      { label: "15 × 20 cm", w: 15, h: 20 },
      { label: "12 × 16 cm", w: 12, h: 16 },
      { label: "20 × 30 cm", w: 20, h: 30 },
    ],
    bleedMm: 2,
    defaults: { showPalette: false, showCode: true, showPlayer: true, theme: "oscuro" },
  },
];

export const productById = (id: ProductId) => PRODUCTS.find((p) => p.id === id)!;

export const DEFAULT_SETTINGS: DesignSettings = {
  product: "poster-album",
  widthCm: 30,
  heightCm: 45,
  bleedMm: 3,
  dpi: 300,
  theme: "claro",
  font: "condensada",
  showCode: true,
  showPalette: true,
  showPlayer: false,
  albumStyle: "titular",
  lang: "es",
};

export interface FontDef {
  label: string;
  title: string;
  titleWeight: number;
  body: string;
  bodyWeight: number;
  bodyBold: number;
  bodyScale: number; // ajuste de tamaño para que todas lean igual
  italic: string;
}

export const FONTS: Record<FontId, FontDef> = {
  moderna: { label: "Moderna", title: "'Inter'", titleWeight: 800, body: "'Inter'", bodyWeight: 500, bodyBold: 800, bodyScale: 1, italic: "'Playfair Display'" },
  condensada: { label: "Condensada", title: "'Bebas Neue'", titleWeight: 400, body: "'Bebas Neue'", bodyWeight: 400, bodyBold: 400, bodyScale: 1.3, italic: "'Playfair Display'" },
  impacto: { label: "Impacto", title: "'Anton'", titleWeight: 400, body: "'Inter'", bodyWeight: 500, bodyBold: 800, bodyScale: 1, italic: "'Playfair Display'" },
  editorial: { label: "Editorial", title: "'Playfair Display'", titleWeight: 700, body: "'Inter'", bodyWeight: 500, bodyBold: 800, bodyScale: 1, italic: "'Playfair Display'" },
  mono: { label: "Mono", title: "'Space Mono'", titleWeight: 700, body: "'Space Mono'", bodyWeight: 400, bodyBold: 700, bodyScale: 0.9, italic: "'Space Mono'" },
};

export interface AlbumStyleDef {
  id: AlbumStyle;
  label: string;
  hint: string;
  theme: ThemeId;
  font: FontId;
  paper: string; // color de papel cuando el tema es "claro"
}

/** Estilos de póster de álbum (inspirados en las referencias de Pinterest). */
export const ALBUM_STYLES: AlbumStyleDef[] = [
  { id: "titular", label: "Titular", hint: "Artista arriba, título gigante abajo", theme: "claro", font: "condensada", paper: "#f8f6f9" },
  { id: "minimal", label: "Minimal", hint: "Limpio, con líneas y ficha abajo", theme: "claro", font: "moderna", paper: "#f2f0eb" },
  { id: "franja", label: "Franja", hint: "Título arriba y barra de colores", theme: "claro", font: "condensada", paper: "#ecebe7" },
  { id: "noche", label: "Noche", hint: "Foto a sangre que se funde en negro", theme: "oscuro", font: "moderna", paper: "#f3efe7" },
  { id: "degradado", label: "Degradado", hint: "Foto que se funde al color del álbum", theme: "portada", font: "moderna", paper: "#f3efe7" },
];
