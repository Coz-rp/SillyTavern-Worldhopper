// Worldhopper Engine — the Body Ledger and the Mind Book as you see them when you tap their bars above the chat: a card
// for each body or person, readable at a glance. Each part of a card can be changed on its own: a faint ✏️ in its corner
// swaps just that part for a small form. A body's card holds its Ledger row and who its owner is in their own life,
// together. Every save, picture and model call hands back to index.js, which gathers the data (ledgerViewData,
// mindViewData). jQuery is SillyTavern's $.
import { STAGES } from './mind-core.js';
import { PERSONA_FIELDS } from './persona-core.js';

const el = (tag, cls = '', text) => {
    const e = $(document.createElement(tag));
    if (cls) e.addClass(cls);
    if (text != null) e.text(text);
    return e;
};
const fa = name => $(`<i class="fa-solid ${name}" aria-hidden="true"></i>`);
const txt = s => document.createTextNode(s);
const press = (node, fn) => node.attr({ role: 'button', tabindex: 0 }).on('click keydown', e => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    fn();
});

/** A small round button. */
export function iconButton(icon, title, fn) {
    return press(el('div', `menu_button menu_button_icon wh-dos-btn fa-solid ${icon}`).attr('title', title), fn);
}
const textButton = (icon, label, fn, cls = '') => press(el('div', `menu_button wh-dos-tbtn ${cls}`).append(fa(icon), txt(` ${label}`)), fn);
/** A faint tool in a part's corner (✏️, 🔄). */
const tool = (icon, title, fn) => press(el('span', `wh-dos-tool fa-solid ${icon}`).attr('title', title), fn);

/**
 * The face of a card: the person's picture when there is one, else their initial, in the color of who's doing it.
 * face: { image, busy, open } — open makes it a button (draw, replace or remove the picture).
 */
function avatar(name, kind, face = {}) {
    const a = el('div', `wh-dos-avatar wh-dos-k-${kind}`);
    if (face.image) a.append($('<img alt="" loading="lazy">').attr('src', face.image));
    else a.append(el('span', 'wh-dos-initial', String(name || '?').trim().charAt(0).toUpperCase() || '?'));
    if (face.busy) a.addClass('wh-dos-drawing').append(el('span', 'wh-dos-spin').append(fa('fa-spinner fa-spin')));
    if (face.open) {
        press(a.addClass('wh-dos-pic').attr('title', face.image ? `${name}'s picture` : `Draw ${name}`), face.open);
        a.append(el('span', 'wh-dos-badge').append(fa(face.image ? 'fa-expand' : 'fa-wand-magic-sparkles')));
    }
    return a;
}
const pill = (cls, icon, label) => el('span', `wh-dos-pill ${cls}`).append(icon ? fa(icon) : '', txt(`${icon ? ' ' : ''}${label}`));

function header(title, sub, icon, extra = '') {
    return el('div', 'wh-dos-head').append(el('div', 'wh-dos-head-text').append(el('h3', 'wh-dos-title').append(fa(icon), txt(` ${title}`)), el('small', 'wh-dos-sub', sub)), extra);
}
/** "Draw missing pictures": a button while anyone here can have a picture and has none, or how far along it is. */
const drawMissing = (d, a) => (d.batch ? el('span', 'wh-dos-batch').append(fa('fa-spinner fa-spin'), txt(` ${d.batch}`))
    : d.missing?.length ? textButton('fa-wand-magic-sparkles', `Draw missing pictures (${d.missing.length})`, () => a.drawMissing(d.missing)) : '');
const section = (title, icon, count) => el('div', 'wh-dos-section').append(fa(icon), txt(` ${title}`), count ? el('span', 'wh-dos-count', String(count)) : '');

// ------------------------------------------------------------------ forms

const input = (k, label, ph, value, cls = '') => el('label', `wh-dos-f ${cls}`).append(el('small', '', label),
    $('<input type="text" class="text_pole">').attr({ 'data-k': k, placeholder: ph }).val(value ?? ''));
const area = (k, label, ph, value, rows = 2) => el('label', 'wh-dos-f wh-dos-full').append(el('small', '', label),
    $('<textarea class="text_pole"></textarea>').attr({ 'data-k': k, placeholder: ph, rows }).val(value ?? ''));
