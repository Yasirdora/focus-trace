import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startFocusTrace, renderHtml } from '../../dist/index.js';

// Protocol fake, not a DOM simulator. Browser behavior is tested separately.
function transport() {
  const frame = {};
  let binding;
  let installed = false;
  const state = { failFlush: false, flushes: 0, scripts: 0 };
  const page = {
    mainFrame: () => frame,
    exposeBinding: async (_name, callback) => { binding = callback; },
    addInitScript: async () => { state.scripts++; },
    evaluate: async () => {
      if (!installed) { installed = true; return; }
      state.flushes++;
      if (state.failFlush) throw new Error('Execution context destroyed');
    },
  };
  return { page, state, send: (event, token = 'document-a', source = frame) => binding({ frame: source }, { token, event }) };
}
const event = (overrides = {}) => ({ elapsed: 1, kind: 'focusin', target: { node: 1, tag: 'button', id: 'open', testId: null }, related: null, key: null, label: null, ...overrides });

test('protocol assigns receipt sequence and separate document identities', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  assert.equal(t.send(event()), true);
  t.send(event(), 'document-b'); t.send(event(), 'document-a');
  const report = await trace.stop();
  assert.deepEqual(report.events.map(e => [e.sequence, e.document]), [[1,1],[2,2],[3,1]]);
  assert.equal(report.incomplete, false);
});

test('host enforces a global cap across navigations', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page, { maxEvents: 2 });
  t.send(event(), 'a'); t.send(event(), 'b');
  assert.equal(t.send(event(), 'c'), false);
  const report = await trace.stop();
  assert.equal(report.truncated, true);
  assert.equal(report.events.length, 2);
});

test('browser limit notice marks truncation without an invented event', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  t.send(event()); assert.equal(t.send(null), false);
  const report = await trace.stop();
  assert.equal(report.truncated, true); assert.equal(report.events.length, 1);
});

test('subframe messages cannot enter the main-document timeline', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  assert.equal(t.send(event(), 'child', {}), false);
  assert.deepEqual((await trace.stop()).events, []);
});

test('concurrent stops flush once and reject later events', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  t.send(event());
  const [a,b] = await Promise.all([trace.stop(),trace.stop()]);
  assert.equal(t.state.flushes, 1); assert.deepEqual(a,b);
  assert.equal(t.send(event()), false);
  a.events.length = 0;
  assert.equal((await trace.snapshot()).events.length, 1);
});

test('lost execution context preserves the prior trace and marks incomplete', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  t.send(event()); t.state.failFlush = true;
  const report = await trace.stop();
  assert.equal(report.incomplete, true); assert.equal(report.events.length, 1);
});

test('attachments contain the same stopped report in JSON and HTML', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  t.send(event()); await trace.stop();
  const attached = [];
  await trace.attach({ attach: async (name, options) => attached.push({ name, ...options }) });
  assert.deepEqual(attached.map(a => a.name), ['focus-trace.json','focus-trace.html']);
  assert.equal(JSON.parse(attached[0].body.toString()).events[0].target.id, 'open');
  assert.match(attached[1].body.toString(), /button#open/);
});

test('snapshot reports are detached from host storage', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  t.send(event()); const snapshot = await trace.snapshot();
  snapshot.events[0].target.id = 'changed';
  assert.equal((await trace.stop()).events[0].target.id, 'open');
});

test('options, labels and recorder lifecycle have explicit errors', async () => {
  const t = transport();
  for (const maxEvents of [-1, 0, 0.5, Infinity, 100001]) await assert.rejects(startFocusTrace(t.page, { maxEvents }), RangeError);
  await assert.rejects(startFocusTrace(t.page, { identifiers: 'yes' }), TypeError);
  const trace = await startFocusTrace(t.page);
  await assert.rejects(startFocusTrace(t.page), /already exists/);
  await assert.rejects(trace.snapshot('x'.repeat(121)), RangeError);
  await trace.stop();
});

test('standalone HTML escapes text and explicitly reports missing evidence', () => {
  const report = { schemaVersion: 1, truncated: true, incomplete: true, events: [{ ...event({ label: '<img onerror="bad">', target: { node: 1, tag: 'button', id: '</td><script>bad</script>', testId: null } }), sequence: 1, document: 1 }] };
  const html = renderHtml(report);
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Event limit reached/);
  assert.match(html, /may be incomplete/);
  assert.match(html, /default-src 'none'/);
});

test('a browser-reported listener gap marks the whole report incomplete', async () => {
  const t = transport(); const trace = await startFocusTrace(t.page);
  t.send(event({ kind: 'gap', label: 'Document listeners were removed; recording resumed.' }));
  const report = await trace.stop();
  assert.equal(report.incomplete, true);
  assert.equal(report.events[0].kind, 'gap');
});
