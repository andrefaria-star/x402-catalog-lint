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
const srv = http.createServer((req, res) => {
  const body = req.url.startsWith('/bad') ? BAD : GOOD;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
});
srv.listen(0, '127.0.0.1', () => console.log('PORT=' + srv.address().port));
