// Synced from the SillyTavern Worldhopper Engine 1.3.1 by tools/sync-core.cjs. Edit it there, not here.
// Host personas: for each body someone else has taken over (Possession, Skinsuit, Hive Mind, Puppetry and the other
// body modes), a short sheet on who that person is in their own life, the way the user's own persona describes them.
// Written once, the first time the Ledger shows the body taken, kept with the chat, and given to the model while the
// body is occupied, so the people around it keep treating it as who it was, and after it's released for as long as that
// person is still in the scene, since the model is playing them again then. It describes the host only: never what
// the one driving the body does, wants or feels (whoever drives a body writes it; the user's bodies stay theirs).
// The sheet goes by the name the Ledger uses for the body; the model writes the three fields only.
// Also the looks that pictures of people in the Ledger and the Mind Book are drawn from.
// No SillyTavern imports, so the tests can load it.

export const PERSONA_FIELDS = ['Look', 'Voice & habits', 'Life'];

const PERSONA_SYSTEM = `You write short reference sheets for an adult roleplay. Each sheet describes one person whose body someone else is driving right now (possession, a skinsuit, a hive mind, puppetry and the like), as that person is in their own life, so the story keeps their world consistent.
Write only about who they are. Never write what the one driving their body does, wants, thinks or feels, and never mention the takeover.
Take everything you can from the character card and the chat. Where they say nothing, invent small, ordinary, specific details that fit, and keep them consistent with everything shown; never write that something isn't mentioned or known. Describe their look plainly, the way a friend would, never in sexual terms. They are adults: never describe them as teenagers, minors or high school students, and never put them in a school uniform (no need to say they're adults).
Each field is one short sentence of about 15 words, so the whole sheet stays around 45 words: the two or three details that matter most, never a full description. Answer in exactly this form and nothing else:
Look: what people notice first about them
Voice & habits: how they talk, and one small habit
Life: what they do and who they live with`;

const clip = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n)}…` : String(s || ''));

/** Messages asking for one host's sheet. `messages` are { name, text }, oldest first. */
export function buildPersonaMessages({ body, row = {}, card = '', messages = [], userName = 'User' }) {
    const facts = [row.pronouns && `pronouns: ${row.pronouns}`, row.how && `taken by: ${row.how}`, row.notes && `right now: ${row.notes}`].filter(Boolean).join('; ');
    const parts = [
        card ? `Character card:\n${clip(card, 3500)}` : '',
        `The player's character is ${userName}.`,
        `Recent messages, oldest first:\n${messages.map(m => `### ${m.name}\n${clip(m.text, 1800)}`).join('\n\n')}`,
        `Write the sheet for ${body}${facts ? ` (${facts})` : ''}.`,
    ].filter(Boolean);
    return [{ role: 'system', content: PERSONA_SYSTEM }, { role: 'user', content: parts.join('\n\n') }];
}

/** The sheet as { Look, 'Voice & habits', Life }, or null when fewer than two fields came back. */
export function parsePersona(text) {
    const out = {};
    const t = String(text || '').replace(/\*\*/g, '').replace(/^\s*[-•]\s*/gm, '');
    for (const f of PERSONA_FIELDS) {
        const re = new RegExp(`^\\s*${f.replace('&', '(?:&|and)')}\\s*:\\s*(.+?)\\s*$`, 'im');
        const m = t.match(re);
        if (m && m[1].trim()) out[f] = m[1].trim();
    }
    if (Object.keys(out).length < 2) return null;
    // Hosts are adults. A sheet that describes someone as a minor is never kept, injected or drawn. Words only, no
    // numbers, so heights, ages and dates can't set it off.
    if (MINOR.test(Object.values(out).join(' '))) return null;
    for (const f of Object.keys(out)) out[f] = capWords(out[f]);
    return out;
}

// A sheet goes into the prompt every reply while it matters, so a field that runs long is cut back to about 25 words,
// at a clause break where there is one.
const MAX_FIELD_WORDS = 25;
function capWords(text, max = MAX_FIELD_WORDS) {
    const words = String(text).split(/\s+/);
    if (words.length <= max) return text;
    let cut = words.slice(0, max).join(' ');
    const at = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(';'), cut.lastIndexOf(' and '));
    if (at > cut.length * 0.5) cut = cut.slice(0, at);
    return `${cut.replace(/[\s,;:—–-]+$/, '')}.`;
}

