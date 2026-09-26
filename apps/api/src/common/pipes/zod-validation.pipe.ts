import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

import type { ApiErrorDetail } from '@sailent/types';

import { ValidationException } from '../exceptions.js';

/**
 * Zod validation pipe.
 *
 * Uses the SAME schemas from @sailent/validation that the web app uses on the
 * client, so the two cannot disagree about what is valid. The client validates
 * for a fast, humane experience; this validates because the client cannot be
 * trusted.
 *
 * Errors are reported per field, all at once — reporting one problem at a time
 * turns form completion into a guessing game.
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodSchema> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const details: ApiErrorDetail[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || undefined,
        code: issue.code,
        message: issue.message,
      }));
      throw new ValidationException(details);
    }

    return result.data;
  }
}
