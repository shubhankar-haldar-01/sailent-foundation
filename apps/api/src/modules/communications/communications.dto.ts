import { z } from 'zod';

import {
  CONTACT_MESSAGE_STATUSES,
  NEWSLETTER_STATUSES,
  newsletterTokenSchema,
} from '@sailent/validation';

import { paginationQuerySchema } from '../../common/dto/pagination.dto.js';

export { contactSubmissionSchema, newsletterSubscribeSchema } from '@sailent/validation';

export const uuidParam = z.object({ id: z.string().uuid('Not a valid id') });

export const contactListQuerySchema = paginationQuerySchema.extend({
  status: z.enum([...CONTACT_MESSAGE_STATUSES, 'all']).default('new'),
});

export const contactStatusSchema = z.object({ status: z.enum(CONTACT_MESSAGE_STATUSES) }).strict();

export const newsletterTokenBodySchema = z.object({ token: newsletterTokenSchema }).strict();

export const newsletterListQuerySchema = paginationQuerySchema.extend({
  status: z.enum([...NEWSLETTER_STATUSES, 'all']).default('subscribed'),
});
