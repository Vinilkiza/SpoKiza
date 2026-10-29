export const dynamic = "force-dynamic";

/* Proxy de imágenes de Spotify: permite dibujarlas en el canvas y exportarlas
   sin bloqueos del navegador. Solo acepta dominios de Spotify. */
const ALLOWED = [".scdn.co", ".spotifycdn.com"];

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return new Response("Falta url", { status: 400 });
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("url inválida", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED.some((d) => target.hostname.endsWith(d))) {
    return new Response("Dominio no permitido", { status: 403 });
  }
  const res = await fetch(target, { cache: "force-cache" });
  if (!res.ok) return new Response("No se pudo traer la imagen", { status: 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
