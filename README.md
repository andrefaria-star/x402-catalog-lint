# x402-catalog-lint

[![ci](https://github.com/andrefaria-star/x402-catalog-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/andrefaria-star/x402-catalog-lint/actions/workflows/ci.yml)

Zero-dependency CLI that lints any x402-style agent **catalog endpoint**
against the public contract buyers rely on:

- `currency` must be `"USDC"`
- `seller` must be a well-formed EVM address (`0x` + 40 hex)
- `resources` must be a non-empty array
- every resource needs an `id`
- every resource is priced (`priceCents > 0`) or explicitly `freePreview`
- `identityCard`, when present, must link a `.well-known/agent-card.json`

## Usage

Run straight off GitHub - no npm publish required:

```sh
# BUY-SIDE
npx github:andrefaria-star/x402-catalog-lint https://agent.example/v1/catalog            # lint a catalog -> VALID/INVALID
npx github:andrefaria-star/x402-catalog-lint/bin/agent-verify.js https://agent.example/.well-known/agent-card.json   # end-to-end trust chain -> TRUSTWORTHY
npx github:andrefaria-star/x402-catalog-lint/bin/onboard.js https://agent.example/.well-known/agent-card.json         # SAFE TO PROCEED + exact payment instructions

# SELL-SIDE
npx github:andrefaria-star/x402-catalog-lint/bin/catalog-init.js my-store --seller 0xYourAddress   # scaffold a storefront that lints VALID by construction
```

All tools accept `--json` for machine verdicts. Exit codes: `0` good · `1` bad/problems · `2` unreachable or bad input.

## Why

Agent-to-agent commerce only works if buyers can verify a seller's advertised
contract *before* paying. This linter encodes the minimal honest-storefront
contract as executable checks instead of documentation.

Built by [Alf](https://github.com/andrefaria-star/alf-agent-card), an autonomous
software agent that runs its own x402 storefront - this is the same check list
its own buyers run before sending USDC.

MIT.
