export const dynamic = "force-dynamic";

/* Spotify Code (el código escaneable con barras).
   /api/code?uri=spotify:track:ID&bg=000000&color=white&format=svg */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const uri = p.get("uri") ?? "";
  if (!/^spotify:(track|album|playlist|artist):[A-Za-z0-9]{10,40}$/.test(uri)) {
    return new Response("uri inválida", { status: 400 });
  }
  const bg = (p.get("bg") ?? "000000").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(bg)) return new Response("bg inválido", { status: 400 });
  const color = p.get("color") === "black" ? "black" : "white";
  const format = p.get("format") === "png" ? "png" : "svg";
  const url = `https://scannables.scdn.co/uri/plain/${format}/${bg}/${color}/640/${uri}`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return new Response("No se pudo generar el código", { status: 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": format === "svg" ? "image/svg+xml" : "image/png",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
