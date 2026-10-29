"use client";

import type { BatchEntry, DesignSettings } from "../types";
import { codeBarColor, extractPalette, themeColors } from "./color";
import type { Img } from "./draw";
import { renderDesign, type RenderAssets } from "./templates";
import { ALBUM_STYLES } from "./products";
import type { EditBox } from "./kit";

/* Carga de imágenes con caché, preparación de colores y render a cualquier resolución. */

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  const hit = imgCache.get(src);
  if (hit) return hit;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imgCache.set(src, p);
  p.then((r) => {
    if (!r) imgCache.delete(src); // permite reintentar si falló
  });
  return p;
}

export const coverSrc = (url?: string) => (url ? `/api/img?url=${encodeURIComponent(url)}` : null);

const codeCache = new Map<string, Promise<Img | null>>();

/** Spotify Code en vector (SVG) para que quede nítido a cualquier tamaño; si falla, usa PNG. */
export function loadCode(uri: string, bg: string, color: "white" | "black"): Promise<Img | null> {
  const key = `${uri}|${bg}|${color}`;
  const hit = codeCache.get(key);
  if (hit) return hit;
  const base = `/api/code?uri=${encodeURIComponent(uri)}&bg=${bg.replace("#", "")}&color=${color}`;
  const p = (async () => {
    try {
      const res = await fetch(`${base}&format=svg`);
      if (!res.ok) throw new Error("svg");
      let svg = await res.text();
      // Asegura ancho/alto explícitos para que el navegador lo rasterice bien al escalar
      const vb = svg.match(/viewBox="([\d.\s-]+)"/);
      if (vb) {
        const [, , w, h] = vb[1].trim().split(/\s+/).map(Number);
        svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, "<svg$1").replace(/<svg([^>]*?)\sheight="[^"]*"/, "<svg$1");
        svg = svg.replace("<svg", `<svg width="${w * 4}" height="${h * 4}"`);
      }
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const img = await loadImage(url);
      if (!img) throw new Error("svg-load");
      return img;
    } catch {
      return loadImage(`${base}&format=png`);
    }
  })();
  codeCache.set(key, p);
  return p;
}

export interface Prepared {
  assets: RenderAssets;
}

export async function prepare(entry: BatchEntry, settings: DesignSettings): Promise<RenderAssets> {
  const src = entry.content.photoDataUrl || coverSrc(entry.item.coverUrl);
  const image = src ? await loadImage(src) : null;
  const palette = image ? extractPalette(image, 6) : [];
  const paper =
    settings.product === "polaroid"
      ? "#fbfaf7"
      : settings.product === "poster-album"
        ? ALBUM_STYLES.find((s) => s.id === settings.albumStyle)?.paper ?? "#f3efe7"
        : "#f3efe7";
  const colors = themeColors(settings.theme, palette, paper);
  const code = settings.showCode ? await loadCode(entry.item.uri, colors.bg, codeBarColor(colors.bg)) : null;
  return { image, code, palette, colors };
}

export function sizePx(settings: DesignSettings, pxPerMm: number) {
  const bleed = Math.round(settings.bleedMm * pxPerMm);
  const W = Math.round(settings.widthCm * 10 * pxPerMm) + bleed * 2;
  const H = Math.round(settings.heightCm * 10 * pxPerMm) + bleed * 2;
  return { W, H, bleed };
}

/** Dibuja el diseño en un canvas nuevo con la resolución pedida (px por mm). */
export function renderCanvas(
  entry: BatchEntry, settings: DesignSettings, assets: RenderAssets, pxPerMm: number,
  target?: HTMLCanvasElement,
  boxes?: EditBox[],
): HTMLCanvasElement {
  const { W, H, bleed } = sizePx(settings, pxPerMm);
  const canvas = target ?? document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo crear el lienzo (archivo muy grande).");
  renderDesign(ctx, { W, H, bleed, settings, content: entry.content, item: entry.item, assets, boxes });
  return canvas;
}

export const dpiToPxPerMm = (dpi: number) => dpi / 25.4;

/** Espera a que las fuentes estén listas antes de dibujar en el canvas. */
export async function ensureFonts() {
  if (typeof document === "undefined") return;
  const specs = [
    "800 40px 'Inter'", "600 40px 'Inter'", "500 40px 'Inter'", "400 40px 'Inter'",
    "500 40px 'Montserrat'", "600 40px 'Montserrat'", "700 40px 'Montserrat'", "800 40px 'Montserrat'",
    "700 40px 'Playfair Display'", "italic 400 40px 'Playfair Display'",
    "400 40px 'Anton'", "400 40px 'Bebas Neue'", "900 40px 'Montserrat'", "400 40px 'Space Mono'", "700 40px 'Space Mono'", "italic 400 40px 'Space Mono'",
  ];
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => null)));
}
