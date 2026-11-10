import { SmileAndPayError } from '../errors.js';
import type { EWalletCallback, PaymentCallback, TransactionStatusResponse } from '../types.js';
import { isFinalStatus, isSuccessfulStatus, type Payments } from './payments.js';
import type { CallOptions } from './shared.js';

/** ISO 20022 transaction statuses that mean the funds were accepted. */
const ISO_SUCCESS = ['ACSC', 'ACSP', 'ACCC', 'ACWC'];
const ISO_FAILURE = ['RJCT', 'CANC'];

/** A webhook payload after parsing. */
export type WebhookEvent =
  | {
      type: 'payment';
      orderReference: string;
      /** Gateway reference. */
      reference: string;
      status: string;
      paid: boolean;
      final: boolean;
      amount: number;
      payload: PaymentCallback;
    }
  | {
      type: 'ewallet';
      orderReference: string;
      /** Bank reference (`accountServicerReference`), if present. */
      reference: string | undefined;
      /** ISO 20022 status, e.g. `ACSP` or `RJCT`. */
      status: string;
      paid: boolean;
      final: boolean;
      amount: number | undefined;
      payload: EWalletCallback;
    };

export class SmileAndPayWebhookError extends SmileAndPayError {
  constructor(message: string) {
    super(message);
    this.name = 'SmileAndPayWebhookError';
  }
}

/**
 * Parse a `resultUrl` callback: the standard/express payment payload, or
 * the ISO 20022 eWallet status report.
 *
 * Smile&Pay does not document a webhook signature, so treat the result
 * as unauthenticated. Call `webhooks.verify()` (or `payments.checkStatus`)
 * before fulfilling an order.
 */
export function parseWebhook(body: string | Uint8Array | Record<string, unknown>): WebhookEvent {
  let data: unknown = body;
  if (typeof body === 'string' || body instanceof Uint8Array) {
    const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
    try {
      data = JSON.parse(text);
    } catch {
      throw new SmileAndPayWebhookError('Webhook body is not valid JSON');
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SmileAndPayWebhookError('Webhook body must be a JSON object');
  }
  const record = data as Record<string, unknown>;

  if (Array.isArray(record.originalPaymentInfoAndStatusList)) {
    const payload = record as unknown as EWalletCallback;
    const tx = payload.originalPaymentInfoAndStatusList[0]?.transactionInfoAndStatusList?.[0];
    const orderReference =
      tx?.originalEndToEndId || tx?.originalInstructionId || payload.originalGroupInfoAndStatus?.originalMessageId;
    if (!orderReference) {
      throw new SmileAndPayWebhookError('eWallet callback is missing the order reference');
    }
    const status = (tx?.transactionStatus || payload.originalGroupInfoAndStatus?.groupStatus || '').toUpperCase();
    return {
      type: 'ewallet',
      orderReference,
      reference: tx?.accountServicerReference,
      status,
      paid: ISO_SUCCESS.includes(status),
      final: ISO_SUCCESS.includes(status) || ISO_FAILURE.includes(status),
      amount: payload.originalGroupInfoAndStatus?.originalControlSum,
      payload,
    };
  }

  if (typeof record.orderReference === 'string' && typeof record.status === 'string') {
    const payload = record as unknown as PaymentCallback;
    return {
      type: 'payment',
      orderReference: payload.orderReference,
      reference: payload.reference,
      status: payload.status,
      paid: isSuccessfulStatus(payload.status),
      final: isFinalStatus(payload.status),
      amount: Number(payload.amount),
      payload,
    };
  }

  throw new SmileAndPayWebhookError('Unrecognised Smile&Pay webhook payload');
}

export interface VerifiedWebhook {
  /** The parsed (unauthenticated) callback. */
  event: WebhookEvent;
  /** Authoritative status fetched from the API. */
  transaction: TransactionStatusResponse;
  /** `true` when the API says the order is paid. Base fulfilment on this. */
  paid: boolean;
}

export interface VerifyWebhookOptions extends CallOptions {
  /** Expected amount for the order. Mismatches throw. */
  expectedAmount?: number;
}

/** Webhook helpers bound to a client. */
export class Webhooks {
  constructor(private readonly payments: Payments) {}

  /** Parse a callback body without verifying it. */
  parse(body: string | Uint8Array | Record<string, unknown>): WebhookEvent {
    return parseWebhook(body);
  }

  /**
   * Parse a callback, then check it against `payments.checkStatus`.
   * Throws {@link SmileAndPayWebhookError} if the API record contradicts
   * the callback (different amount or gateway reference).
   */
  async verify(
    body: string | Uint8Array | Record<string, unknown>,
    options: VerifyWebhookOptions = {},
  ): Promise<VerifiedWebhook> {
    const { expectedAmount, ...callOptions } = options;
    const event = parseWebhook(body);
    const transaction = await this.payments.checkStatus(event.orderReference, callOptions);

    if (event.type === 'payment' && event.reference && transaction.reference !== event.reference) {
      throw new SmileAndPayWebhookError(
        `Webhook reference ${event.reference} does not match transaction ${transaction.reference}`,
      );
    }
    const apiAmount = Number(transaction.amount);
    if (event.amount !== undefined && !amountsEqual(event.amount, apiAmount)) {
      throw new SmileAndPayWebhookError(`Webhook amount ${event.amount} does not match transaction amount ${apiAmount}`);
    }
    if (expectedAmount !== undefined && !amountsEqual(expectedAmount, apiAmount)) {
      throw new SmileAndPayWebhookError(`Transaction amount ${apiAmount} does not match expected ${expectedAmount}`);
    }

    return { event, transaction, paid: isSuccessfulStatus(transaction.status) };
  }
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}
