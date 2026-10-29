import { NextResponse, type NextRequest } from "next/server";

/* Clave de acceso: si en Vercel se define ACCESS_PASSWORD, el navegador pide
   usuario y clave antes de abrir el programa (el usuario puede ser cualquiera).
   Así nadie más gasta la cuota de Spotify con el link. */
export function proxy(request: NextRequest) {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) return NextResponse.next();
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return NextResponse.next();
    } catch {
      /* encabezado mal formado */
    }
  }
  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Vinilkiza Musica", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
