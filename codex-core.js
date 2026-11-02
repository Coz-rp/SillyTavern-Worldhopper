// Worldhopper Engine — Codex core. Which lorebook entries a set of picked modes switches on.
// Entries are matched by their titles in the WH Metaphysics lorebook:
//   "👁 Metaphysics Core" (and its two parts, CORE_PARTS) · "👁 <Mode>" · "⛓ <Anchor>" · "📖 <Mode> · <topic>"

export const MODE_GROUPS = [
    ['Occupancy', ['Possession', 'Multipossession', 'Propagation', 'Copy Fidelity', 'Puppetry', 'Skinsuit', 'Hive Mind', 'Body Swap', 'Reverse Vore']],
    ['Overwrite', ['Hypnosis', 'Mind Control', 'Altered Perception', 'Blank Slate', 'Dronification', 'Pet Play']],
    ['Reduction', ['Dollification', 'Limp Play']],
    ['Other', ['Soul Play', 'Timestop', 'Segmentation', 'Transformation']],
];

// Modifiers pull in the mode they modify. Reverse Vore modifies whichever occupancy mode is picked, and brings in
// Possession when none is (its entry hands control to "the active occupancy mode").
export const PARENT = { 'Multipossession': 'Possession', 'Copy Fidelity': 'Propagation' };
export const MODIFIERS = new Set(['Multipossession', 'Copy Fidelity', 'Reverse Vore']);
const OCCUPANCY_BASE = ['Possession', 'Propagation', 'Puppetry', 'Skinsuit', 'Hive Mind', 'Body Swap'];

// Each anchor comes in with its mode, or with any of a list of modes.
export const ANCHOR_FOR = {
    // Taking a body never costs the multipossessor their own: needed the moment they take one, so it comes with the pick.
    '⛓ Multi Anchor': 'Multipossession',
    // One mind in several bodies (no conversing, no sync, the player's bodies do only what they wrote).
    '⛓ Several Bodies Anchor': ['Multipossession', 'Hive Mind'],
    // "Powers get used this turn" would rush a trance: hypnosis builds at its own pace.
    '⛓ Pace Anchor': 'Hypnosis',
    '⛓ Propagation Anchor': 'Propagation',
    '⛓ Puppetry Anchor': 'Puppetry',
    '⛓ Skinsuit Anchor': 'Skinsuit',
    '⛓ Transformation Anchor': 'Transformation',
    // A swap names people by who they are, not by the body, so it has its own reminder instead of the Referent one.
    '⛓ Swap Anchor': 'Body Swap',
    // A body's name and pronouns apart from the mind driving it: every mode where a mind drives someone else's body
    // (Multipossession and Reverse Vore bring in Possession).
    '⛓ Referent Anchor': ['Possession', 'Skinsuit', 'Hive Mind', 'Puppetry'],
};

export const ALL_MODES = MODE_GROUPS.flatMap(([, modes]) => modes);

// ------------------------------------------------------------------ what's actually happening
// With the Body Ledger and the Mind Book running, the Engine knows what is going on in the chat right now:
//   state = { bodies: { ridden, several, copy, puppet, worn, swap } | null, minds: { hypnosis, control, perception } | null }
// null means that side isn't tracked in this chat (no Ledger, or no Mind Book), and then everything arms by the picks
// alone, as it always has. Reminders about one kind of body, and details about one situation, wait for that to exist.
const known = (state, side, key) => !state || !state[side] || !!state[side][key];

/**
 * Reminders that wait for their kind of body. None, on purpose: tested on a long test card (2026-10-28), holding the skinsuit,
 * copy, puppet and several-bodies reminders until the Ledger showed such a body left the first takeover without them,
 * the moment they matter most, and replies started calling the player "she" in a taken body (0 breaks before, 6 after).
 */
export const ANCHOR_STATE = {};

/**
 * Details about an ongoing situation that fired on everyday words ("mom", "remember", "deeper") come in only once the
 * situation exists, or when a word nobody uses by accident is in the latest messages (strong). Details about the moment
 * itself (taking a body, putting on a suit, absorption, control taking hold) keep their topic words alone: the moment
 * happens before the Ledger or the Mind Book can know about it.
 */
