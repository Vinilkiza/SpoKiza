/* Pósters de álbum estilo Pinterest: 5 estilos, en vertical o en horizontal.
   Todo se mide relativo al ancho de la columna, así funciona en cualquier tamaño.
   Si la lista de canciones no alcanza el tamaño mínimo legible, la portada cede espacio. */

import type { AlbumStyle } from "../types";
import type { RenderOpts } from "./templates";
import type { Ctx } from "./draw";
import { mix } from "./color";
import {
  type Frame, type Kit, type ListStyle, LINE_GAP, UP, bleedImage, capText, code, codeH, cover, drawFitted,
  fitLines, fitWrap, infoBlock, infoBlockH, madeBy, MIN_SMALL_MM, pairs, pairsH, type PairStyle, makeKit, movable, rule, swatches, tracklist, widthAtCap, drawBox,
} from "./kit";

const STYLE_TEXT: Record<AlbumStyle, { upper: boolean; num: ListStyle["num"]; bold: boolean }> = {
  titular: { upper: true, num: "dot", bold: false },
  minimal: { upper: true, num: "col", bold: false },
  franja: { upper: true, num: "dot", bold: false },
  noche: { upper: true, num: "plain", bold: true },
  degradado: { upper: false, num: "dot", bold: false },
};

export function renderAlbum(ctx: Ctx, f: Frame, o: RenderOpts) {
  const style = o.settings.albumStyle;
  // Se prueba con la portada completa; si la lista queda muy pequeña, la portada se achica un poco y se repite.
  for (const scale of [1, 0.94, 0.88, 0.82, 0.76, 0.7]) {
    ctx.fillStyle = o.assets.colors.bg;
    ctx.fillRect(0, 0, o.W, o.H);
    if (o.boxes) o.boxes.length = 0;
    const k = makeKit(ctx, f, o);
    if (f.tw / f.th > 1.08) landscape(k, f, o, style, scale);
    else if (style === "titular") titular(k, f, scale);
    else if (style === "minimal") minimal(k, f, scale);
    else if (style === "franja") franja(k, f, scale);
    else if (style === "noche") noche(k, f, o, scale);
    else degradado(k, f, o, scale);
    if (!k.tight) return;
  }
}

/** Columna centrada: ancho de portada que cabe según la proporción que necesita el estilo. */
function column(f: Frame, ratio: number, scale: number) {
  const m = Math.min(f.tw, f.th) * 0.065;
  const full = f.tw - 2 * m;
  const c = Math.min(full, (f.th - 2 * m) / ratio) * scale;
  // Norma estética: todo el texto se alinea con los bordes de la portada (si la portada cede espacio, el texto también)
  const text = c;
  return { m, c, text, u: text / 100, X: f.x0 + (f.tw - text) / 2, top: f.y0 + m, bottom: f.y0 + f.th - m };
}

/* ---------------- 1. Titular: artista arriba, título gigante abajo ---------------- */

