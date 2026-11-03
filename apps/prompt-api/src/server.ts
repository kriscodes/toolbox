import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { parseGenerationRequest, ValidationError, type GenerationRequest, type GenerationResponse } from '@toolbox/prompt-contracts';
import { generatePrompt, GenerationError } from './generator.ts';
import type { ApiConfig } from './config.ts';

export const MAX_BODY_BYTES = 96 * 1024;
const MINUTE = 60_000;

export interface ServerOptions {
  generate?: (request: GenerationRequest, signal: AbortSignal) => Promise<GenerationResponse>;
  now?: () => number;
  limits?: { perMinute?: number; perHour?: number; concurrent?: number };
}

/** Represent transport failures separately from provider and field validation errors. */
class RequestError extends Error {
  readonly status: number;
  readonly code: string;

  /** Save a safe response status and message for an invalid incoming request. */
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Keep a bounded sliding window of accepted attempts for this single-instance API. */
class RequestWindow {
  private times: number[] = [];

  /** Expire old timestamps and record an attempt only when there is capacity. */
  take(now: number, duration: number, maximum: number): boolean {
    // Removing old entries keeps memory proportional to the configured limit.
    this.times = this.times.filter(time => time > now - duration);
    if (this.times.length >= maximum) return false;
    this.times.push(now);
    return true;
  }
}

/** Compare fixed-length digests so submitted key length does not affect comparison timing. */
function authorized(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith('Bearer ') || !expected || expected.length < 24) return false;
  const actualDigest = createHash('sha256').update(header.slice(7)).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

/** Send JSON without permitting a browser or intermediary to cache private responses. */
function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

/** Collect a bounded JSON body with a deadline, preserving a useful error for the client. */
function readJson(request: IncomingMessage): Promise<unknown> {
  const contentLength = Number(request.headers['content-length'] ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    request.resume();
    return Promise.reject(new RequestError(413, 'body_too_large', 'This request is too large. Shorten your idea or project context.'));
  }
  // Event handlers share one finish path so timeout, abort, and completion cannot settle twice.
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const timer = setTimeout(onTimeout, 10_000);
    timer.unref();

    /** Remove body listeners and release the timer after either success or failure. */
    function cleanup(): void {
      clearTimeout(timer);
      request.removeListener('data', onData);
      request.removeListener('end', onEnd);
      request.removeListener('aborted', onAbort);
      request.removeListener('error', onAbort);
    }

    /** Reject once and drain the remaining body without retaining it in memory. */
    function fail(error: RequestError): void {
      if (settled) return;
      settled = true;
      cleanup();
      request.resume();
      reject(error);
    }

    /** Count bytes before retaining a chunk so oversized uploads cannot grow memory. */
    function onData(chunk: Buffer): void {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) fail(new RequestError(413, 'body_too_large', 'This request is too large. Shorten your idea or project context.'));
      else chunks.push(chunk);
    }

    /** Decode JSON only after the complete bounded body has arrived. */
    function onEnd(): void {
      if (settled) return;
      settled = true;
      cleanup();
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new RequestError(400, 'invalid_json', 'Send a valid JSON request.')); }
    }

    /** Stop reading when the browser disconnects or the request stream fails. */
    function onAbort(): void {
      fail(new RequestError(400, 'request_interrupted', 'The request was interrupted.'));
    }

    /** Bound slow uploads independently from the longer provider generation timeout. */
    function onTimeout(): void {
      fail(new RequestError(408, 'request_timeout', 'The request took too long to arrive. Please try again.'));
    }

    request.on('data', onData);
    request.on('end', onEnd);
    request.on('aborted', onAbort);
    request.on('error', onAbort);
  });
}

