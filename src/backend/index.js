// Worldhopper Engine for Lumiverse — the backend: the prompt interceptor, the events that start the work after a
// reply, and the requests from the panel. See engine.js for the work itself and inject.js for where things go.
import { renderLedger, renderHistory, bodyHistory } from '../core/ledger-core.js';
import { renderMindBook } from '../core/mind-core.js';
import { personaText, personaKey } from '../core/persona-core.js';
import { sp, setUser, user, log, warn, settings, saveSettings, on, loadChat, setPicks, target, copyChatState, forgetCharacter, calls } from './host.js';
import { codexParts, place, fillMacros } from './inject.js';
import * as E from './engine.js';
import * as A from './actions.js';
import * as K from './cards.js';
import { stateFor, pictureViewData } from './viewdata.js';
import { syncDisplayScripts } from './scripts.js';

// The chats open on your devices (from CHAT_SWITCHED and each panel's hello): only they get their state pushed. Each
// device draws only its own chat's.
let current = null;
const watched = new Set();
function watch(chatId) {
    if (!chatId) return;
    watched.delete(chatId);
    watched.add(chatId);
    while (watched.size > 4) watched.delete(watched.values().next().value);
}

// ------------------------------------------------------------------ the panel's state

const pushTimers = new Map();
/** Sends the panel what it shows for a chat (debounced: several changes in a row send once). No chat: all of them. */
function push(chatId) {
    if (!chatId) { for (const id of watched) push(id); return; }
    if (!watched.has(chatId)) return;
    clearTimeout(pushTimers.get(chatId));
    pushTimers.set(chatId, setTimeout(async () => {
        try {
            const [c, s] = await Promise.all([loadChat(chatId), settings()]);
            if (!watched.has(chatId)) return;
            sp.sendToFrontend(stateFor(c, s), user());
        } catch (err) { warn('push', err); }
    }, 60));
}
E.onChange(push);
async function pushNoChat() {
    sp.sendToFrontend(stateFor(null, await settings()), user());
}

// ------------------------------------------------------------------ the prompt

const stickies = new Map();   // chatId → Map(📖 entry title → the story length it stays in until)
const stickyFor = chatId => (stickies.has(chatId) ? stickies.get(chatId) : stickies.set(chatId, new Map()).get(chatId));

/** The sheets renderLedger puts in the prompt: taken bodies' sheets, and hosts back in their own bodies and in the scene. */
function hostSheets(c, ledger, limit) {
    const sheets = new Map();
    for (const b of E.takenBodies(c, ledger)) {
        const e = c.state.personas[personaKey(b.body)];
        if (e?.sheet) sheets.set(personaKey(b.body), personaText(e.sheet));
    }
    return { sheets, back: E.hostsBack(c, ledger, limit).map(e => ({ body: e.body, text: personaText(e.sheet) })) };
}

sp.registerInterceptor(async (messages, ctx) => {
    setUser(ctx?.userId);
    try {
        const s = await settings();
        if (!on(s) || !ctx?.chatId) return messages;
        const chatId = ctx.chatId;
        // A fast reply from you mustn't go out with the previous turn's Ledger: wait for it, briefly.
        if (!ctx.isDryRun) E.noteWait(chatId, await E.waitForLedger(chatId));
        const c = await loadChat(chatId);
        if (!c || !c.modes.length) return messages;
        // A swipe or regenerate rewrites a reply, so the state to write from is the one before it.
        let limit = c.msgs.length;
        if (ctx.excludeMessageId) { const i = c.msgs.findIndex(m => m.id === ctx.excludeMessageId); if (i >= 0) limit = i; }
        const story = c.msgs.slice(0, limit).filter(E.inStory);
        const macros = { user: c.userName, char: c.charName };
        const cx = codexParts(new Set(c.modes), { recent: story.slice(-4).map(m => m.text), count: story.length, sticky: stickyFor(chatId), remember: !ctx.isDryRun });

        let lastUserText = '';
        for (let i = limit - 1; i >= 0; i--) if (c.msgs[i].isUser) { lastUserText = c.msgs[i].text; break; }
        // Who is in the scene: anyone named in the last few messages. Only they get their sheet or full Mind Book entry.
        const scene = c.msgs.slice(Math.max(0, limit - E.SCENE_MESSAGES), limit).filter(E.inStory).map(m => m.text).join('\n');
        const bodies = E.ledgerWanted(s, c);
        const head = bodies ? E.headLedger(c, limit) : null;
        const kinds = E.mindKinds(c);
        const mind = E.mindWanted(s, c) ? E.headMind(c, limit) : null;
        const recent = c.msgs.slice(Math.max(0, limit - 2), limit).filter(E.inStory).map(m => m.text).join('\n');
        const parts = {
            codex: fillMacros(cx.before.join('\n\n'), macros),
            details: fillMacros(cx.details.join('\n\n'), macros),
            anchors: fillMacros(cx.anchors.join('\n\n'), macros),
            ledger: head ? renderLedger(head.ledger, c.userName, { lastUserText, scene, ...hostSheets(c, head.ledger, limit) }) : '',
            history: bodies ? renderHistory(bodyHistory(E.ledgerSnapshots(c, limit)), c.userName) : '',
            mind: mind ? renderMindBook(mind.book, c.userName, { kinds, latest: lastUserText, recent, scene }) : '',
        };
        const out = [...messages];
        const breakdown = place(out, parts, { continuing: ctx.generationType === 'continue' });
        return { messages: out, breakdown };
    } catch (err) {
        warn('interceptor', err);
        return messages;
    }
});

