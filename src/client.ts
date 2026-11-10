import { GATEWAY_BASE_URLS, WALLET_BASE_URLS, type Environment } from './constants.js';
import { SmileAndPayError } from './errors.js';
import { HttpClient, type FetchLike } from './http.js';
import { ExpressCheckout } from './resources/express.js';
import { Payments } from './resources/payments.js';
import { Wallet } from './resources/wallet.js';
import { Webhooks } from './resources/webhooks.js';

export interface SmileAndPayOptions {
  /** Merchant API key (`x-api-key`). */
  apiKey: string;
  /** Merchant API secret (`x-api-secret`). Keep it server-side. */
  apiSecret: string;
  /** Default: `'sandbox'`. */
  environment?: Environment;
  /** Override the Payments Gateway base URL. */
  baseUrl?: string;
  /** Override the Wallet Services base URL. */
  walletBaseUrl?: string;
  /** API key for Wallet Services, if ZB issued a different one. Default: `apiKey`. */
  walletApiKey?: string;
  /** Request timeout. Default: 30000ms. */
  timeoutMs?: number;
  /** Custom fetch implementation. Default: `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
}

/**
 * Smile&Pay API client.
 *
 * @example
 * const smileAndPay = new SmileAndPay({
 *   apiKey: process.env.SMILEANDPAY_API_KEY!,
 *   apiSecret: process.env.SMILEANDPAY_API_SECRET!,
 *   environment: 'sandbox',
 * });
 * const { paymentUrl } = await smileAndPay.payments.initiate({ ... });
 */
export class SmileAndPay {
  readonly environment: Environment;
  /** Standard checkout, status checks, cancellation and polling. */
  readonly payments: Payments;
  /** Express checkout: Ecocash, Innbucks, SmileCash, Omari, OneMoney, eWallet, card. */
  readonly express: ExpressCheckout;
  /** Wallet Services: outbound cashouts and their status. */
  readonly wallet: Wallet;
  /** Parse and verify `resultUrl` callbacks. */
  readonly webhooks: Webhooks;

  constructor(options: SmileAndPayOptions) {
    if (!options?.apiKey) throw new SmileAndPayError('apiKey is required');
    if (!options.apiSecret) throw new SmileAndPayError('apiSecret is required');

    const environment = options.environment ?? 'sandbox';
    if (!(environment in GATEWAY_BASE_URLS)) {
      throw new SmileAndPayError(`Unknown environment "${environment}". Use "sandbox" or "production".`);
    }
    const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!fetchImpl) {
      throw new SmileAndPayError('No fetch implementation found. Use Node 20+ or pass the `fetch` option.');
    }

    this.environment = environment;
    const gateway = new HttpClient({
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      baseUrl: options.baseUrl ?? GATEWAY_BASE_URLS[environment],
      timeoutMs: options.timeoutMs ?? 30_000,
      fetch: fetchImpl,
      headers: options.headers,
    });

    const wallet = new HttpClient({
      apiKey: options.walletApiKey ?? options.apiKey,
      baseUrl: options.walletBaseUrl ?? WALLET_BASE_URLS[environment],
      timeoutMs: options.timeoutMs ?? 30_000,
      fetch: fetchImpl,
      headers: options.headers,
    });

    this.payments = new Payments(gateway);
    this.express = new ExpressCheckout(gateway);
    this.wallet = new Wallet(wallet);
    this.webhooks = new Webhooks(this.payments);
  }
}
