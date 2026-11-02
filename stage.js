// Worldhopper Engine — Stage mode: an optional look for the whole of SillyTavern (stage.css, everything under
// body.wh-stage) and, in a story with bodies, the band at the top of the chat: the bodies strip, which pulls down into
// the Board. The Board shows where everyone is (board-core.js), a rider's face on the body they're in and a line from
// the rider's own body to it; drag a face to another place to correct where they are, tap it for their card. index.js
// gathers the data and does the saving. jQuery is SillyTavern's $.
import { quoteRanges } from './speech-core.js';
import { dragElement } from '../../../RossAscends-mods.js';
import { loadMovingUIState, power_user } from '../../../power-user.js';

// Moonlit Echoes' chat styles that rebuild messages around big pictures. Stage is a chat style of its own, so these step
// aside while it's on and come back when it's off; Moonlit Echoes' colors, fonts and sizes carry on underneath.
const ME_STYLES = ['echostyle', 'whisperstyle', 'hushstyle', 'ripplestyle', 'tidestyle'];
let stashed = '';
let watcher = null;

/** Stage mode on or off for the whole page. */
export function applyStageLook(on) {
    const body = document.body;
    body.classList.toggle('wh-stage', on);
    let glow = document.getElementById('wh_stage_glow');
    if (on && !glow) {
        glow = document.createElement('div');
        glow.id = 'wh_stage_glow';
        glow.setAttribute('aria-hidden', 'true');
        body.prepend(glow);
    }
    if (!on) glow?.remove();
    const claim = () => {
        for (const c of ME_STYLES) if (body.classList.contains(c)) { stashed = c; body.classList.remove(c); }
    };
    if (on) {
        claim();
        // Picking another chat style while Stage is on: it's kept for when Stage goes off.
        if (!watcher) { watcher = new MutationObserver(claim); watcher.observe(body, { attributes: true, attributeFilter: ['class'] }); }
    } else {
        watcher?.disconnect();
        watcher = null;
        if (stashed) { body.classList.add(stashed); stashed = ''; }
    }
}

const reduced = () => document.body.classList.contains('reduced-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls = '', text) => {
    const e = $(document.createElement(tag));
    if (cls) e.addClass(cls);
    if (text != null) e.text(text);
    return e;
};
const fa = name => $(`<i class="fa-solid ${name}" aria-hidden="true"></i>`);
const initial = name => String(name || '?').trim().charAt(0).toUpperCase() || '?';
const press = (node, fn) => node.attr({ role: 'button', tabindex: 0 }).on('click keydown', e => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    fn();
});

// ------------------------------------------------------------------ the band
let pulledAt = 0;
/** The band was just pulled (so the click that ends the pull doesn't also toggle it). */
export const justPulled = () => Date.now() - pulledAt < 400;

/**
 * Pull the band down to open the Board, push it (or the Board's grab bar) up to tuck it away. Works the same with a
 * mouse and a thumb; a tap does the same through the band's own click handler.
 */
