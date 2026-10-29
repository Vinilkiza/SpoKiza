import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/* PDF de impresión: imagen a 300 DPI con sangrado, marcas de corte,
   TrimBox/BleedBox y una línea de información fuera del área de corte. */

const PT_PER_MM = 72 / 25.4;
const SLUG_MM = 10; // margen exterior donde van las marcas
const MARK_LEN_MM = 5;
const MARK_GAP_MM = 1.5; // separación de la marca respecto al borde del sangrado

export interface PdfPiece {
  jpeg: Uint8Array; // imagen completa (incluye sangrado)
  trimWmm: number;
  trimHmm: number;
  bleedMm: number;
  label: string;
}

const mm = (v: number) => v * PT_PER_MM;

/** Quita caracteres que la fuente estándar del PDF no puede escribir. */
function pdfSafe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ]/g, "").slice(0, 140);
}

function mark(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, color: rgb(0, 0, 0) });
}

/** Marcas de corte en las esquinas de un recuadro (coordenadas en mm, origen abajo-izquierda). */
function cornerMarks(page: PDFPage, x: number, y: number, w: number, h: number, bleed: number) {
  const off = bleed + MARK_GAP_MM;
  const xs = [x, x + w];
  const ys = [y, y + h];
  for (const cx of xs) {
    for (const cy of ys) {
      const dirX = cx === x ? -1 : 1;
      const dirY = cy === y ? -1 : 1;
      // marca horizontal (alineada con el borde superior/inferior)
      mark(page, mm(cx + dirX * off), mm(cy), mm(cx + dirX * (off + MARK_LEN_MM)), mm(cy));
      // marca vertical (alineada con el borde izquierdo/derecho)
      mark(page, mm(cx), mm(cy + dirY * off), mm(cx), mm(cy + dirY * (off + MARK_LEN_MM)));
    }
  }
}

function slugText(page: PDFPage, font: PDFFont, text: string) {
  page.drawText(pdfSafe(text), { x: mm(SLUG_MM), y: mm(3), size: 6, font, color: rgb(0.2, 0.2, 0.2) });
}

