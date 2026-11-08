import { app, BrowserWindow, dialog, ipcMain, nativeImage, protocol, session, shell } from 'electron';
import { readFile, writeFile, access, stat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { z } from 'zod';
import { SceneStorage } from './storage';
import { inspectAsset } from './assets';
import { assetSchema } from '../src/features/scene/schema';

protocol.registerSchemesAsPrivileged([{ scheme: 'roomshift', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const devURL = !app.isPackaged && process.env.ROOMSHIFT_DEV_URL === 'http://127.0.0.1:5173' ? process.env.ROOMSHIFT_DEV_URL : undefined;
const customProfile = app.commandLine.getSwitchValue('user-data-dir');
if (customProfile) app.setPath('userData', resolve(customProfile));
if (!app.isPackaged && process.env.ROOMSHIFT_TEST_DATA) app.setPath('userData', resolve(process.env.ROOMSHIFT_TEST_DATA));
if (!app.isPackaged && process.env.ROOMSHIFT_FAKE_CAMERA === '1') {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}
let editor: BrowserWindow | null = null, output: BrowserWindow | null = null;
const isTrusted = (url: string) => {
  try { const parsed = new URL(url); return (parsed.protocol === 'roomshift:' && parsed.hostname === 'app') || (!!devURL && parsed.origin === devURL); }
  catch { return false; }
};
function authorize(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent, editorOnly = true) {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame || !isTrusted(event.senderFrame.url) || (event.sender !== editor?.webContents && (editorOnly || event.sender !== output?.webContents))) throw new Error('Unauthorized request');
}
function windowFor(clean: boolean) {
  const win = new BrowserWindow({
    title: clean ? 'RoomShift Output' : 'RoomShift', width: clean ? 1280 : 1480, height: clean ? 720 : 960,
    minWidth: clean ? 320 : 1080, minHeight: clean ? 180 : 700, backgroundColor: '#101213',
    autoHideMenuBar: true, useContentSize: clean,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, webSecurity: true },
  });
  win.setMenu(null);
  if (clean) win.setAspectRatio(16 / 9);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  void win.loadURL(`${devURL ?? 'roomshift://app/index.html'}${clean ? '?output=1' : ''}`);
  return win;
}
app.whenReady().then(async () => {
  const storage = new SceneStorage(join(app.getPath('userData'), 'library'));
  await storage.init();
  const dist = resolve(__dirname, '../dist');
  protocol.handle('roomshift', async request => {
    try {
      const url = new URL(request.url);
      let path: string;
      if (url.host === 'assets') {
        const name = assetSchema.parse(decodeURIComponent(url.pathname.slice(1)));
        if (name.startsWith('builtin:')) return new Response('Not found', { status: 404 });
        path = join(storage.root, 'assets', name);
      } else if (url.host === 'app') {
        const part = decodeURIComponent(url.pathname);
        path = resolve(dist, `.${part === '/' ? '/index.html' : part}`);
        if (!path.startsWith(`${dist}\\`) && !path.startsWith(`${dist}/`)) return new Response('Forbidden', { status: 403 });
      } else return new Response('Not found', { status: 404 });
      const ext = path.split('.').pop()!;
      const types: Record<string, string> = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', wasm: 'application/wasm', json: 'application/json' };
      return new Response(await readFile(path), { headers: { 'Content-Type': types[ext] ?? 'application/octet-stream', 'Access-Control-Allow-Origin': devURL ?? 'roomshift://app', 'Cache-Control': 'no-cache' } });
    } catch { return new Response('Asset unavailable', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(contents === editor?.webContents && isTrusted(details.requestingUrl) && permission === 'media' && 'mediaTypes' in details && details.mediaTypes?.every((type: string) => type === 'video') === true));
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => contents === editor?.webContents && isTrusted(origin) && permission === 'media' && details.mediaType !== 'audio');
  // Deny remote subresources, including URIs hidden in imported models.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const allowed = ['roomshift:', 'blob:', 'data:'].includes(url.protocol) || (!!devURL && url.hostname === '127.0.0.1' && url.port === '5173' && ['http:', 'ws:'].includes(url.protocol));
    callback({ cancel: !allowed });
  });
  const handle = (name: string, fn: (...args: never[]) => unknown) => ipcMain.handle(name, (event, ...args) => { authorize(event); return fn(...args as never[]); });
  handle('scene:list', () => storage.list());
  handle('scene:save', value => storage.save(value));
  handle('scene:load', id => storage.load(id));
  handle('scene:delete', id => storage.delete(id));
  handle('asset:import', async value => {
    const kind = z.enum(['image', 'model']).parse(value);
    const chosen = await dialog.showOpenDialog(editor!, { title: kind === 'model' ? 'Import a self-contained GLB' : 'Choose a poster or window image', properties: ['openFile'], filters: [{ name: kind === 'model' ? 'GLB model' : 'Images', extensions: kind === 'model' ? ['glb'] : ['png', 'jpg', 'jpeg'] }] });
    if (chosen.canceled || !chosen.filePaths[0]) return null;
    const file = chosen.filePaths[0];
    if ((await stat(file)).size > (kind === 'model' ? 100 : 25) * 1024 * 1024) throw new Error('File too large. Images: 25 MB; models: 100 MB.');
    const bytes = await readFile(file), asset = inspectAsset(bytes, file, kind);
    if (kind === 'image') {
      const image = nativeImage.createFromBuffer(bytes), size = image.getSize();
      if (image.isEmpty() || size.width > 8192 || size.height > 8192) throw new Error('Image is invalid or larger than 8192 pixels.');
    }
    await writeFile(join(storage.root, 'assets', asset), bytes);
    return { asset, name: basename(file).replace(/\.[^.]+$/, '').slice(0, 120) || 'Imported asset' };
  });
  handle('output:open', () => {
    if (output) { output.restore(); output.show(); return; }
    output = windowFor(true);
    output.on('closed', () => { output = null; editor?.webContents.send('output:signal', { type: 'closed' }); });
  });
  handle('output:close', () => output?.close());
  handle('obs:status', async () => {
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
      if (root && await access(join(root, 'obs-studio', 'bin', '64bit', 'obs64.exe')).then(() => true, () => false)) return true;
    }
    return false;
  });
  handle('obs:guide', () => shell.openExternal('https://obsproject.com/kb/virtual-camera-guide'));
  ipcMain.on('output:signal', (event, message: unknown) => {
    try {
      authorize(event, false);
      const signal = z.object({ type: z.enum(['ready', 'offer', 'answer', 'ice', 'settings']), data: z.unknown().optional() }).parse(message);
      if (JSON.stringify(signal).length > 65536) return;
      const fromEditor = event.sender === editor?.webContents;
      if (fromEditor ? !['offer', 'ice', 'settings'].includes(signal.type) : !['ready', 'answer', 'ice'].includes(signal.type)) return;
      (fromEditor ? output : editor)?.webContents.send('output:signal', signal);
    } catch { /* Reject malformed or untrusted signaling. */ }
  });
  editor = windowFor(false);
  editor.on('closed', () => { editor = null; output?.close(); app.quit(); });
}).catch(error => { dialog.showErrorBox('RoomShift could not start', String(error)); app.quit(); });
app.on('window-all-closed', () => app.quit());
