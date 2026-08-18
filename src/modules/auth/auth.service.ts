import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { OtpService } from "./otp.service";
import { JwtPayload } from "./interfaces/jwt-payload.interface";

const BCRYPT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  expiresIn: number;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly expiresIn: number;
  private readonly setupTokenExpiresIn = 900;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly config: ConfigService,
  ) {
    this.expiresIn = Number(this.config.get("JWT_EXPIRES_IN", 3600));
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const employee = await this.prisma.employee.findUnique({
      where: { email },
      include: { role: true, userCredential: true },
    });

    const credential = employee?.userCredential;
    const valid =
      employee &&
      employee.status !== "Suspended" &&
      credential &&
      credential.passwordHash !== null &&
      (await bcrypt.compare(password, credential.passwordHash));

    if (!valid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    await this.prisma.userCredential.update({
      where: { employeeId: employee.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await this.signAccessToken(
      employee.id,
      employee.email,
      employee.role.name,
    );
    return { token, expiresIn: this.expiresIn, role: employee.role.name };
  }

  async otpSend(email: string): Promise<{ message: string; devCode?: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { email },
    });

    if (!employee) {
      return { message: "OTP sent successfully." };
    }

    const latest = await this.prisma.passwordResetOtp.findFirst({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < this.otpService.cooldownMs
    ) {
      throw new HttpException(
        "OTP resend cooldown in effect.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.otpService.generateCode();
    console.log(`[DEV] OTP for ${email}: ${code} (expires in ${this.otpService.expiresAt.toISOString()})`);
    await this.prisma.passwordResetOtp.create({
      data: {
        employeeId: employee.id,
        otpHash: this.otpService.hashCode(code),
        expiresAt: this.otpService.expiresAt,
      },
    });

    return {
      message: "OTP sent successfully.",
      ...(this.isDevelopment() ? { devCode: code } : {}),
    };
  }

  async passwordReset(
    email: string,
    otpCode: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { email },
    });

    if (!employee) {
      throw new BadRequestException("Invalid or expired OTP.");
    }

    const otp = await this.prisma.passwordResetOtp.findFirst({
      where: {
        employeeId: employee.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp || otp.attemptCount >= this.otpService.maxAttemptsAllowed) {
      throw new BadRequestException("Invalid or expired OTP.");
    }

    if (otp.otpHash !== this.otpService.hashCode(otpCode)) {
      await this.prisma.passwordResetOtp.update({
        where: { id: otp.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new BadRequestException("Invalid or expired OTP.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.userCredential.upsert({
        where: { employeeId: employee.id },
        update: { passwordHash, lastPasswordChangedAt: new Date() },
        create: {
          employeeId: employee.id,
          passwordHash,
          lastPasswordChangedAt: new Date(),
        },
      }),
      this.prisma.employee.update({
        where: { id: employee.id },
        data: { status: "Active" },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: "Password reset successful." };
  }

  async setPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new BadRequestException("Invalid or expired setup token.");
    }

    if (payload.type !== "setup") {
      throw new BadRequestException("Invalid or expired setup token.");
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: payload.sub },
      include: { userCredential: true },
    });
    if (!employee) {
      throw new BadRequestException("Invalid or expired setup token.");
    }
    if (employee.userCredential?.passwordHash) {
      throw new ConflictException("Initial password has already been set.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.userCredential.upsert({
      where: { employeeId: employee.id },
      update: { passwordHash, lastPasswordChangedAt: new Date() },
      create: {
        employeeId: employee.id,
        passwordHash,
        lastPasswordChangedAt: new Date(),
      },
    });
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { status: "Active" },
    });

    return { message: "Password set successfully." };
  }

  async signAccessToken(
    employeeId: string,
    email: string,
    role: string,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: employeeId,
      email,
      role,
      type: "access",
    };
    return this.jwtService.signAsync(payload);
  }

  async signSetupToken(employeeId: string): Promise<string> {
    const payload: JwtPayload = {
      sub: employeeId,
      email: "",
      role: "",
      type: "setup",
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: this.setupTokenExpiresIn,
    });
  }

  private isDevelopment(): boolean {
    return this.config.get("NODE_ENV", "development") !== "production";
  }
}
