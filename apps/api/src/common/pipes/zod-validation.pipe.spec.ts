import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email('Enter a valid email address'),
    age: z.coerce.number().int().min(18, 'Must be 18 or over'),
    nickname: z.string().optional(),
  });

  it('returns the PARSED value, not the input', () => {
    // The parsed value carries coercions and defaults. Returning the raw input
    // means a handler receives the string "21" where it expects a number.
    const result = new ZodValidationPipe(schema).transform({
      email: 'priya@sailentfoundation.org',
      age: '21',
    }) as { age: number };

    expect(result.age).toBe(21);
    expect(typeof result.age).toBe('number');
  });

  it('strips fields the schema does not declare', () => {
    // Mass assignment: a client that posts `{ status: "active" }` at an invite
    // endpoint must not have it reach the insert.
    const result = new ZodValidationPipe(schema).transform({
      email: 'priya@sailentfoundation.org',
      age: 30,
      status: 'active',
      isAdmin: true,
    }) as Record<string, unknown>;

    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('isAdmin');
  });

  it('reports EVERY field at once', () => {
    // One error at a time turns filling in a form into a guessing game.
    try {
      new ZodValidationPipe(schema).transform({ email: 'not-an-email', age: 12 });
      expect.unreachable('should have thrown');
    } catch (error) {
      const details = (error as { details: { field?: string; message?: string }[] }).details;
      expect(details).toHaveLength(2);
      expect(details.map((detail) => detail.field).sort()).toEqual(['age', 'email']);
      expect(details.find((detail) => detail.field === 'age')?.message).toBe('Must be 18 or over');
    }
  });

  it('throws the documented envelope with a stable code', () => {
    try {
      new ZodValidationPipe(schema).transform({});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as { code: string }).code).toBe('VALIDATION_FAILED');
      expect((error as { getStatus(): number }).getStatus()).toBe(422);
    }
  });

  it('names a nested field by its full path', () => {
    const nested = z.object({ address: z.object({ postalCode: z.string().length(6) }) });

    try {
      new ZodValidationPipe(nested).transform({ address: { postalCode: '12' } });
      expect.unreachable('should have thrown');
    } catch (error) {
      const details = (error as { details: { field?: string }[] }).details;
      expect(details[0]?.field).toBe('address.postalCode');
    }
  });

  it.each([null, undefined, 'a string', 42, []])(
    'rejects %p where an object is required',
    (bad) => {
      expect(() => new ZodValidationPipe(schema).transform(bad)).toThrow();
    },
  );
});
