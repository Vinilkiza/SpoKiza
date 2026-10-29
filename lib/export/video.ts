import type { Img } from "../render/draw";
import { roundRectPath, setFont } from "../render/draw";

/* Video vertical 1080×1920 para reels/historias, grabado en el navegador. */

function pickMime(): { mime: string; ext: string } {
  const options = [
    { mime: "video/mp4;codecs=avc1.640028", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const o of options) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o.mime)) return o;
  throw new Error("Este navegador no puede grabar video. Usa Google Chrome actualizado.");
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export interface VideoOptions {
  design: HTMLCanvasElement; // diseño completo (con sangrado)
  bleedRatio: number;
  background: Img | null; // portada o foto, se usa desenfocada de fondo
  bgColor: string;
  title: string;
  artists: string;
  caption: string; // texto final, ej. "vinilkiza.com"
  seconds: number;
  onProgress?: (p: number) => void;
}

export async function recordVideo(o: VideoOptions): Promise<{ blob: Blob; ext: string }> {
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const { mime, ext } = pickMime();
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const bx = o.design.width * o.bleedRatio;
  const sw = o.design.width - 2 * bx;
  const sh = o.design.height - 2 * bx;
  const aspect = sw / sh;
  let dw = W * 0.78;
  let dh = dw / aspect;
  if (dh > H * 0.66) {
    dh = H * 0.66;
    dw = dh * aspect;
  }

  // Fondo desenfocado pre-renderizado (más rápido por cuadro)
  const bg = document.createElement("canvas");
  bg.width = W;
  bg.height = H;
  const bctx = bg.getContext("2d")!;
  bctx.fillStyle = o.bgColor;
  bctx.fillRect(0, 0, W, H);
  if (o.background) {
    const s = Math.max(W / o.background.width, H / o.background.height) * 1.2;
    bctx.filter = "blur(60px) saturate(1.1)";
    bctx.drawImage(o.background, (W - o.background.width * s) / 2, (H - o.background.height * s) / 2, o.background.width * s, o.background.height * s);
    bctx.filter = "none";
  }
  bctx.fillStyle = "rgba(0,0,0,0.38)";
  bctx.fillRect(0, 0, W, H);

  const total = o.seconds * 1000;
  const draw = (t: number) => {
    const k = t / total;
    ctx.drawImage(bg, 0, 0);
    // Entrada del diseño + zoom lento
    const enter = ease(t / 900);
    const zoom = 0.9 + 0.1 * enter + 0.035 * k;
    const w = dw * zoom;
    const h = dh * zoom;
    const x = (W - w) / 2;
    const y = H * 0.12 + (dh - h) / 2 + (1 - enter) * 80;
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    roundRectPath(ctx, x, y, w, h, 6);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.drawImage(o.design, bx, bx, sw, sh, x, y, w, h);
    ctx.restore();

    // Textos inferiores
    const tIn = ease((t - 700) / 900);
    ctx.save();
    ctx.globalAlpha = tIn;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const ty = H * 0.12 + dh + 90 + (1 - tIn) * 30;
    setFont(ctx, "'Inter'", 64, 800);
    ctx.fillText(o.title.slice(0, 32), W / 2, ty);
    setFont(ctx, "'Inter'", 40, 500);
    ctx.globalAlpha = tIn * 0.85;
    ctx.fillText(o.artists.slice(0, 44), W / 2, ty + 84);
    ctx.restore();

    if (o.caption) {
      const cIn = ease((t - 1500) / 900);
      ctx.save();
      ctx.globalAlpha = cIn;
      setFont(ctx, "'Inter'", 38, 600);
      const tw = ctx.measureText(o.caption).width + 70;
      const cy = H - 190;
      roundRectPath(ctx, (W - tw) / 2, cy, tw, 76, 38);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.caption, W / 2, cy + 39);
      ctx.restore();
    }
  };

  draw(0);
  rec.start(250);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = performance.now() - start;
      draw(Math.min(t, total));
      o.onProgress?.(Math.min(1, t / total));
      if (t >= total) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
    rec.stop();
  });
  stream.getTracks().forEach((tr) => tr.stop());
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext };
}
