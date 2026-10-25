import { test as base } from 'playwright/test';
import { startFocusTrace } from './index.js';
import type { FocusTrace } from './index.js';
import type { FocusTraceOptions } from './types.js';

export const test = base.extend<{ focusTrace: FocusTrace; focusTraceOptions: FocusTraceOptions }>({
  focusTraceOptions: [{}, { option: true }],
  focusTrace: [async ({ page, focusTraceOptions }, use, testInfo) => {
    const trace = await startFocusTrace(page, focusTraceOptions);
    try {
      await use(trace);
    } finally {
      await trace.stop();
      if (testInfo.status !== testInfo.expectedStatus) await trace.attach(testInfo);
    }
  }, { auto: true }],
});
export { expect } from 'playwright/test';
