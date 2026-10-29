/* PNG con la resolución (DPI) guardada en el archivo, para que Photoshop/Illustrator
   lo abran directamente al tamaño real en centímetros. */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function physChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unidad: metro
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), type, quality),
  );
}

export async function canvasToPng(canvas: HTMLCanvasElement, dpi: number): Promise<Blob> {
  const blob = await canvasToBlob(canvas, "image/png");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isPhys = (i: number) => bytes[i] === 0x70 && bytes[i + 1] === 0x48 && bytes[i + 2] === 0x59 && bytes[i + 3] === 0x73;
  if (bytes.length > 41 && isPhys(37)) return blob; // ya trae resolución
  // Firma (8) + IHDR (4 largo + 4 tipo + 13 datos + 4 crc) = 33 bytes; pHYs va justo después
  const ihdrEnd = 33;
  const out = new Uint8Array(bytes.length + 21);
  out.set(bytes.subarray(0, ihdrEnd), 0);
  out.set(physChunk(dpi), ihdrEnd);
  out.set(bytes.subarray(ihdrEnd), ihdrEnd + 21);
  return new Blob([out], { type: "image/png" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function safeName(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "diseno"
  );
}
