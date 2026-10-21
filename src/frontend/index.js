// Worldhopper Engine for Lumiverse — the frontend: the Worldhopper panel (a drawer tab), the Ledger and Mind Book bars
// above the chat, the body roster over the message box, "as …" badges and ⟲ on messages, the Ledger, Mind Book and
// picture views, Check card, and a Worldhopper tab in the character editor for a card's modes. Everything it shows
// comes from the backend as one state object per chat; everything it changes goes back as a request.
import $ from 'jquery';
import css from './style.css' with { type: 'text' };
import { svg, iconFor, ICON_SVG } from './icons.js';
import { ledgerView, mindView, pictureView } from './views.js';
import { MODE_GROUPS, MODIFIERS, PARENT, MODE_BLURBS, expandModes } from '../core/codex-core.js';

let ctx = null;
let state = null;          // the backend's latest state for the open chat
let chatId = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------------------------ talking to the backend

const pending = new Map();
let seq = 0;
const LONG = new Set(['draw', 'drawMissing', 'review', 'writeSheet', 'suggest']);
function call(op, args = {}) {
    return new Promise((resolve, reject) => {
        const id = ++seq;
        const timer = setTimeout(() => { if (pending.delete(id)) reject(new Error('no answer from the Worldhopper backend')); }, LONG.has(op) ? 600000 : 60000);
        pending.set(id, { resolve, reject, timer });
        ctx.sendToBackend({ type: 'rpc', id, op, args: { chatId, ...args } });
    });
}

// ------------------------------------------------------------------ a small notice (Lumiverse's toasts belong to the backend)

function notice(text, { kind = 'info', action = null, timeout = 6000 } = {}) {
    const box = $('<div class="wh-ui wh-toast"></div>').addClass(`wh-toast-${kind}`).append($('<span></span>').text(text));
    if (action) box.append($('<button type="button" class="menu_button"></button>').text(action.label).on('click', () => { action.run(); box.remove(); }));
    box.append($('<button type="button" class="wh-toast-x" title="Close"></button>').html(svg('xmark')).on('click', () => box.remove()));
    let host = $('#wh_toasts');
    if (!host.length) host = $('<div id="wh_toasts"></div>').appendTo(document.body);
    host.append(box);
    if (timeout) setTimeout(() => box.fadeOut(200, () => box.remove()), timeout);
}
const TOAST_CSS = `
#wh_toasts { position: fixed; z-index: 100000; top: 14px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; width: min(92vw, 460px); pointer-events: none; }
#wh_toasts .wh-toast { pointer-events: auto; display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--wh-line); background: var(--wh-panel); box-shadow: 0 8px 30px rgba(0,0,0,.35); font-size: .92em; }
#wh_toasts .wh-toast > span { flex: 1; }
#wh_toasts .wh-toast-warn { border-color: color-mix(in srgb, var(--lumiverse-warning, #e0a030) 60%, transparent); }
#wh_toasts .wh-toast-x { border: none; background: none; color: inherit; opacity: .6; cursor: pointer; display: inline-flex; }
`;

/** A yes/no from Lumiverse's own confirmation dialog. */
async function confirmIt(title, message, confirmLabel = 'Remove') {
    try { return (await ctx.ui.showConfirm({ title, message, variant: 'danger', confirmLabel, cancelLabel: 'Cancel' }))?.confirmed; } catch { return window.confirm(message || title); }
}

/** A modal with our content; returns { root (jQuery), close }. */
function modal(title, { width = 920 } = {}) {
    const h = ctx.ui.showModal({ title, width, maxHeight: Math.round(window.innerHeight * 0.88) });
    const root = $('<div class="wh-ui"></div>').appendTo(h.root);
    return { root, close: () => h.dismiss(), onClose: fn => h.onDismiss(fn) };
}

/** A text box in a modal (a persona's description, a look). Resolves the text, or null when canceled. */
function ask(title, { value = '', rows = 6, ok = 'Save', note = '' } = {}) {
    return new Promise(resolve => {
        const m = modal(title, { width: 560 });
        let done = false;
        const finish = v => { if (done) return; done = true; resolve(v); m.close(); };
        const area = $('<textarea class="text_pole"></textarea>').attr('rows', rows).val(value);
        m.root.append($('<div class="wh-ask"></div>').append(
            note ? $('<small class="wh-muted"></small>').text(note) : '',
            area,
            $('<div class="wh-ask-actions"></div>').append(
                $('<button type="button" class="menu_button">Cancel</button>').on('click', () => finish(null)),
                $('<button type="button" class="menu_button wh-dos-primary"></button>').text(ok).on('click', () => finish(String(area.val()))),
            ),
        ));
        m.onClose(() => { if (!done) { done = true; resolve(null); } });
        setTimeout(() => area.trigger('focus'), 50);
    });
}

// ------------------------------------------------------------------ the panel

let tab = null;
let panelWaiting = false;
let pickerOpen = null;           // the mode picker, open or folded (null: open by itself for a card with no modes)
const helpOpen = new Set();
let settingsOpen = false;
const openRows = new Set();
let shownBlurb = null;
let connections = null;          // { llm, image } from the backend, read when Settings opens
const modelLists = new Map();    // connection id → its models

const groupOf = m => (MODE_GROUPS.find(([, list]) => list.includes(m))?.[0] || 'other').toLowerCase();
const helpToggle = key => $(`<span class="wh-help-toggle" role="button" tabindex="0" title="How it works"></span>`).attr('data-help', key).html(svg('circle-question')).toggleClass('wh-on', helpOpen.has(key));
const help = (key, html) => $('<div class="wh-help"></div>').attr('data-help', key).toggleClass('wh-open', helpOpen.has(key)).html(html);
const iconBtn = (icon, title, fn, on = false) => $('<button type="button" class="menu_button menu_button_icon"></button>').attr('title', title).toggleClass('wh-on', on).html(svg(icon)).on('click', fn);