function titular(k: Kit, f: Frame, scale: number) {
  const { ctx, F } = k;
  const { m, c: cs, text: c, u, X, top, bottom } = column(f, 1.58, scale);
  const tf = { family: F.title, weight: F.titleWeight };
  const bw = F.bodyWeight;
  const R = X + c;

  const artist = fitLines(ctx, UP(k.o.content.artists || " "), tf.family, tf.weight, c * 0.62, 7.4 * u, 7.4 * u * 1.6, 2);
  // En Titular la firma va a la derecha, a la altura del nombre del artista
  madeBy(k, R, m, false, top + artist.cap / 2);
  movable(k, "artist", () => drawFitted(ctx, artist, X, top, { ...tf, color: k.fg }));
  let y = top + Math.max(artist.height, 5 * u) + 3.4 * u;
  cover(k, X + (c - cs) / 2, y, cs, cs);
  y += cs + 3.4 * u;

  const rightW = c * 0.36;
  const leftW = c * 0.6;

  // Derecha: paleta, ficha y título gigante
  const gap = 1.1 * u;
  const sw = (rightW - 4 * gap) / 5;
  let ry = y;
  movable(k, "palette", () => swatches(k, 5, R, y, sw, gap));
  ry += k.o.settings.showPalette && k.palette.length ? sw + 3 * u : 0;
  const cap = 2 * u * (F.bodyScale > 1 ? 1.1 : 1);
  const items = ([
    [k.L.genre, k.info.genre],
    [k.L.release, k.info.release],
    [k.L.label, k.info.label],
    [k.L.length, k.info.length],
  ] as [string, string][]).filter(([, v]) => v);
  // Norma: el título gigante tiene prioridad; la ficha (dato pequeño arriba, valor debajo) se acomoda en lo que queda
  const title = fitLines(ctx, UP(k.o.content.title || " "), tf.family, tf.weight, c * 0.44, 15 * u, 17 * u, 3);
  const infoRoom = bottom - title.height - 4 * u - ry;
  const minCap = MIN_SMALL_MM * k.mm;
  const ps = (sc: number): PairStyle => ({
    align: "right", labelCap: Math.max(minCap, 1.1 * u * sc), valueCap: Math.max(minCap, 1.75 * u * sc), w: rightW,
    valueFamily: F.body, valueWeight: F.bodyBold, color: k.fg, muted: k.muted,
  });
  let sc = 1;
  while (sc > 0.6 && pairsH(k, items, ps(sc)) > infoRoom) sc *= 0.93;
  const infoY = ry;
  movable(k, "info", () => pairs(k, items, R, infoY, ps(sc)));
  movable(k, "title", () =>
    title.lines.forEach((l, i) => {
      const yT = bottom - title.height + i * title.cap * (1 + LINE_GAP);
      capText(ctx, l, R, yT, title.cap, { ...tf, color: k.fg, align: "right" });
    }),
  );

  // Izquierda: canciones y código
  const cw = c * 0.37;
  const ch = codeH(k, cw);
  if (ch) movable(k, "code", () => code(k, X - cw * 0.02, bottom - ch, cw));
  movable(k, "tracks", () =>
    tracklist(k, { x: X, y, w: leftW, h: bottom - y - (ch ? ch + 3 * u : 0) }, {
      upper: true, num: "dot", maxCap: cap * 1.12, pitch: 2.05, weight: bw,
      family: F.body, color: k.fg, numColor: k.fg, colGap: 3 * u,
    }),
  );
}

/* ---------------- 2. Minimal: líneas finas y ficha en tres columnas ---------------- */

function minimal(k: Kit, f: Frame, scale: number) {
  const { ctx, F } = k;
  const { m, c: cs, text: c, u, X, top, bottom } = column(f, 1.58, scale);
  const R = X + c;
  madeBy(k, R, m);
  let y = top;
  cover(k, X + (c - cs) / 2, y, cs, cs);
  y += cs + 4.4 * u;

  const sw = 3.3 * u;
  const gap = 0.8 * u;
  const n = k.o.settings.showPalette ? Math.min(5, k.palette.length) : 0;
  const palW = n ? n * sw + (n - 1) * gap : 0;
  const title = fitLines(ctx, UP(k.o.content.title || " "), F.title, F.titleWeight, c - palW - 4 * u, 5.4 * u, 5.4 * u * 2.3, 2);
  const ty = y;
  movable(k, "title", () => drawFitted(ctx, title, X, ty, { family: F.title, weight: F.titleWeight, color: k.fg }));
  movable(k, "palette", () => swatches(k, 5, R, ty + (title.cap - sw) / 2, sw, gap));
  y += title.height + 2.4 * u;
  const aCap = 3 * u;
  const artist = fitLines(ctx, k.o.content.artists || " ", F.body, F.bodyWeight, c - palW - 4 * u, aCap, aCap * 2.4, 2);
  const ay = y;
  movable(k, "artist", () => drawFitted(ctx, artist, X, ay, { family: F.body, weight: F.bodyWeight, color: k.fg }));
  y += artist.height + 4.2 * u;
  rule(k, X, y, c, 0.13 * u, k.muted);
  y += 4.2 * u;

  // Ficha inferior
  const lCap = Math.max(0.95 * u, k.mm * 1.05);
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

  const ly = y;
  movable(k, "tracks", () =>
    tracklist(k, { x: X, y: ly, w: c, h: ruleY - 4 * u - ly }, {
      upper: true, num: "col", maxCap: 1.6 * u, pitch: 2.3,
      weight: F.bodyWeight, family: F.body, color: k.fg, numColor: k.muted, colGap: 6 * u,
    }),
  );
  rule(k, X, ruleY, c, 0.13 * u, k.muted);

  const slots = items.length + (ch ? 1 : 0);
  const slotW = slots ? c / Math.max(3, slots) : c;
  movable(k, "info", () =>
    items.forEach(([label, value], i) => {
      const x = X + i * slotW;
      capText(ctx, UP(label), x, footerTop, lCap, { family: "'Montserrat'", weight: 600, color: k.muted, spacing: 0.12, maxW: slotW - 2 * u });
      const fw = fitWrap(ctx, value, vCap, F.body, F.bodyWeight, slotW - 2.5 * u, 2);
      fw.lines.forEach((line, j) =>
        capText(ctx, line, x, footerTop + lCap + 1.8 * u + j * vCap * 1.6, fw.cap, { family: F.body, weight: F.bodyWeight, color: k.fg, maxW: slotW - 2.5 * u }),
      );
    }),
  );
  if (ch) movable(k, "code", () => code(k, R - cw, bottom - ch, cw));
}

