import { describe, expectTypeOf, it } from 'vitest';
import type {
  EWalletCallback,
  InitializeSmileAndPay,
  InitiatePayment,
  InitiatePaymentResponse,
  InitiateTransactionRequest,
  InitiateTransactionResponse,
  PaymentCallback,
  SmileAndPayOptions,
  SmileAndPayWebhookBody,
} from '../src/index.js';
import { parseWebhook, SmileAndPay } from '../src/index.js';

describe('public type aliases', () => {
  it('InitializeSmileAndPay is the client options type', () => {
    expectTypeOf<InitializeSmileAndPay>().toEqualTypeOf<SmileAndPayOptions>();
    expectTypeOf<ConstructorParameters<typeof SmileAndPay>[0]>().toEqualTypeOf<InitializeSmileAndPay>();
  });

  it('InitiatePayment is the payments.initiate request and response', () => {
    expectTypeOf<InitiatePayment>().toEqualTypeOf<InitiateTransactionRequest>();
    expectTypeOf<InitiatePaymentResponse>().toEqualTypeOf<InitiateTransactionResponse>();
    expectTypeOf<SmileAndPay['payments']['initiate']>().parameter(0).toEqualTypeOf<InitiatePayment>();
  });

  it('SmileAndPayWebhookBody covers both callback shapes', () => {
    expectTypeOf<PaymentCallback>().toExtend<SmileAndPayWebhookBody>();
    expectTypeOf<EWalletCallback>().toExtend<SmileAndPayWebhookBody>();
    expectTypeOf<SmileAndPayWebhookBody>().toExtend<Parameters<typeof parseWebhook>[0]>();
  });
});
