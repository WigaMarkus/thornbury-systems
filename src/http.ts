// HTTP plumbing shared by the routes in server.ts: JSON responses with CORS,
// typed errors that carry their own status, body reading with a size cap, and
// static serving of the built front end out of web/dist.

import { existsSync, statSync, createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
} as const;

export function json(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
    ...extraHeaders,
  });
  res.end(payload);
}

// An error that knows what status it should be sent as. Anything extra is
// spread into the response body next to the message.
export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;

  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const BODY_LIMIT_BYTES = 1024 * 1024;

// Reads and parses a JSON request body. An empty body is an empty object so
// endpoints with all-optional fields need no special case. Over the cap is 413,
// unparseable is 400 — both as HttpError so the route wrapper turns them into
// proper responses.
export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > BODY_LIMIT_BYTES) {
      throw new HttpError(413, 'request body too large');
    }
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (raw === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'invalid JSON body');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'invalid JSON body');
  }
  return parsed as Record<string, unknown>;
}

const distRoot = fileURLToPath(new URL('../web/dist', import.meta.url));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendFile(res: ServerResponse, filePath: string, cacheControl: string) {
  const mime = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': mime,
    'content-length': statSync(filePath).size,
    'cache-control': cacheControl,
    ...CORS_HEADERS,
  });
  createReadStream(filePath).pipe(res);
}

// Serves the built front end. Returns false when there is no build (or the
// request cannot be a page/asset), so the caller can fall through to its 404.
export function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
  const indexHtml = resolve(distRoot, 'index.html');
  if (!existsSync(indexHtml)) return false;

  const rawPath = decodeURIComponent(url.pathname);
  const candidate = resolve(distRoot, '.' + (rawPath === '/' ? '/index.html' : rawPath));

  // Path traversal guard: whatever the URL resolved to must still be inside dist.
  const withinDist = candidate === resolve(distRoot) || candidate.startsWith(resolve(distRoot) + sep);
  if (!withinDist) return false;

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    const immutable = rawPath.startsWith('/assets/');
    sendFile(res, candidate, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    return true;
  }

  // SPA fallback: a GET for a path with no file extension is a client-side
  // route, and gets index.html so the front end router can take it from there.
  if (extname(rawPath) === '') {
    sendFile(res, indexHtml, 'no-cache');
    return true;
  }

  return false;
}
