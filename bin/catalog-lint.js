#!/usr/bin/env node
'use strict';
/* x402-catalog-lint - validate any x402-style catalog endpoint.
 *   node catalog-lint.js <url> [--json]
 * Exit 0 = VALID, 1 = INVALID (problems found), 2 = unreachable/bad input.
 * --json emits one machine-readable object: {tool,url,verdict,problems[]}.
 * Built by Alf, an autonomous agent - pattern proven across live ledgers. */
'use strict';
const CHECKS = [
  ['currency is USDC', c => c.currency === 'USDC'],
  ['seller is 0x-address', c => typeof c.seller === 'string' && /^0x[0-9a-fA-F]{40}$/.test(c.seller)],
  ['resources non-empty', c => Array.isArray(c.resources) && c.resources.length > 0],
  ['every resource has id', c => Array.isArray(c.resources) && c.resources.every(r => r && r.id)],
  ['every resource priced or freePreview',
   c => Array.isArray(c.resources) && c.resources.every(r =>
     (typeof r.priceCents === 'number' && r.priceCents > 0) || r.freePreview === true)],
  ['identityCard links .well-known/agent-card.json (when present)',
   c => !c.identityCard || String(c.identityCard).includes('.well-known/agent-card.json')]
];
// Cross-check: does the catalog's seller match the identity card's wallet?
async function lintWithIdentity(url, cardUrl, knownSellerAddr) {
  const base = await lint(url);
  if (base.rc !== 0 || !base.catalog) return base;
  if (knownSellerAddr) {
    const ok = String(base.catalog.seller).toLowerCase() === knownSellerAddr.toLowerCase();
    return { rc: ok ? 0 : 1,
             problems: ok ? [] : ['catalog.seller != card payment identity (MISMATCH)'],
             catalog: base.catalog };
  }
  let card;
  try {
    const r = await fetch(cardUrl, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { rc: 1, problems: [...base.problems, 'identity card HTTP ' + r.status], catalog: base.catalog };
    card = await r.json();
  } catch (e) {
    return { rc: 1, problems: [...base.problems, 'identity card unreachable: ' + e.message], catalog: base.catalog };
  }
  const problems = [...base.problems];
  if (!card.wallet || typeof card.wallet.address !== 'string')
    problems.push('identity card has no wallet.address');
  else if (card.wallet.address.toLowerCase() !== String(base.catalog.seller).toLowerCase())
    problems.push('catalog.seller != identity card wallet.address (MISMATCH)');
  return { rc: problems.length ? 1 : 0, problems, catalog: base.catalog };
}
async function lint(url) {
  const problems = [];
  let cat;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { rc: 2, problems: [`HTTP ${res.status} from ${url}`], catalog: null };
    cat = await res.json();
  } catch (e) {
    return { rc: 2, problems: ['unreachable: ' + e.message], catalog: null };
  }
  if (!cat || typeof cat !== 'object') return { rc: 1, problems: ['body is not a JSON object'], catalog: cat };
  for (const [name, fn] of CHECKS) if (!fn(cat)) problems.push(name);
  return { rc: problems.length ? 1 : 0, problems, catalog: cat };
}
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const jsonMode = args.includes('--json');
    const idIdx = args.indexOf('--identity');
    const cardUrl = idIdx >= 0 ? args[idIdx + 1] : null;
    const url = args.find(a => !a.startsWith('--') && args.indexOf(a) !== idIdx && args.indexOf(a) !== idIdx + 1)
             || args.find(a => !a.startsWith('--'));
    if (!url) {
      console.error('usage: catalog-lint.js <url> [--json]');
      process.exit(2);
    }
    const { rc, problems } = cardUrl ? await lintWithIdentity(url, cardUrl) : await lint(url);
    if (jsonMode) console.log(JSON.stringify({ tool: 'catalog-lint', url, verdict: rc === 0 ? 'VALID' : rc === 1 ? 'INVALID' : 'UNREACHABLE', problems }, null, 2));
    else {
      problems.forEach(p => console.log('PROBLEM: ' + p));
      console.log('VERDICT: ' + (rc === 0 ? 'VALID' : rc === 1 ? 'INVALID' : 'UNREACHABLE'));
    }
    process.exit(rc);
  })();
}
module.exports = { lint, lintWithIdentity, CHECKS };
