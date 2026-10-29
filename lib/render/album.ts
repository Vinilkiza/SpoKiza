/* Pósters de álbum estilo Pinterest: 5 estilos, en vertical o en horizontal.
   Todo se mide relativo al ancho de la columna, así funciona en cualquier tamaño. */

import type { AlbumStyle } from "../types";
import type { RenderOpts } from "./templates";
import { FONTS, type FontDef } from "./products";
import { albumInfo, LABELS, type AlbumInfo } from "../content";
import { type Ctx, drawCover, drawPlaceholder, ellipsize, setFont, wrapLines } from "./draw";
import { hexToRgb, luminance, mix } from "./color";

interface Frame {
  x0: number;
  y0: number;
  tw: number;
  th: number;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Kit {
  ctx: Ctx;
  o: RenderOpts;
  F: FontDef;
  info: AlbumInfo;
  L: Record<string, string>;
  tracks: string[];
  fg: string;
  bg: string;
  muted: string;
  palette: string[];
}

const UP = (s: string) => s.toLocaleUpperCase("es");

/* ---------------- texto con alineación por altura de mayúscula ---------------- */

const capCache = new Map<string, number>();
function capRatio(ctx: Ctx, family: string, weight: number): number {
  const key = `${family}|${weight}`;
  const hit = capCache.get(key);
  if (hit) return hit;
  setFont(ctx, family, 100, weight);
  const prev = ctx.textBaseline;
  ctx.textBaseline = "alphabetic";
  const asc = ctx.measureText("H").actualBoundingBoxAscent;
  ctx.textBaseline = prev;
  const r = (asc > 20 ? asc : 72) / 100;
  // Si la fuente aún no cargó no se guarda (se vuelve a medir la próxima vez)
  if (document.fonts?.check?.(`${weight} 20px ${family}`)) capCache.set(key, r);
  return r;
}

function setSpacing(ctx: Ctx, px: number) {
  const c = ctx as Ctx & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${px}px`;
}

interface TextStyle {
  family: string;
  weight?: number;
  color: string;
  align?: CanvasTextAlign;
  maxW?: number;
  spacing?: number; // en fracción de la altura de mayúscula
}

/** Dibuja texto de modo que el tope de las mayúsculas quede en yTop. */
function capText(ctx: Ctx, s: string, x: number, yTop: number, cap: number, st: TextStyle) {
  const weight = st.weight ?? 400;
  const size = cap / capRatio(ctx, st.family, weight);
  setFont(ctx, st.family, size, weight);
  setSpacing(ctx, (st.spacing ?? 0) * cap);
  ctx.fillStyle = st.color;
  ctx.textAlign = st.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(st.maxW ? ellipsize(ctx, s, st.maxW) : s, x, yTop + cap);
  setSpacing(ctx, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

function widthAtCap(ctx: Ctx, s: string, cap: number, family: string, weight: number, spacing = 0): number {
  setFont(ctx, family, cap / capRatio(ctx, family, weight), weight);
  setSpacing(ctx, spacing * cap);
  const w = ctx.measureText(s).width;
  setSpacing(ctx, 0);
  return w;
}

interface Fitted {
  lines: string[];
  cap: number;
  height: number;
}
const LINE_GAP = 0.3;

/** Ajusta un título grande a un ancho, en 1 o 2 líneas, sin pasarse de altura. */
function fitLines(
  ctx: Ctx, text: string, family: string, weight: number,
  maxW: number, maxCap: number, maxBlock: number, maxLines = 2,
): Fitted {
  const one = Math.min(maxCap, maxBlock, (maxCap * maxW) / Math.max(1, widthAtCap(ctx, text, maxCap, family, weight)));
  let best: Fitted = { lines: [text], cap: one, height: one };
  const words = text.split(/\s+/).filter(Boolean);
  if (maxLines >= 2 && words.length > 1) {
    let split = 1;
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = widthAtCap(ctx, words.slice(0, i).join(" "), 100, family, weight);
      const b = widthAtCap(ctx, words.slice(i).join(" "), 100, family, weight);
      if (Math.max(a, b) < bestDiff) {
        bestDiff = Math.max(a, b);
        split = i;
      }
    }
    const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")];
    const capW = (100 * maxW) / bestDiff;
    const two = Math.min(maxCap, maxBlock / (2 + LINE_GAP), capW);
    if (two > one * 1.3) best = { lines, cap: two, height: two * (2 + LINE_GAP) };
  }
  return best;
}

function drawFitted(ctx: Ctx, f: Fitted, x: number, yTop: number, st: TextStyle) {
  f.lines.forEach((l, i) => capText(ctx, l, x, yTop + i * f.cap * (1 + LINE_GAP), f.cap, st));
}

/* ---------------- piezas ---------------- */

function cover(k: Kit, x: number, y: number, w: number, h: number) {
  const img = k.o.assets.image;
  if (img) drawCover(k.ctx, img, x, y, w, h);
  else drawPlaceholder(k.ctx, x, y, w, h, k.o.assets.colors.track, k.muted);
}

/** Imagen a sangre que se funde con el fondo (hacia abajo o hacia la derecha). */
function bleedImage(k: Kit, box: Box, fadeFrom: number, fadeTo: number, dir: "down" | "right") {
  const { ctx } = k;
  cover(k, box.x, box.y, box.w, box.h);
  const [r, g, b] = hexToRgb(k.bg);
  const grad =
    dir === "down" ? ctx.createLinearGradient(0, fadeFrom, 0, fadeTo) : ctx.createLinearGradient(fadeFrom, 0, fadeTo, 0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.72)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
  ctx.fillStyle = grad;
  if (dir === "down") ctx.fillRect(box.x, fadeFrom, box.w, fadeTo - fadeFrom);
  else ctx.fillRect(fadeFrom, box.y, fadeTo - fadeFrom, box.h);
  ctx.fillStyle = k.bg;
  if (dir === "down") ctx.fillRect(box.x, fadeTo, box.w, Math.max(0, box.y + box.h - fadeTo) + 2);
  else ctx.fillRect(fadeTo, box.y, Math.max(0, box.x + box.w - fadeTo) + 2, box.h);
}

function codeH(k: Kit, w: number): number {
  const c = k.o.assets.code;
  return k.o.settings.showCode && c ? w * (c.height / c.width) : 0;
}
function code(k: Kit, x: number, y: number, w: number) {
  const c = k.o.assets.code;
  if (!k.o.settings.showCode || !c) return;
  k.ctx.drawImage(c, x, y, w, codeH(k, w));
}

/** Cuadros de color. Devuelve el alto ocupado. */
function swatches(k: Kit, n: number, xRight: number, y: number, size: number, gap: number, border = 0): number {
  if (!k.o.settings.showPalette || !k.palette.length) return 0;
  const list = k.palette.slice(0, n);
  const start = xRight - (list.length * size + (list.length - 1) * gap);
  list.forEach((c, i) => {
    const x = start + i * (size + gap);
    k.ctx.fillStyle = c;
    k.ctx.fillRect(x, y, size, size);
    if (border) {
      k.ctx.strokeStyle = k.fg;
      k.ctx.lineWidth = border;
      k.ctx.strokeRect(x + border / 2, y + border / 2, size - border, size - border);
    }
  });
  return size;
}

function rule(k: Kit, x: number, y: number, w: number, t: number, color = k.fg) {
  k.ctx.fillStyle = color;
  k.ctx.fillRect(x, y, w, Math.max(1, t));
}

interface ListStyle {
  upper: boolean;
  num: "dot" | "plain" | "col";
  preferRows: number;
  maxCap: number;
  pitch: number; // distancia entre líneas en múltiplos de la altura de mayúscula
  weight: number;
  family: string;
  color: string;
  numColor: string;
  colGap: number;
}

/** Lista de canciones en columnas (se llena de arriba hacia abajo). */
function tracklist(k: Kit, box: Box, st: ListStyle) {
  const n = k.tracks.length;
  if (!n || box.h <= 0 || box.w <= 0) return;
  const minColW = st.maxCap * (/Bebas|Anton/.test(st.family) ? 8 : 11.5);
  const maxCols = Math.max(1, Math.min(4, Math.floor((box.w + st.colGap) / (minColW + st.colGap))));
  const capFor = (cols: number) => {
    const rows = Math.ceil(n / cols);
    return Math.min(st.maxCap, box.h / (rows * st.pitch - (st.pitch - 1)));
  };
  let cols = Math.min(maxCols, Math.max(1, Math.ceil(n / st.preferRows)));
  while (cols < maxCols && capFor(cols) < st.maxCap * 0.62) cols++;
  const rows = Math.ceil(n / cols);
  const cap = capFor(cols);
  const colW = (box.w - (cols - 1) * st.colGap) / cols;
  const numW = st.num === "col" ? widthAtCap(k.ctx, `${n}.`, cap, st.family, st.weight) + cap * 2.6 : 0;
  k.tracks.forEach((raw, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = box.x + col * (colW + st.colGap);
    const y = box.y + row * cap * st.pitch;
    const name = st.upper ? UP(raw) : raw;
    if (st.num === "col") {
      capText(k.ctx, `${i + 1}.`, x, y, cap, { family: st.family, weight: st.weight, color: st.numColor });
      capText(k.ctx, name, x + numW, y, cap, { family: st.family, weight: st.weight, color: st.color, maxW: colW - numW });
    } else {
      const label = st.num === "dot" ? `${i + 1}. ${name}` : `${i + 1} ${name}`;
      capText(k.ctx, label, x, y, cap, { family: st.family, weight: st.weight, color: st.color, maxW: colW });
    }
  });
}

/** Siempre 5 colores, ordenados de oscuro a claro (si la portada tiene menos, se completan con mezclas). */
function fivePalette(p: string[]): string[] {
  if (!p.length) return [];
  const out = [...p.slice(0, 5)];
  let i = 0;
  while (out.length < 5) {
    const a = out[i % out.length];
    const b = out[(i + 1) % out.length];
    out.push(a === b ? mix(a, i % 2 ? "#000000" : "#ffffff", 0.35) : mix(a, b, 0.5));
    i++;
  }
  return out.sort((x, y) => luminance(x) - luminance(y));
}

/* ---------------- entrada ---------------- */

const STYLE_TEXT: Record<AlbumStyle, { upper: boolean; num: ListStyle["num"]; bold: boolean }> = {
  titular: { upper: true, num: "dot", bold: false },
  minimal: { upper: true, num: "col", bold: false },
  franja: { upper: true, num: "dot", bold: false },
  noche: { upper: true, num: "plain", bold: true },
  degradado: { upper: false, num: "dot", bold: false },
};

export function renderAlbum(ctx: Ctx, f: Frame, o: RenderOpts) {
  const { colors, palette } = o.assets;
  const k: Kit = {
    ctx,
    o,
    F: FONTS[o.settings.font],
    info: albumInfo(o.item, o.content, o.settings.lang),
    L: LABELS[o.settings.lang],
    tracks: o.content.tracklist.split("\n").map((s) => s.trim()).filter(Boolean),
    fg: colors.fg,
    bg: colors.bg,
    muted: colors.muted,
    palette: fivePalette(palette),
  };
  const style = o.settings.albumStyle;
  if (f.tw / f.th > 1.08) return landscape(k, f, o, style);
  if (style === "titular") return titular(k, f);
  if (style === "minimal") return minimal(k, f);
  if (style === "franja") return franja(k, f);
  if (style === "noche") return noche(k, f, o);
  return degradado(k, f, o);
}

/** Columna centrada: ancho de portada que cabe según la proporción que necesita el estilo. */
function column(f: Frame, ratio: number) {
  const m = Math.min(f.tw, f.th) * 0.065;
  const c = Math.min(f.tw - 2 * m, (f.th - 2 * m) / ratio);
  return { m, c, u: c / 100, X: f.x0 + (f.tw - c) / 2, top: f.y0 + m, bottom: f.y0 + f.th - m };
}

/* ---------------- 1. Titular: artista arriba, título gigante abajo ---------------- */

function titular(k: Kit, f: Frame) {
  const { ctx, F } = k;
  const { c, u, X, top, bottom } = column(f, 1.58);
  const tf = { family: F.title, weight: F.titleWeight };
  const bw = F.bodyWeight;

  const artist = fitLines(ctx, UP(k.o.content.artists || " "), tf.family, tf.weight, c, 7.4 * u, 7.4 * u, 1);
  drawFitted(ctx, artist, X, top, { ...tf, color: k.fg });
  let y = top + Math.max(artist.height, 5 * u) + 3.4 * u;
  cover(k, X, y, c, c);
  y += c + 3.4 * u;

  const R = X + c;
  const rightW = c * 0.4;
  const leftW = c * 0.55;

  // Derecha: paleta, ficha y título gigante
  const gap = 1.1 * u;
  const sw = (rightW - 4 * gap) / 5;
  let ry = y;
  const palH = swatches(k, 5, R, ry, sw, gap);
  ry += palH ? palH + 3 * u : 0;
  const cap = 2 * u * (F.bodyScale > 1 ? 1.1 : 1);
  const lines = [
    k.info.genre && `${k.L.genre}: ${k.info.genre}`,
    k.info.release && `${k.L.release}: ${k.info.release}`,
    k.info.label && `${k.L.label}: ${k.info.label}`,
    k.info.length && `${k.L.length}: ${k.info.length}`,
  ].filter(Boolean) as string[];
  lines.forEach((l) => {
    capText(ctx, UP(l), R, ry, cap, { family: F.body, weight: bw, color: k.fg, align: "right", maxW: c * 0.48 });
    ry += cap * 2.05;
  });
  const titleRoom = bottom - ry - 3 * u;
  const title = fitLines(ctx, UP(k.o.content.title || " "), tf.family, tf.weight, c * 0.44, 15 * u, Math.max(3 * u, titleRoom), 2);
  title.lines.forEach((l, i) => {
    const yT = bottom - title.height + i * title.cap * (1 + LINE_GAP);
    capText(ctx, l, R, yT, title.cap, { ...tf, color: k.fg, align: "right" });
  });

  // Izquierda: canciones y código
  const cw = c * 0.37;
  const ch = codeH(k, cw);
  if (ch) code(k, X - cw * 0.02, bottom - ch, cw);
  tracklist(k, { x: X, y, w: leftW, h: bottom - y - (ch ? ch + 3 * u : 0) }, {
    upper: true, num: "dot", preferRows: 10, maxCap: cap * 1.12, pitch: 2.05, weight: bw,
    family: F.body, color: k.fg, numColor: k.fg, colGap: 3 * u,
  });
}

/* ---------------- 2. Minimal: líneas finas y ficha en tres columnas ---------------- */

function minimal(k: Kit, f: Frame) {
  const { ctx, F } = k;
  const { c, u, X, top, bottom } = column(f, 1.58);
  const R = X + c;
  let y = top;
  cover(k, X, y, c, c);
  y += c + 4.4 * u;

  const sw = 3.3 * u;
  const gap = 0.8 * u;
  const n = k.o.settings.showPalette ? Math.min(5, k.palette.length) : 0;
  const palW = n ? n * sw + (n - 1) * gap : 0;
  const title = fitLines(ctx, UP(k.o.content.title || " "), F.title, F.titleWeight, c - palW - 4 * u, 5.4 * u, 5.4 * u, 1);
  drawFitted(ctx, title, X, y, { family: F.title, weight: F.titleWeight, color: k.fg });
  swatches(k, 5, R, y + (title.cap - sw) / 2, sw, gap);
  y += title.height + 2.4 * u;
  const aCap = 3 * u;
  capText(ctx, k.o.content.artists, X, y, aCap, { family: F.body, weight: F.bodyWeight, color: k.fg, maxW: c });
  y += aCap + 4.2 * u;
  rule(k, X, y, c, 0.13 * u, k.muted);
  y += 4.2 * u;

  // Ficha inferior
  const lCap = 0.95 * u;
  const vCap = 1.8 * u;
  const items = [
    [k.L.release, k.info.release],
    [k.L.genre, k.info.genre],
    [k.L.label, k.info.label],
  ].filter(([, v]) => v) as [string, string][];
  const cw = c * 0.24;
  const ch = codeH(k, cw);
  const footerH = Math.max(lCap + 1.8 * u + vCap * 2 + vCap * 1.2, ch);
  const footerTop = bottom - footerH;
  const ruleY = footerTop - 3.6 * u;

  tracklist(k, { x: X, y, w: c, h: ruleY - 4 * u - y }, {
    upper: true, num: "col", preferRows: Math.max(7, Math.ceil(k.tracks.length / 2)), maxCap: 1.45 * u, pitch: 2.3,
    weight: F.bodyWeight, family: F.body, color: k.fg, numColor: k.fg, colGap: 6 * u,
  });
  rule(k, X, ruleY, c, 0.13 * u, k.muted);

  const slots = items.length + (ch ? 1 : 0);
  const slotW = slots ? c / Math.max(3, slots) : c;
  items.forEach(([label, value], i) => {
    const x = X + i * slotW;
    capText(ctx, UP(label), x, footerTop, lCap, { family: "'Inter'", weight: 500, color: k.muted, spacing: 0.12, maxW: slotW - 2 * u });
    setFont(ctx, F.body, vCap / capRatio(ctx, F.body, F.bodyWeight), F.bodyWeight);
    wrapLines(ctx, value, slotW - 2.5 * u, 2).forEach((line, j) =>
      capText(ctx, line, x, footerTop + lCap + 1.8 * u + j * vCap * 1.6, vCap, { family: F.body, weight: F.bodyWeight, color: k.fg }),
    );
  });
  if (ch) code(k, R - cw, bottom - ch, cw);
}

/* ---------------- 3. Franja: título arriba, barra de colores ---------------- */

function franja(k: Kit, f: Frame) {
  const { ctx, F } = k;
  const { c, u, X, top, bottom } = column(f, 1.55);
  const R = X + c;
  const tf = { family: F.title, weight: F.titleWeight };
  rule(k, X, top, c, 0.45 * u);
  let y = top + 0.45 * u + 3 * u;

  const yearCap = 3.6 * u;
  let yearW = 0;
  if (k.info.year) {
    yearW = widthAtCap(ctx, k.info.year, yearCap, tf.family, tf.weight);
    capText(ctx, k.info.year, R, y, yearCap, { ...tf, color: k.fg, align: "right" });
  }
  const title = fitLines(ctx, UP(k.o.content.title || " "), tf.family, tf.weight, c - yearW - 5 * u, 8.6 * u, 8.6 * u * 1.6, 2);
  drawFitted(ctx, title, X, y, { ...tf, color: k.fg });
  y += Math.max(title.height, yearCap) + 3.4 * u;

  cover(k, X, y, c, c);
  y += c + 3 * u;

  if (k.o.settings.showPalette && k.palette.length) {
    const list = k.palette.slice(0, 5);
    const segW = c / list.length;
    list.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(X + i * segW, y, segW + 0.5, 2.2 * u);
    });
    y += 2.2 * u + 4 * u;
  } else y += 1.5 * u;

  const cap = 1.9 * u * (F.bodyScale > 1 ? 1.08 : 1);
  const cw = c * 0.32;
  const ch = codeH(k, cw);
  if (ch) code(k, X - cw * 0.02, bottom - ch, cw);
  tracklist(k, { x: X, y, w: c * 0.44, h: bottom - y - (ch ? ch + 3 * u : 0) }, {
    upper: true, num: "dot", preferRows: 9, maxCap: cap, pitch: 2.25, weight: F.bodyWeight,
    family: F.body, color: k.fg, numColor: k.fg, colGap: 4 * u,
  });

  // Derecha
  const rw = c * 0.52;
  const artist = fitLines(ctx, UP(k.o.content.artists || " "), tf.family, tf.weight, rw, 6 * u, 6 * u * 1.7, 2);
  artist.lines.forEach((l, i) => capText(ctx, l, R, y + i * artist.cap * (1 + LINE_GAP), artist.cap, { ...tf, color: k.fg, align: "right" }));
  let ry = y + artist.height + 3.6 * u;
  const body = { family: F.body, weight: F.bodyWeight, color: k.fg, align: "right" as const, maxW: rw };
  for (const v of [k.info.release, k.info.length]) {
    if (!v) continue;
    capText(ctx, UP(v), R, ry, cap, body);
    ry += cap * 2.1;
  }
  if (k.info.label) {
    ry += cap * 1.6;
    capText(ctx, UP(k.L.releasedBy), R, ry, cap, { ...body, color: k.muted });
    ry += cap * 2.1;
    capText(ctx, UP(k.info.label), R, ry, cap, { ...body, weight: F.bodyBold });
    ry += cap * 2.1;
  }
  if (k.info.feat) {
    const fCap = cap * 0.92;
    setFont(ctx, F.body, fCap / capRatio(ctx, F.body, F.bodyWeight), F.bodyWeight);
    const lines = wrapLines(ctx, UP(`${k.L.feat} ${k.info.feat}`), rw, 3);
    const startY = Math.max(ry + cap, bottom - (lines.length * fCap * 2.05 - fCap * 1.05));
    lines.forEach((l, i) => capText(ctx, l, R, startY + i * fCap * 2.05, fCap, { ...body, color: k.muted }));
  }
}

/* ---------------- 4. Noche: foto a sangre que se funde en el fondo ---------------- */

function noche(k: Kit, f: Frame, o: RenderOpts) {
  const { ctx, F } = k;
  const u = f.tw / 100;
  const m = 6.5 * u;
  const X = f.x0 + m;
  const c = f.tw - 2 * m;
  const R = X + c;
  const bottom = f.y0 + f.th - m;
  const side = o.W;
  const infoTop = Math.min(side * 0.8, bottom - 46 * u);
  bleedImage(k, { x: 0, y: 0, w: o.W, h: side }, infoTop - side * 0.42, infoTop + 1.5 * u, "down");

  const bold = F.bodyBold;
  const cap = 1.5 * u;
  const lenCap = 2 * u;
  if (k.info.length)
    capText(ctx, UP(`${k.L.length}: ${k.info.length}`), X, bottom - lenCap, lenCap, { family: F.body, weight: bold, color: k.fg });
  tracklist(k, { x: X, y: infoTop, w: c * 0.54, h: bottom - infoTop - (k.info.length ? lenCap + 4 * u : 0) }, {
    upper: true, num: "plain", preferRows: 15, maxCap: cap, pitch: 2.15, weight: bold,
    family: F.body, color: k.fg, numColor: k.fg, colGap: 3.5 * u,
  });

  const rw = c * 0.42;
  const gap = 0.9 * u;
  const sw = Math.min(5.4 * u, (rw - 4 * gap) / 5);
  let ry = infoTop;
  const palH = swatches(k, 5, R, ry, sw, gap);
  ry += palH ? palH + 3.6 * u : 0;
  const artist = fitLines(ctx, UP(o.content.artists || " "), F.title, F.titleWeight, rw, 4.2 * u, 4.2 * u * 1.7, 2);
  artist.lines.forEach((l, i) => capText(ctx, l, R, ry + i * artist.cap * (1 + LINE_GAP), artist.cap, { family: F.title, weight: F.titleWeight, color: k.fg, align: "right" }));
  ry += artist.height + 2.2 * u;
  const accent = mix(k.fg, k.bg, 0.42);
  const title = fitLines(ctx, UP(o.content.title || " "), F.title, F.titleWeight, rw, 5.2 * u, 5.2 * u * 1.7, 2);
  title.lines.forEach((l, i) => capText(ctx, l, R, ry + i * title.cap * (1 + LINE_GAP), title.cap, { family: F.title, weight: F.titleWeight, color: accent, align: "right" }));

  const cw = Math.min(rw, 33 * u);
  const ch = codeH(k, cw);
  if (ch) code(k, R - cw, bottom - ch, cw);
  if (k.info.release) {
    const rCap = 1.45 * u;
    const yRel = bottom - (ch ? ch + 3.5 * u : 0) - rCap * 3.2;
    const st = { family: F.body, weight: bold, color: k.fg, align: "right" as const };
    capText(ctx, UP(k.L.releasedOn), R, yRel, rCap, st);
    capText(ctx, UP(k.info.release), R, yRel + rCap * 2.2, rCap, st);
  }
}

/* ---------------- 5. Degradado: foto que se funde al color del álbum ---------------- */

function degradado(k: Kit, f: Frame, o: RenderOpts) {
  const { ctx, F } = k;
  const u = f.tw / 100;
  const m = 6.5 * u;
  const X = f.x0 + m;
  const c = f.tw - 2 * m;
  const R = X + c;
  const bottom = f.y0 + f.th - m;
  const infoTop = Math.min(f.y0 + f.th * 0.63, bottom - 50 * u);
  bleedImage(k, { x: 0, y: 0, w: o.W, h: infoTop + 8 * u }, infoTop - f.th * 0.2, infoTop + 1 * u, "down");

  // Paleta: 5 cuadros iguales alineados con la columna derecha y centrados con el título
  const showPal = o.settings.showPalette && k.palette.length > 0;
  const rw = c * 0.36;
  const gap = 1.1 * u;
  const sw = (rw - 4 * gap) / 5;
  const textW = c - (showPal ? rw + 5 * u : 0);
  const title = fitLines(ctx, o.content.title || " ", F.title, F.titleWeight, textW, 4.4 * u, 4.4 * u * 1.7, 2);
  const aCap = 2.4 * u;
  const blockH = title.height + 2.2 * u + aCap;
  const palY = infoTop + Math.max(0, (blockH - sw) / 2);
  if (showPal) swatches(k, 5, R, palY, sw, gap, 0.3 * u);
  drawFitted(ctx, title, X, infoTop, { family: F.title, weight: F.titleWeight, color: k.fg });
  let y = infoTop + title.height + 2.2 * u;
  capText(ctx, o.content.artists, X, y, aCap, { family: F.body, weight: 400, color: k.fg, maxW: textW });
  y = Math.max(y + aCap, showPal ? palY + sw : 0) + 3.6 * u;
  rule(k, X, y, c, 0.5 * u);
  y += 4.2 * u;

  tracklist(k, { x: X, y, w: c * 0.6, h: bottom - y }, {
    upper: false, num: "dot", preferRows: 10, maxCap: 1.45 * u, pitch: 2.35, weight: F.bodyWeight,
    family: F.body, color: k.fg, numColor: k.fg, colGap: 4 * u,
  });

  const st = { family: F.body, color: k.fg, align: "right" as const, maxW: c * 0.36 };
  let ry = y;
  const lCap = 1.75 * u;
  const vCap = 1.6 * u;
  for (const [label, value] of [[k.L.release, k.info.release], [k.L.length, k.info.length]] as const) {
    if (!value) continue;
    capText(ctx, label, R, ry, lCap, { ...st, weight: F.bodyBold });
    capText(ctx, value, R, ry + lCap * 2.1, vCap, { ...st, weight: 400 });
    ry += lCap * 2.1 + vCap * 3.4;
  }
  const cw = Math.min(c * 0.34, 30 * u);
  const ch = codeH(k, cw);
  if (ch) code(k, R - cw, bottom - ch, cw);
}

/* ---------------- Horizontal (cualquier estilo) ---------------- */

function landscape(k: Kit, f: Frame, o: RenderOpts, style: AlbumStyle) {
  const { ctx, F } = k;
  const t = STYLE_TEXT[style];
  const m = f.th * 0.07;
  const side = Math.min(f.th - 2 * m, f.tw * 0.46);
  const u = side / 100;
  const fullBleed = style === "noche" || style === "degradado";
  const coverX = f.x0 + m;
  const coverY = f.y0 + (f.th - side) / 2;
  if (fullBleed) {
    const w = coverX + side + m;
    bleedImage(k, { x: 0, y: 0, w, h: o.H }, w * 0.62, w + 2 * u, "right");
  } else cover(k, coverX, coverY, side, side);

  const ix = coverX + side + m * 1.3;
  const R = f.x0 + f.tw - m;
  const iw = R - ix;
  const top = f.y0 + m;
  const bottom = f.y0 + f.th - m;
  const tf = { family: F.title, weight: F.titleWeight };
  const bw = t.bold ? F.bodyBold : F.bodyWeight;

  const sw = 3.6 * u;
  const n = o.settings.showPalette ? Math.min(5, k.palette.length) : 0;
  const palW = n ? n * sw + (n - 1) * 0.9 * u : 0;
  const title = fitLines(ctx, t.upper ? UP(o.content.title || " ") : o.content.title || " ", tf.family, tf.weight, iw - palW - 4 * u, 12 * u, 12 * u * 1.7, 2);
  drawFitted(ctx, title, ix, top, { ...tf, color: k.fg });
  swatches(k, 5, R, top, sw, 0.9 * u);
  let y = top + title.height + 2.6 * u;
  const aCap = 3.2 * u;
  capText(ctx, t.upper ? UP(o.content.artists) : o.content.artists, ix, y, aCap, { family: F.body, weight: bw, color: k.fg, maxW: iw });
  y += aCap + 4 * u;
  rule(k, ix, y, iw, 0.15 * u, k.muted);
  y += 4 * u;

  // Pie: ficha + código
  const items = [
    [k.L.release, k.info.release],
    [k.L.genre, k.info.genre],
    [k.L.label, k.info.label],
    [k.L.length, k.info.length],
  ].filter(([, v]) => v) as [string, string][];
  const cw = Math.min(iw * 0.3, 30 * u);
  const ch = codeH(k, cw);
  const lCap = 1.05 * u;
  const vCap = 1.8 * u;
  const footerH = Math.max(lCap + 1.8 * u + vCap, ch);
  const footerTop = bottom - footerH;
  if (ch) code(k, R - cw, bottom - ch, cw);
  const slotsW = iw - (ch ? cw + 3 * u : 0);
  const slotW = items.length ? slotsW / items.length : slotsW;
  items.forEach(([label, value], i) => {
    const x = ix + i * slotW;
    capText(ctx, UP(label), x, footerTop, lCap, { family: "'Inter'", weight: 500, color: k.muted, spacing: 0.1, maxW: slotW - 2 * u });
    capText(ctx, t.upper ? UP(value) : value, x, footerTop + lCap + 1.8 * u, vCap, { family: F.body, weight: F.bodyWeight, color: k.fg, maxW: slotW - 2 * u });
  });
  const ruleY = footerTop - 3.6 * u;
  rule(k, ix, ruleY, iw, 0.15 * u, k.muted);
  tracklist(k, { x: ix, y, w: iw, h: ruleY - 3.6 * u - y }, {
    upper: t.upper, num: t.num, preferRows: 10, maxCap: 2.3 * u, pitch: 2.15, weight: bw,
    family: F.body, color: k.fg, numColor: k.fg, colGap: 4 * u,
  });
}
