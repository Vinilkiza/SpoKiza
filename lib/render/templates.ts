import type { DesignContent, DesignSettings, MusicItem } from "../types";
import type { ThemeColors } from "./color";
import { FONTS } from "./products";
import { parseClock } from "../parse";
import { renderAlbum } from "./album";
import {
  type Ctx, type Img, drawControls, drawCover, drawPlaceholder, drawPlayerBar,
  ellipsize, fitFont, setFont, wrapLines,
} from "./draw";

export interface RenderAssets {
  image: Img | null; // foto propia o portada
  code: Img | null; // Spotify Code
  palette: string[];
  colors: ThemeColors;
}

export interface RenderOpts {
  W: number; // ancho total en px (incluye sangrado)
  H: number;
  bleed: number; // sangrado en px por lado
  settings: DesignSettings;
  content: DesignContent;
  item: MusicItem;
  assets: RenderAssets;
}

interface Frame {
  x0: number; y0: number; tw: number; th: number; u: number;
}

export function renderDesign(ctx: Ctx, o: RenderOpts) {
  const { W, H, bleed, assets } = o;
  ctx.save();
  ctx.fillStyle = assets.colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const f: Frame = { x0: bleed, y0: bleed, tw: W - 2 * bleed, th: H - 2 * bleed, u: (W - 2 * bleed) / 100 };
  switch (o.settings.product) {
    case "poster-album":
      renderAlbum(ctx, f, o);
      break;
    case "poster-cancion":
      posterSong(ctx, f, o);
      break;
    case "polaroid":
      polaroid(ctx, f, o);
      break;
    case "placa":
      plaque(ctx, f, o);
      break;
  }
  ctx.restore();
}

/* ---------------- piezas comunes ---------------- */

function image(ctx: Ctx, o: RenderOpts, x: number, y: number, w: number, h: number, r = 0) {
  if (o.assets.image) drawCover(ctx, o.assets.image, x, y, w, h, r);
  else drawPlaceholder(ctx, x, y, w, h, o.assets.colors.track, o.assets.colors.muted, r);
}

function codeHeight(o: RenderOpts, width: number): number {
  if (!o.settings.showCode || !o.assets.code) return 0;
  return width * (o.assets.code.height / o.assets.code.width);
}

function drawCode(ctx: Ctx, o: RenderOpts, x: number, y: number, width: number) {
  if (!o.settings.showCode || !o.assets.code) return;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(o.assets.code, x, y, width, codeHeight(o, width));
}

function progress(c: DesignContent): number {
  const total = parseClock(c.duration);
  return total > 0 ? parseClock(c.elapsed) / total : 0.35;
}

/** Barra + tiempos + controles. Devuelve la altura usada. */
function player(ctx: Ctx, o: RenderOpts, x: number, y: number, w: number, u: number, scale = 1): number {
  const { colors } = o.assets;
  const thick = 0.75 * u * scale;
  drawPlayerBar(ctx, x, y + thick, w, progress(o.content), colors.fg, colors.track, thick);
  const timeSize = 2.2 * u * scale;
  setFont(ctx, FONTS[o.settings.font].body, timeSize, 500);
  ctx.fillStyle = colors.muted;
  const ty = y + thick * 3.2;
  ctx.textAlign = "left";
  ctx.fillText(o.content.elapsed, x, ty);
  ctx.textAlign = "right";
  ctx.fillText(o.content.duration ? `-${remaining(o.content)}` : "", x + w, ty);
  ctx.textAlign = "left";
  const iconSize = 4.2 * u * scale;
  const cy = ty + timeSize * 1.4 + iconSize * 0.75;
  drawControls(ctx, x + w / 2, cy, iconSize, colors.fg, colors.bg, Math.min(2.6, w / iconSize / 4.6));
  return cy + iconSize * 0.75 - y;
}

function playerHeight(u: number, scale = 1): number {
  const thick = 0.75 * u * scale;
  const timeSize = 2.2 * u * scale;
  const iconSize = 4.2 * u * scale;
  return thick * 3.2 + timeSize * 1.4 + iconSize * 1.5;
}

function remaining(c: DesignContent): string {
  const left = Math.max(0, parseClock(c.duration) - parseClock(c.elapsed));
  return `${Math.floor(left / 60)}:${String(Math.round(left % 60)).padStart(2, "0")}`;
}

function dedication(ctx: Ctx, o: RenderOpts, x: number, yBottom: number, w: number, size: number, align: CanvasTextAlign = "left"): number {
  const text = o.content.dedication.trim();
  if (!text) return 0;
  const fam = FONTS[o.settings.font].italic;
  setFont(ctx, fam, size, 400, "italic");
  const lines = wrapLines(ctx, text, w, 3);
  const lh = size * 1.3;
  const top = yBottom - lines.length * lh;
  ctx.fillStyle = o.assets.colors.fg;
  ctx.textAlign = align;
  const ax = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, top + i * lh));
  ctx.textAlign = "left";
  return lines.length * lh;
}

