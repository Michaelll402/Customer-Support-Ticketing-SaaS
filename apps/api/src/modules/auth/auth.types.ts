import type { RoleName } from '@prisma/client';

export interface AccessTokenPayload {
  email: string;
  role: RoleName;
  sub: string;
  // Bumped whenever a user's sessions must be invalidated (role change,
  // deactivation). JwtStrategy rejects tokens whose tokenVersion no longer
  // matches the persisted user, enabling immediate revocation.
  tokenVersion: number;
}