export const DETAIL_GATES = {
    '📖 Possession · memory and skills': { when: s => known(s, 'bodies', 'ridden') },
    '📖 Possession · people who know the host': { when: s => known(s, 'bodies', 'ridden') },
    '📖 Possession · living in someone else\'s body': { when: s => known(s, 'bodies', 'ridden') },
    '📖 Propagation · copies and the original': { when: s => known(s, 'bodies', 'copy'), strong: /\b(?:clone|duplicat)\w*/i },
    '📖 Body Swap · living as each other': { when: s => known(s, 'bodies', 'swap'), strong: /\bswap\w*/i },
    '📖 Hypnosis · trance depth and triggers': { when: s => known(s, 'minds', 'hypnosis'), strong: /\b(?:trance|hypno\w*|pendulum|induction)\b/i },
    '📖 Hypnosis · resistance': { when: s => known(s, 'minds', 'hypnosis') },
    '📖 Altered Perception · living around the edit': { when: s => known(s, 'minds', 'perception') },
};

// ------------------------------------------------------------------ when modes meet
// A combination note covers what happens when two modes meet. It is switched on only when every mode it needs is
// picked for this chat (all, plus at least one of any, or at least two of twoOf), and never by anything else, so a
// card with one mode, or with modes that don't meet, never gets one.
export const COMBOS = {
    '🔗 Possession with mind powers': { all: ['Possession'], any: ['Hypnosis', 'Mind Control', 'Altered Perception'] },
    '🔗 One body, one occupant': { all: ['Possession'], any: ['Skinsuit', 'Hive Mind', 'Propagation', 'Body Swap'] },
    '🔗 Drones and the hive': { all: ['Dronification', 'Hive Mind'] },
    '🔗 Control that hollows someone out': { all: ['Mind Control'], any: ['Dronification', 'Blank Slate'] },
    '🔗 One state at a time': { twoOf: ['Dollification', 'Dronification', 'Blank Slate', 'Pet Play', 'Limp Play'] },
    '🔗 Souls and taken bodies': { all: ['Soul Play'], any: ['Possession', 'Skinsuit', 'Hive Mind', 'Puppetry', 'Body Swap'] },
    '🔗 Timestop with several bodies': { all: ['Timestop'], any: ['Multipossession', 'Hive Mind', 'Puppetry'] },
    '🔗 Reverse Vore with several bodies': { all: ['Reverse Vore', 'Multipossession'] },
};
export function comboArmed(title, active) {
    const c = COMBOS[String(title || '').trim()];
    if (!c) return false;
    return (c.all || []).every(m => active.has(m)) && (!c.any || c.any.some(m => active.has(m))) && (!c.twoOf || c.twoOf.filter(m => active.has(m)).length >= 2);
}

// The Metaphysics Core comes with every mode; its two other parts only where they apply, so a mind-only chat (Hypnosis,
// say) isn't paying for rules about bodies: the body rules wherever a mind drives a body that isn't its own (every
// occupancy mode), and the rules for one mind running several bodies at once.
export const CORE_PARTS = {
    '👁 Metaphysics Core · bodies': MODE_GROUPS.find(([g]) => g === 'Occupancy')[1],
    '👁 Metaphysics Core · several bodies': ['Multipossession', 'Hive Mind', 'Puppetry'],
};

// One-line definitions, for card suggestions.
export const MODE_BLURBS = {
    'Possession': 'a mind moves into a living host and drives it',
    'Multipossession': 'one mind drives several hosts at once',
    'Propagation': "a host's mind is overwritten by a copy of someone else's",
    'Copy Fidelity': 'copies of the player character appear in the story',
    'Puppetry': 'an empty body driven from outside by a controller in their own skin',
    'Skinsuit': "a host's hollow skin is worn from within like a garment",
    'Hive Mind': 'minds absorbed into a single network that is the original mind',
    'Body Swap': "two people trade bodies, each mind awake and living the other's life until it's undone",
    'Reverse Vore': 'entry by being swallowed, then control seized from inside',
    'Hypnosis': 'realistic trances that deepen in stages over sessions, with suggestions sincerely rationalized as the subject\'s own',
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
    'Transformation': 'a body physically changes form (sex, build, species) while the mind stays the same person',
};

// Every picked mode is written into the prompt, so over-picking floods it: suggestions of 13-15 modes (Puppetry,
// Dollification, Dronification…) had the writer drifting into body control in every scene.
export const MAX_SUGGESTED = 3;

