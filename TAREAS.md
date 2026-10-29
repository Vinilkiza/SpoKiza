# Tareas (las escribe Claude, las hace Codex)

Formato: `- [ ] título` + detalle. Codex hace la primera pendiente, la marca `[x]` y abre un Pull Request.

- [ ] 1. Campo "Código del cliente" en SpoKiza

  Objetivo: el cliente escoge del catálogo un número (1 a 8) y a veces un color. David lo escribe y SpoKiza ajusta todo solo.

  Dónde: `components/Studio.tsx`, arriba del todo en el panel derecho (antes de "Producto"). Un input de texto con
  etiqueta "Código del cliente" y placeholder "Ej: 3 negro". Se aplica al presionar Enter o al salir del campo.
  Hacer la lógica en un archivo nuevo `lib/codigo.ts` con una función pura `parseCodigo(texto) => Partial<DesignSettings> | null`.

  Números (cambian `product`, `albumStyle`, `theme` y medida):
  - 1 Titular → product "poster-album", albumStyle "titular", theme "claro"
  - 2 Minimal → "poster-album", "minimal", "claro"
  - 3 Franja → "poster-album", "franja", "claro"
  - 4 Noche → "poster-album", "noche", theme "oscuro"
  - 5 Degradado → "poster-album", "degradado", theme "portada"
  - 6 Canción → product "poster-cancion", theme "claro"
  - 7 Polaroid → product "polaroid", 8,8 × 10,7 cm, theme "claro"
  - 8 Placa → product "placa", 15 × 20 cm, theme "oscuro"
  Para 1–6 la medida NO cambia si ya es de póster; si venía de polaroid/placa, poner 30 × 45.
  Al cambiar de producto, usar el mismo sangrado por defecto que ya usa la app al tocar los botones de producto.

  Color (opcional, después del número, sin importar mayúsculas ni tildes):
  - "claro", "blanco", "a" → "claro"
  - "negro", "oscuro", "b" → "oscuro"
  - "color", "foto", "color de la foto", "c" → "portada"
  - En 4 y 5 se ignora el color (su color es fijo).
  También aceptar "3b", "3B", "3 B", "3-negro".

  Si no se entiende: no cambiar nada y mostrar debajo del campo en rojo "No entendí el código (ej: 3 negro)".
  Si se aplica: mostrar en verde, p. ej. "Listo: 3 Franja · Negro".

  Pruebas: agregar `lib/codigo.test.ts` NO es necesario; basta con que `npx tsc --noEmit -p .` y `npx next build` pasen.


- [ ] Firma superior izquierda (solicitud directa del usuario)

  Implementado en borrador: “Made By Vinilkiza” en Montserrat Black 900, discreta y con color adaptado al fondo, para álbumes y demás imágenes. Archivos: `lib/render/kit.ts`, `lib/render/album.ts`, `lib/render/song.ts` y `TAREAS.md`.
  Pendiente: comprobación visual, `npx tsc --noEmit -p .` y `npx next build`; las dependencias no están disponibles en el entorno sin red.
