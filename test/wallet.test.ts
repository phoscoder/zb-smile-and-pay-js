import { describe, expect, it } from 'vitest';
import { SmileAndPayAuthenticationError } from '../src/index.js';
import { json, mockClient } from './helpers.js';

const WALLET = 'https://zbnet.zb.co.zw/wallet_sandbox_api';
const cashout = {
  receiverMobile: '263772240291',
  senderPhone: '263782676047',
  amount: 2,
  currency: 'ZWG',
  narration: 'Payout',
} as const;

describe('wallet services', () => {
  it('sends only x-api-key and defaults channel to WEB', async () => {
    const { client, calls } = mockClient([json({ transactionId: 'c57fe63f' })]);
    await client.wallet.cashoutAuth(cashout);
    expect(calls[0]!.url).toBe(`${WALLET}/transactions/subscriber/external/cashout/auth`);
    expect(calls[0]!.headers['x-api-key']).toBe('test-key');
    expect(calls[0]!.headers['x-api-secret']).toBeUndefined();
    expect(calls[0]!.body).toEqual({ ...cashout, channel: 'WEB', transactionId: '' });
  });

  it('runs both cashout legs with the auth transactionId', async () => {
    const { client, calls } = mockClient([json({ transactionId: 'c57fe63f' }), json({ status: 'SUCCESS' })]);
    const result = await client.wallet.cashout(cashout);
    expect(result.payment).toEqual({ status: 'SUCCESS' });
    expect(calls[1]!.url).toBe(`${WALLET}/transactions/subscriber/external/cashout/payment`);
    expect(calls[1]!.body).toMatchObject({ transactionId: 'c57fe63f' });
  });

  it('refuses to run the payment leg without a transactionId', async () => {
    const { client, calls } = mockClient([json({ message: 'ok' })]);
    await expect(client.wallet.cashout(cashout)).rejects.toThrow(/transactionId/);
    expect(calls).toHaveLength(1);
    expect(() => client.wallet.cashoutPayment({ ...cashout, transactionId: '' })).toThrow(TypeError);
  });

  it('checks wallet transaction status', async () => {
    const { client, calls } = mockClient([json({ status: 'SUCCESS' })]);
    await client.wallet.checkStatus('Wf2a8bbfdec1446d');
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.url).toBe(`${WALLET}/transactions/api/v1/transaction/Wf2a8bbfdec1446d/check-status`);
  });

  it('supports separate wallet credentials and base URL', async () => {
    const { client, calls } = mockClient([json({})], {
      walletApiKey: 'wallet-key',
      walletBaseUrl: 'https://wallet.example',
    });
    await client.wallet.checkStatus('W1');
    expect(calls[0]!.url).toBe('https://wallet.example/transactions/api/v1/transaction/W1/check-status');
    expect(calls[0]!.headers['x-api-key']).toBe('wallet-key');
  });

  it('maps 403 to an authentication error', async () => {
    const { client } = mockClient([json({ status: 403, error: 'Forbidden', path: '/x' }, 403)]);
    await expect(client.wallet.checkStatus('W1')).rejects.toBeInstanceOf(SmileAndPayAuthenticationError);
  });
});