const choose = (k, label, options, value) => el('label', 'wh-dos-f').append(el('small', '', label),
    $('<select class="text_pole"></select>').attr('data-k', k).append(options.map(o => $('<option></option>').val(o).text(o || '—'))).val(value ?? ''));
const tick = (k, label, checked) => el('label', 'checkbox_label wh-dos-full').append($('<input type="checkbox">').attr('data-k', k).prop('checked', !!checked), el('span', '', label));
const grid = (...fields) => el('div', 'wh-dos-fields').append(fields);
/** What a form holds, by data-k (a checkbox reads 'yes' or 'no'). */
function readForm(form) {
    const o = {};
    form.find('[data-k]').each((_, x) => { o[$(x).attr('data-k')] = x.type === 'checkbox' ? (x.checked ? 'yes' : 'no') : String($(x).val() ?? ''); });
    return o;
}

/**
 * Swaps a node for a small form: fields, then ✓ and ✕ (and a remove button when given). save(values) resolves false to
 * stay in the form (say, a warning); otherwise the view is drawn again from what's recorded. While a form is open, the
 * view waits to redraw (the wh-dos-editing class), so an update landing meanwhile can't wipe what you're typing.
 */
function openForm(node, { fields, save, remove, removeLabel = 'Remove', refresh, wide = false }) {
    const form = el('div', `wh-dos-form wh-dos-editing${wide ? ' wh-dos-form-wide' : ''}`).append(fields);
    const done = () => { form.removeClass('wh-dos-editing'); refresh(); };
    let busy = false;
    const ok = async () => {
        if (busy) return;
        busy = true;
        const r = await save(readForm(form));
        busy = false;
        if (r !== false) done();
    };
    form.append(el('div', 'wh-dos-form-actions').append(
        remove ? textButton('fa-trash-can', removeLabel, async () => { if (await remove() !== false) done(); }, 'wh-dos-danger') : '',
        el('span', 'wh-dos-grow'),
        textButton('fa-xmark', 'Cancel', done),
        textButton('fa-check', 'Save', ok, 'wh-dos-primary'),
    ));
    // Enter in a one-line field saves; Escape anywhere in the form cancels just the form, not the whole view.
    form.on('keydown', 'input, textarea, select', e => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); ok(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); }
    });
    node.replaceWith(form);
    form.find('input, textarea, select').first().trigger('focus');
}

/**
 * A part of a card that can be changed on its own: shown as content, with a faint ✏️ (and any other tools) in its
 * corner. form: { fields, save, remove, removeLabel } for openForm; null makes it read-only.
 */
function part(content, form, refresh, { cls = '', tools = [], label = 'this' } = {}) {
    const box = el('div', `wh-dos-part ${cls}`).append(content);
    if (form || tools.length) {
        const pen = form ? tool('fa-pen', `Change ${label}`, () => openForm(box, { ...form, refresh })) : '';
        box.append(el('span', 'wh-dos-tools').append(tools, pen));
    }
    return box;
}

// ------------------------------------------------------------------ Body Ledger

function sheetBlock(sheet) {
    const box = el('div', 'wh-dos-sheet');
    for (const f of PERSONA_FIELDS) if (sheet?.[f]) box.append(el('div', 'wh-dos-sheet-row').append(el('span', 'wh-dos-label', f), el('span', 'wh-dos-value', sheet[f])));
    return box;
}
const sheetFields = sheet => grid(
    area('Look', 'Look', 'what people notice first about them', sheet?.Look),
    area('Voice & habits', 'Voice & habits', 'how they talk, and one small habit', sheet?.['Voice & habits']),
    area('Life', 'Life', 'what they do and who they live with', sheet?.Life),
);
const WHO_FIELDS = r => [
    input('body', 'Body', 'whose body', r.body), input('pronouns', 'Pronouns', 'she/her', r.pronouns),
    input('driver', 'Mind inside', 'who is in it (blank if nobody)', r.driver), input('driver_pronouns', 'Their pronouns', 'he/him', r.driver_pronouns),
    input('how', 'How', 'possession, swap, skinsuit…', r.how), input('host', "Owner's mind", 'gone, asleep, watching…', r.host),
    tick('user_knows', 'You know about this', r.user_knows !== 'no'),
];
const WHERE_FIELDS = r => [
    input('notes', 'Where, and anything to remember', 'in the campus library, gray hoodie', r.notes, 'wh-dos-full'),
    input('doing', 'Busy with', 'what it is doing right now', r.doing, 'wh-dos-full'),
];

