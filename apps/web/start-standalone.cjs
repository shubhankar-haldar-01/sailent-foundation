/**
 * Entry point of the web container (Phase 14): validate, THEN serve.
 *
 * Next's standalone server runs `instrumentation.register()` — where the web
 * environment is validated and production fails closed (Phase 12) — lazily,
 * on the first request. A misconfigured instance would therefore start,
 * report itself up, and answer every request with a 500.
 *
 * This runs the same compiled `register()` first and exits with code 1 and
 * the list of problems (variable names, never values) if the environment is
 * invalid, so Cloud Run sees a container that failed to start and keeps the
 * previous revision serving. Then it hands over to Next's `server.js`.
 */
const path = require('node:path');

process.env.NEXT_RUNTIME = process.env.NEXT_RUNTIME || 'nodejs';

(async () => {
  try {
    const instrumentation = require(path.join(__dirname, '.next/server/instrumentation.js'));
    if (typeof instrumentation.register === 'function') await instrumentation.register();
  } catch (error) {
    console.error(`[web] refusing to start: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  require(path.join(__dirname, 'server.js'));
})();
