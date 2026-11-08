import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const notices = ['RoomShift runtime dependency license texts\nGenerated from the locked packages.\n'];
for (const [directory, info] of Object.entries(lock.packages)) {
  if (!directory || info.dev) continue;
  const files = await readdir(directory).catch(() => []);
  const license = files.find(name => /^licen[sc]e(?:\.(?:md|txt))?$/i.test(name));
  if (license) notices.push(`\n${'='.repeat(72)}\n${directory} @ ${info.version}\n${'='.repeat(72)}\n${await readFile(join(directory, license), 'utf8')}`);
  else notices.push(`\n${directory} @ ${info.version} — ${info.license ?? 'see package metadata'}\n`);
}
await mkdir('public/assets/licenses', { recursive: true });
await writeFile('public/assets/licenses/runtime-licenses.txt', notices.join('\n'));
// TypeScript ships the complete standard Apache 2.0 license; MediaPipe uses the same license.
await copyFile('node_modules/typescript/LICENSE.txt', 'public/assets/licenses/Apache-2.0.txt');