/**
 * @param {object} d  from index.js's ledgerViewData: { bodies, powers, aliases, back, past, history, empty, missing, batch }. A body is
 *   { i, row, title, kind, icon, inside, hidden, sheetable, sheet, removed, busy, face }; back and past hosts are
 *   { body, sheet, busy, face }.
 * @param {object} a  { saveBody(i, row, { row, sheet }), removeBody(i, row), saveSheet(name, values), deleteSheet(name),
 *   writeSheet(name), makePersona(name), savePower(i, p), saveAlias(i, alias), drawMissing(names), refresh }; savePower/saveAlias
 *   take null to remove.
 */
export function ledgerView(d, a) {
    const root = el('div', 'wh-dos');
    root.append(header('Body Ledger', 'Who is in which body right now, and who they are in their own lives. Tap ✏️ by anything to change it.', 'fa-people-arrows', drawMissing(d, a)));

    // Who someone is in their own life: their sheet, with ✏️ to change it (or delete it) and 🔄 to have it written again.
    const sheetPart = (name, h, { canWrite = true } = {}) => {
        if (h.busy) return el('div', 'wh-dos-note wh-dos-busy').append(fa('fa-spinner fa-spin'), txt(` ${h.busy}`));
        const content = h.sheet ? sheetBlock(h.sheet)
            : el('div', 'wh-dos-note', h.removed ? 'Sheet deleted: no new one while this ride lasts.' : 'Who they are in their own life gets written after the next reply.');
        const tools = [
            ...(h.sheet ? [tool('fa-address-card', `Make a persona of ${name}`, () => a.makePersona(name))] : []),
            ...(canWrite ? [tool(h.sheet ? 'fa-rotate' : 'fa-feather-pointed', h.sheet ? 'Write the sheet again' : 'Write the sheet now', () => a.writeSheet(name))] : []),
        ];
        return part(content, {
            fields: sheetFields(h.sheet), save: v => a.saveSheet(name, v),
            ...(h.sheet ? { remove: () => a.deleteSheet(name), removeLabel: 'Delete the sheet' } : {}),
        }, a.refresh, { cls: 'wh-dos-sheet-part', tools, label: `who ${name} is` });
    };

    const bodyCard = b => {
        const card = el('article', `wh-dos-card wh-dos-k-${b.kind}`);
        const save = row => a.saveBody(b.i, b.row, { row });
        const titles = el('div', 'wh-dos-titles').append(
            el('div', 'wh-dos-name').append(el('span', '', b.title), b.row.pronouns && b.row.body ? el('small', 'wh-dos-pron', b.row.pronouns) : ''),
            el('div', 'wh-dos-pills').append(
                pill(`wh-dos-k-${b.kind}`, b.icon, b.inside).attr('title', b.row.driver && b.row.driver_pronouns ? `${b.row.driver} (${b.row.driver_pronouns})` : null),
                b.row.how ? pill('wh-dos-soft', '', b.row.how) : '',
                b.row.host ? pill('wh-dos-soft', '', `own mind: ${b.row.host}`) : '',
                b.hidden ? pill('wh-dos-hidden', 'fa-eye-slash', 'hidden from you') : '',
            ),
        );
        card.append(el('div', 'wh-dos-card-head').append(avatar(b.title, b.kind, b.face),
            part(titles, { fields: grid(...WHO_FIELDS(b.row)), save, remove: () => a.removeBody(b.i, b.row), removeLabel: 'Take out of the Ledger', wide: true }, a.refresh, { cls: 'wh-dos-grow', label: 'who is in it' })));
        const facts = el('div', 'wh-dos-facts');
        if (b.row.notes) facts.append(el('div', 'wh-dos-fact').append(fa('fa-location-dot'), el('span', '', b.row.notes)));
        if (b.row.doing) facts.append(el('div', 'wh-dos-fact').append(fa('fa-person-walking'), el('span', '', b.row.doing)));
        if (!facts.children().length) facts.append(el('div', 'wh-dos-fact wh-dos-faint').append(fa('fa-location-dot'), el('span', '', 'Where they are, and what they’re doing')));
        card.append(part(facts, { fields: grid(...WHERE_FIELDS(b.row)), save }, a.refresh, { label: 'where they are' }));
        if (b.sheetable) card.append(sheetPart(b.row.body, b));
        return card;
    };

    root.append(section('Bodies', 'fa-user-group', d.bodies.length));
    if (!d.bodies.length) root.append(el('div', 'wh-dos-empty').append(fa('fa-user-check'), el('span', '', d.empty)));
    const bodies = el('div', 'wh-dos-grid').append(d.bodies.map(bodyCard));
    const add = press(el('article', 'wh-dos-card wh-dos-add').append(fa('fa-plus'), el('span', '', 'Add a body')), () => {
        const card = el('article', 'wh-dos-card wh-dos-k-idle').append(el('div', 'wh-dos-form-title', 'New body'), el('div'));
        add.before(card).hide();
        openForm(card.children().last(), {
            fields: [grid(...WHO_FIELDS({}), ...WHERE_FIELDS({})), el('div', 'wh-dos-form-title', 'Who they are in their own life (optional)'), sheetFields({})],
            save: v => {
                const row = {}, sheet = {};
                for (const [k, x] of Object.entries(v)) (PERSONA_FIELDS.includes(k) ? sheet : row)[k] = x;
                return a.saveBody(-1, null, { row, sheet });
            },
            refresh: a.refresh,
        });
    });
    root.append(bodies.append(add));

    // Powers and names: a chip each; tap one to change it, or + to add one.
    const chipForm = (chip, fields, save, remove) => openForm(chip, { fields: grid(...fields), save, remove, refresh: a.refresh, wide: true });
    const chips = el('div', 'wh-dos-chips');
    const powerFields = p => [input('who', 'Who', 'who has it', p?.who), input('power', 'Power', 'e.g. body swap by touch', p?.power)];
    const aliasFields = x => [input('name', 'Name', 'main name', x?.name), input('aka', 'Also called', 'other names, comma-separated', (x?.aka || []).join(', '))];
    d.powers.forEach((p, i) => {
        const chip = press(el('span', 'wh-dos-chip wh-dos-tap').attr('title', 'Tap to change').append(fa('fa-bolt'), el('b', '', p.who), txt(` ${p.power}`)),
            () => chipForm(chip, powerFields(p), v => a.savePower(i, v), () => a.savePower(i, null)));
        chips.append(chip);
    });
    d.aliases.forEach((x, i) => {
        const chip = press(el('span', 'wh-dos-chip wh-dos-tap').attr('title', 'Tap to change').append(fa('fa-tags'), el('b', '', x.name), txt(` also ${x.aka.join(', ')}`)),
            () => chipForm(chip, aliasFields(x), v => a.saveAlias(i, v), () => a.saveAlias(i, null)));
        chips.append(chip);
    });
    const addPower = press(el('span', 'wh-dos-chip wh-dos-chip-add').append(fa('fa-plus'), txt(' Power')).attr('title', 'Who can do what: kept in mind even when nobody is using it'),
        () => chipForm(addPower, powerFields(), v => a.savePower(-1, v)));
    const addAlias = press(el('span', 'wh-dos-chip wh-dos-chip-add').append(fa('fa-plus'), txt(' Name')).attr('title', 'One person, several names: a code name, a handle, a host number'),
        () => chipForm(addAlias, aliasFields(), v => a.saveAlias(-1, v)));
    root.append(section('Powers and names', 'fa-bolt'), chips.append(addPower, addAlias));

    // Hosts who aren't in the Ledger right now: just who they are, to change, write again or delete.
    const hostCard = (h, kind, pills) => el('article', `wh-dos-card wh-dos-k-${kind}`).append(
        el('div', 'wh-dos-card-head').append(avatar(h.body, kind, h.face),
            el('div', 'wh-dos-titles').append(el('div', 'wh-dos-name').append(el('span', '', h.body)), pills ? el('div', 'wh-dos-pills').append(pills) : '')),
        sheetPart(h.body, h),
    );
    if (d.back.length) {
        root.append(section('Back in their own bodies', 'fa-house-user', d.back.length),
            el('div', 'wh-dos-grid').append(d.back.map(h => hostCard(h, 'back', pill('wh-dos-k-back', 'fa-house-user', 'themselves again, still here')))));
    }

    if (d.history.length) {
        root.append(section('History', 'fa-clock-rotate-left', d.history.length));
        root.append(el('ol', 'wh-dos-timeline').append(d.history.map(h => el('li', h.ongoing ? 'wh-dos-now' : '').append(
            el('div', 'wh-dos-tl-title').append(el('span', '', h.title), h.hidden ? fa('fa-eye-slash') : ''),
            ...h.lines.map(([label, value]) => el('div', 'wh-dos-tl-line').append(el('span', 'wh-dos-label', label), el('span', '', value))),
        ))));
    }

    if (d.past.length) {
        const more = el('details', 'wh-dos-more');
        more.append(el('summary', '').append(fa('fa-address-book'), txt(` Other hosts from this chat (${d.past.length})`)));
        root.append(more.append(el('div', 'wh-dos-grid').append(d.past.map(h => hostCard(h, 'idle')))));
    }
    return root;
}

