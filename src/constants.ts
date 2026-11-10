/** Deployment environments exposed by Smile&Pay. */
export type Environment = 'sandbox' | 'production';

/** Base URLs for the inbound Payments Gateway (collections). */
export const GATEWAY_BASE_URLS: Record<Environment, string> = {
  sandbox: 'https://zbnet.zb.co.zw/wallet_sandbox_api/payments-gateway',
  production: 'https://zbnet.zb.co.zw/wallet_gateway/payments-gateway',
};

/**
 * Base URLs for Wallet Services (outbound cashouts / disbursements).
 *
 * The documentation only publishes the sandbox URL. The production URL
 * follows the same pattern as the gateway; override it with the
 * `walletBaseUrl` client option if ZB gives you a different one.
 */
export const WALLET_BASE_URLS: Record<Environment, string> = {
  sandbox: 'https://zbnet.zb.co.zw/wallet_sandbox_api',
  production: 'https://zbnet.zb.co.zw/wallet_gateway',
};

/** ISO 4217 numeric currency codes accepted by the gateway. */
export const CurrencyCode = {
  USD: '840',
  ZWG: '924',
} as const;
export type CurrencyCode = (typeof CurrencyCode)[keyof typeof CurrencyCode];

/** Payment methods accepted in the `paymentMethod` field. */
export const PaymentMethod = {
  /** SmileCash / ZB wallet. */
  WALLETPLUS: 'WALLETPLUS',
  ECOCASH: 'ECOCASH',
  INNBUCKS: 'INNBUCKS',
  /** Visa / Mastercard. */
  CARD: 'CARD',
  OMARI: 'OMARI',
  ONEMONEY: 'ONEMONEY',
  EWALLET: 'EWALLET',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Gateway `responseCode` values. */
export const ResponseCode = {
  SUCCESS: '00',
  PENDING: '01',
  FAILED: '02',
  INSUFFICIENT_FUNDS: '03',
  INVALID_CREDENTIALS: '04',
  INVALID_REQUEST: '05',
  DUPLICATE_ORDER: '06',
  TIMEOUT: '07',
  CANCELED: '08',
  INVALID_OTP: '09',
  ACCOUNT_NOT_FOUND: '10',
  SERVICE_UNAVAILABLE: '11',
  AMOUNT_LIMIT: '12',
  SYSTEM_ERROR: '99',
} as const;
export type ResponseCode = (typeof ResponseCode)[keyof typeof ResponseCode];

/** Human-readable descriptions for each {@link ResponseCode}. */
export const RESPONSE_CODE_DESCRIPTIONS: Record<ResponseCode, string> = {
  '00': 'Transaction completed successfully',
  '01': 'Transaction is being processed',
  '02': 'Transaction failed to process',
  '03': 'Customer has insufficient balance',
  '04': 'API key or secret is invalid',
  '05': 'Request body validation failed',
  '06': 'Order reference already exists',
  '07': 'Customer did not respond in time',
  '08': 'Customer canceled the transaction',
  '09': 'OTP verification failed',
  '10': 'Mobile money account not found',
  '11': 'Payment provider is down',
  '12': 'Amount exceeds transaction limits',
  '99': 'Internal server error',
};

/** Statuses reported by check-status and webhook callbacks. */
export const TransactionStatus = {
  PENDING: 'PENDING',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PENDING_3DS: 'PENDING_3DS',
  PAID: 'PAID',
  SUCCESS: 'SUCCESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

/** Statuses that mean the customer has paid. */
export const SUCCESSFUL_STATUSES: readonly string[] = ['PAID', 'SUCCESS', 'COMPLETED'];

/** Statuses after which a transaction will not change again. */
export const FINAL_STATUSES: readonly string[] = [
  ...SUCCESSFUL_STATUSES,
  'FAILED',
  'CANCELLED',
  'CANCELED',
  'DECLINED',
  'EXPIRED',
];
