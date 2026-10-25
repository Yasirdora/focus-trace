import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from 'playwright/test';
import { installRecorder } from './recorder.js';
import { renderHtml } from './report.js';
import type { BrowserConfig, BrowserMessage, FocusReport, FocusTraceOptions } from './types.js';
export type { ElementRef, EventKind, FocusEvent, FocusReport, FocusTraceOptions } from './types.js';
export { renderHtml } from './report.js';

const usedPages = new WeakSet<Page>();

export interface FocusTrace {
  /** Flush delivered events and include the currently focused element. */
  snapshot(label?: string): Promise<FocusReport>;
  /** Stop listeners in the current document. Idempotent; returns a detached report. */
  stop(): Promise<FocusReport>;
  /** Attach JSON and self-contained HTML to a Playwright test result. */
  attach(testInfo: Pick<TestInfo, 'attach'>): Promise<void>;
}

export async function startFocusTrace(page: Page, options: FocusTraceOptions = {}): Promise<FocusTrace> {
  const maxEvents = options.maxEvents ?? 2000;
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 100000) {
    throw new RangeError('maxEvents must be an integer from 1 to 100000');
  }
  if (options.identifiers !== undefined && typeof options.identifiers !== 'boolean') throw new TypeError('identifiers must be a boolean');
  if (usedPages.has(page)) throw new Error('A focus trace already exists for this page. Create one recorder per page.');
  usedPages.add(page);
  const suffix = randomUUID().replaceAll('-', '');
  const config: BrowserConfig = { binding: `__focusTraceSend_${suffix}`, slot: `__focusTrace_${suffix}`, maxEvents, identifiers: options.identifiers ?? true };
  const report: FocusReport = { schemaVersion: 1, events: [], truncated: false, incomplete: false };
  const documents = new Map<string, number>();
  let stopped = false;
  let stopping: Promise<FocusReport> | undefined;
  const copy = (): FocusReport => structuredClone(report);
  await page.exposeBinding(config.binding, (source, message: BrowserMessage) => {
    if (stopped || source.frame !== page.mainFrame()) return false;
    if (!message.event || report.events.length >= maxEvents) {
      report.truncated = true;
      return false;
    }
    if (message.event.kind === 'gap') report.incomplete = true;
    if (!documents.has(message.token)) documents.set(message.token, documents.size + 1);
    report.events.push({ ...message.event, sequence: report.events.length + 1, document: documents.get(message.token)! });
    return true;
  });
  await page.addInitScript(installRecorder, config);
  await page.evaluate(installRecorder, config);

  async function flush(label: string | null, stop: boolean): Promise<void> {
    try {
      await page.evaluate(async ({ slot, label, stop }) => {
        const recorder = (window as unknown as Record<string, { flush(label: string | null, stop: boolean): Promise<void> }>)[slot];
        if (!recorder) throw new Error('Recorder unavailable');
        await recorder.flush(label, stop);
      }, { slot: config.slot, label, stop });
    } catch {
      // Preserve evidence even if a crash, close or navigation prevents a flush.
      report.incomplete = true;
    }
  }
  const trace: FocusTrace = {
    async snapshot(label = 'snapshot') {
      if (typeof label !== 'string' || label.length > 120) throw new RangeError('Checkpoint labels must be strings of at most 120 characters');
      if (!stopped) await flush(label, false);
      return copy();
    },
    async stop() {
      stopping ??= (async () => {
        await flush('stop', true);
        stopped = true;
        return copy();
      })();
      return structuredClone(await stopping);
    },
    async attach(testInfo) {
      const result = stopped ? copy() : await trace.snapshot('attachment');
      await testInfo.attach('focus-trace.json', { body: Buffer.from(JSON.stringify(result, null, 2)), contentType: 'application/json' });
      await testInfo.attach('focus-trace.html', { body: Buffer.from(renderHtml(result)), contentType: 'text/html' });
    },
  };
  return trace;
}