export function bindPull(node, { isOpen, setOpen }) {
    let start = null;
    node.on('pointerdown', e => {
        if (e.button) return;
        start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    node.on('pointermove', e => {
        if (!start || e.pointerId !== start.id) return;
        const dy = e.clientY - start.y;
        if (Math.abs(dy) < 22 || Math.abs(dy) < Math.abs(e.clientX - start.x)) return;
        start = null;
        pulledAt = Date.now();
        if (dy > 0 && !isOpen()) setOpen(true);
        else if (dy < 0 && isOpen()) setOpen(false);
    });
    node.on('pointerup pointercancel', () => { start = null; });
}

// ------------------------------------------------------------------ the Board

function face(name, image, cls = 'whs-pic') {
    const f = el('span', cls);
    if (image) f.append($('<img alt="" loading="lazy" draggable="false">').attr('src', image));
    else f.text(initial(name));
    return f;
}

function person(p, d) {
    const showRide = p.rider && (!p.rider.hidden || d.showHidden);
    const marks = el('span', 'whs-marks').append((d.marks.get(p.key) || []).map(m => el('span', 'whs-mark').attr('title', m.title).append(fa(m.icon))));
    if (p.hidden && d.showHidden) marks.append(el('span', 'whs-mark whs-hid').attr({ title: 'Hidden from you', 'aria-label': 'Hidden from you' }).append(fa('fa-eye-slash')));
    const f = el('span', 'whs-face').append(face(p.name, d.faces.get(p.key)), marks);
    if (showRide) {
        f.append(face(p.rider.name, d.faces.get(p.rider.key), `whs-rider ${p.rider.you ? 'whs-you' : 'whs-npc'}${p.rider.hidden ? ' whs-hidden' : ''}`)
            .attr('title', p.rider.you ? "You're inside" : `${p.rider.name} inside`));
    }
    // What's under the name: where in the place they are, else what's going on with them (a hidden ride only shown
    // while hidden rides are).
    const sub = p.spot || (p.hidden && !d.showHidden ? '' : p.status);
    const tip = [p.name, p.hidden && !d.showHidden ? '' : p.status, p.where].filter(Boolean).join(' · ');
    const yours = p.kind === 'you';
    return el('div', `whs-person whs-k-${p.kind}${p.hidden && d.showHidden ? ' whs-hidden' : ''}`)
        .attr({ 'data-key': p.key, 'data-name': p.name, 'data-yours': yours ? '1' : '', role: 'button', tabindex: 0,
            title: `${tip}\nTap for their card · ${yours ? 'drag to go somewhere (written into your message)' : 'drag to correct where the notes have them'}` })
        .append(f, el('b', '', p.name), sub ? el('small', '', sub) : '');
}

function place(g, d) {
    const here = g.people.some(p => p.kind === 'you');
    return el('section', `whs-place${here ? ' whs-here' : ''}`).attr('data-place', g.where).append(
        el('header').append(fa('fa-location-dot'), el('span', '', g.name), el('small', '', String(g.people.length))),
        el('div', 'whs-cast').append(g.people.map(p => person(p, d))));
}

/**
 * Draw the Board into host (emptied first).
 * d: boardOf() plus faces (key → image), marks (key → [{ icon, title }]), clock, showHidden.
 * a: open(key, name), move(name, place, yours) ('' for "not placed"; yours: a body you're in), newPlace(name, yours),
 *   toggleHidden(), openLedger(), stageOff(), close().
 */
export function renderBoard(host, d, a) {
    const head = el('div', 'whs-board-head').append(
        el('span', 'whs-board-title').append(fa('fa-map-location-dot'), document.createTextNode(' Board')),
        d.clock ? el('span', 'whs-clock').attr('title', "The story's day and time").append(fa('fa-clock'), document.createTextNode(` ${d.clock}`)) : '',
        el('span', 'whs-spacer'),
        d.hidden ? press(el('span', `whs-head-btn${d.showHidden ? ' whs-on' : ''}`).attr('title', d.showHidden ? 'Hide the rides kept from you' : 'Show the rides kept from you')
            .append(fa(d.showHidden ? 'fa-eye' : 'fa-eye-slash')), a.toggleHidden) : '',
        press(el('span', 'whs-head-btn').attr('title', 'Open the Body Ledger').append(fa('fa-people-arrows')), a.openLedger),
        press(el('span', 'whs-head-btn').attr('title', 'Leave Stage mode').append(fa('fa-masks-theater')), a.stageOff),
        press(el('span', 'whs-head-btn').attr('title', 'Tuck the Board away').append(fa('fa-chevron-up')), a.close));
    const body = el('div', 'whs-board-body');
    const places = el('div', 'whs-places');
    places.append(d.places.map(g => place(g, d)));
    if (d.unplaced.length) {
        places.append(el('section', 'whs-place whs-unplaced').attr('data-place', '').append(
            el('header').append(fa('fa-circle-question'), el('span', '', 'Not placed yet'), el('small', '', String(d.unplaced.length))),
            el('div', 'whs-cast').append(d.unplaced.map(p => person(p, d)))));
    }
    if (!d.places.length && !d.unplaced.length) body.append(el('div', 'whs-empty', 'Nobody to place yet. Everyone the story is using shows up here.'));
    else body.append(places, $(document.createElementNS('http://www.w3.org/2000/svg', 'svg')).addClass('whs-lines').attr('aria-hidden', 'true'));
    const foot = el('div', 'whs-board-foot').append(
        d.places.length ? el('span', 'whs-hint').append(el('span', 'whs-hint-long', 'Drag your body to go somewhere · drag anyone else to correct the notes · tap for a card'),
            el('span', 'whs-hint-short', 'Drag yours to go · others to correct · tap for a card'))
            : el('span', 'whs-hint', 'The World notes haven\'t placed anyone yet: drag a face here to give them a place.'),
        el('div', 'whs-newplace').attr('data-new', '1').append(fa('fa-plus'), el('span', '', 'New place')));
    const grab = el('div', 'whs-grab').attr({ title: 'Push up to tuck the Board away', role: 'button', tabindex: 0, 'aria-label': 'Tuck the Board away' });
    host.empty().append(head, body, foot, grab);
    press(grab, a.close);
    bindPull(grab, { isOpen: () => true, setOpen: v => { if (!v) a.close(); } });
    bindDrag(host, a);
    host.find('.whs-person').on('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        a.open(this.dataset.key, this.dataset.name);
    });
    const draw = () => drawLines(body, d);
    requestAnimationFrame(draw);
    // Pictures load late, and the Board resizes with the window: the lines follow.
    host.find('img').on('load', draw);
    host.data('whsResize')?.disconnect();
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => requestAnimationFrame(draw));
        ro.observe(body[0]);
        host.data('whsResize', ro);
    }
}

