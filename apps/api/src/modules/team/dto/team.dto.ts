import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Request schemas for the public team directory.
 *
 * `status`, `isPublic`, `userId` and `publishedAt` are ABSENT from every write
 * schema. Publication is a transition with its own route, and linking a team
 * member to a login account is a privilege change that does not belong on a
 * bio-editing form.
 */

export const teamIdParam = z.object({ id: z.string().uuid('Not a valid id') });

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

/**
 * Social links.
 *
 * A LABEL AND A URL, not a fixed set of platform columns. A trustee's entry is
 * as likely to be a personal site or a published paper as it is to be LinkedIn,
 * and a schema with `twitterUrl` and `linkedinUrl` in it forces every other
 * kind of link to be left off.
 *
 * `https` only. These render as links on a public page, and `javascript:` in an
 * href is the oldest stored-XSS trick there is.
 */
const socialLinks = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(40),
      url: z
        .string()
        .trim()
        .max(500)
        .refine((value) => /^https:\/\//i.test(value), 'Links must start with https://'),
    }),
  )
  .max(8);

export const teamListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'published', 'archived', 'all']).optional(),
  memberType: z.enum(['staff', 'trustee', 'advisor', 'board']).optional(),
  department: z.string().trim().max(120).optional(),
});

const teamFields = {
  name: z.string().trim().min(1, 'A name is required').max(160),
  slug: slugField.optional(),
  photoUrl: z.string().trim().max(1000).nullish(),
  designation: z.string().trim().min(1, 'A designation is required').max(160),
  department: z.string().trim().max(120).nullish(),
  memberType: z.enum(['staff', 'trustee', 'advisor', 'board']).optional(),
  bio: z.string().max(10_000).nullish(),
  experience: z.string().max(10_000).nullish(),
  socialLinks: socialLinks.nullish(),
  /**
   * A PUBLISHED address, and it is not the person's work email by default.
   *
   * Everything on this record goes on a page a scraper will read within the
   * week. The field exists because a director of programmes with a public
   * contact address is genuinely useful; it is optional because most of the
   * team should not have one.
   */
  emailPublic: z.string().trim().email('Not a valid email address').max(255).nullish(),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
};

export const createTeamMemberSchema = z.object(teamFields).strict();
export const updateTeamMemberSchema = z.object(teamFields).strict().partial();

export const teamStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  reason: z.string().trim().max(500).optional(),
});

export const teamReorderSchema = z.object({
  order: z
    .array(z.object({ id: z.string().uuid(), displayOrder: z.number().int().min(0).max(10_000) }))
    .min(1)
    .max(200),
});

export class CreateTeamMemberDto {
  @ApiProperty({ example: 'Dr Anjali Menon' })
  name!: string;

  @ApiProperty({ example: 'Director of Programmes' })
  designation!: string;

  @ApiPropertyOptional({ example: 'dr-anjali-menon' })
  slug?: string;

  @ApiPropertyOptional({ enum: ['staff', 'trustee', 'advisor', 'board'] })
  memberType?: string;

  @ApiPropertyOptional({ example: [{ label: 'LinkedIn', url: 'https://…' }] })
  socialLinks?: { label: string; url: string }[];
}

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
export type TeamListQuery = z.infer<typeof teamListQuerySchema>;
