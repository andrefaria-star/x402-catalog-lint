#!/usr/bin/env node
'use strict';
/* catalog-init - scaffold an x402-style storefront that passes lint by construction.
 *   node catalog-init.js <dir> --seller 0x... [--name my-agent] [--price-cents N]
 * Writes: catalog.json, .well-known/agent-card.json, server.js (zero-dep), README.md
 * Refuses non-empty target dirs (safety). Exit 0 scaffolded / 2 bad input. */
const fs = require('fs');
const path = require('path');

(async () => {
  const args = process.argv.slice(2);
  const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const dir = args.find(a => !a.startsWith('--'));
  const seller = get('--seller');
  const name = get('--name') || 'my-agent';
  const priceCents = parseInt(get('--price-cents') || '1', 10);
  if (!dir || !seller || !/^0x[0-9a-fA-F]{40}$/.test(seller)) {
    console.error('usage: catalog-init.js <dir> --seller 0x<40hex> [--name n] [--price-cents n]');
    process.exit(2);
  }
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) {
    console.error('refusing: target dir not empty'); process.exit(2);
  }
  fs.mkdirSync(path.join(dir, '.well-known'), { recursive: true });

  const catalog = {
    service: name, chain: 'base', currency: 'USDC', seller,
    resources: [{ id: 'unit', description: 'one unit of service',
                  priceCents, paymentScheme: 'x402' }]
  };
  // Card advertises THIS catalog so onboard discovers it with zero flags.
  const cardNote = 'AFTER STARTING THE SERVER, replace CATALOG_URL_HERE with';
  const card = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#identity',
    name, description: 'Storefront scaffolded by x402-catalog-lint (catalog-init).',
    'CATALOG_URL_COMMENT': cardNote,
    catalogUrl: 'http://localhost:PORT/v1/catalog',
    identityCard: null, wallet: { address: seller, chain: 'base' }
  };
  const server = `#!/usr/bin/env node
'use strict';
/* Zero-dependency storefront server scaffolded by catalog-init. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json')));
const card = JSON.parse(fs.readFileSync(path.join(ROOT, '.well-known', 'agent-card.json')));
const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/v1/catalog') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(catalog));
  }
  if (url === '/.well-known/agent-card.json') {
    const c = { ...card, catalogUrl: 'http://localhost:' + srv.address().port + '/v1/catalog' };
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(c));
  }
  res.writeHead(404); res.end('not found');
});
srv.listen(process.env.PORT || 8080, () =>
  console.log('storefront on http://localhost:' + srv.address().port));
`;
  const readme = `# ${name} storefront\n\nScaffolded by x402-catalog-lint.\n\n\`\`\`sh\nPORT=8080 node server.js\nnpx github:andrefaria-star/x402-catalog-lint http://localhost:8080/v1/catalog   # -> VALID\nnpx github:andrefaria-star/x402-catalog-lint/bin/onboard.js http://localhost:8080/.well-known/agent-card.json  # -> SAFE TO PROCEED\n\`\`\`\n`;
  fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2));
  fs.writeFileSync(path.join(dir, '.well-known', 'agent-card.json'), JSON.stringify(card, null, 2));
  fs.writeFileSync(path.join(dir, 'server.js'), server);
  fs.writeFileSync(path.join(dir, 'README.md'), readme);
  console.log(`scaffolded ${dir} (seller ${seller.slice(0, 10)}..., ${priceCents}c/unit)`);
})().catch(e => { console.error('ERR', e.message); process.exit(2); });
