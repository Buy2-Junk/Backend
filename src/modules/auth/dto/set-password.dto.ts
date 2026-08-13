import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class SetPasswordDto {
  @ApiProperty({
    description:
      "One-time setup token returned by POST /employees when the account was created.",
    example:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsb2c5IiwidHlwZSI6InNldHVwIn0.example",
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: "New password (min 8 characters).",
    example: "Cashier123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
