import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import type { AccessTokenPayload } from '../auth.types';

const extractAccessTokenFromCookie =
  (cookieName: string) =>
  (request: Request | undefined): string | null => {
    const cookieHeader = request?.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    for (const cookie of cookieHeader.split(';')) {
      const [name, ...valueParts] = cookie.trim().split('=');

      if (name === cookieName) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return null;
  };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    const cookieName = configService.getOrThrow<string>('auth.cookieName');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractAccessTokenFromCookie(cookieName),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  validate(payload: AccessTokenPayload) {
    return payload;
  }
}
