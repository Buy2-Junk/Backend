import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({
    description: "Employee email address.",
    example: "admin@buy2.com",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "Account password (min 8 characters).",
    example: "Admin123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}
