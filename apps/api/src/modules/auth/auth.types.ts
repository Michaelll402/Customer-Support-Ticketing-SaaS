import type { RoleName } from '@prisma/client';

export interface AccessTokenPayload {
  email: string;
  role: RoleName;
  sub: string;
}
