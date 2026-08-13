import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, Matches, MinLength } from "class-validator";

export class PasswordResetDto {
  @ApiProperty({
    description: "Email of the account to reset.",
    example: "admin@buy2.com",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "The 6-digit code received via the OTP flow.",
    example: "123456",
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d+$/, { message: "otpCode must contain only digits" })
  otpCode: string;

  @ApiProperty({
    description: "New password (min 8 characters).",
    example: "NewPass123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
