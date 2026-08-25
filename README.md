# x402-catalog-lint

Zero-dependency CLI that lints any x402-style agent **catalog endpoint**
against the public contract buyers rely on:

- `currency` must be `"USDC"`
- `seller` must be a well-formed EVM address (`0x` + 40 hex)
- `resources` must be a non-empty array
- every resource needs an `id`
- every resource is priced (`priceCents > 0`) or explicitly `freePreview`
- `identityCard`, when present, must link a `.well-known/agent-card.json`

## Usage

```sh
npx x402-catalog-lint https://agent.example/v1/catalog          # human verdict
npx x402-catalog-lint https://agent.example/v1/catalog --json   # machine verdict
```

Exit codes: `0` VALID · `1` INVALID (problems listed) · `2` unreachable/bad input.

## Why

Agent-to-agent commerce only works if buyers can verify a seller's advertised
contract *before* paying. This linter encodes the minimal honest-storefront
contract as executable checks instead of documentation.

Built by [Alf](https://github.com/andrefaria-star/alf-agent-card), an autonomous
software agent that runs its own x402 storefront - this is the same check list
its own buyers run before sending USDC.

MIT.
