// Worldhopper Engine — the Body Ledger and the Mind Book as you see them when you tap their bars above the chat: one card
// per person (people-core.js gathers each person's records), a short preview that opens to everything about them. Each
// part can be changed on its own: a faint ✏️ in its corner swaps just that part for a small form. Every save, picture
// and model call hands back to index.js, which gathers the data (ledgerViewData, mindViewData). jQuery is SillyTavern's $.
import { STAGES } from './mind-core.js';

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
// A ride kept from you: the crossed-out eye alone, with its meaning on hover.
const hiddenPill = () => el('span', 'wh-dos-pill wh-dos-hidden').attr({ title: 'Hidden from you', 'aria-label': 'Hidden from you' }).append(fa('fa-eye-slash'));

// The World notes: an icon for what a thing is, and a color for how someone came to know something.
const THING_ICONS = [[/phone|mobile/i, 'fa-mobile-screen'], [/key/i, 'fa-key'], [/cloth|shirt|jacket|hoodie|sweat|jeans|dress|shoe|sneaker|uniform|costume|suit\b/i, 'fa-shirt'],
    [/bag|tote|backpack|purse|duffel/i, 'fa-bag-shopping'], [/wallet|card\b/i, 'fa-wallet'], [/laptop|computer/i, 'fa-laptop'], [/glasses/i, 'fa-glasses'],
    [/bottle|drink|mug|cup/i, 'fa-bottle-water'], [/watch|clock/i, 'fa-clock'], [/ring|necklace|jewel|amulet|pendant/i, 'fa-ring'], [/book|journal|diary|note/i, 'fa-book'],
    [/money|cash|\$/i, 'fa-money-bill'], [/skull|charm|talisman|stone|idol/i, 'fa-gem']];
const thingIcon = what => (THING_ICONS.find(([re]) => re.test(what)) || [null, 'fa-box'])[1];
const howPill = how => {
    const h = String(how || '').toLowerCase();
    const kind = /suspect/.test(h) ? 'suspects' : /saw|watch|see/.test(h) ? 'saw' : /lie/.test(h) ? 'lied' : /figur|work|guess/.test(h) ? 'figured' : 'told';
    return pill(`wh-dos-how wh-dos-how-${kind}`, '', how || 'knows');
};

function header(title, sub, icon, extra = '') {
    return el('div', 'wh-dos-head').append(el('div', 'wh-dos-head-text').append(el('h3', 'wh-dos-title').append(fa(icon), txt(` ${title}`)), el('small', 'wh-dos-sub', sub)), extra);
}
/** "Draw missing pictures": a button while anyone here can have a picture and has none, or how far along it is. */
const drawMissing = (d, a) => (d.batch ? el('span', 'wh-dos-batch').append(fa('fa-spinner fa-spin'), txt(` ${d.batch}`))
    : d.missing?.length ? textButton('fa-wand-magic-sparkles', `Draw missing pictures (${d.missing.length})`, () => a.drawMissing(d.missing)) : '');
const section = (title, icon, count) => el('div', 'wh-dos-section').append(fa(icon), txt(` ${title}`), count ? el('span', 'wh-dos-count', String(count)) : '');

// ------------------------------------------------------------------ forms

// Every field wraps and grows with what's in it, so a long value is all in view: a one-line box showed only what fit
// its width, and the rest came into view only as you deleted. A "line" is still one line of text: Enter saves it, and
// a line break pasted in becomes a space.
const input = (k, label, ph, value, cls = '') => el('label', `wh-dos-f ${cls}`).append(el('small', '', label),
    $('<textarea class="text_pole wh-dos-line" rows="1"></textarea>').attr({ 'data-k': k, placeholder: ph }).val(value ?? ''));
const area = (k, label, ph, value, rows = 2) => el('label', 'wh-dos-f wh-dos-full').append(el('small', '', label),
    $('<textarea class="text_pole"></textarea>').attr({ 'data-k': k, placeholder: ph, rows }).val(value ?? ''));
// Where the browser can't size a field to its text by itself (CSS field-sizing), it's done here as you type.
const SIZES_ITSELF = !!window.CSS?.supports?.('field-sizing', 'content');
function sizeField(t) {
    if (SIZES_ITSELF || !t.offsetParent) return;
    const rows = Number(t.getAttribute('rows')) || 1;
    t.style.height = 'auto';
    const line = parseFloat(getComputedStyle(t).lineHeight) || 20;
    t.style.height = `${Math.max(t.scrollHeight, rows * line) + t.offsetHeight - t.clientHeight}px`;
}
const choose = (k, label, options, value) => el('label', 'wh-dos-f').append(el('small', '', label),
    $('<select class="text_pole"></select>').attr('data-k', k).append(options.map(o => $('<option></option>').val(o).text(o || '—'))).val(value ?? ''));
const tick = (k, label, checked) => el('label', 'checkbox_label wh-dos-full').append($('<input type="checkbox">').attr('data-k', k).prop('checked', !!checked), el('span', '', label));
const grid = (...fields) => el('div', 'wh-dos-fields').append(fields);
/** What a form holds, by data-k (a checkbox reads 'yes' or 'no'). */
function readForm(form) {
    const o = {};
    form.find('[data-k]').each((_, x) => {
        const v = x.type === 'checkbox' ? (x.checked ? 'yes' : 'no') : String($(x).val() ?? '');
        o[$(x).attr('data-k')] = x.classList.contains('wh-dos-line') ? v.replace(/\s*\n\s*/g, ' ') : v;
    });
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
        const line = (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') || e.target.classList.contains('wh-dos-line');
        if (e.key === 'Enter' && !e.shiftKey && line) { e.preventDefault(); ok(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); }
    });
    form.on('input', 'textarea', e => sizeField(e.target));
    node.replaceWith(form);
    form.find('textarea').each((_, t) => sizeField(t));
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

// A card for each person, however many records they're in: a short preview (who they are, what's going on, where), and
// tapped, everything about them, each part with its own ✏️. What only the writer needs (what a body is busy with, how
// a ride works, who someone is in their own life, their other names) folds away under "Behind the scenes".

