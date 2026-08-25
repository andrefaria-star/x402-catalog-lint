#!/usr/bin/env node
'use strict';
/* Dedicated fixture-server process for catalog-lint / agent-verify tests.
 * Owns its own event loop - no contention with test parent or tool children.
 * Routes:
 *   /bad            -> BAD catalog          /v1/catalog -> GOOD catalog
 *   /card-match     -> card matching seller /card-mismatch -> imposter card
 *   /full-good      -> complete valid agent card (catalogUrl points at self)
 *   /full-bad       -> broken agent card
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
const FULL_BAD_CARD = { type: '', id: 'not-a-number', wallet: { address: 'zzz' } };

const srv = http.createServer((req, res) => {
  let body;
  if (req.url.startsWith('/bad')) body = BAD;
  else if (req.url.includes('card-match')) body = CARD_MATCH;
  else if (req.url.includes('card-mismatch')) body = CARD_MISMATCH;
  else if (req.url.includes('full-good')) {
    const b = 'http://127.0.0.1:' + srv.address().port;
    body = { type: 'agent', id: 68028, name: 'demo-agent',
             wallet: { address: GOOD.seller, chain: 'base' },
             catalogUrl: b + '/v1/catalog' };
  }
  else if (req.url.includes('full-bad')) body = FULL_BAD_CARD;
  else body = GOOD;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
});
srv.listen(0, '127.0.0.1', () => console.log('PORT=' + srv.address().port));
