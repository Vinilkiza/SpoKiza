# SpoKiza

Editor para crear **posters de álbum, posters de canción, polaroids y placas tipo Spotify** a partir de links de Spotify, en lote, listos para imprimir.

**Exporta:** PDF de impresión (300 DPI, sangrado y marcas de corte), PNG 300 DPI, ZIP del lote, PDF multipágina, pliego (varios por hoja con marcas), mockup y video vertical 1080×1920 para reels.

---

## Instalar y abrir (en el PC)

1. **Node.js**: descarga la versión **LTS** de https://nodejs.org e instálala (siguiente, siguiente, finalizar).
2. **Descargar SpoKiza**: en GitHub (repositorio Vinilkiza/SpoKiza) botón verde **Code → Download ZIP**, y descomprímelo.
3. Doble clic en **`SpoKiza.vbs`**. La primera vez se prepara (unos minutos) y crea el icono **SpoKiza** en el escritorio.
   Desde ahí se abre siempre con ese icono, en su propia ventana, sin ventana negra.
4. **Conectar Spotify (solo la primera vez)**: el programa muestra una pantalla con los pasos para sacar el Client ID y el
   Client Secret en developer.spotify.com (cuenta **Premium**) y los guarda solo.

**Actualizaciones automáticas:** cada vez que se abre SpoKiza revisa GitHub (repositorio público Vinilkiza/SpoKiza) y, si hay
una versión nueva, la descarga sola. Las claves de Spotify se guardan aparte (carpeta del usuario, `.spokiza`), así que no se pierden.

`iniciar.bat` sigue funcionando como alternativa (abre con la ventana negra visible, útil para ver errores).
El programa queda encendido en segundo plano hasta que se apaga o reinicia el PC; al volver a abrir el icono, abre al instante.

## Cómo se usa

1. **Agregar:** busca el álbum, canción o playlist en *Buscar en Spotify* (no hace falta abrir Spotify) y dale *+ Lote*. También se pueden pegar links, uno por línea.
2. **Producto y medida:** elige Poster de álbum, Poster de canción, Polaroid o Placa. La medida es libre: escribe cualquier ancho y alto en cm o px (o usa una de la lista); botón ⇄ para girar. En horizontal el póster de álbum se acomoda solo (portada a la izquierda, ficha a la derecha). El sangrado viene en 3 mm (posters) y 2 mm (polaroid/placa). En tamaños gigantes el programa baja la resolución lo justo para que el archivo se pueda generar y lo avisa arriba.
3. **Estilo de póster de álbum** (inspirados en referencias de Pinterest):
   - *Titular*: artista arriba, portada, canciones a la izquierda, paleta y ficha a la derecha, título gigante abajo.
   - *Minimal*: portada, título con paleta pequeña, líneas finas y ficha en tres columnas (fecha, género, sello).
   - *Franja*: línea y título arriba con el año, barra de colores bajo la portada, artista grande, sello y artistas invitados.
   - *Noche*: foto a sangre que se funde en negro, canciones en negrita y título en gris.
   - *Degradado*: foto que se funde al color principal del álbum, cuadros de color con borde.
   Los textos de la ficha pueden ir en español o en inglés. Además: Claro / Oscuro / *Color de la foto*, cinco tipografías (Condensada es la de las referencias), y se puede activar/desactivar código Spotify y paleta.
4. **Editar cada diseño:** título, artista, lista de canciones, ficha del álbum (fecha, duración, género, sello, invitados), dedicatoria en los otros productos y **foto propia** (reemplaza la portada). Fecha y duración se llenan solas si se dejan vacías; género y sello vienen de Spotify cuando los tiene (si no, se escriben). Con ⧉ duplicas un diseño para hacer otra versión (otra foto u otra dedicatoria).
5. **Exportar:** un diseño (PDF, PNG, Mockup, Video) o todo el lote (ZIP, PDF multipágina, Pliego en carta/oficio/A4/A3/tabloide/1/4 de pliego con copias).

