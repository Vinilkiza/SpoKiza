/* Herramientas comunes de diseño: texto con normas, piezas (código, paleta, reproductor),
   firma "Made By Vinilkiza" y elementos movibles para el modo edición. */

import type { RenderOpts } from "./templates";
import { FONTS, type FontDef } from "./products";
import { albumInfo, LABELS, type AlbumInfo } from "../content";
import { type Ctx, drawControls, drawCover, drawPlaceholder, drawPlayerBar, roundRectPath, setFont } from "./draw";
import { hexToRgb, luminance, mix } from "./color";
import { parseClock } from "../parse";

export interface Frame {
  x0: number;
  y0: number;
  tw: number;
  th: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Caja de un elemento movible, en píxeles del canvas (la usa el modo edición). */
export interface EditBox extends Box {
  id: string;
}

export interface Kit {
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
  f: Frame;
  mm: number; // píxeles por milímetro impreso
  tight: boolean; // algún texto quedó por debajo del tamaño mínimo legible
}

/** Normas de tamaño mínimo al imprimir (altura de mayúscula, en mm). */
export const MIN_LIST_MM = 1.6; // listas de canciones (~7 pt)
export const MIN_SMALL_MM = 1.2; // datos pequeños (~5,5 pt)

export const UP = (s: string) => s.toLocaleUpperCase("es");

export function makeKit(ctx: Ctx, f: Frame, o: RenderOpts): Kit {
  const { colors, palette } = o.assets;
  return {
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
    f,
    mm: f.tw / (o.settings.widthCm * 10),
    tight: false,
  };
}

/* ---------------- medición (para mover elementos en el modo edición) ---------------- */

let bounds: { x0: number; y0: number; x1: number; y1: number } | null = null;

function extend(x: number, y: number, w: number, h: number) {
  if (!bounds) return;
  bounds.x0 = Math.min(bounds.x0, x);
  bounds.y0 = Math.min(bounds.y0, y);
  bounds.x1 = Math.max(bounds.x1, x + w);
  bounds.y1 = Math.max(bounds.y1, y + h);
}

/** Dibuja algo que no es texto; mientras se mide solo registra su caja. */
export function drawBox(box: Box, draw: () => void) {
  if (bounds) return extend(box.x, box.y, box.w, box.h);
  draw();
}

/**
 * Elemento movible: se dibuja aplicando el desplazamiento y la escala que el usuario
 * eligió en el modo edición (guardados por diseño), y deja su caja para la vista previa.
 */
export function movable(k: Kit, id: string, draw: () => void) {
  const prev = bounds;
  bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  draw();
  const b = bounds;
  bounds = prev;
  if (!Number.isFinite(b.x0)) return;
  const t = k.o.content.layout?.[id];
  const dx = (t?.dx ?? 0) * k.f.tw;
  const dy = (t?.dy ?? 0) * k.f.th;
  const s = t?.s ?? 1;
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const cx = b.x0 + w / 2;
  const cy = b.y0 + h / 2;
  if (prev) {
    // dentro de otro elemento que se está midiendo
    extend(cx + dx - (w * s) / 2, cy + dy - (h * s) / 2, w * s, h * s);
    return;
  }
  const { ctx } = k;
  ctx.save();
  ctx.translate(cx + dx, cy + dy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
  k.o.boxes?.push({ id, x: cx + dx - (w * s) / 2, y: cy + dy - (h * s) / 2, w: w * s, h: h * s });
}

/* ---------------- texto con alineación por altura de mayúscula ---------------- */

const capCache = new Map<string, number>();
export function capRatio(ctx: Ctx, family: string, weight: number): number {
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

export interface TextStyle {
  family: string;
  weight?: number;
  color: string;
  align?: CanvasTextAlign;
  maxW?: number;
  spacing?: number; // en fracción de la altura de mayúscula
  italic?: boolean;
  shadow?: string;
}

export function widthAtCap(ctx: Ctx, s: string, cap: number, family: string, weight: number, spacing = 0, italic = false): number {
  setFont(ctx, family, cap / capRatio(ctx, family, weight), weight, italic ? "italic" : "normal");
  setSpacing(ctx, spacing * cap);
  const w = ctx.measureText(s).width;
  setSpacing(ctx, 0);
  return w;
}

/** Dibuja texto de modo que el tope de las mayúsculas quede en yTop. Nunca se corta: si no cabe, se achica. */
export function capText(ctx: Ctx, s: string, x: number, yTop: number, cap: number, st: TextStyle) {
  const weight = st.weight ?? 400;
  let w = widthAtCap(ctx, s, cap, st.family, weight, st.spacing ?? 0, st.italic);
  if (st.maxW && w > st.maxW) {
    cap = cap * (st.maxW / w);
    w = st.maxW;
  }
  const align = st.align ?? "left";
  if (bounds) {
    const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    extend(left, yTop, w, cap * 1.25);
    return;
  }
  const size = cap / capRatio(ctx, st.family, weight);
  setFont(ctx, st.family, size, weight, st.italic ? "italic" : "normal");
  setSpacing(ctx, (st.spacing ?? 0) * cap);
  ctx.save();
  if (st.shadow) {
    ctx.shadowColor = st.shadow;
    ctx.shadowBlur = cap * 0.8;
  }
  ctx.fillStyle = st.color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, yTop + cap);
  ctx.restore();
  setSpacing(ctx, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

export interface Fitted {
  lines: string[];
  cap: number;
  height: number;
}
export const LINE_GAP = 0.3;

/** Reparte palabras en n líneas lo más parejas posible (por ancho). */
function balance(ctx: Ctx, words: string[], n: number, family: string, weight: number): string[] {
  const total = widthAtCap(ctx, words.join(" "), 100, family, weight);
  const target = total / n;
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    const remainingWords = words.length - i;
    const remainingLines = n - lines.length;
    if (line && widthAtCap(ctx, test, 100, family, weight) > target * 1.08 && remainingLines > 1 && remainingWords >= remainingLines - 1) {
      lines.push(line);
      line = words[i];
    } else line = test;
  }
  lines.push(line);
  return lines;
}

/**
 * Norma para títulos y nombres grandes: la letra más grande que quepa en el ancho
 * y el alto disponibles, repartiendo en 1, 2 o 3 líneas. Nunca se corta.
 */
export function fitLines(
  ctx: Ctx, text: string, family: string, weight: number,
  maxW: number, maxCap: number, maxBlock: number, maxLines = 2,
): Fitted {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [""], cap: maxCap, height: 0 };
  let best: Fitted | null = null;
  for (let n = 1; n <= Math.min(maxLines, words.length); n++) {
    const lines = n === 1 ? [words.join(" ")] : balance(ctx, words, n, family, weight);
    const widest = Math.max(...lines.map((l) => widthAtCap(ctx, l, 100, family, weight)));
    const real = lines.length;
    const cap = Math.min(maxCap, maxBlock / (real + (real - 1) * LINE_GAP), (100 * maxW) / Math.max(1, widest));
    // Se prefiere menos líneas salvo que más líneas den letra claramente más grande
    if (!best || cap > best.cap * 1.25) best = { lines, cap, height: cap * (real + (real - 1) * LINE_GAP) };
  }
  return best!;
}

export function drawFitted(ctx: Ctx, f: Fitted, x: number, yTop: number, st: TextStyle) {
  f.lines.forEach((l, i) => capText(ctx, l, x, yTop + i * f.cap * (1 + LINE_GAP), f.cap, st));
}

/** Parte un texto en líneas por palabras. Devuelve null si una palabra sola no cabe. */
export function wrapWords(
  ctx: Ctx, text: string, cap: number, family: string, weight: number, first: number, rest: number, italic = false,
): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const limit = lines.length ? rest : first;
    const test = line ? `${line} ${w}` : w;
    if (widthAtCap(ctx, test, cap, family, weight, 0, italic) <= limit) {
      line = test;
      continue;
    }
    if (!line) return null;
    lines.push(line);
    line = w;
    if (widthAtCap(ctx, w, cap, family, weight, 0, italic) > rest) return null;
  }
  if (line) lines.push(line);
  return lines;
}

