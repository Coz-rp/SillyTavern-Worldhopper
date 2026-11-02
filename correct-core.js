// Worldhopper Engine — your corrections as Gym cases. Pure functions (no SillyTavern imports).
// With "Keep my corrections" on, a change you make by hand to the Body Ledger, the World notes or the Mind Book right
// after the model's update is kept as a case: what the model read, what it wrote, and what you made it. ⟲ on a reply
// the body checks fixed keeps one too: those fixes were wrong. The Gym replays each update on any model
// (tools/gym/corrections.mjs) and scores it on what you changed, so a prompt change can be measured against the
// mistakes you actually ran into, and on what you left alone, so a fix doesn't break what was right.
//
// Records are compared part by part (a body, a thing, one fact someone knows, a suggestion): names and set values
// exactly, free text by the words it shares, since a rerun words a place or a fact its own way.

import { normalizeLedger } from './ledger-core.js';
import { normalizeWorld } from './world-core.js';
import { normalizeBook } from './mind-core.js';

export const FIX_KINDS = ['ledger', 'world', 'mind', 'checks'];
export const FIX_LABELS = { ledger: 'Body Ledger', world: 'World notes', mind: 'Mind Book', checks: 'Body checks' };

const low = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const STOP = new Set('a an the and or of to in on at for with by from is are was were be been her his their its it they them she he you your my our this that as into onto off out up over no not'.split(' '));
const words = s => low(s).replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(' ').map(w => w.replace(/'s$/, '')).filter(w => w && !STOP.has(w));

/** How alike two short texts are: the share of their content words they have in common, 0 to 1. */
export function alike(a, b) {
    const x = new Set(words(a)), y = new Set(words(b));
    if (!x.size && !y.size) return 1;
    if (!x.size || !y.size) return 0;
    let n = 0;
    for (const w of x) if (y.has(w)) n++;
    return n / Math.max(x.size, y.size);
}
const SAME_TEXT = 0.5;   // two texts name the same thing (a fact, a thing, a suggestion)
const RIGHT_TEXT = 0.6;  // a rerun's text is close enough to yours

const names = xs => [...xs].map(low).sort().join(', ');
const clockText = s => low(s).replace(/[^a-z0-9]/g, '');

// One part of a record. group and id (a person's name) must match exactly, text (the part's own words) loosely;
// exact fields are names and set values, loose fields are free text.
const part = (group, id, text, exact = {}, loose = {}) => ({ group, id: low(id), text: String(text || ''), exact, loose });

/** The parts of a Ledger, World notes or Mind Book, for comparing. */
export function partsOf(kind, raw) {
    const out = [];
    if (kind === 'ledger') {
        const l = normalizeLedger(raw || {});
        for (const b of l.bodies) out.push(part('body', b.body || `(no body) ${b.driver}`, '', { driver: b.driver, user_knows: b.user_knows, pronouns: b.pronouns, driver_pronouns: b.driver_pronouns }, { how: b.how, host: b.host, notes: b.notes, doing: b.doing }));
        for (const o of l.own) out.push(part('own body', o.who, '', {}, { doing: o.doing, notes: o.notes }));
        for (const p of l.powers) out.push(part('power', p.who, '', {}, { power: p.power }));
        for (const a of l.aliases) out.push(part('names', a.name, '', { aka: names(a.aka) }));
    } else if (kind === 'world') {
        const w = normalizeWorld(raw || {});
        for (const t of w.things) out.push(part('thing', '', t.what, { whose: t.whose, holder: t.holder }, { where: t.where }));
        for (const k of w.knows) for (const f of k.facts) out.push(part('knows', k.who, f.fact, { how: f.how }));
        for (const p of w.people) out.push(part('place', p.who, '', {}, { where: p.where, wearing: p.wearing, state: p.state }));
        if (w.clock.day || w.clock.time) out.push(part('clock', '', '', { day: clockText(w.clock.day), time: clockText(w.clock.time) }));
        for (const t of w.timers) out.push(part('timer', '', t.what, {}, { when: t.when }));
    } else if (kind === 'mind') {
        const b = normalizeBook(raw || {});
        for (const h of b.hypnosis) {
            out.push(part('trance', h.who, '', { by: h.by, susceptibility: h.susceptibility, now: h.now, deepest: h.deepest, times: String(h.times), amnesia: h.amnesia }));
            for (const s of h.suggestions) out.push(part('suggestion', h.who, s.text, { stage: s.stage }));
            for (const t of h.triggers) out.push(part('trigger', h.who, t.cue, {}, { effect: t.effect }));
        }
        for (const c of b.control) {
            out.push(part('control', names(c.who), '', { by: c.by, resists: c.resists, user_knows: c.user_knows }, { own: c.own }));
            for (const s of c.set) out.push(part('will', names(c.who), s.text, { kind: s.kind }));
        }
        for (const e of b.perception) out.push(part('edit', '', e.what, { kind: e.kind, target: e.target, who: names(e.who), everyone: String(e.everyone), except: names(e.except), user_knows: e.user_knows }));
        for (const c of b.influence) out.push(part('change', c.who, c.what, { times: String(c.times), by: c.by }, { from: c.from }));
    }
    return out;
}

/** The part in `list` that is the same one as `p`: same group and person, and (when it has its own words) the closest of those. */
function find(list, p) {
    let best = null, score = 0;
    for (const q of list) {
        if (q.group !== p.group || q.id !== p.id) continue;
        const s = p.text || q.text ? alike(p.text, q.text) : 1;
        if (s >= SAME_TEXT && s > score) { best = q; score = s; }
    }
    return best;
}

const label = p => `${p.group}${p.id ? ` (${p.id})` : ''}${p.text ? `: ${p.text}` : ''}`;
const show = v => (v === '' ? '(blank)' : v);

/**
 * What you changed, part by part: added (a part the model left out), removed (one it shouldn't have written), changed
 * (the fields of a part that differ: exact ones when they differ at all, loose ones when the words do); kept: the
 * parts you left as the model wrote them.
 */
export function diffParts(kind, model, truth) {
    const m = partsOf(kind, model), t = partsOf(kind, truth);
    const changes = [], kept = [];
    for (const p of t) {
        const q = find(m, p);
        if (!q) { changes.push({ type: 'added', part: p, what: `added ${label(p)}` }); continue; }
        const exact = Object.keys(p.exact).filter(k => low(p.exact[k]) !== low(q.exact[k]));
        const loose = Object.keys(p.loose).filter(k => low(p.loose[k]) !== low(q.loose[k]));
        if (!exact.length && !loose.length) { kept.push({ part: p, what: label(p) }); continue; }
        const was = Object.fromEntries([...exact.map(k => [k, q.exact[k]]), ...loose.map(k => [k, q.loose[k]])]);
        changes.push({ type: 'changed', part: p, exact, loose, was,
            what: `${label(p)}: ${[...exact.map(k => `${k} ${show(q.exact[k])} → ${show(p.exact[k])}`), ...loose.map(k => `${k} "${show(q.loose[k])}" → "${show(p.loose[k])}"`)].join('; ')}` });
    }
    for (const q of m) if (!find(t, q)) changes.push({ type: 'removed', part: q, what: `removed ${label(q)}` });
    return { changes, kept };
}

/**
 * A rerun's record scored against your correction. fixed: one check per change you made (is it right now?); kept: one
 * per part you left alone, on its names and set values only (is it still right?).
 */
export function scoreFix(fix, output) {
    const { changes, kept } = diffParts(fix.kind, fix.model, fix.truth);
    const out = partsOf(fix.kind, output);
    const looseOk = (k, p, o, was) => { const s = alike(o?.loose[k], p.loose[k]); return s >= RIGHT_TEXT && (was == null || s > alike(was, p.loose[k])); };
    const fixed = changes.map(c => {
        const o = find(out, c.part);
        let ok;
        if (c.type === 'removed') ok = !o;
        else if (!o) ok = false;
        else if (c.type === 'added') ok = Object.keys(c.part.exact).every(k => low(o.exact[k]) === low(c.part.exact[k])) && Object.keys(c.part.loose).every(k => !c.part.loose[k] || looseOk(k, c.part, o));
        else ok = c.exact.every(k => low(o.exact[k]) === low(c.part.exact[k])) && c.loose.every(k => looseOk(k, c.part, o, c.was[k]));
        return { ok, what: c.what };
    });
    const still = kept.map(k => {
        const o = find(out, k.part);
        return { ok: !!o && Object.keys(k.part.exact).every(f => low(o.exact[f]) === low(k.part.exact[f])), what: k.what };
    });
    return { fixed, kept: still };
}

/**
 * A case from one correction. input: exactly what the update was given (ledgerStep / worldStep / mindStep's first
 * argument); model: the record it left; truth: the record as you made it. Null when nothing differs.
 */
export function makeFix({ id, kind, input, model, truth, meta = {} }) {
    const { changes } = diffParts(kind, model, truth);
    if (!changes.length) return null;
    return { v: 1, id, kind, when: new Date().toISOString(), ...meta, input, model, truth, changes: changes.map(c => c.what) };
}

/** A case from ⟲ on a reply the body checks fixed: the reply as written, the Ledger it was checked with, the fixes undone. */
export function makeChecksFix({ id, text, ledger, userName, rejected, meta = {} }) {
    if (!rejected?.length) return null;
    return { v: 1, id, kind: 'checks', when: new Date().toISOString(), ...meta, input: { text, ledger, userName },
        rejected: rejected.map(r => ({ action: r.action, from: r.from, to: r.to || '' })), changes: rejected.map(r => `undid ${r.action === 'CUT' ? 'cut' : 'pronoun fix'}: "${r.from}"`) };
}

/** A rerun of the body checks scored: each fix you undid should not come back. */
export function scoreChecks(fix, applied) {
    return { fixed: fix.rejected.map(r => ({ ok: !applied.some(a => (a.action || 'PRONOUN') === r.action && alike(a.from, r.from) >= 0.8), what: `${r.action === 'CUT' ? 'cut' : 'pronoun fix'} not made again: "${r.from}"` })), kept: [] };
}

/** File name for a case: SillyTavern's file store takes letters, digits, '-', '_' and '.' only. */
export const fixFileName = id => `wh-fix-${String(id).replace(/[^\w-]/g, '')}.json`;
