import { createHash, randomInt } from "crypto";

export class OtpService {
  private readonly ttlMinutes: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownSeconds: number;

  constructor(ttlMinutes = 10, maxAttempts = 5, resendCooldownSeconds = 60) {
    this.ttlMinutes = ttlMinutes;
    this.maxAttempts = maxAttempts;
    this.resendCooldownSeconds = resendCooldownSeconds;
  }

  generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  hashCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  get expiresAt(): Date {
    return new Date(Date.now() + this.ttlMinutes * 60_000);
  }

  get cooldownMs(): number {
    return this.resendCooldownSeconds * 1000;
  }

  get maxAttemptsAllowed(): number {
    return this.maxAttempts;
  }
}
