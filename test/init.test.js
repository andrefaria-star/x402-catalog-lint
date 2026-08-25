'use strict';
/* Full-loop proof: scaffold a stranger-storefront, boot it, lint it, onboard it. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = path.join(__dirname, '..');
(async () => {
  let fails = 0;
  const t = (n, cond, ctx) => { console.log((cond ? 'ok   ' : 'FAIL ') + n); if (!cond) { fails++; if (ctx) console.log('     ctx:', String(ctx).slice(0, 250)); } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clinit-'));
  const store = path.join(tmp, 'store');

  const mk = await new Promise(res => {
    const c = spawn('node', [path.join(R, 'bin/catalog-init.js'), store,
      '--seller', '0x' + 'b'.repeat(40), '--name', 'stranger-agent']);
    let o = ''; c.stdout.on('data', d => o += d); c.stderr.on('data', d => o += d);
    c.on('close', rc => res({ rc, out: o }));
  });
  t('init rc=0', mk.rc === 0, mk.out);
  t('files exist', fs.existsSync(path.join(store, 'catalog.json')) &&
      fs.existsSync(path.join(store, '.well-known/agent-card.json')) &&
      fs.existsSync(path.join(store, 'server.js')));

  const srv = spawn('node', [path.join(store, 'server.js')], { env: { ...process.env, PORT: '0' } });
  let sbuf = '';
  const port = await new Promise((res, rej) => {
    srv.stdout.on('data', d => { sbuf += d; const m = sbuf.match(/localhost:(\d+)/); if (m) res(m[1]); });
    srv.stderr.on('data', d => process.stderr.write('[store] ' + d));
    setTimeout(() => rej(new Error('store boot timeout')), 5000);
  });
  const base = 'http://127.0.0.1:' + port;

  const lint = await new Promise(res => {
    const c = spawn('node', [path.join(R, 'bin/catalog-lint.js'), base + '/v1/catalog']);
    let o = ''; c.stdout.on('data', d => o += d);
    c.on('close', rc => res({ rc, out: o }));
  });
  t('bootstrapped store lints VALID rc=0', lint.rc === 0, lint.out);

  const ob = await new Promise(res => {
    const c = spawn('node', [path.join(R, 'bin/onboard.js'), base + '/.well-known/agent-card.json', '--json']);
    let o = ''; c.stdout.on('data', d => o += d);
    c.on('close', rc => res({ rc, out: o }));
  });
  let oj = null; try { oj = JSON.parse(ob.out); } catch (_) {}
  t('bootstrap onboard rc=0', ob.rc === 0, ob.out.slice(0, 200));
  t('bootstrap payTo == scaffolded seller', oj && oj.payment && oj.payment.payTo === '0x' + 'b'.repeat(40));

  // refusal polarity: non-empty dir must be refused
  const ref = await new Promise(res => {
    const c = spawn('node', [path.join(R, 'bin/catalog-init.js'), store, '--seller', '0x' + 'b'.repeat(40)]);
    c.on('close', rc => res(rc));
  });
  t('refuses non-empty dir rc!=0', ref !== 0 && ref !== undefined);

  srv.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `INIT SUITE RED (${fails})` : 'INIT SUITE GREEN');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS:', e.message); process.exit(1); });
