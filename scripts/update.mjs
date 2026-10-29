/* Actualizador de SpoKiza: compara con la última versión en GitHub y, si hay cambios,
   descarga el código nuevo y lo copia encima (sin tocar node_modules ni las claves). */
import { execSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "Vinilkiza/SpoKiza";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verFile = path.join(root, ".version");
const SKIP = new Set([".env.local", "node_modules", ".next", ".version", ".git"]);

function copyDir(src, dst) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else fs.copyFileSync(s, d);
  }
}

async function main() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
    headers: { "User-Agent": "SpoKiza", Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return console.log(`Sin acceso a GitHub (${res.status}); se sigue con la versión actual.`);
  const { sha } = await res.json();
  const current = fs.existsSync(verFile) ? fs.readFileSync(verFile, "utf8").trim() : "";
  if (sha === current) return console.log("SpoKiza ya está actualizado.");

  console.log("Descargando la nueva versión de SpoKiza…");
  const tgz = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${sha}`, { signal: AbortSignal.timeout(90000) });
  if (!tgz.ok) return console.log(`No se pudo descargar (${tgz.status}).`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spokiza-"));
  const file = path.join(tmp, "src.tar.gz");
  fs.writeFileSync(file, Buffer.from(await tgz.arrayBuffer()));
  execFileSync("tar", ["-xzf", file, "-C", tmp]);
  const folder = fs.readdirSync(tmp, { withFileTypes: true }).find((e) => e.isDirectory());
  if (!folder) return console.log("Descarga incompleta.");

  const lock = path.join(root, "package-lock.json");
  const before = fs.existsSync(lock) ? fs.readFileSync(lock, "utf8") : "";
  copyDir(path.join(tmp, folder.name), root);
  const after = fs.existsSync(lock) ? fs.readFileSync(lock, "utf8") : "";
  if (before !== after || !fs.existsSync(path.join(root, "node_modules"))) {
    console.log("Instalando dependencias nuevas…");
    execSync("npm install", { cwd: root, stdio: "inherit" });
  }
  fs.writeFileSync(verFile, sha);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("SpoKiza actualizado.");
}

main().catch((e) => console.log("No se pudo actualizar:", e.message));