function panelRow(r) {
    const k = r.main + r.sub;
    const row = $('<div class="wh-row"></div>').addClass(r.kind ? `wh-k-${r.kind}` : '').toggleClass('wh-open', openRows.has(k))
        .append($('<div class="wh-row-main"></div>').append(r.icon ? svg(r.icon) : '', $('<span></span>').text(r.main), r.hidden ? $(svg('eye-slash')).attr('title', 'hidden from you') : ''));
    if (r.sub) row.append($('<div class="wh-row-sub"></div>').text(r.sub).attr('title', r.sub)).addClass('wh-expandable').on('click', () => { openRows.has(k) ? openRows.delete(k) : openRows.add(k); row.toggleClass('wh-open'); });
    return row;
}

/** The mode picker: pills by family; a change saves at once. */
function modePicker(picked, { disabled = false, onChange }) {
    const box = $('<div class="wh-modes"></div>');
    for (const [group, modes] of MODE_GROUPS) {
        const row = $('<div class="wh-mode-group"></div>').addClass(`wh-g-${group.toLowerCase()}`).append($('<div class="wh-mode-group-title"></div>').text(group));
        for (const m of modes) {
            const pill = $('<label class="wh-pill"></label>').toggleClass('wh-modifier', MODIFIERS.has(m)).attr('title', (MODE_BLURBS[m] || '') + (PARENT[m] ? ` (modifier: also switches on ${PARENT[m]})` : ''));
            const cb = $('<input type="checkbox">').prop('checked', picked.has(m)).prop('disabled', disabled).data('mode', m);
            row.append(pill.append(cb, $('<span></span>').text(m)));
        }
        box.append(row);
    }
    box.on('change', 'input', () => onChange(box.find('input:checked').map((_, el) => $(el).data('mode')).get()));
    return box;
}

function renderPanel() {
    if (!tab) return;
    const root = $(tab.root);
    // A state arriving while you're in a field would close the dropdown or drop what you typed: wait for you.
    if (root.find('select:focus, input[type="text"]:focus, textarea:focus').length) {
        if (!panelWaiting) { panelWaiting = true; root.one('focusout', () => { panelWaiting = false; setTimeout(renderPanel, 0); }); }
        return;
    }
    const scroll = root.scrollTop();
    const st = state;
    const panel = $('<div class="wh-ui wh-panel"></div>');
    const live = !!st?.on;

    // Heading: the name and the switch.
    const power = $('<label class="wh-switch wh-power" title="Worldhopper on or off"><input type="checkbox"></label>');
    power.find('input').prop('checked', live).on('change', function () { call('setEnabled', { value: this.checked }); });
    panel.append($('<div class="wh-top"></div>').append($('<span class="wh-brand"></span>').append(svg('hurricane'), 'Worldhopper Engine'), power));
    if (!live) {
        panel.append($('<div class="wh-tip"></div>').append(svg('power-off'), $('<span></span>').html('<b>Worldhopper is off.</b> Nothing goes into your prompts and no background model runs. Moment boxes, "as …" badges and ⟲ on edited replies still show, and your modes and Ledgers are kept for when you turn it back on.')));
    }

    if (live) {
        // Modes
        const t = st?.target;
        const picked = new Set(st?.picks || []);
        const card = $('<section class="wh-card"></section>');
        const open = pickerOpen ?? (!!t && !picked.size && !t.builder);
        card.append($('<div class="wh-head"></div>').append(
            $('<span class="wh-title"></span>').append(svg('shapes'), 'Modes ', $('<span class="wh-sub"></span>').text(t ? `· ${t.label}` : '')),
            $('<div class="wh-tools"></div>').append(
                helpToggle('modes'),
                t && !t.group ? iconBtn('wand-magic-sparkles', "Suggest modes from this character's card", suggest) : '',
                t ? iconBtn(open ? 'check' : 'pen', open ? 'Done' : "Change this character's modes", () => { pickerOpen = !open; renderPanel(); }, open) : '',
            ),
        ));
        card.append(help('modes', `Pick the kinds of metaphysics this character uses (possession, mind control, dolls…). Worldhopper then adds the matching Codex rules to every reply in this chat, so the model knows how they work. Every mode is opt-in: nothing you didn't pick ever shows up. A character's picks are saved on its card (they travel with it); a group's are saved with the group chat.<br>${svg('pen')} changes the picks · ${svg('wand-magic-sparkles')} suggests some from the card · tap a picked mode to see what it means.`));
        const chips = $('<div class="wh-picked"></div>');
        if (!t) chips.append('<span class="wh-empty">Open a chat to pick its modes.</span>');
        else if (t.builder && !picked.size) chips.append('<span class="wh-empty">This is a card builder, so it has no modes of its own.</span>');
        else if (!picked.size) chips.append($('<span class="wh-empty"></span>').html(`None yet. Tap ${svg('pen')} to pick some, or ${svg('wand-magic-sparkles')} to suggest them from the card. Only what you pick is ever used.`));
        else {
            for (const m of expandModes([...picked])) {
                chips.append($('<span class="wh-chip" tabindex="0"></span>').addClass(`wh-g-${groupOf(m)}`).text(m).attr('title', MODE_BLURBS[m] || '')
                    .on('click', () => { shownBlurb = shownBlurb === m ? null : m; renderPanel(); }));
            }
        }
        if (!open || !t) card.append(chips);
        if (shownBlurb && picked.size && !open) card.append($('<div class="wh-blurb"></div>').append($('<b></b>').text(shownBlurb), `: ${MODE_BLURBS[shownBlurb] || ''}`));
        if (st?.suggestion) {
            card.append($('<div class="wh-suggestion"></div>').append($('<span></span>').text(`Suggested: ${st.suggestion.join(', ')}`),
                $('<button type="button" class="menu_button">Apply</button>').on('click', () => call('applySuggestion'))));
        }
        if (open && t) card.append(modePicker(picked, { onChange: modes => call('setModes', { modes }) }));
        panel.append(card);

        // Body Ledger
        if (st?.showLedgerCard) {
            const lc = $('<section class="wh-card"></section>').append($('<div class="wh-head"></div>').append(
                $('<span class="wh-title"></span>').append(svg('people-arrows'), 'Body Ledger'),
                $('<div class="wh-tools"></div>').append(helpToggle('ledger'),
                    iconBtn('pen', 'Open the Ledger: a card for each body, to read or change', openLedgerView),
                    iconBtn('rotate', 'Rebuild from the card and recent messages', () => call('rebuild'))),
            ));
            lc.append(help('ledger', `Keeps track of who is in which body (possession, multipossession, skinsuits, hive minds, copies, swaps) and who has which power. It updates after each reply in chats with one of those modes, and goes into the prompt so names, pronouns and every change stay straight. Each body someone takes over gets three short lines on who its owner is in their own life (look, voice and habits, life), written once by your notes model. <span class="wh-key wh-key-you"></span> teal rows are yours; <span class="wh-key wh-key-npc"></span> violet rows are someone else's. After each reply it reads only the newest messages, never the whole chat.<br>While you run more than one body, a card per body sits over the message box: tap one to start a line like <code>[Kayla] </code> for that body. A line with no name is you as a whole, and the writer only ever does what you wrote with your bodies.<br>${svg('pen')} (or the bar above the chat) opens it as cards: tap ✏️ by any part to change it, and tap a face for its picture · ${svg('rotate')} rebuilds it from the card and the last few messages.`));
            const box = $('<div class="wh-box"></div>');
            for (const r of st.panel.ledgerRows) box.append(panelRow(r));
            for (const x of st.panel.extra) box.append($('<div class="wh-row-sub wh-extra"></div>').text(x));
            if (!st.panel.ledgerRows.length) box.prepend($('<div class="wh-empty"></div>').text(st.panel.ledgerEmpty));
            lc.append(box);
            if (st.panel.historyRows.length) {
                const hist = $('<div class="wh-box wh-history"></div>').append('<div class="wh-mini-title">History</div>');
                for (const r of st.panel.historyRows) hist.append(panelRow(r));
                lc.append(hist);
            }
            panel.append(lc);
        }

        // Mind Book
        if (st?.showMindCard) {
            const mc = $('<section class="wh-card"></section>').append($('<div class="wh-head"></div>').append(
                $('<span class="wh-title"></span>').append(svg('brain'), 'Mind Book'),
                $('<div class="wh-tools"></div>').append(helpToggle('mind'), iconBtn('pen', 'Open the Mind Book: a card for each person in it, to read or change', openMindView)),
            ));
            mc.append(help('mind', `Keeps what Hypnosis, Mind Control and Altered Perception have put into people, each in its own record: a hypnotized person's trance stage, sessions, suggestions and triggers; what a controller has set in someone's will; who can't perceive what. It updates only on replies that touch those things, and goes into the prompt with a line for the moment when it matters.<br>${svg('pen')} (or the bar above the chat) opens it as cards: tap ✏️ by any part to change it, or + to add someone.`));
            const box = $('<div class="wh-box"></div>');
            for (const r of st.panel.mindRows) box.append(panelRow(r));
            if (st.panel.mindEmpty) box.append($('<div class="wh-empty"></div>').text(st.panel.mindEmpty));
            panel.append(mc.append(box));
        }

        panel.append($('<div class="wh-status"></div>').append(
            $('<small></small>').text(st?.status?.ledger || ''), $('<small></small>').text(st?.status?.timing || ''), $('<small></small>').text(st?.status?.checks || '')));

        // Card tools
        if (t && !t.group) {
            panel.append($('<div class="wh-tools" style="justify-content:flex-start"></div>').append(
                $('<button type="button" class="menu_button"></button>').append(svg('stethoscope'), 'Check card').attr('title', "Check this character's card for things that trip models up").on('click', () => checkCard(t.characterId)),
            ));
        }
    }

    // Settings
    const det = $('<details class="wh-settings"></details>').prop('open', settingsOpen).on('toggle', function () { settingsOpen = this.open; if (this.open && !connections) loadConnections(); });
    det.append($('<summary></summary>').append(svg('gear'), 'Settings'));
    det.append(settingsBody());
    panel.append(det);

    root.empty().append(panel);
    root.scrollTop(scroll);
    // (?) opens a short how-to under its heading; tap again to close.
    panel.on('click keydown', '.wh-help-toggle', function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const key = $(this).attr('data-help');
        helpOpen.has(key) ? helpOpen.delete(key) : helpOpen.add(key);
        $(this).toggleClass('wh-on');
        panel.find(`.wh-help[data-help="${key}"]`).toggleClass('wh-open');
    });
}

