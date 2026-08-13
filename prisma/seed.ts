import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SuperAdmin' },
    update: {},
    create: {
      name: 'SuperAdmin',
      permissions: {
        employeeManagement: ['Add', 'Edit', 'View', 'Delete', 'Suspend'],
        jobManagement: ['Add', 'Edit', 'View', 'Delete', 'Suspend'],
        siteManagement: ['Add', 'Edit', 'View', 'Delete', 'Suspend'],
        pointsManagement: ['Add', 'Edit', 'View', 'Delete', 'Suspend'],
        notifications: ['Add', 'Edit', 'View', 'Delete', 'Suspend'],
        rewards: ['Add', 'Edit', 'View', 'Delete', 'Suspend'],
      },
    },
  });

  await prisma.role.upsert({
    where: { name: 'Employee' },
    update: {},
    create: { name: 'Employee', permissions: {} },
  });

  const email = 'admin@buy2.com';
  const existing = await prisma.employee.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    await prisma.employee.create({
      data: {
        email,
        passwordHash,
        firstName: 'Buy2',
        lastName: 'Super Admin',
        phoneNumber: '+966500000000',
        gender: 'Male',
        status: 'Active',
        roleId: superAdminRole.id,
      },
    });
    console.log(`Seeded super admin: ${email} / Admin123!`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
