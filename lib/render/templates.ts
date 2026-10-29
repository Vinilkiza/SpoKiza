import type { DesignContent, DesignSettings, MusicItem } from "../types";
import type { ThemeColors } from "./color";
import type { Ctx, Img } from "./draw";
import type { EditBox } from "./kit";
import { renderAlbum } from "./album";
import { renderSong } from "./song";

export interface RenderAssets {
  image: Img | null; // foto propia o portada
  code: Img | null; // Spotify Code
  palette: string[];
  colors: ThemeColors;
}

export interface RenderOpts {
  W: number; // ancho total en px (incluye sangrado)
  H: number;
  bleed: number; // sangrado en px por lado
  settings: DesignSettings;
  content: DesignContent;
  item: MusicItem;
  assets: RenderAssets;
  boxes?: EditBox[]; // si se pasa, se llenan las cajas de los elementos movibles (modo edición)
}

export function renderDesign(ctx: Ctx, o: RenderOpts) {
  const { W, H, bleed, assets } = o;
  ctx.save();
  ctx.fillStyle = assets.colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const f = { x0: bleed, y0: bleed, tw: W - 2 * bleed, th: H - 2 * bleed };
  if (o.settings.product === "poster-album") renderAlbum(ctx, f, o);
  else renderSong(ctx, f, o);
  ctx.restore();
}
