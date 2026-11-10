/**
 * End-to-end smoke test against the Smile&Pay sandbox.
 *
 *   cp .env.example .env   # add your sandbox credentials
 *   pnpm sandbox
 *
 * Creates sandbox transactions only. No real money moves.
 */
import { CurrencyCode, SmileAndPay, SmileAndPayApiError } from '../src/index.js';

const apiKey = process.env.SMILEANDPAY_API_KEY;
const apiSecret = process.env.SMILEANDPAY_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error('Set SMILEANDPAY_API_KEY and SMILEANDPAY_API_SECRET in .env');
  process.exit(1);
}

const client = new SmileAndPay({ apiKey, apiSecret, environment: 'sandbox' });
const run = Date.now();
const common = {
  amount: 1,
  currencyCode: CurrencyCode.USD,
  itemName: 'SDK sandbox test',
  itemDescription: 'zb-smileandpay smoke test',
  returnUrl: 'https://example.com/return',
  resultUrl: 'https://example.com/webhook',
};

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.log(`✔ ${name}`, result);
  } catch (error) {
    if (error instanceof SmileAndPayApiError) {
      console.log(`✘ ${name}: [${error.status}/${error.responseCode ?? '-'}] ${error.message}`);
    } else {
      console.log(`✘ ${name}:`, error);
    }
  }
}

// Standard checkout: create, check, cancel.
const standardRef = `SDK-STD-${run}`;
await step('payments.initiate', () => client.payments.initiate({ ...common, orderReference: standardRef }));
await step('payments.checkStatus', async () => (await client.payments.checkStatus(standardRef)).status);
await step('payments.cancel', () => client.payments.cancel(standardRef));
await step('payments.checkStatus (after cancel)', async () => (await client.payments.checkStatus(standardRef)).status);

// Innbucks: get a payment code.
await step('express.innbucks', () => client.express.innbucks({ ...common, orderReference: `SDK-IB-${run}` }));

// SmileCash two-step OTP flow with the sandbox test wallet.
const smileRef = `SDK-ZB-${run}`;
await step('express.smileCash + confirm', async () => {
  const leg1 = await client.express.smileCash({ ...common, orderReference: smileRef, zbWalletMobile: '0711111111' });
  const leg2 = await client.express.confirmSmileCash({ transactionReference: leg1.transactionReference!, otp: '000000' });
  const final = await client.payments.waitForCompletion(smileRef, { intervalMs: 2_000, maxWaitMs: 30_000 });
  return { leg1: leg1.status, leg2: leg2.status, final: final.status };
});
