import { PaymentMethod } from '../constants.js';
import type { HttpClient } from '../http.js';
import type {
  CardPaymentRequest,
  CardPaymentResponse,
  EcocashPaymentRequest,
  EWalletPaymentRequest,
  ExpressCheckoutResponse,
  InnbucksPaymentRequest,
  InnbucksPaymentResponse,
  OmariConfirmRequest,
  OmariPaymentRequest,
  OneMoneyPaymentRequest,
  SmileCashConfirmRequest,
  SmileCashPaymentRequest,
} from '../types.js';
import { assertGatewaySuccess, buildBody, type CallOptions } from './shared.js';

/**
 * Express checkout: charge the customer from your own UI, without the
 * hosted payment page.
 *
 * - Single-step (customer approves on their device): {@link ecocash},
 *   {@link oneMoney}, {@link innbucks}, {@link eWallet}
 * - Two-step OTP: {@link smileCash} then {@link confirmSmileCash};
 *   {@link omari} then {@link confirmOmari}
 * - Card with 3DS: {@link card}
 *
 * Every method throws `SmileAndPayApiError` if `responseCode` is not
 * `00`/`01`. The final result arrives on your `resultUrl` webhook.
 */
export class ExpressCheckout {
  constructor(private readonly http: HttpClient) {}

  private async post<T extends ExpressCheckoutResponse>(
    path: string,
    body: Record<string, unknown>,
    options: CallOptions,
  ): Promise<T> {
    const response = await this.http.request<T>({ method: 'POST', path, body, ...options });
    return assertGatewaySuccess(response);
  }

  /** EcoCash USSD push. `POST /payments/express-checkout/ecocash` */
  ecocash(request: EcocashPaymentRequest, options: CallOptions = {}): Promise<ExpressCheckoutResponse> {
    return this.post('/payments/express-checkout/ecocash', buildBody(request), options);
  }

  /**
   * InnBucks payment code. Show `innbucksPaymentCode` to the customer, or
   * link to it with {@link innbucksDeepLink}.
   *
   * `POST /payments/express-checkout/innbucks`
   */
  innbucks(request: InnbucksPaymentRequest, options: CallOptions = {}): Promise<InnbucksPaymentResponse> {
    return this.post('/payments/express-checkout/innbucks', buildBody(request), options);
  }

  /**
   * SmileCash (ZB wallet) leg 1. Sends an OTP by SMS. Keep the returned
   * `transactionReference` for {@link confirmSmileCash}.
   *
   * `POST /payments/express-checkout/zb-payment`
   */
  smileCash(request: SmileCashPaymentRequest, options: CallOptions = {}): Promise<ExpressCheckoutResponse> {
    return this.post('/payments/express-checkout/zb-payment', buildBody(request), options);
  }

  /**
   * SmileCash leg 2. Submits the customer's OTP.
   *
   * `POST /payments/express-checkout/zb-payment/confirmation`
   */
  confirmSmileCash(
    request: SmileCashConfirmRequest,
    options: CallOptions = {},
  ): Promise<ExpressCheckoutResponse> {
    return this.post('/payments/express-checkout/zb-payment/confirmation', { ...request }, options);
  }

  /**
   * Omari leg 1. Sends an OTP by SMS. Keep the returned
   * `transactionReference` for {@link confirmOmari}.
   *
   * `POST /payments/express-checkout/omari`
   */
  omari(request: OmariPaymentRequest, options: CallOptions = {}): Promise<ExpressCheckoutResponse> {
    return this.post('/payments/express-checkout/omari', buildBody(request), options);
  }

  /**
   * Omari leg 2. Submits the customer's OTP.
   *
   * `POST /payments/express-checkout/omari/confirmation`
   */
  confirmOmari(request: OmariConfirmRequest, options: CallOptions = {}): Promise<ExpressCheckoutResponse> {
    return this.post('/payments/express-checkout/omari/confirmation', { ...request }, options);
  }

  /** OneMoney (NetOne) USSD push. `POST /payments/express-checkout/onemoney` */
  oneMoney(request: OneMoneyPaymentRequest, options: CallOptions = {}): Promise<ExpressCheckoutResponse> {
    return this.post('/payments/express-checkout/onemoney', buildBody(request), options);
  }

  /**
   * eWallet Request-to-Pay. The customer approves inside eWallet. Poll
   * `payments.waitForCompletion(orderReference)` and handle the
   * ISO 20022 callback on your `resultUrl`.
   *
   * `POST /payments/express-checkout/ewallet`
   */
  eWallet(request: EWalletPaymentRequest, options: CallOptions = {}): Promise<ExpressCheckoutResponse> {
    return this.post(
      '/payments/express-checkout/ewallet',
      buildBody(request, { paymentMethod: PaymentMethod.WALLETPLUS }),
      options,
    );
  }

  /**
   * Visa / Mastercard (MPGS) with 3DS. Send the returned `redirectHtml`
   * to the browser and execute its `<script>` to start the challenge.
   * Never log or store raw card data.
   *
   * `POST /payments/express-checkout/mpgs`
   */
  card(request: CardPaymentRequest, options: CallOptions = {}): Promise<CardPaymentResponse> {
    return this.post(
      '/payments/express-checkout/mpgs',
      buildBody(request, { paymentMethod: PaymentMethod.CARD }),
      options,
    );
  }
}

/** Build the InnBucks app deep link for a payment code. */
export function innbucksDeepLink(paymentCode: string): string {
  return `schinn.wbpycode://innbucks.co.zw?pymInnCode=${encodeURIComponent(paymentCode)}`;
}
