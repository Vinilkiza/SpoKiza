import type { DesignSettings, ThemeId } from "./types";

const CODIGOS: Record<string, Partial<DesignSettings>> = {
  "1": { product: "poster-album", albumStyle: "titular", theme: "claro" },
  "2": { product: "poster-album", albumStyle: "minimal", theme: "claro" },
  "3": { product: "poster-album", albumStyle: "franja", theme: "claro" },
  "4": { product: "poster-album", albumStyle: "noche", theme: "oscuro" },
  "5": { product: "poster-album", albumStyle: "degradado", theme: "portada" },
  "6": { product: "poster-cancion", theme: "claro" },
  "7": { product: "polaroid", widthCm: 8.8, heightCm: 10.7, theme: "claro" },
  "8": { product: "placa", widthCm: 15, heightCm: 20, theme: "oscuro" },
};

const COLORES: Record<string, ThemeId> = {
  claro: "claro", blanco: "claro", a: "claro",
  negro: "oscuro", oscuro: "oscuro", b: "oscuro",
  color: "portada", foto: "portada", "color de la foto": "portada", c: "portada",
};

/** Interpreta el catálogo; las medidas de póster dependen del producto actual en Studio. */
export function parseCodigo(texto: string): Partial<DesignSettings> | null {
  const normalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const match = /^([1-8])(?:(?:\s*-\s*|\s*)([a-z]+(?: [a-z]+)*))?$/.exec(normalizado);
  if (!match) return null;
  const [, numero, color] = match;
  const theme = color ? COLORES[color] : undefined;
  if (color && !Object.hasOwn(COLORES, color)) return null;
  const ajustes = { ...CODIGOS[numero] };
  if (theme && numero !== "4" && numero !== "5") ajustes.theme = theme;
  return ajustes;
}

