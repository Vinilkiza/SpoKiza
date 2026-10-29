/* Poster de canción, polaroid y placa tipo Spotify.
   Misma norma que los pósters de álbum: los textos nunca se cortan, la foto/portada
   toma el espacio que sobra y los tamaños tienen un mínimo legible en milímetros. */

import type { RenderOpts } from "./templates";
import type { Ctx } from "./draw";
import {
  type Frame, type Kit, MIN_SMALL_MM, capText, code, codeH, cover, drawFitted, fitLines, fitWrap,
  madeBy, makeKit, movable, player, playerMetrics,
} from "./kit";

export function renderSong(ctx: Ctx, f: Frame, o: RenderOpts) {
  const k = makeKit(ctx, f, o);
  if (o.settings.product === "polaroid") return polaroid(k, f);
  if (o.settings.product === "placa") return plaque(k, f);
  return posterSong(k, f);
}

interface Texts {
  title: ReturnType<typeof fitLines>;
  artist: ReturnType<typeof fitLines>;
  height: number;
  gap: number;
}

/** Título + artista para un ancho dado. */
function texts(k: Kit, w: number, u: number, titleCap: number, artistCap: number, artistWeight = 500): Texts {
  const { ctx, F } = k;
  const title = fitLines(ctx, k.o.content.title || " ", F.title, F.titleWeight, w, titleCap, titleCap * 2.4, 2);
  const aCap = Math.max(artistCap, MIN_SMALL_MM * k.mm);
  const artist = fitLines(ctx, k.o.content.artists || " ", F.body, artistWeight, w, aCap, aCap * 2.4, 2);
  const gap = 1.6 * u;
  return { title, artist, gap, height: title.height + (k.o.content.artists ? gap + artist.height : 0) };
}

function drawTexts(k: Kit, t: Texts, x: number, y: number, align: CanvasTextAlign = "left", artistWeight = 500) {
  const { ctx, F } = k;
  movable(k, "title", () => drawFitted(ctx, t.title, x, y, { family: F.title, weight: F.titleWeight, color: k.fg, align }));
  if (k.o.content.artists) {
    const ay = y + t.title.height + t.gap;
    movable(k, "artist", () => drawFitted(ctx, t.artist, x, ay, { family: F.body, weight: artistWeight, color: k.fg, align }));
  }
}

/** Dedicatoria en cursiva, hasta 3 líneas, centrada. Devuelve la altura que ocupará. */
function dedicationFit(k: Kit, w: number, cap: number) {
  const text = k.o.content.dedication.trim();
  if (!text) return null;
  const c = Math.max(cap, MIN_SMALL_MM * 1.2 * k.mm);
  const fw = fitWrap(k.ctx, text, c, k.F.italic, 400, w, 3, true);
  return { ...fw, height: fw.lines.length * fw.cap * 1.75 - fw.cap * 0.75 };
}

function drawDedication(k: Kit, d: NonNullable<ReturnType<typeof dedicationFit>>, cx: number, y: number) {
  movable(k, "dedication", () =>
    d.lines.forEach((l, i) =>
      capText(k.ctx, l, cx, y + i * d.cap * 1.75, d.cap, { family: k.F.italic, weight: 400, italic: true, color: k.fg, align: "center" }),
    ),
  );
}

/* ---------------- Poster de canción ---------------- */

