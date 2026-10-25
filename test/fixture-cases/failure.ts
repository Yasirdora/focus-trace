import { test, expect } from '../../dist/test.js';

test('intentional failure to verify automatic attachments', async ({ page }) => {
  await page.route('https://focus-trace.test/fixture', route => route.fulfill({ contentType: 'text/html', body: '<button id="expected">Expected</button><button id="actual">Actual</button>' }));
  await page.goto('https://focus-trace.test/fixture');
  await page.locator('#actual').focus();
  await expect(page.locator('#expected')).toBeFocused({ timeout: 100 });
});
