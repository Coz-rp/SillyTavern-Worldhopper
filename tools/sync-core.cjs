#!/usr/bin/env node
// Copies the Worldhopper Engine's core modules (pure functions, no SillyTavern code) from the SillyTavern Engine's
// working copy into src/core/, and turns its Codex lorebook into src/core/codex-data.js. The SillyTavern Engine stays
// the one source of truth for these: change them there (and run its tests), then run this.
//
//   node tools/sync-core.cjs [path to the SillyTavern-Worldhopper repo]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, '..', 'SillyTavern', 'public', 'scripts', 'extensions', 'third-party', 'SillyTavern-Worldhopper');
const OUT = path.join(ROOT, 'src', 'core');
const CORES = ['codex-core.js', 'ledger-core.js', 'mind-core.js', 'card-core.js', 'persona-core.js', 'text-core.js'];

if (!fs.existsSync(path.join(SRC, 'codex-core.js'))) {
    console.error(`No Engine repo at ${SRC}`);
    process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const engine = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
for (const f of CORES) {
    const text = fs.readFileSync(path.join(SRC, f), 'utf8');
    fs.writeFileSync(path.join(OUT, f), `// Synced from the SillyTavern Worldhopper Engine ${engine.version} by tools/sync-core.cjs. Edit it there, not here.\n${text}`);
}

// The Codex: every entry but the README, with what the extension needs to place it. Position 0 is "before the chat"
// (the 👁 rules), 4 is "in the chat at a depth" (⛓ anchors at 0, 📖 details at 1). Keys are the 📖 entries' triggers.
const book = JSON.parse(fs.readFileSync(path.join(SRC, 'codex', 'WH Metaphysics.json'), 'utf8'));
const entries = Object.values(book.entries)
    .filter(e => !String(e.comment || '').startsWith('✦'))
    .sort((a, b) => (a.order - b.order) || (a.uid - b.uid))
    .map(e => ({
        title: e.comment,
        content: e.content,
        position: e.position,
        depth: e.depth,
        order: e.order,
        keys: e.key || [],
        sticky: e.sticky || 0,
        scanDepth: e.scanDepth ?? null,
    }));
fs.writeFileSync(path.join(OUT, 'codex-data.js'),
    `// The Worldhopper Codex (WH Metaphysics), from the SillyTavern Worldhopper Engine ${engine.version} by tools/sync-core.cjs.\n`
    + `export const CODEX_VERSION = ${JSON.stringify(engine.version)};\n`
    + `export const CODEX = ${JSON.stringify(entries, null, 1)};\n`);
console.log(`Synced ${CORES.length} core modules and ${entries.length} Codex entries from Engine ${engine.version}.`);
