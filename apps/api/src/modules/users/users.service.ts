import { Inject, Injectable } from '@nestjs/common';
import { RoleName, type Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

export type UserWithRole = Prisma.UserGetPayload<{
  include: {
    role: true;
  };
}>;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  createCustomer(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: input.passwordHash,
        role: {
          connect: {
            name: RoleName.CUSTOMER,
          },
        },
      },
      include: { role: true },
    });
  }
}