// ------------------------------------------------------------------ events

sp.on('GENERATION_ENDED', (p, uid) => {
    setUser(uid);
    if (!p?.chatId) return;
    if (!p.error && p.messageId && p.generationType !== 'impersonate') E.onReply(p.chatId, p.messageId);
    push(p.chatId);
});
sp.on('MESSAGE_EDITED', (p, uid) => {
    setUser(uid);
    if (p?.message?.id) E.onEdited(p.chatId, p.message.id, p.message.content);
    push(p?.chatId);
});
for (const ev of ['MESSAGE_SENT', 'MESSAGE_SWIPED', 'SWIPE_EDITED', 'MESSAGE_DELETED']) {
    sp.on(ev, (p, uid) => { setUser(uid); push(p?.chatId); });
}
sp.on('CHAT_SWITCHED', (p, uid) => {
    setUser(uid);
    current = p?.chatId || null;
    if (!current) return;
    watch(current);
    push(current);
    opened(current);
});
sp.on('CHARACTER_EDITED', (p, uid) => { setUser(uid); forgetCharacter(p?.id); push(); });
sp.on('CHAT_FORKED', (p, uid) => { setUser(uid); if (p?.sourceChatId && p?.forkedChatId) copyChatState(p.sourceChatId, p.forkedChatId).catch(err => warn('fork', err)); });

/** A chat opened: catch its Ledger up, and suggest modes for a card that has none (once). */
function opened(chatId) {
    E.catchUp(chatId).catch(err => warn('catch up', err));
    E.enqueue(async () => {
        const r = await K.suggestModes(chatId);
        if (r?.modes?.length) sp.sendToFrontend({ type: 'suggested', chatId, modes: r.modes, label: r.label }, user());
    });
}

// ------------------------------------------------------------------ requests from the panel

