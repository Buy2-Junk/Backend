"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt = __importStar(require("bcryptjs"));
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../src/generated/prisma/client");
const prisma = new client_1.PrismaClient({
    adapter: new adapter_pg_1.PrismaPg({
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
//# sourceMappingURL=seed.js.map