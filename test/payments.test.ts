import { describe, expect, it } from 'vitest';
import {
  isFinalStatus,
  isSuccessfulStatus,
  SmileAndPayApiError,
  SmileAndPayAuthenticationError,
  SmileAndPayTimeoutError,
} from '../src/index.js';
import { baseRequest, json, mockClient, SANDBOX, statusBody } from './helpers.js';

const initiateRequest = { ...baseRequest, returnUrl: 'https://example.com/return' };

describe('payments.initiate', () => {
  it('posts the request and returns the payment URL', async () => {
    const response = {
      responseMessage: 'Success',
      responseCode: '00',
      paymentUrl: 'https://zbnet.zb.co.zw/wallet_sandbox_checkout?reference=EAUK4372ADUL',
      transactionReference: 'EAUK4372ADUL',
    };
    const { client, calls } = mockClient([json(response)]);
    const result = await client.payments.initiate({ ...initiateRequest, email: undefined });
    expect(result).toEqual(response);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${SANDBOX}/payments/initiate-transaction`);
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
    expect(calls[0]!.body).toEqual(initiateRequest);
  });

  it('throws when the gateway reports failure with HTTP 200', async () => {
    const { client } = mockClient([
      json({ responseMessage: 'Suspected duplicate orderId', responseCode: '99', paymentUrl: null }),
    ]);
    const error = await client.payments.initiate(initiateRequest).catch((e) => e);
    expect(error).toBeInstanceOf(SmileAndPayApiError);
    expect(error.responseCode).toBe('99');
    expect(error.message).toBe('Suspected duplicate orderId');
  });

  it('maps responseCode 04 to an authentication error', async () => {
    const { client } = mockClient([json({ responseMessage: '', responseCode: '04' })]);
    const error = await client.payments.initiate(initiateRequest).catch((e) => e);
    expect(error).toBeInstanceOf(SmileAndPayAuthenticationError);
    expect(error.message).toBe('API key or secret is invalid');
  });

  it('stringifies split rule share values', async () => {
    const { client, calls } = mockClient([json({ responseMessage: 'Success', responseCode: '00' })]);
    await client.payments.initiate({
      ...initiateRequest,
      splitRules: [
        { settlementAccount: '263782676047', settlementAccountType: 'WALLET_ACCOUNT', shareType: 'PERCENTAGE', shareValue: 50 },
        { settlementAccount: 'ZB-REF', settlementAccountType: 'BANK_ACCOUNT', shareType: 'PERCENTAGE', shareValue: '50' },
      ],
    });
    const body = calls[0]!.body as { splitRules: Array<{ shareValue: unknown }> };
    expect(body.splitRules.map((r) => r.shareValue)).toEqual(['50', '50']);
  });
});

describe('payments.cancel', () => {
  it('returns the response on success', async () => {
    const body = { success: true, description: 'Payment cancelled', returnUrl: 'https://example.com/return' };
    const { client, calls } = mockClient([json(body)]);
    await expect(client.payments.cancel('ORDER-1')).resolves.toEqual(body);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${SANDBOX}/payments/cancel/ORDER-1`);
  });

  it('throws when success is false', async () => {
    const { client } = mockClient([json({ success: false, description: 'Payment does not exist', returnUrl: null })]);
    await expect(client.payments.cancel('nope')).rejects.toThrow('Payment does not exist');
  });
});

describe('payments.waitForCompletion', () => {
  it('polls until a final status', async () => {
    const { client, calls } = mockClient([
      json(statusBody('PENDING')),
      json(statusBody('AWAITING_PAYMENT')),
      json(statusBody('PAID')),
    ]);
    const seen: string[] = [];
    const result = await client.payments.waitForCompletion('ORDER-1', {
      intervalMs: 1,
      onPoll: (s) => seen.push(s.status),
    });
    expect(result.status).toBe('PAID');
    expect(seen).toEqual(['PENDING', 'AWAITING_PAYMENT', 'PAID']);
    expect(calls).toHaveLength(3);
  });

  it('times out when the status never settles', async () => {
    const { client } = mockClient(() => json(statusBody('PENDING')));
    await expect(
      client.payments.waitForCompletion('ORDER-1', { intervalMs: 5, maxWaitMs: 20 }),
    ).rejects.toBeInstanceOf(SmileAndPayTimeoutError);
  });

  it('stops when aborted', async () => {
    const { client } = mockClient(() => json(statusBody('PENDING')));
    const controller = new AbortController();
    const promise = client.payments.waitForCompletion('ORDER-1', { intervalMs: 1_000, signal: controller.signal });
    setTimeout(() => controller.abort(new Error('stop')), 10);
    await expect(promise).rejects.toThrow('stop');
  });
});

describe('status helpers', () => {
  it('classifies statuses', () => {
    expect(isSuccessfulStatus('PAID')).toBe(true);
    expect(isSuccessfulStatus('completed')).toBe(true);
    expect(isSuccessfulStatus('PENDING')).toBe(false);
    expect(isSuccessfulStatus(null)).toBe(false);
    expect(isFinalStatus('CANCELLED')).toBe(true);
    expect(isFinalStatus('FAILED')).toBe(true);
    expect(isFinalStatus('AWAITING_PAYMENT')).toBe(false);
  });
});
