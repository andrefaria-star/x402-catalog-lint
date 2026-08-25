#!/usr/bin/env node
'use strict';
/* Polls GitHub traffic API for this repo's clones and appends to evidence/traffic.jsonl.
 * Usage: node tools/lint-traffic.js [--once]
 * Needs GITHUB_TOKEN (repo scope). Rows: {seq,date,clones,uniques,ts}. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EV = path.join(__dirname, '..', 'evidence', 'traffic.jsonl');

function sha(s){ return crypto.createHash('sha256').update(s).digest('hex'); }
function lastRow(){
  if (!fs.existsSync(EV)) return null;
  const lines = fs.readFileSync(EV,'utf8').trim().split('\n').filter(Boolean);
  return lines.length ? JSON.parse(lines[lines.length-1]) : null;
}
function append(row){
  const prev = lastRow();
  const seq = prev ? prev.seq + 1 : 0;
  const payload = { ...row, seq, prevHash: prev ? prev.hash : null };
  const hash = sha(JSON.stringify(payload));
  fs.appendFileSync(EV, JSON.stringify({ ...payload, hash }) + '\n');
  return hash;
}
(async () => {
  const tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!tok) { console.error('NO-TOKEN'); process.exit(2); }
  const r = await fetch('https://api.github.com/repos/andrefaria-star/x402-catalog-lint/traffic/clones',
    { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json' } });
  if (!r.ok) { console.error('HTTP', r.status); process.exit(1); }
  const j = await r.json();
  const agg = (j.clones || []).reduce((a,d)=>({ c:a.c+d.count, u:a.u+d.uniques }), {c:0,u:0});
  const row = { date: new Date().toISOString().slice(0,10), clones: agg.c, uniques: agg.u,
                ts: new Date().toISOString() };
  const h = append(row);
  console.log(`recorded seq=${lastRow().seq} clones=${row.clones} uniques=${row.uniques} head=${h.slice(0,12)}`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
