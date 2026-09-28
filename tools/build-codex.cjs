// Build the Codex lorebook (WH Metaphysics) from the source files in codex/:
//   codex/modes/NN Name.md     → "👁 Name"   (00 is Metaphysics Core, armed whenever any mode is picked)
//   codex/anchors/NN Name.md   → "⛓ Name"   (depth-0 reminders; Initiative Anchor follows the "Powers get used" setting)
//   codex/details/NN Mode · topic.md → "📖 Mode · topic" (key: lines, then ---, then the text; fire on topic words)
// The number prefix only sets the order. Writes codex/WH Metaphysics.json, which ships with the extension; the
// extension installs it into SillyTavern and keeps it updated (unless you've edited the installed copy).
//   node tools/build-codex.cjs            build the bundled file
//   node tools/build-codex.cjs --install  also write it into ST's worlds folder (only with ST closed; backup kept)
// EVERY entry is written disabled. The extension switches on, per generation, exactly the picked modes, so without
// the extension nothing here fires.
const fs = require('fs');
const path = require('path');

const EXT = path.resolve(__dirname, '..');
const SRC = path.join(EXT, 'codex');
const NAME = 'WH Metaphysics';
const OUT = path.join(SRC, `${NAME}.json`);
const ST_WORLD = path.resolve(EXT, '..', '..', '..', '..', '..', 'data', 'default-user', 'worlds', `${NAME}.json`);
const BAK = path.join(__dirname, 'backups');

const files = dir => fs.readdirSync(path.join(SRC, dir)).filter(f => f.endsWith('.md')).sort()
    .map(f => ({ name: f.replace(/^\d+\s+/, '').replace(/\.md$/, ''), text: fs.readFileSync(path.join(SRC, dir, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '') }));

const README = `{{// ✦ WH Metaphysics — the Worldhopper Codex. Managed by the Worldhopper Engine extension. Keep this entry OFF.

Every entry in this book is stored DISABLED on purpose. The extension switches on, per generation:
• 👁 Metaphysics Core, whenever any mode is picked for the current character
• each 👁 mode picked in the Worldhopper Engine panel (Extensions → Worldhopper Engine → Modes)
• the ⛓ anchor of each picked mode that has one (depth 0), and ⛓ Initiative Anchor when "Powers get used" is on
• 📖 detail entries of picked modes, only when their topic words appear in the last two messages (depth 1, sticky 3)
Without the extension nothing here fires, so a missing or broken extension can never inject the wrong mode.

Source: the extension's codex/ folder, built with tools/build-codex.cjs. Edits made here are kept, but the extension then stops updating this book automatically and offers the update instead. }}`;

// Every field a SillyTavern world entry carries; the per-entry values are filled in by add().
const TEMPLATE = {
    key: [], keysecondary: [], comment: '', content: '', constant: false, vectorized: false, selective: false, selectiveLogic: 0,
    addMemo: true, order: 100, position: 0, disable: true, ignoreBudget: true, excludeRecursion: true, preventRecursion: true,
    matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false, matchCharacterDepthPrompt: false,
    matchScenario: false, matchCreatorNotes: false, delayUntilRecursion: false, probability: 100, useProbability: true, depth: 4,
    outletName: '', group: '', groupOverride: false, groupWeight: 100, scanDepth: null, caseSensitive: null, matchWholeWords: null,
    useGroupScoring: null, automationId: '', role: null, sticky: 0, cooldown: 0, delay: 0, triggers: [], uid: 0, displayIndex: 0,
    extensions: {
        role: 0, depth: 4, group: '', linked: false, weight: 10, addMemo: true, embedded: true, position: 0, scan_depth: null,
        probability: 100, displayIndex: 0, automation_id: '', display_index: 0, case_sensitive: null, selectiveLogic: 0,
        useProbability: true, characterFilter: null, excludeRecursion: true, exclude_recursion: false, match_whole_words: null,
        prevent_recursion: false,
    },
    characterFilter: { isExclude: false, names: [], tags: [] },
};
const TRIG = ['normal', 'continue', 'impersonate', 'regenerate', 'swipe'];

const entries = {};
let uid = 0;
const add = (comment, content, o = {}) => {
    const e = JSON.parse(JSON.stringify(TEMPLATE));
    Object.assign(e, {
        uid, displayIndex: uid, comment, content, key: o.key || [], order: o.order ?? 100, position: o.position ?? 0, depth: o.depth ?? 4,
        role: o.role ?? null, ignoreBudget: o.ignoreBudget ?? true, scanDepth: o.scanDepth ?? null, sticky: o.sticky ?? 0, triggers: o.triggers ?? TRIG,
    });
    Object.assign(e.extensions, { displayIndex: uid, display_index: uid, position: o.position ?? 0, depth: o.depth ?? 4, role: o.role ?? 0, scan_depth: o.scanDepth ?? null });
    entries[String(uid++)] = e;
};

add('✦ README — keep this OFF', README, { order: 1, triggers: [] });
for (const m of files('modes')) add(`👁 ${m.name}`, m.text, { order: m.name === 'Metaphysics Core' ? 90 : 100 });
for (const a of files('anchors')) add(`⛓ ${a.name}`, a.text, { position: 4, depth: 0, role: 0 });
for (const d of files('details')) {
    const [head, ...rest] = d.text.split(/^---$/m);
    const key = head.split('\n').map(l => /^key:\s*(.+)$/.exec(l.trim())?.[1]).filter(Boolean);
    add(`📖 ${d.name}`, rest.join('---').trim(), { key, position: 4, depth: 1, role: 0, scanDepth: 2, sticky: 3, ignoreBudget: false });
}
const book = { entries };

// ---------- verify ----------
const vals = Object.values(entries);
const modeNames = new Set(vals.filter(e => e.comment.startsWith('👁')).map(e => e.comment.slice(2).trim()));
const orphans = vals.filter(e => e.comment.startsWith('📖') && !modeNames.has(e.comment.slice(2).split(' · ')[0].trim())).map(e => e.comment);
const badKeys = [];
for (const e of vals) for (const k of e.key) { try { new RegExp(k.slice(1, k.lastIndexOf('/')), 'i'); } catch { badKeys.push(`${e.comment}: ${k}`); } }
const emptyKeys = vals.filter(e => e.comment.startsWith('📖') && !e.key.length).map(e => e.comment);
if (orphans.length || badKeys.length || emptyKeys.length) {
    console.error('Not written:', { orphans, badKeys, emptyKeys });
    process.exit(1);
}

fs.writeFileSync(OUT, JSON.stringify(book, null, 4));
console.log(`${vals.length} entries → codex/${NAME}.json: ${modeNames.size} 👁, ${vals.filter(e => e.comment.startsWith('⛓')).length} ⛓, ${vals.filter(e => e.comment.startsWith('📖')).length} 📖, all disabled`);

if (process.argv.includes('--install')) {
    fs.mkdirSync(BAK, { recursive: true });
    if (fs.existsSync(ST_WORLD)) fs.copyFileSync(ST_WORLD, path.join(BAK, `${NAME}.${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
    fs.writeFileSync(ST_WORLD, JSON.stringify(book, null, 4));
    console.log(`installed into ${ST_WORLD} (backup in tools/backups)`);
}
