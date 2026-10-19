/**
 * Middleware de proteção de rotas.
 * ---------------------------------------------------------------------------
 * Verifica a assinatura do cookie de sessão ANTES de a requisição chegar às
 * páginas/actions. Usuários sem sessão válida são redirecionados ao login.
 * A verificação de permissões fina continua sendo feita no servidor
 * (requirePermission) — o middleware é a primeira barreira, não a única.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'delivery_os_session';

const PUBLIC_PATHS = ['/login', '/cadastro', '/esqueci-senha', '/redefinir-senha'];

function secretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    'delivery-os-dev-secret-change-me-in-production-0123456789';
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let valid = false;

  if (token) {
    try {
      await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
      valid = true;
    } catch {
      valid = false;
    }
  }

  // Já autenticado tentando acessar telas de login -> vai para o dashboard.
  if (valid && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Não autenticado em rota protegida -> login (guardando o destino).
  if (!valid && !isPublic) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    const response = NextResponse.redirect(url);
    if (token) response.cookies.delete(SESSION_COOKIE); // limpa token inválido
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Protege tudo, exceto assets estáticos e a rota de tempo real.
  matcher: [
    '/((?!api/realtime|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)',
  ],
};
