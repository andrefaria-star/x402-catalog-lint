'use strict';
/* Offline proof for catalog-lint: dedicated fixture-server process,
 * async spawn (parent loop stays free), context-rich failures. */
const { spawn } = require('child_process');
const path = require('path');
const BIN = path.join(__dirname, '..', 'bin', 'catalog-lint.js');
const MOCK = path.join(__dirname, 'mock-server.js');

function run(args) {
  return new Promise(resolve => {
    const c = spawn('node', [BIN, ...args]);
    let out = '';
    c.stdout.on('data', d => out += d);
    const killer = setTimeout(() => c.kill('SIGKILL'), 10000);
    c.on('close', code => { clearTimeout(killer); resolve({ rc: code, out }); });
  });
}
(async () => {
  const base = await new Promise((res, rej) => {
    const m = spawn('node', [MOCK]);
    let buf = '';
    m.stdout.on('data', d => {
      buf += d;
      const mt = buf.match(/PORT=(\d+)/);
      if (mt) res({ proc: m, url: 'http://127.0.0.1:' + mt[1] });
    });
    setTimeout(() => rej(new Error('mock boot timeout')), 5000).unref();
  });
  let fails = 0;
  const t = (n, cond, ctx) => { console.log((cond ? 'ok   ' : 'FAIL ') + n); if (!cond) { fails++; if (ctx) console.log('     ctx:', ctx); } };

  const good = await run([base.url + '/v1/catalog', '--json']);
  let gj = null; try { gj = JSON.parse(good.out); } catch (_) {}
  t('good rc=0', good.rc === 0, good.out.slice(0, 150));
  t('good verdict VALID', gj && gj.verdict === 'VALID');

  const bad = await run([base.url + '/bad', '--json']);
  let bj = null; try { bj = JSON.parse(bad.out); } catch (_) {}
  t('bad rc=1', bad.rc === 1, bad.out.slice(0, 150));
  t('bad verdict INVALID', bj && bj.verdict === 'INVALID');
  t('bad lists >=4 problems', bj && Array.isArray(bj.problems) && bj.problems.length >= 4);

  const dead = await run(['http://127.0.0.1:9/x', '--json']);
  let dj = null; try { dj = JSON.parse(dead.out); } catch (_) {}
  t('dead rc=2', dead.rc === 2);
  t('dead verdict UNREACHABLE', dj && dj.verdict === 'UNREACHABLE');

  // IDENTITY MATCH: catalog + matching card -> VALID rc=0
  {
    const r = await run([base.url + '/v1/catalog', '--identity', base.url + '/card-match', '--json']);
    let j = null; try { j = JSON.parse(r.out); } catch (_) {}
    t('ident-match rc=0', r.rc === 0, r.out.slice(0, 150));
    t('ident-match verdict VALID', j && j.verdict === 'VALID', j && j.problems);
  }
  // IDENTITY MISMATCH: imposter card -> INVALID rc=1 with MISMATCH problem
  {
    const r = await run([base.url + '/v1/catalog', '--identity', base.url + '/card-mismatch', '--json']);
    let j = null; try { j = JSON.parse(r.out); } catch (_) {}
    t('ident-mismatch rc=1', r.rc === 1);
    t('ident-mismatch verdict INVALID', j && j.verdict === 'INVALID');
    t('mismatch names the problem', j && Array.isArray(j.problems) &&
      j.problems.some(p => p.includes('MISMATCH')));
  }

  base.proc.kill();
  console.log(fails ? `CATALOG-LINT SUITE RED (${fails})` : 'CATALOG-LINT SUITE GREEN');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS:', e.message); process.exit(1); });
