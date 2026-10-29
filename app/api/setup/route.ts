import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { resetToken, testCredentials } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* Configuración de Spotify desde el mismo programa (solo cuando corre en el PC).
   Guarda las claves en .env.local para no tener que editar archivos a mano. */

const isLocal = () => !process.env.VERCEL;
const ENV_FILE = () => path.join(process.cwd(), ".env.local");

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    canSave: isLocal(),
  });
}

async function writeEnv(values: Record<string, string>) {
  let current = "";
  try {
    current = await fs.readFile(ENV_FILE(), "utf8");
  } catch {
    /* todavía no existe */
  }
  const lines = current.split(/\r?\n/).filter((l) => l.trim() && !Object.keys(values).some((k) => l.startsWith(`${k}=`)));
  for (const [k, v] of Object.entries(values)) lines.push(`${k}=${v}`);
  await fs.writeFile(ENV_FILE(), lines.join("\n") + "\n", "utf8");
}

export async function POST(req: Request) {
  if (!isLocal()) {
    return NextResponse.json({ error: "En la versión publicada las claves se configuran en Vercel." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { clientId?: string; clientSecret?: string };
  const clientId = (body.clientId ?? "").trim();
  const clientSecret = (body.clientSecret ?? "").trim();
  if (!/^[A-Za-z0-9]{20,64}$/.test(clientId) || !/^[A-Za-z0-9]{20,64}$/.test(clientSecret)) {
    return NextResponse.json({ error: "Revisa los datos: el Client ID y el Client Secret son códigos de 32 letras y números." }, { status: 400 });
  }
  let test;
  try {
    test = await testCredentials(clientId, clientSecret);
  } catch {
    return NextResponse.json({ error: "No hay conexión con Spotify. Revisa el internet e intenta de nuevo." }, { status: 502 });
  }
  if (!test.ok) {
    return NextResponse.json(
      { error: "Spotify no aceptó esas claves. Cópialas de nuevo desde Settings (sin espacios) y revisa que la cuenta tenga Premium." },
      { status: 400 },
    );
  }
  await writeEnv({ SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret });
  process.env.SPOTIFY_CLIENT_ID = clientId;
  process.env.SPOTIFY_CLIENT_SECRET = clientSecret;
  resetToken();
  return NextResponse.json({ ok: true });
}