// ------------------------------------------------------------------ Mind Book

/** Five steps from awake to somnambulistic: lit up to where they are now, with a tick on the deepest they've been. */
function tranceMeter(now, deepest) {
    const meter = el('div', 'wh-dos-trance').attr('aria-label', `trance: ${now}`);
    const ni = Math.max(0, STAGES.indexOf(now)), di = STAGES.indexOf(deepest);
    STAGES.forEach((s, i) => {
        const step = el('div', 'wh-dos-stage').attr('title', s);
        if (i > 0 && i <= ni) step.addClass('wh-on');
        if (i === ni) step.addClass('wh-now');
        if (i > 0 && i === di) step.addClass('wh-deepest');
        meter.append(step.append(el('span', '', s === 'somnambulistic' ? 'somnamb.' : s)));
    });
    return meter;
}

const lines = (k, label, ph, value) => area(k, label, ph, value, 3);
const asLines = {
    suggestions: h => (h.suggestions || []).map(x => `${x.text}${x.stage ? ` | ${x.stage}` : ''}${x.times > 1 ? ` | ${x.times}×` : ''}`).join('\n'),
    triggers: h => (h.triggers || []).map(x => `${x.cue} → ${x.effect}`).join('\n'),
    set: w => (w.set || []).map(x => `${x.kind}: ${x.text}`).join('\n'),
};
// Each kind's parts, as fields filled from a recorded entry (the shape the Mind Book keeps). The whole form, for a new
// entry, is all of them.
const MIND_PARTS = {
    hypnosis: {
        who: h => [input('who', 'Who', 'who is hypnotized', h.who), input('by', 'By', 'who hypnotizes them', h.by),
            choose('susceptibility', 'Susceptibility', ['', 'low', 'average', 'high'], h.susceptibility),
            tick('amnesia', 'Told to forget the sessions', h.amnesia === 'yes'), tick('user_knows', 'You know about this', h.user_knows !== 'no')],
        trance: h => [choose('now', 'Right now', STAGES, h.now || 'awake'), choose('deepest', 'Deepest so far', ['', ...STAGES.slice(1)], h.deepest),
            input('times', 'Times under', '0', h.times ? String(h.times) : '')],
        suggestions: h => [lines('suggestions', 'Suggestions, one per line: what it is | stage', "finds Ash's voice calming | deep", asLines.suggestions(h))],
        triggers: h => [lines('triggers', 'Triggers, one per line: cue → effect', 'bloom → drops into a trance', asLines.triggers(h))],
    },
    control: {
        who: w => [input('who', 'Who', 'one name, or several separated by commas', (w.who || []).join(', ')), input('by', 'Controller', 'who holds the control', w.by),
            tick('resists', 'Aware of it and pushing against it', w.resists === 'yes'), tick('user_knows', 'You know about this', w.user_knows !== 'no')],
        set: w => [lines('set', 'What was set, one per line: wants / feels / believes / loyal to / command: …', 'wants: to please Ash above everything', asLines.set(w))],
        own: w => [input('own', 'Still their own', 'what the control left alone, or "nothing: a blank drone"', w.own, 'wh-dos-full')],
    },
    perception: {
        who: e => [choose('kind', 'Kind', ['unseen', 'normal', 'false'], e.kind || 'unseen'), input('target', "Can't perceive (unseen only)", 'who or what', e.target),
            input('who', 'Who has it', 'names, separated by commas', (e.who || []).join(', ')), input('except', 'Except (with everyone)', 'names', (e.except || []).join(', ')),
            tick('everyone', 'Everyone has it', e.everyone), input('by', 'Made by', 'who edited them', e.by), tick('user_knows', 'You know about this', e.user_knows !== 'no')],
        what: e => [input('what', 'The edit', 'one plain sentence', e.what, 'wh-dos-full')],
    },
};
const MIND_SECTIONS = [
    ['hypnosis', 'Hypnosis', 'fa-circle-dot', 'Add someone hypnotized'],
    ['control', 'Mind control', 'fa-hand-sparkles', 'Add a controlled will'],
    ['perception', 'Altered perception', 'fa-eye-slash', 'Add a perception edit'],
];

