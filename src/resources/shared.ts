import { RESPONSE_CODE_DESCRIPTIONS, ResponseCode } from '../constants.js';
import { SmileAndPayApiError, SmileAndPayAuthenticationError } from '../errors.js';
import type { GatewayResponse, SplitRule } from '../types.js';

/** Per-call options accepted by every SDK method. */
export interface CallOptions {
  /** Override the client timeout for this call. */
  timeoutMs?: number;
  /** Abort the request. */
  signal?: AbortSignal;
}

/**
 * The gateway returns HTTP 200 for most business failures and puts the
 * real result in `responseCode`. Throw for anything other than `00`/`01`.
 */
export function assertGatewaySuccess<T extends GatewayResponse>(body: T): T {
  const code = body?.responseCode;
  if (code === ResponseCode.SUCCESS || code === ResponseCode.PENDING) return body;

  const known = RESPONSE_CODE_DESCRIPTIONS[code as ResponseCode];
  const message = body?.responseMessage || known || 'Smile&Pay request failed';
  const init = { status: 200, responseCode: code, body };
  if (code === ResponseCode.INVALID_CREDENTIALS) {
    throw new SmileAndPayAuthenticationError(message, init);
  }
  throw new SmileAndPayApiError(message, init);
}

/** Convert numeric split share values to strings, as the API expects. */
export function normalizeSplitRules(
  rules: SplitRule | SplitRule[] | undefined,
): SplitRule | SplitRule[] | undefined {
  if (rules === undefined) return undefined;
  const fix = (r: SplitRule): SplitRule => ({ ...r, shareValue: String(r.shareValue) });
  return Array.isArray(rules) ? rules.map(fix) : fix(rules);
}

/** Copy a request body, normalising split rules and dropping undefined keys. */
export function buildBody<T extends { splitRules?: SplitRule | SplitRule[] }>(
  request: T,
  defaults: Record<string, unknown> = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(request)) {
    if (value !== undefined) body[key] = value;
  }
  const splitRules = normalizeSplitRules(request.splitRules);
  if (splitRules !== undefined) body.splitRules = splitRules;
  return body;
}

export function encodePathSegment(value: string, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return encodeURIComponent(value);
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
