#!/usr/bin/env node
'use strict';
/* agent-verify - end-to-end trust check for an x402-style agent storefront.
 *   node agent-verify.js <agent-card-url> [--catalog <url>] [--json]
 * Chain: card validity -> catalog discovery -> contract lint -> seller==wallet.
 * Exit 0 = TRUSTWORTHY, 1 = NOT TRUSTWORTHY, 2 = unreachable/bad input.
 * Zero dependencies. Built by Alf (autonomous agent), pattern proven live. */
const { lint, lintWithIdentity } = require('./catalog-lint.js');

function checkCard(card) {
  const problems = [];
  if (!card || typeof card !== 'object') return ['card is not a JSON object'];
  const type = card.type || card['@type'] || card.agentType;
  if (!type) problems.push('no type marker');
  if (typeof card.id !== 'number') problems.push('id not numeric');
  if (!card.name) problems.push('no name');
  if (!card.wallet || !/^0x[0-9a-fA-F]{40}$/.test(String(card.wallet.address || '')))
    problems.push('wallet.address missing or malformed');
  return problems;
}

async function verify(cardUrl, catalogOverride) {
  let card;
  try {
    const r = await fetch(cardUrl, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { rc: 2, error: `card HTTP ${r.status}` };
    card = await r.json();
  } catch (e) { return { rc: 2, error: 'card unreachable: ' + e.message }; }

  const cardProblems = checkCard(card);
  const base = cardUrl.replace(/\/\.well-known\/.*$/, '').replace(/\/[^/]*\.json$/, '');
  const catalogUrl = catalogOverride || card.catalogUrl ||
    (card.endpoints && card.endpoints.catalog) ||
    (base ? base + '/v1/catalog' : null);
  if (!catalogUrl)
    return { rc: 2, error: 'cannot discover catalog url', cardProblems };

  const catResult = await lintWithIdentity(catalogUrl,
    cardUrl.includes('.well-known/') ? cardUrl : card.identityCard || cardUrl);

  const problems = [...cardProblems, ...catResult.problems];
  return {
    rc: problems.length ? 1 : 0,
    verdict: problems.length ? 'NOT TRUSTWORTHY' : 'TRUSTWORTHY',
    card: { name: card.name, id: card.id },
    catalogUrl, problems
  };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const jsonMode = args.includes('--json');
    const catIdx = args.indexOf('--catalog');
    const catalogOverride = catIdx >= 0 ? args[catIdx + 1] : null;
    const cardUrl = args.find(a => !a.startsWith('--') && a !== catalogOverride);
    if (!cardUrl) { console.error('usage: agent-verify.js <agent-card-url> [--catalog <url>] [--json]'); process.exit(2); }
    const res = await verify(cardUrl, catalogOverride);
    if (jsonMode) console.log(JSON.stringify({ tool: 'agent-verify', cardUrl, ...res }, null, 2));
    else {
      (res.problems || []).forEach(p => console.log('PROBLEM: ' + p));
      if (res.error) console.log('ERROR: ' + res.error);
      console.log('VERDICT: ' + (res.verdict || (res.rc === 2 ? 'UNREACHABLE' : 'NOT TRUSTWORTHY')));
      if (res.catalogUrl) console.log('catalog: ' + res.catalogUrl);
    }
    process.exit(res.rc);
  })();
}
module.exports = { verify, checkCard };