/* ---------------- 3. Franja: título arriba, barra de colores ---------------- */

function franja(k: Kit, f: Frame, scale: number) {
  const { ctx, F } = k;
  const { m, c: cs, text: c, u, X, top, bottom } = column(f, 1.68, scale);
  const R = X + c;
  const tf = { family: F.title, weight: F.titleWeight };
  madeBy(k, R, m);
  rule(k, X, top, c, 0.45 * u);
  let y = top + 0.45 * u + 3 * u;

  const yearCap = 3.6 * u;
  let yearW = 0;
  const yy = y;
  if (k.info.year) {
    yearW = widthAtCap(ctx, k.info.year, yearCap, tf.family, tf.weight);
    movable(k, "year", () => capText(ctx, k.info.year, R, yy, yearCap, { ...tf, color: k.fg, align: "right" }));
  }
  const title = fitLines(ctx, UP(k.o.content.title || " "), tf.family, tf.weight, c - yearW - 5 * u, 8.6 * u, 8.6 * u * 1.6, 2);
  movable(k, "title", () => drawFitted(ctx, title, X, yy, { ...tf, color: k.fg }));
  y += Math.max(title.height, yearCap) + 3.4 * u;

  cover(k, X + (c - cs) / 2, y, cs, cs);
  y += cs + 3 * u;

  if (k.o.settings.showPalette && k.palette.length) {
    const list = k.palette.slice(0, 5);
    const segW = c / list.length;
    const by = y;
    movable(k, "palette", () =>
      drawBox({ x: X, y: by, w: c, h: 2.2 * u }, () =>
        list.forEach((col, i) => {
          ctx.fillStyle = col;
          ctx.fillRect(X + i * segW, by, segW + 0.5, 2.2 * u);
        }),
      ),
    );
    y += 2.2 * u + 4 * u;
  } else y += 1.5 * u;

  const listCap = 1.9 * u * (F.bodyScale > 1 ? 1.08 : 1);
  const ly = y;
  movable(k, "tracks", () =>
    tracklist(k, { x: X, y: ly, w: c * 0.46, h: bottom - ly }, {
      upper: true, num: "dot", maxCap: listCap, pitch: 2.25, weight: F.bodyWeight,
      family: F.body, color: k.fg, numColor: k.fg, colGap: 4 * u,
    }),
  );

  // Derecha. Norma: todo debe caber entre la lista y el borde inferior. Se mide antes de dibujar;
  // si no cabe, primero se achica la letra y el código; si aun así no cabe, la portada cede espacio.
  const rw = c * 0.48;
  const room = bottom - ly;
  const minCap = MIN_SMALL_MM * k.mm;
  const infoItems = ([[k.L.release, k.info.release], [k.L.length, k.info.length], [k.L.label, k.info.label]] as [string, string][]).filter(([, v]) => v);
  const ps = (cap: number): PairStyle => ({
    align: "right", labelCap: Math.max(minCap, cap * 0.62), valueCap: cap, w: rw,
    valueFamily: F.body, valueWeight: F.bodyBold, color: k.fg, muted: k.muted,
  });
  const featText = k.info.feat ? UP(`${k.L.feat} ${k.info.feat}`) : "";
  const measure = (sc: number) => {
    const cap = Math.max(minCap, listCap * sc);
    const cw = c * (0.32 * Math.max(0.7, sc));
    const ch = codeH(k, cw);
    const artist = fitLines(ctx, UP(k.o.content.artists || " "), tf.family, tf.weight, rw, 6 * u * sc, 6 * u * 1.7 * sc, 3);
    let h = artist.height + 3.6 * u * sc + pairsH(k, infoItems, ps(cap));
    if (ch) h += cap * 2.2 + ch;
    const fw = featText ? fitWrap(ctx, featText, cap * 0.92, F.body, F.bodyWeight, rw, 4) : null;
    if (fw) h += cap + fw.lines.length * fw.cap * 2.05 - fw.cap * 1.05;
    return { cap, cw, ch, artist, fw, h, sc };
  };
  let R2 = measure(1);
  for (const sc of [0.92, 0.84, 0.76, 0.68, 0.6]) {
    if (R2.h <= room) break;
    R2 = measure(sc);
  }
  if (R2.h > room) k.tight = true;
  const { cap, cw, ch, artist, fw, sc } = R2;

  movable(k, "artist", () =>
    artist.lines.forEach((l, i) => capText(ctx, l, R, ly + i * artist.cap * (1 + LINE_GAP), artist.cap, { ...tf, color: k.fg, align: "right" })),
  );
  let ry = ly + artist.height + 3.6 * u * sc;
  const body = { family: F.body, weight: F.bodyWeight, color: k.fg, align: "right" as const, maxW: rw };
  const iy = ry;
  const afterInfo = { y: ry };
  movable(k, "info", () => {
    afterInfo.y = pairs(k, infoItems, R, iy, ps(cap));
  });
  ry = afterInfo.y;
  if (ch) {
    ry += cap * 2.2;
    const cy = ry;
    movable(k, "code", () => code(k, R - cw, cy, cw));
    ry += ch;
  }
  if (fw) {
    const startY = Math.max(ry + cap, bottom - (fw.lines.length * fw.cap * 2.05 - fw.cap * 1.05));
    movable(k, "feat", () => fw.lines.forEach((l, i) => capText(ctx, l, R, startY + i * fw.cap * 2.05, fw.cap, { ...body, color: k.muted })));
  }
}

