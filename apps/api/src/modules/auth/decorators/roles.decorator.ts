import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '@prisma/client';

import { ROLES_KEY } from '../auth.constants';

export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