/**
 * A line from each rider's own body to the body they're in: an arc between the two faces' centers, drawn behind the
 * faces so names stay clear, dashed when the ride is hidden.
 */
function drawLines(body, d) {
    const svg = body.find('svg.whs-lines')[0];
    if (!svg) return;
    const box = body[0].getBoundingClientRect();
    const places = body.find('.whs-places')[0];
    svg.setAttribute('width', places?.offsetWidth || 0);
    svg.setAttribute('height', places?.offsetHeight || 0);
    svg.innerHTML = '';
    const at = key => {
        const f = body.find(`.whs-person[data-key="${CSS.escape(key)}"] .whs-face`)[0];
        if (!f) return null;
        const r = f.getBoundingClientRect();
        return { x: r.left - box.left + body[0].scrollLeft + r.width / 2, y: r.top - box.top + body[0].scrollTop + r.height / 2 };
    };
    const NS = 'http://www.w3.org/2000/svg';
    const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.appendChild(n); return n; };
    for (const line of d.lines) {
        if (line.hidden && !d.showHidden) continue;
        const a = at(line.from), b = at(line.to);
        if (!a || !b) continue;
        // Bowed upward from the middle, more the further apart they are.
        const bow = 14 + Math.hypot(b.x - a.x, b.y - a.y) * 0.14;
        const path = `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - bow}, ${b.x} ${b.y}`;
        const cls = `${line.you ? 'whs-you' : 'whs-npc'}${line.hidden ? ' whs-hidden' : ''}`;
        add('path', { d: path, class: `whs-line ${cls}` });
        if (!line.hidden && !reduced()) add('path', { d: path, class: `whs-line-flow ${cls}` });
    }
}

/**
 * Faces move between places by dragging: a mouse starts as soon as it moves, a finger too (faces don't scroll the
 * Board; the gaps between them do). Letting go over a place moves them there, over New place asks for its name, over
 * Not placed yet clears where they are. A tap without a drag opens their card.
 */