/** Un PDF con una página por diseño. */
export async function buildPdf(pieces: PdfPiece[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setProducer("Vinilkiza Música");
  doc.setCreator("Vinilkiza Música");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const p of pieces) {
    const img = await doc.embedJpg(p.jpeg);
    const fullW = p.trimWmm + 2 * p.bleedMm;
    const fullH = p.trimHmm + 2 * p.bleedMm;
    const pageW = fullW + 2 * SLUG_MM;
    const pageH = fullH + 2 * SLUG_MM;
    const page = doc.addPage([mm(pageW), mm(pageH)]);
    page.drawImage(img, { x: mm(SLUG_MM), y: mm(SLUG_MM), width: mm(fullW), height: mm(fullH) });
    const tx = SLUG_MM + p.bleedMm;
    const ty = SLUG_MM + p.bleedMm;
    page.setBleedBox(mm(SLUG_MM), mm(SLUG_MM), mm(fullW), mm(fullH));
    page.setTrimBox(mm(tx), mm(ty), mm(p.trimWmm), mm(p.trimHmm));
    cornerMarks(page, tx, ty, p.trimWmm, p.trimHmm, p.bleedMm);
    slugText(page, font, `${p.label}  ·  ${fmt(p.trimWmm / 10)} x ${fmt(p.trimHmm / 10)} cm  ·  sangrado ${p.bleedMm} mm`);
  }
  return doc.save();
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");

export interface SheetSpec {
  label: string;
  w: number; // mm
  h: number; // mm
}

export const SHEETS: SheetSpec[] = [
  { label: "Carta (21,6 × 27,9 cm)", w: 215.9, h: 279.4 },
  { label: "Oficio (21,6 × 33 cm)", w: 215.9, h: 330 },
  { label: "A4 (21 × 29,7 cm)", w: 210, h: 297 },
  { label: "A3 (29,7 × 42 cm)", w: 297, h: 420 },
  { label: "Tabloide (27,9 × 43,2 cm)", w: 279.4, h: 431.8 },
  { label: "Pliego 1/4 (35 × 50 cm)", w: 350, h: 500 },
];

/**
 * Pliego: acomoda varios diseños del mismo tamaño en hojas, con marcas de corte
 * en los bordes de la hoja alineadas con cada fila y columna.
 */
export async function buildSheetPdf(pieces: PdfPiece[], sheet: SheetSpec, copies = 1, marginMm = 10): Promise<{ bytes: Uint8Array; perSheet: number; sheets: number }> {
  if (!pieces.length) throw new Error("No hay diseños para el pliego");
  const { trimWmm, trimHmm, bleedMm } = pieces[0];
  const pw = trimWmm + 2 * bleedMm;
  const ph = trimHmm + 2 * bleedMm;

  // Prueba hoja vertical y horizontal; usa la que más piezas acomoda
  const fit = (sw: number, sh: number) => ({
    cols: Math.floor((sw - 2 * marginMm) / pw),
    rows: Math.floor((sh - 2 * marginMm) / ph),
    sw,
    sh,
  });
  const a = fit(sheet.w, sheet.h);
  const b = fit(sheet.h, sheet.w);
  const best = a.cols * a.rows >= b.cols * b.rows ? a : b;
  const perSheet = best.cols * best.rows;
  if (perSheet < 1) throw new Error("El diseño no cabe en esa hoja con márgenes de 1 cm");

  const list: PdfPiece[] = [];
  for (const p of pieces) for (let i = 0; i < copies; i++) list.push(p);

  const doc = await PDFDocument.create();
  doc.setProducer("Vinilkiza Música");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const embedded = new Map<PdfPiece, Awaited<ReturnType<typeof doc.embedJpg>>>();
  for (const p of pieces) embedded.set(p, await doc.embedJpg(p.jpeg));

  const gridW = best.cols * pw;
  const gridH = best.rows * ph;
  const ox = (best.sw - gridW) / 2;
  const oy = (best.sh - gridH) / 2;
  const sheets = Math.ceil(list.length / perSheet);

  for (let s = 0; s < sheets; s++) {
    const page = doc.addPage([mm(best.sw), mm(best.sh)]);
    const slice = list.slice(s * perSheet, (s + 1) * perSheet);
    slice.forEach((p, i) => {
      const col = i % best.cols;
      const row = Math.floor(i / best.cols);
      const x = ox + col * pw;
      const y = best.sh - oy - (row + 1) * ph; // filas de arriba hacia abajo
      page.drawImage(embedded.get(p)!, { x: mm(x), y: mm(y), width: mm(pw), height: mm(ph) });
    });
    // Marcas en los bordes de la hoja para cada línea de corte
    const usedRows = Math.ceil(slice.length / best.cols);
    const usedCols = Math.min(best.cols, slice.length);
    const top = best.sh - oy;
    const bottom = best.sh - oy - usedRows * ph;
    for (let c = 0; c < usedCols; c++) {
      for (const cx of [ox + c * pw + bleedMm, ox + (c + 1) * pw - bleedMm]) {
        mark(page, mm(cx), mm(top + MARK_GAP_MM), mm(cx), mm(Math.min(best.sh - 1, top + MARK_GAP_MM + MARK_LEN_MM)));
        mark(page, mm(cx), mm(bottom - MARK_GAP_MM), mm(cx), mm(Math.max(1, bottom - MARK_GAP_MM - MARK_LEN_MM)));
      }
    }
    const left = ox;
    const right = ox + usedCols * pw;
    for (let r = 0; r < usedRows; r++) {
      const rowTop = top - r * ph;
      for (const cy of [rowTop - bleedMm, rowTop - ph + bleedMm]) {
        mark(page, mm(left - MARK_GAP_MM), mm(cy), mm(Math.max(1, left - MARK_GAP_MM - MARK_LEN_MM)), mm(cy));
        mark(page, mm(right + MARK_GAP_MM), mm(cy), mm(Math.min(best.sw - 1, right + MARK_GAP_MM + MARK_LEN_MM)), mm(cy));
      }
    }
    page.drawText(
      pdfSafe(`Vinilkiza  ·  ${sheet.label}  ·  hoja ${s + 1}/${sheets}  ·  ${slice.length} piezas de ${fmt(trimWmm / 10)} x ${fmt(trimHmm / 10)} cm`),
      { x: mm(3), y: mm(2), size: 5.5, font, color: rgb(0.25, 0.25, 0.25) },
    );
  }
  return { bytes: await doc.save(), perSheet, sheets };
}
