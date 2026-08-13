import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class OtpSendDto {
  @ApiProperty({
    description: "Email of the account to send a reset code to.",
    example: "admin@buy2.com",
  })
  @IsEmail()
  email: string;
}
