#!/usr/bin/env node
// Copies the built extension into a local Lumiverse's extensions folder for testing. Lumiverse only installs from
// https git URLs, so a local copy goes in through its "import local extensions" scan the first time, and a restart of
// the extension after that (both from the logged-in browser: POST /api/v1/spindle/import-local, then
// POST /api/v1/spindle/<id>/restart).
//
//   node tools/dev-install.cjs [path to Lumiverse]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LUMIVERSE = process.argv[2] || path.join(ROOT, '..', 'Lumiverse');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'spindle.json'), 'utf8'));
const dest = path.join(LUMIVERSE, 'data', 'extensions', manifest.identifier, 'repo');
if (!fs.existsSync(path.join(LUMIVERSE, 'data'))) {
    console.error(`No Lumiverse data folder at ${LUMIVERSE}`);
    process.exit(1);
}
// No package.json: without git, Lumiverse can't tell dist/ is prebuilt and would try to install the dev dependencies.
const FILES = ['spindle.json', 'dist/backend.js', 'dist/frontend.js', 'LICENSE', 'README.md'];
fs.mkdirSync(path.join(dest, 'dist'), { recursive: true });
for (const f of FILES) {
    const from = path.join(ROOT, f);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, f));
}
console.log(`Copied to ${dest}`);