function bindDrag(host, a) {
    host.off('pointerdown.whs').on('pointerdown.whs', '.whs-person', function (e) {
        if (e.button) return;
        const node = this;
        const sx = e.clientX, sy = e.clientY;
        let ghost = null, over = null;
        try { node.setPointerCapture(e.pointerId); } catch { /* not every browser hands over capture */ }
        const move = ev => {
            if (!ghost) {
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
                ghost = el('div', 'whs-ghost').append($(node).find('.whs-pic').first().clone()).appendTo(document.body)[0];
                node.classList.add('whs-lifted');
                host.addClass('whs-dragging');
            }
            ghost.style.transform = `translate(${ev.clientX - 28}px, ${ev.clientY - 28}px)`;
            const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#wh_stage_board .whs-place, #wh_stage_board .whs-newplace') || null;
            if (target !== over) { over?.classList.remove('whs-drop'); over = target; over?.classList.add('whs-drop'); }
        };
        const end = ev => {
            node.removeEventListener('pointermove', move);
            node.removeEventListener('pointerup', end);
            node.removeEventListener('pointercancel', end);
            if (!ghost) { if (ev.type === 'pointerup') a.open(node.dataset.key, node.dataset.name); return; }
            ghost.remove();
            node.classList.remove('whs-lifted');
            host.removeClass('whs-dragging');
            over?.classList.remove('whs-drop');
            if (ev.type !== 'pointerup' || !over) return;
            const from = node.closest('.whs-place')?.dataset.place ?? '';
            const yours = node.dataset.yours === '1';
            if (over.dataset.new) a.newPlace(node.dataset.name, yours);
            else if (over.dataset.place !== from) a.move(node.dataset.name, over.dataset.place, yours);
        };
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', end);
        node.addEventListener('pointercancel', end);
    });
}

// ------------------------------------------------------------------ the chat: narration on the page, lines with faces
// A reply's paragraphs with someone's words in them become that person's lines, with their picture and name (the
// Engine's picture, their card's avatar, or your persona's), the way the story itself tells who's talking; the rest
// stays narration. Your own messages show the body you're in, with your face small on it. Nothing in the chat is
// changed: this is only how SillyTavern's drawing of it looks, and it's put back as it was when Stage mode goes off.
const originals = new WeakMap();   // each reply's text as SillyTavern drew it

/** A paragraph's plain text and where the words in it are, from SillyTavern's <q> marks (else the quote marks). */
export function readParagraph(p) {
    let text = '';
    const quotes = [];
    const walk = n => {
        for (const c of n.childNodes) {
            if (c.nodeType === 3) text += c.nodeValue;
            else if (c.nodeType === 1 && c.tagName === 'Q') { const a = text.length; walk(c); quotes.push([a, text.length]); }
            else if (c.nodeType === 1) walk(c);
        }
    };
    walk(p);
    return { text, quotes: quotes.length ? quotes : quoteRanges(text) };
}

/** A reply's paragraphs (the <p>s right under its text), or none while it's being edited. */
export function replyParagraphs(mes) {
    const text = mes.querySelector('.mes_text');
    if (!text || text.querySelector('textarea')) return [];
    return [...text.children].filter(c => c.tagName === 'P');
}

/** The reply is drawn as lines already, for this version of it (sig). */
export const isStaged = (mes, sig) => {
    const text = mes.querySelector('.mes_text');
    return !!text?.querySelector(':scope > .whs-staged') && text.dataset.whsSig === sig;
};

/**
 * Draw a reply as narration and lines. lines: [{ p, name, image, kind ('npc' when someone rides them, else 'plain'),
 * rider: { name, image, you, hidden } | null, cont (the same person as the line before) }], each p one of
 * replyParagraphs(mes). A face is tapped for a closer look (the caller's handler, on data-whs-face).
 */
export function stageReply(mes, lines, sig) {
    const text = mes.querySelector('.mes_text');
    if (!text) return;
    originals.set(text, text.innerHTML);
    for (const l of lines) {
        const f = el('span', 'whs-say-face').attr({ 'data-whs-face': l.name, role: 'button', tabindex: 0, title: `${l.name}: tap for a closer look` }).append(face(l.name, l.image));
        if (l.rider) {
            f.append(face(l.rider.name, l.rider.image, `whs-rider ${l.rider.you ? 'whs-you' : 'whs-npc'}${l.rider.hidden ? ' whs-hidden' : ''}`)
                .attr({ title: `${l.rider.name} inside`, 'data-whs-face': l.rider.name }));
        }
        const bubble = el('div', 'whs-say-bubble').append(el('b', 'whs-say-name', l.name));
        // A run of one person's paragraphs reads as one: the face and name only on the first.
        const line = el('div', `whs-say whs-say-${l.kind}${l.cont ? ' whs-cont' : ''}`).attr('data-who', l.name).append(f, bubble);
        l.p.replaceWith(line[0]);
        bubble.append(l.p);
    }
    text.dataset.whsSig = sig;
    text.appendChild(el('span', 'whs-staged').attr('hidden', '')[0]);
}