/** Create an isolated, testable API server with private generation and explicit CORS. */
export function createPromptServer(config: ApiConfig, options: ServerOptions = {}): Server {
  const clock = options.now ?? Date.now;
  const attempts = new RequestWindow();
  const minuteRequests = new RequestWindow();
  const hourlyRequests = new RequestWindow();
  const minuteLimit = options.limits?.perMinute ?? 6;
  const hourLimit = options.limits?.perHour ?? 60;
  const concurrentLimit = options.limits?.concurrent ?? 2;
  let activeRequests = 0;
  // Dependency injection lets integration tests exercise HTTP without spending API credits.
  const generate = options.generate ?? ((request: GenerationRequest, signal: AbortSignal) => generatePrompt(request, { apiKey: config.apiKey }, signal));

  /** Apply common headers and dispatch only the small public API surface. */
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Vary', 'Origin');
    const origin = request.headers.origin;
    if (origin) {
      if (!config.allowedOrigins.includes(origin)) throw new RequestError(403, 'origin_not_allowed', 'This site cannot use the prompt service.');
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Expose-Headers', 'Retry-After');
    }
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, { status: 'ok', configured: Boolean(config.apiKey && config.accessKey.length >= 24) });
      return;
    }
    if (pathname !== '/api/generate') throw new RequestError(404, 'not_found', 'This API route does not exist.');
    if (request.method === 'OPTIONS') {
      if (!origin || request.headers['access-control-request-method'] !== 'POST') throw new RequestError(403, 'invalid_preflight', 'This request is not allowed.');
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' });
      response.end();
      return;
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST, OPTIONS');
      throw new RequestError(405, 'method_not_allowed', 'Use POST to generate a prompt.');
    }
    if (!attempts.take(clock(), MINUTE, 120)) {
      response.setHeader('Retry-After', '60');
      throw new RequestError(429, 'too_many_requests', 'Too many requests. Try again in a minute.');
    }
    if (!config.apiKey || config.accessKey.length < 24) throw new RequestError(503, 'not_configured', 'AI generation is waiting for its server setup. You can still edit and save prompts.');
    if (!authorized(request.headers.authorization, config.accessKey)) throw new RequestError(401, 'unauthorized', 'Enter your workbench access key to generate prompts.');
    if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'unsupported_media_type', 'Send this request as JSON.');
    const input = parseGenerationRequest(await readJson(request));
    if (activeRequests >= concurrentLimit) {
      response.setHeader('Retry-After', '10');
      throw new RequestError(429, 'generation_busy', 'Another prompt is still being built. Try again shortly.');
    }
    if (!minuteRequests.take(clock(), MINUTE, minuteLimit)) {
      response.setHeader('Retry-After', '60');
      throw new RequestError(429, 'rate_limited', 'You have reached the short-term generation limit. Try again in a minute.');
    }
    if (!hourlyRequests.take(clock(), 60 * MINUTE, hourLimit)) {
      response.setHeader('Retry-After', '3600');
      throw new RequestError(429, 'rate_limited', 'You have reached the hourly generation limit. Try again later.');
    }
    const controller = new AbortController();

    /** Cancel upstream generation if the browser closes before a response is sent. */
    function onDisconnect(): void {
      if (!response.writableEnded) controller.abort();
    }

    response.once('close', onDisconnect);
    activeRequests += 1;
    try { sendJson(response, 200, await generate(input, controller.signal)); }
    finally {
      activeRequests -= 1;
      response.removeListener('close', onDisconnect);
    }
  }

  /** Translate failures into curated responses, never logging prompts or upstream secrets. */
  function onRequest(request: IncomingMessage, response: ServerResponse): void {
    // All asynchronous routes terminate here, avoiding unhandled promise rejections.
    void handle(request, response).catch(error => {
      if (error instanceof ValidationError) sendJson(response, 400, { error: { code: 'invalid_request', message: error.message } });
      else if (error instanceof RequestError || error instanceof GenerationError) sendJson(response, error.status, { error: { code: error.code, message: error.message } });
      else sendJson(response, 500, { error: { code: 'internal_error', message: 'The prompt service could not complete the request.' } });
    });
  }

  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 15000, headersTimeout: 10000, keepAliveTimeout: 5000 }, onRequest);
  server.maxRequestsPerSocket = 100;
  return server;
}
