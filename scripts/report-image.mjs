// Runs the lost-focus demo test, which fails on purpose, and saves a picture
// of the HTML report it attaches to docs/report.png.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../', import.meta.url));
const channel = process.env.FOCUS_TRACE_CHANNEL;
const dir = mkdtempSync(join(tmpdir(), 'focus-trace-image-'));
try {
  const report = join(dir, 'result.json');
  writeFileSync(join(dir, 'config.mjs'), `export default ${JSON.stringify({
    testDir: join(root, 'test/fixture-cases'), testMatch: 'lost-focus.ts',
    outputDir: join(dir, 'results'), retries: 0, workers: 1,
    use: channel ? { channel } : {},
    reporter: [['json', { outputFile: report }]],
  })};`);
  const result = spawnSync(process.execPath, [join(root, 'node_modules/playwright/cli.js'), 'test', '--config', join(dir, 'config.mjs')], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (result.status !== 1) throw new Error(`The demo test should fail once; it exited ${result.status}.\n${result.stderr}`);
  const attachments = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests) for (const run of test.results) attachments.push(...run.attachments);
    for (const child of suite.suites ?? []) walk(child);
  }
  walk(JSON.parse(readFileSync(report, 'utf8')));
  const html = attachments.find(item => item.name === 'focus-trace.html');
  if (!html) throw new Error('The demo failure did not attach focus-trace.html.');
  const file = html.path ?? join(dir, 'focus-trace.html');
  if (!html.path) writeFileSync(file, Buffer.from(html.body, 'base64'));
  const browser = await chromium.launch(channel ? { channel } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(file).href);
    await page.screenshot({ path: join(root, 'docs/report.png'), fullPage: true });
  } finally { await browser.close(); }
  console.log('Saved docs/report.png from the lost-focus demo report.');
} finally { rmSync(dir, { recursive: true, force: true }); }
