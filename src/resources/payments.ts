import { FINAL_STATUSES, SUCCESSFUL_STATUSES } from '../constants.js';
import { SmileAndPayApiError, SmileAndPayTimeoutError } from '../errors.js';
import type { HttpClient } from '../http.js';
import type {
  CancelPaymentResponse,
  InitiateTransactionRequest,
  InitiateTransactionResponse,
  TransactionStatusResponse,
} from '../types.js';
import { assertGatewaySuccess, buildBody, encodePathSegment, sleep, type CallOptions } from './shared.js';

export interface WaitForCompletionOptions extends CallOptions {
  /** Delay between status checks. Default: 5000ms. */
  intervalMs?: number;
  /** Give up after this long. Default: 300000ms (5 minutes). */
  maxWaitMs?: number;
  /** Called after every status check. */
  onPoll?: (status: TransactionStatusResponse) => void;
}

/** Standard (hosted) checkout plus the status and cancel utilities. */
export class Payments {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a hosted checkout session. Redirect the customer to the
   * returned `paymentUrl`.
   *
   * `POST /payments/initiate-transaction`
   */
  async initiate(
    request: InitiateTransactionRequest,
    options: CallOptions = {},
  ): Promise<InitiateTransactionResponse> {
    const body = await this.http.request<InitiateTransactionResponse>({
      method: 'POST',
      path: '/payments/initiate-transaction',
      body: buildBody(request),
      ...options,
    });
    return assertGatewaySuccess(body);
  }

  /**
   * Look up a transaction by your `orderReference`. Works for standard
   * and express checkouts.
   *
   * `GET /payments/transaction/{orderReference}/status/check`
   */
  async checkStatus(orderReference: string, options: CallOptions = {}): Promise<TransactionStatusResponse> {
    const ref = encodePathSegment(orderReference, 'orderReference');
    return this.http.request<TransactionStatusResponse>({
      method: 'GET',
      path: `/payments/transaction/${ref}/status/check`,
      ...options,
    });
  }

  /**
   * Cancel a pending transaction by your `orderReference`.
   * Throws {@link SmileAndPayApiError} when the gateway refuses
   * (for example, the payment does not exist).
   *
   * `POST /payments/cancel/{orderReference}`
   */
  async cancel(orderReference: string, options: CallOptions = {}): Promise<CancelPaymentResponse> {
    const ref = encodePathSegment(orderReference, 'orderReference');
    const body = await this.http.request<CancelPaymentResponse>({
      method: 'POST',
      path: `/payments/cancel/${ref}`,
      ...options,
    });
    if (!body || body.success !== true) {
      throw new SmileAndPayApiError(body?.description || 'Payment could not be cancelled', {
        status: 200,
        body,
      });
    }
    return body;
  }

  /**
   * Poll {@link checkStatus} until the transaction reaches a final status
   * (paid, failed or cancelled) and return it. Throws
   * {@link SmileAndPayTimeoutError} if `maxWaitMs` passes first.
   *
   * Use this for flows the docs say to poll, such as eWallet. Webhooks
   * remain the primary signal.
   */
  async waitForCompletion(
    orderReference: string,
    options: WaitForCompletionOptions = {},
  ): Promise<TransactionStatusResponse> {
    const { intervalMs = 5_000, maxWaitMs = 300_000, onPoll, ...callOptions } = options;
    const deadline = Date.now() + maxWaitMs;

    for (;;) {
      const status = await this.checkStatus(orderReference, callOptions);
      onPoll?.(status);
      if (isFinalStatus(status.status)) return status;
      if (Date.now() + intervalMs > deadline) {
        throw new SmileAndPayTimeoutError(
          `Transaction ${orderReference} still ${status.status} after ${maxWaitMs}ms`,
        );
      }
      await sleep(intervalMs, callOptions.signal);
    }
  }
}

/** `true` when the status means the customer has paid. */
export function isSuccessfulStatus(status: string | null | undefined): boolean {
  return !!status && SUCCESSFUL_STATUSES.includes(status.toUpperCase());
}

/** `true` when the status will not change again. */
export function isFinalStatus(status: string | null | undefined): boolean {
  return !!status && FINAL_STATUSES.includes(status.toUpperCase());
}
