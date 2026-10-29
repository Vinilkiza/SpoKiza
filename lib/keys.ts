import "server-only";
import { promises as fs, readFileSync } from "fs";
import os from "os";
import path from "path";

/* Claves de Spotify guardadas fuera de la carpeta del programa
   (en la carpeta del usuario), para que no se pierdan al actualizar o reinstalar. */

const FILE = path.join(os.homedir(), ".spokiza", "config.json");

export function loadKeys(): { id?: string; secret?: string } {
  // 1) las guardadas desde la pantalla "Conectar Spotify"; 2) variables de entorno (.env.local o Vercel)
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8")) as { clientId?: string; clientSecret?: string };
    if (data.clientId && data.clientSecret) return { id: data.clientId, secret: data.clientSecret };
  } catch {
    /* sin archivo */
  }
  return { id: process.env.SPOTIFY_CLIENT_ID, secret: process.env.SPOTIFY_CLIENT_SECRET };
}

export async function saveKeys(clientId: string, clientSecret: string) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ clientId, clientSecret }, null, 2), "utf8");
}
