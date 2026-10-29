"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type { AlbumStyle, BatchEntry, DesignContent, DesignSettings, FontId, MusicItem, ProductId, ThemeId } from "@/lib/types";
import { ALBUM_STYLES, DEFAULT_SETTINGS, FONTS, PRODUCTS, productById } from "@/lib/render/products";
import { coverSrc, dpiToPxPerMm, ensureFonts, prepare, renderCanvas, sizePx } from "@/lib/render/pipeline";
import { canvasToBlob, canvasToPng, downloadBlob, safeName } from "@/lib/export/png";
import { buildPdf, buildSheetPdf, SHEETS, type PdfPiece } from "@/lib/export/pdf";
import { renderMockup } from "@/lib/export/mockup";
import { recordVideo } from "@/lib/export/video";
import { formatRelease, makeEntry } from "@/lib/content";
import { formatDuration } from "@/lib/parse";

/** Límite de píxeles por archivo para que el navegador no se quede sin memoria. */
const MAX_PIXELS = 160_000_000;

const STORAGE_KEY = "vinilkiza-musica-v1";
type SearchType = "track" | "album" | "playlist";
const KIND_LABEL: Record<SearchType, string> = { track: "Canción", album: "Álbum", playlist: "Playlist" };

export default function Studio() {
  const [settings, setSettings] = useState<DesignSettings>(DEFAULT_SETTINGS);
  const [batch, setBatch] = useState<BatchEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [linksText, setLinksText] = useState("");
  const [query, setQuery] = useState("");
  const [qType, setQType] = useState<SearchType>("album");
  const [results, setResults] = useState<MusicItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [unit, setUnit] = useState<"cm" | "px">("cm");
  const [showTrim, setShowTrim] = useState(true);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [copies, setCopies] = useState(1);
  const [caption, setCaption] = useState("vinilkiza.com");
  const [zipOpts, setZipOpts] = useState({ png: true, pdf: true, mockup: false });
  const loaded = useRef(false);

  /* ---------- guardar/cargar el lote en el navegador (sin fotos propias) ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { settings?: DesignSettings; batch?: BatchEntry[] };
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        if (data.batch?.length) {
          setBatch(data.batch);
          setSelected(data.batch[0].key);
        }
      }
    } catch {
      /* sin datos guardados */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        const slim = batch.map((b) => ({ ...b, content: { ...b.content, photoDataUrl: undefined } }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, batch: slim }));
      } catch {
        /* almacenamiento lleno o bloqueado */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [batch, settings]);

  const entry = useMemo(() => batch.find((b) => b.key === selected) ?? null, [batch, selected]);
  const product = productById(settings.product);

  const say = (kind: "ok" | "error", text: string) => setNotice({ kind, text });

  /* ---------- actualizaciones automáticas (al abrir o con F5) ---------- */
  useEffect(() => {
    fetch("/api/update", { method: "POST" })
      .then((r) => r.json())
      .then((d: { updated?: boolean }) => {
        if (d.updated) {
          setNotice({ kind: "ok", text: "SpoKiza se actualizó. Recargando…" });
          setTimeout(() => window.location.reload(), 3000);
        }
      })
      .catch(() => null);
  }, []);

  /* ---------- conexión con Spotify (pantalla de configuración) ---------- */
  const [setup, setSetup] = useState({ open: false, configured: true, canSave: true });
  const [keys, setKeys] = useState({ id: "", secret: "", error: "", saving: false });
  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d: { configured: boolean; canSave: boolean }) => setSetup({ open: !d.configured, ...d }))
      .catch(() => null);
  }, []);
  const saveKeys = async () => {
    setKeys((k) => ({ ...k, saving: true, error: "" }));
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: keys.id, clientSecret: keys.secret }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }) : { error: "No se pudo guardar" };
    if (data.ok) {
      setKeys({ id: "", secret: "", error: "", saving: false });
      setSetup((s) => ({ ...s, open: false, configured: true }));
      say("ok", "Spotify conectado. Ya puedes pegar links.");
    } else setKeys((k) => ({ ...k, saving: false, error: data.error ?? "No se pudo guardar" }));
  };
  const needsSetup = (status: number) => {
    if (status === 412) {
      setSetup((s) => ({ ...s, open: true, configured: false }));
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.kind === "error" ? 9000 : 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      say("error", (e as Error).message || "Algo falló");
    } finally {
      setBusy(null);
    }
  }, []);

  /* ---------- agregar contenido ---------- */
  const addItems = (items: MusicItem[]) => {
    const entries = items.map(makeEntry);
    setBatch((b) => [...b, ...entries]);
    if (entries.length) setSelected(entries[entries.length - 1].key);
  };

  const addLinks = () =>
    run("Trayendo datos de Spotify…", async () => {
      const inputs = linksText.split(/\s*\n\s*|\s+(?=https?:|spotify:)/).map((s) => s.trim()).filter(Boolean);
      if (!inputs.length) throw new Error("Pega al menos un link de Spotify");
      const res = await fetch("/api/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      const data = (await res.json()) as { results?: { input: string; item?: MusicItem; error?: string }[]; error?: string };
      if (needsSetup(res.status)) return;
      if (!res.ok || !data.results) throw new Error(data.error ?? "No se pudo consultar Spotify");
      const ok = data.results.filter((r) => r.item).map((r) => r.item!);
      const bad = data.results.filter((r) => r.error);
      addItems(ok);
      setLinksText(bad.map((b) => b.input).join("\n"));
      if (bad.length) say("error", `${ok.length} agregados. Fallaron ${bad.length}: ${bad[0].error}`);
      else say("ok", `${ok.length} agregados al lote`);
    });

  const doSearch = () =>
    run("Buscando…", async () => {
      if (!query.trim()) return;
      const res = await fetch(`/api/spotify?q=${encodeURIComponent(query)}&type=${qType}`);
      const data = (await res.json()) as { items?: MusicItem[]; error?: string };
      if (needsSetup(res.status)) return;
      if (!res.ok) throw new Error(data.error ?? "Error en la búsqueda");
      setResults(data.items ?? []);
      if (!data.items?.length) say("error", "Sin resultados");
    });

  const addResult = (item: MusicItem) =>
    run("Agregando…", async () => {
      const res = await fetch("/api/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      });
      const data = (await res.json()) as { item?: MusicItem; error?: string };
      if (!res.ok || !data.item) throw new Error(data.error ?? "No se pudo agregar");
      addItems([data.item]);
    });

  /* ---------- edición ---------- */
  const patchContent = (patch: Partial<DesignContent>) => {
    if (!entry) return;
    setBatch((b) => b.map((x) => (x.key === entry.key ? { ...x, content: { ...x.content, ...patch } } : x)));
  };
  const patchSettings = (patch: Partial<DesignSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const isPoster = (id: ProductId) => id === "poster-album" || id === "poster-cancion";

  const chooseProduct = (id: ProductId) => {
    const p = productById(id);
    const style = ALBUM_STYLES.find((a) => a.id === settings.albumStyle)!;
    setSettings((s) => ({
      ...s,
      product: id,
      // Entre posters se conserva la medida que ya se había escrito
      widthCm: isPoster(id) && isPoster(s.product) ? s.widthCm : p.sizes[0].w,
      heightCm: isPoster(id) && isPoster(s.product) ? s.heightCm : p.sizes[0].h,
      bleedMm: p.bleedMm,
      showCode: true,
      showPalette: false,
      showPlayer: false,
      ...p.defaults,
      theme: id === "poster-album" ? style.theme : p.defaults.theme ?? (s.theme === "oscuro" && id !== "placa" ? "claro" : s.theme),
      font: id === "poster-album" ? style.font : s.font === "condensada" ? "moderna" : s.font,
    }));
  };

  const chooseAlbumStyle = (id: AlbumStyle) => {
    const st = ALBUM_STYLES.find((a) => a.id === id)!;
    patchSettings({ albumStyle: id, theme: st.theme, font: st.font });
  };

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchContent({ photoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const duplicate = (key: string) => {
    const i = batch.findIndex((x) => x.key === key);
    if (i < 0) return;
    const copy = { ...batch[i], key: `${batch[i].key}-c${Date.now()}`, content: { ...batch[i].content } };
    const next = [...batch];
    next.splice(i + 1, 0, copy);
    setBatch(next);
    setSelected(copy.key);
  };

  const remove = (key: string) => {
    const next = batch.filter((x) => x.key !== key);
    setBatch(next);
    if (selected === key) setSelected(next[0]?.key ?? null);
  };

  /* ---------- vista previa ---------- */
  const boxRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 600, h: 700 });
  const [preview, setPreview] = useState({ cssW: 0, cssH: 0, bleedCss: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!entry || !previewRef.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      await ensureFonts();
      const assets = await prepare(entry, settings);
      if (cancelled || !previewRef.current) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const totalW = settings.widthCm * 10 + 2 * settings.bleedMm;
      const totalH = settings.heightCm * 10 + 2 * settings.bleedMm;
      const pxPerMm = Math.min((box.w - 32) / totalW, (box.h - 32) / totalH) * dpr;
      const c = renderCanvas(entry, settings, assets, pxPerMm, previewRef.current);
      setPreview({ cssW: c.width / dpr, cssH: c.height / dpr, bleedCss: (settings.bleedMm * pxPerMm) / dpr });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [entry, settings, box]);

  /* ---------- exportaciones ---------- */
  const fileBase = (e: BatchEntry) => `${safeName(`${e.content.title}-${e.content.artists}`)}-${settings.product}`;
  const sizeLabel = `${fmt(settings.widthCm)}x${fmt(settings.heightCm)}cm`;

  const hiRes = async (e: BatchEntry) => {
    await ensureFonts();
    const assets = await prepare(e, settings);
    const canvas = renderCanvas(e, settings, assets, dpiToPxPerMm(exportDpi));
    return { canvas, assets };
  };
  const midRes = async (e: BatchEntry) => {
    await ensureFonts();
    const assets = await prepare(e, settings);
    const longest = Math.max(settings.widthCm * 10, settings.heightCm * 10) + 2 * settings.bleedMm;
    const pxPerMm = 2400 / longest;
    const canvas = renderCanvas(e, settings, assets, pxPerMm);
    const { bleed } = sizePx(settings, pxPerMm);
    return { canvas, assets, bleedRatio: bleed / canvas.width };
  };
  const toJpeg = async (c: HTMLCanvasElement) => new Uint8Array(await (await canvasToBlob(c, "image/jpeg", 0.95)).arrayBuffer());
  const piece = (e: BatchEntry, jpeg: Uint8Array): PdfPiece => ({
    jpeg,
    trimWmm: settings.widthCm * 10,
    trimHmm: settings.heightCm * 10,
    bleedMm: settings.bleedMm,
    label: `${e.content.title} - ${e.content.artists}`,
  });
  const free = (c: HTMLCanvasElement) => {
    c.width = 0;
    c.height = 0;
  };

  const exportPng = (e: BatchEntry) =>
    run("Generando PNG a alta resolución…", async () => {
      const { canvas } = await hiRes(e);
      const blob = await canvasToPng(canvas, exportDpi);
      free(canvas);
      downloadBlob(blob, `${fileBase(e)}-${sizeLabel}-${exportDpi}dpi.png`);
      say("ok", "PNG descargado");
    });

  const exportPdf = (e: BatchEntry) =>
    run("Generando PDF de impresión…", async () => {
      const { canvas } = await hiRes(e);
      const bytes = await buildPdf([piece(e, await toJpeg(canvas))]);
      free(canvas);
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${fileBase(e)}-${sizeLabel}.pdf`);
      say("ok", "PDF descargado (con sangrado y marcas de corte)");
    });

  const exportMockup = (e: BatchEntry) =>
    run("Creando mockup…", async () => {
      const { canvas, bleedRatio } = await midRes(e);
      const m = renderMockup(canvas, settings.product, bleedRatio);
      downloadBlob(await canvasToBlob(m, "image/jpeg", 0.92), `${fileBase(e)}-mockup.jpg`);
      free(canvas);
      free(m);
      say("ok", "Mockup descargado");
    });

  const exportVideo = (e: BatchEntry) =>
    run("Grabando video (8 s)… no cambies de pestaña", async () => {
      const { canvas, assets, bleedRatio } = await midRes(e);
      const { blob, ext } = await recordVideo({
        design: canvas,
        bleedRatio,
        background: assets.image,
        bgColor: assets.colors.bg,
        title: e.content.title,
        artists: e.content.artists,
        caption,
        seconds: 8,
        onProgress: (p) => setBusy(`Grabando video… ${Math.round(p * 100)}% · no cambies de pestaña`),
      });
      free(canvas);
      downloadBlob(blob, `${fileBase(e)}-video.${ext}`);
      say("ok", ext === "mp4" ? "Video MP4 descargado" : "Video WEBM descargado (tu navegador no graba MP4)");
    });

  const exportZip = () =>
    run("Preparando ZIP del lote…", async () => {
      if (!batch.length) throw new Error("El lote está vacío");
      if (!zipOpts.png && !zipOpts.pdf && !zipOpts.mockup) throw new Error("Elige al menos un formato para el ZIP");
      const zip = new JSZip();
      const used = new Set<string>();
      for (let i = 0; i < batch.length; i++) {
        const e = batch[i];
        setBusy(`ZIP: diseño ${i + 1} de ${batch.length}…`);
        let name = `${String(i + 1).padStart(2, "0")}-${fileBase(e)}`;
        while (used.has(name)) name += "-b";
        used.add(name);
        if (zipOpts.png || zipOpts.pdf) {
          const { canvas } = await hiRes(e);
          if (zipOpts.png) zip.file(`png/${name}.png`, await canvasToPng(canvas, exportDpi));
          if (zipOpts.pdf) zip.file(`pdf/${name}.pdf`, await buildPdf([piece(e, await toJpeg(canvas))]));
          free(canvas);
        }
        if (zipOpts.mockup) {
          const { canvas, bleedRatio } = await midRes(e);
          const m = renderMockup(canvas, settings.product, bleedRatio);
          zip.file(`mockups/${name}.jpg`, await canvasToBlob(m, "image/jpeg", 0.92));
          free(canvas);
          free(m);
        }
      }
      setBusy("Comprimiendo…");
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `lote-${settings.product}-${batch.length}-disenos.zip`);
      say("ok", `ZIP con ${batch.length} diseños descargado`);
    });

  const collectPieces = async () => {
    const pieces: PdfPiece[] = [];
    for (let i = 0; i < batch.length; i++) {
      setBusy(`Procesando diseño ${i + 1} de ${batch.length}…`);
      const { canvas } = await hiRes(batch[i]);
      pieces.push(piece(batch[i], await toJpeg(canvas)));
      free(canvas);
    }
    return pieces;
  };

  const exportBatchPdf = () =>
    run("Generando PDF del lote…", async () => {
      if (!batch.length) throw new Error("El lote está vacío");
      const bytes = await buildPdf(await collectPieces());
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `lote-${settings.product}-${sizeLabel}.pdf`);
      say("ok", `PDF de ${batch.length} páginas descargado`);
    });

  const exportSheet = () =>
    run("Armando pliego…", async () => {
      if (!batch.length) throw new Error("El lote está vacío");
      const sheet = SHEETS[sheetIdx];
      const { bytes, perSheet, sheets } = await buildSheetPdf(await collectPieces(), sheet, copies);
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `pliego-${safeName(sheet.label)}-${settings.product}.pdf`);
      say("ok", `Pliego listo: ${perSheet} por hoja, ${sheets} hoja(s)`);
    });

  /* ---------- medidas ---------- */
  const presetValue = product.sizes.find((s) => s.w === settings.widthCm && s.h === settings.heightCm)
    ? `${settings.widthCm}x${settings.heightCm}`
    : product.sizes.find((s) => s.h === settings.widthCm && s.w === settings.heightCm)
      ? `${settings.heightCm}x${settings.widthCm}`
      : "custom";
  const toUnit = (cm: number) => (unit === "cm" ? fmt(cm) : String(Math.round((cm / 2.54) * settings.dpi)));
  const fromUnit = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return unit === "cm" ? n : (n / settings.dpi) * 2.54;
  };
  // DPI real de exportación: en tamaños gigantes se baja lo justo para que el archivo quepa en memoria
  const totalWin = (settings.widthCm + (2 * settings.bleedMm) / 10) / 2.54;
  const totalHin = (settings.heightCm + (2 * settings.bleedMm) / 10) / 2.54;
  const exportDpi = Math.max(
    30,
    Math.min(settings.dpi, Math.floor(Math.sqrt(MAX_PIXELS / (totalWin * totalHin))), Math.floor(32000 / Math.max(totalWin, totalHin))),
  );
  const pxW = Math.round((settings.widthCm / 2.54) * exportDpi);
  const pxH = Math.round((settings.heightCm / 2.54) * exportDpi);

  /* ---------- interfaz ---------- */
  return (
    <div className="grid h-screen grid-cols-[320px_1fr_340px] overflow-hidden">
      {/* ===== Izquierda: agregar y lote ===== */}
      <aside className="flex min-h-0 flex-col border-r border-line bg-card">
        <div className="border-b border-line px-4 py-3">
          <h1 className="text-base font-extrabold tracking-tight">SpoKiza</h1>
          <p className="text-xs text-soft">Posters, polaroids y placas desde Spotify</p>
          {setup.canSave && (
            <button className="mt-1 text-xs text-soft underline hover:text-ink" onClick={() => setSetup((s) => ({ ...s, open: true }))}>
              {setup.configured ? "Spotify conectado · cambiar claves" : "Conectar Spotify"}
            </button>
          )}
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          <section>
            <label className="label">Buscar en Spotify</label>
            <div className="mb-2 flex gap-1">
              {(["album", "track", "playlist"] as SearchType[]).map((k) => (
                <button key={k} className="seg flex-1" data-on={qType === k} onClick={() => setQType(k)}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                doSearch();
              }}
            >
              <input className="field" placeholder="Álbum, canción o artista" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="btn" disabled={!!busy}>
                Buscar
              </button>
            </form>
            {results.length > 0 && (
              <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                {results.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 p-2">
                    <Thumb src={coverSrc(r.coverUrl)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="truncate text-xs text-soft">{r.artists}</p>
                    </div>
                    <button className="btn px-2 py-1 text-xs" disabled={!!busy} onClick={() => addResult(r)}>
                      + Lote
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <label className="label">O pega links (uno por línea)</label>
            <textarea
              className="field h-24 resize-y font-mono text-xs"
              placeholder={"https://open.spotify.com/album/...\nhttps://open.spotify.com/track/...\nhttps://spotify.link/..."}
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
            />
            <button className="btn-dark mt-2 w-full" disabled={!!busy} onClick={addLinks}>
              Agregar al lote
            </button>
          </section>

          <section>
            <div className="mb-1 flex items-center justify-between">
              <span className="label mb-0">Lote ({batch.length})</span>
              {batch.length > 0 && (
                <button
                  className="text-xs text-soft underline hover:text-ink"
                  onClick={() => {
                    if (confirm("¿Vaciar todo el lote?")) {
                      setBatch([]);
                      setSelected(null);
                    }
                  }}
                >
                  Vaciar
                </button>
              )}
            </div>
            {batch.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-3 text-xs text-soft">
                Pega links o busca canciones, álbumes o playlists para empezar.
              </p>
            ) : (
              <ul className="space-y-1">
                {batch.map((b, i) => (
                  <li
                    key={b.key}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md border p-1.5 ${
                      b.key === selected ? "border-ink bg-paper" : "border-transparent hover:border-line"
                    }`}
                    onClick={() => setSelected(b.key)}
                  >
                    <span className="w-5 text-right text-[11px] text-soft">{i + 1}</span>
                    <Thumb src={b.content.photoDataUrl ?? coverSrc(b.item.coverUrl)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.content.title}</p>
                      <p className="truncate text-xs text-soft">
                        {KIND_LABEL[b.item.kind]} · {b.content.artists}
                      </p>
                    </div>
                    <button
                      title="Duplicar (otra foto o dedicatoria)"
                      className="hidden text-xs text-soft hover:text-ink group-hover:block"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        duplicate(b.key);
                      }}
                    >
                      ⧉
                    </button>
                    <button
                      title="Quitar"
                      className="hidden px-1 text-sm text-soft hover:text-accent group-hover:block"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        remove(b.key);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>

      {/* ===== Centro: vista previa ===== */}
      <main className="relative flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-soft">
          <span>
            {product.label} · {fmt(settings.widthCm)} × {fmt(settings.heightCm)} cm · {pxW} × {pxH} px a {exportDpi} DPI{exportDpi < settings.dpi ? " (ajustado por tamaño)" : ""} · sangrado{" "}
            {settings.bleedMm} mm
          </span>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showTrim} onChange={(e) => setShowTrim(e.target.checked)} />
            Línea de corte
          </label>
        </div>
        <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
          {entry ? (
            <div className="relative shadow-[0_10px_40px_rgba(40,30,20,0.18)]" style={{ width: preview.cssW, height: preview.cssH }}>
              <canvas ref={previewRef} style={{ width: preview.cssW, height: preview.cssH, display: "block" }} />
              {showTrim && preview.bleedCss > 0 && (
                <div
                  className="pointer-events-none absolute border border-dashed border-[#ff2bd6]"
                  style={{ inset: preview.bleedCss }}
                />
              )}
            </div>
          ) : (
            <div className="max-w-sm text-center text-sm text-soft">
              <p className="mb-1 text-base font-semibold text-ink">Nada en el lote todavía</p>
              Agrega un link de Spotify a la izquierda. Cada diseño se puede editar, cambiarle la foto y exportar por separado o
              todos juntos.
            </div>
          )}
        </div>
        {(busy || notice) && (
          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg ${
              busy ? "bg-ink text-paper" : notice?.kind === "error" ? "bg-accent text-white" : "bg-ink text-paper"
            }`}
            onClick={() => !busy && setNotice(null)}
          >
            {busy ?? notice?.text}
          </div>
        )}
      </main>

      {/* ===== Derecha: ajustes, contenido y exportación ===== */}
      <aside className="min-h-0 space-y-5 overflow-y-auto border-l border-line bg-card p-4">
        <section>
          <span className="label">Producto</span>
          <div className="grid grid-cols-2 gap-1.5">
            {PRODUCTS.map((p) => (
              <button key={p.id} className="seg text-left" data-on={settings.product === p.id} onClick={() => chooseProduct(p.id)}>
                <span className="block font-semibold">{p.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-soft">{product.description}</p>
        </section>

        <section className="space-y-2">
          <span className="label">Medida — escribe la que quieras</span>
          <select
            className="field"
            value={presetValue}
            onChange={(e) => {
              if (e.target.value === "custom") return;
              const [w, h] = e.target.value.split("x").map(Number);
              patchSettings({ widthCm: w, heightCm: h });
            }}
          >
            {product.sizes.map((s) => (
              <option key={s.label} value={`${s.w}x${s.h}`}>
                {s.label}
              </option>
            ))}
            <option value="custom">Personalizada ({fmt(settings.widthCm)} × {fmt(settings.heightCm)} cm)</option>
          </select>
          <div className="flex items-end gap-2">
            <NumField label={`Ancho (${unit})`} value={toUnit(settings.widthCm)} onCommit={(v) => { const n = fromUnit(v); if (n) patchSettings({ widthCm: round2(n) }); }} />
            <button className="btn mb-px px-2" title="Girar" onClick={() => patchSettings({ widthCm: settings.heightCm, heightCm: settings.widthCm })}>
              ⇄
            </button>
            <NumField label={`Alto (${unit})`} value={toUnit(settings.heightCm)} onCommit={(v) => { const n = fromUnit(v); if (n) patchSettings({ heightCm: round2(n) }); }} />
          </div>
          <div className="flex gap-1">
            <button className="seg flex-1" data-on={unit === "cm"} onClick={() => setUnit("cm")}>cm</button>
            <button className="seg flex-1" data-on={unit === "px"} onClick={() => setUnit("px")}>px</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Sangrado (mm)" value={String(settings.bleedMm)} onCommit={(v) => { const n = Number(v.replace(",", ".")); if (n >= 0 && n <= 10) patchSettings({ bleedMm: n }); }} />
            <div>
              <span className="label">Resolución</span>
              <select className="field" value={settings.dpi} onChange={(e) => patchSettings({ dpi: Number(e.target.value) })}>
                <option value={300}>300 DPI</option>
                <option value={200}>200 DPI</option>
                <option value={150}>150 DPI</option>
              </select>
            </div>
          </div>
        </section>

        {settings.product === "poster-album" && (
          <section className="space-y-2">
            <span className="label">Estilo de póster</span>
            <div className="grid grid-cols-2 gap-1.5">
              {ALBUM_STYLES.map((a) => (
                <button key={a.id} className="seg text-left" data-on={settings.albumStyle === a.id} onClick={() => chooseAlbumStyle(a.id)}>
                  <span className="block font-semibold">{a.label}</span>
                  <span className="block text-[10px] font-normal opacity-70">{a.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button className="seg flex-1" data-on={settings.lang === "es"} onClick={() => patchSettings({ lang: "es" })}>Textos en español</button>
              <button className="seg flex-1" data-on={settings.lang === "en"} onClick={() => patchSettings({ lang: "en" })}>In English</button>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <span className="label">Colores y letra</span>
          <div className="flex gap-1">
            {(["claro", "oscuro", "portada"] as ThemeId[]).map((t) => (
              <button key={t} className="seg flex-1" data-on={settings.theme === t} onClick={() => patchSettings({ theme: t })}>
                {t === "portada" ? "Color de la foto" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(FONTS) as FontId[]).map((f) => (
              <button
                key={f}
                className="seg"
                data-on={settings.font === f}
                style={{ fontFamily: FONTS[f].title, fontWeight: FONTS[f].titleWeight }}
                onClick={() => patchSettings({ font: f })}
              >
                {FONTS[f].label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Check label="Código Spotify" checked={settings.showCode} onChange={(v) => patchSettings({ showCode: v })} />
            {settings.product !== "poster-album" && (
              <Check label="Reproductor" checked={settings.showPlayer} onChange={(v) => patchSettings({ showPlayer: v })} />
            )}
            {settings.product === "poster-album" && (
              <Check label="Paleta de colores" checked={settings.showPalette} onChange={(v) => patchSettings({ showPalette: v })} />
            )}
          </div>
        </section>

        {entry && (
          <section className="space-y-2">
            <span className="label">Contenido de este diseño</span>
            <TextField label="Título" value={entry.content.title} onChange={(v) => patchContent({ title: v })} />
            <TextField label="Artista" value={entry.content.artists} onChange={(v) => patchContent({ artists: v })} />
            {settings.product === "poster-cancion" && (
              <TextField label="Línea secundaria" value={entry.content.subtitle} onChange={(v) => patchContent({ subtitle: v })} />
            )}
            {settings.product === "poster-album" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Fecha"
                    value={entry.content.release ?? ""}
                    placeholder={formatRelease(entry.item.releaseDate, settings.lang)}
                    onChange={(v) => patchContent({ release: v })}
                  />
                  <TextField
                    label="Duración"
                    value={entry.content.length ?? ""}
                    placeholder={entry.item.durationMs ? formatDuration(entry.item.durationMs) : ""}
                    onChange={(v) => patchContent({ length: v })}
                  />
                </div>
                <TextField label="Género" value={entry.content.genre ?? ""} placeholder="Reggaetón / Trap" onChange={(v) => patchContent({ genre: v })} />
                <TextField label="Sello discográfico" value={entry.content.label ?? ""} onChange={(v) => patchContent({ label: v })} />
                {settings.albumStyle === "franja" && (
                  <TextField label="Invitados (feat.)" value={entry.content.feat ?? ""} onChange={(v) => patchContent({ feat: v })} />
                )}
              </>
            )}
            {settings.showPlayer && settings.product !== "poster-album" && (
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Tiempo en barra" value={entry.content.elapsed} onChange={(v) => patchContent({ elapsed: v })} />
                <TextField label="Duración" value={entry.content.duration} onChange={(v) => patchContent({ duration: v })} />
              </div>
            )}
            {settings.product !== "placa" && settings.product !== "poster-album" && (
            <div>
              <span className="label">Dedicatoria / frase</span>
              <textarea className="field h-16 resize-y" value={entry.content.dedication} onChange={(e) => patchContent({ dedication: e.target.value })} />
            </div>
            )}
            {settings.product === "poster-album" && (
              <div>
                <span className="label">Lista de canciones (una por línea)</span>
                <textarea
                  className="field h-28 resize-y text-xs"
                  value={entry.content.tracklist}
                  placeholder={entry.item.kind === "playlist" ? "Spotify solo entrega las canciones de playlists propias. Escríbelas aquí." : ""}
                  onChange={(e) => patchContent({ tracklist: e.target.value })}
                />
              </div>
            )}
            <div>
              <span className="label">Imagen</span>
              <div className="flex gap-2">
                <label className="btn flex-1 cursor-pointer">
                  {entry.content.photoDataUrl ? "Cambiar foto" : "Usar foto propia"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                </label>
                {entry.content.photoDataUrl && (
                  <button className="btn" onClick={() => patchContent({ photoDataUrl: undefined })}>
                    Volver a portada
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-soft">
                La portada de Spotify llega a 640 px; para piezas grandes se ve mejor una foto propia en buena resolución.
              </p>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <span className="label">Exportar este diseño</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button className="btn-dark" disabled={!entry || !!busy} onClick={() => entry && exportPdf(entry)}>PDF impresión</button>
            <button className="btn" disabled={!entry || !!busy} onClick={() => entry && exportPng(entry)}>PNG {exportDpi} DPI</button>
            <button className="btn" disabled={!entry || !!busy} onClick={() => entry && exportMockup(entry)}>Mockup</button>
            <button className="btn" disabled={!entry || !!busy} onClick={() => entry && exportVideo(entry)}>Video vertical</button>
          </div>
          <TextField label="Texto final del video" value={caption} onChange={setCaption} />
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <span className="label">Exportar todo el lote ({batch.length})</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Check label="PNG" checked={zipOpts.png} onChange={(v) => setZipOpts((z) => ({ ...z, png: v }))} />
            <Check label="PDF" checked={zipOpts.pdf} onChange={(v) => setZipOpts((z) => ({ ...z, pdf: v }))} />
            <Check label="Mockups" checked={zipOpts.mockup} onChange={(v) => setZipOpts((z) => ({ ...z, mockup: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button className="btn-dark" disabled={!batch.length || !!busy} onClick={exportZip}>Descargar ZIP</button>
            <button className="btn" disabled={!batch.length || !!busy} onClick={exportBatchPdf}>PDF multipágina</button>
          </div>
          <div className="rounded-md border border-line p-2">
            <span className="label">Pliego (varios por hoja)</span>
            <select className="field mb-2" value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))}>
              {SHEETS.map((s, i) => (
                <option key={s.label} value={i}>{s.label}</option>
              ))}
            </select>
            <div className="flex items-end gap-2">
              <NumField label="Copias de cada uno" value={String(copies)} onCommit={(v) => { const n = Math.round(Number(v)); if (n >= 1 && n <= 50) setCopies(n); }} />
              <button className="btn mb-px" disabled={!batch.length || !!busy} onClick={exportSheet}>Armar pliego</button>
            </div>
          </div>
        </section>
      </aside>

      {setup.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-extrabold">Conectar Spotify (solo una vez)</h2>
            <p className="mt-1 text-sm text-soft">
              Spotify pide dos claves para dejar que el programa lea álbumes y canciones. No se instala nada: es un registro en su página.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              <li>
                Abre{" "}
                <a className="font-semibold underline" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
                  developer.spotify.com/dashboard
                </a>{" "}
                e inicia sesión con tu cuenta de Spotify (tiene que ser Premium).
              </li>
              <li>
                Dale <b>Create app</b>. Nombre: <code>SpoKiza</code> · Descripción: <code>Editor</code> · Redirect URI:{" "}
                <code>http://127.0.0.1:3000/callback</code> (dale <b>Add</b>) · marca <b>Web API</b> · acepta y <b>Save</b>.
              </li>
              <li>
                Entra a <b>Settings</b>, copia el <b>Client ID</b> y, con <b>View client secret</b>, el <b>Client Secret</b>. Pégalos aquí:
              </li>
            </ol>
            <div className="mt-4 space-y-2">
              <input className="field font-mono" placeholder="Client ID" value={keys.id} onChange={(e) => setKeys((k) => ({ ...k, id: e.target.value }))} />
              <input
                className="field font-mono"
                placeholder="Client Secret"
                type="password"
                value={keys.secret}
                onChange={(e) => setKeys((k) => ({ ...k, secret: e.target.value }))}
              />
              {keys.error && <p className="text-sm text-accent">{keys.error}</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {setup.configured && (
                <button className="btn" onClick={() => setSetup((s) => ({ ...s, open: false }))}>
                  Cerrar
                </button>
              )}
              <button className="btn-dark" disabled={keys.saving || !keys.id || !keys.secret} onClick={saveKeys}>
                {keys.saving ? "Probando…" : "Guardar y probar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- piezas pequeñas de interfaz ---------- */

function Thumb({ src }: { src: string | null | undefined }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-9 w-9 flex-none rounded object-cover" />
  ) : (
    <div className="h-9 w-9 flex-none rounded bg-line" />
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Campo numérico que aplica el valor al salir del campo o con Enter. */
function NumField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex-1">
      <span className="label">{label}</span>
      <input
        className="field"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => e.key === "Enter" && onCommit(draft)}
      />
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");
const round2 = (n: number) => Math.round(n * 100) / 100;
