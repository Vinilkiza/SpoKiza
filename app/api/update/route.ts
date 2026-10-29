import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* Busca actualizaciones en GitHub cada vez que se abre o se recarga (F5) SpoKiza.
   Como mucho una vez cada 30 segundos. Solo en el PC (no en Vercel). */
let last = 0;

export async function POST() {
  if (process.env.VERCEL) return NextResponse.json({ updated: false });
  if (Date.now() - last < 30_000) return NextResponse.json({ updated: false });
  last = Date.now();
  const script = path.join(process.cwd(), "scripts", "update.mjs");
  const output = await new Promise<string>((resolve) =>
    execFile(process.execPath, [script], { cwd: process.cwd(), timeout: 20 * 60_000 }, (_err, stdout) => resolve(String(stdout ?? ""))),
  );
  return NextResponse.json({
    updated: output.includes("SpoKiza actualizado."),
    pending: output.includes("PENDIENTE"),
    message: output.trim().split("\n").pop() ?? "",
  });
}
