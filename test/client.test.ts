import { describe, expect, it } from 'vitest';
import {
  SmileAndPay,
  SmileAndPayApiError,
  SmileAndPayAuthenticationError,
  SmileAndPayConnectionError,
  SmileAndPayError,
  SmileAndPayTimeoutError,
} from '../src/index.js';
import { json, mockClient, SANDBOX, statusBody, text } from './helpers.js';

describe('SmileAndPay client', () => {
  it('requires credentials', () => {
    expect(() => new SmileAndPay({ apiKey: '', apiSecret: 's' })).toThrow(SmileAndPayError);
    expect(() => new SmileAndPay({ apiKey: 'k', apiSecret: '' })).toThrow(/apiSecret/);
  });

  it('rejects unknown environments', () => {
    expect(() => new SmileAndPay({ apiKey: 'k', apiSecret: 's', environment: 'staging' as never })).toThrow(
      /Unknown environment/,
    );
  });

  it('defaults to sandbox and sends both auth headers', async () => {
    const { client, calls } = mockClient([json(statusBody('PENDING'))]);
    expect(client.environment).toBe('sandbox');
    await client.payments.checkStatus('ORDER-1');
    expect(calls[0]!.url).toBe(`${SANDBOX}/payments/transaction/ORDER-1/status/check`);
    expect(calls[0]!.headers['x-api-key']).toBe('test-key');
    expect(calls[0]!.headers['x-api-secret']).toBe('test-secret');
    expect(calls[0]!.headers['Content-Type']).toBeUndefined();
  });

  it('uses the production URL', async () => {
    const { client, calls } = mockClient([json(statusBody('PENDING'))], { environment: 'production' });
    await client.payments.checkStatus('ORDER-1');
    expect(calls[0]!.url).toBe(
      'https://zbnet.zb.co.zw/wallet_gateway/payments-gateway/payments/transaction/ORDER-1/status/check',
    );
  });

  it('honours a custom base URL and extra headers', async () => {
    const { client, calls } = mockClient([json(statusBody('PENDING'))], {
      baseUrl: 'https://proxy.local/gw/',
      headers: { 'x-trace': 'abc' },
    });
    await client.payments.checkStatus('ORDER-1');
    expect(calls[0]!.url).toBe('https://proxy.local/gw/payments/transaction/ORDER-1/status/check');
    expect(calls[0]!.headers['x-trace']).toBe('abc');
  });
});

describe('HTTP error handling', () => {
  it('maps a plain-text 401 to an authentication error', async () => {
    const { client } = mockClient([text('Unauthorized. Api Secret Error', 401)]);
    const error = await client.payments.checkStatus('ORDER-1').catch((e) => e);
    expect(error).toBeInstanceOf(SmileAndPayAuthenticationError);
    expect(error.status).toBe(401);
    expect(error.message).toBe('Unauthorized. Api Secret Error');
  });

  it('maps a JSON 409 to an API error with its message', async () => {
    const body = { message: 'Transaction not found', status: 'CONFLICT', timestamp: '10 11 2026 10:53' };
    const { client } = mockClient([json(body, 409)]);
    const error = await client.payments.checkStatus('missing').catch((e) => e);
    expect(error).toBeInstanceOf(SmileAndPayApiError);
    expect(error).not.toBeInstanceOf(SmileAndPayAuthenticationError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Transaction not found');
    expect(error.body).toEqual(body);
  });

  it('wraps network failures', async () => {
    const { client } = mockClient(() => {
      throw new TypeError('fetch failed');
    });
    const error = await client.payments.checkStatus('ORDER-1').catch((e) => e);
    expect(error).toBeInstanceOf(SmileAndPayConnectionError);
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('times out slow requests', async () => {
    const { client } = mockClient(
      (call) =>
        new Promise<Response>((_, reject) => {
          // Simulate fetch honouring the abort signal.
          setTimeout(() => reject(new DOMException('aborted', 'AbortError')), 50);
          void call;
        }),
      { timeoutMs: 10 },
    );
    await expect(client.payments.checkStatus('ORDER-1')).rejects.toBeInstanceOf(SmileAndPayTimeoutError);
  });

  it('rejects empty path parameters', async () => {
    const { client, fetch } = mockClient([]);
    await expect(client.payments.checkStatus('  ')).rejects.toThrow(TypeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('URL-encodes path parameters', async () => {
    const { client, calls } = mockClient([json(statusBody('PENDING'))]);
    await client.payments.checkStatus('ORDER/1 2');
    expect(calls[0]!.url).toContain('/payments/transaction/ORDER%2F1%202/status/check');
  });
});
