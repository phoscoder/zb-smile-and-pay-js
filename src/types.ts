import type { CurrencyCode, PaymentMethod } from './constants.js';

/** Allows known string literals while still accepting values the API adds later. */
type LooseString<T extends string> = T | (string & {});

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Fields common to every gateway payment initiation request. */
export interface BasePaymentRequest {
  /** Your unique reference for the order. Must not be reused. */
  orderReference: string;
  /** Transaction amount, e.g. `100` or `12.5`. */
  amount: number;
  /** `'840'` (USD) or `'924'` (ZWG). See {@link CurrencyCode}. */
  currencyCode: LooseString<CurrencyCode>;
  /** Name of the item being purchased. */
  itemName: string;
  /** Description of the item being purchased. */
  itemDescription: string;
  /** Webhook URL that receives the final payment status. */
  resultUrl: string;
  /** URL the customer is redirected to after payment. */
  returnUrl?: string;
  /** Distribute the net settlement across approved settlement accounts. */
  splitRules?: SplitRule | SplitRule[];
}

/** Optional customer details. */
export interface CustomerDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhoneNumber?: string;
}

/** A rule allocating part of the net settlement to an approved account. */
export interface SplitRule {
  /** Approved wallet number or ZB bank account reference. */
  settlementAccount: string;
  settlementAccountType: LooseString<'WALLET_ACCOUNT' | 'BANK_ACCOUNT'>;
  shareType: LooseString<'PERCENTAGE' | 'FIXED'>;
  /** Share value, sent as a string (e.g. `"50"`). Numbers are converted. */
  shareValue: string | number;
}

