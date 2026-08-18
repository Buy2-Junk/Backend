/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the `otps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "otps" DROP CONSTRAINT "otps_employeeId_fkey";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "passwordHash",
ADD COLUMN     "companyId" TEXT;

-- DropTable
DROP TABLE "otps";

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "lastPasswordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_credentials_employeeId_key" ON "user_credentials"("employeeId");

-- CreateIndex
CREATE INDEX "password_reset_otps_employeeId_idx" ON "password_reset_otps"("employeeId");

-- CreateIndex
CREATE INDEX "employees_companyId_idx" ON "employees"("companyId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_otps" ADD CONSTRAINT "password_reset_otps_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