/* ---------------- 4. Noche: foto a sangre que se funde en el fondo ---------------- */

function noche(k: Kit, f: Frame, o: RenderOpts, scale: number) {
  const { ctx, F } = k;
  const u = f.tw / 100;
  const m = 6.5 * u;
  const X = f.x0 + m;
  const c = f.tw - 2 * m;
  const R = X + c;
  const bottom = f.y0 + f.th - m;
  const side = o.W;
  const infoTop = Math.min(side * 0.8, bottom - 46 * u) - (1 - scale) * f.th * 0.6;
  bleedImage(k, { x: 0, y: 0, w: o.W, h: side }, infoTop - side * 0.42, infoTop + 1.5 * u, "down");
  madeBy(k, R, m, true);

  const bold = F.bodyBold;
  const cap = 1.55 * u;
  const lenCap = 2 * u;
  if (k.info.length)
    movable(k, "length", () => capText(ctx, UP(`${k.L.length}: ${k.info.length}`), X, bottom - lenCap, lenCap, { family: F.body, weight: bold, color: k.fg }));
  movable(k, "tracks", () =>
    tracklist(k, { x: X, y: infoTop, w: c * 0.54, h: bottom - infoTop - (k.info.length ? lenCap + 4 * u : 0) }, {
      upper: true, num: "plain", maxCap: cap, pitch: 2.15, weight: bold,
      family: F.body, color: k.fg, numColor: k.fg, colGap: 3.5 * u,
    }),
  );

  const rw = c * 0.42;
  const gap = 0.9 * u;
  const sw = Math.min(5.4 * u, (rw - 4 * gap) / 5);
  let ry = infoTop;
  movable(k, "palette", () => swatches(k, 5, R, infoTop, sw, gap));
  ry += o.settings.showPalette && k.palette.length ? sw + 3.6 * u : 0;
  const artist = fitLines(ctx, UP(o.content.artists || " "), F.title, F.titleWeight, rw, 4.2 * u, 4.2 * u * 1.7, 2);
  const ay = ry;
  movable(k, "artist", () =>
    artist.lines.forEach((l, i) => capText(ctx, l, R, ay + i * artist.cap * (1 + LINE_GAP), artist.cap, { family: F.title, weight: F.titleWeight, color: k.fg, align: "right" })),
  );
  ry += artist.height + 2.2 * u;
  const accent = mix(k.fg, k.bg, 0.42);
  const title = fitLines(ctx, UP(o.content.title || " "), F.title, F.titleWeight, rw, 5.2 * u, 5.2 * u * 2.5, 3);
  const ty = ry;
  movable(k, "title", () =>
    title.lines.forEach((l, i) => capText(ctx, l, R, ty + i * title.cap * (1 + LINE_GAP), title.cap, { family: F.title, weight: F.titleWeight, color: accent, align: "right" })),
  );

  const cw = Math.min(rw, 33 * u);
  const ch = codeH(k, cw);
  if (ch) movable(k, "code", () => code(k, R - cw, bottom - ch, cw));
  if (k.info.release) {
    const rCap = 1.45 * u;
    const yRel = bottom - (ch ? ch + 3.5 * u : 0) - rCap * 3.2;
    const st = { family: F.body, weight: bold, color: k.fg, align: "right" as const, maxW: rw };
    movable(k, "release", () => {
      capText(ctx, UP(k.L.releasedOn), R, yRel, rCap, st);
      capText(ctx, UP(k.info.release), R, yRel + rCap * 2.2, rCap, st);
    });
  }
}