/** Texto en máximo `maxLines` líneas: si no cabe, la letra se achica un poco hasta que quepa. */
export function fitWrap(ctx: Ctx, text: string, cap: number, family: string, weight: number, maxW: number, maxLines: number, italic = false) {
  let c = cap;
  for (let i = 0; i < 14; i++) {
    const lines = wrapWords(ctx, text, c, family, weight, maxW, maxW, italic);
    if (lines && lines.length <= maxLines) return { lines, cap: c };
    c *= 0.92;
  }
  return { lines: [text], cap: c };
}

/** Bloque de datos (fecha, sello…): cada dato hasta 2 líneas, nunca se corta. Devuelve la nueva y. */
export function infoBlock(
  ctx: Ctx, items: string[], x: number, y: number, cap: number, pitch: number, maxW: number, st: TextStyle,
): number {
  const weight = st.weight ?? 400;
  for (const item of items) {
    const fw = fitWrap(ctx, item, cap, st.family, weight, maxW, 2);
    fw.lines.forEach((l) => {
      capText(ctx, l, x, y + (cap - fw.cap), fw.cap, { ...st, maxW });
      y += cap * pitch;
    });
  }
  return y;
}

/* ---------------- piezas ---------------- */

export function cover(k: Kit, x: number, y: number, w: number, h: number, radius = 0) {
  const img = k.o.assets.image;
  if (img) drawCover(k.ctx, img, x, y, w, h, radius);
  else drawPlaceholder(k.ctx, x, y, w, h, k.o.assets.colors.track, k.muted, radius);
}