function posterSong(k: Kit, f: Frame) {
  const m = Math.min(f.tw, f.th) * 0.07;
  const full = f.tw - 2 * m;
  const top = f.y0 + m;
  const bottom = f.y0 + f.th - m;
  const showPlayer = k.o.settings.showPlayer;
  const sub = k.o.content.subtitle?.trim();

  const parts = (c: number) => {
    const u = c / 100;
    const t = texts(k, c, u, 6.5 * u, 2.8 * u, 600);
    const subCap = Math.max(1.6 * u, MIN_SMALL_MM * k.mm);
    const ded = dedicationFit(k, c * 0.9, 2.6 * u);
    const cw = c * 0.36;
    const ch = codeH(k, cw);
    const upper = 5 * u + t.height + (sub ? 2.2 * u + subCap : 0) + (showPlayer ? 4.5 * u + playerMetrics(k, u).height : 0);
    const lower = (ded ? ded.height + (ch ? 5 * u : 0) : 0) + ch;
    const gapMid = ded || ch ? 6 * u : 0;
    return { u, t, subCap, ded, cw, ch, upper, lower, gapMid };
  };
  // La portada toma todo el espacio que dejan los textos (máximo cuadrada a lo ancho)
  let c = full;
  for (let i = 0; i < 5; i++) {
    const p = parts(c);
    c = Math.max(full * 0.45, Math.min(full, f.th - 2 * m - p.upper - p.lower - p.gapMid));
  }
  const p = parts(c);
  const X = f.x0 + (f.tw - c) / 2;
  madeBy(k, X + c, m);
  cover(k, X, top, c, c);

  let y = top + c + 5 * p.u;
  drawTexts(k, p.t, X, y, "left", 600);
  y += p.t.height;
  if (sub) {
    y += 2.2 * p.u;
    const sy = y;
    movable(k, "subtitle", () => capText(k.ctx, sub, X, sy, p.subCap, { family: k.F.body, weight: 400, color: k.muted, maxW: c }));
    y += p.subCap;
  }
  if (showPlayer) {
    y += 4.5 * p.u;
    const py = y;
    movable(k, "player", () => player(k, X, py, c, p.u));
  }
  // Abajo: dedicatoria y código, anclados al margen inferior
  if (p.ch) movable(k, "code", () => code(k, X + (c - p.cw) / 2, bottom - p.ch, p.cw));
  if (p.ded) drawDedication(k, p.ded, X + c / 2, bottom - p.lower);
}

/* ---------------- Polaroid ---------------- */

function polaroid(k: Kit, f: Frame) {
  const side = f.tw * 0.06;
  const X = f.x0 + side;
  const pw = f.tw - 2 * side;
  const u = pw / 100;
  const showPlayer = k.o.settings.showPlayer;
  const cw = 30 * u;
  const ch = codeH(k, cw);
  const textW = ch ? pw - cw - 4 * u : pw;
  const t = texts(k, textW, u, 5.6 * u, 3 * u, 500);
  const pm = playerMetrics(k, u * 1.1);
  const ded = dedicationFit(k, pw * 0.92, 3 * u);
  const rowH = Math.max(t.height, ch);
  const lower = 4.5 * u + rowH + (showPlayer ? 3.5 * u + pm.height : 0) + (ded ? 3 * u + ded.height : 0) + 5 * u;
  // Foto cuadrada si cabe; si no, se recorta en alto para que todo lo de abajo quepa
  const ph = Math.max(pw * 0.55, Math.min(pw, f.th - side - lower));
  madeBy(k, X + pw, side);
  cover(k, X, f.y0 + side, pw, ph);

  let y = f.y0 + side + ph + 4.5 * u;
  drawTexts(k, t, X, y + Math.max(0, (ch - t.height) / 2));
  if (ch) {
    const cy = y + Math.max(0, (t.height - ch) / 2);
    movable(k, "code", () => code(k, X + pw - cw, cy, cw));
  }
  y += rowH;
  if (showPlayer) {
    y += 3.5 * u;
    const py = y;
    movable(k, "player", () => player(k, X, py, pw, u * 1.1));
    y += pm.height;
  }
  if (ded) drawDedication(k, ded, X + pw / 2, y + 3 * u);
}

/* ---------------- Placa tipo Spotify ---------------- */

function plaque(k: Kit, f: Frame) {
  const m = f.tw * 0.07;
  const X = f.x0 + m;
  const c = f.tw - 2 * m;
  const u = c / 100;
  const top = f.y0 + m;
  const bottom = f.y0 + f.th - m;
  const showPlayer = k.o.settings.showPlayer;
  const cw = c * 0.46;
  const ch = codeH(k, cw);
  const t = texts(k, c, u, 6 * u, 3.2 * u, 500);
  const pm = playerMetrics(k, u);
  const block = (ch ? ch + 4.5 * u : 0) + t.height + (showPlayer ? 4.5 * u + pm.height : 0);
  const ph = Math.max(c * 0.6, Math.min(c * 1.1, bottom - top - block - 6 * u));
  madeBy(k, X + c, m);
  cover(k, X, top, c, ph, 2.2 * u);

  // Bloque inferior anclado abajo (el espacio que sobre queda entre la foto y el bloque)
  let y = bottom - block;
  if (ch) {
    const cy = y;
    movable(k, "code", () => code(k, X, cy, cw));
    y += ch + 4.5 * u;
  }
  drawTexts(k, t, X, y);
  y += t.height;
  if (showPlayer) {
    const py = y + 4.5 * u;
    movable(k, "player", () => player(k, X, py, c, u));
  }
}
