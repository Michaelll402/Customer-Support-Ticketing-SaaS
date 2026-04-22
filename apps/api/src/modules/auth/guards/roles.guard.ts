import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RoleName } from '@prisma/client';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { ROLES_KEY } from '../auth.constants';
import type { AccessTokenPayload } from '../auth.types';

type AuthenticatedRequest = Request & {
  user?: AccessTokenPayload;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication is required.');
    }

    return requiredRoles.includes(request.user.role);
  }
}