async function loadConnections() {
    try { connections = await call('connections'); } catch { connections = { llm: [], image: [] }; }
    renderPanel();
}

function settingsBody() {
    const s = state?.settings || { ledger: {}, pictures: {} };
    const L = s.ledger || {};
    const Pc = s.pictures || {};
    const body = $('<div></div>');
    const set = (group, key) => function () { call('setSetting', { group, key, value: this.type === 'checkbox' ? this.checked : $(this).val() }); };
    const conn = (value, empty) => {
        const sel = $('<select class="text_pole"></select>').append($('<option value=""></option>').text(empty));
        for (const c of connections?.llm || []) sel.append($('<option></option>').val(c.id).text(`${c.name}${c.model ? ` (${c.model})` : ''}`));
        if (value && !(connections?.llm || []).some(c => c.id === value)) sel.append($('<option></option>').val(value).text(connections ? `${value} (missing)` : 'loading…'));
        return sel.val(value || '');
    };
    const model = (connId, value, key) => {
        const id = `wh_models_${key}`;
        const input = $('<input type="text" class="text_pole" placeholder="its own model">').attr('list', id).val(value || '').on('change', set('ledger', key));
        const list = $('<datalist></datalist>').attr('id', id);
        for (const m of modelLists.get(connId) || []) list.append($('<option></option>').val(m.id));
        if (connId && !modelLists.has(connId)) { modelLists.set(connId, []); call('models', { connectionId: connId }).then(ms => { modelLists.set(connId, ms || []); }).catch(() => {}); }
        return $('<span></span>').append(input, list);
    };

    // Models
    const models = $('<section class="wh-section"></section>').append(
        $('<div class="wh-group"></div>').append(svg('microchip'), $('<span>Models</span>'), helpToggle('models')),
        help('models', "Worldhopper's background jobs run through your connections, separate from the model you chat with. Give them their own model: a local one or a cheap, fast API model (the Flash, Haiku or mini tier). The jobs are small and the Ledger runs after every reply, so that keeps things quick and costs next to nothing; your big roleplay model would work, but at big-model prices on every reply, and your next reply waits for the Ledger. A connection can lend its key to a different model: type one in beside it. A job with no model picked simply doesn't run."),
        $('<div class="wh-tip"></div>').append(svg('bolt'), $('<span></span>').html('<b>Fast and cheap:</b> use a local or budget model here, not your roleplay model.')),
    );
    if (connections && !connections.llm.length) models.append('<div class="wh-warning">No connections yet. Add one under Connections, then pick it here.</div>');
    models.append($('<label class="wh-field"></label>').append(
        $('<span><b>Ledger &amp; suggestions</b><small>Updates the Body Ledger and the Mind Book after replies, checks replies against the Ledger, and suggests modes for new characters. Runs the most, so pick your fastest, cheapest model.</small></span>'),
        $('<div class="wh-pair"></div>').append(conn(L.connection, '— pick a connection —').on('change', set('ledger', 'connection')), model(L.connection, L.model, 'model')),
    ));
    models.append($('<label class="wh-field"></label>').append(
        $('<span><b>Notes &amp; reviews</b><small>Writes Body History notes, host sheets and the looks pictures are drawn from, and runs Check card\'s deeper review. Runs rarely; a cheap model works, and a slightly better one reads a little closer.</small></span>'),
        $('<div class="wh-pair"></div>').append(conn(L.notesConnection, 'Same as Ledger').on('change', set('ledger', 'notesConnection')), L.notesConnection ? model(L.notesConnection, L.notesModel, 'notesModel') : $('<span></span>')),
    ));
    body.append(models);

    // Choices
    const sw = (key, group, checked, title, sub) => $('<label class="wh-switch"></label>').append($('<input type="checkbox">').prop('checked', !!checked).on('change', set(group, key)), $('<span></span>').append($('<b></b>').text(title), $('<small></small>').text(sub)));
    const choices = $('<section class="wh-section"></section>').append(
        $('<div class="wh-group"></div>').append(svg('sliders'), $('<span>Choices</span>'), helpToggle('choices')),
        help('choices', 'The few things that are up to you. Everything else (the mode reminders, detail entries, the bars, the body roster, Body History, the pronoun and body-rule checks) is part of Worldhopper and runs whenever it\'s on. To turn all of it off at once, use the switch at the top.'),
        $('<div class="wh-switches"></div>').append(
            sw('enabled', 'ledger', L.enabled !== false, 'Body Ledger & Mind Book', 'Track who is in which body, and what hypnosis, mind control and altered perception have put into people, after each reply in chats with those modes. Off, the mode rules still apply, but nothing runs in the background and your send never waits.'),
            sw('auto', 'pictures', Pc.auto, 'Draw pictures on their own', 'Draws each new host once their sheet is written, and each new person in the Mind Book. Off, tap anyone\'s face in the Ledger or the Mind Book to draw them whenever you like.'),
        ),
    );
    const img = $('<select class="text_pole"></select>').append($('<option value=""></option>').text('As Image Generation is set'));
    for (const c of connections?.image || []) img.append($('<option></option>').val(c.id).text(`${c.name}${c.isDefault ? ' (default)' : ''}`));
    img.val(Pc.connection || '').on('change', set('pictures', 'connection'));
    choices.append($('<div class="wh-field"></div>').append(
        $('<span><b>Pictures</b><small>Drawn through one of your image connections. The look (anime, painted, photo) comes from your model or workflow; a Style is put before every picture\'s prompt, and a Negative goes with it where the connection takes one.</small></span>'),
        img,
        $('<input type="text" class="text_pole" placeholder="Style (optional): words put before every picture prompt">').val(Pc.style || '').on('change', set('pictures', 'style')),
        $('<input type="text" class="text_pole" placeholder="Negative (optional)">').val(Pc.negative || '').on('change', set('pictures', 'negative')),
    ));
    body.append(choices);

    // Tools
    const b = state?.backfill || {};
    const tools = $('<section class="wh-section"></section>').append($('<div class="wh-group"></div>').append(svg('toolbox'), $('<span>Tools</span>')));
    const fill = $('<button type="button" class="menu_button wh-wide-button"></button>')
        .attr('title', 'For a chat that started before the Ledger was on: reads the replies that have no Ledger entry yet, once each, to build the history. About 1 s per reply; tap again to stop.')
        .append(svg(b.running ? 'stop' : 'clock-rotate-left'), b.running ? 'Stop building' : 'Build history from earlier replies')
        .on('click', () => backfill());
    tools.append(fill);
    body.append(tools);
    return body;
}