/**
 * Where a reply happens, at its head: the place from the World notes, in place of the card's name (the people in the
 * reply carry their own names and faces on their lines, so the card's name over all of it was someone else's). Not
 * placed yet, the head has the time alone.
 */
export function stageWhere(mes, place) {
    mes.querySelectorAll('.whs-where, .whs-mid').forEach(n => n.remove());
    mes.classList.add('whs-head');
    mes.classList.toggle('whs-placed', !!place);
    // The number and timing that sat under the card's picture, beside the time instead (as SillyTavern shows them).
    const shown = n => n && getComputedStyle(n).visibility !== 'hidden' && !document.body.classList.contains(n.classList.contains('mesIDDisplay') ? 'no-mesIDDisplay' : 'no-timer');
    const id = mes.querySelector('.mesAvatarWrapper .mesIDDisplay');
    const timer = mes.querySelector('.mesAvatarWrapper .mes_timer');
    const meta = [shown(id) ? id.textContent.trim() : '', shown(timer) ? timer.textContent.trim() : ''].filter(Boolean).join(' · ');
    const time = mes.querySelector('.ch_name .timestamp');
    if (meta && time) time.after(el('span', 'whs-mid', meta)[0]);
    const name = mes.querySelector('.name_text');
    if (!name || !place) return;
    name.after(el('span', 'whs-where').attr('title', 'Where this happens, from the World notes').append(fa('fa-location-dot'), document.createTextNode(` ${place}`))[0]);
}

/**
 * A picture shown big, the way SillyTavern shows a card's picture when its avatar is tapped: its own window, moved by
 * the grip and closed by ✕, and the same face tapped again closes it.
 */
export function zoomPicture(name, src) {
    const key = `whs_${String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_')}`;
    const open = $(`.zoomed_avatar[forChar="${key}"]`);
    if (open.length) { open.fadeOut(125, () => open.remove()); return; }
    // One at a time unless windows can be moved around (as SillyTavern does it).
    if (!power_user.movingUI) $('.zoomed_avatar[forChar]').remove();
    const node = $($('#zoomed_avatar_template').html()).attr({ forChar: key, id: `zoomFor_${key}` }).addClass('draggable');
    node.find('.drag-grabber').attr('id', `zoomFor_${key}header`);
    node.find('img').attr({ src, 'data-izoomify-url': src, alt: name }).on('dragstart', e => e.preventDefault());
    $('body').append(node);
    node.fadeIn(125);
    loadMovingUIState();
    node.css('display', 'flex');
    dragElement(node);
    if (power_user.zoomed_avatar_magnification) node.find('.zoomed_avatar_container').izoomify?.();
    node.on('click touchend', e => { if (e.target.closest('.dragClose')) node.fadeOut(125, () => node.remove()); });
}

/** Put a reply back as SillyTavern drew it, and your avatar back as it was. */
export function unstage(mes) {
    mes.querySelectorAll('.whs-where, .whs-mid, .whs-scene, .whs-lane-face').forEach(n => n.remove());
    mes.classList.remove('whs-head', 'whs-placed');
    const text = mes.querySelector('.mes_text');
    if (text?.querySelector(':scope > .whs-staged') && originals.has(text)) text.innerHTML = originals.get(text);
    if (text) delete text.dataset.whsSig;
    const img = mes.querySelector('.avatar img[data-whs-src]');
    if (img) { img.setAttribute('src', img.dataset.whsSrc); img.removeAttribute('data-whs-src'); }
    mes.querySelector('.avatar .whs-av-rider')?.remove();
}

/** Your message, in Stage mode: the avatar is the body you were in, your own face small on it (body null: as it was). */
export function stageUser(mes, body) {
    const img = mes.querySelector('.avatar img');
    if (!img) return;
    const want = body?.image || '';
    if (!want) { unstage(mes); return; }
    if (img.dataset.whsSrc == null) img.dataset.whsSrc = img.getAttribute('src') || '';
    if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    const av = img.closest('.avatar');
    let inset = av.querySelector('.whs-av-rider');
    if (!inset) inset = av.appendChild(el('span', 'whs-av-rider')[0]);
    $(inset).empty().append(face(body.you, img.dataset.whsSrc, 'whs-pic')).attr('title', `${body.name}, with you inside`);
}