const OPS = {
    stats: async () => ({ calls }),
    hello: async ({ chatId }) => {
        syncOnce();
        if (!chatId) { await pushNoChat(); return true; }
        const first = !watched.has(chatId);
        current = chatId;
        watch(chatId);
        push(chatId);
        if (first) opened(chatId);
        return true;
    },
    setEnabled: async ({ value }) => {
        const s = await settings();
        s.enabled = !!value;
        await saveSettings();
        push();
        if (s.enabled && current) E.catchUp(current);
        return true;
    },
    setSetting: async ({ group, key, value }) => {
        const s = await settings();
        if (!['ledger', 'pictures'].includes(group) || !(key in s[group])) return 'unknown setting';
        s[group][key] = typeof s[group][key] === 'boolean' ? !!value : String(value ?? '');
        await saveSettings();
        push();
        if (group === 'pictures' && key === 'auto' && value && current) E.ensurePictures(current).catch(err => warn(err));
        if (group === 'ledger' && key === 'enabled' && value && current) E.catchUp(current);
        return true;
    },
    connections: async () => {
        const out = { llm: [], image: [] };
        try { out.llm = (await sp.connections.list(user())).map(c => ({ id: c.id, name: c.name, model: c.model, provider: c.provider })); } catch (err) { warn(err); }
        try { out.image = (await sp.imageGen.listConnections(user())).map(c => ({ id: c.id, name: c.name, provider: c.provider, isDefault: !!c.is_default })); } catch (err) { warn(err); }
        return out;
    },
    models: async ({ connectionId }) => {
        try { return (await sp.connections.getModels?.(connectionId, user()) || []).map(m => ({ id: m.id, name: m.name || m.id })); } catch { return []; }
    },
    setModes: async ({ chatId, modes }) => {
        const c = await loadChat(chatId);
        if (!c || !target(c)) return 'Open a chat first.';
        await setPicks(c, (modes || []).filter(m => typeof m === 'string'));
        push(chatId);
        return true;
    },
    suggest: ({ chatId }) => K.suggestModes(chatId, { force: true }),
    applySuggestion: async ({ chatId }) => {
        const s = await settings();
        const c = await loadChat(chatId);
        const modes = s.suggested[target(c)?.key] || [];
        await setPicks(c, modes);
        push(chatId);
        return modes;
    },
    rebuild: async ({ chatId }) => { E.rebuildLedger(chatId); return true; },
    backfill: async ({ chatId, which }) => { E.backfill(chatId, which); return true; },
    stopBackfill: async ({ chatId }) => { E.stopBackfill(chatId); return true; },
    toggleEdit: ({ chatId, messageId }) => E.toggleEdit(chatId, messageId),

    saveBody: ({ chatId, orig, row, sheet }) => A.saveBody(chatId, orig, { row, sheet }),
    removeBody: ({ chatId, orig }) => A.removeBody(chatId, orig),
    saveListItem: ({ chatId, list, i, value }) => A.saveListItem(chatId, list, i, value),
    saveSheet: ({ chatId, name, values }) => A.saveSheet(chatId, name, values),
    deleteSheet: ({ chatId, name }) => A.deleteSheet(chatId, name),
    writeSheet: ({ chatId, name }) => A.writeSheet(chatId, name),
    personaDraft: ({ chatId, name }) => A.personaDraft(chatId, name),
    makePersona: ({ chatId, name, description }) => A.makePersona(chatId, name, description),
    saveMind: ({ chatId, kind, raw, values }) => A.saveMindEntry(chatId, kind, raw, values),
    removeMind: ({ chatId, kind, raw }) => A.removeMindEntry(chatId, kind, raw),
    draw: ({ chatId, name }) => A.draw(chatId, name),
    drawMissing: ({ chatId, names }) => A.drawMissing(chatId, names || []),
    usePicture: ({ chatId, name, dataUrl }) => A.usePicture(chatId, name, dataUrl),
    removePicture: ({ chatId, name }) => A.removePicture(chatId, name),
    saveLook: ({ chatId, name, text }) => A.saveLook(chatId, name, text),
    pictureView: async ({ chatId, name, kind }) => pictureViewData(await loadChat(chatId), name, kind),

    checkCard: ({ chatId, characterId }) => K.checkCard(chatId, characterId),
    review: ({ chatId, characterId }) => K.review(chatId, characterId),
    cancelReview: async ({ characterId }) => { K.cancelReview(characterId); return true; },
};

sp.onFrontendMessage(async (p, uid) => {
    setUser(uid);
    if (p?.type !== 'rpc' || !OPS[p.op]) return;
    try {
        const value = await OPS[p.op](p.args || {});
        sp.sendToFrontend({ type: 'rpc', id: p.id, ok: true, value }, uid);
    } catch (err) {
        warn(p.op, err);
        sp.sendToFrontend({ type: 'rpc', id: p.id, ok: false, error: String(err?.message || err) }, uid);
    }
});

// ------------------------------------------------------------------ setup

let synced = false;
function syncOnce() {
    if (synced) return;
    synced = true;
    syncDisplayScripts().catch(err => warn('display scripts', err));
}

try {
    sp.commands.register([
        { id: 'wh_ledger', label: 'Worldhopper: Body Ledger', description: 'Who is in which body: a card for each, to read or change', keywords: ['worldhopper', 'ledger', 'bodies', 'possession'] },
        { id: 'wh_mind', label: 'Worldhopper: Mind Book', description: 'What hypnosis, mind control and altered perception have put into people', keywords: ['worldhopper', 'mind', 'hypnosis'] },
        { id: 'wh_modes', label: 'Worldhopper: Modes', description: "Pick this character's metaphysics modes", keywords: ['worldhopper', 'codex', 'modes'] },
        { id: 'wh_check_card', label: 'Worldhopper: Check card', description: "Check the open character's card for things that trip models up", keywords: ['worldhopper', 'card', 'doctor'] },
    ]);
    sp.commands.onInvoked((id, context) => sp.sendToFrontend({ type: 'command', id, chatId: context?.chatId || current }, user()));
} catch (err) { warn('commands', err); }

log('loaded');
