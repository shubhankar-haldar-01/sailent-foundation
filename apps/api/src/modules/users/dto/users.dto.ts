import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { emailSchema } from '@sailent/validation';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

export const userListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['invited', 'active', 'inactive', 'suspended']).optional(),
  role: z.string().max(64).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Not a valid id') });

export const inviteUserSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  /**
   * Roles are assigned AT INVITE, so an account never exists in a state where
   * someone has logged in but nobody has decided what they may do.
   */
  roleKeys: z.array(z.string().max(64)).min(1, 'Assign at least one role'),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const assignRolesSchema = z.object({
  roleKeys: z.array(z.string().max(64)).min(1, 'A user must hold at least one role'),
  /** Recorded on the audit row. Who changed it is not the same as why. */
  reason: z.string().trim().min(3).max(500).optional(),
});

export const statusChangeSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason').max(500),
});

// --- Swagger shapes ---------------------------------------------------------

export class InviteUserDto {
  @ApiProperty({ example: 'priya@sailentfoundation.org' })
  email!: string;

  @ApiProperty({ example: 'Priya' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Nair' })
  lastName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  phone?: string;

  @ApiProperty({ example: ['CONTENT_MANAGER'], isArray: true, type: String })
  roleKeys!: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() phone?: string;
}

export class AssignRolesDto {
  @ApiProperty({ example: ['CAMPAIGN_MANAGER'], isArray: true, type: String })
  roleKeys!: string[];

  @ApiPropertyOptional({ example: 'Promoted to run the winter appeal' })
  reason?: string;
}

export class StatusChangeDto {
  @ApiProperty({ example: 'Left the organisation on 30 September' })
  reason!: string;
}

/**
 * The staff-account shape returned by this module.
 *
 * `passwordHash`, `totpSecret` and `backupCodes` are ABSENT BY CONSTRUCTION —
 * the service selects columns explicitly rather than `select()`-ing the row and
 * deleting fields afterwards, because the delete is the step someone forgets.
 */
export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiPropertyOptional() lastName?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiProperty({ enum: ['invited', 'active', 'inactive', 'suspended'] })
  status!: string;
  @ApiProperty({
    example: true,
    description: 'Whether 2FA is enrolled. The secret is never returned.',
  })
  totpEnabled!: boolean;
  @ApiPropertyOptional() lastLoginAt?: Date | null;
  @ApiProperty({ isArray: true, example: [{ key: 'ADMIN', name: 'Admin' }] })
  roles!: { key: string; name: string }[];
  @ApiProperty() createdAt!: Date;
}
