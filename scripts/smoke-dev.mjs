import { _electron as electron } from '@playwright/test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const server = await createServer(); await server.listen();
const env = { ...process.env, ROOMSHIFT_DEV_URL: 'http://127.0.0.1:5173', ROOMSHIFT_FAKE_CAMERA: '1', ROOMSHIFT_TEST_DATA: resolve('.local-test', `dev-${Date.now()}`) };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
try {
  const page = await app.firstWindow(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error' && !event.text().startsWith('INFO: Created TensorFlow Lite XNNPACK delegate')) errors.push(event.text()); });
  await page.getByRole('heading', { name: 'Room studio' }).waitFor({ timeout: 30000 });
  await page.getByText('LIVE PREVIEW', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('Occlusion active', { exact: true }).waitFor({ timeout: 60000 });
  assert.deepEqual(errors, []);
  console.log('Vite/Electron development launch checks passed.');
} finally { await app.close(); await server.close(); }