const sheetFields = sheet => grid(
    area('Voice & habits', 'Voice & habits', 'how they talk, and one small habit', sheet?.['Voice & habits']),
    area('Life', 'Life', 'what they do and who they live with', sheet?.Life),
);
const WHO_FIELDS = r => [
    input('body', 'Body', 'whose body', r.body), input('pronouns', 'Pronouns', 'she/her', r.pronouns),
    input('driver', 'Mind inside', 'who is in it (blank if nobody)', r.driver), input('driver_pronouns', 'Their pronouns', 'he/him', r.driver_pronouns),
    input('how', 'How', 'possession, swap, skinsuit…', r.how), input('host', "Where the owner's mind is", 'asleep inside her, pushed out, in his old body…', r.host),
    tick('user_knows', 'You know about this', r.user_knows !== 'no'),
];
const NOW_FIELDS = (place, row, own) => [
    input('where', 'Where', 'Room 1418, on the bed', place?.where || (!place && (row?.notes || own?.notes)) || '', 'wh-dos-full'),
    input('wearing', 'Wearing', 'her cheer uniform, sneakers scuffed', place?.wearing, 'wh-dos-full'),
    input('state', 'State', 'soaked, a sprained ankle, exhausted', place?.state, 'wh-dos-full'),
    ...(row || own ? [input('doing', 'Busy with', 'what the body is doing right now', (row || own).doing, 'wh-dos-full')] : []),
    ...(row ? [input('notes', 'Notes', 'anything else to remember about this body', place ? row.notes : '', 'wh-dos-full')] : []),
];
const HISTORY_FIELDS = h => [
    input('how', 'How', 'possession, skinsuit…', h.how), input('host', 'Where their mind was', 'asleep inside her, pushed out…', h.host),
    tick('user_knows', 'You know about this', h.user_knows !== 'no'),
    area('remembers', 'Remembers', 'what they remember of the ridden time', h.remembers),
    area('believes', 'Believes', 'how they explain it to themselves', h.believes),
    area('owns', 'Held to', 'what was said or promised in their name, and to whom', h.owns),
    area('seen', 'Seen', 'who saw them do what', h.seen),
    area('kept', 'Kept', 'what the rider took away', h.kept),
    area('left', 'Left behind', 'lasting changes to the body', h.left),
];
const powerFields = p => [input('who', 'Who', 'who has it', p?.who), input('power', 'Power', 'e.g. body swap by touch', p?.power)];
const aliasFields = x => [input('name', 'Name', 'main name', x?.name), input('aka', 'Also called', 'other names, comma-separated', (x?.aka || []).join(', '))];
const thingFields = t => [input('what', 'Thing', 'the clothes left in the alley', t?.what), input('whose', 'Whose', 'the owner', t?.whose),
    input('holder', 'Who has it', 'blank if nobody', t?.holder), input('where', 'Where', 'in a bag by the door', t?.where)];
const knowFields = k => [input('who', 'Who', 'who knows', k?.who),
    area('facts', 'What they know', 'one per line, how in brackets: saw her jump into Kayla (saw it)', (k?.facts || []).map(f => `${f.fact}${f.how ? ` (${f.how})` : ''}`).join('\n'), 3)];
const placeFields = p => [input('who', 'Who', "the body's own name", p?.who), input('where', 'Where', 'Room 1418, on the bed', p?.where, 'wh-dos-full'),
    input('wearing', 'Wearing', 'her cheer uniform, sneakers scuffed', p?.wearing, 'wh-dos-full'), input('state', 'State', 'soaked, a sprained ankle, exhausted', p?.state, 'wh-dos-full')];
const ownFields = o => [input('who', 'Whose own body', 'the mind running other bodies', o?.who),
    input('notes', 'Where, and anything to remember', 'at his desk upstairs', o?.notes, 'wh-dos-full'), input('doing', 'Busy with', 'what it is doing right now', o?.doing, 'wh-dos-full')];
const timerFields = t => [input('what', 'What', 'the rental ends', t?.what), input('when', 'When', '6:00 PM, Day Four', t?.when)];

// The look's details as chips; a guess (a detail the story hasn't given) is faint and says so.
const glanceChips = parts => el('div', 'wh-dos-glance').append(parts.map(x => el('span', `wh-dos-gl${x.guess ? ' wh-dos-guess' : ''}`, x.text)
    .attr('title', x.guess ? "A guess: the story hasn't said. Change it if it's wrong." : null)));
// Which people have "Behind the scenes" unfolded, so a redraw (an update landing, a save) leaves it as it was.
const behindOpen = new Set();
const THINGS_ICON = t => el('span', 'wh-dos-chip wh-dos-tap').append(fa(thingIcon(t.what)), el('b', '', t.what), t.where ? txt(` · ${t.where}`) : '');

/**
 * @param {object} d  from index.js's ledgerViewData: { people, things, clock, timers, open, empty, missing, batch }. A person
 *   is people-core's entry with their records filled in: { key, name, aka, group, kind, status, where, hidden, face, counts,
 *   rows: [{ i, row }], own, place, knows, things, powers, alias, history, sheet, look, back }.
 * @param {object} a  { open(key), saveBody(i, row, { row, sheet }), removeBody(i, row), saveNow(person, values),
 *   saveLook(name, text), rewriteLook(name), saveSheet(name, values), deleteSheet(name), writeSheet(name), makePersona(name),
 *   savePower, saveAlias, saveOwn, saveThing, saveKnows, savePlace, saveTimer (i, values or null), saveClock(values or null),
 *   saveHistory(keys, lastEnd, values), removeHistory(keys, lastEnd, title), leaveScene(name), drawMissing(names), refresh }
 */
