import { vi } from 'vitest';
import { SmileAndPay, type SmileAndPayOptions } from '../src/index.js';

export interface MockCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = (call: MockCall) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function text(body: string, status: number): Response {
  return new Response(body, { status });
}

/** A client whose fetch calls `respond` (or a queue of responses) and records each call. */
export function mockClient(respond: Responder | Response[], options: Partial<SmileAndPayOptions> = {}) {
  const calls: MockCall[] = [];
  const queue = Array.isArray(respond) ? [...respond] : undefined;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const call: MockCall = {
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    if (queue) {
      const next = queue.shift();
      if (!next) throw new Error('No mock response left');
      return next;
    }
    return (respond as Responder)(call);
  });
  const client = new SmileAndPay({ apiKey: 'test-key', apiSecret: 'test-secret', fetch, ...options });
  return { client, calls, fetch };
}

export const SANDBOX = 'https://zbnet.zb.co.zw/wallet_sandbox_api/payments-gateway';

export const statusBody = (status: string, extra: Record<string, unknown> = {}) => ({
  merchantId: '20261110104625',
  reference: 'EAUK4372ADUL',
  orderReference: 'ORDER-1',
  itemName: 'Item',
  amount: 10.0,
  currency: 'USD',
  paymentOption: null,
  status,
  createdDate: '2026-11-10T10:53:06.857959',
  clientFee: 0,
  merchantFee: 0,
  failureDescription: null,
  ...extra,
});

export const baseRequest = {
  orderReference: 'ORDER-1',
  amount: 10,
  currencyCode: '840',
  itemName: 'Item',
  itemDescription: 'Item description',
  resultUrl: 'https://example.com/webhook',
} as const;
