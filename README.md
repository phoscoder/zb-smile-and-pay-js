# ZB Smile and Pay TypeScript SDK

TypeScript SDK for the [ZB Bank Smile&Pay](https://smileandpay.zb.co.zw/documentation) payment gateway.

> [!IMPORTANT]
> **This is an unofficial SDK.** It is not made, endorsed or supported by ZB Bank or Smile&Pay. It is built from the public [Smile&Pay documentation](https://smileandpay.zb.co.zw/documentation) and tested against the sandbox. For account, credential or production issues, contact ZB Bank directly. "ZB", "ZB Bank" and "Smile&Pay" are trademarks of their respective owners.

- Standard (hosted) checkout, plus express checkout for **Ecocash, Innbucks, SmileCash, Omari, OneMoney, eWallet and Visa/Mastercard**
- Status checks, cancellation, and a completion-polling helper
- Webhook parsing and verification against the API
- Wallet Services cashouts (disbursements)
- Split payments
- No runtime dependencies (uses native `fetch`). Ships ESM, CJS and type declarations.

Requires Node.js 20.3 or newer. Use it **on your server only**: your API secret must never reach a browser or mobile app.

## Install

```bash
pnpm add zb-smileandpay   # or npm i / yarn add
```

## Quick start

```ts
import { SmileAndPay, CurrencyCode } from 'zb-smileandpay';

const smileAndPay = new SmileAndPay({
  apiKey: process.env.SMILEANDPAY_API_KEY!,
  apiSecret: process.env.SMILEANDPAY_API_SECRET!,
  environment: 'sandbox', // or 'production'
});

const { paymentUrl } = await smileAndPay.payments.initiate({
  orderReference: 'ORDER-12345', // must be unique per payment
  amount: 100,
  currencyCode: CurrencyCode.USD, // '840' USD, '924' ZWG
  itemName: 'Premium Subscription',
  itemDescription: '1 Month Premium Access',
  returnUrl: 'https://yoursite.com/payment/success',
  resultUrl: 'https://yoursite.com/api/webhook',
});

// Redirect the customer to paymentUrl.
```

### Client options

| Option          | Default              | Description                                       |
| --------------- | -------------------- | ------------------------------------------------- |
| `apiKey`        | required             | Sent as `x-api-key`                               |
| `apiSecret`     | required             | Sent as `x-api-secret`                            |
| `environment`   | `'sandbox'`          | `'sandbox'` or `'production'`                     |
| `baseUrl`       | per environment      | Override the Payments Gateway URL                 |
| `walletBaseUrl` | per environment      | Override the Wallet Services URL                  |
| `walletApiKey`  | `apiKey`             | Use a separate key for Wallet Services            |
| `timeoutMs`     | `30000`              | Request timeout                                   |
| `fetch`         | `globalThis.fetch`   | Custom fetch implementation                       |
| `headers`       | `{}`                 | Extra headers for every request                   |

Every method also takes a final `{ timeoutMs, signal }` argument.

| Environment | Payments Gateway base URL                                     |
| ----------- | ------------------------------------------------------------- |
| Sandbox     | `https://zbnet.zb.co.zw/wallet_sandbox_api/payments-gateway`  |
| Production  | `https://zbnet.zb.co.zw/wallet_gateway/payments-gateway`      |

## Standard checkout

```ts
await smileAndPay.payments.initiate({ ...order, paymentMethod: 'ECOCASH' }); // optionally preselect a method
await smileAndPay.payments.checkStatus('ORDER-12345'); // { status: 'PENDING' | 'PAID' | 'CANCELLED' | ... }
await smileAndPay.payments.cancel('ORDER-12345');      // throws if the gateway refuses
```

`waitForCompletion` polls until the transaction is paid, failed or cancelled:

```ts
const tx = await smileAndPay.payments.waitForCompletion('ORDER-12345', {
  intervalMs: 5_000,
  maxWaitMs: 120_000,
  onPoll: (s) => console.log(s.status),
});
```

## Express checkout

Charge the customer from your own UI. Every request takes the base fields (`orderReference`, `amount`, `currencyCode`, `itemName`, `itemDescription`, `resultUrl`) plus a method-specific field.

**Single-step.** The customer approves on their phone and the result arrives on your webhook.

```ts
await smileAndPay.express.ecocash({ ...order, ecocashMobile: '0771234567' });
await smileAndPay.express.oneMoney({ ...order, oneMoneyMobile: '0713456789' });

const { innbucksPaymentCode } = await smileAndPay.express.innbucks(order);
innbucksDeepLink(innbucksPaymentCode); // "schinn.wbpycode://innbucks.co.zw?pymInnCode=..."

// eWallet Request-to-Pay: poll for the result
await smileAndPay.express.eWallet({ ...order, ewalletMobile: '263772929399' });
await smileAndPay.payments.waitForCompletion(order.orderReference);
```

**Two-step OTP (SmileCash, Omari).** Leg 1 sends an SMS OTP. Confirm with the **`transactionReference` from leg 1**, not your `orderReference`.

```ts
const { transactionReference } = await smileAndPay.express.smileCash({ ...order, zbWalletMobile: '0711111111' });
await smileAndPay.express.confirmSmileCash({ transactionReference: transactionReference!, otp });

const omari = await smileAndPay.express.omari({ ...order, omariMobile: '0731234567' });
await smileAndPay.express.confirmOmari({ transactionReference: omari.transactionReference!, otp, omariMobile: '0731234567' });
```

**Visa / Mastercard with 3DS.**

```ts
const res = await smileAndPay.express.card({
  ...order,
  returnUrl: 'https://yoursite.com/return',
  pan, expMonth: '01', expYear: '39', securityCode,
});
// Send res.redirectHtml to the browser, inject it, then re-create and append its <script>
// tag so the 3DS form submits. Handling raw card data puts you in PCI-DSS scope.
```

## Split payments

Add `splitRules` (one object or an array) to any initiation request. Settlement accounts must be approved in the Merchant Portal first. Numeric `shareValue`s are sent as strings.

```ts
await smileAndPay.payments.initiate({
  ...order,
  splitRules: [
    { settlementAccount: '263782676047', settlementAccountType: 'WALLET_ACCOUNT', shareType: 'PERCENTAGE', shareValue: 50 },
    { settlementAccount: 'ZB-BANK-ACC-REF', settlementAccountType: 'BANK_ACCOUNT', shareType: 'PERCENTAGE', shareValue: 50 },
  ],
});
```

## Webhooks

Smile&Pay POSTs the result to your `resultUrl`. Return HTTP 200 quickly, or the gateway keeps retrying. **The docs describe no webhook signature**, so do not trust the payload by itself. `webhooks.verify` parses it, then re-reads the transaction from the API and checks that the reference and amount match:

```ts
app.post('/api/webhook', express.json(), async (req, res) => {
  res.sendStatus(200); // acknowledge first

  const { event, paid } = await smileAndPay.webhooks.verify(req.body, { expectedAmount: 100 });
  if (paid && !(await alreadyFulfilled(event.orderReference))) {
    await fulfil(event.orderReference); // make this idempotent: duplicate callbacks happen
  }
});
```

`webhooks.parse(body)` / `parseWebhook(body)` parse without the API call. Both handle the standard payment callback (`type: 'payment'`) and the ISO 20022 eWallet status report (`type: 'ewallet'`).

## Wallet Services (cashouts)

Outbound transfers to a subscriber's SmileCash wallet, in two legs:

```ts
const auth = await smileAndPay.wallet.cashoutAuth({
  receiverMobile: '263772240291',
  senderPhone: '263782676047',
  amount: 2,
  currency: 'ZWG',
  narration: 'Payout',
});
await smileAndPay.wallet.cashoutPayment({ ...sameRequest, transactionId: auth.transactionId! });
// or both legs at once: await smileAndPay.wallet.cashout(request)

await smileAndPay.wallet.checkStatus('Wf2a8bbfdec1446d');
```

> Wallet Services may need to be enabled on your merchant account. Sandbox gateway credentials currently get `403 Forbidden` there. Their response bodies are not documented, so they are typed loosely, and the production wallet URL is inferred. Override it with `walletBaseUrl` if needed.

## Errors

The gateway reports most business failures with **HTTP 200** and a non-`00` `responseCode`. The SDK turns those into exceptions:

| Error                            | When                                                         |
| -------------------------------- | ------------------------------------------------------------ |
| `SmileAndPayApiError`            | Non-2xx response, or `responseCode` other than `00`/`01`     |
| `SmileAndPayAuthenticationError` | HTTP 401/403 or `responseCode` `04`                          |
| `SmileAndPayTimeoutError`        | Request or `waitForCompletion` timed out                     |
| `SmileAndPayConnectionError`     | Network failure                                              |
| `SmileAndPayWebhookError`        | Unparseable webhook, or one that contradicts the API         |

All extend `SmileAndPayError`. API errors expose `status`, `responseCode` and the raw `body`.

```ts
try {
  await smileAndPay.express.ecocash(request);
} catch (error) {
  if (error instanceof SmileAndPayApiError && error.responseCode === ResponseCode.INSUFFICIENT_FUNDS) {
    // ask the customer to top up
  }
}
```

## Sandbox test data

| Method            | Test value                                                     |
| ----------------- | -------------------------------------------------------------- |
| SmileCash         | `0711111111`, OTP `000000`                                     |
| Omari             | `0731234567`, OTP `000000`                                     |
| OneMoney          | `0713456789` succeeds, `0713456780` fails                      |
| EcoCash           | `263784318957` (approval is manual; contact Smile&Pay)         |
| eWallet           | `263772929399`                                                 |
| Card              | `5123450000000008` success (3DS), `…0002` error, `…0010` declined. CVV `100`, expiry `01/39` |

## Development

```bash
pnpm install
pnpm test        # unit tests (mocked fetch)
pnpm typecheck
pnpm build       # dist/ (ESM + CJS + .d.ts)

cp .env.example .env  # add sandbox credentials
pnpm sandbox          # live smoke test against the sandbox
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
