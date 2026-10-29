/* Utilidades de dibujo en canvas. Todo se mide en píxeles del canvas final,
   así el mismo código sirve para la vista previa y para el archivo a 300 DPI. */

export type Img = CanvasImageSource & { width: number; height: number };
export type Ctx = CanvasRenderingContext2D;

export function setFont(ctx: Ctx, family: string, size: number, weight = 400, style = "normal") {
  ctx.font = `${style} ${weight} ${Math.max(1, size)}px ${family}, Arial, sans-serif`;
}

/** Reduce el tamaño de letra hasta que el texto quepa en maxWidth. */
export function fitFont(
  ctx: Ctx, text: string, family: string, weight: number,
  maxSize: number, minSize: number, maxWidth: number, style = "normal",
): number {
  let size = maxSize;
  setFont(ctx, family, size, weight, style);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size *= 0.95;
    setFont(ctx, family, size, weight, style);
  }
  return Math.max(size, minSize);
}

export function ellipsize(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

export function wrapLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
  }
  if (out.length > maxLines) {
    const cut = out.slice(0, maxLines);
    cut[maxLines - 1] = ellipsize(ctx, cut[maxLines - 1] + "…", maxWidth);
    return cut;
  }
  return out;
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Dibuja la imagen recortada para llenar el recuadro (como object-fit: cover). */
export function drawCover(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number, radius = 0) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.save();
  if (radius > 0) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

export function drawPlaceholder(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, ink: string, radius = 0) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setFont(ctx, "'Montserrat'", Math.min(w, h) * 0.06, 600);
  ctx.fillText("Agrega una imagen", x + w / 2, y + h / 2);
  ctx.restore();
}

/** Barra de reproducción con punto de avance. */
export function drawPlayerBar(
  ctx: Ctx, x: number, y: number, w: number, progress: number,
  fg: string, track: string, thickness: number,
) {
  const p = Math.max(0, Math.min(1, progress));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = thickness;
  ctx.strokeStyle = track;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.strokeStyle = fg;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * p, y);
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(x + w * p, y, thickness * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Fila de controles: aleatorio, anterior, pausa, siguiente, repetir. */
export function drawControls(ctx: Ctx, cx: number, cy: number, s: number, fg: string, bg: string, spread = 2.6) {
  const gap = s * spread;
  ctx.save();
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.lineWidth = s * 0.11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Aleatorio
  const sx = cx - gap * 2;
  const h = s * 0.42;
  ctx.beginPath();
  ctx.moveTo(sx - h, cy - h * 0.7);
  ctx.bezierCurveTo(sx, cy - h * 0.7, sx, cy + h * 0.7, sx + h, cy + h * 0.7);
  ctx.moveTo(sx - h, cy + h * 0.7);
  ctx.bezierCurveTo(sx, cy + h * 0.7, sx, cy - h * 0.7, sx + h, cy - h * 0.7);
  ctx.stroke();
  arrowHead(ctx, sx + h, cy - h * 0.7, s * 0.2);
  arrowHead(ctx, sx + h, cy + h * 0.7, s * 0.2);

  // Anterior
  const px = cx - gap;
  const t = s * 0.36;
  ctx.beginPath();
  ctx.moveTo(px + t * 0.7, cy - t);
  ctx.lineTo(px - t * 0.6, cy);
  ctx.lineTo(px + t * 0.7, cy + t);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(px - t * 0.95, cy - t, s * 0.11, t * 2);

  // Pausa en círculo
  const r = s * 0.62;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bg;
  const bw = r * 0.2;
  const bh = r * 0.78;
  ctx.fillRect(cx - bw * 1.6, cy - bh / 2, bw, bh);
  ctx.fillRect(cx + bw * 0.6, cy - bh / 2, bw, bh);
  ctx.fillStyle = fg;

  // Siguiente
  const nx = cx + gap;
  ctx.beginPath();
  ctx.moveTo(nx - t * 0.7, cy - t);
  ctx.lineTo(nx + t * 0.6, cy);
  ctx.lineTo(nx - t * 0.7, cy + t);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(nx + t * 0.95 - s * 0.11, cy - t, s * 0.11, t * 2);

  // Repetir
  const rx = cx + gap * 2;
  const rw = s * 0.42;
  const rh = s * 0.3;
  // Lazo con una abertura arriba a la derecha donde va la flecha
  ctx.beginPath();
  ctx.moveTo(rx + rw * 0.35, cy - rh);
  ctx.lineTo(rx - rw + rh * 0.7, cy - rh);
  ctx.arcTo(rx - rw, cy - rh, rx - rw, cy, rh * 0.7);
  ctx.arcTo(rx - rw, cy + rh, rx, cy + rh, rh * 0.7);
  ctx.arcTo(rx + rw, cy + rh, rx + rw, cy, rh * 0.7);
  ctx.lineTo(rx + rw, cy - rh * 0.1);
  ctx.stroke();
  arrowHead(ctx, rx + rw * 0.35, cy - rh, s * 0.2);
  ctx.restore();
}

function arrowHead(ctx: Ctx, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x + size * 0.9, y);
  ctx.lineTo(x - size * 0.2, y - size * 0.75);
  ctx.lineTo(x - size * 0.2, y + size * 0.75);
  ctx.closePath();
  ctx.fill();
}
