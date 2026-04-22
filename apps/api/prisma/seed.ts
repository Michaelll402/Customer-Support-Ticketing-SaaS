import { PrismaClient, RoleName } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password1!';
const SALT_ROUNDS = 12;

const demoUsers = [
  {
    email: 'customer@demo.test',
    firstName: 'Casey',
    lastName: 'Customer',
    role: RoleName.CUSTOMER,
  },
  {
    email: 'agent@demo.test',
    firstName: 'Avery',
    lastName: 'Agent',
    role: RoleName.AGENT,
  },
  {
    email: 'manager@demo.test',
    firstName: 'Morgan',
    lastName: 'Manager',
    role: RoleName.MANAGER,
  },
  {
    email: 'admin@demo.test',
    firstName: 'Addison',
    lastName: 'Admin',
    role: RoleName.ADMIN,
  },
] as const;

const seed = async () => {
  for (const roleName of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const passwordHash = await hash(DEMO_PASSWORD, SALT_ROUNDS);

  for (const demoUser of demoUsers) {
    await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        passwordHash,
        role: {
          connect: {
            name: demoUser.role,
          },
        },
      },
      create: {
        email: demoUser.email,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        passwordHash,
        role: {
          connect: {
            name: demoUser.role,
          },
        },
      },
    });
  }

  console.log('Milestone 1 seed completed: roles and demo auth users created.');
};

seed()
  .catch((error) => {
    console.error('Milestone 1 seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
