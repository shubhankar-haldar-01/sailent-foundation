import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { Public } from '../../common/decorators/public.decorator.js';
import {
  AuthenticatedOnly,
  RequireAudience,
} from '../../common/decorators/permissions.decorator.js';
import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import {
  OtpRequestDto,
  OtpVerifyDto,
  ReauthDto,
  RefreshDto,
  SessionResponseDto,
  StaffLoginDto,
  otpRequestSchema,
  otpVerifySchema,
  reauthSchema,
  refreshSchema,
  staffLoginSchema,
} from './dto/auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Client IP, respecting a trusted proxy header when the platform sets one. */
  private clientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
    return request.ip;
  }

  @Public()
  @Post('staff/login')
  @HttpCode(200)
  // Five attempts per minute. Credential stuffing is the threat here, and the
  // limit is on the endpoint rather than only per-account so that spraying one
  // password across many accounts is also throttled.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Staff sign-in with email and password' })
  @ApiBody({ type: StaffLoginDto })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiResponse({ status: 401, description: 'Credentials do not match an account' })
  @ApiResponse({ status: 403, description: 'Account inactive, or 2FA not enrolled' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async staffLogin(
    @Body(new ZodValidationPipe(staffLoginSchema))
    body: { email: string; password: string; totpCode?: string },
    @Req() request: Request,
  ) {
    return this.auth.loginStaff({
      email: body.email,
      password: body.password,
      totpCode: body.totpCode,
      ip: this.clientIp(request),
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post('donor/otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @ApiOperation({
    summary: 'Request a donor sign-in code',
    description:
      'Always returns 200 whether or not the address is known. Anything else would make this a donor-enumeration oracle.',
  })
  @ApiBody({ type: OtpRequestDto })
  async requestOtp(
    @Body(new ZodValidationPipe(otpRequestSchema)) body: { email: string },
    @Req() request: Request,
  ) {
    return this.auth.requestOtp({ email: body.email, ip: this.clientIp(request) });
  }

  @Public()
  @Post('donor/otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Exchange a donor code for a session' })
  @ApiBody({ type: OtpVerifyDto })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  async verifyOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: { email: string; code: string },
    @Req() request: Request,
  ) {
    return this.auth.verifyOtp({
      email: body.email,
      code: body.code,
      ip: this.clientIp(request),
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate a refresh token',
    description:
      'Reusing an already-rotated token revokes the entire session family — the standard detection for a stolen token.',
  })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string },
    @Req() request: Request,
  ) {
    return this.auth.refresh({
      refreshToken: body.refreshToken,
      ip: this.clientIp(request),
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current session family' })
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string }) {
    await this.auth.logout(body.refreshToken);
  }

  @ApiBearerAuth('staff')
  @RequireAudience('staff')
  @AuthenticatedOnly()
  @Post('reauth')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Confirm your password again, for a sensitive operation',
    description:
      'Sensitive operations (role changes, donor exports, document visibility) require a re-authentication within the last five minutes. Returns 403 REAUTH_REQUIRED until this has been done.',
  })
  @ApiBody({ type: ReauthDto })
  @ApiResponse({ status: 200, description: 'Re-authenticated; the window is now open' })
  @ApiResponse({ status: 401, description: 'Password or 2FA code incorrect' })
  async reauth(
    @Body(new ZodValidationPipe(reauthSchema)) body: { password: string; totpCode?: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.auth.reauthenticate({
      actor,
      password: body.password,
      totpCode: body.totpCode,
    });
  }

  @ApiBearerAuth('staff')
  @RequireAudience('staff')
  @AuthenticatedOnly()
  @Get('me')
  @ApiOperation({
    summary: 'The signed-in actor and their effective permissions',
    description:
      'The admin UI filters its navigation from this list. That filtering is cosmetic — the API enforces every permission independently.',
  })
  me(@CurrentActor() actor: AuthenticatedActor | undefined) {
    return {
      id: actor?.id,
      audience: actor?.audience,
      permissions: actor?.permissions ?? [],
      /**
       * Lets the admin UI prompt for a password BEFORE the user fills in a
       * export form, rather than after. Purely a courtesy — the API rechecks
       * freshness on every sensitive call regardless of what the client believes.
       */
      reauthenticatedAt: actor?.reauthenticatedAt ?? null,
    };
  }
}
