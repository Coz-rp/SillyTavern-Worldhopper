// Worldhopper Engine — Codex core. Which lorebook entries a set of picked modes switches on.
// Entries are matched by their titles in the WH Metaphysics lorebook:
//   "👁 Metaphysics Core" · "👁 <Mode>" · "⛓ <Anchor>" · "📖 <Mode> · <topic>"

export const MODE_GROUPS = [
    ['Occupancy', ['Possession', 'Multipossession', 'Propagation', 'Copy Fidelity', 'Puppetry', 'Skinsuit', 'Hive Mind', 'Reverse Vore']],
    ['Overwrite', ['Hypnosis', 'Mind Control', 'Altered Perception', 'Blank Slate', 'Dronification', 'Pet Play']],
    ['Reduction', ['Dollification', 'Limp Play']],
    ['Other', ['Soul Play', 'Timestop', 'Segmentation']],
];

// Modifiers pull in the mode they modify. Reverse Vore modifies whichever occupancy mode is picked, and brings in
// Possession when none is (its entry hands control to "the active occupancy mode").
export const PARENT = { 'Multipossession': 'Possession', 'Copy Fidelity': 'Propagation' };
export const MODIFIERS = new Set(['Multipossession', 'Copy Fidelity', 'Reverse Vore']);
const OCCUPANCY_BASE = ['Possession', 'Propagation', 'Puppetry', 'Skinsuit', 'Hive Mind'];

export const ANCHOR_FOR = {
    '⛓ Multi Anchor': 'Multipossession',
    '⛓ Propagation Anchor': 'Propagation',
    '⛓ Puppetry Anchor': 'Puppetry',
    '⛓ Skinsuit Anchor': 'Skinsuit',
};

export const ALL_MODES = MODE_GROUPS.flatMap(([, modes]) => modes);

// One-line definitions, for card suggestions.
export const MODE_BLURBS = {
    'Possession': 'a mind moves into a living host and drives it',
    'Multipossession': 'one mind drives several hosts at once',
    'Propagation': "a host's mind is overwritten by a copy of someone else's",
    'Copy Fidelity': 'copies of the player character appear in the story',
    'Puppetry': 'an empty body driven from outside by a controller in their own skin',
    'Skinsuit': "a host's hollow skin is worn from within like a garment",
    'Hive Mind': 'minds absorbed into a single network that is the original mind',
    'Reverse Vore': 'entry by being swallowed, then control seized from inside',
    'Hypnosis': 'realistic trances that deepen in stages over sessions, with suggestions sincerely rationalised as the subject\'s own',
    'Mind Control': "the mind itself taken over: wants, feelings and beliefs set by the controller and felt as the subject's own",
    'Altered Perception': 'premises edited so the altered normal is defended as always true',
    'Blank Slate': 'a mind wiped to a genuine void',
    'Dronification': 'personality stripped and replaced with function and designations',
    'Pet Play': "the mind becomes an animal's while the body stays human",
    'Dollification': 'a blank, poseable doll with nobody home',
    'Limp Play': 'the body goes completely slack, dead weight',
    'Soul Play': 'souls as objects that can be moved, split, merged or stored',
    'Timestop': 'time frozen for everyone except whoever stopped it',
    'Segmentation': 'body parts removed and exchanged freely',
};

// Every picked mode is written into the prompt, so over-picking floods it: suggestions of 13-15 modes (Puppetry,
// Dollification, Dronification…) had the writer drifting into body control in every scene.
export const MAX_SUGGESTED = 3;

export function buildSuggestMessages(cardText, name) {
    const list = ALL_MODES.map(m => `- ${m}: ${MODE_BLURBS[m]}`).join('\n');
    return [
        { role: 'system', content: `You classify roleplay character cards by which body/mind mechanics they use. The mechanics:\n${list}\nPick the fewest mechanics that cover the card's premise: its central power first, then only others the card plainly makes part of the premise or a character's power. At most ${MAX_SUGGESTED}. Every mechanic picked gets written into the story, so one the card only hints at, lists as a possibility, or never uses does not belong. A passing word ("she went limp", "a doll-like face", "her soul") is not a mechanic. A body left slack or empty when a possessor leaves is part of Possession, not Limp Play; Limp Play is only when making someone go limp is itself the power or the point. Answer with one line and nothing else:\nMODES: <comma-separated names from the list, most central first>\nor\nMODES: none` },
        { role: 'user', content: `Card: ${name}\n<<<\n${String(cardText).slice(0, 6000)}\n>>>` },
    ];
}

