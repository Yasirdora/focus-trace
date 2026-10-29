import { test, expect } from '../../dist/test.js';

// A common bug: closing a dialog returns focus to the button that opened it, then
// the list re-renders, removes that button, and focus falls back to the page body.
test('closing the delete dialog keeps focus on its button', async ({ page }) => {
  await page.route('https://focus-trace.test/files', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="en"><title>Files</title>
      <ul id="files" data-version="0"></ul>
      <dialog id="confirm" aria-label="Delete file"><p>Delete this file?</p>
        <button id="cancel">Cancel</button><button id="delete">Delete</button></dialog>
      <script>
        const files = ['draft-1.fountain', 'draft-2.fountain'];
        const list = document.querySelector('#files');
        const dialog = document.querySelector('#confirm');
        function render() {
          list.innerHTML = files.map((name, index) =>
            '<li>' + name + ' <button id="delete-' + index + '">Delete</button></li>').join('');
          list.querySelectorAll('button').forEach(button => { button.onclick = () => dialog.showModal(); });
          list.dataset.version = String(Number(list.dataset.version) + 1);
        }
        dialog.addEventListener('close', render);
        document.querySelector('#cancel').onclick = () => dialog.close();
        render();
      </script></html>`,
  }));
  await page.goto('https://focus-trace.test/files');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#cancel')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#files')).toHaveAttribute('data-version', '2');
  await expect(page.locator('#delete-0')).toBeFocused({ timeout: 500 });
});
