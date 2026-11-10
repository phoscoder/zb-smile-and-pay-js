import { describe, expect, it } from 'vitest';
import { parseWebhook, SmileAndPayWebhookError } from '../src/index.js';
import { json, mockClient, statusBody } from './helpers.js';

const paymentCallback = {
  merchantId: 'MERCHANT123',
  reference: 'EAUK4372ADUL',
  orderReference: 'ORDER-1',
  itemName: 'Item',
  amount: 10.0,
  currency: 'USD',
  currencyCode: '840',
  paymentOption: 'ECOCASH',
  status: 'PAID',
  createdDate: '2026-01-06T10:30:00Z',
};

const ewalletCallback = {
  merchantId: 'MERCHANT123',
  messageType: 'pain.002.001.10',
  messageId: 'MSG-001',
  creationDateTime: '2026-05-26T10:30:00Z',
  originalGroupInfoAndStatus: { originalMessageId: 'ORDER-1', originalControlSum: 10.0, groupStatus: 'ACCP' },
  originalPaymentInfoAndStatusList: [
    {
      originalPaymentInformationId: 'PAY-INFO-1',
      transactionInfoAndStatusList: [
        {
          originalInstructionId: 'ORDER-1',
          originalEndToEndId: 'ORDER-1',
          transactionStatus: 'ACSP',
          accountServicerReference: 'BANK-REF-789',
        },
      ],
    },
  ],
};

describe('parseWebhook', () => {
  it('parses a payment callback from a JSON string', () => {
    const event = parseWebhook(JSON.stringify(paymentCallback));
    expect(event).toMatchObject({ type: 'payment', orderReference: 'ORDER-1', status: 'PAID', paid: true, final: true, amount: 10 });
  });

  it('parses a payment callback from bytes', () => {
    const event = parseWebhook(new TextEncoder().encode(JSON.stringify({ ...paymentCallback, status: 'PENDING' })));
    expect(event).toMatchObject({ paid: false, final: false });
  });

  it('parses an ISO 20022 eWallet callback', () => {
    const event = parseWebhook(ewalletCallback);
    expect(event).toMatchObject({
      type: 'ewallet',
      orderReference: 'ORDER-1',
      reference: 'BANK-REF-789',
      status: 'ACSP',
      paid: true,
      amount: 10,
    });
  });

  it('marks rejected eWallet payments as final and unpaid', () => {
    const rejected = structuredClone(ewalletCallback);
    rejected.originalPaymentInfoAndStatusList[0]!.transactionInfoAndStatusList[0]!.transactionStatus = 'RJCT';
    expect(parseWebhook(rejected)).toMatchObject({ paid: false, final: true });
  });

  it('rejects invalid payloads', () => {
    expect(() => parseWebhook('not json')).toThrow(SmileAndPayWebhookError);
    expect(() => parseWebhook('[]')).toThrow(SmileAndPayWebhookError);
    expect(() => parseWebhook({ hello: 'world' })).toThrow(/Unrecognised/);
  });
});

describe('webhooks.verify', () => {
  it('confirms a callback against the status API', async () => {
    const { client, calls } = mockClient([json(statusBody('PAID'))]);
    const result = await client.webhooks.verify(paymentCallback, { expectedAmount: 10 });
    expect(result.paid).toBe(true);
    expect(result.transaction.status).toBe('PAID');
    expect(calls[0]!.url).toContain('/payments/transaction/ORDER-1/status/check');
  });

  it('trusts the API status over the callback status', async () => {
    const { client } = mockClient([json(statusBody('PENDING'))]);
    const result = await client.webhooks.verify(paymentCallback);
    expect(result.event.paid).toBe(true);
    expect(result.paid).toBe(false);
  });

  it('throws on amount mismatches', async () => {
    const { client } = mockClient([json(statusBody('PAID', { amount: 1 }))]);
    await expect(client.webhooks.verify(paymentCallback)).rejects.toThrow(/amount/);
  });

  it('throws when the expected amount differs', async () => {
    const { client } = mockClient([json(statusBody('PAID'))]);
    await expect(client.webhooks.verify(paymentCallback, { expectedAmount: 99 })).rejects.toThrow(/expected/);
  });

  it('throws on reference mismatches', async () => {
    const { client } = mockClient([json(statusBody('PAID', { reference: 'OTHER' }))]);
    await expect(client.webhooks.verify(paymentCallback)).rejects.toThrow(/reference/);
  });

  it('verifies eWallet callbacks by order reference', async () => {
    const { client } = mockClient([json(statusBody('PAID'))]);
    await expect(client.webhooks.verify(ewalletCallback)).resolves.toMatchObject({ paid: true });
  });
});
