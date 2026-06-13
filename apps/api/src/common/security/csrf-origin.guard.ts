import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { buildAllowedOrigins } from '../cors/build-allowed-origins';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Dependency-free CSRF defense for state-changing requests.
 *
 * In production the auth cookie is `SameSite=None; Secure` (cross-site Azure
 * deployment), so CORS alone does not stop a forged cross-site form POST — CORS
 * only blocks the attacker from reading the response, not from sending the
 * authenticated request. This guard validates the `Origin` (or, as a fallback,
 * `Referer`) of every unsafe HTTP method against the configured frontend origin
 * allowlist.
 *
 * Policy:
 *  - Safe methods (GET/HEAD/OPTIONS) are never blocked.
 *  - Same-origin requests are always allowed: browsers attach `Origin` to every
 *    unsafe-method request (even same-origin), so requests whose Origin host
 *    equals the request `Host` header — e.g. Swagger "Try it out" served from
 *    the API's own origin — must pass. The comparison is host-only (protocol
 *    ignored) so it works behind Azure's TLS-terminating proxy, where Express
 *    reports `http` without trust-proxy. Same-origin is by definition not CSRF
 *    and browsers never let an attacker page forge the Origin header.
 *  - Unsafe methods (POST/PUT/PATCH/DELETE) with a cross-origin `Origin` header
 *    must match the allowlist, else 403.
 *  - If `Origin` is absent, a matching `Referer` (same host or allowlisted
 *    origin) is accepted.
 *  - If neither header is present: allowed in development/test (so curl, Postman,
 *    and the integration suite keep working) but rejected in production, where
 *    real browsers always send at least one of them for cross-origin writes.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (SAFE_METHODS.has(method)) {
      return true;
    }

    const allowedOrigins = buildAllowedOrigins(
      this.configService.getOrThrow<string>('app.webOrigin'),
    );
    const requestHost = request.headers.host;

    const origin = request.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      if (this.matchesRequestHost(origin, requestHost)) {
        return true;
      }
      if (allowedOrigins.includes(origin)) {
        return true;
      }
      throw new ForbiddenException('Cross-site request blocked.');
    }

    const referer = request.headers.referer;
    if (typeof referer === 'string' && referer.length > 0) {
      const refererOrigin = this.parseOrigin(referer);
      if (
        refererOrigin &&
        this.matchesRequestHost(refererOrigin, requestHost)
      ) {
        return true;
      }
      if (refererOrigin && allowedOrigins.includes(refererOrigin)) {
        return true;
      }
      throw new ForbiddenException('Cross-site request blocked.');
    }

    const isProduction =
      this.configService.getOrThrow<string>('app.env') === 'production';
    if (isProduction) {
      throw new ForbiddenException(
        'Origin or Referer header is required for this request.',
      );
    }

    return true;
  }

  private parseOrigin(value: string): string | null {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  }

  /**
   * Host-only same-origin check (protocol deliberately ignored): behind a
   * TLS-terminating proxy the request protocol reads `http` while the browser
   * sent `https`, so comparing full origins would wrongly reject same-origin
   * requests in production.
   */
  private matchesRequestHost(
    originValue: string,
    requestHost: string | undefined,
  ): boolean {
    if (!requestHost) {
      return false;
    }

    try {
      return new URL(originValue).host === requestHost;
    } catch {
      return false;
    }
  }
}
