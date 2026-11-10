# Contributing

Thanks for helping improve the ZB Smile and Pay TypeScript SDK. This is an unofficial, community-maintained project, and bug reports, fixes and documentation improvements are all welcome.

## Reporting issues

Open an issue at https://github.com/phoscoder/zb-smile-and-pay-js/issues with:

- The SDK version and Node.js version
- The method you called and the options you passed
- The error or response you got (`error.status`, `error.responseCode` and `error.body` are the most useful)
- Whether it happened in `sandbox` or `production`

**Never paste API keys, API secrets, card numbers or customer phone numbers** into an issue or pull request. Replace them with placeholders.

Problems with your merchant account, credentials, settlements or the gateway itself are for ZB Bank, not this project.

## Development setup

You need Node.js 20.3 or newer and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/phoscoder/zb-smile-and-pay-js.git
cd zb-smile-and-pay-js
pnpm install
```

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm test`      | Run the unit tests (fetch is mocked)          |
| `pnpm typecheck` | Type-check `src`, `test` and `examples`       |
| `pnpm build`     | Build ESM, CJS and type declarations to `dist`|
| `pnpm sandbox`   | Run the live smoke test against the sandbox   |

### Testing against the sandbox

1. Create a merchant account on the [Smile&Pay sandbox portal](https://zbnet.zb.co.zw/wallet_sandbox_merchant/) and generate an API key and secret.
2. `cp .env.example .env` and fill in your credentials. `.env` is git-ignored; keep it that way.
3. `pnpm sandbox`

The sandbox only creates test transactions. Test numbers and cards are listed in the README.

## Making changes

1. Fork the repo and create a branch from `main` (`fix/innbucks-timeout`, `feat/refunds`).
2. Make your change, with tests:
   - Unit tests live in `test/` and use the `mockClient` helper in `test/helpers.ts`. They must not hit the network.
   - When you add or change an endpoint, base the mocked responses on real sandbox responses where possible, and say in the PR which ones you checked live.
3. Run `pnpm typecheck && pnpm test && pnpm build` before pushing. CI runs the same steps on Node 20, 22 and 24.
4. Update `README.md` if you change the public API.

### Code guidelines

- **No runtime dependencies.** The SDK uses native `fetch`. Dev dependencies are fine.
- **Follow the docs.** Endpoint paths and field names should match the [official documentation](https://smileandpay.zb.co.zw/documentation). Where the SDK goes beyond or guesses at the docs (for example, inferred URLs or undocumented response fields), say so in a code comment.
- **Keep it typed.** Add request and response types in `src/types.ts`. Use the `LooseString` pattern for enums the API may extend.
- **Throw typed errors.** Use the classes in `src/errors.ts`, and remember the gateway reports many failures with HTTP 200 (see `assertGatewaySuccess`).
- **Don't break the public API** without a good reason. Breaking changes need a note in the PR description.

### Commits

Keep commits small and focused, one logical change each, using [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add refund endpoint
fix: handle empty status response
docs: document OneMoney test numbers
test: cover Omari OTP failure
```

## Pull requests

- Describe what changed and why, and link the issue if there is one.
- Keep unrelated changes in separate PRs.
- Make sure CI is green.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
