import type { ThemeId } from "../types";

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Luminancia relativa (0 = negro, 1 = blanco) */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
}

function dist(a: RGB, b: RGB): number {
  return Math.sqrt((a[0] - b[0]) ** 2 * 0.3 + (a[1] - b[1]) ** 2 * 0.59 + (a[2] - b[2]) ** 2 * 0.11);
}

/**
 * Saca los colores principales de una imagen (portada o foto propia).
 * Cuantiza a 4 bits por canal, cuenta y se queda con colores distintos entre sí.
 */
export function extractPalette(img: CanvasImageSource & { width: number; height: number }, count = 5): string[] {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++; bk.r += r; bk.g += g; bk.b += b;
    buckets.set(key, bk);
  }
  const ranked = [...buckets.values()]
    .map((b) => ({ rgb: [b.r / b.n, b.g / b.n, b.b / b.n] as RGB, n: b.n }))
    .sort((a, b) => b.n - a.n);
  const picked: RGB[] = [];
  for (const cand of ranked) {
    if (picked.every((p) => dist(p, cand.rgb) > 38)) picked.push(cand.rgb);
    if (picked.length >= count) break;
  }
  return picked.map(rgbToHex);
}

export interface ThemeColors {
  bg: string;
  fg: string;
  muted: string;
  line: string;
  track: string; // fondo de la barra de reproducción
}

/** Colores del diseño según el tema elegido. */
export function themeColors(theme: ThemeId, palette: string[], paper = "#f3efe7"): ThemeColors {
  if (theme === "oscuro") {
    return { bg: "#121212", fg: "#f4f4f2", muted: "#a5a5a2", line: "#f4f4f2", track: "#4a4a48" };
  }
  if (theme === "portada" && palette.length) {
    // El color con más presencia que tenga algo de cuerpo; se oscurece/aclara para que el texto lea bien.
    const rich =
      palette.find((h) => {
        const l = luminance(h);
        return saturation(hexToRgb(h)) > 0.25 && l > 0.03 && l < 0.7;
      }) ?? palette[0];
    const l = luminance(rich);
    const bg = l > 0.45 ? mix(rich, "#ffffff", 0.15) : l < 0.04 ? mix(rich, "#ffffff", 0.06) : rich;
    const dark = luminance(bg) > 0.35;
    const fg = dark ? mix(bg, "#000000", 0.85) : mix(bg, "#ffffff", 0.94);
    return { bg, fg, muted: mix(fg, bg, 0.35), line: fg, track: mix(fg, bg, 0.7) };
  }
  return { bg: paper, fg: "#161616", muted: "#6c6760", line: "#161616", track: "#cfc9bf" };
}

export function codeBarColor(bg: string): "white" | "black" {
  return luminance(bg) > 0.4 ? "black" : "white";
}
