import type { HttpClient } from '../http.js';
import type { CashoutPaymentRequest, CashoutRequest, WalletResponse } from '../types.js';
import { encodePathSegment, type CallOptions } from './shared.js';

/**
 * Wallet Services: outbound transfers (disbursements) into a subscriber's
 * SmileCash wallet. These talk to the core ledger, not the Payments
 * Gateway, and authenticate with `x-api-key` only.
 *
 * Cashout has two legs:
 * 1. {@link cashoutAuth} locks the funds and returns a `transactionId`.
 * 2. {@link cashoutPayment} moves the funds using that `transactionId`.
 *
 * Your merchant account may need Wallet Services enabled by ZB first.
 */
export class Wallet {
  constructor(private readonly http: HttpClient) {}

  /** Leg 1. `POST /transactions/subscriber/external/cashout/auth` */
  cashoutAuth(request: CashoutRequest, options: CallOptions = {}): Promise<WalletResponse> {
    return this.http.request<WalletResponse>({
      method: 'POST',
      path: '/transactions/subscriber/external/cashout/auth',
      body: { channel: 'WEB', ...request, transactionId: '' },
      ...options,
    });
  }

  /** Leg 2. `POST /transactions/subscriber/external/cashout/payment` */
  cashoutPayment(request: CashoutPaymentRequest, options: CallOptions = {}): Promise<WalletResponse> {
    if (!request.transactionId) {
      throw new TypeError('transactionId from cashoutAuth is required');
    }
    return this.http.request<WalletResponse>({
      method: 'POST',
      path: '/transactions/subscriber/external/cashout/payment',
      body: { channel: 'WEB', ...request },
      ...options,
    });
  }

  /**
   * Run both legs. Throws if the auth leg returns no `transactionId`.
   * Use the two methods separately if you need a confirmation step
   * between them.
   */
  async cashout(
    request: CashoutRequest,
    options: CallOptions = {},
  ): Promise<{ auth: WalletResponse; payment: WalletResponse }> {
    const auth = await this.cashoutAuth(request, options);
    const transactionId = auth.transactionId;
    if (typeof transactionId !== 'string' || !transactionId) {
      throw new TypeError('cashoutAuth response did not include a transactionId');
    }
    const payment = await this.cashoutPayment({ ...request, transactionId }, options);
    return { auth, payment };
  }

  /**
   * Status of an outbound wallet transaction. For inbound customer
   * payments use `payments.checkStatus` instead.
   *
   * `GET /transactions/api/v1/transaction/{transactionReference}/check-status`
   */
  checkStatus(transactionReference: string, options: CallOptions = {}): Promise<WalletResponse> {
    const ref = encodePathSegment(transactionReference, 'transactionReference');
    return this.http.request<WalletResponse>({
      method: 'GET',
      path: `/transactions/api/v1/transaction/${ref}/check-status`,
      ...options,
    });
  }
}
