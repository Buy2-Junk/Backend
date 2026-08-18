import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { OtpSendDto } from "./dto/otp-send.dto";
import { PasswordResetDto } from "./dto/password-reset.dto";
import { SetPasswordDto } from "./dto/set-password.dto";
import type { AuthenticatedUser } from "./jwt.strategy";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sign in with email and password",
    description: "Returns a JWT access token valid for 1 hour.",
  })
  @ApiOkResponse({
    description: "Credentials valid; access token issued.",
    schema: {
      example: {
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsb2c5Iiwicm9sZSI6IlN1cGVyQWRtaW4iLCJ0eXBlIjoiYWNjZXNzIn0.example",
        expiresIn: 3600,
        role: "SuperAdmin",
      },
    },
  })
  @ApiUnauthorizedResponse({
    description:
      "Invalid credentials, suspended account, or password not yet set.",
    schema: {
      example: {
        message: "Invalid credentials.",
        error: "Unauthorized",
        statusCode: 401,
      },
    },
  })
  @ApiBadRequestResponse({ description: "Email/password fail validation." })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post("otp/send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Send a one-time password reset code",
    description:
      "Generates a 6-digit OTP (valid 10 minutes, 5 attempts). Always " +
      "responds the same way whether or not the email exists, to avoid " +
      "account enumeration. A devCode is returned only when NODE_ENV is not " +
      "production.",
  })
  @ApiOkResponse({
    description: "OTP generated and stored.",
    schema: {
      example: {
        message: "OTP sent successfully.",
        devCode: "123456",
      },
    },
  })
  @ApiTooManyRequestsResponse({
    description: "Resend attempted before the 60s cooldown elapsed.",
    schema: {
      example: {
        message: "OTP resend cooldown in effect.",
        error: "Too Many Requests",
        statusCode: 429,
      },
    },
  })
  @ApiBadRequestResponse({ description: "Email fails validation." })
  otpSend(@Body() dto: OtpSendDto) {
    return this.authService.otpSend(dto.email);
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset a password using an OTP code",
    description:
      "Verifies the OTP, then sets the new password and marks the code " +
      "used. Up to 5 wrong attempts per code.",
  })
  @ApiOkResponse({
    description: "Password reset successful.",
    schema: { example: { message: "Password reset successful." } },
  })
  @ApiBadRequestResponse({
    description: "Invalid/expired OTP or too many attempts.",
    schema: {
      example: {
        message: "Invalid or expired OTP.",
        error: "Bad Request",
        statusCode: 400,
      },
    },
  })
  passwordReset(@Body() dto: PasswordResetDto) {
    return this.authService.passwordReset(
      dto.email,
      dto.otpCode,
      dto.newPassword,
    );
  }

  @Post("set-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Set the initial password for a new employee",
    description:
      "Uses the one-time setup token returned when the employee was " +
      "created. Only valid before a password is set; activates the employee.",
  })
  @ApiOkResponse({
    description: "Password set and employee activated.",
    schema: { example: { message: "Password set successfully." } },
  })
  @ApiBadRequestResponse({
    description: "Token missing, expired, or not a setup token.",
    schema: {
      example: {
        message: "Invalid or expired setup token.",
        error: "Bad Request",
        statusCode: 400,
      },
    },
  })
  @ApiConflictResponse({
    description: "Password already set; setup token no longer usable.",
    schema: {
      example: {
        message: "Password is already set for this employee.",
        error: "Conflict",
        statusCode: 409,
      },
    },
  })
  setPassword(@Body() dto: SetPasswordDto) {
    return this.authService.setPassword(dto.token, dto.newPassword);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get the current authenticated user",
    description: "Requires a valid access token.",
  })
  @ApiOkResponse({
    description: "The authenticated employee.",
    schema: {
      example: {
        id: "clufgs7xof00000x",
        email: "admin@buy2.com",
        role: "SuperAdmin",
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid, or expired access token.",
  })
  me(@Req() req: Request): AuthenticatedUser {
    return req.user as AuthenticatedUser;
  }
}