/* ---------------- 5. Degradado: foto que se funde al color del álbum ---------------- */

function degradado(k: Kit, f: Frame, o: RenderOpts, scale: number) {
  const { ctx, F } = k;
  const u = f.tw / 100;
  const m = 6.5 * u;
  const X = f.x0 + m;
  const c = f.tw - 2 * m;
  const R = X + c;
  const bottom = f.y0 + f.th - m;
  const infoTop = Math.min(f.y0 + f.th * 0.63, bottom - 50 * u) - (1 - scale) * f.th * 0.6;
  bleedImage(k, { x: 0, y: 0, w: o.W, h: infoTop + 8 * u }, infoTop - f.th * 0.2, infoTop + 1 * u, "down");
  madeBy(k, R, m, true);

  // Paleta: 5 cuadros iguales alineados con la columna derecha y centrados con el título
  const showPal = o.settings.showPalette && k.palette.length > 0;
  const rw = c * 0.36;
  const gap = 1.1 * u;
  const sw = (rw - 4 * gap) / 5;
  const textW = c - (showPal ? rw + 5 * u : 0);
  const title = fitLines(ctx, o.content.title || " ", F.title, F.titleWeight, textW, 4.4 * u, 4.4 * u * 1.7, 2);
  const aCap = 2.4 * u;
  const artist = fitLines(ctx, o.content.artists || " ", F.body, 400, textW, aCap, aCap * 2.4, 2);
  const blockH = title.height + 2.2 * u + artist.height;
  const palY = infoTop + Math.max(0, (blockH - sw) / 2);
  if (showPal) movable(k, "palette", () => swatches(k, 5, R, palY, sw, gap));
  movable(k, "title", () => drawFitted(ctx, title, X, infoTop, { family: F.title, weight: F.titleWeight, color: k.fg }));
  let y = infoTop + title.height + 2.2 * u;
  const ay = y;
  movable(k, "artist", () => drawFitted(ctx, artist, X, ay, { family: F.body, weight: 400, color: k.fg }));
  y = Math.max(y + artist.height, showPal ? palY + sw : 0) + 3.6 * u;
  rule(k, X, y, c, 0.5 * u);
  y += 4.2 * u;

  const ly = y;
  movable(k, "tracks", () =>
    tracklist(k, { x: X, y: ly, w: c * 0.6, h: bottom - ly }, {
      upper: false, num: "dot", maxCap: 1.55 * u, pitch: 2.35, weight: F.bodyWeight,
      family: F.body, color: k.fg, numColor: k.fg, colGap: 4 * u,
    }),
  );

  const st = { family: F.body, color: k.fg, align: "right" as const, maxW: c * 0.36 };
  const lCap = 1.75 * u;
  const vCap = 1.6 * u;
  movable(k, "info", () => {
    let ry = ly;
    for (const [label, value] of [[k.L.release, k.info.release], [k.L.length, k.info.length]] as const) {
      if (!value) continue;
      capText(ctx, label, R, ry, lCap, { ...st, weight: F.bodyBold });
      ry = infoBlock(ctx, [value], R, ry + lCap * 2.1, vCap, 2.1, c * 0.36, { ...st, weight: 400 }) + vCap * 1.3;
    }
  });
  const cw = Math.min(c * 0.34, 30 * u);
  const ch = codeH(k, cw);
  if (ch) movable(k, "code", () => code(k, R - cw, bottom - ch, cw));
}

