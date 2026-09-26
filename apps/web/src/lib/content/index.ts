/**
 * The content layer.
 *
 * Every public page reads from here. Nothing outside this directory imports a
 * fixture — see `source.ts` for why that boundary matters and what happens in
 * production when the API is unreachable.
 */

export * from './source';
export * from './programs';
export * from './campaigns';
export * from './stories';
export * from './events';
export * from './team';
export * from './impact';
export * from './blog';
export * from './pages';
