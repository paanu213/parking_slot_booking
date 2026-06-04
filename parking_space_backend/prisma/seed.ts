import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const run = async () => {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@autosahay.com';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe!234';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin already exists: ${email}`);
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      passwordHash: await argon2.hash(password),
      emailVerified: true,
    },
  });
  console.log(`Seeded super admin: ${user.email} / ${password}`);
};

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