/**
 * A scene break above a reply, for Stage mode: the story's day and time and how long it's been ("Tuesday, 3:40 PM ·
 * an hour later"), or a plain break when only the place changed (the reply's own heading names the place). brk:
 * sceneBreak() (board-core.js), or null for none.
 */
export function stageScene(mes, brk) {
    mes.querySelector(':scope .whs-scene')?.remove();
    if (!brk) return;
    const label = [brk.when, brk.later].filter(Boolean).join(' · ');
    if (brk.opening && !label) return;   // the opening scene with no time to tell: the heading's place is enough
    const block = mes.querySelector('.mes_block');
    if (!block) return;
    block.prepend(el('div', `whs-scene${brk.opening ? ' whs-opening' : ''}`).attr({ role: 'separator', title: brk.moved ? 'The scene moves' : 'Time passes' })
        .append(el('span', 'whs-scene-rule'), el('span', 'whs-scene-label').append(fa(brk.opening ? 'fa-clapperboard' : brk.moved ? 'fa-shoe-prints' : 'fa-hourglass-half'),
            label ? document.createTextNode(` ${label}`) : ''), el('span', 'whs-scene-rule'))[0]);
}

/**
 * Who a moment happened to, on its card: a possession, swap or worn moment gets the rides the reply began ("Sam → Jen",
 * with faces), a release the rides it ended ("Sam ⟵ Kayla"), in the order the cards come. Part of staging a reply
 * (call before stageReply's marker goes in, so it's undone with the rest). moments: { began, ended } with faces:
 * [{ rider, body, riderImage, bodyImage, you, hidden }].
 */
export function stageMoments(mes, { began = [], ended = [] } = {}) {
    const text = mes.querySelector('.mes_text');
    if (!text) return;
    const pill = (r, out) => el('span', `whs-moment-cast${r.you ? ' whs-you' : ''}${r.hidden ? ' whs-hidden' : ''}`)
        .attr('title', out ? `${r.rider} leaves ${r.body}` : `${r.rider} in ${r.body}`)
        .append(face(r.rider, r.riderImage, 'whs-pic'), el('span', 'whs-mc-name', r.rider), fa(out ? 'fa-arrow-left-long' : 'fa-arrow-right-long'),
            face(r.body, r.bodyImage, 'whs-pic'), el('span', 'whs-mc-name', r.body));
    const into = [...text.querySelectorAll('.custom-wh-possess, .custom-wh-m-swap, .custom-wh-m-worn, .custom-wh-m-absorbed')];
    const outOf = [...text.querySelectorAll('.custom-wh-release, .custom-wh-m-shed')];
    const deal = (boxes, rides, out) => {
        if (!boxes.length || !rides.length) return;
        // One card per ride when the counts match; otherwise they all go on the first.
        const each = boxes.length === rides.length;
        rides.forEach((r, i) => {
            const box = each ? boxes[i] : boxes[0];
            let row = box.querySelector(':scope > .whs-moment-row');
            if (!row) row = box.insertBefore(el('div', 'whs-moment-row')[0], box.firstChild);
            row.appendChild(pill(r, out)[0]);
        });
    };
    deal(into, began, false);
    deal(outOf, ended, true);
}

/** Your lines for one body ([Kayla] …, while you run several): that body's face in its name. bodies: name → image. */
export function stageLanes(mes, faces) {
    for (const tag of mes.querySelectorAll('.mes_text .custom-wh-lane-name')) {
        tag.querySelector('.whs-lane-face')?.remove();
        const name = tag.textContent.trim();
        tag.prepend(face(name, faces(name), 'whs-pic whs-lane-face')[0]);
    }
}

