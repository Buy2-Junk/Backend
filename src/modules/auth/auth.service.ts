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
      include: { role: true },
    });

    const valid =
      employee &&
      employee.status !== "Suspended" &&
      employee.passwordHash !== null &&
      (await bcrypt.compare(password, employee.passwordHash));

    if (!valid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

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

    const latest = await this.prisma.otp.findFirst({
      where: { email },
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
    await this.prisma.otp.create({
      data: {
        email,
        employeeId: employee.id,
        codeHash: this.otpService.hashCode(code),
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
    const otp = await this.prisma.otp.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!otp || otp.attempts >= this.otpService.maxAttemptsAllowed) {
      throw new BadRequestException("Invalid or expired OTP.");
    }

    if (otp.codeHash !== this.otpService.hashCode(otpCode)) {
      await this.prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Invalid or expired OTP.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.employee.update({
        where: { email },
        data: { passwordHash, status: "Active" },
      }),
      this.prisma.otp.update({
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
    });
    if (!employee) {
      throw new BadRequestException("Invalid or expired setup token.");
    }
    if (employee.passwordHash) {
      throw new ConflictException("Initial password has already been set.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash, status: "Active" },
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