async function suggest() {
    try {
        const r = await call('suggest');
        if (r?.error) notice(r.error, { kind: 'warn' });
        else if (r && !r.modes?.length) notice(`No metaphysics modes found in ${r.label}'s card.`);
    } catch (err) { notice(err.message, { kind: 'warn' }); }
}

async function backfill() {
    const b = state?.backfill || {};
    if (b.running) { call('stopBackfill'); return; }
    if (!b.all) { notice('Every reply already has a Ledger entry.'); return; }
    if (!state?.settings?.ledger?.connection) { notice('Pick a Ledger model first (Settings → Models).', { kind: 'warn' }); return; }
    const minutes = n => `about ${Math.max(1, Math.ceil(n * 1.5 / 60))} min`;
    let which = 'all';
    if (b.recent < b.all) {
        const m = modal('Build history');
        which = await new Promise(resolve => {
            m.root.append($('<div class="wh-ask"></div>').append(
                $('<p></p>').text(`${b.all} replies in this chat have no Ledger entry yet. Each is read once; replies that already have one are skipped.`),
                $('<p></p>').html(`<b>Last 30 replies:</b> ${b.recent ? `reads ${b.recent}, ${minutes(b.recent)}.` : 'nothing to read, they all have entries.'}<br><b>Whole chat:</b> reads all ${b.all}, ${minutes(b.all)}.`),
                $('<div class="wh-ask-actions"></div>').append(
                    $('<button type="button" class="menu_button">Cancel</button>').on('click', () => resolve(null)),
                    $('<button type="button" class="menu_button">Whole chat</button>').on('click', () => resolve('all')),
                    $('<button type="button" class="menu_button wh-dos-primary">Last 30 replies</button>').on('click', () => resolve('recent')),
                ),
            ));
            m.onClose(() => resolve(null));
        });
        m.close();
        if (!which) return;
        if (which === 'recent' && !b.recent) { notice('The last 30 replies already have Ledger entries.'); return; }
    }
    notice(`Building the Body History (${minutes(which === 'all' ? b.all : b.recent)}). You can keep reading; new replies wait their turn.`);
    call('backfill', { which });
}

