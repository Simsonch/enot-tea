import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/auth/password.js';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error('OWNER_EMAIL and OWNER_PASSWORD are required.');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: Role.OWNER } },
    update: {},
    create: { userId: user.id, role: Role.OWNER },
  });

  console.info(`Owner account is ready: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