export function parseSuggestResponse(text) {
    const m = String(text || '').match(/MODES:\s*(.+)/i);
    if (!m || /^none\b/i.test(m[1].trim())) return [];
    const picked = m[1].split(',').map(x => x.trim().replace(/[.*]/g, '')).map(x => ALL_MODES.find(a => a.toLowerCase() === x.toLowerCase())).filter(Boolean);
    return [...new Set(picked)].slice(0, MAX_SUGGESTED);
}

/** Expand a pick list with the modes its modifiers depend on. */
export function expandModes(picked) {
    const set = new Set(picked.filter(m => ALL_MODES.includes(m)));
    for (const m of [...set]) if (PARENT[m]) set.add(PARENT[m]);
    if (set.has('Reverse Vore') && !OCCUPANCY_BASE.some(m => set.has(m))) set.add('Possession');
    return set;
}

/**
 * Decide what an entry should do this generation.
 * @returns {'constant'|'keyed'|null} constant = inject unconditionally; keyed = allow its own keys to trigger it;
 *          null = leave it off.
 */
export function planEntry(title, active, { anchors = true, details = true, initiative = true } = {}) {
    if (!active.size) return null;
    const t = String(title || '').trim();
    if (t === '👁 Metaphysics Core') return 'constant';
    if (t === '⛓ Initiative Anchor') return initiative ? 'constant' : null;
    if (t.startsWith('👁 ')) return active.has(t.slice(2).trim()) ? 'constant' : null;
    if (t.startsWith('⛓ ')) return anchors && active.has(ANCHOR_FOR[t]) ? 'constant' : null;
    if (t.startsWith('📖 ')) {
        const mode = t.slice(2).split(' · ')[0].trim();
        return details && active.has(mode) ? 'keyed' : null;
    }
    return null;
}

// The display side of the moments the Codex asks the writer to mark (the mode entries in codex/modes): ST global regex
// scripts, display-only, like the preset's text and sign styling. The markdown="1" makes showdown format the prose
// inside the box; ST renames the classes to custom-wh-…, which style.css styles.
// The other modes' moments, each marked %%name%% … %%/name%% by its own Codex entry.
export const MOMENTS = ['absorbed', 'worn', 'shed', 'trance', 'control', 'timestop', 'resume'];
export const DISPLAY_SCRIPTS = [
    { id: 'wh-possession-box', scriptName: 'WH - Possession', findRegex: '/%%possession%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/possession%%/gi', replaceString: '<div class="wh-possess" markdown="1">\n$1\n</div>' },
    { id: 'wh-release-box', scriptName: 'WH - Release', findRegex: '/%%release%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/release%%/gi', replaceString: '<div class="wh-release" markdown="1">\n$1\n</div>' },
    { id: 'wh-moments', scriptName: 'WH - Moments', findRegex: `/%%(${MOMENTS.join('|')})%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/\\1%%/gi`, replaceString: '<div class="wh-moment wh-m-$1" markdown="1">\n$2\n</div>' },
    // A marker whose partner went missing would otherwise show as raw text. Must run after the box scripts.
    { id: 'wh-stray-markers', scriptName: 'WH - Stray markers', findRegex: `/^[ \\t]*%%\\/?(?:possession|release|${MOMENTS.join('|')})%%[ \\t]*\\n?/gim`, replaceString: '' },
    // Your lines for one body ("[Kayla] takes the keys", from the body buttons) as labelled rows; your messages only.
    // [OOC …] and anything with a colon inside the brackets stay as typed.
    { id: 'wh-body-lines', scriptName: 'WH - Body lines', findRegex: '/^[ \\t]*\\[(?!ooc\\b)([^\\[\\]\\n:]{1,40})\\][ \\t]*(\\S.*)$/gim', replaceString: '\n<div class="wh-lane" markdown="1">\n<span class="wh-lane-name">$1</span> $2\n</div>\n', placement: [1] },
].map(s => ({ trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null, ...s }));
