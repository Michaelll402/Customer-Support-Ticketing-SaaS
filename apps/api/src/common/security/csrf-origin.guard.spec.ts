import 'reflect-metadata';

import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { CsrfOriginGuard } from './csrf-origin.guard';

const buildContext = (
  method: string,
  headers: Record<string, string>,
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers, method }),
    }),
  }) as unknown as ExecutionContext;

const buildGuard = (env: string) => {
  const configService = {
    getOrThrow: (key: string) =>
      key === 'app.webOrigin' ? 'http://localhost:3000' : env,
  } as unknown as ConfigService;

  return new CsrfOriginGuard(configService);
};

describe('CsrfOriginGuard', () => {
  it('allows safe GET requests regardless of origin', () => {
    const guard = buildGuard('production');

    expect(
      guard.canActivate(buildContext('GET', { origin: 'https://evil.test' })),
    ).toBe(true);
  });

  it('allows unsafe requests from an allowed origin', () => {
    const guard = buildGuard('production');

    expect(
      guard.canActivate(
        buildContext('POST', { origin: 'http://localhost:3000' }),
      ),
    ).toBe(true);
  });

  it('allows the 127.0.0.1 localhost mirror', () => {
    const guard = buildGuard('development');

    expect(
      guard.canActivate(
        buildContext('PATCH', { origin: 'http://127.0.0.1:3000' }),
      ),
    ).toBe(true);
  });

  it('rejects unsafe requests from a cross-site origin', () => {
    const guard = buildGuard('production');

    expect(() =>
      guard.canActivate(buildContext('POST', { origin: 'https://evil.test' })),
    ).toThrow(ForbiddenException);
  });

  it('allows same-origin unsafe requests whose Origin host equals the request Host (Swagger try-it-out)', () => {
    const guard = buildGuard('production');

    expect(
      guard.canActivate(
        buildContext('POST', {
          host: 'app-api.azurewebsites.net',
          // Behind TLS termination the Origin is https while Express sees http;
          // the guard compares hosts only, so this must pass.
          origin: 'https://app-api.azurewebsites.net',
        }),
      ),
    ).toBe(true);
  });

  it('allows same-origin requests on a non-default port in development', () => {
    const guard = buildGuard('development');

    expect(
      guard.canActivate(
        buildContext('POST', {
          host: 'localhost:4000',
          origin: 'http://localhost:4000',
        }),
      ),
    ).toBe(true);
  });

  it('still rejects a cross-site origin when a request Host header is present', () => {
    const guard = buildGuard('production');

    expect(() =>
      guard.canActivate(
        buildContext('POST', {
          host: 'app-api.azurewebsites.net',
          origin: 'https://evil.test',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts a same-host Referer when Origin is absent', () => {
    const guard = buildGuard('production');

    expect(
      guard.canActivate(
        buildContext('PATCH', {
          host: 'app-api.azurewebsites.net',
          referer: 'https://app-api.azurewebsites.net/api',
        }),
      ),
    ).toBe(true);
  });

  it('accepts a matching Referer when Origin is absent', () => {
    const guard = buildGuard('production');

    expect(
      guard.canActivate(
        buildContext('DELETE', { referer: 'http://localhost:3000/tickets' }),
      ),
    ).toBe(true);
  });

  it('rejects a cross-site Referer when Origin is absent', () => {
    const guard = buildGuard('production');

    expect(() =>
      guard.canActivate(
        buildContext('POST', { referer: 'https://evil.test/x' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows missing Origin and Referer in development/test', () => {
    const guard = buildGuard('test');

    expect(guard.canActivate(buildContext('POST', {}))).toBe(true);
  });

  it('rejects missing Origin and Referer in production', () => {
    const guard = buildGuard('production');

    expect(() => guard.canActivate(buildContext('POST', {}))).toThrow(
      ForbiddenException,
    );
  });
});
