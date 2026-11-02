// Worldhopper Engine — card rules as dials. Pure functions (no SillyTavern imports).
// A card stores how its power works as settings (extensions.worldhopper.rules) instead of paragraphs that argue with
// the Codex's defaults. The compiler turns the settings into one block for the writer (where it differs from the
// Codex, the card wins), lines for the Ledger, and what a host should remember when a ride ends.
//
// rules = { rider: { name, pronouns }, host_pronouns, <dial>: value or [values], <dial>_detail: text, limits: [text],
//           notes: [text] }
// A dial left out keeps the Codex's default and writes nothing.

const PRONOUN_SETS = {
    'he/him': { sub: 'he', obj: 'him', pos: 'his', poss: 'his', refl: 'himself', s: 's', es: 'es', cs: '\'s', was: 'was' },
    'she/her': { sub: 'she', obj: 'her', pos: 'her', poss: 'hers', refl: 'herself', s: 's', es: 'es', cs: '\'s', was: 'was' },
    'they/them': { sub: 'they', obj: 'them', pos: 'their', poss: 'theirs', refl: 'themself', s: '', es: '', cs: '\'re', was: 'were' },
};
const pronounSet = p => PRONOUN_SETS[String(p || '').toLowerCase().replace(/\s/g, '')] || PRONOUN_SETS['they/them'];

