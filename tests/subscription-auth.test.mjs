import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sources = Object.fromEntries(await Promise.all(['gatekeeper', 'paid-access'].map(async name => [name, await readFile(new URL('../lib/' + name + '.ts', import.meta.url), 'utf8')])));
function load(name, user, rpcResult = { data: { allowed: true, admin: false }, error: null }, authFails = false) {
  const calls = [];
  const db = {
    auth: { getUser: async () => { calls.push('auth'); if (authFails) throw new Error('Auth unavailable'); return { data: { user } }; } },
    rpc: async (...args) => { calls.push(args[0]); return rpcResult; },
  };
  const source = sources[name].replace(/^import .*;\r?\n/gm, '');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  new Function('exports', 'createClient', 'getOrCreateProfile', 'subscriptionsEnabled', compiled)(exports, async () => db, async () => ({ data: { role: 'student' }, error: null }), () => process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true');
  return { call: () => name === 'gatekeeper' ? exports.checkAccess('teaching') : exports.checkPaidAccess(), calls };
}
async function flag(value, run) {
  const old = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED;
  if (value === undefined) delete process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED;
  else process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED = value;
  try { await run(); } finally { if (old === undefined) delete process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED; else process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED = old; }
}
for (const name of ['gatekeeper', 'paid-access']) {
  for (const value of [undefined, 'false', 'true']) {
    test(`${name}: unauthenticated users stay blocked with switch ${String(value)}`, () => flag(value, async () => {
      const check = load(name, null);
      assert.equal((await check.call()).status, 401);
      assert.deepEqual(check.calls, ['auth']);
    }));
  }
  for (const value of [undefined, 'false']) {
    test(`${name}: authenticated users are unlocked without quota debit with switch ${String(value)}`, () => flag(value, async () => {
      const check = load(name, { id: 'student' });
      const result = await check.call();
      assert.equal(result.allowed, true); assert.equal(result.status, 200);
      assert.notEqual(result.isAdmin, true); assert.deepEqual(check.calls, ['auth']);
    }));
  }
  test(`${name}: enabled subscriptions preserve paid-access enforcement`, () => flag('true', async () => {
    const check = load(name, { id: 'student' }, { data: { allowed: false, message: 'Plan required' }, error: null });
    assert.equal((await check.call()).allowed, false);
    assert.deepEqual(check.calls, ['auth', name === 'gatekeeper' ? 'reserve_ai_request' : 'authorize_study_feature']);
  }));
  test(`${name}: authentication outage fails closed while subscriptions are paused`, () => flag('false', async () => {
    const check = load(name, { id: 'student' }, undefined, true);
    const result = await check.call(); assert.equal(result.allowed, false); assert.equal(result.status, 503);
    assert.deepEqual(check.calls, ['auth']);
  }));
}