// ------------------------------------------------------------------ the bars above the chat, and the roster

let dock = null, composer = null;
function chipHtml(c) {
    const lead = c.face ? `<img class="wh-chip-face" src="${esc(c.face)}" alt="" loading="lazy">` : svg(c.icon);
    return `<span class="wh-chip wh-${c.kind}${c.hidden ? ' wh-hidden' : ''}${c.face ? ' wh-has-face' : ''}" title="${esc(c.tip)}">${lead}`
        + `<span class="wh-chip-text"><b>${esc(c.title)}</b><small>${esc(c.sub)}${c.hidden ? ` · hidden ${svg('eye-slash')}` : ''}</small></span></span>`;
}
function renderDocks() {
    if (!dock) return;
    const st = state;
    const box = $(dock).empty();
    if (!st?.chatId) return;
    const bar = (cls, title, html, open) => $(`<div class="wh-ledger-strip ${cls}" role="button" tabindex="0"></div>`).attr('title', title).html(html)
        .on('click keydown', e => { if (e.type === 'click' || e.key === 'Enter') open(); });
    const wrap = $('<div class="wh-ui wh-docks"></div>');
    if (st.strip?.show) wrap.append(bar('', 'Body Ledger — tap to open', st.strip.chips.map(chipHtml).join('') + (st.strip.busy ? '<span class="wh-busy">updating…</span>' : ''), openLedgerView));
    if (st.mindStrip?.show) wrap.append(bar('wh-mind-strip', 'Mind Book — tap to open', `<span class="wh-strip-label" title="Mind Book">${svg('brain')}</span>${st.mindStrip.chips.map(chipHtml).join('')}${st.mindStrip.busy ? '<span class="wh-busy">updating…</span>' : ''}`, openMindView));
    if (wrap.children().length) box.append(wrap);
}

function textarea() { return document.querySelector('[data-component="InputArea"] textarea'); }

function renderRoster() {
    if (!composer) return;
    const r = state?.roster;
    const box = $(composer).empty();
    if (!r?.show) return;
    const lanes = $('<div class="wh-ui wh-lanes"></div>').toggleClass('wh-compact', r.compact);
    for (const c of r.cards) {
        const carry = c.doing || c.notes || 'no line yet';
        lanes.append($('<button type="button" class="wh-lane-card"></button>').attr({ 'data-name': c.name, 'data-carry': carry, title: [`Start a line for ${c.name}: [${c.name}]`, c.doing, c.notes].filter(Boolean).join('\n') })
            .css('--wh-hue', c.hue)
            .append($('<span class="wh-lane-top"></span>').append('<span class="wh-lane-dot"></span>', $('<b></b>').text(c.name), c.own ? '<small>(you)</small>' : ''), $('<span class="wh-lane-status"></span>').text(carry))
            .on('click', () => addLane(c.name)));
    }
    if (!r.big) {
        lanes.append($('<button type="button" class="wh-lanes-size"></button>').attr('title', r.compact ? 'Bigger cards, with what each body is doing' : 'Smaller cards')
            .html(svg(r.compact ? 'up-right-and-down-left-from-center' : 'down-left-and-up-right-to-center'))
            .on('click', () => call('setSetting', { group: 'ledger', key: 'lanesCompact', value: !state.settings.ledger.lanesCompact })));
    }
    box.append(lanes);
    markLanes();
}

/** Light up the card for the line the cursor is on, and say which bodies already have a line. */
function markLanes() {
    const ta = textarea();
    const cards = composer ? $(composer).find('.wh-lane-card') : $();
    if (!ta || !cards.length) return;
    const names = cards.map((_, el) => el.dataset.name.toLowerCase()).get();
    const tagOf = l => {
        const m = /^\s*\[([^\]\n]+)\]\s*(.*)$/.exec(l) || /^\s*([^:\n[\]]{1,40}):\s*(.*)$/.exec(l);
        return m && names.includes(m[1].trim().toLowerCase()) ? { n: m[1].trim().toLowerCase(), text: m[2].trim() } : null;
    };
    const v = ta.value;
    const at = ta.selectionEnd ?? v.length;
    const end = v.indexOf('\n', at);
    const cur = tagOf(v.slice(v.lastIndexOf('\n', at - 1) + 1, end < 0 ? v.length : end));
    const has = new Set(v.split('\n').map(tagOf).filter(x => x?.text).map(x => x.n));
    cards.each((_, el) => {
        const n = el.dataset.name.toLowerCase();
        $(el).toggleClass('wh-on', cur?.n === n).toggleClass('wh-has', has.has(n));
        $(el).find('.wh-lane-status').text(cur?.n === n ? 'writing' : has.has(n) ? 'has a line' : el.dataset.carry);
    });
}

/** "[Name] " at the start of a line in the message box: on a new line, or in place of a tag with nothing after it. */
function addLane(name) {
    const ta = textarea();
    if (!ta || !name) return;
    const v = ta.value;
    const at = ta.selectionEnd ?? v.length;
    const lineStart = v.lastIndexOf('\n', at - 1) + 1;
    const line = v.slice(lineStart, at);
    const tag = `[${name}] `;
    if (!line.trim() || /^\s*\[[^\]\n]*\]\s*$/.test(line)) ta.setRangeText(tag, lineStart, at, 'end');
    else ta.setRangeText(`\n${tag}`, at, at, 'end');
    // Lumiverse's message box is a React field: an input event tells it the text changed.
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    markLanes();
}

// ------------------------------------------------------------------ in the messages: badges, ⟲, body-line colors, fresh boxes

const LANE_HUES = ['29, 158, 117', '127, 119, 221', '216, 90, 48', '212, 83, 126', '186, 117, 23', '55, 138, 221', '99, 153, 34', '226, 75, 74'];
const hueOf = name => {
    const k = String(name || '').trim().toLowerCase();
    return state?.laneHues?.[k] || LANE_HUES[1 + [...k].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % (LANE_HUES.length - 1)];
};
let startLatest = null;          // the newest message when the page loaded: its boxes don't animate
const animated = new Set();

