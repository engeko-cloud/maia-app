import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const protectedPrefixes = ["/painel", "/afastamentos", "/ocorrencias", "/admin"];
  const isProtected = protectedPrefixes.some(p => path === p || path.startsWith(p + "/"));
  // Exceção pública: /afastamentos/editar/[token] é sem auth.
  const isPublicEdit = path.startsWith("/afastamentos/editar/");

  if (isProtected && !isPublicEdit && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Portal: /portal/login and /portal/cadastro are public; everything else requires auth.
  const isPortalPublic =
    path.startsWith("/portal/login") || path.startsWith("/portal/cadastro");
  const isPortal = path === "/portal" || path.startsWith("/portal/");

  if (isPortal && !isPortalPublic && !user) {
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forms/|api/public/).*)"],
};