// Text tokens: {R} the rider's name; {r.sub} {r.obj} {r.pos} {r.poss} {r.refl} the rider's pronouns (he, him, his,
// his, himself) and {h.…} the host's; {r.s} {r.es} {r.cs} {r.was} and the {h.…} ones agree a verb ("she goes",
// "they go", "she's", "they're").
function fill(text, ctx) {
    const sets = { r: pronounSet(ctx.rider?.pronouns), h: pronounSet(ctx.host_pronouns) };
    return String(text).replace(/\{R\}/g, ctx.rider?.name || 'The rider')
        .replace(/\{([rh])\.(\w+)\}/g, (m, w, k) => sets[w][k] ?? m)
        .replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

/**
 * The dials. Each option has a label for the editor and the writer's text; `codex` marks the option the Codex already
 * assumes for Possession, which compiles to nothing. `ledger` and `aftermath` feed the Ledger and the history notes.
 */
export const DIALS = [
    { key: 'entry', label: 'Getting in', options: [
        { value: 'touch', label: 'Touch', text: '{R} gets in by touch, skin to skin.' },
        { value: 'sight', label: 'Sight', text: '{R} gets in by sight: the host has to be close and in view.' },
        { value: 'kiss', label: 'A kiss', text: '{R} gets in with a kiss.' },
        { value: 'will', label: 'Will alone', text: '{R} gets in by willing it, with no contact needed.' },
        { value: 'item', label: 'An item', text: '{R} gets in through an object.' },
        { value: 'spell', label: 'A spell', text: '{R} gets in by spell or ritual.' },
        { value: 'device', label: 'A device', text: '{R} gets in with a device.' },
        { value: 'involuntary', label: 'Not by choice', text: '{R} doesn\'t choose when it happens.' },
    ] },
    { key: 'own_body', label: 'The rider\'s own body', options: [
        { value: 'limp', label: 'Goes limp', codex: true, text: '{R}\'s own body goes limp where {r.sub} left it, empty until {r.sub} come{r.s} back.',
            ledger: '{R}\'s own body is left empty while {r.sub} ride{r.s} someone.' },
        { value: 'awake', label: 'Stays awake (runs both)', text: '{R}\'s own body stays awake and in {r.pos} use while {r.sub} ride{r.s}; {r.sub} run{r.s} both at once.' },
        { value: 'travels', label: 'Travels inside the host', text: '{R}\'s own body comes along inside the host. Nothing is left behind but what {r.sub} wore or held, which drops where {r.sub} stood, so when {r.sub} leave{r.s}, {r.sub} come{r.s} out naked.',
            ledger: '{R}\'s own body travels inside whoever {r.sub} ride{r.s}, so it is never left empty anywhere: never list it as an empty body.' },
        { value: 'vanishes', label: 'Vanishes', text: '{R}\'s own body is gone while {r.sub} ride{r.s} and reappears when {r.sub} leave{r.s}.',
            ledger: '{R}\'s own body is gone while {r.sub} ride{r.s}, not left empty anywhere: never list it as an empty body.' },
        { value: 'none', label: 'Has none', text: '{R} has no body of {r.pos} own: {r.sub} live{r.s} only in hosts.', ledger: '{R} has no body of {r.pos} own: never list one.' },
    ] },
    { key: 'host_body', label: 'The host\'s body', options: [
        { value: 'full', label: 'All of it', codex: true, text: '{R} has all of the host\'s body: voice, face, balance, reflexes, strength, and every sensation exactly as {h.sub}\'d feel it.' },
        { value: 'reacts', label: 'All of it, and it reacts on its own', text: '{R} has all of the host\'s body: voice, face, balance, reflexes, strength, and every sensation exactly as {h.sub}\'d feel it. The body still reacts on its own: {h.pos} pulse, nerves, and arousal answer what {h.sub}\'d answer, whether {R} wants them to or not.' },
    ] },
    { key: 'host_mind', label: 'The host\'s mind', options: [
        { value: 'gone', label: 'Out', codex: true, text: 'The host\'s own mind is out while ridden: no awareness, no inner voice, no struggle.' },
        { value: 'asleep', label: 'Asleep under the rider', text: 'The host\'s own mind falls asleep under {R}. Whatever was on it keeps drifting up like thoughts in a dream, and {R} can let those thoughts wander or steer them.',
            ledger: 'A host {R} rides is asleep under {r.obj} (host: "asleep inside, unaware"), never aware.' },
        { value: 'passenger', label: 'Awake inside, powerless', text: 'The host\'s own mind stays awake inside, aware and powerless; what {h.sub} think{h.s} and feel{h.s} while ridden is real.',
            ledger: 'A host {R} rides stays awake inside, aware and powerless (host: "awake inside, powerless").' },
    ] },
    { key: 'surface', label: 'Bringing the host up', options: [
        { value: 'never', label: 'Never', codex: true, text: '' },
        { value: 'merge', label: 'Can merge for skilled work', text: 'For anything that takes the host\'s skill or brains, {R} can let {h.pos} mind come up under {r.obj} until they merge: {h.sub} do{h.es} the thinking while {R} keeps the wheel. It\'s a balance. With too little of {h.obj}, {h.sub} can\'t work, and with too much, {h.sub}\'d realize someone else is running {h.pos} body. While {h.sub}{h.cs} up, {h.sub} drift{h.s} now and then, and {R} nudges {h.obj} back before {h.sub} can follow the thought; {h.sub} never become{h.s} aware of {r.obj}. While {h.sub}{h.cs} up, {R} can only say what {h.sub} would say. When {R} puts {h.obj} back to sleep, {r.sub} feel{r.s} slower and duller, because the sharp mind was {h.poss}.' },
    ] },
    { key: 'memory', label: 'The host\'s memories', options: [
        { value: 'habits', label: 'Habits only; facts when reached for', codex: true, text: 'The body\'s habits come with it; facts come only when {R} reaches for them, without the feelings.' },
        { value: 'none', label: 'None', text: '{R} gets none of the host\'s memories, only the body\'s habits.' },
        { value: 'on_demand', label: 'On demand, impressions faint', text: '{R} reads the host\'s memories whenever {r.sub} want{r.s}: names, faces, plans, passcodes, where things are, how {h.sub} do{h.es} things, each with {h.pos} feelings attached. Facts come clear, but {h.pos} impressions of people come faint and colored by how {h.sub} see{h.s} them, so {R} still gets people wrong.' },
        { value: 'everything', label: 'All of them at once', text: '{R} gets all of the host\'s memories at once, feelings and all.' },
    ] },
    { key: 'will', label: 'The host\'s will', options: [
        { value: 'none', label: 'No resistance', codex: true, text: '' },
        { value: 'faint', label: 'Pushes back faintly', text: 'The host can\'t stop {R}, but {h.pos} values push back faintly when {R} goes against them: a reluctance {r.sub} can feel and override.' },
        { value: 'fights', label: 'Can fight back', text: 'The host can fight {R} for control, and a strong enough push can throw {r.obj} out.' },
    ] },
    { key: 'bleed', label: 'Bleed', options: [
        { value: 'none', label: 'None', codex: true, text: '' },
        { value: 'feelings', label: 'Feelings seep in', text: 'Over a ride, the host\'s crushes, nerves, and wants seep into {R} until {r.sub} can\'t always tell which ones are {r.poss}.' },
        { value: 'habits', label: 'Habits stick', text: 'The host\'s habits stick to {R} for a while after {r.sub} leave{r.s}.' },
        { value: 'drift', label: 'Personality drifts', text: 'The longer and more often {R} rides someone, the further {r.pos} personality drifts toward {h.poss}.' },
    ] },
    { key: 'exit', label: 'Getting out', multi: true, options: [
        { value: 'will', label: 'At will', codex: true, text: '{R} leaves whenever {r.sub} want{r.s}.' },
        { value: 'timer', label: 'A time limit', text: 'A ride only lasts so long.' },
        { value: 'item', label: 'Losing the item', text: '{R} is thrown out if the item that carries {r.obj} is lost.' },
        { value: 'range', label: 'Out of range', text: '{R} is pulled out if the host gets too far from {r.pos} own body.' },
        { value: 'host', label: 'The host wins', text: 'The host can force {R} out.' },
        { value: 'permanent', label: 'Never', text: 'A ride is permanent: there is no way back out.' },
    ] },
    { key: 'aftermath', label: 'Afterward', options: [
        { value: 'nothing', label: 'Remembers nothing', codex: true, text: 'When {R} leaves, the host comes back to missing time and remembers nothing of the ride.', aftermath: 'nothing of the ride' },
        { value: 'own', label: 'Remembers it as their own', text: 'When {R} leaves, the host keeps every memory of the ride as if {h.sub} lived it {h.refl}: no gap and no sense of anyone else. A bold night is just a night {h.sub} {h.was} bolder than usual, and {h.sub} explain{h.s} it to {h.refl} the way people do. Nobody, the host included, ever learns {R} was there.',
            aftermath: 'everything, as {h.pos} own: no gap and no sense of anyone else', ledger: 'A host {R} leaves remembers the ride as {h.pos} own and never knows {r.sub} {r.was} there.' },
        { value: 'dream', label: 'Like a dream', text: 'When {R} leaves, the host remembers the ride hazily, like a dream {h.sub} can\'t quite hold.', aftermath: 'the ride, hazily, like a dream' },
        { value: 'knows', label: 'Knows', text: 'When {R} leaves, the host remembers the ride and knows someone else was driving.', aftermath: 'the ride, and that someone else was driving' },
    ] },
    { key: 'detection', label: 'Who can tell', options: [
        { value: 'nobody', label: 'Nobody', codex: true, text: '' },
        { value: 'hoppers', label: 'Others with the power', text: 'Others with the same power can tell who is inside.' },
        { value: 'mirrors', label: 'Mirrors', text: 'Mirrors show who is really inside.' },
    ] },
    // Change over time, for any mode: set, the Mind Book keeps a record of each change and counts the times it's done
    // (holds: how many before it holds on its own); left out, nothing builds and nothing is tracked.
    { key: 'change', label: 'Change that builds', options: [
        { value: 'none', label: 'Doesn\'t build', codex: true, text: '' },
        { value: 'fast', label: 'Builds fast (holds after 2 times)', holds: 2, text: 'What the power changes in someone builds each time it\'s done, and fast: by the second time it holds on its own.' },
        { value: 'builds', label: 'Builds (holds after about 4 times)', holds: 4, text: 'What the power changes in someone builds each time it\'s done: the first time is a nudge they can shrug off, each time after goes deeper, and after about four times it holds on its own.' },
        { value: 'slow', label: 'Builds slowly (holds after about 8 times)', holds: 8, text: 'What the power changes in someone builds slowly, a little each time it\'s done: it takes around eight times before it holds on its own.' },
    ] },
    { key: 'fade', label: 'Change left alone', options: [
        { value: 'stays', label: 'Stays', codex: true, text: '' },
        { value: 'fades', label: 'Fades back unless renewed', text: 'A change that isn\'t renewed fades: left alone long enough, it slips back a step, and one that never held fades away.' },
    ] },
];

const DIAL = Object.fromEntries(DIALS.map(d => [d.key, d]));

/** Rules as stored, cleaned: unknown dials and values dropped, details and lists trimmed. */
export function normalizeRules(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = { rider: { name: String(raw.rider?.name || '').trim(), pronouns: String(raw.rider?.pronouns || '').trim() } };
    if (raw.host_pronouns) out.host_pronouns = String(raw.host_pronouns).trim();
    for (const d of DIALS) {
        const values = (Array.isArray(raw[d.key]) ? raw[d.key] : raw[d.key] == null ? [] : [raw[d.key]]).map(String).filter(v => d.options.some(o => o.value === v));
        if (values.length) out[d.key] = d.multi ? [...new Set(values)] : values[0];
        const detail = String(raw[`${d.key}_detail`] ?? '').replace(/\s+/g, ' ').trim();
        // Past 400 characters, a detail ends at its last full sentence rather than mid-word.
        if (detail) out[`${d.key}_detail`] = detail.length <= 400 ? detail : (detail.slice(0, 400).match(/^[\s\S]*[.!?](?=\s|$)/)?.[0] || detail.slice(0, 400));
    }
    for (const k of ['limits', 'notes']) {
        const xs = (Array.isArray(raw[k]) ? raw[k] : raw[k] ? [raw[k]] : []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (xs.length) out[k] = xs.slice(0, 8).map(x => x.slice(0, 300));
    }
    return out;
}

const chosen = (rules, d) => (Array.isArray(rules[d.key]) ? rules[d.key] : rules[d.key] ? [rules[d.key]] : [])
    .map(v => d.options.find(o => o.value === v)).filter(Boolean);
const sentence = s => { s = String(s || '').trim(); return !s ? '' : /[.!?)"]$/.test(s) ? s : `${s}.`; };

/**
 * The card's rules for the writer, the Ledger and the history notes.
 * writer: one block with the dials that differ from the Codex (and any dial with a detail), in plain sentences;
 * ledger: lines the Ledger needs (where the rider's own body is, what a ridden host's mind is doing);
 * aftermath: what a host remembers when a ride ends, for the history notes ('' when it's the Codex's "nothing");
 * change: how fast change builds, for the Mind Book: { holds: times until it holds (0: it doesn't build), fades }.
 */
export function compileRules(raw) {
    const rules = normalizeRules(raw);
    if (!rules) return { writer: '', ledger: [], aftermath: '', change: { holds: 0, fades: false } };
    const lines = [];
    for (const d of DIALS) {
        const opts = chosen(rules, d);
        const detail = rules[`${d.key}_detail`];
        if (!opts.length && !detail) continue;
        if (opts.length && opts.every(o => o.codex) && !detail) continue;   // the Codex already says it
        const text = [...opts.map(o => fill(o.text, rules)).filter(Boolean), detail ? sentence(fill(detail, rules)) : ''].filter(Boolean).join(' ');
        if (text) lines.push(`- ${d.label}: ${text}`);
    }
    for (const l of rules.limits || []) lines.push(`- Limit: ${sentence(fill(l, rules))}`);
    for (const n of rules.notes || []) lines.push(`- ${sentence(fill(n, rules))}`);
    const name = rules.rider.name || 'This card';
    const writer = lines.length ? `<card_rules>\n${name}'s power works like this. Where it differs from the general Codex rules, this wins.\n${lines.join('\n')}\n</card_rules>` : '';
    const ledger = DIALS.flatMap(d => chosen(rules, d).filter(o => o.ledger && !o.codex).map(o => fill(o.ledger, rules)));
    const after = chosen(rules, DIAL.aftermath)[0];
    const holds = chosen(rules, DIAL.change)[0]?.holds || 0;
    return { writer, ledger, aftermath: after && !after.codex ? fill(after.aftermath, rules) : '',
        change: { holds, fades: !!holds && chosen(rules, DIAL.fade).some(o => o.value === 'fades') } };
}

/** Each option the rules pick that gives the writer a sentence of its own (not the Codex's), with it: { key, value, text }. */
export function pickedLines(raw) {
    const rules = normalizeRules(raw);
    if (!rules) return [];
    return DIALS.flatMap(d => chosen(rules, d).filter(o => o.text && !o.codex).map(o => ({ key: d.key, value: o.value, text: fill(o.text, rules) })));
}

// The few settings that say the most about a card at a glance, for the one-line summary under its modes.
const SHORT = {
    'host_mind:asleep': 'host asleep', 'host_mind:passenger': 'host awake inside', 'own_body:travels': 'body travels inside',
    'own_body:awake': 'runs both bodies', 'surface:merge': 'can merge', 'aftermath:own': 'remembers it as {h.pos} own',
    'aftermath:dream': 'remembers it like a dream', 'aftermath:knows': 'host knows afterward', 'entry:sight': 'by sight', 'entry:kiss': 'with a kiss',
    'change:fast': 'change builds fast', 'change:builds': 'change builds', 'change:slow': 'change builds slowly',
};

/** How many rules a card sets (anything that writes a line) and up to three short words on the most telling ones. */
export function rulesSummary(raw) {
    const rules = normalizeRules(raw);
    if (!rules) return { count: 0, highlights: [] };
    let count = (rules.limits?.length || 0) + (rules.notes?.length || 0);
    const highlights = [];
    for (const d of DIALS) {
        const opts = chosen(rules, d);
        if (rules[`${d.key}_detail`] || opts.some(o => !o.codex)) count++;
        for (const o of opts) if (SHORT[`${d.key}:${o.value}`]) highlights.push(fill(SHORT[`${d.key}:${o.value}`], rules).toLowerCase());
    }
    const order = ['host', 'remembers', 'body', 'can', 'runs', 'by', 'with', 'change'];
    highlights.sort((a, b) => order.findIndex(w => a.startsWith(w)) - order.findIndex(w => b.startsWith(w)));
    return { count, highlights: highlights.slice(0, 3) };
}

// ------------------------------------------------------------------ from a card's prose to settings
// "Read them from the card": a model fills the dials from what the card already says and names the passages that
// only state those rules, so they can come out of the card and the writer gets them once. Nothing is changed until
// you approve it, and the cut text is kept on the card so it can go back.

export const CONVERT_SYSTEM = `You move a roleplay character card's power rules out of its prose and into settings, so the writer reads them once instead of twice and the card gets shorter. You get the card's fields and the settings; each option comes with the sentence it gives the writer.
1. Fill in every setting the card makes clear, with the option that fits, and leave out any setting the card doesn't settle. "<setting>_detail" is only for what the card says that the option's sentence doesn't already say: the card's particular words, flavor and habits around that rule (an alibi, where the clothes end up, a record ride), at most 30 words, in the card's own wording, inventing nothing. Never repeat the option's sentence in its detail. "limits" and "notes" are only for rules no setting or detail already carries; most cards need neither. "rider" is whose power it is (the short name the story uses, and pronouns); "host_pronouns" are the pronouns of the people they usually take.
2. List the passages to cut: the whole section that states how the power works, its heading or lead-in line included, and any other line that only states rules. When a rules line also carries a habit or flavor, move that into the matching detail and cut the line, so nothing is lost and nothing is said twice. Copy each passage exactly as the card writes it, whole lines only. Never cut anything about who the character is: their looks, personality, history, relationships, wants, the player's role, sexual preferences, or tone. Only a paragraph that is mostly about the character and not the rules stays, listed in "unsure" with a few words on why. A post-history field that only repeats the rules is cut whole, except a {{original}} line.
3. Write "stand_in": one plain sentence that takes the place of the cut section in the description, saying only what the power is, in the card's own voice and format (keep a bold heading like "**The Hop.**" if the section had one) and with its macros ({{char}}, {{user}}) as the card uses them. Leave it "" if nothing is cut from the description.
Answer with JSON only:
{"rules":{"rider":{"name":"","pronouns":""},"host_pronouns":"","entry":"","entry_detail":"","limits":[],"notes":[]},"cut":[{"field":"description","text":""}],"stand_in":"","unsure":[{"field":"","text":"","why":""}]}`;

/** @param {{name: string, fields: Object<string, string>}} p  the card's text fields by name */
/** The dials and their options as a list for a model, each option with the sentence it gives the writer. */
export function dialsForPrompt() {
    const say = text => fill(text, { rider: { name: 'The rider', pronouns: 'they/them' }, host_pronouns: 'they/them' });
    return DIALS.map(d => `- ${d.key}${d.multi ? ' (a list)' : ''}: ${d.label}. Options:\n${d.options.map(o => `  - ${o.value}: ${say(o.text) || '(writes nothing)'}`).join('\n')}`).join('\n');
}

export function buildConvertMessages({ name, fields }) {
    const settings = dialsForPrompt();
    const card = Object.entries(fields).filter(([, v]) => String(v || '').trim()).map(([k, v]) => `### ${k}\n${v}`).join('\n\n');
    return [
        { role: 'system', content: CONVERT_SYSTEM },
        { role: 'user', content: `The settings:\n${settings}\n\nThe card "${name}":\n\n${card}\n\nNow answer with the JSON.` },
    ];
}

/** { rules, cut, standIn, unsure } from the model's answer, or null. */
export function parseConvert(text) {
    const s = String(text || '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    let j;
    try { j = JSON.parse(s.slice(a, b + 1)); } catch { return null; }
    if (!j || typeof j.rules !== 'object') return null;
    const list = v => (Array.isArray(v) ? v : []).filter(x => x && typeof x.text === 'string' && x.text.trim());
    return { rules: normalizeRules(j.rules) || {}, cut: list(j.cut), standIn: String(j.stand_in || '').trim(), unsure: list(j.unsure) };
}

const looseText = s => String(s || '').toLowerCase().replace(/[*_`"“”'‘’]/g, '').replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
// Never more than this share of a field goes: a card is mostly who the character is.
const MAX_CUT_SHARE = 0.75;

/**
 * Takes the named passages out of the card's fields. A passage is found as written, or else as the whole lines it
 * covers (a model copying with small slips). The stand-in sentence takes the place of the first cut in the description.
 * Returns { fields: changed fields only, parts: { field: [{ text, kind: 'keep' | 'cut' | 'add' }] }, missed, tooMuch }.
 */
export function applyConvertCuts(fields, cut = [], standIn = '') {
    const out = {}, parts = {}, missed = [], tooMuch = [];
    for (const [field, text] of Object.entries(fields)) {
        const mine = cut.filter(c => c.field === field);
        if (!mine.length || !text) continue;
        const ranges = [];
        for (const c of mine) {
            const want = c.text.trim(), i = text.indexOf(want);
            if (i >= 0) { ranges.push([i, i + want.length]); continue; }
            const loose = looseText(want);
            let pos = 0, hit = false;
            for (const line of text.split('\n')) {
                const n = looseText(line);
                // The line is inside the passage, or the passage is nearly all of the line.
                if (n.length > 3 && (loose.includes(n) || (n.includes(loose) && loose.length >= 0.8 * n.length))) { ranges.push([pos, pos + line.length]); hit = true; }
                pos += line.length + 1;
            }
            if (!hit) missed.push(c);
        }
        if (!ranges.length) continue;
        ranges.sort((x, y) => x[0] - y[0]);
        const merged = [];
        for (const r of ranges) {
            const last = merged[merged.length - 1];
            // Two cuts with only blank space between them are one.
            if (last && (r[0] <= last[1] || !text.slice(last[1], r[0]).trim())) last[1] = Math.max(last[1], r[1]); else merged.push([...r]);
        }
        // Post-history that only repeats the rules can go whole; anything else keeps most of itself.
        if (field !== 'post_history_instructions' && merged.reduce((n, [x, y]) => n + y - x, 0) > MAX_CUT_SHARE * text.length) { tooMuch.push(field); continue; }
        // A stand-in that only says what the line just above the cut already says would say it twice.
        const above = looseText(text.slice(0, merged[0][0]).trim().split('\n').pop());
        const sayStandIn = field === 'description' && standIn && !(above && above.includes(looseText(standIn).replace(/^.*?\.\s+/, '').slice(0, 40)));
        const segs = [];
        let at = 0;
        merged.forEach(([x, y], k) => {
            if (x > at) segs.push({ text: text.slice(at, x), kind: 'keep' });
            if (k === 0 && sayStandIn) segs.push({ text: standIn, kind: 'add' });
            segs.push({ text: text.slice(x, y), kind: 'cut' });
            at = y;
        });
        if (at < text.length) segs.push({ text: text.slice(at), kind: 'keep' });
        parts[field] = segs;
        out[field] = segs.filter(p => p.kind !== 'cut').map(p => p.text).join('').replace(/\n{3,}/g, '\n\n').trim();
        if (/\{\{original\}\}/.test(text) && !/\{\{original\}\}/.test(out[field])) out[field] = `{{original}}\n${out[field]}`.trim();
    }
    return { fields: out, parts, missed, tooMuch };
}

/** The rules on a card (V2 data), or null. */
export const cardRules = data => normalizeRules(data?.extensions?.worldhopper?.rules);
