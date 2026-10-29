import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

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
  doc.setProducer("SpoKiza");
  doc.setCreator("SpoKiza");
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
  { label: "Hoja 33 × 48 cm", w: 330, h: 480 },
  { label: "Carta (21,6 × 27,9 cm)", w: 215.9, h: 279.4 },
  { label: "Oficio (21,6 × 33 cm)", w: 215.9, h: 330 },
  { label: "A4 (21 × 29,7 cm)", w: 210, h: 297 },
  { label: "A3 (29,7 × 42 cm)", w: 297, h: 420 },
  { label: "Tabloide (27,9 × 43,2 cm)", w: 279.4, h: 431.8 },
  { label: "Pliego 1/4 (35 × 50 cm)", w: 350, h: 500 },
];

export interface SheetOptions {
  marginMm: number; // margen desde el borde de la hoja
  align: "esquina" | "centro"; // arriba a la izquierda o centrado
  marks: boolean; // marcas de corte
}

const fmtCm = (mmv: number) => (Math.round(mmv) / 10).toString().replace(".", ",");

/**
 * Hoja de impresión: pone los diseños a tamaño real en la hoja elegida (por ejemplo 33 × 48 cm),
 * tantos como quepan, girándolos 90° si así caben más. Arriba a la izquierda o centrados,
 * con marcas de corte. La hoja conserva la orientación que se escribió.
 */
export async function buildSheetPdf(
  pieces: PdfPiece[], sheet: SheetSpec, copies = 1,
  opts: SheetOptions = { marginMm: 5, align: "esquina", marks: true },
): Promise<{ bytes: Uint8Array; perSheet: number; sheets: number; rotated: boolean }> {
  if (!pieces.length) throw new Error("No hay diseños para la hoja");
  const { trimWmm, trimHmm, bleedMm } = pieces[0];
  const pw = trimWmm + 2 * bleedMm;
  const ph = trimHmm + 2 * bleedMm;
  const m = Math.max(0, opts.marginMm);
  const EPS = 0.01;

  const fit = (w: number, h: number) => ({
    cols: Math.floor((sheet.w - 2 * m + EPS) / w),
    rows: Math.floor((sheet.h - 2 * m + EPS) / h),
  });
  const normal = fit(pw, ph);
  const turned = fit(ph, pw);
  const rotated = turned.cols * turned.rows > normal.cols * normal.rows;
  const g = rotated ? turned : normal;
  const cw = rotated ? ph : pw; // ancho de cada celda en la hoja
  const chh = rotated ? pw : ph;
  const perSheet = g.cols * g.rows;
  if (perSheet < 1) {
    throw new Error(
      `El diseño (${fmtCm(pw)} × ${fmtCm(ph)} cm con sangrado) no cabe en la hoja de ${fmtCm(sheet.w)} × ${fmtCm(sheet.h)} cm` +
        (m ? ` con márgenes de ${fmtCm(m)} cm. Prueba con margen 0.` : "."),
    );
  }

  const list: PdfPiece[] = [];
  for (const p of pieces) for (let i = 0; i < copies; i++) list.push(p);

  const doc = await PDFDocument.create();
  doc.setProducer("SpoKiza");
  doc.setCreator("SpoKiza");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const embedded = new Map<PdfPiece, Awaited<ReturnType<typeof doc.embedJpg>>>();
  for (const p of pieces) embedded.set(p, await doc.embedJpg(p.jpeg));

  const sheets = Math.ceil(list.length / perSheet);
  for (let s = 0; s < sheets; s++) {
    const page = doc.addPage([mm(sheet.w), mm(sheet.h)]);
    const slice = list.slice(s * perSheet, (s + 1) * perSheet);
    const usedCols = Math.min(g.cols, slice.length);
    const usedRows = Math.ceil(slice.length / g.cols);
    const gridW = usedCols * cw;
    const gridH = usedRows * chh;
    // origen del grupo (arriba-izquierda), en mm desde la esquina superior izquierda de la hoja
    const left = opts.align === "centro" ? (sheet.w - gridW) / 2 : m;
    const topFromTop = opts.align === "centro" ? (sheet.h - gridH) / 2 : m;

    slice.forEach((p, i) => {
      const col = i % g.cols;
      const row = Math.floor(i / g.cols);
      const bx = left + col * cw;
      const byTop = topFromTop + row * chh;
      const by = sheet.h - byTop - chh; // coordenada PDF (desde abajo)
      const img = embedded.get(p)!;
      if (rotated) {
        page.drawImage(img, { x: mm(bx + cw), y: mm(by), width: mm(pw), height: mm(ph), rotate: degrees(90) });
      } else {
        page.drawImage(img, { x: mm(bx), y: mm(by), width: mm(pw), height: mm(ph) });
      }
    });

    if (opts.marks) {
      const bw = rotated ? bleedMm : bleedMm; // el sangrado es igual en los 4 lados
      const gTop = sheet.h - topFromTop; // borde superior del grupo (coordenada PDF)
      const gBottom = gTop - gridH;
      const gLeft = left;
      const gRight = left + gridW;
      const len = (space: number) => Math.min(MARK_LEN_MM, space - MARK_GAP_MM - 0.5);
      // líneas verticales de corte (marcas arriba y abajo del grupo)
      for (let c = 0; c < usedCols; c++) {
        for (const x of [gLeft + c * cw + bw, gLeft + (c + 1) * cw - bw]) {
          const up = len(sheet.h - gTop);
          if (up > 1) mark(page, mm(x), mm(gTop + MARK_GAP_MM), mm(x), mm(gTop + MARK_GAP_MM + up));
          const down = len(gBottom);
          if (down > 1) mark(page, mm(x), mm(gBottom - MARK_GAP_MM), mm(x), mm(gBottom - MARK_GAP_MM - down));
        }
      }
      // líneas horizontales de corte (marcas a la izquierda y derecha del grupo)
      for (let r = 0; r < usedRows; r++) {
        const rowTop = gTop - r * chh;
        for (const y of [rowTop - bw, rowTop - chh + bw]) {
          const l = len(gLeft);
          if (l > 1) mark(page, mm(gLeft - MARK_GAP_MM), mm(y), mm(gLeft - MARK_GAP_MM - l), mm(y));
          const rr = len(sheet.w - gRight);
          if (rr > 1) mark(page, mm(gRight + MARK_GAP_MM), mm(y), mm(gRight + MARK_GAP_MM + rr), mm(y));
        }
      }
    }
    const info = pdfSafe(`SpoKiza  ·  ${sheet.label}  ·  hoja ${s + 1}/${sheets}  ·  ${slice.length} x ${fmt(trimWmm / 10)} x ${fmt(trimHmm / 10)} cm`);
    // la línea de información va en la parte libre más grande (abajo o a la derecha)
    const freeBottom = sheet.h - topFromTop - gridH;
    if (freeBottom > 6) page.drawText(info, { x: mm(Math.max(3, left)), y: mm(2.5), size: 6, font, color: rgb(0.3, 0.3, 0.3) });
  }
  return { bytes: await doc.save(), perSheet, sheets, rotated };
}
