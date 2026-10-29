# SpoKiza

Editor para crear **posters de álbum, posters de canción, polaroids y placas tipo Spotify** a partir de links de Spotify, en lote, listos para imprimir.

**Exporta:** PDF de impresión (300 DPI, sangrado y marcas de corte), PNG 300 DPI, ZIP del lote, PDF multipágina, pliego (varios por hoja con marcas), mockup y video vertical 1080×1920 para reels.

---

## 1. Lo que necesitas instalado (una sola vez)

- **Node.js 20 o más nuevo** (versión LTS): https://nodejs.org
- **Google Chrome** (el video vertical se graba en MP4 desde Chrome).

## 2. Crear la app de Spotify (una sola vez)

Spotify exige que la cuenta dueña de la app tenga **Spotify Premium** activo; si el Premium se vence, el programa deja de traer datos hasta que se renueve.

1. Entra a https://developer.spotify.com/dashboard con la cuenta Premium de Vinilkiza y acepta los términos.
2. Clic en **Create app**.
   - App name: `SpoKiza`
   - App description: `Editor interno de diseños`
   - Redirect URI: `http://127.0.0.1:3000/callback` (el formulario lo pide; el programa no lo usa)
   - En "Which API/SDKs are you planning to use?" marca **Web API**.
   - Acepta y guarda.
3. En la app, entra a **Settings** y copia el **Client ID**. Clic en **View client secret** y copia el **Client Secret**.
4. En la carpeta del programa, copia el archivo `.env.example`, renómbralo a **`.env.local`** y pega los datos:

```
SPOTIFY_CLIENT_ID=pega_aqui_el_client_id
SPOTIFY_CLIENT_SECRET=pega_aqui_el_client_secret
```

El Client Secret es privado: no lo compartas ni lo subas a GitHub (`.env.local` ya está excluido).

## Publicarlo en Vercel (sin instalar nada)

1. En https://vercel.com entra con GitHub y dale **Add New → Project**, elige el repositorio `SpoKiza` y **Import**.
2. Antes de darle Deploy abre **Environment Variables** y agrega tres:
   - `SPOTIFY_CLIENT_ID` → el Client ID de Spotify
   - `SPOTIFY_CLIENT_SECRET` → el Client Secret
   - `ACCESS_PASSWORD` → una clave para entrar al programa (así nadie más usa el link)
3. **Deploy**. Vercel da un link tipo `spokiza.vercel.app`; al abrirlo pide usuario (cualquiera) y la clave.

## 3. Abrir el programa en un PC (opcional)

**Windows, la forma fácil:** doble clic en `iniciar.bat`. La primera vez instala todo (tarda unos minutos) y luego abre http://localhost:3000.

**Desde VS Code / terminal:**

```
npm install
npm run dev
```

y abre http://localhost:3000.

## 4. Cómo se usa

1. **Agregar:** pega links de Spotify (uno por línea: canciones, álbumes, playlists o links cortos `spotify.link`) y clic en *Agregar al lote*, o usa el buscador.
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

## 5. Límites que pone Spotify (no son del programa)

- **Playlists:** desde febrero de 2026 Spotify solo entrega la lista de canciones de playlists **propias o colaborativas** de la cuenta. De playlists ajenas llega el nombre, la portada y el dueño; las canciones se escriben a mano en el campo *Lista de canciones*.
- **Portadas:** Spotify entrega las portadas a 640 × 640 px. En formatos grandes (30×40 en adelante) la portada se amplía y pierde nitidez; con una foto propia en buena resolución el resultado es mejor.
- **Búsqueda:** máximo 10 resultados por búsqueda. Para muchos ítems, pegar links es más rápido.
- **Modo desarrollo:** Spotify lo describe como para proyectos personales/no comerciales y con cuota limitada de consultas; si sale "cuota agotada", esperar unos minutos.
- **Derechos de las carátulas:** como dijo Esteban en su correo, Spotify no da licencia comercial sobre carátulas protegidas. Con fotos propias del cliente el uso es más seguro.

## 6. Notas técnicas (para Julian)

- Next.js 16 (App Router) + TypeScript + Tailwind v4. Sin base de datos.
- `lib/spotify.ts`: Client Credentials del lado del servidor, ya ajustado a los cambios de feb-2026 (sin endpoints batch, `items` en playlists, búsqueda máx. 10).
- `app/api/img` y `app/api/code`: proxys para portadas y Spotify Codes (el código se trae en SVG para que quede nítido a cualquier tamaño).
- `lib/render/templates.ts`: las 4 plantillas dibujadas en canvas con unidades relativas, el mismo código hace la vista previa y el archivo de 300 DPI.
- `lib/export/`: PNG con DPI incrustado (pHYs), PDF con pdf-lib (TrimBox/BleedBox y marcas), pliego, mockup y video con MediaRecorder.
- El color sale en RGB; si la imprenta exige CMYK, la conversión se hace en el RIP o en Illustrator/Acrobat.