/** Imagen a sangre que se funde con el fondo (hacia abajo o hacia la derecha). */
export function bleedImage(k: Kit, box: Box, fadeFrom: number, fadeTo: number, dir: "down" | "right") {
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

export function codeH(k: Kit, w: number): number {
  const c = k.o.assets.code;
  return k.o.settings.showCode && c ? w * (c.height / c.width) : 0;
}
export function code(k: Kit, x: number, y: number, w: number) {
  const c = k.o.assets.code;
  if (!k.o.settings.showCode || !c) return;
  const h = codeH(k, w);
  drawBox({ x, y, w, h }, () => {
    k.ctx.imageSmoothingQuality = "high";
    k.ctx.drawImage(c, x, y, w, h);
  });
}

/** Cuadros de color alineados a la derecha. Devuelve el alto ocupado. */
export function swatches(k: Kit, n: number, xRight: number, y: number, size: number, gap: number, border = 0): number {
  if (!k.o.settings.showPalette || !k.palette.length) return 0;
  const list = k.palette.slice(0, n);
  const total = list.length * size + (list.length - 1) * gap;
  const start = xRight - total;
  drawBox({ x: start, y, w: total, h: size }, () =>
    list.forEach((c, i) => {
      const x = start + i * (size + gap);
      k.ctx.fillStyle = c;
      k.ctx.fillRect(x, y, size, size);
      if (border) {
        k.ctx.strokeStyle = k.fg;
        k.ctx.lineWidth = border;
        k.ctx.strokeRect(x + border / 2, y + border / 2, size - border, size - border);
      }
    }),
  );
  return size;
}

export function rule(k: Kit, x: number, y: number, w: number, t: number, color = k.fg) {
  const h = Math.max(1, t);
  drawBox({ x, y, w, h }, () => {
    k.ctx.fillStyle = color;
    k.ctx.fillRect(x, y, w, h);
  });
}

/** Firma "Made By Vinilkiza" (Montserrat Black), arriba a la derecha dentro del margen. */
export function madeBy(k: Kit, right: number, marginTop: number, onImage = false) {
  if (!k.o.settings.showMadeBy) return;
  const cap = Math.max(MIN_SMALL_MM * 1.4 * k.mm, k.f.tw * 0.0072);
  const y = k.f.y0 + Math.max(cap * 0.6, (marginTop - cap) / 2);
  movable(k, "madeby", () =>
    capText(k.ctx, "Made By Vinilkiza", right, y, cap, {
      family: "'Montserrat'",
      weight: 900,
      color: onImage ? "#ffffff" : k.fg,
      align: "right",
      shadow: onImage ? "rgba(0,0,0,0.45)" : undefined,
    }),
  );
}

/* ---------------- reproductor ---------------- */

function progress(k: Kit): number {
  const total = parseClock(k.o.content.duration);
  return total > 0 ? Math.min(1, parseClock(k.o.content.elapsed) / total) : 0.35;
}
function remaining(k: Kit): string {
  const left = Math.max(0, parseClock(k.o.content.duration) - parseClock(k.o.content.elapsed));
  return `${Math.floor(left / 60)}:${String(Math.round(left % 60)).padStart(2, "0")}`;
}

/** Medidas del reproductor para una unidad u (con mínimos legibles en mm). */
export function playerMetrics(k: Kit, u: number) {
  const thick = Math.max(0.6 * u, 0.35 * k.mm);
  const timeCap = Math.max(1.5 * u, MIN_SMALL_MM * k.mm);
  const icon = Math.max(4 * u, 3 * k.mm);
  const height = thick * 2 + timeCap * 2.6 + icon * 1.55;
  return { thick, timeCap, icon, height };
}

/** Barra + tiempos + controles. Devuelve la altura usada. */
export function player(k: Kit, x: number, y: number, w: number, u: number): number {
  const { thick, timeCap, icon, height } = playerMetrics(k, u);
  const { colors } = k.o.assets;
  drawBox({ x, y, w, h: thick * 2 }, () => drawPlayerBar(k.ctx, x, y + thick, w, progress(k), colors.fg, colors.track, thick));
  const ty = y + thick * 2 + timeCap * 0.9;
  const st = { family: "'Montserrat'", weight: 600, color: k.muted };
  capText(k.ctx, k.o.content.elapsed, x, ty, timeCap, st);
  capText(k.ctx, k.o.content.duration ? `-${remaining(k)}` : "", x + w, ty, timeCap, { ...st, align: "right" });
  const cy = ty + timeCap * 1.7 + icon * 0.78;
  const span = Math.min(w, icon * 12);
  drawBox({ x: x + w / 2 - span / 2, y: cy - icon * 0.65, w: span, h: icon * 1.3 }, () =>
    drawControls(k.ctx, x + w / 2, cy, icon, colors.fg, colors.bg, Math.min(2.6, w / icon / 4.6)),
  );
  return height;
}

/* ---------------- lista de canciones ---------------- */

export interface ListStyle {
  upper: boolean;
  num: "dot" | "plain" | "col";
  maxCap: number;
  pitch: number; // distancia entre líneas en múltiplos de la altura de mayúscula
  weight: number;
  family: string;
  color: string;
  numColor: string;
  colGap: number;
}

/**
 * Lista de canciones en columnas. Normas:
 *  - Todas las canciones van del mismo tamaño y nunca se cortan.
 *  - Si un nombre no cabe, baja a una segunda línea (con sangría); máximo 2 líneas por canción.
 *  - Se elige el número de columnas que deje la letra más grande, y las columnas quedan parejas.
 *  - Si la letra queda por debajo del mínimo legible, se avisa (k.tight) para que la portada ceda espacio.
 */
export function tracklist(k: Kit, box: Box, st: ListStyle) {
  const n = k.tracks.length;
  if (!n || box.h <= 0 || box.w <= 0) return;
  const { ctx } = k;
  const names = k.tracks.map((t) => (st.upper ? UP(t) : t));
  const label = (i: number) => (st.num === "col" ? names[i] : st.num === "dot" ? `${i + 1}. ${names[i]}` : `${i + 1} ${names[i]}`);
  const minCap = Math.min(st.maxCap * 0.45, MIN_LIST_MM * k.mm * 0.75);
  const maxCols = Math.max(1, Math.min(4, Math.floor((box.w + st.colGap) / (st.maxCap * 7 + st.colGap))));

  interface Placed { col: number; line: number; lines: string[] }
  interface Plan { cap: number; cols: number; colW: number; numW: number; hang: number; items: Placed[]; total: number }

  const wrapAll = (cols: number, cap: number) => {
    const colW = (box.w - (cols - 1) * st.colGap) / cols;
    const numW = st.num === "col" ? widthAtCap(ctx, `${n}.`, cap, st.family, st.weight) + cap * 1.8 : 0;
    const hang = st.num === "col" ? numW : widthAtCap(ctx, st.num === "dot" ? `${n}. ` : `${n} `, cap, st.family, st.weight);
    const wrapped: string[][] = [];
    for (let i = 0; i < n; i++) {
      const lines = wrapWords(ctx, label(i), cap, st.family, st.weight, colW - numW, colW - hang);
      if (!lines || lines.length > 2) return null;
      wrapped.push(lines);
    }
    return { colW, numW, hang, wrapped };
  };

  const place = (cols: number, cap: number, limit: number): Plan | null => {
    const w = wrapAll(cols, cap);
    if (!w) return null;
    const items: Placed[] = [];
    let col = 0;
    let line = 0;
    for (const lines of w.wrapped) {
      if (line + lines.length > limit) {
        col++;
        line = 0;
      }
      if (col >= cols) return null;
      items.push({ col, line, lines });
      line += lines.length;
    }
    const total = w.wrapped.reduce((acc, l) => acc + l.length, 0);
    return { cap, cols, colW: w.colW, numW: w.numW, hang: w.hang, items, total };
  };
  const capacity = (cap: number) => Math.floor((box.h + (st.pitch - 1) * cap) / (st.pitch * cap));
  const feasible = (cols: number, cap: number) => (capacity(cap) >= 1 ? place(cols, cap, capacity(cap)) : null);

  let best: Plan | null = null;
  for (let cols = 1; cols <= maxCols; cols++) {
    let plan = feasible(cols, st.maxCap);
    if (!plan) {
      if (!feasible(cols, minCap)) continue;
      let lo = minCap;
      let hi = st.maxCap;
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) / 2;
        if (feasible(cols, mid)) lo = mid;
        else hi = mid;
      }
      plan = feasible(cols, lo);
    }
    if (plan && (!best || plan.cap > best.cap * 1.03 || (plan.cap >= best.cap * 0.97 && plan.total < best.total))) best = plan;
  }

  if (!best || best.cap < MIN_LIST_MM * k.mm) k.tight = true;

  if (!best) {
    // Último recurso (listas enormes): letra mínima, un renglón por canción, ajustada al ancho
    const cols = maxCols;
    const cap = minCap;
    const rows = Math.ceil(n / cols);
    const colW = (box.w - (cols - 1) * st.colGap) / cols;
    names.forEach((_, i) => {
      const x = box.x + Math.floor(i / rows) * (colW + st.colGap);
      const y = box.y + (i % rows) * cap * st.pitch;
      capText(ctx, label(i), x, y, cap, { family: st.family, weight: st.weight, color: st.color, maxW: colW });
    });
    return;
  }

  // Columnas parejas: el menor alto de columna con el que todo sigue cabiendo
  const target = Math.ceil(best.total / best.cols);
  for (let limit = target; limit <= capacity(best.cap); limit++) {
    const balanced = place(best.cols, best.cap, limit);
    if (balanced) {
      best = balanced;
      break;
    }
  }

  const { cap, colW, numW, hang } = best;
  best.items.forEach((it, i) => {
    const x = box.x + it.col * (colW + st.colGap);
    it.lines.forEach((text, j) => {
      const y = box.y + (it.line + j) * cap * st.pitch;
      if (st.num === "col" && j === 0) capText(ctx, `${i + 1}.`, x, y, cap, { family: st.family, weight: st.weight, color: st.numColor });
      const tx = j === 0 ? x + numW : x + hang;
      capText(ctx, text, tx, y, cap, { family: st.family, weight: st.weight, color: st.color });
    });
  });
}

/** Siempre 5 colores, ordenados de oscuro a claro (si la portada tiene menos, se completan con mezclas). */
export function fivePalette(p: string[]): string[] {
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

/** Recuadro redondeado (para la placa). */
export function roundedPanel(k: Kit, box: Box, r: number, color: string) {
  drawBox(box, () => {
    roundRectPath(k.ctx, box.x, box.y, box.w, box.h, r);
    k.ctx.fillStyle = color;
    k.ctx.fill();
  });
}

/** Nombres que se ven en el modo edición. */
export const EDIT_LABELS: Record<string, string> = {
  madeby: "Made By Vinilkiza",
  title: "Título",
  artist: "Artista",
  tracks: "Canciones",
  info: "Ficha",
  code: "Código",
  palette: "Colores",
  year: "Año",
  player: "Reproductor",
  dedication: "Dedicatoria",
  feat: "Invitados",
  length: "Duración",
  release: "Fecha",
  subtitle: "Línea secundaria",
};