// Only words that can't describe an adult: 18- and 19-year-olds ("teen"), costumes and cosplay ("schoolgirl",
// "school uniform"), and adults' jobs or pasts ("a middle school teacher", "dropped out of high school") never match.
const MINOR = /\b(underage|(?:is|as|still) a minor|middle[- ]schooler|middle[- ]school student|in middle school|junior high student|in junior high|elementary[- ]schooler|in elementary school)\b/i;
/** Whether a model answer describes the host as a minor (so the status can say why nothing was kept). */
export const describesMinor = text => MINOR.test(String(text || ''));

/** The sheet as the plain text the editor edits (older sheets' Name and People lines are left out). */
export function personaText(sheet) {
    return PERSONA_FIELDS.filter(f => sheet?.[f]).map(f => `${f}: ${sheet[f]}`).join('\n');
}

/**
 * A sheet typed in by hand, from its three fields: { sheet, minor }. Fields are kept as typed (no word cap: it's yours);
 * sheet is null when every field is empty. A sheet that describes someone as a minor isn't kept (minor: true).
 */
export function sheetFromFields(fields = {}) {
    const sheet = {};
    for (const f of PERSONA_FIELDS) {
        const v = String(fields[f] ?? '').replace(/\s+/g, ' ').trim();
        if (v) sheet[f] = v;
    }
    if (!Object.keys(sheet).length) return { sheet: null, minor: false };
    if (MINOR.test(Object.values(sheet).join(' '))) return { sheet: null, minor: true };
    return { sheet, minor: false };
}

// ------------------------------------------------------------------ pictures
// A picture of someone in the Ledger or the Mind Book, drawn by SillyTavern's Image Generation however it's set up.
// It's drawn from a look: a host's sheet has one, and anyone else gets a one-sentence look written for the picture.

const LOOK_SYSTEM = `You describe how one person in an adult roleplay looks, for a picture of them. Answer with one plain sentence of about 25 words: their build, hair, face, and what they usually wear, the details people notice first.
Take it from the character card and the chat. Where they say nothing, invent ordinary details that fit, consistent with everything shown; never write that something isn't mentioned or known. Describe them plainly, the way a friend would, never in sexual terms. They are an adult: never describe them as a teenager, a minor or a high school student, and never put them in a school uniform (no need to say they're an adult).
Don't start with their name, and no actions, no setting. Answer with the sentence only.`;

/** Messages asking how one person looks. `messages` are { name, text }, oldest first. */
export function buildLookMessages({ name, card = '', messages = [], userName = 'User' }) {
    const parts = [
        card ? `Character card:\n${clip(card, 3500)}` : '',
        `The player's character is ${userName}.`,
        messages.length ? `Recent messages, oldest first:\n${messages.map(m => `### ${m.name}\n${clip(m.text, 1800)}`).join('\n\n')}` : '',
        `Describe how ${name} looks.`,
    ].filter(Boolean);
    return [{ role: 'system', content: LOOK_SYSTEM }, { role: 'user', content: parts.join('\n\n') }];
}

/**
 * The look sentence from a model's answer, or null (nothing usable, or it described a minor). A sentence that opens
 * with the person ("June is a woman with…") loses that opening, since the picture prompt names them already.
 */
export function parseLook(text, name = '') {
    const line = String(text || '').replace(/\*\*/g, '').split('\n').map(x => x.trim()).find(Boolean) || '';
    let look = line.replace(/^(?:look|appearance)\s*:\s*/i, '').replace(/^["“']+|["”']+$/g, '').trim();
    if (name) look = look.replace(new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)?\\s+(?:is|has|looks like|wears)\\s+`, 'i'), '');
    look = look.charAt(0).toUpperCase() + look.slice(1);
    if (!look || MINOR.test(look)) return null;
    return capWords(look, 40);
}

/** A plain-language picture prompt from a look, for Image Generation: the face centered, so a round avatar shows it. */
export function portraitPrompt(look, name) {
    const clean = s => String(s || '').replace(/[|{}]/g, ' ').replace(/\s+/g, ' ').trim();
    return `Close-up portrait of ${clean(name) || 'a person'}, ${clean(look).replace(/[.\s]+$/, '')}. Head and shoulders, face centered in the frame, looking straight at the viewer, plain soft background.`;
}

/** Store key for a body name. */
export const personaKey = name => String(name || '').trim().toLowerCase();