function decorate() {
    const st = state;
    // "as …" badges on your messages
    const want = new Map((st?.badges || []).map(b => [b.messageId, b.worn]));
    document.querySelectorAll('.wh-as').forEach(el => {
        const id = el.dataset.messageId;
        if (!want.has(id) || el.dataset.worn !== want.get(id).join(', ')) el.remove();
    });
    for (const [id, worn] of want) {
        const host = document.querySelector(`[data-spindle-mount="message_header"][data-spindle-scope^="message:${CSS.escape(id)}:"]`);
        if (!host || host.querySelector('.wh-as')) continue;
        const b = document.createElement('span');
        b.className = 'wh-ui wh-as';
        b.dataset.messageId = id;
        b.dataset.worn = worn.join(', ');
        b.title = `You're in ${worn.join(', ')}`;
        b.innerHTML = `${svg('user')} as ${esc(worn.join(', '))}`;
        host.append(b);
    }
    // ⟲ on replies the checks changed
    const edited = new Map((st?.edited || []).map(e => [e.messageId, e.original]));
    document.querySelectorAll('.wh-undo').forEach(el => { if (!edited.has(el.dataset.messageId)) el.remove(); });
    for (const [id, original] of edited) {
        const host = document.querySelector(`[data-spindle-scope="message:${CSS.escape(id)}:actions"]`);
        if (!host) continue;
        let btn = host.querySelector('.wh-undo');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wh-undo';
            btn.dataset.messageId = id;
            btn.innerHTML = svg('rotate-left');
            btn.addEventListener('click', e => { e.stopPropagation(); toggleEdit(id); });
            host.prepend(btn);
        }
        btn.classList.toggle('wh-showing-original', original);
        btn.title = original ? 'Worldhopper: showing the original reply. Tap for the fixed one.' : 'Worldhopper: the checks fixed this reply. Tap for the original.';
    }
    // Your body lines take their body's color.
    document.querySelectorAll('.wh-lane').forEach(el => {
        const name = el.querySelector('.wh-lane-name')?.textContent;
        if (name) el.style.setProperty('--wh-hue', hueOf(name));
    });
    // The newest reply's boxes arrive with a ripple, once.
    const latest = ctx.messages?.getLatestMessageId?.();
    if (latest && latest !== startLatest && !animated.has(latest)) {
        const row = document.querySelector(`[data-message-id="${CSS.escape(latest)}"]`);
        const boxes = row ? row.querySelectorAll('.wh-possess, .wh-release, .wh-moment') : [];
        if (boxes.length) { boxes.forEach(b => b.classList.add('wh-fresh')); animated.add(latest); }
    }
}
let decorateQueued = false;
let helloFor = undefined;
const queueDecorate = () => {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(() => {
        decorateQueued = false;
        // A chat switch redraws the page: tell the backend which chat this device has open now.
        const open = ctx.getActiveChat()?.chatId || null;
        if (open !== helloFor) sayHello();
        try { decorate(); } catch { /* the chat redraws freely */ }
    });
};
function sayHello() {
    helloFor = ctx.getActiveChat()?.chatId || null;
    if (helloFor !== chatId) { state = null; chatId = helloFor; render(); }
    startLatest = ctx.messages?.getLatestMessageId?.() || null;
    ctx.sendToBackend({ type: 'rpc', id: 0, op: 'hello', args: { chatId: helloFor } });
}

async function toggleEdit(messageId) {
    try {
        const r = await call('toggleEdit', { messageId });
        if (r === 'original') notice('Original reply restored.');
        else if (r === 'fixed') notice('Fixes re-applied.');
        else if (r === 'changed') notice('This message was changed after it was fixed, so it can’t be toggled.', { kind: 'warn' });
    } catch (err) { notice(err.message, { kind: 'warn' }); }
}

// ------------------------------------------------------------------ the views behind the bars

const liveViews = new Set();    // { kind, render } while a view is open
const refreshViews = () => { for (const v of liveViews) v.render(); };

/** A face's `open` (a name, from the backend) as the tap that opens their picture. */
function withOpeners(data) {
    const walk = x => {
        if (Array.isArray(x)) return x.forEach(walk);
        if (!x || typeof x !== 'object') return;
        if (x.face?.open && typeof x.face.open === 'string') { const name = x.face.open; const kind = x.kind || 'idle'; x.face.open = () => openPicture(name, kind); }
        for (const v of Object.values(x)) if (v && typeof v === 'object' && v !== x.face) walk(v);
    };
    walk(data);
    return data;
}
/** A view's save: the backend's true, or its reason shown as a warning (and the form stays open). */
const saved = async p => {
    try {
        const r = await p;
        if (r === true || (r && typeof r === 'object' && !r.error)) return true;
        notice(typeof r === 'string' ? r : r?.error || 'Not saved.', { kind: 'warn' });
    } catch (err) { notice(err.message, { kind: 'warn' }); }
    return false;
};

function showView(kind, title, make) {
    if (!state?.chatId) { notice('Open a chat first.'); return; }
    const m = modal(title);
    const view = {
        kind,
        render: () => { if (!m.root.find('.wh-dos-editing').length) draw(); },
    };
    const draw = () => m.root.empty().append(make(view));
    draw();
    liveViews.add(view);
    m.onClose(() => liveViews.delete(view));
}

