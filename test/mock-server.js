#!/usr/bin/env node
'use strict';
/* Dedicated fixture-server process for catalog-lint tests.
 * Owns its own event loop - no contention with test parent or lint child.
 * /bad -> BAD catalog; everything else -> GOOD catalog.
 * Prints PORT=<n> on stdout when ready. */
const http = require('http');
const GOOD = {
  service: 'demo', chain: 'base', currency: 'USDC',
  seller: '0x' + 'a'.repeat(40),
  resources: [{ id: 'cpu-minute', priceCents: 1 }]
};
const BAD = {
  service: 'demo', chain: 'base', currency: 'EUR', seller: 'nope',
  resources: [{ id: null }, {}]
};
const CARD_MATCH = { name: 'demo-agent', wallet: { address: GOOD.seller, chain: 'base' } };
const CARD_MISMATCH = { name: 'imposter', wallet: { address: '0x' + 'f'.repeat(40), chain: 'base' } };
const srv = http.createServer((req, res) => {
  let body;
  if (req.url.startsWith('/bad')) body = BAD;
  else if (req.url.includes('card-match')) body = CARD_MATCH;
  else if (req.url.includes('card-mismatch')) body = CARD_MISMATCH;
  else body = GOOD;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
});
srv.listen(0, '127.0.0.1', () => console.log('PORT=' + srv.address().port));
