/* eslint-disable @typescript-eslint/unbound-method */
jest.mock("../../prisma/prisma.service", () => ({
  PrismaService: class PrismaServiceMock {},
}));

import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: jest.Mocked<
    Pick<PrismaService, "employee" | "otp" | "$transaction">
  >;
  let jwtService: jest.Mocked<JwtService>;

  const employee = {
    id: "emp_1",
    email: "admin@buy2.com",
    passwordHash: null,
    role: { name: "SuperAdmin" },
    status: "Active",
  } as never;

  const hashOf = (password: string) => bcrypt.hashSync(password, 4);

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      otp: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    } as never;

    jwtService = {
      signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
      verifyAsync: jest.fn(),
    } as never;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: unknown) => {
              if (key === "JWT_EXPIRES_IN") return 3600;
              if (key === "NODE_ENV") return "test";
              return def;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === "JWT_SECRET") return "test-secret";
              throw new Error(`Missing ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("login", () => {
    it("returns token/expiresIn/role for valid credentials", async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...employee,
        passwordHash: hashOf("Password123!"),
      });

      const result = await service.login("admin@buy2.com", "Password123!");

      expect(result).toEqual({
        token: "signed.jwt.token",
        expiresIn: 3600,
        role: "SuperAdmin",
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: "emp_1",
        email: "admin@buy2.com",
        role: "SuperAdmin",
        type: "access",
      });
    });

    it("rejects a wrong password", async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...employee,
        passwordHash: hashOf("Password123!"),
      });

      await expect(
        service.login("admin@buy2.com", "WrongPass1"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects a suspended employee", async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...employee,
        status: "Suspended",
        passwordHash: hashOf("Password123!"),
      });

      await expect(
        service.login("admin@buy2.com", "Password123!"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an employee without a password (pending setup)", async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(employee);

      await expect(
        service.login("admin@buy2.com", "Whatever123!"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("otpSend", () => {
    it("generates and persists an OTP with a hashed code", async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(employee);
      (prisma.otp.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.otp.create as jest.Mock).mockResolvedValue({});

      const result = await service.otpSend("admin@buy2.com");

      expect(result.message).toBe("OTP sent successfully.");
      expect(prisma.otp.create).toHaveBeenCalled();
      const createCalls = (prisma.otp.create as jest.Mock).mock
        .calls as unknown as Array<Array<{ data: { codeHash: string } }>>;
      expect(createCalls[0][0].data.codeHash).toMatch(/^[a-f0-9]{64}$/);
      expect(createCalls[0][0].data.codeHash).not.toBe(result.devCode);
    });

    it("does not leak whether the email exists", async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.otpSend("nobody@buy2.com");

      expect(result.message).toBe("OTP sent successfully.");
      expect(result.devCode).toBeUndefined();
      expect(prisma.otp.create).not.toHaveBeenCalled();
    });

    it("throws 429 during the resend cooldown", async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(employee);
      (prisma.otp.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      });

      await expect(service.otpSend("admin@buy2.com")).rejects.toMatchObject({
        status: 429,
      });
    });
  });

  describe("passwordReset", () => {
    it("resets the password with a matching OTP", async () => {
      const code = "123456";
      (prisma.otp.findFirst as jest.Mock).mockResolvedValue({
        id: "otp_1",
        codeHash: new OtpService().hashCode(code),
        attempts: 0,
      });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      const result = await service.passwordReset(
        "admin@buy2.com",
        code,
        "NewPass123!",
      );

      expect(result.message).toBe("Password reset successful.");
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("rejects a wrong code and increments attempts", async () => {
      (prisma.otp.findFirst as jest.Mock).mockResolvedValue({
        id: "otp_1",
        codeHash: new OtpService().hashCode("111111"),
        attempts: 0,
      });

      await expect(
        service.passwordReset("admin@buy2.com", "000000", "NewPass123!"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.otp.update).toHaveBeenCalledWith({
        where: { id: "otp_1" },
        data: { attempts: { increment: 1 } },
      });
    });

    it("rejects after max attempts", async () => {
      (prisma.otp.findFirst as jest.Mock).mockResolvedValue({
        id: "otp_1",
        codeHash: new OtpService().hashCode("111111"),
        attempts: 5,
      });

      await expect(
        service.passwordReset("admin@buy2.com", "111111", "NewPass123!"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("setPassword", () => {
    it("sets the initial password and activates the employee", async () => {
      jwtService.verifyAsync = jest
        .fn()
        .mockResolvedValue({ sub: "emp_1", type: "setup" });
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...employee,
        passwordHash: null,
      });
      (prisma.employee.update as jest.Mock).mockResolvedValue({});

      const result = await service.setPassword("setup.token", "NewPass123!");

      expect(result.message).toBe("Password set successfully.");
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: "emp_1" },
        data: expect.objectContaining({ status: "Active" }) as {
          status: string;
        },
      });
    });

    it("rejects an invalid token", async () => {
      jwtService.verifyAsync = jest.fn().mockRejectedValue(new Error("bad"));

      await expect(
        service.setPassword("bad.token", "NewPass123!"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an access token used as a setup token", async () => {
      jwtService.verifyAsync = jest
        .fn()
        .mockResolvedValue({ sub: "emp_1", type: "access" });

      await expect(
        service.setPassword("access.token", "NewPass123!"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects when the password was already set", async () => {
      jwtService.verifyAsync = jest
        .fn()
        .mockResolvedValue({ sub: "emp_1", type: "setup" });
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...employee,
        passwordHash: hashOf("Existing123!"),
      });

      await expect(
        service.setPassword("setup.token", "NewPass123!"),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
