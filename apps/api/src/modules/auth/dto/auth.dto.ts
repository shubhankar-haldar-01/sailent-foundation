import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

import { emailSchema, staffPasswordSchema, staffTokenSchema } from '@sailent/validation';

/**
 * Auth request schemas.
 *
 * The SAME `emailSchema` the web app validates with, so the
 * client and server cannot disagree about what is valid.
 */

export const staffLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(256),
  totpCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

/**
 * Donor sign-in is addressed by EMAIL.
 *
 * It was `phoneSchema` — the code was issued against a phone number and
 * delivered to whatever email happened to be on the donor record, which asked
 * people to type one thing to receive a message somewhere else. The address is
 * now both the identifier and the destination.
 */
export const otpRequestSchema = z.object({ email: emailSchema });

export const otpVerifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Re-authentication for sensitive operations. Same factors as the original login. */
export const reauthSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(256),
  totpCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

// --- Swagger shapes ---------------------------------------------------------

export class StaffLoginDto {
  @ApiProperty({ example: 'admin@sailent.local' })
  email!: string;

  @ApiProperty({ example: 'DevPassword123!', writeOnly: true })
  password!: string;

  @ApiProperty({ required: false, example: '123456', description: 'Required for privileged roles' })
  totpCode?: string;
}

export class OtpRequestDto {
  @ApiProperty({
    example: 'asha@example.com',
    description: 'The address on the donation. Matched case-insensitively.',
  })
  email!: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: 'asha@example.com' })
  email!: string;

  @ApiProperty({ example: '123456' })
  code!: string;
}

export class RefreshDto {
  @ApiProperty({ writeOnly: true })
  refreshToken!: string;
}

export class ReauthDto {
  @ApiProperty({ writeOnly: true })
  password!: string;

  @ApiProperty({ required: false, example: '123456' })
  totpCode?: string;
}

export class SessionResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;
  @ApiProperty({ example: { id: 'uuid', audience: 'staff', permissions: ['campaign.read'] } })
  actor!: { id: string; audience: string; permissions: string[] };
}

/** Phase 13 — staff invitation acceptance and password reset. */
export const staffSetPasswordSchema = z
  .object({ token: staffTokenSchema, password: staffPasswordSchema })
  .strict();
export const staffForgotPasswordSchema = z.object({ email: emailSchema }).strict();
