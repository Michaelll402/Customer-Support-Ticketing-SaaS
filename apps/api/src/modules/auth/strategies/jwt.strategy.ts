import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { UsersService } from '../../users/users.service';
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
        try {
          return decodeURIComponent(valueParts.join('='));
        } catch {
          // A malformed percent-encoded cookie must not crash the strategy.
          // Returning null makes Passport reject the request as a clean 401.
          return null;
        }
      }
    }

    return null;
  };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {
    const cookieName = configService.getOrThrow<string>('auth.cookieName');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractAccessTokenFromCookie(cookieName),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  /**
   * Re-validates every authenticated request against the persisted user so that
   * role changes and deactivations take effect immediately instead of waiting
   * for the access token to expire:
   *  - rejects tokens whose user no longer exists,
   *  - rejects deactivated users (`isActive === false`),
   *  - rejects tokens whose `tokenVersion` is stale (revoked),
   *  - returns the FRESH database role, never the (possibly stale) token role.
   *
   * Tokens issued before this mechanism existed carry no `tokenVersion` and are
   * therefore rejected after the migration, which is the intended secure default.
   */
  async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked.');
    }

    return {
      email: user.email,
      role: user.role.name,
      sub: user.id,
      tokenVersion: user.tokenVersion,
    };
  }
}