function openLedgerView() {
    showView('ledger', 'Body Ledger', view => ledgerView(withOpeners(structuredClone(state.views.ledger)), {
        saveBody: (i, orig, { row, sheet }) => saved(call('saveBody', { orig, row, sheet })),
        removeBody: async (i, orig) => (await confirmIt(`Take ${orig.body || orig.driver} out of the Ledger?`, '', 'Remove') ? saved(call('removeBody', { orig })) : false),
        saveSheet: (name, values) => saved(call('saveSheet', { name, values })),
        deleteSheet: async name => (await confirmIt(`Delete ${name}'s sheet?`, '', 'Delete') ? saved(call('deleteSheet', { name })) : false),
        writeSheet: name => call('writeSheet', { name }).catch(err => notice(err.message, { kind: 'warn' })),
        makePersona,
        savePower: (i, v) => (v === null ? confirmIt('Remove this power?', '', 'Remove').then(ok => (ok ? saved(call('saveListItem', { list: 'powers', i, value: null })) : false)) : saved(call('saveListItem', { list: 'powers', i, value: v }))),
        saveAlias: (i, v) => (v === null ? confirmIt('Remove these names?', '', 'Remove').then(ok => (ok ? saved(call('saveListItem', { list: 'aliases', i, value: null })) : false)) : saved(call('saveListItem', { list: 'aliases', i, value: v }))),
        drawMissing,
        refresh: () => view.render(),
    }));
}
function openMindView() {
    showView('mind', 'Mind Book', view => mindView(withOpeners(structuredClone(state.views.mind)), {
        save: (kind, i, raw, values) => saved(call('saveMind', { kind, raw, values })),
        remove: async (kind, i, raw) => (await confirmIt('Take this out of the Mind Book?', '', 'Remove') ? saved(call('removeMind', { kind, raw })) : false),
        drawMissing,
        refresh: () => view.render(),
    }));
}
async function openPicture(name, kind = 'idle') {
    if (!state?.chatId) return;
    const m = modal(name, { width: 520 });
    let alive = true;
    const actions = {
        draw: () => call('draw', { name }).catch(err => notice(err.message, { kind: 'warn' })),
        upload: () => uploadPicture(name),
        remove: async () => { if (await confirmIt(`Remove ${name}'s picture?`, '', 'Remove')) await call('removePicture', { name }); },
        editLook: async () => {
            const look = m.root.find('.wh-dos-look span:not(.wh-dos-label):not(.wh-dos-faint)').first().text();
            const text = await ask(`How ${name} looks, for their picture`, { value: look, rows: 4 });
            if (text !== null) await saved(call('saveLook', { name, text }));
        },
    };
    // A picture view follows its person: it's fetched again whenever the chat's state changes.
    const draw = async () => {
        let data;
        try { data = await call('pictureView', { name, kind }); } catch { return; }
        if (alive) m.root.empty().append(pictureView(data, actions));
    };
    const view = { kind: 'picture', render: draw };
    liveViews.add(view);
    m.onClose(() => { alive = false; liveViews.delete(view); });
    await draw();
}

async function drawMissing(names) {
    try {
        const r = await call('drawMissing', { names });
        if (r?.drawn === r?.total) notice(`Drew ${r.drawn} picture${r.drawn > 1 ? 's' : ''}.`);
        else if (r) notice(`Drew ${r.drawn} of ${r.total} pictures. ${state?.status?.ledger || ''}`, { kind: 'warn' });
    } catch (err) { notice(err.message, { kind: 'warn' }); }
}

/** A picture of your own, from a file. */
async function uploadPicture(name) {
    let files;
    try { files = await ctx.uploads.pickFile({ accept: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], maxSizeBytes: 15 * 1024 * 1024 }); } catch (err) { notice(err.message, { kind: 'warn' }); return; }
    const f = files?.[0];
    if (!f) return;
    let bin = '';
    const bytes = f.bytes;
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    await saved(call('usePicture', { name, dataUrl: `data:${f.mimeType || 'image/png'};base64,${btoa(bin)}` }));
}

/** A Lumiverse persona from a host's sheet and picture, to play as in this chat or any other. */
async function makePersona(name) {
    const draft = await call('personaDraft', { name });
    if (!draft) return;
    const note = `A persona you can pick in Personas, for this chat or any other${draft.picture ? ', with their picture' : ''}. Change the description first if you like.${draft.existing ? ` You already have a persona named ${name}; this makes another.` : ''}`;
    const text = await ask(`Make a persona: ${name}`, { value: draft.text, rows: 8, ok: 'Make it', note });
    if (!text?.trim()) return;
    try {
        const r = await call('makePersona', { name, description: text });
        if (r?.error) { notice(r.error, { kind: 'warn' }); return; }
        if (r?.image && r.personaId) {
            try {
                const blob = await (await fetch(`/api/v1/images/${encodeURIComponent(r.image)}`, { credentials: 'include' })).blob();
                const form = new FormData();
                form.append('avatar', blob, `${name}.png`);
                await fetch(`/api/v1/personas/${encodeURIComponent(r.personaId)}/avatar`, { method: 'POST', body: form, credentials: 'include' });
            } catch { /* the persona is there; the picture can be added by hand */ }
        }
        notice(`Persona made: ${name}. It's in Personas.`);
    } catch (err) { notice(`Couldn't make the persona: ${err.message}`, { kind: 'warn' }); }
}

// ------------------------------------------------------------------ Check card

function doctorList(issues) {
    const list = $('<div class="wh-doctor"></div>');
    if (!issues.length) return list.append($('<div class="wh-doctor-ok"></div>').append(svg('check'), 'No problems found.'));
    for (const i of issues) {
        list.append($(`<details class="wh-doctor-item wh-${i.level}"></details>`).append(
            $('<summary></summary>').append(svg(i.level === 'warn' ? 'triangle-exclamation' : 'circle-info'), $('<span></span>').text(i.title)),
            $('<div class="wh-doctor-detail"></div>').append(i.quote ? $('<q></q>').text(i.quote) : '', $('<div></div>').text(i.detail))));
    }
    return list;
}

