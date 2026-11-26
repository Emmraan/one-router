import type { MiddlewareHandler } from 'hono';

export function securityHeaders(production: boolean): MiddlewareHandler {
  return async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Frame-Options', 'DENY');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    if (production) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    await next();
  };
}