/**
 * @param {object} d  from index.js's mindViewData: { kinds, hypnosis, control, perception, empty, missing, batch }; each entry carries
 *   its index i and the recorded entry as raw, plus a face for hypnosis and control.
 * @param {object} a  { save(kind, i, raw, values), remove(kind, i, raw), drawMissing(names), refresh }; values hold only the part's fields.
 */
export function mindView(d, a) {
    const root = el('div', 'wh-dos');
    root.append(header('Mind Book', 'What hypnosis, mind control and altered perception have put into people. Tap ✏️ by anything to change it.', 'fa-brain', drawMissing(d, a)));
    if (!d.kinds.length) {
        root.append(el('div', 'wh-dos-empty').append(fa('fa-feather'), el('span', '', d.empty)));
        return root;
    }
    // One part of an entry's card: its own fields, saved into the entry; the "who" part also removes the entry.
    const entryPart = (kind, x, name, content, opts = {}) => part(content, {
        fields: grid(...MIND_PARTS[kind][name](x.raw)),
        save: v => a.save(kind, x.i, x.raw, v),
        ...(name === 'who' ? { remove: () => a.remove(kind, x.i, x.raw), removeLabel: 'Take out of the Mind Book', wide: true } : {}),
    }, a.refresh, opts);
    const list = (title, items, empty) => el('div', 'wh-dos-list').append(el('div', 'wh-dos-list-title', title), items.length ? items : el('div', 'wh-dos-item wh-dos-faint', empty));
    const head = (name, kind, face, pills) => el('div', 'wh-dos-titles').append(el('div', 'wh-dos-name').append(el('span', '', name)), el('div', 'wh-dos-pills').append(pills));

    const cards = {
        hypnosis: h => el('article', `wh-dos-card wh-dos-k-${h.kind}`).append(
            el('div', 'wh-dos-card-head').append(avatar(h.who, h.kind, h.face), entryPart('hypnosis', h, 'who', head(h.who, h.kind, h.face, [
                h.by ? pill(`wh-dos-k-${h.kind}`, 'fa-circle-dot', `by ${h.byLabel}`) : '',
                h.susceptibility ? pill('wh-dos-soft', '', `${h.susceptibility} susceptibility`) : '',
                h.amnesia ? pill('wh-dos-soft', 'fa-eraser', 'told to forget') : '',
                h.hidden ? pill('wh-dos-hidden', 'fa-eye-slash', 'hidden from you') : '',
            ]), { cls: 'wh-dos-grow', label: 'who it is' })),
            entryPart('hypnosis', h, 'trance', el('div', '').append(tranceMeter(h.now, h.deepest), h.times ? el('div', 'wh-dos-faint wh-dos-small', `under ${h.times}×`) : ''), { label: 'the trance' }),
            entryPart('hypnosis', h, 'suggestions', list('Suggestions', h.suggestions.map(s => el('div', 'wh-dos-item').append(s.stage ? el('span', 'wh-dos-tag', s.stage) : '', el('span', '', s.text), s.reinforced ? el('small', 'wh-dos-faint', ' reinforced') : '')), 'none yet'), { label: 'the suggestions' }),
            entryPart('hypnosis', h, 'triggers', list('Triggers', h.triggers.map(t => el('div', 'wh-dos-item').append(el('span', 'wh-dos-cue', `“${t.cue}”`), fa('fa-arrow-right-long wh-dos-faint'), el('span', '', t.effect || ''))), 'none yet'), { label: 'the triggers' }),
        ),
        control: w => el('article', `wh-dos-card wh-dos-k-${w.kind}`).append(
            el('div', 'wh-dos-card-head').append(avatar(w.who[0], w.kind, w.face), entryPart('control', w, 'who', head(w.who.join(', '), w.kind, w.face, [
                w.by ? pill(`wh-dos-k-${w.kind}`, 'fa-hand-sparkles', w.byLabel === 'you' ? 'your control' : `${w.byLabel}'s control`) : '',
                w.resists ? pill('wh-dos-warn', 'fa-hand-fist', 'resisting') : '',
                w.hidden ? pill('wh-dos-hidden', 'fa-eye-slash', 'hidden from you') : '',
            ]), { cls: 'wh-dos-grow', label: 'who it is' })),
            entryPart('control', w, 'set', list(w.by ? `Set by ${w.byLabel}` : 'Set', w.set.map(x => el('div', 'wh-dos-item').append(el('span', 'wh-dos-tag', x.kind), el('span', '', x.text))), 'nothing yet'), { label: 'what was set' }),
            entryPart('control', w, 'own', list('Still their own', w.own ? [el('div', 'wh-dos-item').append(el('span', '', w.own))] : [], 'not said'), { label: 'what is still theirs' }),
        ),
        perception: e => el('article', `wh-dos-card wh-dos-k-${e.kind}`).append(
            el('div', 'wh-dos-card-head').append(el('div', `wh-dos-avatar wh-dos-k-${e.kind}`).append(fa(e.icon)), entryPart('perception', e, 'who', head(e.title, e.kind, null, [
                e.by ? pill(`wh-dos-k-${e.kind}`, '', `by ${e.byLabel}`) : '',
                e.hidden ? pill('wh-dos-hidden', 'fa-eye-slash', 'hidden from you') : '',
            ]), { cls: 'wh-dos-grow', label: 'who has it' })),
            entryPart('perception', e, 'what', el('div', 'wh-dos-quote', e.what), { label: 'the edit' }),
        ),
    };
    for (const [kind, title, icon, addLabel] of MIND_SECTIONS) {
        if (!d.kinds.includes(kind)) continue;
        root.append(section(title, icon, d[kind].length));
        const cardsGrid = el('div', 'wh-dos-grid').append(d[kind].map(cards[kind]));
        const add = press(el('article', 'wh-dos-card wh-dos-add').append(fa('fa-plus'), el('span', '', addLabel)), () => {
            const card = el('article', 'wh-dos-card wh-dos-k-idle').append(el('div', 'wh-dos-form-title', addLabel), el('div'));
            add.before(card).hide();
            openForm(card.children().last(), {
                fields: grid(...Object.values(MIND_PARTS[kind]).flatMap(f => f({}))),
                save: v => a.save(kind, -1, null, v), refresh: a.refresh,
            });
        });
        root.append(cardsGrid.append(add));
    }
    return root;
}