async function checkCard(characterId) {
    let r;
    try { r = await call('checkCard', { characterId }); } catch (err) { notice(err.message, { kind: 'warn' }); return; }
    if (r?.error) { notice(r.error, { kind: 'warn' }); return; }
    const m = modal(`Check card · ${r.name}`, { width: 760 });
    const root = $('<div class="wh-cardtool"></div>');
    root.append($('<div class="wh-muted"></div>').text(`${r.always} tokens every reply · ${r.greetings} greeting${r.greetings === 1 ? '' : 's'} · modes: ${r.modes.join(', ') || 'none'}`));
    root.append(doctorList(r.issues));
    const btn = $('<button type="button" class="menu_button wh-card-review"></button>').append(svg('magnifying-glass'), $('<span>Deeper review</span>'))
        .attr('title', 'Your notes model reads the whole card against the Codex (one request, usually under a minute)');
    const out = $('<div class="wh-card-review-out"></div>');
    let running = false, ticker = null;
    btn.on('click', async () => {
        if (running) { call('cancelReview', { characterId }); return; }
        running = true;
        const t0 = Date.now();
        const label = btn.find('span');
        const tick = () => label.text(`Reviewing… ${Math.round((Date.now() - t0) / 1000)} s · tap to cancel`);
        tick();
        ticker = setInterval(tick, 1000);
        btn.find('svg').replaceWith(svg('spinner', 'wh-spin'));
        out.html('<small class="wh-muted">A thorough read usually takes under a minute.</small>');
        try {
            const res = await call('review', { characterId });
            if (res?.error) out.text(res.error);
            else out.html($('<div></div>').text(res.text).html().replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'));
        } catch (err) { out.text(`Couldn't run the review: ${err.message}`); } finally {
            clearInterval(ticker);
            running = false;
            label.text('Deeper review');
            btn.find('svg').replaceWith(svg('magnifying-glass'));
        }
    });
    m.onClose(() => { if (running) call('cancelReview', { characterId }); clearInterval(ticker); });
    m.root.append(root.append(btn, out));
}

// ------------------------------------------------------------------ the character editor's Worldhopper tab

function setupCharacterTab() {
    let ct;
    try { ct = ctx.ui.registerCharacterEditorTab({ id: 'worldhopper', title: 'Worldhopper' }); } catch { return; }
    const draw = () => {
        const s = ctx.ui.characterEditor.getState();
        const root = $(ct.root).empty();
        const box = $('<div class="wh-ui wh-panel"></div>').appendTo(root);
        if (!s?.characterId) { box.append('<div class="wh-empty">Open a character to pick its modes.</div>'); return; }
        const wh = s.extensions?.worldhopper || {};
        const picked = new Set(Array.isArray(wh.modes) ? wh.modes : []);
        box.append($('<div class="wh-head"></div>').append($('<span class="wh-title"></span>').append(svg('shapes'), 'Metaphysics modes')));
        box.append($('<div class="wh-empty"></div>').text('The Worldhopper Codex rules this character uses. Saved on the card, so they travel with it.'));
        if (wh.tool) box.append($('<div class="wh-warning"></div>').text('This is a card builder: it has no modes of its own.'));
        box.append(modePicker(picked, {
            onChange: modes => ctx.ui.characterEditor.updateExtensions(ext => ({ ...ext, worldhopper: { ...(ext?.worldhopper || {}), modes } })),
        }));
        box.append($('<div class="wh-tools" style="justify-content:flex-start;margin-top:10px"></div>').append(
            $('<button type="button" class="menu_button"></button>').append(svg('stethoscope'), 'Check card').on('click', async () => { await ctx.ui.characterEditor.flush?.(); checkCard(s.characterId); }),
        ));
    };
    ct.onActivate(draw);
    ctx.ui.characterEditor.onChange(s => { if (s.activeTabId === ct.tabId || s.open) draw(); });
    draw();
}

// ------------------------------------------------------------------ setup

function render() {
    renderPanel();
    renderDocks();
    renderRoster();
    queueDecorate();
    refreshViews();
}

export function setup(context) {
    ctx = context;
    const removeStyle = ctx.dom.addStyle(css + TOAST_CSS);
    tab = ctx.ui.registerDrawerTab({
        id: 'worldhopper',
        title: 'Worldhopper',
        shortName: 'Worldhopper',
        description: 'Metaphysics modes, the Body Ledger and the Mind Book',
        keywords: ['worldhopper', 'possession', 'ledger', 'mind book', 'codex', 'modes'],
        iconSvg: ICON_SVG('hurricane'),
    });
    $(tab.root).addClass('wh-ui');
    try { dock = ctx.ui.mount('chat_top_dock'); } catch { dock = null; }
    try { composer = ctx.ui.mount('chat_composer_above'); } catch { composer = null; }
    setupCharacterTab();

    ctx.onBackendMessage(p => {
        if (!p || typeof p !== 'object') return;
        if (p.type === 'rpc') {
            const w = pending.get(p.id);
            if (!w) return;
            pending.delete(p.id);
            clearTimeout(w.timer);
            p.ok ? w.resolve(p.value) : w.reject(new Error(p.error || 'failed'));
        } else if (p.type === 'state') {
            // Another device's chat: not ours to draw.
            const mine = ctx.getActiveChat()?.chatId || null;
            if (p.chatId !== mine) return;
            if (p.chatId !== chatId) { pickerOpen = null; shownBlurb = null; openRows.clear(); }
            state = p;
            chatId = p.chatId;
            render();
        } else if (p.type === 'suggested' && p.chatId === chatId) {
            notice(`Suggested modes for ${p.label}: ${p.modes.join(', ')}.`, { timeout: 20000, action: { label: 'Apply', run: () => call('applySuggestion') } });
        } else if (p.type === 'command') {
            if (p.id === 'wh_ledger') openLedgerView();
            else if (p.id === 'wh_mind') openMindView();
            else if (p.id === 'wh_modes') { pickerOpen = true; tab.activate(); renderPanel(); }
            else if (p.id === 'wh_check_card') { if (state?.target?.characterId) checkCard(state.target.characterId); else notice('Open a chat with a character first.'); }
        }
    });

    // The open chat, now and whenever it changes (decorate notices a switch).
    sayHello();
    // For working on Worldhopper: localStorage "wh-dev" set gives the console its requests and state.
    try { if (localStorage.getItem('wh-dev')) globalThis.__wh = { call, state: () => state }; } catch { /* storage blocked */ }

    // Messages redraw freely (and leave the screen as you scroll): put badges, ⟲ and colors back whenever they do.
    const observer = new MutationObserver(queueDecorate);
    observer.observe(document.body, { childList: true, subtree: true });
    const onInput = e => { if (e.target?.matches?.('[data-component="InputArea"] textarea')) markLanes(); };
    for (const ev of ['input', 'click', 'keyup', 'focusin']) document.addEventListener(ev, onInput, true);

    return () => {
        observer.disconnect();
        for (const ev of ['input', 'click', 'keyup', 'focusin']) document.removeEventListener(ev, onInput, true);
        removeStyle();
        document.querySelectorAll('.wh-as, .wh-undo, #wh_toasts').forEach(el => el.remove());
        ctx.dom.cleanup?.();
    };
}
