// Worldhopper Engine for Lumiverse — the display scripts for the moments the Codex asks the writer to mark
// (%%possession%% … %%/possession%% and the others) and for your body lines ([Kayla] takes the keys), as display-only
// regex scripts in a "Worldhopper" folder. Installed once: one you've edited is left alone, one you've deleted stays
// deleted, and an untouched one follows the extension's updates.
import { DISPLAY_SCRIPTS } from '../core/codex-core.js';
import { sp, user, settings, saveSettings, warn } from './host.js';

const FOLDER = 'Worldhopper';
const PLACEMENT = { 1: 'user_input', 2: 'ai_output' };

/** SillyTavern's script shape ("/find/flags", numbered placements) as Lumiverse's. */
function convert(st, order) {
    const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(st.findRegex);
    return {
        name: st.scriptName,
        script_id: st.id.replace(/-/g, '_'),
        find_regex: m ? m[1] : st.findRegex,
        flags: m ? m[2] : 'g',
        // Lumiverse's Markdown reads the lines right after an opening <div> as raw HTML (until a blank line), so the
        // prose inside a box gets a blank line on each side to be read as Markdown. (SillyTavern's markdown="1" did this.)
        replace_string: st.replaceString.replace(/(<div[^>]*>)\n/, '$1\n\n').replace(/\n<\/div>/, '\n\n</div>').replace(/ markdown="1"/, ''),
        placement: st.placement.map(p => PLACEMENT[p]).filter(Boolean),
        target: 'display',
        scope: 'global',
        run_on_edit: true,
        substitute_macros: 'none',
        trim_strings: [],
        // The cleanup of stray markers must run after every box script.
        sort_order: st.id === 'wh-stray-markers' ? 100 : order,
        folder: FOLDER,
        description: 'Worldhopper Engine display script. Edit it and Worldhopper leaves it as you set it.',
    };
}
// The same script reads back from Lumiverse a little differently (target as a list, flags in any order), so both
// sides are put in one shape before comparing.
const hashOf = r => JSON.stringify([
    r.find_regex, [...String(r.flags || '')].sort().join(''), r.replace_string,
    [...(r.placement || [])].sort(), [].concat(r.target || []).sort(),
]);

export async function syncDisplayScripts() {
    const s = await settings();
    let mine = [];
    try {
        for (let offset = 0; ; offset += 200) {
            const page = await sp.regex_scripts.list({ limit: 200, offset, userId: user() });
            mine.push(...page.data);
            if (page.data.length < 200) break;
        }
    } catch (err) { warn('display scripts: list', err); return; }
    let changed = false;
    for (const [i, st] of DISPLAY_SCRIPTS.entries()) {
        const want = convert(st, i);
        const wantHash = hashOf(want);
        const known = s.scripts[st.id];
        const have = mine.find(r => (known?.id && r.id === known.id) || r.script_id === want.script_id);
        try {
            if (!have) {
                if (known) continue;   // deleted on purpose
                const made = await sp.regex_scripts.create(want, user());
                s.scripts[st.id] = { id: made.id, hash: wantHash };
                changed = true;
                continue;
            }
            const haveHash = hashOf(have);
            if (haveHash === wantHash) {
                if (known?.hash !== wantHash || known?.id !== have.id) { s.scripts[st.id] = { id: have.id, hash: wantHash }; changed = true; }
                continue;
            }
            if (known?.hash && haveHash !== known.hash) continue;   // your edit
            if (!have.can_mutate) continue;
            await sp.regex_scripts.update(have.id, { ...want, disabled: have.disabled }, user());
            s.scripts[st.id] = { id: have.id, hash: wantHash };
            changed = true;
        } catch (err) { warn(`display script ${st.id}`, err); }
    }
    if (changed) await saveSettings();
}
