import { describe, expectTypeOf, it } from 'vitest';
import type {
  CashoutAuthRequest,
  CashoutAuthResponse,
  CashoutPaymentRequest,
  CashoutPaymentResponse,
  CashoutRequest,
  CashoutResult,
  CashoutStatusResponse,
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

  it('wallet methods use the cashout types', () => {
    type Wallet = SmileAndPay['wallet'];
    expectTypeOf<Wallet['cashoutAuth']>().parameter(0).toEqualTypeOf<CashoutAuthRequest>();
    expectTypeOf<Wallet['cashoutAuth']>().returns.resolves.toEqualTypeOf<CashoutAuthResponse>();
    expectTypeOf<Wallet['cashoutPayment']>().parameter(0).toEqualTypeOf<CashoutPaymentRequest>();
    expectTypeOf<Wallet['cashoutPayment']>().returns.resolves.toEqualTypeOf<CashoutPaymentResponse>();
    expectTypeOf<Wallet['cashout']>().parameter(0).toEqualTypeOf<CashoutRequest>();
    expectTypeOf<Wallet['cashout']>().returns.resolves.toEqualTypeOf<CashoutResult>();
    expectTypeOf<Wallet['checkStatus']>().returns.resolves.toEqualTypeOf<CashoutStatusResponse>();
    expectTypeOf<CashoutPaymentRequest['transactionId']>().toEqualTypeOf<string>();
  });
});