// ------------------------------------------------------------------ a picture

/**
 * One person's picture, large, with what it's drawn from.
 * @param {object} p  { name, image, look, lookFromSheet, busy, kind }
 * @param {object} a  { draw, upload, remove, editLook }
 */
export function pictureView(p, a) {
    const root = el('div', 'wh-dos wh-dos-picture');
    const frame = el('div', `wh-dos-frame wh-dos-k-${p.kind || 'idle'}`);
    if (p.image) frame.append($('<img alt="">').attr('src', p.image));
    else frame.append(el('span', 'wh-dos-initial', String(p.name || '?').charAt(0).toUpperCase()));
    if (p.busy) frame.append(el('div', 'wh-dos-frame-busy').append(fa('fa-spinner fa-spin'), el('span', '', p.busy)));
    root.append(el('h3', 'wh-dos-title', p.name), frame);
    const look = el('div', 'wh-dos-look');
    if (p.look) look.append(el('span', 'wh-dos-label', p.lookFromSheet ? 'Look (from their sheet)' : 'Look'), el('span', '', p.look));
    else look.append(el('span', 'wh-dos-faint', 'No look yet: drawing writes one from the chat first, or write your own.'));
    if (!p.lookFromSheet && !p.busy) look.append(tool('fa-pen', p.look ? 'Change the look' : 'Write the look', a.editLook));
    root.append(look);
    if (!p.busy) {
        root.append(el('div', 'wh-dos-form-actions wh-dos-center').append(
            textButton('fa-wand-magic-sparkles', p.image ? 'Draw again' : 'Draw', a.draw, 'wh-dos-primary'),
            textButton('fa-upload', p.image ? 'Use my own instead' : 'Use my own', a.upload),
            p.image ? textButton('fa-xmark', 'Remove', a.remove, 'wh-dos-danger') : '',
        ));
    }
    return root;
}
