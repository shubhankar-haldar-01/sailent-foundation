import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'sailent:is-public';

/**
 * Marks a route as reachable without authentication.
 *
 * Authorization is DENY BY DEFAULT (decision A9): a route without either
 * `@Public()` or a permission requirement is unreachable. Every use of this
 * decorator is therefore a deliberate, reviewable decision — it should be
 * looked at in code review the way a `// eslint-disable` is.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
