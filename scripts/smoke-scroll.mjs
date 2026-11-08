import { _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const env = { ...process.env, ROOMSHIFT_FAKE_CAMERA: '1', ROOMSHIFT_TEST_DATA: resolve('.local-test', `scroll-${Date.now()}`) };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
try {
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1120, 700));
  await page.getByText('LIVE PREVIEW', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Try an example room' }).click();
  await page.locator('.layers').getByRole('button', { name: 'Slow living', exact: true }).click();
  const metrics = await page.evaluate(() => ({
    footer: document.querySelector('.statusbar').getBoundingClientRect().top,
    panels: ['.library', '.workspace', '.inspector'].map(selector => {
      const element = document.querySelector(selector);
      return { selector, bottom: element.getBoundingClientRect().bottom, height: element.clientHeight, content: element.scrollHeight };
    }),
  }));
  console.log('Scroll layout:', JSON.stringify(metrics));
  for (const { selector, bottom, height, content } of metrics.panels) {
    assert.ok(bottom <= metrics.footer + 1, `${selector} extends below the visible workspace`);
    assert.ok(content > height, `${selector} should have overflowing content at this window size`);
    const panel = page.locator(selector), rect = await panel.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + 25);
    await page.mouse.wheel(0, 420);
    await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 0, selector);
    await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
  }
  await page.getByRole('button', { name: 'Delete object', exact: true }).click();
  assert.equal(await page.locator('.layer').count(), 2);
  await page.getByRole('button', { name: 'Go live' }).click();
  const modal = page.locator('dialog');
  await modal.evaluate(element => { element.scrollTop = element.scrollHeight; });
  assert.ok(await modal.getByRole('button', { name: 'Official OBS guide' }).isVisible());
  console.log('Mouse-wheel scrolling passed for library, workspace, inspector, and dialog access.');
} finally { await app.close(); }
