/* Actualizador de SpoKiza.
   1) Revisa que estén instaladas todas las dependencias (si falta alguna, la instala).
   2) Compara con la última versión en GitHub y, si hay cambios:
      - primero actualiza package.json / package-lock.json e instala lo nuevo;
      - solo si eso salió bien, copia el resto del código (así el programa nunca queda a medias).
   Si la instalación no se puede hacer con SpoKiza encendido, deja la actualización pendiente
   y SpoKiza.vbs la termina la próxima vez que se abra. */
import { execSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "Vinilkiza/SpoKiza";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verFile = path.join(root, ".version");
const pendingFile = path.join(root, ".update-pending");
const SKIP = new Set([".env.local", "node_modules", ".next", ".version", ".update-pending", ".git"]);
const PKG = ["package.json", "package-lock.json"];

function missingDeps() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return Object.keys(deps).filter((d) => !fs.existsSync(path.join(root, "node_modules", d, "package.json")));
  } catch {
    return ["?"];
  }
}

function npmInstall() {
  try {
    execSync("npm install --no-audit --no-fund", { cwd: root, stdio: "inherit", timeout: 15 * 60_000 });
    return missingDeps().length === 0;
  } catch {
    return false;
  }
}

function copyDir(src, dst, only) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    if (only && !only(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else fs.copyFileSync(s, d);
  }
}

async function main() {
  // 1) dependencias completas
  if (missingDeps().length) {
    console.log("Instalando lo que falta…");
    if (!npmInstall()) {
      fs.writeFileSync(pendingFile, "deps");
      return console.log("PENDIENTE: no se pudo instalar con SpoKiza encendido.");
    }
  }

  // 2) ¿hay versión nueva?
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
    headers: { "User-Agent": "SpoKiza", Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return console.log(`Sin acceso a GitHub (${res.status}); se sigue con la versión actual.`);
  const { sha } = await res.json();
  const current = fs.existsSync(verFile) ? fs.readFileSync(verFile, "utf8").trim() : "";
  if (sha === current) {
    if (fs.existsSync(pendingFile)) fs.rmSync(pendingFile);
    return console.log("SpoKiza ya está actualizado.");
  }

  console.log("Descargando la nueva versión de SpoKiza…");
  const tgz = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${sha}`, { signal: AbortSignal.timeout(120000) });
  if (!tgz.ok) return console.log(`No se pudo descargar (${tgz.status}).`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spokiza-"));
  const file = path.join(tmp, "src.tar.gz");
  fs.writeFileSync(file, Buffer.from(await tgz.arrayBuffer()));
  execFileSync("tar", ["-xzf", file, "-C", tmp]);
  const folder = fs.readdirSync(tmp, { withFileTypes: true }).find((e) => e.isDirectory());
  if (!folder) return console.log("Descarga incompleta.");
  const src = path.join(tmp, folder.name);

  // 3) primero las dependencias
  const backup = Object.fromEntries(PKG.map((p) => [p, fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p)) : null]));
  const changed = PKG.some((p) => {
    const a = backup[p];
    const b = fs.existsSync(path.join(src, p)) ? fs.readFileSync(path.join(src, p)) : null;
    return !a || !b || !a.equals(b);
  });
  if (changed) {
    copyDir(src, root, (name) => PKG.includes(name));
    if (missingDeps().length) {
      console.log("Instalando dependencias nuevas…");
      if (!npmInstall()) {
        // se deja todo como estaba para que SpoKiza siga funcionando
        for (const p of PKG) if (backup[p]) fs.writeFileSync(path.join(root, p), backup[p]);
        fs.writeFileSync(pendingFile, sha);
        fs.rmSync(tmp, { recursive: true, force: true });
        return console.log("PENDIENTE: la actualización se termina al volver a abrir SpoKiza.");
      }
    }
  }

  // 4) el resto del código
  copyDir(src, root);
  fs.writeFileSync(verFile, sha);
  if (fs.existsSync(pendingFile)) fs.rmSync(pendingFile);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("SpoKiza actualizado.");
}

main().catch((e) => console.log("No se pudo actualizar:", e.message));
