import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'focus-trace-consumer-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
try {
  run(npm, ['run', 'build'], root);
  const packed = JSON.parse(run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root))[0];
  const files = packed.files.map(file => file.path);
  for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/test.js', 'dist/test.d.ts', 'README.md', 'docs/validation.md']) assert.ok(files.includes(file), `Missing ${file}`);
  assert.ok(files.every(file => /^(dist\/|docs\/|README.md$|package.json$)/.test(file)), 'Unexpected packed file');

  const consumer = join(scratch, 'consumer');
  mkdirSync(consumer);
  const source = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const tarball = `file:${join(scratch, packed.filename)}`;
  const manifest = { name: 'focus-trace-consumer-check', version: '1.0.0', private: true, type: 'module',
    dependencies: { [source.name]: tarball }, devDependencies: source.devDependencies };
  // Reuse the pinned dependency graph, not the repository's node_modules.
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  lock.name = manifest.name; lock.version = manifest.version;
  lock.packages[''] = { name: manifest.name, version: manifest.version,
    dependencies: manifest.dependencies, devDependencies: manifest.devDependencies };
  lock.packages[`node_modules/${source.name}`] = { version: source.version,
    resolved: tarball, integrity: packed.integrity, peerDependencies: source.peerDependencies, engines: source.engines };
  writeFileSync(join(consumer, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(consumer, 'package-lock.json'), JSON.stringify(lock));
  run(npm, ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], consumer);
  writeFileSync(join(consumer, 'consumer.mts'), `import { renderHtml, startFocusTrace, type FocusReport } from '@yasirdora/focus-trace';
import { test, expect } from '@yasirdora/focus-trace/test';
const report: FocusReport = { schemaVersion: 1, events: [], truncated: false, incomplete: false };
if (!renderHtml(report).includes('Focus trace')) throw new Error('Missing report');
if (typeof startFocusTrace !== 'function' || typeof test.extend !== 'function' || typeof expect !== 'function') throw new Error('Missing export');
`);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--outDir', 'out', 'consumer.mts'], consumer);
  run(process.execPath, ['out/consumer.mjs'], consumer);
  console.log('Clean offline install, both ESM export paths and TypeScript consumer declarations passed. No browser was launched.');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
