import { build } from 'esbuild';
await build({ entryPoints: ['electron/main.ts', 'electron/preload.ts'], bundle: true, platform: 'node', target: 'node22', outdir: 'dist-electron', outExtension: { '.js': '.cjs' }, external: ['electron'], format: 'cjs' });