/* ---------------- Horizontal (cualquier estilo) ---------------- */

function landscape(k: Kit, f: Frame, o: RenderOpts, style: AlbumStyle, scale: number) {
  const { ctx, F } = k;
  const t = STYLE_TEXT[style];
  const m = f.th * 0.07;
  const side = Math.min(f.th - 2 * m, f.tw * 0.46) * scale;
  const u = Math.min(f.th - 2 * m, f.tw * 0.46) / 100;
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
  madeBy(k, R, m * 0.9);

  const sw = 3.6 * u;
  const n = o.settings.showPalette ? Math.min(5, k.palette.length) : 0;
  const palW = n ? n * sw + (n - 1) * 0.9 * u : 0;
  const title = fitLines(ctx, t.upper ? UP(o.content.title || " ") : o.content.title || " ", tf.family, tf.weight, iw - palW - 4 * u, 12 * u, 12 * u * 1.7, 2);
  movable(k, "title", () => drawFitted(ctx, title, ix, top, { ...tf, color: k.fg }));
  movable(k, "palette", () => swatches(k, 5, R, top, sw, 0.9 * u));
  let y = top + title.height + 2.6 * u;
  const aCap = 3.2 * u;
  const artist = fitLines(ctx, t.upper ? UP(o.content.artists || " ") : o.content.artists || " ", F.body, bw, iw, aCap, aCap * 2.4, 2);
  const ay = y;
  movable(k, "artist", () => drawFitted(ctx, artist, ix, ay, { family: F.body, weight: bw, color: k.fg }));
  y += artist.height + 4 * u;
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
  const lCap = Math.max(1.05 * u, k.mm * 1.05);
  const vCap = 1.8 * u;
  const footerH = Math.max(lCap + 1.8 * u + vCap * 2.6, ch);
  const footerTop = bottom - footerH;
  if (ch) movable(k, "code", () => code(k, R - cw, bottom - ch, cw));
  const slotsW = iw - (ch ? cw + 3 * u : 0);
  const slotW = items.length ? slotsW / items.length : slotsW;
  movable(k, "info", () =>
    items.forEach(([label, value], i) => {
      const x = ix + i * slotW;
      capText(ctx, UP(label), x, footerTop, lCap, { family: "'Montserrat'", weight: 600, color: k.muted, spacing: 0.1, maxW: slotW - 2 * u });
      const fw = fitWrap(ctx, t.upper ? UP(value) : value, vCap, F.body, F.bodyWeight, slotW - 2 * u, 2);
      fw.lines.forEach((line, j) =>
        capText(ctx, line, x, footerTop + lCap + 1.8 * u + j * vCap * 1.6, fw.cap, { family: F.body, weight: F.bodyWeight, color: k.fg, maxW: slotW - 2 * u }),
      );
    }),
  );
  const ruleY = footerTop - 3.6 * u;
  rule(k, ix, ruleY, iw, 0.15 * u, k.muted);
  const ly = y;
  movable(k, "tracks", () =>
    tracklist(k, { x: ix, y: ly, w: iw, h: ruleY - 3.6 * u - ly }, {
      upper: t.upper, num: t.num, maxCap: 2.3 * u, pitch: 2.15, weight: bw,
      family: F.body, color: k.fg, numColor: k.fg, colGap: 4 * u,
    }),
  );
}
