import type { ProductId } from "../types";
import { roundRectPath } from "../render/draw";

/* Mockups generados en código: luz cálida de ventana, sombras suaves y superficies limpias. */

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const n = document.createElement("canvas");
  n.width = 256;
  n.height = 256;
  const nctx = n.getContext("2d")!;
  const data = nctx.createImageData(256, 256);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 110 + Math.random() * 60;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255 * alpha;
  }
  nctx.putImageData(data, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(n, "repeat")!;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function windowLight(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(255,246,228,0.55)");
  g.addColorStop(0.45, "rgba(255,246,228,0.12)");
  g.addColorStop(1, "rgba(60,45,30,0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // sombras suaves diagonales de un marco de ventana
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#3b2f22";
  ctx.translate(w * 0.62, -h * 0.1);
  ctx.rotate(0.42);
  ctx.filter = `blur(${Math.round(w * 0.02)}px)`;
  ctx.fillRect(0, 0, w * 0.035, h * 1.6);
  ctx.fillRect(w * 0.32, 0, w * 0.035, h * 1.6);
  ctx.restore();
}

/** Devuelve un canvas 1600×2000 con el diseño ambientado. */
export function renderMockup(design: HTMLCanvasElement, product: ProductId, bleedRatio: number): HTMLCanvasElement {
  const W = 1600;
  const H = 2000;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // Recorta el sangrado: el mockup muestra la pieza ya cortada
  const bx = design.width * bleedRatio;
  const by = bx;
  const sw = design.width - 2 * bx;
  const sh = design.height - 2 * by;
  const aspect = sw / sh;

  const isPoster = product === "poster-album" || product === "poster-cancion";

  if (isPoster) {
    // Pared
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#ece6dc");
    wall.addColorStop(1, "#ddd5c8");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    noise(ctx, W, H, 0.18);

    const maxW = W * 0.62;
    const maxH = H * 0.68;
    let fw = maxW;
    let fh = fw / aspect;
    if (fh > maxH) {
      fh = maxH;
      fw = fh * aspect;
    }
    const frame = Math.round(W * 0.018);
    const x = (W - fw) / 2;
    const y = (H - fh) / 2 - H * 0.02;

    ctx.save();
    ctx.shadowColor = "rgba(40,30,20,0.35)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetX = 18;
    ctx.shadowOffsetY = 34;
    ctx.fillStyle = "#1b1a18";
    ctx.fillRect(x - frame, y - frame, fw + 2 * frame, fh + 2 * frame);
    ctx.restore();
    ctx.drawImage(design, bx, by, sw, sh, x, y, fw, fh);
    // vidrio: reflejo sutil
    ctx.save();
    const glass = ctx.createLinearGradient(x, y, x + fw, y + fh);
    glass.addColorStop(0, "rgba(255,255,255,0.10)");
    glass.addColorStop(0.5, "rgba(255,255,255,0)");
    ctx.fillStyle = glass;
    ctx.fillRect(x, y, fw, fh);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, fw, fh);
    ctx.restore();
    windowLight(ctx, W, H);
    return c;
  }

  // Polaroid y placa: sobre una superficie clara
  const surface = ctx.createLinearGradient(0, 0, W, H);
  surface.addColorStop(0, "#efe9df");
  surface.addColorStop(1, "#ded5c7");
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, W, H);
  noise(ctx, W, H, 0.22);

  const maxW = product === "polaroid" ? W * 0.56 : W * 0.6;
  const maxH = H * 0.7;
  let fw = maxW;
  let fh = fw / aspect;
  if (fh > maxH) {
    fh = maxH;
    fw = fh * aspect;
  }
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(product === "polaroid" ? -0.06 : 0);
  ctx.shadowColor = "rgba(40,30,20,0.32)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetX = 16;
  ctx.shadowOffsetY = 28;
  const r = product === "placa" ? fw * 0.025 : 0;
  roundRectPath(ctx, -fw / 2, -fh / 2, fw, fh, r);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  roundRectPath(ctx, -fw / 2, -fh / 2, fw, fh, r);
  ctx.clip();
  ctx.drawImage(design, bx, by, sw, sh, -fw / 2, -fh / 2, fw, fh);
  if (product === "placa") {
    // brillo de acrílico
    const glare = ctx.createLinearGradient(-fw / 2, -fh / 2, fw / 2, fh / 2);
    glare.addColorStop(0, "rgba(255,255,255,0.18)");
    glare.addColorStop(0.35, "rgba(255,255,255,0.02)");
    glare.addColorStop(0.36, "rgba(255,255,255,0.08)");
    glare.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
  }
  ctx.restore();
  ctx.restore();
  windowLight(ctx, W, H);
  return c;
}
