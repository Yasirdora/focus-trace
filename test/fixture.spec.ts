import { test, expect } from '../dist/test.js';

test('automatic fixture records before the test body and exposes attach', async ({ page, focusTrace }, testInfo) => {
  await page.route('https://focus-trace.test/fixture', route => route.fulfill({ contentType: 'text/html', body: '<button id="fixture-button">Button</button>' }));
  await page.goto('https://focus-trace.test/fixture');
  await page.locator('button').focus();
  const report = await focusTrace.snapshot('fixture check');
  expect(report.events[0]?.kind).toBe('document');
  expect(report.events.some(event => event.target?.id === 'fixture-button')).toBe(true);
  await focusTrace.attach(testInfo);
  expect(testInfo.attachments.map(item => item.name)).toEqual(['focus-trace.json', 'focus-trace.html']);
});