function titleBlock(ctx: Ctx, o: RenderOpts, x: number, y: number, w: number, maxSize: number, minSize: number, align: CanvasTextAlign = "left", withSubtitle = true): number {
  const F = FONTS[o.settings.font];
  const { colors } = o.assets;
  const title = o.content.title || "Sin título";
  const tSize = fitFont(ctx, title, F.title, F.titleWeight, maxSize, minSize, w);
  ctx.fillStyle = colors.fg;
  ctx.textAlign = align;
  const ax = align === "center" ? x + w / 2 : x;
  ctx.fillText(ellipsize(ctx, title, w), ax, y);
  let h = tSize * 1.12;
  if (o.content.artists) {
    const aSize = Math.max(tSize * 0.46, minSize * 0.7);
    setFont(ctx, F.body, aSize, 600);
    ctx.fillStyle = colors.fg;
    ctx.fillText(ellipsize(ctx, o.content.artists, w), ax, y + h);
    h += aSize * 1.3;
  }
  if (withSubtitle && o.content.subtitle) {
    const sSize = Math.max(tSize * 0.3, minSize * 0.55);
    setFont(ctx, F.body, sSize, 400);
    ctx.fillStyle = colors.muted;
    ctx.fillText(ellipsize(ctx, o.content.subtitle, w), ax, y + h + sSize * 0.2);
    h += sSize * 1.5;
  }
  ctx.textAlign = "left";
  return h;
}

/* ---------------- Poster de canción ---------------- */

function posterSong(ctx: Ctx, f: Frame, o: RenderOpts) {
  const { x0, y0, tw, th, u } = f;
  const m = 7 * u;
  const cw = tw - 2 * m;
  const left = x0 + m;
  const bottom = y0 + th - m;

  // Bloque inferior (código + dedicatoria) se ancla abajo
  const codeW = 36 * u;
  const cH = codeHeight(o, codeW);
  const pH = o.settings.showPlayer ? playerHeight(u) + 4 * u : 0;
  const reserve = 22 * u + pH + (cH ? cH + 3 * u : 0) + (o.content.dedication.trim() ? 9 * u : 0);
  const cs = Math.min(cw, th - 2 * m - reserve);
  const col = x0 + (tw - cs) / 2; // columna alineada con la portada
  image(ctx, o, col, y0 + m, cs, cs);

  let y = y0 + m + cs + 5 * u;
  y += titleBlock(ctx, o, col, y, cs, 7.5 * u, 3 * u) + 3 * u;
  if (o.settings.showPlayer) y += player(ctx, o, col, y, cs, u) + 3 * u;

  if (cH) drawCode(ctx, o, left + (cw - codeW) / 2, bottom - cH, codeW);
  const dedBottom = cH ? bottom - cH - 3 * u : bottom;
  if (dedBottom > y + 3 * u) dedication(ctx, o, col, dedBottom, cs, 2.8 * u, "center");
}

/* ---------------- Polaroid ---------------- */

function polaroid(ctx: Ctx, f: Frame, o: RenderOpts) {
  const { x0, y0, tw, th, u } = f;
  const side = 5.5 * u;
  const cw = tw - 2 * side;
  const left = x0 + side;
  const pH = o.settings.showPlayer ? playerHeight(u, 1.15) : 0;
  const ph = Math.min(cw, th - side - 18 * u - pH);
  image(ctx, o, left, y0 + side, cw, ph);

  let y = y0 + side + ph + 4 * u;
  const codeW = 34 * u;
  const cH = codeHeight(o, codeW);
  const textW = cH ? cw - codeW - 3 * u : cw;
  const tH = titleBlock(ctx, o, left, y, textW, 6 * u, 3.2 * u, "left", false);
  if (cH) drawCode(ctx, o, left + cw - codeW, y + Math.max(0, (tH - cH) / 2), codeW);
  y += Math.max(tH, cH) + 3 * u;
  if (o.settings.showPlayer) y += player(ctx, o, left, y, cw, u, 1.15) + 2 * u;
  const bottom = y0 + th - side;
  if (bottom - y > 5 * u) dedication(ctx, o, left, bottom, cw, 3.4 * u, "center");
}

/* ---------------- Placa tipo Spotify ---------------- */

function plaque(ctx: Ctx, f: Frame, o: RenderOpts) {
  const { x0, y0, tw, th, u } = f;
  const m = 7 * u;
  const cw = tw - 2 * m;
  const left = x0 + m;
  const bottom = y0 + th - m;

  const codeW = 46 * u;
  const cH = codeHeight(o, codeW);
  const pH = o.settings.showPlayer ? playerHeight(u) : 0;
  const block = (cH ? cH + 4 * u : 0) + 12 * u + (pH ? pH + 3 * u : 0);
  const ph = Math.min(cw, th - 2 * m - block - 5 * u);
  image(ctx, o, left, y0 + m, cw, ph, 2 * u);

  // Bloque inferior anclado abajo
  let y = bottom - block;
  if (cH) {
    drawCode(ctx, o, left, y, codeW);
    y += cH + 4 * u;
  }
  y += titleBlock(ctx, o, left, y, cw, 6 * u, 3 * u, "left", false) + 3 * u;
  if (o.settings.showPlayer) player(ctx, o, left, y, cw, u);
}