export function buildSuggestMessages(cardText, name) {
    const list = ALL_MODES.map(m => `- ${m}: ${MODE_BLURBS[m]}`).join('\n');
    return [
        { role: 'system', content: `You classify roleplay character cards by which body/mind mechanics they use. The mechanics:\n${list}\nPick the fewest mechanics that cover the card's premise: its central power first, then only others the card plainly makes part of the premise or a character's power. At most ${MAX_SUGGESTED}. Every mechanic picked gets written into the story, so one the card only hints at, lists as a possibility, or never uses does not belong. A passing word ("she went limp", "a doll-like face", "her soul") is not a mechanic. A body left slack or empty when a possessor leaves is part of Possession, not Limp Play; Limp Play is only when making someone go limp is itself the power or the point. Two minds trading bodies with each other is Body Swap, not Possession, which has one mind enter a host whose own mind goes out. A body changing its own shape is Transformation; wearing someone else's shape is Skinsuit. Answer with one line and nothing else:\nMODES: <comma-separated names from the list, most central first>\nor\nMODES: none` },
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
export function planEntry(title, active, { anchors = true, details = true, state = null, recent = '' } = {}) {
    if (!active.size) return null;
    const t = String(title || '').trim();
    if (t === '👁 Metaphysics Core') return 'constant';
    if (CORE_PARTS[t]) return CORE_PARTS[t].some(m => active.has(m)) ? 'constant' : null;
    // Characters with a power use it: part of every mode, not a choice.
    if (t === '⛓ Initiative Anchor') return 'constant';
    if (t.startsWith('👁 ')) return active.has(t.slice(2).trim()) ? 'constant' : null;
    if (t.startsWith('🔗 ')) return comboArmed(t, active) ? 'constant' : null;
    if (t.startsWith('⛓ ')) return anchors && [ANCHOR_FOR[t]].flat().some(m => active.has(m)) && (!ANCHOR_STATE[t] || ANCHOR_STATE[t](state)) ? 'constant' : null;
    if (t.startsWith('📖 ')) {
        const mode = t.slice(2).split(' · ')[0].trim();
        const gate = DETAIL_GATES[t];
        return details && active.has(mode) && (!gate || gate.when(state) || !!gate.strong?.test(recent)) ? 'keyed' : null;
    }
    return null;
}

// The display side of the moments the Codex asks the writer to mark (the mode entries in codex/modes): ST global regex
// scripts, display-only, like the preset's text and sign styling. The markdown="1" makes showdown format the prose
// inside the box; ST renames the classes to custom-wh-…, which style.css styles.
// The other modes' moments, each marked %%name%% … %%/name%% by its own Codex entry.
export const MOMENTS = ['absorbed', 'worn', 'shed', 'trance', 'control', 'timestop', 'resume', 'swap', 'transform'];
export const DISPLAY_SCRIPTS = [
    { id: 'wh-possession-box', scriptName: 'WH - Possession', findRegex: '/%%possession%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/possession%%/gi', replaceString: '<div class="wh-possess" markdown="1">\n$1\n</div>' },
    { id: 'wh-release-box', scriptName: 'WH - Release', findRegex: '/%%release%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/release%%/gi', replaceString: '<div class="wh-release" markdown="1">\n$1\n</div>' },
    { id: 'wh-moments', scriptName: 'WH - Moments', findRegex: `/%%(${MOMENTS.join('|')})%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/\\1%%/gi`, replaceString: '<div class="wh-moment wh-m-$1" markdown="1">\n$2\n</div>' },
    // A scene's place, when the player's bodies are in different places and the reply comes as one scene per place.
    { id: 'wh-place', scriptName: 'WH - Place', findRegex: '/^[ \\t]*%%place:[ \\t]*([^%\\n]{1,80}?)[ \\t]*%%[ \\t]*$/gim', replaceString: '<div class="wh-place">$1</div>' },
    // A marker whose partner went missing would otherwise show as raw text. Must run after the box scripts.
    { id: 'wh-stray-markers', scriptName: 'WH - Stray markers', findRegex: `/^[ \\t]*%%\\/?(?:possession|release|${MOMENTS.join('|')})%%[ \\t]*\\n?/gim`, replaceString: '' },
    // Your lines for one body ("[Kayla] takes the keys", from the body buttons) as labeled rows; your messages only.
    // [OOC …] and anything with a colon inside the brackets stay as typed.
    { id: 'wh-body-lines', scriptName: 'WH - Body lines', findRegex: '/^[ \\t]*\\[(?!ooc\\b)([^\\[\\]\\n:]{1,40})\\][ \\t]*(\\S.*)$/gim', replaceString: '\n<div class="wh-lane" markdown="1">\n<span class="wh-lane-name">$1</span> $2\n</div>\n', placement: [1] },
].map(s => ({ trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null, ...s }));
