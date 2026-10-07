/**
 * Rules the production container and Cloud Run configuration must keep
 * (Phase 14). Run from the repo root:
 *
 *   node --test scripts/check-deploy-config.test.mjs      (or: pnpm check:deploy)
 *
 * No Docker needed: these read the files. The images themselves are built by
 * `docker build` / Cloud Build (DEPLOYMENT.md §12).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const SERVICES = ['api', 'worker', 'web'];

/** Split a Dockerfile into stages: [{ name, lines }]. */
function stages(dockerfile) {
  const result = [];
  for (const raw of dockerfile.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const from = /^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (from) {
      result.push({ image: from[1], name: from[2] ?? '', lines: [] });
      continue;
    }
    result.at(-1)?.lines.push(line);
  }
  return result;
}

describe('Dockerfiles', () => {
  for (const service of SERVICES) {
    const file = `apps/${service}/Dockerfile`;
    const text = read(file);
    const all = stages(text);
    const runtime = all.at(-1);

    it(`${service}: is multi-stage, on Node 22`, () => {
      assert.ok(all.length >= 2, `${file} must have a build stage and a runtime stage`);
      assert.match(text, /ARG NODE_IMAGE=node:22-/);
    });

    it(`${service}: runtime runs as the unprivileged node user`, () => {
      assert.ok(
        runtime.lines.some((line) => /^USER\s+node$/.test(line)),
        `${file}: the runtime stage must switch to USER node`,
      );
      assert.ok(!runtime.lines.some((line) => /^USER\s+root$/.test(line)));
    });

    it(`${service}: runtime is production and listens on 8080`, () => {
      const runtimeText = runtime.lines.join('\n');
      assert.match(runtimeText, /NODE_ENV=production/);
      assert.match(runtimeText, /PORT=8080/);
      assert.match(runtimeText, /^EXPOSE 8080$/m);
    });

    it(`${service}: starts node directly (exec form) so SIGTERM reaches it`, () => {
      const cmd = runtime.lines.find((line) => line.startsWith('CMD'));
      assert.ok(cmd, `${file} needs a CMD`);
      assert.match(cmd, /^CMD \["node", "[^"]+"\]$/);
    });

    it(`${service}: never migrates, seeds or hardens a database`, () => {
      for (const line of [...runtime.lines, ...all.flatMap((stage) => stage.lines)]) {
        if (!/^(RUN|CMD|ENTRYPOINT)/.test(line)) continue;
        assert.doesNotMatch(line, /db:|migrate|seed|harden|create-admin|rotate-admin/i, line);
      }
    });

    it(`${service}: copies no environment file and bakes no secret`, () => {
      for (const line of all.flatMap((stage) => stage.lines)) {
        if (line.startsWith('COPY')) assert.doesNotMatch(line, /\.env\b/, line);
        assert.doesNotMatch(
          line,
          /(SECRET|PASSWORD|_KEY|TOKEN|DATABASE_URL|REDIS_URL|DSN)=\S/i,
          `${file}: a secret-like value is set in the image: ${line}`,
        );
      }
    });

    it(`${service}: the runtime holds production dependencies only`, () => {
      const runtimeText = runtime.lines.join('\n');
      assert.doesNotMatch(runtimeText, /pnpm install/);
      if (service !== 'web') assert.match(text, /deploy --prod/);
    });
  }

  it('web: the build reads only the three public build arguments', () => {
    const args = [...read('apps/web/Dockerfile').matchAll(/^ARG\s+([A-Z_]+)/gm)].map((m) => m[1]);
    assert.deepEqual(args.filter((name) => name !== 'NODE_IMAGE').sort(), [
      'APP_ENV',
      'MEDIA_PUBLIC_BASE_URL',
      'NEXT_PUBLIC_APP_URL',
    ]);
  });

  it('web: starts through the wrapper that validates the environment first', () => {
    assert.match(read('apps/web/Dockerfile'), /CMD \["node", "apps\/web\/start-standalone\.cjs"\]/);
    assert.match(read('apps/web/start-standalone.cjs'), /process\.exit\(1\)/);
  });
});

describe('.dockerignore', () => {
  const ignore = read('.dockerignore')
    .split('\n')
    .map((line) => line.trim());
  for (const pattern of [
    '.env',
    '.env.*',
    '**/.env',
    '**/.env.*',
    '**/node_modules',
    '**/dist',
    '**/.next',
    '**/*.tsbuildinfo',
    '.git',
  ]) {
    it(`excludes ${pattern}`, () => {
      assert.ok(ignore.includes(pattern), `.dockerignore must exclude ${pattern}`);
    });
  }
  it('does not re-include an environment file', () => {
    assert.ok(!ignore.some((line) => line.startsWith('!') && line.includes('.env')));
  });
});

/** Every `- name: X` env entry and whether it has a literal value or a reference. */
function envEntries(yaml) {
  const lines = yaml.split('\n');
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s*- name: ([A-Z0-9_]+)\s*$/.exec(lines[index]);
    if (!match) continue;
    const next = lines[index + 1] ?? '';
    entries.push({
      name: match[1],
      literal: /^\s*value:/.test(next),
      secretRef: /^\s*valueFrom:/.test(next) && /secretKeyRef/.test(lines[index + 2] ?? ''),
      value: next.replace(/^\s*value:\s*/, '').trim(),
    });
  }
  return entries;
}

