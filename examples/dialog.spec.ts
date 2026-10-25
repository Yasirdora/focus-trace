import { test, expect } from '../dist/test.js';

test('closing a modal restores focus to its trigger', async ({ page }) => {
  await page.route('https://focus-trace.test/dialog', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="en"><title>Dialog fixture</title>
      <button id="open">Edit profile</button>
      <dialog aria-label="Edit profile"><label>Name <input></label><button id="close">Done</button></dialog>
      <script>
        const dialog = document.querySelector('dialog');
        document.querySelector('#open').onclick = () => dialog.showModal();
        document.querySelector('#close').onclick = () => dialog.close();
      </script></html>`,
  }));
  await page.goto('https://focus-trace.test/dialog');
  const trigger = page.getByRole('button', { name: 'Edit profile' });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
