import { NextResponse } from "next/server";
import { getItem, resolveInput, search, SpotifyError } from "@/lib/spotify";

export const dynamic = "force-dynamic";

/** GET /api/spotify?q=texto&type=track|album|playlist  → búsqueda (máx. 10 resultados) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const type = (searchParams.get("type") ?? "track") as "track" | "album" | "playlist";
  if (!q) return NextResponse.json({ items: [] });
  if (!["track", "album", "playlist"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  try {
    return NextResponse.json({ items: await search(q, type) });
  } catch (e) {
    const err = e as SpotifyError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

/** POST /api/spotify  { inputs: string[] } → resuelve links en lote (uno por uno, en orden)
 *  POST /api/spotify  { kind, id }        → trae el detalle completo de un resultado de búsqueda */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    inputs?: string[];
    kind?: "track" | "album" | "playlist";
    id?: string;
  };
  if (body.kind && body.id) {
    try {
      return NextResponse.json({ item: await getItem({ kind: body.kind, id: body.id }) });
    } catch (e) {
      const err = e as SpotifyError;
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
  }
  const inputs = (body.inputs ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 100);
  const results: { input: string; item?: unknown; error?: string }[] = [];
  for (const input of inputs) {
    try {
      results.push({ input, item: await resolveInput(input) });
    } catch (e) {
      results.push({ input, error: (e as Error).message });
      if ((e as SpotifyError).status === 401 || (e as SpotifyError).status === 429) break;
    }
  }
  return NextResponse.json({ results });
}