// ------------------------------------------------------------------ sheets
// In Stage mode the Body Ledger and the Mind Book open as a sheet instead of a popup over the chat: docked at the right,
// in the room beside the chat column, on a wide screen (the chat and the Board stay usable), and up from the bottom on
// a phone, where it's pulled down or tapped away. One sheet at a time, with a tab for each book the chat uses.
let sheet = null;   // { show(kind), close(), done } while one is open

/**
 * Open the sheet on `kind` (or switch the open one to it). tabs: [{ kind, label, icon }]; make(kind, view) draws a
 * book (view: { kind, render, refresh }, the same hooks a popup view gets); live: the set of views kept current.
 * Resolves when the sheet closes.
 */
export function openSheet({ kind, tabs, make, live }) {
    if (sheet) { sheet.show(kind); return sheet.done; }
    const before = document.activeElement;
    const back = el('div', 'whs-sheet-back').attr('aria-hidden', 'true');
    const node = el('div', 'whs-sheet').attr({ id: 'wh_stage_sheet', role: 'dialog', tabindex: -1 });
    const grab = el('div', 'whs-sheet-grab').attr('aria-hidden', 'true');
    const tabsBox = el('div', 'whs-sheet-tabs').attr('role', 'tablist');
    const body = el('div', 'whs-sheet-body');
    const box = el('div', 'wh-dos-wrap');
    body.append(box);
    let view = null, resolve;
    const done = new Promise(r => { resolve = r; });
    const close = () => {
        if (!sheet) return;
        sheet = null;
        if (view) live.delete(view);
        $(document).off('keydown.whsSheet');
        back.remove();
        node.addClass('whs-leaving');
        setTimeout(() => node.remove(), reduced() ? 0 : 200);
        if (before && document.contains(before)) before.focus?.({ preventScroll: true });
        resolve();
    };
    const draw = () => {
        const top = body[0].scrollTop;
        box.empty().append(make(view.kind, view));
        body[0].scrollTop = top;
    };
    const show = k => {
        if (view) live.delete(view);
        view = { kind: k, render: () => { if (!box.find('.wh-dos-editing').length) draw(); }, refresh: draw };
        live.add(view);
        const t = tabs.find(x => x.kind === k) || tabs[0];
        node.attr('aria-label', t.label);
        tabsBox.empty().toggleClass('whs-one', tabs.length < 2).append(tabs.map(x => press(
            el('span', `whs-sheet-tab${x.kind === k ? ' whs-on' : ''}`).attr({ role: 'tab', 'aria-selected': x.kind === k ? 'true' : 'false' })
                .append(fa(x.icon), document.createTextNode(` ${x.label}`)), () => { if (view.kind !== x.kind) show(x.kind); })));
        box.empty().append(make(k, view));
        body[0].scrollTop = 0;
        // A card opened from the Board or the band: bring it into view.
        requestAnimationFrame(() => box.find('.wh-dos-open')[0]?.scrollIntoView({ block: 'nearest' }));
    };
    const x = press(el('span', 'whs-head-btn whs-sheet-x').attr({ title: 'Close', 'aria-label': 'Close' }).append(fa('fa-xmark')), close);
    node.append(grab, el('div', 'whs-sheet-head').append(tabsBox, el('span', 'whs-spacer'), x), body);
    $('body').append(back, node);
    back.on('click', close);
    // Escape closes it, unless you're typing in it or a popup sits over it.
    $(document).on('keydown.whsSheet', e => {
        if (e.key !== 'Escape' || $(e.target).is('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
        close();
    });
    // On a phone: pull the sheet down by its top to put it away.
    let start = null;
    node.on('pointerdown', '.whs-sheet-grab, .whs-sheet-head', e => { start = { y: e.clientY, id: e.pointerId }; });
    node.on('pointermove', e => {
        if (!start || e.pointerId !== start.id) return;
        const dy = e.clientY - start.y;
        if (dy > 0 && window.matchMedia('(max-width: 1000px)').matches) node.css('transform', `translateY(${dy}px)`);
        if (dy > 90) { start = null; close(); }
    });
    node.on('pointerup pointercancel', () => { start = null; node.css('transform', ''); });
    sheet = { show, close, done };
    show(kind);
    node[0].focus({ preventScroll: true });
    return done;
}

/** Put the sheet away, if one is open. */
export function closeSheet() { sheet?.close(); }
