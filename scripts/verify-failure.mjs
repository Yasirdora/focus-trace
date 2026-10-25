import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'focus-trace-fixture-'));
try {
  const report = join(dir, 'result.json');
  writeFileSync(join(dir, 'config.mjs'), `export default ${JSON.stringify({
    testDir: join(root, 'test/fixture-cases'), testMatch: 'failure.ts',
    outputDir: join(dir, 'results'), retries: 0, workers: 1,
    use: process.env.FOCUS_TRACE_CHANNEL ? { channel: process.env.FOCUS_TRACE_CHANNEL } : {},
    reporter: [['json', { outputFile: report }]],
  })};`);
  const result = spawnSync(process.execPath, [join(root, 'node_modules/playwright/cli.js'), 'test', '--config', join(dir, 'config.mjs')], { cwd: root, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 1, result.stderr);
  const data = JSON.parse(readFileSync(report, 'utf8'));
  const attachments = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests) for (const run of test.results) attachments.push(...run.attachments);
    for (const child of suite.suites ?? []) walk(child);
  }
  walk(data);
  const json = attachments.find(item => item.name === 'focus-trace.json');
  assert.ok(json, 'Failure did not produce focus-trace.json; inspect browser startup and fixture execution.');
  assert.ok(attachments.some(item => item.name === 'focus-trace.html'));
  const trace = JSON.parse(json.body ? Buffer.from(json.body, 'base64').toString() : readFileSync(json.path, 'utf8'));
  assert.ok(trace.events.some(event => event.target?.id === 'actual'));
  console.log('Intentional browser-test failure produced JSON and HTML focus attachments.');
} finally { rmSync(dir, { recursive: true, force: true }); }
