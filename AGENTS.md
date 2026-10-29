# Reglas para agentes (Codex / ChatGPT) — SpoKiza

Claude es quien define las tareas. Tú (Codex) las ejecutas.

## Cómo trabajar
1. Lee la tarea pendiente en `TAREAS.md` (la primera que diga `[ ]`).
2. Haz SOLO lo que dice esa tarea. No cambies otras cosas.
3. Antes de entregar corre: `npx tsc --noEmit -p .` y `npx next build`. Ambos deben pasar.
4. Marca la tarea como `[x]` en `TAREAS.md` y escribe debajo, en una línea, qué archivos cambiaste.
5. Abre un Pull Request (no subas directo a main). Claude lo revisa.

## Normas del proyecto (no romper)
- Next.js 16 + TypeScript + Tailwind v4. Textos de la app en español.
- Fuente: Montserrat en todo (títulos/firma "Made By Vinilkiza" en Montserrat 900).
- Normas de texto (lib/render/kit.ts): nada se corta; los nombres nunca se acortan; si no cabe, se achica o baja de línea.
  Tamaño mínimo: MIN_LIST_MM (1,6 mm) en listas y MIN_SMALL_MM (1,2 mm) en datos pequeños.
- Todo lo que se dibuja en un póster va dentro de `movable(k, "id", ...)` para el modo edición.
- Nada puede salirse de la hoja: medir antes de dibujar y, si no cabe, activar `k.tight`.
- No tocar: `scripts/update.mjs`, `SpoKiza.vbs`, `lib/keys.ts`, `.env*` (claves y actualizador).
- No agregar dependencias sin que la tarea lo pida.