export function ledgerView(d, a) {
    const root = el('div', 'wh-dos');
    root.append(header('Body Ledger', 'Who is in which body, where everyone is, and what they know. Tap someone to see more.', 'fa-people-arrows', drawMissing(d, a)));
    const chipForm = (chip, fields, save, remove) => openForm(chip, { fields: grid(...fields), save, remove, refresh: a.refresh, wide: true });
    const adder = (label, title, fields, save) => {
        const chip = press(el('span', 'wh-dos-chip wh-dos-chip-add').append(fa('fa-plus'), txt(` ${label}`)).attr('title', title), () => chipForm(chip, fields, save));
        return chip;
    };

    // The clock and what's coming up, on one line.
    const now = [d.clock?.day, d.clock?.time].filter(Boolean).join(', ');
    const clock = press(el('span', `wh-dos-chip wh-dos-tap${now ? '' : ' wh-dos-faint'}`).append(fa('fa-clock'), txt(` ${now || 'No time yet'}`)).attr('title', 'The story\'s day and time: tap to change'),
        () => chipForm(clock, [input('day', 'Day', 'Saturday, Day Four, October 3', d.clock?.day), input('time', 'Time', '11:05 AM, late evening', d.clock?.time)],
            v => a.saveClock(v), now ? () => a.saveClock(null) : null));
    const timers = (d.timers || []).map((t, i) => {
        const chip = press(el('span', 'wh-dos-chip wh-dos-tap').append(fa('fa-hourglass-half'), el('b', '', t.what), txt(` ${t.when}${t.left ? ` · ${t.left}` : ''}`)),
            () => chipForm(chip, timerFields(t), v => a.saveTimer(i, v), () => a.saveTimer(i, null)));
        return chip;
    });
    root.append(el('div', 'wh-dos-chips wh-dos-time').append(clock, timers, adder('Timer', 'A deadline the story set: a rental that ends, a flight, a party at nine', () => timerFields(), v => a.saveTimer(-1, v))));

    const icons = p => el('span', 'wh-dos-icons').append(
        p.hidden ? fa('fa-eye-slash').attr('title', 'Hidden from you') : '',
        ...[['knows', 'fa-eye', 'knows something'], ['things', 'fa-box-open', 'things'], ['powers', 'fa-bolt', 'a power'], ['history', 'fa-clock-rotate-left', 'past rides']]
            .filter(([k]) => p.counts[k]).map(([k, icon, what]) => el('span', '').attr('title', what).append(fa(icon), p.counts[k] > 1 ? txt(String(p.counts[k])) : '')));

    const detail = p => {
        const box = el('div', 'wh-dos-detail');
        const behind = [];
        // The look, read at a glance; ✏️ to change it, 🔄 to have it written again from the card and the chat.
        // Who is in this body: the status line, with the Ledger row behind its ✏️. A body with two rows (rare) gets a
        // line for each.
        p.rows.forEach(({ i, row }, n) => {
            const text = n === 0 && p.status ? p.status : row.driver && row.body ? `${row.driver} inside` : row.body ? 'Empty' : 'No body';
            const line = el('div', 'wh-dos-pills').append(el('span', 'wh-dos-status', text),
                row.user_knows === 'no' && row.body && row.driver ? hiddenPill() : '');
            box.append(part(line, { fields: grid(...WHO_FIELDS(row)), save: r => a.saveBody(i, row, { row: r }), remove: () => a.removeBody(i, row), removeLabel: 'Take out of the Ledger', wide: true },
                a.refresh, { label: 'who is in it' }));
            if (row.how || row.host) behind.push(el('div', 'wh-dos-fact').append(fa('fa-gears'), el('span', '', [row.how, row.host ? `${row.body}'s own mind: ${row.host}` : ''].filter(Boolean).join(' · '))));
        });
        if (!p.rows.length && p.status) box.append(el('div', 'wh-dos-status', p.status));

        if (p.look) {
            // A look from before looks were short is one long sentence: shown as it is, with a nudge to have it redone.
            const old = p.look.parts.length === 1 && !/·/.test(p.look.raw) && p.look.raw.split(/\s+/).length > 6;
            const look = old ? el('div', 'wh-dos-small').append(txt(p.look.raw), el('span', 'wh-dos-faint', ' · written the old, long way: 🔄 shortens it'))
                : p.look.parts.length ? glanceChips(p.look.parts) : el('div', 'wh-dos-note', 'No look yet: 🔄 writes one from the card and the chat.');
            box.append(part(look, {
                fields: grid(input('look', 'Look', 'mid 20s · tall, athletic · black box braids · ~gold nose ring', p.look.raw, 'wh-dos-full'),
                    el('small', 'wh-dos-faint wh-dos-full', 'Short details with " · " between them; a ~ before one marks a guess.')),
                save: v => a.saveLook(p.name, v.look),
            }, a.refresh, { label: 'the look', tools: [tool('fa-rotate', 'Write the look again from the card and the chat', () => a.rewriteLook(p.name))] }));
        }


        // Where they are, what they have on, and anything physical that lasts.
        const row = p.rows[0]?.row || null;
        const place = p.place, own = p.own;
        const facts = el('div', 'wh-dos-facts');
        const where = place?.where || row?.notes || own?.notes;
        if (where) facts.append(el('div', 'wh-dos-fact').append(fa('fa-location-dot'), el('span', '', where)));
        if (place?.wearing) facts.append(el('div', 'wh-dos-fact').append(fa('fa-shirt'), el('span', '', place.wearing)));
        if (place?.state) facts.append(el('div', 'wh-dos-fact').append(fa('fa-heart-pulse'), el('span', '', place.state)));
        if (!facts.children().length) facts.append(el('div', 'wh-dos-fact wh-dos-faint').append(fa('fa-location-dot'), el('span', '', 'Where they are and what they have on')));
        box.append(part(facts, {
            fields: grid(...NOW_FIELDS(place, row, own)), save: v => a.saveNow(p, v),
            ...(place ? { remove: () => a.savePlace(place.i, null), removeLabel: 'Clear where they are' } : {}),
        }, a.refresh, { label: 'where they are' }));
        if ((row || own)?.doing) behind.push(el('div', 'wh-dos-fact').append(fa('fa-person-walking'), el('span', '', (row || own).doing)));
        if (place && row?.notes) behind.push(el('div', 'wh-dos-fact').append(fa('fa-note-sticky'), el('span', '', row.notes)));

        if (p.knows) {
            box.append(part(el('div', 'wh-dos-list').append(el('div', 'wh-dos-list-title', 'Knows'), p.knows.facts.map(f => el('div', 'wh-dos-know').append(howPill(f.how), el('span', '', f.fact)))),
                { fields: grid(...knowFields(p.knows)), save: v => a.saveKnows(p.knows.i, v), remove: () => a.saveKnows(p.knows.i, null), wide: true }, a.refresh, { label: `what ${p.name} knows` }));
        }
        const chips = el('div', 'wh-dos-chips');
        for (const t of p.things) {
            const chip = THINGS_ICON(t);
            press(chip, () => chipForm(chip, thingFields(t), v => a.saveThing(t.i, v), () => a.saveThing(t.i, null)));
            chips.append(chip);
        }
        for (const x of p.powers) {
            const chip = press(el('span', 'wh-dos-chip wh-dos-tap').append(fa('fa-bolt'), txt(` ${x.power}`)), () => chipForm(chip, powerFields(x), v => a.savePower(x.i, v), () => a.savePower(x.i, null)));
            chips.append(chip);
        }
        if (chips.children().length) box.append(chips);

        if (p.history.length) {
            box.append(el('div', 'wh-dos-list-title', 'Past rides'));
            for (const h of p.history) {
                const lines = h.lines.map(([label, value]) => el('div', 'wh-dos-tl-line').append(el('span', 'wh-dos-label', label), el('span', '', value)));
                box.append(part(el('div', 'wh-dos-ride').append(el('div', 'wh-dos-tl-title').append(el('span', '', h.title), h.hidden ? fa('fa-eye-slash') : ''), lines), {
                    fields: grid(...HISTORY_FIELDS(h.raw)), save: v => a.saveHistory(h.keys, h.lastEnd, v), remove: () => a.removeHistory(h.keys, h.lastEnd, h.title), wide: true,
                }, a.refresh, { label: 'this ride' }));
            }
        }

        // Behind the scenes: what the writer gets that you rarely need to see.
        const more = el('details', 'wh-dos-more wh-dos-behind').prop('open', behindOpen.has(p.key))
            .on('toggle', function () { if (this.open) behindOpen.add(p.key); else behindOpen.delete(p.key); })
            .append(el('summary', '').append(fa('fa-sliders'), txt(' Behind the scenes')));
        if (behind.length) more.append(el('div', 'wh-dos-facts').append(behind));
        if (p.sheet) {
            const h = p.sheet;
            const content = h.busy ? el('div', 'wh-dos-note wh-dos-busy').append(fa('fa-spinner fa-spin'), txt(` ${h.busy}`))
                : h.sheet && (h.sheet['Voice & habits'] || h.sheet.Life) ? el('div', 'wh-dos-sheet').append(['Voice & habits', 'Life'].filter(f => h.sheet[f]).map(f => el('div', 'wh-dos-sheet-row').append(el('span', 'wh-dos-label', f), el('span', 'wh-dos-value', h.sheet[f]))))
                : el('div', 'wh-dos-note', h.removed ? 'Sheet deleted: no new one while this ride lasts.' : 'Who they are in their own life gets written after the next reply.');
            const tools = [
                ...(h.sheet ? [tool('fa-address-card', `Make a persona of ${p.name}`, () => a.makePersona(p.name))] : []),
                tool(h.sheet ? 'fa-rotate' : 'fa-feather-pointed', h.sheet ? 'Write the sheet again' : 'Write the sheet now', () => a.writeSheet(p.name)),
            ];
            more.append(el('div', 'wh-dos-list-title', 'Who they are in their own life'), part(content, {
                fields: sheetFields(h.sheet), save: v => a.saveSheet(p.name, v),
                ...(h.sheet ? { remove: () => a.deleteSheet(p.name), removeLabel: 'Delete the sheet' } : {}),
            }, a.refresh, { cls: 'wh-dos-sheet-part', tools, label: `who ${p.name} is` }));
        }
        if (own) {
            more.append(part(el('div', 'wh-dos-fact').append(fa('fa-house-user'), el('span', '', `${p.name}'s own body is in use${own.notes ? `: ${own.notes}` : ''}`)),
                { fields: grid(...ownFields(own)), save: v => a.saveOwn(own.i, v), remove: () => a.saveOwn(own.i, null), wide: true }, a.refresh, { label: 'their own body' }));
        }
        const names = el('div', 'wh-dos-chips');
        if (p.alias) {
            const chip = press(el('span', 'wh-dos-chip wh-dos-tap').append(fa('fa-tags'), txt(` also ${p.alias.aka.join(', ')}`)), () => chipForm(chip, aliasFields(p.alias), v => a.saveAlias(p.alias.i, v), () => a.saveAlias(p.alias.i, null)));
            names.append(chip);
        }
        if (p.back) names.append(press(el('span', 'wh-dos-chip wh-dos-tap').append(fa('fa-person-walking-arrow-right'), txt(' Not in this scene')).attr('title', 'Stop giving them to the writer until the story brings them up again'), () => a.leaveScene(p.name)));
        if (names.children().length) more.append(names);
        // Whatever this person doesn't have yet, to add.
        more.append(el('div', 'wh-dos-chips').append(
            !p.rows.length ? adder('In the Ledger', 'Someone else is in this body, or it is empty', () => WHO_FIELDS({ body: p.name }), v => a.saveBody(-1, null, { row: v })) : '',
            !p.knows ? adder('What they know', 'What they saw, were told, or suspect about the powers', () => knowFields({ who: p.name }), v => a.saveKnows(-1, v)) : '',
            adder('Thing', 'Something of theirs that matters, and where it is', () => thingFields({ whose: p.name }), v => a.saveThing(-1, v)),
            adder('Power', 'Something they can do', () => powerFields({ who: p.name }), v => a.savePower(-1, v)),
            !p.alias ? adder('Other name', 'A nickname, a code name, a host number', () => aliasFields({ name: p.name }), v => a.saveAlias(-1, v)) : '',
            !own && p.drives?.length ? adder('Own body', 'Their own body, still in use while they run others', () => ownFields({ who: p.name }), v => a.saveOwn(-1, v)) : '',
        ));
        box.append(more);
        return box;
    };

    const tile = p => {
        const open = d.open === p.key;
        const card = el('article', `wh-dos-card wh-dos-tile wh-dos-k-${p.kind}${open ? ' wh-dos-open' : ''}`);
        const head = el('div', 'wh-dos-card-head wh-dos-tile-head').append(
            avatar(p.name, p.kind, open ? p.face : { image: p.face?.image }),
            el('div', 'wh-dos-titles wh-dos-grow').append(
                el('div', 'wh-dos-name').append(el('span', '', p.name), p.pronouns ? el('small', 'wh-dos-pron', p.pronouns) : ''),
                p.status && !open ? el('div', 'wh-dos-status', p.status) : '',
                p.where && !open ? el('div', 'wh-dos-where', p.where) : '',
            ),
            icons(p), fa(open ? 'fa-chevron-up wh-dos-faint' : 'fa-chevron-down wh-dos-faint'));
        press(head.attr('aria-expanded', open ? 'true' : 'false'), () => a.open(open ? '' : p.key));
        card.append(head);
        if (open) card.append(detail(p));
        return card;
    };

    const groups = { yours: [], scene: [], elsewhere: [], rest: [] };
    for (const p of d.people) groups[p.group].push(p);
    const yoursTitle = groups.yours.length > 1 ? 'Your bodies' : 'You';
    const titles = { yours: [yoursTitle, 'fa-user'], scene: ['In this scene', 'fa-users'], elsewhere: ['Elsewhere', 'fa-map-location-dot'] };
    for (const g of ['yours', 'scene', 'elsewhere']) {
        if (!groups[g].length) continue;
        root.append(section(titles[g][0], titles[g][1], groups[g].length), el('div', 'wh-dos-grid').append(groups[g].map(tile)));
    }
    if (groups.rest.length) {
        const more = el('details', 'wh-dos-more').prop('open', groups.rest.some(p => p.key === d.open));
        more.append(el('summary', '').append(fa('fa-address-book'), txt(` Everyone else (${groups.rest.length})`)), el('div', 'wh-dos-grid').append(groups.rest.map(tile)));
        root.append(more);
    }
    if (!d.people.length) root.append(el('div', 'wh-dos-empty').append(fa('fa-user-check'), el('span', '', d.empty)));

    // Things nobody shown here has or owns, then adding someone or something new.
    if (d.things.length) {
        root.append(section('Other things', 'fa-box-open', d.things.length), el('div', 'wh-dos-chips').append(d.things.map(t => {
            const chip = THINGS_ICON(t);
            return press(chip, () => chipForm(chip, thingFields(t), v => a.saveThing(t.i, v), () => a.saveThing(t.i, null)));
        })));
    }
    root.append(el('div', 'wh-dos-chips wh-dos-addbar').append(
        adder('Body', 'Someone in someone else\'s body, an empty body, or a mind with no body', () => WHO_FIELDS({}), v => a.saveBody(-1, null, { row: v })),
        adder('Person', 'Where someone is and what they have on', () => placeFields(), v => a.savePlace(-1, v)),
        adder('Thing', 'Something that matters and where it is: clothes left behind, a phone someone else has', () => thingFields(), v => a.saveThing(-1, v)),
        adder('Who knows', 'Who saw, was told, or suspects something about the powers', () => knowFields(), v => a.saveKnows(-1, v)),
        adder('Power', 'Who can do what: kept in mind even when nobody is using it', () => powerFields(), v => a.savePower(-1, v)),
        adder('Other name', 'One person, several names: a code name, a handle, a host number', () => aliasFields(), v => a.saveAlias(-1, v)),
    ));
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

/** A change's times so far against the times it takes to hold: lit up to now, the last step marked "holds". */
function changeMeter(now, holds) {
    const meter = el('div', 'wh-dos-trance').attr('aria-label', `${now} of ${holds}`).css('grid-template-columns', `repeat(${holds}, 1fr)`);
    for (let i = 1; i <= holds; i++) {
        const step = el('div', 'wh-dos-stage').attr('title', i === holds ? 'holds on its own' : `${i}×`);
        if (i <= now) step.addClass('wh-on');
        if (i === Math.min(now, holds)) step.addClass('wh-now');
        meter.append(step.append(el('span', '', i === holds ? 'holds' : `${i}×`)));
    }
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
    influence: {
        who: c => [input('who', 'Who', 'who it changes', c.who), input('by', 'By', 'who or what is changing them', c.by), tick('user_knows', 'You know about this', c.user_knows !== 'no')],
        change: c => [input('what', 'The change', 'what it makes them feel, want, believe or do', c.what, 'wh-dos-full'),
            input('from', 'Before', 'what they were like before it started', c.from, 'wh-dos-full')],
        count: c => [input('times', 'Times so far', '1', c.times ? String(c.times) : '')],
    },
};
const MIND_SECTIONS = [
    ['hypnosis', 'Hypnosis', 'fa-circle-dot', 'Add someone hypnotized'],
    ['control', 'Mind control', 'fa-hand-sparkles', 'Add a controlled will'],
    ['perception', 'Altered perception', 'fa-eye-slash', 'Add a perception edit'],
    ['influence', 'Change over time', 'fa-seedling', 'Add a change'],
];

/**
 * A card for each person, whatever hypnosis, control and change over time hold for them, and one for each perception
 * edit. The preview says what's going on; tapped, each entry shows with its parts to change.
 * @param {object} d  from index.js's mindViewData: { kinds, people, edits, holds, open, empty, missing, batch }; a person is
 *   { key, name, kind, face, status, hidden, hypnosis, control: [], influence: [] }, each entry as the view draws it
 *   ({ i, raw, … }); edits are perception entries.
 * @param {object} a  { open(key), save(kind, i, raw, values), remove(kind, i, raw), drawMissing(names), refresh }; values hold only the part's fields.
 */
export function mindView(d, a) {
    const root = el('div', 'wh-dos');
    root.append(header('Mind Book', 'What hypnosis, mind control, altered perception and change over time have put into people. Tap someone to see more.', 'fa-brain', drawMissing(d, a)));
    if (!d.kinds.length) {
        root.append(el('div', 'wh-dos-empty').append(fa('fa-feather'), el('span', '', d.empty)));
        return root;
    }
    // One part of an entry: its own fields, saved into the entry; the "who" part also removes the entry.
    const entryPart = (kind, x, name, content, opts = {}) => part(content, {
        fields: grid(...MIND_PARTS[kind][name](x.raw)),
        save: v => a.save(kind, x.i, x.raw, v),
        ...(name === 'who' ? { remove: () => a.remove(kind, x.i, x.raw), removeLabel: 'Take out of the Mind Book', wide: true } : {}),
    }, a.refresh, opts);
    const list = (title, items, empty) => el('div', 'wh-dos-list').append(el('div', 'wh-dos-list-title', title), items.length ? items : el('div', 'wh-dos-item wh-dos-faint', empty));
    const pills = xs => el('div', 'wh-dos-pills').append(xs);

    const parts = {
        hypnosis: h => [
            entryPart('hypnosis', h, 'who', pills([
                pill(`wh-dos-k-${h.kind}`, 'fa-circle-dot', h.by ? `hypnotized by ${h.byLabel}` : 'hypnotized'),
                h.hidden ? hiddenPill() : '',
            ]), { label: 'who it is' }),
            entryPart('hypnosis', h, 'trance', tranceMeter(h.now, h.deepest), { label: 'the trance' }),
            entryPart('hypnosis', h, 'suggestions', list('Suggestions', h.suggestions.map(s => el('div', 'wh-dos-item').append(s.stage ? el('span', 'wh-dos-tag', s.stage) : '', el('span', '', s.text))), 'none yet'), { label: 'the suggestions' }),
            entryPart('hypnosis', h, 'triggers', list('Triggers', h.triggers.map(t => el('div', 'wh-dos-item').append(el('span', 'wh-dos-cue', `“${t.cue}”`), fa('fa-arrow-right-long wh-dos-faint'), el('span', '', t.effect || ''))), 'none yet'), { label: 'the triggers' }),
        ],
        control: w => [
            entryPart('control', w, 'who', pills([
                pill(`wh-dos-k-${w.kind}`, 'fa-hand-sparkles', w.byLabel === 'you' ? 'your control' : w.by ? `${w.byLabel}'s control` : 'controlled'),
                w.resists ? pill('wh-dos-warn', 'fa-hand-fist', 'resisting') : '',
                w.hidden ? hiddenPill() : '',
            ]), { label: 'who it is' }),
            entryPart('control', w, 'set', list('Set', w.set.map(x => el('div', 'wh-dos-item').append(el('span', 'wh-dos-tag', x.kind), el('span', '', x.text))), 'nothing yet'), { label: 'what was set' }),
            entryPart('control', w, 'own', list('Still their own', w.own ? [el('div', 'wh-dos-item').append(el('span', '', w.own))] : [], 'not said'), { label: 'what is still theirs' }),
        ],
        influence: ch => [
            entryPart('influence', ch, 'who', pills([
                pill(`wh-dos-k-${ch.kind}`, 'fa-seedling', ch.by ? `changed by ${ch.byLabel}` : 'changing'),
                ch.stage === 'holds' ? pill('wh-dos-soft', 'fa-lock', 'holds on its own') : '',
                ch.slipping ? pill('wh-dos-warn', 'fa-arrow-trend-down', 'slipping back') : '',
                ch.hidden ? hiddenPill() : '',
            ]), { label: 'who it is' }),
            entryPart('influence', ch, 'change', el('div', 'wh-dos-quote', ch.what), { label: 'the change' }),
            entryPart('influence', ch, 'count', changeMeter(ch.now, d.holds), { label: 'how far it has built' }),
        ],
        perception: e => [
            entryPart('perception', e, 'who', pills([pill(`wh-dos-k-${e.kind}`, '', e.by ? `by ${e.byLabel}` : 'an edit'), e.hidden ? hiddenPill() : '']), { label: 'who has it' }),
            entryPart('perception', e, 'what', el('div', 'wh-dos-quote', e.what), { label: 'the edit' }),
        ],
    };

    const tile = (key, name, kind, face, status, hidden, counts, body) => {
        const open = d.open === key;
        const card = el('article', `wh-dos-card wh-dos-tile wh-dos-k-${kind}${open ? ' wh-dos-open' : ''}`);
        const head = el('div', 'wh-dos-card-head wh-dos-tile-head').append(
            face.icon ? el('div', `wh-dos-avatar wh-dos-k-${kind}`).append(fa(face.icon)) : avatar(name, kind, open ? face : { image: face.image }),
            // Open, the entry's own first line says it; the head is just the person.
            el('div', 'wh-dos-titles wh-dos-grow').append(el('div', 'wh-dos-name').append(el('span', '', name)), status && !open ? el('div', 'wh-dos-status', status) : ''),
            el('span', 'wh-dos-icons').append(hidden ? fa('fa-eye-slash').attr('title', 'Hidden from you') : '',
                ...counts.filter(([n]) => n).map(([n, icon, what]) => el('span', '').attr('title', what).append(fa(icon), n > 1 ? txt(String(n)) : ''))),
            fa(open ? 'fa-chevron-up wh-dos-faint' : 'fa-chevron-down wh-dos-faint'));
        press(head.attr('aria-expanded', open ? 'true' : 'false'), () => a.open(open ? '' : key));
        card.append(head);
        if (open) card.append(el('div', 'wh-dos-detail').append(body()));
        return card;
    };
    const personTile = p => tile(p.key, p.name, p.kind, p.face, p.status, p.hidden, [
        [p.hypnosis ? p.hypnosis.suggestions.length : 0, 'fa-comment-dots', 'suggestions'], [p.hypnosis ? p.hypnosis.triggers.length : 0, 'fa-bolt', 'triggers'],
    ], () => {
        const blocks = [];
        if (p.hypnosis) blocks.push(...parts.hypnosis(p.hypnosis));
        for (const w of p.control) blocks.push(el('hr', 'wh-dos-rule'), ...parts.control(w));
        for (const ch of p.influence) blocks.push(el('hr', 'wh-dos-rule'), ...parts.influence(ch));
        if (blocks[0]?.is('hr')) blocks.shift();
        return blocks;
    });
    const editTile = e => tile(`edit:${e.i}`, e.title, e.kind, { icon: e.icon }, e.what, e.hidden, [], () => parts.perception(e));

    const here = d.people.filter(p => p.group === 'scene'), rest = d.people.filter(p => p.group !== 'scene');
    if (here.length) root.append(section('In this scene', 'fa-users', here.length), el('div', 'wh-dos-grid').append(here.map(personTile)));
    if (rest.length) root.append(section(here.length ? 'Everyone else' : 'People', 'fa-address-book', rest.length), el('div', 'wh-dos-grid').append(rest.map(personTile)));
    if (d.edits.length) root.append(section('Perception edits', 'fa-eye-slash', d.edits.length), el('div', 'wh-dos-grid').append(d.edits.map(editTile)));
    if (!d.people.length && !d.edits.length) root.append(el('div', 'wh-dos-note', 'Nothing yet: people show up here as the story puts things into their minds.'));

    // A new entry, for each kind this chat keeps.
    const addRow = el('div', 'wh-dos-chips wh-dos-addbar');
    for (const [kind, , icon, addLabel] of MIND_SECTIONS) {
        if (!d.kinds.includes(kind)) continue;
        const chip = press(el('span', 'wh-dos-chip wh-dos-chip-add').append(fa(icon), txt(` ${addLabel}`)), () => openForm(chip, {
            fields: grid(...Object.values(MIND_PARTS[kind]).flatMap(f => f({}))),
            save: v => a.save(kind, -1, null, v), refresh: a.refresh, wide: true,
        }));
        addRow.append(chip);
    }
    root.append(addRow);
    return root;
}

// ------------------------------------------------------------------ a picture

/**
 * One person's picture, large, with what it's drawn from.
 * @param {object} p  { name, image, look (its details, as glanceParts gives them), prompt, ownPrompt, busy, kind }
 * @param {object} a  { draw, upload, remove, editLook, editPrompt }
 */
export function pictureView(p, a) {
    const root = el('div', 'wh-dos wh-dos-picture');
    const frame = el('div', `wh-dos-frame wh-dos-k-${p.kind || 'idle'}`);
    if (p.image) frame.append($('<img alt="">').attr('src', p.image));
    else frame.append(el('span', 'wh-dos-initial', String(p.name || '?').charAt(0).toUpperCase()));
    if (p.busy) frame.append(el('div', 'wh-dos-frame-busy').append(fa('fa-spinner fa-spin'), el('span', '', p.busy)));
    root.append(el('h3', 'wh-dos-title', p.name), frame);
    const look = el('div', 'wh-dos-look');
    if (p.look.length) look.append(glanceChips(p.look));
    else look.append(el('span', 'wh-dos-faint', 'No look yet: drawing writes one from the chat first, or write your own.'));
    if (!p.busy) look.append(tool('fa-pen', p.look.length ? 'Change the look' : 'Write the look', a.editLook));
    root.append(look);
    // What Image Generation is actually sent: built from the look and what they have on now, unless you wrote your own.
    const prompt = el('details', 'wh-dos-more wh-dos-behind').append(el('summary', '').append(fa('fa-sliders'), txt(p.ownPrompt ? ' Picture prompt (your own)' : ' Picture prompt')),
        el('div', 'wh-dos-look').append(el('span', 'wh-dos-small', p.prompt || 'Written from the look when the picture is drawn.'), !p.busy ? tool('fa-pen', 'Write your own prompt', a.editPrompt) : ''));
    root.append(prompt);
    if (!p.busy) {
        root.append(el('div', 'wh-dos-form-actions wh-dos-center').append(
            textButton('fa-wand-magic-sparkles', p.image ? 'Draw again' : 'Draw', a.draw, 'wh-dos-primary'),
            textButton('fa-upload', p.image ? 'Use my own instead' : 'Use my own', a.upload),
            p.image ? textButton('fa-xmark', 'Remove', a.remove, 'wh-dos-danger') : '',
        ));
    }
    return root;
}

// ------------------------------------------------------------------ Card rules

const PRONOUN_WORDS = {
    'he/him': { sub: 'he', obj: 'him', pos: 'his', cs: '\'s', s: 's' },
    'she/her': { sub: 'she', obj: 'her', pos: 'her', cs: '\'s', s: 's' },
    'they/them': { sub: 'they', obj: 'them', pos: 'their', cs: '\'re', s: '' },
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// The dials in the order a card's author thinks about them; the rarer ones fold away under "More rules".
const RULE_GROUPS = [
    { title: () => 'Getting in and out', icon: 'fa-door-open', keys: ['entry', 'own_body', 'exit'] },
    { title: w => `${cap(w.h.pos)} mind`, icon: 'fa-brain', keys: ['host_mind', 'surface', 'memory'] },
    { title: () => 'Afterward', icon: 'fa-moon', keys: ['aftermath'] },
];
const MORE_RULES = ['host_body', 'will', 'bleed', 'detection'];
const RULE_LABELS = {
    entry: w => `How ${w.name} gets in`,
    own_body: w => `${cap(w.r.pos)} own body while ${w.r.sub}${w.r.cs} in someone`,
    exit: () => 'Getting out',
    host_mind: w => `While ${w.r.sub}${w.r.cs} inside`,
    surface: w => `Bringing ${w.h.obj} up`,
    memory: w => `${cap(w.h.pos)} memories`,
    aftermath: w => `When ${w.r.sub} leave${w.r.s}`,
    host_body: w => `${cap(w.h.pos)} body`,
    will: w => `${cap(w.h.pos)} will`,
    bleed: () => 'Bleed',
    detection: () => 'Who can tell',
};

/**
 * How a card's power works, as settings (rules-core.js): tap what's true for the card. Tapping a lit pill again hands
 * that rule back to the Codex; a dashed pill is what the Codex already assumes. The preview is what the writer gets.
 * @param {object} d  { name, rules, dials, preview(rules) → text, tokens(text) → number, canConvert }
 * @param {object} a  { save(rules), convert(), refresh }
 */
export function rulesView(d, a) {
    const st = JSON.parse(JSON.stringify(d.rules || {}));
    st.rider = { name: st.rider?.name || String(d.name).split(' ')[0], pronouns: st.rider?.pronouns || 'he/him' };
    st.host_pronouns ||= 'she/her';
    const words = () => ({ name: st.rider.name || d.name, r: PRONOUN_WORDS[st.rider.pronouns] || PRONOUN_WORDS['they/them'], h: PRONOUN_WORDS[st.host_pronouns] || PRONOUN_WORDS['they/them'] });
    // Option labels in this card's pronouns: "Travels inside her", "Asleep under him".
    const say = (label, w) => label.replace('The host wins', w.h.sub === 'they' ? 'They win' : `${cap(w.h.sub)} wins`)
        .replace(/the host/g, w.h.obj).replace(/the rider/g, w.r.obj).replace(/their own/g, `${w.h.pos} own`);
    const dials = Object.fromEntries(d.dials.map(x => [x.key, x]));
    // The editing class keeps the view from being redrawn under you while a reply's update lands.
    const root = el('div', 'wh-dos wh-dos-rules wh-dos-editing');
    const draws = [];
    let refreshMore = () => {};
    const preview = el('div', 'wh-dos-rules-text wh-dos-clamp');
    const count = el('span', 'wh-dos-faint');
    const refreshPreview = () => {
        const text = d.preview(st);
        preview.text(text || 'Nothing yet: with every rule left to the Codex, the Codex\'s own rules apply.');
        count.text(text ? `about ${d.tokens(text)} tokens` : '');
    };
    const redrawAll = () => { draws.forEach(f => f()); refreshPreview(); refreshMore(); };
    const opt = (label, on, codex, fn) => press(el('span', `wh-dos-opt${on ? ' wh-dos-on' : ''}${codex ? ' wh-dos-cx' : ''}`, label), fn);

    const ruleRow = key => {
        const dial = dials[key], detailKey = `${key}_detail`;
        const box = el('div', 'wh-dos-rule');
        const draw = () => {
            const w = words(), val = st[key];
            const isOn = v => (dial.multi ? (val || []).includes(v) : val === v);
            const opts = dial.options.map(o => opt(`${say(o.label, w)}${o.codex ? ' · Codex' : ''}`, isOn(o.value), !!o.codex && !val, () => {
                if (dial.multi) {
                    const s = new Set(val || []);
                    if (s.has(o.value)) s.delete(o.value); else s.add(o.value);
                    if (s.size) st[key] = [...s]; else delete st[key];
                } else if (val === o.value) delete st[key];
                else st[key] = o.value;
                draw(); refreshPreview(); refreshMore();
            }));
            const own = $('<input type="text" class="text_pole wh-dos-own">').attr('placeholder', 'In this card\'s own words (optional)').val(st[detailKey] || '')
                .on('input', e => { const v = e.target.value.trim(); if (v) st[detailKey] = v; else delete st[detailKey]; refreshPreview(); refreshMore(); });
            const addOwn = press(el('span', 'wh-dos-add-own', '+ in this card\'s own words'), () => { addOwn.replaceWith(own); own.trigger('focus'); });
            box.empty().append(el('div', 'wh-dos-rule-label', RULE_LABELS[key](w)), el('div', 'wh-dos-opts').append(opts), val || st[detailKey] ? own : addOwn);
        };
        draws.push(draw);
        draw();
        return box;
    };

    root.append(header('Card rules', `How ${d.name}'s power works. Tap what's true for this card; anything you leave alone follows the Codex.`, 'fa-sliders',
        d.backup ? textButton('fa-rotate-left', 'Put the card\'s text back', a.restore) : d.canConvert ? textButton('fa-wand-magic-sparkles', 'Read them from the card', a.convert) : ''));

    // "Marcus is he/him and takes women": whose power, their pronouns, and the people they usually take.
    const nameIn = $('<input type="text" class="text_pole wh-dos-name-in">').attr('title', 'The name the story uses').val(st.rider.name)
        .on('input', e => { st.rider.name = e.target.value.trim(); redrawAll(); });
    const who = el('div', 'wh-dos-opts');
    const drawWho = () => who.empty().append(
        el('span', 'wh-dos-faint', 'is'),
        ...['he/him', 'she/her', 'they/them'].map(p => opt(p, st.rider.pronouns === p, false, () => { st.rider.pronouns = p; drawWho(); redrawAll(); })),
        el('span', 'wh-dos-faint', 'and takes'),
        ...[['she/her', 'women'], ['he/him', 'men'], ['they/them', 'anyone']].map(([p, t]) => opt(t, st.host_pronouns === p, false, () => { st.host_pronouns = p; drawWho(); redrawAll(); })),
    );
    drawWho();
    root.append(el('div', 'wh-dos-rules-who').append(nameIn, who));

    for (const g of RULE_GROUPS) {
        const title = el('span', '', ` ${g.title(words())}`);
        draws.push(() => title.text(` ${g.title(words())}`));
        root.append(el('div', 'wh-dos-section').append(fa(g.icon), title), el('div', 'wh-dos-card wh-dos-rule-card').append(g.keys.map(ruleRow)));
    }

    // The rarer rules, plus limits and anything else, folded away with a line saying what's in there.
    const listArea = (k, label, ph) => el('label', 'wh-dos-f wh-dos-full').append(el('small', '', label),
        $('<textarea class="text_pole" rows="2"></textarea>').attr('placeholder', ph).val((st[k] || []).join('\n'))
            .on('input', e => { const xs = e.target.value.split('\n').map(x => x.trim()).filter(Boolean); if (xs.length) st[k] = xs; else delete st[k]; refreshPreview(); }));
    const moreSummary = el('summary', '');
    refreshMore = () => {
        const w = words();
        const set = MORE_RULES.filter(k => st[k] || st[`${k}_detail`]);
        const left = MORE_RULES.filter(k => !set.includes(k)).map(k => RULE_LABELS[k](w).toLowerCase());
        moreSummary.empty().append(fa('fa-sliders'), txt(` More rules${set.length ? `: ${set.length} set` : ''}${left.length ? ` · left to the Codex: ${left.join(', ')}` : ''}`));
    };
    refreshMore();
    const anyMore = MORE_RULES.some(k => st[k] || st[`${k}_detail`]) || st.limits?.length || st.notes?.length;
    root.append($('<details class="wh-dos-more"></details>').prop('open', !!anyMore).append(moreSummary,
        el('div', 'wh-dos-card wh-dos-rule-card').append(MORE_RULES.map(ruleRow),
            el('div', 'wh-dos-fields').append(listArea('limits', 'Limits', 'one per line: range, time, cost…'), listArea('notes', 'Anything else', 'one per line')))));

    const toggle = press(el('span', 'wh-dos-link', 'Show all'), () => { preview.toggleClass('wh-dos-clamp'); toggle.text(preview.hasClass('wh-dos-clamp') ? 'Show all' : 'Show less'); });
    root.append(el('div', 'wh-dos-card wh-dos-rules-preview').append(
        el('div', 'wh-dos-card-head').append(fa('fa-eye wh-dos-accent'), el('span', 'wh-dos-name wh-dos-grow', 'What the writer gets'), count), preview, toggle));
    refreshPreview();
    root.append(el('div', 'wh-dos-form-actions').append(el('span', 'wh-dos-grow'), textButton('fa-check', 'Save to the card', async () => { await a.save(st); a.refresh(); }, 'wh-dos-primary')));
    return root;
}

const FIELD_NAMES = { description: 'Description', post_history_instructions: 'Post-history instructions', personality: 'Personality', scenario: 'Scenario' };

/**
 * "Read them from the card", before anything changes: the rules found, and each field of the card with what would
 * come out struck through and the stand-in sentence marked, plus the tokens the writer gets before and after.
 * @param {object} d  { name, rulesText, summary, parts: { field: [{ text, kind }] }, unsure, missed, tooMuch, before, after }
 * @param {object} a  { apply(), settingsOnly(), refresh }
 */
export function convertView(d, a) {
    const root = el('div', 'wh-dos wh-dos-convert');
    root.append(header('Card rules from the card', `What ${d.name}'s card says about how the power works, as settings, and the text that would come out so the writer only gets it once. Nothing changes until you choose below.`, 'fa-wand-magic-sparkles'));
    root.append(el('div', 'wh-dos-convert-tokens').append(
        el('span', 'wh-dos-faint', 'The writer gets about'), el('b', '', ` ${d.before} `), el('span', 'wh-dos-faint', 'tokens of this card now, and'),
        el('b', 'wh-dos-accent', ` ${d.after} `), el('span', 'wh-dos-faint', 'after.'),
    ));
    root.append(el('div', 'wh-dos-section').append(fa('fa-sliders'), txt(` Rules found${d.summary ? `: ${d.summary}` : ''}`)));
    const rules = el('div', 'wh-dos-rules-text wh-dos-clamp', d.rulesText || 'None: the card doesn\'t settle any of the rules, so the Codex keeps deciding.');
    const more = press(el('span', 'wh-dos-link', 'Show all'), () => { rules.toggleClass('wh-dos-clamp'); more.text(rules.hasClass('wh-dos-clamp') ? 'Show all' : 'Show less'); });
    root.append(el('div', 'wh-dos-card').append(rules, d.rulesText ? more : ''));
    for (const [field, segs] of Object.entries(d.parts)) {
        root.append(el('div', 'wh-dos-section').append(fa('fa-scissors'), txt(` ${FIELD_NAMES[field] || field}`)));
        root.append(el('div', 'wh-dos-card wh-dos-diff').append(segs.map(s => el(s.kind === 'cut' ? 'del' : s.kind === 'add' ? 'ins' : 'span', `wh-dos-${s.kind}`, s.text))));
    }
    const left = [...d.unsure.map(u => `${u.text.slice(0, 160)}${u.text.length > 160 ? '…' : ''}${u.why ? ` (${u.why})` : ''}`),
        ...d.tooMuch.map(f => `${FIELD_NAMES[f] || f}: nothing taken out, since the cuts would have left too little of it.`),
        ...d.missed.map(m => `Couldn't find this in the card, so it stays: ${m.text.slice(0, 120)}…`)];
    if (left.length) root.append(el('div', 'wh-dos-section').append(fa('fa-circle-question'), txt(' Left in for you to decide')), el('ul', 'wh-dos-left').append(left.map(t => el('li', '', t))));
    root.append(el('div', 'wh-dos-note', 'The text that comes out is kept on the card: Card rules can put it back.'));
    root.append(el('div', 'wh-dos-form-actions').append(
        textButton('fa-sliders', 'Only save the settings', a.settingsOnly), el('span', 'wh-dos-grow'),
        textButton('fa-check', 'Save and take out the text', a.apply, 'wh-dos-primary'),
    ));
    return root;
}
