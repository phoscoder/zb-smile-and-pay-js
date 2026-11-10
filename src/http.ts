import {
  SmileAndPayApiError,
  SmileAndPayAuthenticationError,
  SmileAndPayConnectionError,
  SmileAndPayTimeoutError,
} from './errors.js';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpClientOptions {
  apiKey: string;
  /** Omitted for wallet-service calls, which only take `x-api-key`. */
  apiSecret?: string;
  baseUrl: string;
  timeoutMs: number;
  fetch: FetchLike;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  /** Per-request timeout override. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

const USER_AGENT = 'zb-smileandpay-node/0.1.0';

/** Minimal JSON-over-fetch transport with Smile&Pay auth headers. */
export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  async request<T>(req: RequestOptions): Promise<T> {
    const { apiKey, apiSecret, baseUrl, fetch, headers: extraHeaders } = this.options;
    const url = `${baseUrl.replace(/\/+$/, '')}${req.path}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...extraHeaders,
      'x-api-key': apiKey,
    };
    if (apiSecret !== undefined) headers['x-api-secret'] = apiSecret;
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';

    const timeoutMs = req.timeoutMs ?? this.options.timeoutMs;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = req.signal ? AbortSignal.any([req.signal, timeoutSignal]) : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(url, {
        method: req.method,
        headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal,
      });
    } catch (error) {
      if (timeoutSignal.aborted) {
        throw new SmileAndPayTimeoutError(`Request to ${req.path} timed out after ${timeoutMs}ms`, {
          cause: error,
        });
      }
      if (req.signal?.aborted) throw error;
      throw new SmileAndPayConnectionError(`Request to ${req.path} failed: ${errorMessage(error)}`, {
        cause: error,
      });
    }

    const body = await parseBody(response);

    if (!response.ok) {
      const message = extractMessage(body) ?? `HTTP ${response.status} ${response.statusText}`.trim();
      const responseCode = extractResponseCode(body);
      const init = { status: response.status, responseCode, body };
      if (response.status === 401 || response.status === 403) {
        throw new SmileAndPayAuthenticationError(message, init);
      }
      throw new SmileAndPayApiError(message, init);
    }

    return body as T;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // e.g. 401 returns plain text: "Unauthorized. Api Secret Error"
    return text;
  }
}

function extractMessage(body: unknown): string | undefined {
  if (typeof body === 'string') return body.trim() || undefined;
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['responseMessage', 'message', 'description', 'error']) {
      const value = record[key];
      if (typeof value === 'string' && value) return value;
    }
  }
  return undefined;
}

function extractResponseCode(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const code = (body as Record<string, unknown>).responseCode;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { extractMessage };
