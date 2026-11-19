#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY: an https address for the local web server, so a phone on
 * the same network can use its camera on the gate scanner.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS.
 *
 * Browsers give the camera only to secure pages: https, or `localhost` on the
 * computer itself. A phone opening `http://<this computer>:3000` is neither,
 * so it gets no camera at all, whatever the page does.
 *
 * This serves `https://<this computer>:3443` in front of the dev server on
 * :3000, which keeps running exactly as before (the desktop still uses
 * `http://localhost:3000`). The certificate covers this computer's network
 * addresses and is signed by a local certificate authority made on the first
 * run. A phone that trusts that authority opens the page with no warning;
 * one that does not shows a warning first.
 *
 * Everything lives in `.dev-https/` (git-ignored). The authority's private key
 * never leaves this computer. Nothing here is used in production.
 *
 *   pnpm dev:https          (with `pnpm dev` already running)
 * ══════════════════════════════════════════════════════════════════════════
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, '.dev-https');
const TARGET = { host: '127.0.0.1', port: Number(process.env.WEB_PORT ?? 3000) };
const PORT = Number(process.env.DEV_HTTPS_PORT ?? 3443);
/** Where a phone downloads the local authority's certificate to trust it. */
const CA_DOWNLOAD = '/dev-https-ca.crt';
/**
 * A plain-http page for setting a phone up. An iPhone refuses a certificate
 * it does not trust — it will not open the https address to fetch the
 * authority from — so the authority is ALSO offered over plain http here,
 * with the steps. Only that page and that file; nothing else is served.
 */
const SETUP_PORT = Number(process.env.DEV_HTTPS_SETUP_PORT ?? 3080);

const clock = () => new Date().toTimeString().slice(0, 8);