/** Base response returned by gateway initiation endpoints. */
export interface GatewayResponse {
  responseMessage: string;
  responseCode: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Standard checkout
// ---------------------------------------------------------------------------

export interface InitiateTransactionRequest extends BasePaymentRequest, CustomerDetails {
  returnUrl: string;
  /** Preselect a payment method on the hosted page. */
  paymentMethod?: LooseString<PaymentMethod>;
  cancelUrl?: string;
  failureUrl?: string;
}

export interface InitiateTransactionResponse extends GatewayResponse {
  /** Hosted checkout URL to redirect the customer to. */
  paymentUrl: string;
  transactionReference: string;
}

// ---------------------------------------------------------------------------
// Express checkout
// ---------------------------------------------------------------------------

export interface ExpressCheckoutResponse extends GatewayResponse {
  status?: string;
  /** Gateway reference. Required for OTP confirmation (SmileCash, Omari). */
  transactionReference: string | null;
}

export interface EcocashPaymentRequest extends BasePaymentRequest {
  /** Customer EcoCash number, e.g. `0771234567`. */
  ecocashMobile: string;
}

export type InnbucksPaymentRequest = BasePaymentRequest;

export interface InnbucksPaymentResponse extends ExpressCheckoutResponse {
  /** Code the customer enters in the InnBucks app. */
  innbucksPaymentCode: string;
}

export interface SmileCashPaymentRequest extends BasePaymentRequest {
  /** Customer SmileCash (ZB wallet) number, e.g. `0711111111`. */
  zbWalletMobile: string;
}

export interface SmileCashConfirmRequest {
  /** `transactionReference` from the initiation response (NOT your orderReference). */
  transactionReference: string;
  otp: string;
}

export interface OmariPaymentRequest extends BasePaymentRequest {
  /** Customer Omari number, e.g. `0731234567`. */
  omariMobile: string;
}

export interface OmariConfirmRequest {
  /** `transactionReference` from the initiation response (NOT your orderReference). */
  transactionReference: string;
  otp: string;
  omariMobile: string;
}

export interface OneMoneyPaymentRequest extends BasePaymentRequest {
  /** Customer OneMoney number, e.g. `0713456789`. */
  oneMoneyMobile: string;
}

export interface EWalletPaymentRequest extends BasePaymentRequest {
  /** Customer eWallet number in `263…` format. */
  ewalletMobile: string;
  /** Defaults to `WALLETPLUS`, as in the documentation example. */
  paymentMethod?: LooseString<PaymentMethod>;
}

export interface CardPaymentRequest extends BasePaymentRequest, CustomerDetails {
  returnUrl: string;
  /** Card number (PAN). */
  pan: string;
  /** Two-digit month, e.g. `01`. */
  expMonth: string;
  /** Two-digit year, e.g. `39`. */
  expYear: string;
  /** CVV / CVC. */
  securityCode: string;
  /** Defaults to `CARD`. */
  paymentMethod?: LooseString<PaymentMethod>;
  cancelUrl?: string;
  failureUrl?: string;
}

export interface CardPaymentResponse extends ExpressCheckoutResponse {
  gatewayRecommendation?: string;
  authenticationStatus?: string;
  /**
   * Self-submitting 3DS form. Render it in the browser and execute its
   * `<script>` tag to start the challenge.
   */
  redirectHtml?: string;
  customizedHtml?: {
    '3ds2'?: { acsUrl?: string; cReq?: string };
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Utility endpoints
// ---------------------------------------------------------------------------

export interface TransactionStatusResponse {
  merchantId: string;
  /** Gateway transaction reference. */
  reference: string;
  orderReference: string;
  itemName?: string;
  amount: number;
  /** Alphabetic currency, e.g. `USD`. */
  currency: string;
  currencyCode?: string;
  /** Payment method used, `null` until the customer picks one. */
  paymentOption: string | null;
  status: string;
  createdDate: string;
  returnUrl?: string;
  resultUrl?: string;
  clientFee?: number;
  merchantFee?: number;
  mobileNumber?: string;
  failureDescription?: string | null;
  [key: string]: unknown;
}

export interface CancelPaymentResponse {
  success: boolean;
  description: string;
  returnUrl: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** Payload POSTed to your `resultUrl` for standard and express checkouts. */
export interface PaymentCallback {
  merchantId: string;
  /** Gateway transaction reference. */
  reference: string;
  orderReference: string;
  itemName?: string;
  amount: number;
  currency: string;
  currencyCode: string;
  paymentOption: string;
  status: string;
  createdDate: string;
  returnUrl?: string;
  resultUrl?: string;
  clientFee?: number;
  merchantFee?: number;
  mobileNumber?: string;
  [key: string]: unknown;
}

interface StatusReasonInfo {
  reason?: { prty?: string };
  additionalInformation?: string[];
}

/** ISO 20022 (pain.002) status report POSTed for eWallet RTP payments. */
export interface EWalletCallback {
  merchantId: string;
  messageType: string;
  messageId: string;
  creationDateTime: string;
  initiatingParty?: { name?: string; anyBic?: string };
  originalGroupInfoAndStatus: {
    originalMessageId: string;
    originalMessageNameId?: string;
    originalNumberOfTransactions?: number;
    originalControlSum?: number;
    groupStatus: string;
    statusReasonInfo?: StatusReasonInfo;
  };
  originalPaymentInfoAndStatusList: Array<{
    originalPaymentInformationId?: string;
    transactionInfoAndStatusList: Array<{
      originalInstructionId: string;
      originalEndToEndId: string;
      /** ISO 20022 status, e.g. `ACSP`, `ACSC`, `ACCP`, `RJCT`. */
      transactionStatus: string;
      accountServicerReference?: string;
      statusReasonInfo?: StatusReasonInfo;
    }>;
  }>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Wallet services (outbound)
// ---------------------------------------------------------------------------

export interface CashoutRequest {
  /** Wallet receiving funds, e.g. `263772240291`. */
  receiverMobile: string;
  /** Merchant source wallet initiating the cashout. */
  senderPhone: string;
  amount: number;
  /** Three-letter currency, e.g. `USD` or `ZWG`. */
  currency: LooseString<'USD' | 'ZWG'>;
  /** Originating channel. Defaults to `WEB`. */
  channel?: string;
  narration: string;
}

export interface CashoutPaymentRequest extends CashoutRequest {
  /** `transactionId` returned by the auth leg. */
  transactionId: string;
}

/** Wallet service responses are not documented; fields are best-effort. */
export interface WalletResponse {
  transactionId?: string;
  [key: string]: unknown;
}
