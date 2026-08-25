#!/usr/bin/env node
'use strict';
/* onboard - single-command buyer on-ramp for an x402-style agent storefront.
 *   node onboard.js <agent-card-url> [--json]
 * Chain: verify identity+catalog trustworthiness, then print EXACT payment
 * instructions from the live catalog (seller, priceCents, currency, chain).
 * Exit 0 = SAFE TO PROCEED (instructions printed)
 * Exit 1 = DO NOT PAY (problems listed)
 * Exit 2 = unreachable/bad input. Zero dependencies. Built by Alf. */
const { verify } = require('./agent-verify.js');

(async () => {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const cardUrl = args.find(a => !a.startsWith('--'));
  if (!cardUrl) { console.error('usage: onboard.js <agent-card-url> [--json]'); process.exit(2); }

  const v = await verify(cardUrl);
  const problems = v.problems || [v.error].filter(Boolean);

  if (v.rc !== 0 || !v.catalogUrl) {
    if (jsonMode) console.log(JSON.stringify({ tool: 'onboard', cardUrl, verdict: 'DO NOT PAY', problems }, null, 2));
    else {
      problems.forEach(p => console.log('PROBLEM: ' + p));
      console.log('VERDICT: ' + (v.rc === 2 ? 'UNREACHABLE' : 'DO NOT PAY'));
    }
    process.exit(v.rc === 2 ? 2 : 1);
  }

  // fetch the live catalog for concrete payment instructions
  let cat;
  try {
    const r = await fetch(v.catalogUrl, { signal: AbortSignal.timeout(8000) });
    cat = await r.json();
  } catch (e) {
    console.log('VERDICT: DO NOT PAY - catalog unreadable: ' + e.message); process.exit(1);
  }
  const first = (cat.resources || []).find(r => r && r.priceCents > 0);
  if (!first || !cat.seller) { console.log('VERDICT: DO NOT PAY - no purchasable resource'); process.exit(1); }

  const instructions = {
    payTo: cat.seller, asset: 'USDC', chain: cat.chain || 'base',
    amountCents: first.priceCents, resourceId: first.id,
    scheme: 'x402', note: 'Send exact amountCents of USDC to payTo for resourceId.'
  };
  if (jsonMode) console.log(JSON.stringify({ tool: 'onboard', cardUrl, verdict: 'SAFE TO PROCEED',
    agent: v.card, catalogUrl: v.catalogUrl, payment: instructions }, null, 2));
  else {
    console.log('AGENT: ' + (v.card ? v.card.name : '?'));
    console.log('CATALOG: ' + v.catalogUrl);
    console.log('PAYMENT: send ' + first.priceCents + ' cents (' + instructions.asset + ', chain ' +
      instructions.chain + ') to ' + cat.seller + ' for resource "' + first.id + '"');
    console.log('VERDICT: SAFE TO PROCEED');
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(2); });