const SECRET_VARIABLES = new Set([
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'INTERNAL_API_SECRET',
  'FIELD_ENCRYPTION_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'BREVO_API_KEY',
  'SENTRY_DSN',
]);

describe('Cloud Run service templates', () => {
  for (const service of SERVICES) {
    const file = `infrastructure/cloud-run/${service}.service.yaml`;
    const yaml = read(file);
    const env = envEntries(yaml);

    it(`${service}: every secret comes from Secret Manager, never a literal`, () => {
      for (const entry of env) {
        if (SECRET_VARIABLES.has(entry.name)) {
          assert.ok(entry.secretRef, `${file}: ${entry.name} must use secretKeyRef`);
        }
      }
    });

    it(`${service}: holds no credential, key or project id`, () => {
      assert.doesNotMatch(yaml, /rzp_(live|test)_|postgres(ql)?:\/\/|rediss?:\/\/|-----BEGIN|AKIA/);
      assert.match(yaml, /\$\{PROJECT_ID\}/);
    });

    it(`${service}: production, no mock data, port 8080, probes defined`, () => {
      const byName = Object.fromEntries(env.map((entry) => [entry.name, entry.value]));
      assert.equal(byName.APP_ENV, 'production');
      assert.equal(byName.NODE_ENV, 'production');
      if ('FEATURE_MOCK_DATA' in byName) assert.equal(byName.FEATURE_MOCK_DATA, "'false'");
      assert.match(yaml, /containerPort: 8080/);
      assert.match(yaml, /startupProbe:/);
      assert.match(yaml, /livenessProbe:/);
    });
  }

  it('api: refuses Swagger and mock data in production', () => {
    const env = Object.fromEntries(
      envEntries(read('infrastructure/cloud-run/api.service.yaml')).map((e) => [e.name, e.value]),
    );
    assert.equal(env.SWAGGER_ENABLED, "'false'");
    assert.equal(env.FEATURE_MOCK_DATA, "'false'");
  });

  it('worker: internal only, exactly one instance, CPU always allocated', () => {
    const yaml = read('infrastructure/cloud-run/worker.service.yaml');
    assert.match(yaml, /run\.googleapis\.com\/ingress: internal/);
    assert.match(yaml, /minScale: '1'/);
    assert.match(yaml, /maxScale: '1'/);
    assert.match(yaml, /cpu-throttling: 'false'/);
    const env = Object.fromEntries(envEntries(yaml).map((e) => [e.name, e]));
    assert.ok(env.API_INTERNAL_URL, 'the worker needs API_INTERNAL_URL');
    assert.ok(env.INTERNAL_API_SECRET?.secretRef, 'and INTERNAL_API_SECRET from Secret Manager');
  });

  it('Cloud Build builds and pushes, and never deploys', () => {
    const yaml = read('infrastructure/cloud-run/cloudbuild.yaml')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    assert.doesNotMatch(yaml, /gcloud|run deploy|services replace/);
    assert.match(yaml, /^images:/m);
  });
});
