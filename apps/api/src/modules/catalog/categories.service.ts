import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@sailent/types';
import { NotFoundException } from '../../common/exceptions.js';
import type { AuditContext } from './programs.service.js';

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  key?: string;
  description?: string | null;
  icon?: string | null;
  kind?: 'program' | 'campaign' | 'both' | 'blog';
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  kind?: 'program' | 'campaign' | 'both' | 'blog';
  displayOrder?: number;
  isActive?: boolean;
}

/**
 * The category catalogue has been retired in favor of direct Program attribution.
 * This service retains method signatures for backward compatibility.
 */
@Injectable()
export class CategoriesService {
  async list(_options: { kind?: 'program' | 'campaign'; activeOnly?: boolean } = {}) {
    return { items: [] };
  }

  async getById(_id: string) {
    throw new NotFoundException('Category');
  }

  async create(input: CreateCategoryInput, _actor: AuthenticatedActor, _context: AuditContext) {
    return { id: '00000000-0000-0000-0000-000000000000', name: input.name };
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
    _actor: AuthenticatedActor,
    _context: AuditContext,
  ) {
    return { id, name: input.name ?? '' };
  }

  async resolveForWrite(
    _categoryId: string | null | undefined,
    _kind: 'program' | 'campaign',
  ): Promise<{ id: string; name: string } | null> {
    return null;
  }

  async idsForSlugs(_slugs: string[]): Promise<string[]> {
    return [];
  }
}