Los ajustes de estilo y medida se aplican a **todo el lote**. El lote se guarda en el navegador (las fotos propias no, hay que volver a subirlas si se cierra).

La línea punteada rosada de la vista previa es la **línea de corte**; lo que queda por fuera es sangrado.

## Hoja de impresión (33 × 48 cm)

- En **Exportar este diseño** el botón **PDF en hoja 33 × 48 cm** saca el diseño a su tamaño real, ya puesto en la hoja,
  con marcas de corte: se manda directo a imprimir, sin pasar por Photoshop.
- En **Hoja de impresión** se cambia la medida de la hoja (33 × 48 viene por defecto), si va arriba a la izquierda o
  centrado, el margen, las copias y las marcas de corte. La hoja elegida se recuerda.
- Si caben varios (por ejemplo polaroids), se acomodan solos en la hoja y se giran si así caben más.
  "Todo el lote en hojas" hace lo mismo con todos los diseños del lote.

## Modo edición y firma

- **Made By Vinilkiza** (Montserrat Black) sale arriba a la derecha en todos los diseños; se apaga con la casilla "Made By Vinilkiza".
- **Habilitar modo edición** (arriba de la vista previa): cada texto y pieza se puede arrastrar con el mouse, cambiarle el
  tamaño con la barra, moverlo fino con las flechas (Shift = más rápido) o devolverlo a su lugar. Los cambios se guardan
  por diseño y salen igual en el PDF, PNG, mockup y video.

## Normas de texto

- Nada se corta: los nombres largos bajan de línea (máximo 2 por canción) o se achican lo justo.
- Todas las canciones van del mismo tamaño y las columnas quedan parejas.
- Tamaño mínimo al imprimir: 1,6 mm de alto de mayúscula en listas (~7 pt) y 1,2 mm en datos pequeños.
  Si un álbum tiene tantas canciones que no alcanza, la portada se achica un poco para darles espacio.
- En canción, polaroid y placa la foto toma el espacio que sobra después de los textos.

## Límites que pone Spotify (no son del programa)

- **Playlists:** desde febrero de 2026 Spotify solo entrega la lista de canciones de playlists **propias o colaborativas** de la cuenta. De playlists ajenas llega el nombre, la portada y el dueño; las canciones se escriben a mano en el campo *Lista de canciones*.
- **Portadas:** Spotify entrega las portadas a 640 × 640 px. En formatos grandes (30×40 en adelante) la portada se amplía y pierde nitidez; con una foto propia en buena resolución el resultado es mejor.
- **Búsqueda:** máximo 10 resultados por búsqueda. Para muchos ítems, pegar links es más rápido.
- **Modo desarrollo:** Spotify lo describe como para proyectos personales/no comerciales y con cuota limitada de consultas; si sale "cuota agotada", esperar unos minutos.
- **Derechos de las carátulas:** como dijo Esteban en su correo, Spotify no da licencia comercial sobre carátulas protegidas. Con fotos propias del cliente el uso es más seguro.

## Notas técnicas (para Julian)

- Next.js 16 (App Router) + TypeScript + Tailwind v4. Sin base de datos.
- `lib/spotify.ts`: Client Credentials del lado del servidor, ya ajustado a los cambios de feb-2026 (sin endpoints batch, `items` en playlists, búsqueda máx. 10).
- `app/api/img` y `app/api/code`: proxys para portadas y Spotify Codes (el código se trae en SVG para que quede nítido a cualquier tamaño).
- `lib/render/templates.ts`: las 4 plantillas dibujadas en canvas con unidades relativas, el mismo código hace la vista previa y el archivo de 300 DPI.
- `lib/export/`: PNG con DPI incrustado (pHYs), PDF con pdf-lib (TrimBox/BleedBox y marcas), pliego, mockup y video con MediaRecorder.
- El color sale en RGB; si la imprenta exige CMYK, la conversión se hace en el RIP o en Illustrator/Acrobat.
