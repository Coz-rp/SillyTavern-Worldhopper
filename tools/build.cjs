#!/usr/bin/env node
// Builds dist/backend.js (Bun) and dist/frontend.js (browser) with Bun. dist/ is committed, so Lumiverse installs
// the extension without building anything.
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const bunHome = path.join(os.homedir(), '.bun', 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun');
const BUN = process.env.BUN || (fs.existsSync(bunHome) ? bunHome : 'bun');

function build(entry, out, target, extra = []) {
    const r = spawnSync(BUN, ['build', entry, '--outfile', out, '--target', target, '--format', 'esm', ...extra], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status || 1);
}
build('src/backend/index.js', 'dist/backend.js', 'bun');
build('src/frontend/index.js', 'dist/frontend.js', 'browser', ['--minify']);
for (const f of ['dist/backend.js', 'dist/frontend.js']) console.log(`${f}: ${(fs.statSync(path.join(ROOT, f)).size / 1024).toFixed(0)} KB`);
