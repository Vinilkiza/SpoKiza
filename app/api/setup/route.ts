import { NextResponse } from "next/server";
import { resetToken, testCredentials } from "@/lib/spotify";
import { loadKeys, saveKeys } from "@/lib/keys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* Configuración de Spotify desde el mismo programa (solo cuando corre en el PC).
   Guarda las claves en la carpeta del usuario para que sobrevivan a las actualizaciones. */

const isLocal = () => !process.env.VERCEL;
export async function GET() {
  return NextResponse.json({
    configured: Boolean(loadKeys().id && loadKeys().secret),
    canSave: isLocal(),
  });
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
  await saveKeys(clientId, clientSecret);
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  resetToken();
  return NextResponse.json({ ok: true });
}