/** A short name for the device, for the log: never the full user agent. */
function deviceOf(userAgent = '') {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iPhone/iPad';
  if (/Android/.test(userAgent)) return 'Android';
  return 'desktop';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** This computer's IPv4 addresses on its networks (Wi-Fi, hotspot, cable). */
function networkAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

function openssl(args) {
  execFileSync('openssl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
}

/** The local authority: made once, kept, so a phone only has to trust it once. */
function ensureAuthority() {
  const key = path.join(DIR, 'ca.key');
  const cert = path.join(DIR, 'ca.pem');
  if (!existsSync(key) || !existsSync(cert)) {
    openssl([
      'req',
      '-x509',
      '-new',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-sha256',
      '-days',
      '825',
      '-keyout',
      key,
      '-out',
      cert,
      '-subj',
      '/CN=Sailent Foundation local development CA',
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-addext',
      'keyUsage=critical,keyCertSign,cRLSign',
    ]);
    // The same certificate in the binary form phones install.
    openssl(['x509', '-in', cert, '-outform', 'der', '-out', path.join(DIR, 'ca.crt')]);
  }
  return { key, cert };
}

/**
 * The server certificate, for localhost and every current network address.
 * Re-issued when the addresses change (a hotspot hands out a new one), signed
 * by the same authority, so the phone does not have to trust anything again.
 */
function ensureServerCertificate(authority, addresses) {
  const key = path.join(DIR, 'server.key');
  const cert = path.join(DIR, 'server.pem');
  const coveredFile = path.join(DIR, 'server.covers');
  const covers = ['localhost', '127.0.0.1', ...addresses].join(',');
  const current =
    existsSync(key) && existsSync(cert) && existsSync(coveredFile)
      ? readFileSync(coveredFile, 'utf8')
      : null;
  if (current === covers) return { key, cert };

  const extensions = path.join(DIR, 'server.ext');
  writeFileSync(
    extensions,
    [
      `subjectAltName=${['DNS:localhost', 'IP:127.0.0.1', ...addresses.map((ip) => `IP:${ip}`)].join(',')}`,
      'basicConstraints=CA:FALSE',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
    ].join('\n'),
  );
  const request = path.join(DIR, 'server.csr');
  openssl([
    'req',
    '-new',
    '-nodes',
    '-newkey',
    'rsa:2048',
    '-keyout',
    key,
    '-out',
    request,
    '-subj',
    '/CN=Sailent Foundation local development',
  ]);
  // 397 days: within what iPhones accept for a server certificate.
  openssl([
    'x509',
    '-req',
    '-in',
    request,
    '-CA',
    authority.cert,
    '-CAkey',
    authority.key,
    '-CAcreateserial',
    '-out',
    cert,
    '-days',
    '397',
    '-sha256',
    '-extfile',
    extensions,
  ]);
  writeFileSync(coveredFile, covers);
  return { key, cert };
}

mkdirSync(DIR, { recursive: true });
const addresses = networkAddresses();
const authority = ensureAuthority();
const certificate = ensureServerCertificate(authority, addresses);
const authorityDer = readFileSync(path.join(DIR, 'ca.crt'));

const server = https.createServer(
  { key: readFileSync(certificate.key), cert: readFileSync(certificate.cert) },
  (request, response) => {
    if (request.method === 'GET' && request.url === CA_DOWNLOAD) {
      response.writeHead(200, {
        'content-type': 'application/x-x509-ca-cert',
        'content-disposition': 'attachment; filename="sailent-dev-ca.crt"',
      });
      response.end(authorityDer);
      return;
    }

    /*
      What a phone did, so "the camera does not open" can be traced without
      seeing the screen: page loads and form posts only (not the scripts and
      images behind them), the path WITHOUT its query string (which can carry
      a token), and the device kind.
    */
    const pathOnly = (request.url ?? '').split('?')[0];
    if (
      !pathOnly.startsWith('/_next/') &&
      !/\.(js|css|png|jpe?g|webp|svg|ico|woff2?)$/.test(pathOnly)
    ) {
      console.log(
        `${clock()}  ${deviceOf(request.headers['user-agent'])}  ${request.socket.remoteAddress}  ${request.method} ${pathOnly}`,
      );
    }

    // Everything else goes to the dev server unchanged. The Host header is
    // kept, so the site's same-origin checks see the address the phone used.
    const upstream = http.request(
      {
        ...TARGET,
        method: request.method,
        path: request.url,
        headers: {
          ...request.headers,
          'x-forwarded-proto': 'https',
          'x-forwarded-host': request.headers.host ?? '',
          'x-forwarded-port': String(PORT),
        },
      },
      (answer) => {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
      },
    );
    upstream.on('error', () => {
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      }
      response.end(
        `The web server on port ${TARGET.port} is not answering. Start it with pnpm dev.`,
      );
    });
    request.pipe(upstream);
  },
);

// A phone that does not trust the certificate ends the connection here.
server.on('tlsClientError', (error, socket) => {
  console.log(
    `${clock()}  ${socket.remoteAddress ?? 'unknown'}  REFUSED THE CERTIFICATE (${error.code ?? error.message}). Set the phone up: http://<this computer>:${SETUP_PORT}`,
  );
});

// Websockets (the dev server's hot reload) are passed straight through.
server.on('upgrade', (request, socket, head) => {
  const upstream = net.connect(TARGET.port, TARGET.host, () => {
    const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      lines.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on('error', close);
  socket.on('error', close);
});

// ── The phone setup page (plain http: the one thing a phone can open first) ──
const setup = http.createServer((request, response) => {
  const pathOnly = (request.url ?? '').split('?')[0];
  if (request.method === 'GET' && pathOnly === '/sailent-dev-ca.crt') {
    console.log(
      `${clock()}  ${deviceOf(request.headers['user-agent'])}  downloaded the certificate`,
    );
    response.writeHead(200, {
      'content-type': 'application/x-x509-ca-cert',
      'content-disposition': 'attachment; filename="sailent-dev-ca.crt"',
    });
    response.end(authorityDer);
    return;
  }
  if (request.method !== 'GET' || pathOnly !== '/') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const hostname = (request.headers.host ?? 'localhost').replace(/:\d+$/, '');
  const site = `https://${escapeHtml(hostname)}:${PORT}`;
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phone setup</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 24px auto; padding: 0 16px; line-height: 1.5; color: #1f2933; background: #fff; }
  .button { display: inline-block; background: #EB6A1F; color: #fff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 600; }
  li { margin: 8px 0; }
  .note { color: #52606d; font-size: 14px; }
</style></head><body>
<h1>Use the camera on this phone</h1>
<p>Phones only allow the camera on a secure page. Do this <b>once</b> so this phone trusts this computer's test certificate.</p>
<p><a class="button" href="/sailent-dev-ca.crt">Download the certificate</a></p>
<h2>iPhone (use Safari)</h2>
<ol>
  <li>Tap <b>Download the certificate</b>, then <b>Allow</b>, then <b>Close</b>.</li>
  <li>Open <b>Settings</b>. Tap <b>Profile Downloaded</b> near the top, then <b>Install</b> (three times) and enter your passcode.</li>
  <li>Still in Settings, go to <b>General → About → Certificate Trust Settings</b> and turn <b>on</b> “Sailent Foundation local development CA”. <i>This step is easy to miss, and without it the camera stays off.</i></li>
  <li>In Safari, open <a href="${site}/">${site}</a>, sign in, open the gate, and tap <b>Allow</b> when asked for the camera.</li>
</ol>
<h2>Android</h2>
<ol>
  <li>Tap <b>Download the certificate</b>.</li>
  <li>Settings → Security → Encryption &amp; credentials → Install a certificate → <b>CA certificate</b> → choose the file.</li>
  <li>Open <a href="${site}/">${site}</a>.</li>
</ol>
<p class="note">If Safari still blocks the camera: Settings → Safari → Camera → <b>Ask</b>. When you finish testing, remove the profile: Settings → General → VPN &amp; Device Management.</p>
</body></html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  setup.listen(SETUP_PORT, '0.0.0.0', () => {
    const lines = [
      '',
      `  https for phones → the dev server on :${TARGET.port}`,
      '',
      ...addresses.flatMap((ip) => [
        `  1. Set a phone up once:   http://${ip}:${SETUP_PORT}`,
        `  2. Then open:             https://${ip}:${PORT}`,
      ]),
      `  On this computer:         https://localhost:${PORT}`,
      '',
      '  Phone visits are listed below as they happen.',
      '',
    ];
    console.log(lines.join('\n'));
  });
});
