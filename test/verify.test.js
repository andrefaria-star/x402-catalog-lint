'use strict';
/* Offline proof for agent-verify: dedicated fixture-server process,
 * async spawn children, bounded killers, context-rich failures. */
const { spawn } = require('child_process');
const path = require('path');
const BIN = path.join(__dirname, '..', 'bin', 'agent-verify.js');
const MOCK = path.join(__dirname, 'mock-server.js');

function run(args) {
  return new Promise(resolve => {
    const c = spawn('node', [BIN, ...args]);
    let out = '';
    c.stdout.on('data', d => out += d);
    c.stderr.on('data', d => out += d);
    const killer = setTimeout(() => c.kill('SIGKILL'), 10000);
    c.on('close', code => { clearTimeout(killer); resolve({ rc: code, out }); });
  });
}
(async () => {
  const base = await new Promise((res, rej) => {
    const m = spawn('node', [MOCK]);
    let buf = '';
    m.stdout.on('data', d => { buf += d; const mt = buf.match(/PORT=(\d+)/); if (mt) res({ proc: m, url: 'http://127.0.0.1:' + mt[1] }); });
    m.stderr.on('data', d => process.stderr.write('[mock] ' + d));
    m.on('close', code => rej(new Error('mock died early rc=' + code)));
    setTimeout(() => rej(new Error('mock boot timeout')), 5000);
  });
  let fails = 0;
  const t = (n, cond, ctx) => { console.log((cond ? 'ok   ' : 'FAIL ') + n); if (!cond) { fails++; if (ctx) console.log('     ctx:', String(ctx).slice(0, 300)); } };

  const g = await run([base.url + '/full-good', '--json']);
  let gj = null; try { gj = JSON.parse(g.out); } catch (_) {}
  t('good rc=0', g.rc === 0, g.out.slice(0, 250));
  t('good verdict TRUSTWORTHY', gj && gj.verdict === 'TRUSTWORTHY', g.out.slice(0, 250));
  t('good discovered catalog url', gj && gj.catalogUrl && gj.catalogUrl.endsWith('/v1/catalog'), gj);

  const b = await run([base.url + '/full-bad', '--json']);
  let bj = null; try { bj = JSON.parse(b.out); } catch (_) {}
  t('bad rc=1', b.rc === 1);
  t('bad verdict NOT TRUSTWORTHY', bj && bj.verdict === 'NOT TRUSTWORTHY');
  t('bad names card problems', bj && Array.isArray(bj.problems) && bj.problems.length >= 2);

  // ERC-8004 shape (contact.eth): must also verify GREEN end-to-end
  {
    const r = await run([base.url + '/erc-good', '--json']);
    let j = null; try { j = JSON.parse(r.out); } catch (_) {}
    t('erc8004 rc=0', r.rc === 0, r.out.slice(0, 250));
    t('erc8004 verdict TRUSTWORTHY', j && j.verdict === 'TRUSTWORTHY', j && j.problems);
  }

  const d = await run(['http://127.0.0.1:9/card.json', '--json']);
  t('dead rc=2', d.rc === 2);

  base.proc.kill();
  console.log(fails ? `VERIFY SUITE RED (${fails})` : 'VERIFY SUITE GREEN');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS:', e.message); process.exit(1); });
