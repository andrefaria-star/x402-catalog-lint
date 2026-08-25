'use strict';
const { spawn } = require('child_process');
const path = require('path');
const BIN = path.join(__dirname, '..', 'bin', 'onboard.js');
const MOCK = path.join(__dirname, 'mock-server.js');
function run(args) {
  return new Promise(resolve => {
    const c = spawn('node', [BIN, ...args]);
    let out = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
    const k = setTimeout(() => c.kill('SIGKILL'), 10000);
    c.on('close', code => { clearTimeout(k); resolve({ rc: code, out }); });
  });
}
(async () => {
  const base = await new Promise((res, rej) => {
    const m = spawn('node', [MOCK]); let buf = '';
    m.stdout.on('data', d => { buf += d; const mt = buf.match(/PORT=(\d+)/); if (mt) res({ proc: m, url: 'http://127.0.0.1:' + mt[1] }); });
    m.stderr.on('data', d => process.stderr.write('[mock] ' + d));
    m.on('close', c => rej(new Error('mock died rc=' + c)));
    setTimeout(() => rej(new Error('boot timeout')), 5000);
  });
  let fails = 0;
  const t = (n, cond, ctx) => { console.log((cond ? 'ok   ' : 'FAIL ') + n); if (!cond) { fails++; if (ctx) console.log('     ctx:', String(ctx).slice(0, 250)); } };

  const g = await run([base.url + '/full-good', '--json']);
  let gj = null; try { gj = JSON.parse(g.out); } catch (_) {}
  t('good rc=0 SAFE', g.rc === 0, g.out.slice(0, 200));
  t('good payment has seller+cents', gj && gj.payment && /^0x[0-9a-f]{40}$/.test(gj.payment.payTo) && gj.payment.amountCents === 1, g.out.slice(0, 200));

  const b = await run([base.url + '/full-bad']);
  t('bad rc=1 DO NOT PAY', b.rc === 1 && b.out.includes('DO NOT PAY'), b.out.slice(0, 200));

  const d = await run(['http://127.0.0.1:9/c.json']);
  t('dead rc=2', d.rc === 2);

  base.proc.kill();
  console.log(fails ? `ONBOARD SUITE RED (${fails})` : 'ONBOARD SUITE GREEN');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS:', e.message); process.exit(1); });
