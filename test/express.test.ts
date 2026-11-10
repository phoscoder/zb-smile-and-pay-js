import { describe, expect, it } from 'vitest';
import { innbucksDeepLink, SmileAndPayApiError } from '../src/index.js';
import { baseRequest, json, mockClient, SANDBOX } from './helpers.js';

const ok = (extra: Record<string, unknown> = {}) =>
  json({ responseMessage: 'Awaiting Payment', responseCode: '00', status: 'AWAITING_PAYMENT', transactionReference: 'TX1', ...extra });

describe('express checkout', () => {
  it.each([
    ['ecocash', '/payments/express-checkout/ecocash', { ecocashMobile: '0771234567' }],
    ['oneMoney', '/payments/express-checkout/onemoney', { oneMoneyMobile: '0713456789' }],
    ['smileCash', '/payments/express-checkout/zb-payment', { zbWalletMobile: '0711111111' }],
    ['omari', '/payments/express-checkout/omari', { omariMobile: '0731234567' }],
    ['innbucks', '/payments/express-checkout/innbucks', {}],
  ] as const)('%s posts to %s', async (method, path, extra) => {
    const { client, calls } = mockClient([ok()]);
    const result = await (client.express[method] as (r: unknown) => Promise<unknown>)({ ...baseRequest, ...extra });
    expect(result).toMatchObject({ responseCode: '00', transactionReference: 'TX1' });
    expect(calls[0]!.url).toBe(`${SANDBOX}${path}`);
    expect(calls[0]!.body).toEqual({ ...baseRequest, ...extra });
  });

  it('returns the Innbucks payment code', async () => {
    const { client } = mockClient([ok({ innbucksPaymentCode: '851204578' })]);
    const result = await client.express.innbucks(baseRequest);
    expect(result.innbucksPaymentCode).toBe('851204578');
    expect(innbucksDeepLink(result.innbucksPaymentCode)).toBe(
      'schinn.wbpycode://innbucks.co.zw?pymInnCode=851204578',
    );
  });

  it('confirms SmileCash and Omari OTPs', async () => {
    const { client, calls } = mockClient([ok({ status: 'COMPLETED' }), ok({ status: 'COMPLETED' })]);
    await client.express.confirmSmileCash({ transactionReference: 'TX1', otp: '000000' });
    await client.express.confirmOmari({ transactionReference: 'TX2', otp: '000000', omariMobile: '0731234567' });
    expect(calls[0]!.url).toBe(`${SANDBOX}/payments/express-checkout/zb-payment/confirmation`);
    expect(calls[0]!.body).toEqual({ transactionReference: 'TX1', otp: '000000' });
    expect(calls[1]!.url).toBe(`${SANDBOX}/payments/express-checkout/omari/confirmation`);
    expect(calls[1]!.body).toEqual({ transactionReference: 'TX2', otp: '000000', omariMobile: '0731234567' });
  });

  it('defaults eWallet paymentMethod to WALLETPLUS', async () => {
    const { client, calls } = mockClient([ok(), ok()]);
    await client.express.eWallet({ ...baseRequest, ewalletMobile: '263772929399' });
    await client.express.eWallet({ ...baseRequest, ewalletMobile: '263772929399', paymentMethod: 'EWALLET' });
    expect(calls[0]!.url).toBe(`${SANDBOX}/payments/express-checkout/ewallet`);
    expect(calls[0]!.body).toMatchObject({ paymentMethod: 'WALLETPLUS' });
    expect(calls[1]!.body).toMatchObject({ paymentMethod: 'EWALLET' });
  });

  it('defaults card paymentMethod to CARD and returns 3DS data', async () => {
    const { client, calls } = mockClient([
      ok({ status: 'PENDING_3DS', redirectHtml: '<form></form><script>go()</script>', gatewayRecommendation: 'PROCEED' }),
    ]);
    const result = await client.express.card({
      ...baseRequest,
      returnUrl: 'https://example.com/return',
      pan: '5123450000000008',
      expMonth: '01',
      expYear: '39',
      securityCode: '100',
    });
    expect(calls[0]!.url).toBe(`${SANDBOX}/payments/express-checkout/mpgs`);
    expect(calls[0]!.body).toMatchObject({ paymentMethod: 'CARD', pan: '5123450000000008' });
    expect(result.redirectHtml).toContain('<script>');
  });

  it('throws on a failed charge reported with HTTP 200', async () => {
    const { client } = mockClient([
      json({ responseMessage: 'Failed to charge OneMoney account', responseCode: '99', status: 'FAILED', transactionReference: null }),
    ]);
    const error = await client.express.oneMoney({ ...baseRequest, oneMoneyMobile: '0713456780' }).catch((e) => e);
    expect(error).toBeInstanceOf(SmileAndPayApiError);
    expect(error.message).toBe('Failed to charge OneMoney account');
    expect(error.body.status).toBe('FAILED');
  });
});
