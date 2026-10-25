import { test, expect, type Page } from 'playwright/test';
import { startFocusTrace, renderHtml } from '../dist/index.js';

async function load(page: Page, html: string) {
  await page.route('https://focus-trace.test/fixture', route => route.fulfill({ body: html, contentType: 'text/html' }));
  await page.goto('https://focus-trace.test/fixture');
}

const dialog = `<button id="open">Open dialog</button><dialog id="dialog"><input id="field"><button id="close">Close</button></dialog>
<script>
openButton = document.getElementById('open');
openButton.onclick = () => document.getElementById('dialog').showModal();
document.getElementById('close').onclick = () => document.getElementById('dialog').close();
</script>`;

test('records keyboard navigation and restored modal focus without changing behavior', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, dialog);
  await page.locator('#open').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#field')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#open')).toBeFocused();
  const report = await trace.stop();
  expect(report.incomplete).toBe(false);
  expect(report.events.filter(e => e.kind === 'keydown').map(e => e.key)).toEqual(['Enter', 'Tab', 'Escape']);
  expect(report.events.filter(e => e.kind === 'focusin').map(e => e.target?.id)).toEqual(['open', 'field', 'close', 'open']);
  expect(report.events.at(-1)?.target?.id).toBe('open');
});

test('captures removed focused elements and the resulting body focus', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, '<input id="removed"><button id="next">Next</button>');
  await page.locator('#removed').focus();
  await page.locator('#removed').evaluate(element => element.remove());
  const report = await trace.snapshot('after removal');
  expect(report.events.find(e => e.kind === 'removed')?.target?.id).toBe('removed');
  expect(report.events.at(-1)?.target?.tag).toBe('body');
  await trace.stop();
});

test('redacts typed characters and does not collect values or text content', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, '<input id="password" type="password"><p>PRIVATE PAGE TEXT</p>');
  await page.locator('#password').fill('secret-value');
  await page.keyboard.type('private-letters');
  await page.keyboard.press('Shift+Tab');
  const report = await trace.stop();
  const json = JSON.stringify(report);
  expect(json).not.toContain('secret-value');
  expect(json).not.toContain('private-letters');
  expect(json).not.toContain('PRIVATE PAGE TEXT');
  expect(report.events.filter(e => e.kind === 'keydown').map(e => e.key)).toEqual(['Shift+Tab']);
});

test('identifier collection can be disabled', async ({ page }) => {
  const trace = await startFocusTrace(page, { identifiers: false });
  await load(page, '<button id="sensitive-id" data-testid="private-test">Open</button>');
  await page.locator('button').click();
  const report = await trace.stop();
  expect(JSON.stringify(report)).not.toContain('sensitive-id');
  expect(JSON.stringify(report)).not.toContain('private-test');
  expect(report.events.some(e => e.target?.tag === 'button')).toBe(true);
});

test('open shadow roots expose the focused leaf and its removal', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, '<div id="host"></div>');
  await page.evaluate(() => {
    const root = document.querySelector('#host')!.attachShadow({ mode: 'open' });
    root.innerHTML = '<button id="inner">Inside</button>';
  });
  await page.locator('#inner').focus();
  await page.locator('#inner').evaluate(element => element.remove());
  const report = await trace.stop();
  expect(report.events.some(e => e.kind === 'focusin' && e.target?.id === 'inner')).toBe(true);
  expect(report.events.some(e => e.kind === 'removed' && e.target?.id === 'inner')).toBe(true);
});

test('navigation preserves prior documents and initializes the next document', async ({ page }) => {
  await page.route('https://focus-trace.test/**', route => route.fulfill({ body: '<button id="target">Target</button>', contentType: 'text/html' }));
  const trace = await startFocusTrace(page);
  await page.goto('https://focus-trace.test/one');
  await page.locator('button').focus();
  await trace.snapshot('before navigation');
  await page.goto('https://focus-trace.test/two');
  await page.locator('button').focus();
  const report = await trace.stop();
  const focuses = report.events.filter(e => e.kind === 'focusin');
  expect(focuses).toHaveLength(2);
  expect(focuses[0]!.document).not.toBe(focuses[1]!.document);
  expect(report.events.filter(e => e.kind === 'document')).toHaveLength(3);
});

test('bounded recording marks truncation explicitly', async ({ page }) => {
  const trace = await startFocusTrace(page, { maxEvents: 3 });
  await load(page, '<button>One</button><button>Two</button>');
  for (let i = 0; i < 10; i++) await page.keyboard.press('Tab');
  const report = await trace.stop();
  expect(report.events).toHaveLength(3);
  expect(report.truncated).toBe(true);
});

test('stop is idempotent, detaches listeners, and returns independent reports', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, '<button>One</button><button>Two</button>');
  const first = await trace.stop();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect(await trace.stop()).toEqual(first);
  first.events.length = 0;
  expect((await trace.snapshot()).events.length).toBeGreaterThan(0);
});

test('closed pages retain evidence and mark incomplete teardown', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, '<button id="before-close">One</button>');
  await page.locator('button').focus();
  await trace.snapshot();
  await page.close();
  const report = await trace.stop();
  expect(report.incomplete).toBe(true);
  expect(report.events.some(e => e.target?.id === 'before-close')).toBe(true);
});

test('iframe interiors are excluded', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, '<iframe srcdoc="<button id=frame-button>Inside</button>"></iframe>');
  await page.frameLocator('iframe').locator('button').click();
  const report = await trace.stop();
  expect(JSON.stringify(report)).not.toContain('frame-button');
  expect(report.events.at(-1)?.target?.tag).toBe('iframe');
});

test('HTML escapes identifiers and labels and has no executable scripts', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await load(page, '<button>One</button>');
  await page.locator('button').evaluate(element => { element.id = '<script>alert(1)</script>'; });
  await page.locator('button').focus();
  const report = await trace.snapshot('<img src=x onerror=alert(1)>');
  const html = renderHtml(report);
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('Content-Security-Policy');
  await trace.stop();
});

test('invalid options and duplicate recorders fail explicitly', async ({ page }) => {
  for (const maxEvents of [0, -1, 1.5, 100001, NaN]) {
    await expect(startFocusTrace(page, { maxEvents })).rejects.toThrow(RangeError);
  }
  const trace = await startFocusTrace(page);
  await expect(startFocusTrace(page)).rejects.toThrow('already exists');
  await expect(trace.snapshot('a'.repeat(121))).rejects.toThrow(RangeError);
  await trace.stop();
});


test('setContent listener loss is reported and recording resumes after a checkpoint', async ({ page }) => {
  const trace = await startFocusTrace(page);
  await page.setContent('<button id="after-reset">After reset</button>');
  await trace.snapshot('after setContent');
  await page.locator('button').focus();
  const report = await trace.stop();
  expect(report.incomplete).toBe(true);
  expect(report.events.some(e => e.kind === 'gap')).toBe(true);
  expect(report.events.some(e => e.kind === 'focusin' && e.target?.id === 'after-reset')).toBe(true);
});
