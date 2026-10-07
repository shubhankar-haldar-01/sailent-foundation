#!/usr/bin/env node
/**
 * Does the web app build WITHOUT an API? (Phase 14)
 *
 * Starts a stand-in API on a free local port that records every request and
 * answers 503, then runs `next build` for apps/web with PRODUCTION settings
 * pointed at it (APP_ENV=production, FEATURE_MOCK_DATA=false — no fixtures to
 * fall back to). Passes only if the build succeeds AND the stand-in received
 * no request at all: a production image must build with no API, no database
 * and no secrets.
 *
 *   node scripts/check-web-build-isolation.mjs [repo-dir]
 *
 * Run it in a copy of the repository while `next dev` is running: the build
 * writes apps/web/.next (DEPLOYMENT.md §4).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const repo = resolve(process.argv[2] ?? '.');
const requests = [];

const server = createServer((req, res) => {
  requests.push(`${req.method} ${req.url}`);
  res.writeHead(503, { 'content-type': 'application/json' });
  res.end('{"success":false}');
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const { port } = server.address();

const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: 'production',
  APP_ENV: 'production',
  FEATURE_MOCK_DATA: 'false',
  API_URL: `http://127.0.0.1:${port}`,
  NEXT_PUBLIC_APP_URL: 'https://build-check.invalid',
  MEDIA_PUBLIC_BASE_URL: 'https://media.build-check.invalid',
  NEXT_TELEMETRY_DISABLED: '1',
  ...(process.env.NEXT_OUTPUT ? { NEXT_OUTPUT: process.env.NEXT_OUTPUT } : {}),
};

const code = await new Promise((done) => {
  const child = spawn('pnpm', ['--filter', '@sailent/web', 'exec', 'next', 'build'], {
    cwd: repo,
    env,
    stdio: 'inherit',
  });
  child.on('exit', (exitCode) => done(exitCode ?? 1));
});
server.close();

console.log('\n── web build isolation ──');
console.log(`build exit code: ${code}`);
console.log(`requests to the stand-in API during the build: ${requests.length}`);
for (const line of requests.slice(0, 20)) console.log(`  ${line}`);
if (code !== 0 || requests.length > 0) {
  console.error('FAIL: the web build needs the API, or did not complete.');
  process.exit(1);
}
console.log('PASS: built with production settings and no API.');
