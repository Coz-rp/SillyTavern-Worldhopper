// @bun
// src/core/text-core.js
var LIST_LINE = /^\s*(?:[-\u2022#>|]|\d+[.)]\s|\*\*[^*]+\*\*\s*:|\[[A-Z]\])|\*\*[^*]{1,40}:\*\*/;
var NEUTRAL_LINE = /^(?:[-*_]\s*){3,}$|^#{0,4}\s*\**\s*\[?\s*\uD83D\uDCCD/u;
function looksLikeRoleplay(text) {
  const lines = String(text).split(`
`).map((l) => l.trim()).filter((l) => l && !NEUTRAL_LINE.test(l));
  if (!lines.length)
    return false;
  const listy = lines.filter((l) => LIST_LINE.test(l) || /^#{1,6}\s/.test(l)).length;
  return listy / lines.length < 0.3;
}
var DANGLING = /\b(the|a|an|to|of|with|into|onto|from|and|or|but|your|my|its|our|their)(\s*[\u2014\u2013]|[.!?,;:](?=\s|$|[*"\u201D]))|[a-z][.!?][a-z]/gi;
var dangling = (s) => (String(s).replace(/[ \t]{2,}/g, " ").replace(/ +([,.!?;:])/g, "$1").match(DANGLING) || []).length;
function leavesBroken(before, after) {
  return dangling(after) > dangling(before);
}
function deleteSpan(text, s, e) {
  const after = text[e];
  if (after === undefined || /[*"\u201D\n]/.test(after)) {
    while (s > 0 && /[ \t]/.test(text[s - 1]))
      s--;
  } else {
    while (e < text.length && /[ \t]/.test(text[e]))
      e++;
  }
  let out = text.slice(0, s) + text.slice(e);
  let l = s - 1;
  while (l >= 0 && /[ \t]/.test(out[l]))
    l--;
  let r = s;
  while (r < out.length && /[ \t]/.test(out[r]))
    r++;
  if (l < 0 || r >= out.length)
    return out;
  const emptiedItalic = out[l] === "*" && out[r] === "*" && out[l - 1] !== "*" && out[r + 1] !== "*";
  const emptiedQuote = out[l] === '"' && out[r] === '"' || out[l] === "\u201C" && out[r] === "\u201D";
  if (emptiedItalic || emptiedQuote) {
    out = out.slice(0, l).replace(/[ \t]+$/, "") + (out.slice(r + 1).match(/^[ \t]*\S/) && l > 0 ? " " : "") + out.slice(r + 1).replace(/^[ \t]+/, "");
  }
  return out;
}

// src/core/ledger-core.js
var EMPTY_LEDGER = Object.freeze({ bodies: [], powers: [], aliases: [] });
var str = (v, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
var lc = (s) => str(s).toLowerCase();
function fit(v, max, legacy = 0) {
  let s = str(v, 2000);
  const cut = s.length > max || legacy && s.length === legacy;
  if (!cut)
    return s;
  s = s.slice(0, s.length > max ? max : legacy);
  const clause = Math.max(s.lastIndexOf("; "), s.lastIndexOf(", "), s.lastIndexOf(" \u2014 "), s.lastIndexOf(" ("));
  const end = clause >= s.length * 0.5 ? clause : s.lastIndexOf(" ");
  return (end > 0 ? s.slice(0, end) : s).replace(/[\s,;:(\u2014-]+$/, "");
}
function aliasResolver(...ledgers) {
  const parent = new Map;
  const find = (x) => {
    while (parent.get(x) !== x)
      x = parent.get(x);
    return x;
  };
  for (const l of ledgers) {
    for (const a of Array.isArray(l?.aliases) ? l.aliases : []) {
      const names = [a?.name, ...Array.isArray(a?.aka) ? a.aka : []].map(lc).filter(Boolean);
      for (const n of names)
        if (!parent.has(n))
          parent.set(n, n);
      for (const n of names.slice(1)) {
        const r = find(n), r0 = find(names[0]);
        if (r !== r0)
          parent.set(r, r0);
      }
    }
  }
  return (name) => {
    const k = lc(name);
    return parent.has(k) ? find(k) : k;
  };
}
function normalizeAliases(raw) {
  const entries = (Array.isArray(raw) ? raw : []).map((a) => ({
    name: str(a?.name, 60),
    aka: (Array.isArray(a?.aka) ? a.aka : String(a?.aka ?? "").split(",")).map((x) => str(x, 60)).filter(Boolean)
  })).filter((a) => a.name);
  const canon = aliasResolver({ aliases: entries });
  const groups = new Map;
  for (const a of entries) {
    const g = groups.get(canon(a.name)) || { name: a.name, seen: new Set([lc(a.name)]), aka: [] };
    for (const n of [a.name, ...a.aka])
      if (!g.seen.has(lc(n))) {
        g.seen.add(lc(n));
        g.aka.push(n);
      }
    groups.set(canon(a.name), g);
  }
  return [...groups.values()].filter((g) => g.aka.length).map((g) => ({ name: g.name, aka: g.aka.slice(0, 8) })).slice(0, 24);
}
var MIND_ONLY = /hypno|mind[- ]?control|brainwash|dron|pet play|doll|blank slate|trance|perception|conditioning|limp/i;
var BODY_ONLY = /possess|skin|worn|hive|absorb|puppet|swap|cop(y|ied)|propagat|vore/i;
function normalizeLedger(raw) {
  const rawBodies = Array.isArray(raw?.bodies) ? raw.bodies : [];
  const powers = Array.isArray(raw?.powers) ? raw.powers : [];
  const aliases = normalizeAliases(raw?.aliases);
  const canon = aliasResolver({ aliases });
  const bodies = rawBodies.filter((b) => !MIND_ONLY.test(str(b?.how)));
  for (const m of Array.isArray(raw?.minds) ? raw.minds : []) {
    const how = str(m?.how), who = str(m?.who, 60), by = str(m?.by, 60);
    if (!who || !by || /^(none|nobody|no one|n\/a|null|-|self)$/i.test(by) || !BODY_ONLY.test(how) || MIND_ONLY.test(how))
      continue;
    if (!bodies.some((b) => canon(str(b?.body)) === canon(who)))
      bodies.push({ body: who, driver: by, how, notes: m.state, user_knows: m.user_knows });
  }
  return {
    bodies: bodies.map((b) => ({
      body: str(b.body, 60),
      pronouns: str(b.pronouns, 20),
      driver: /^(none|nobody|no one|n\/a|null|-)$/i.test(str(b.driver)) ? "" : str(b.driver, 60),
      driver_pronouns: str(b.driver_pronouns, 20),
      how: fit(b.how, 60, 40),
      host: fit(b.host, 120, 80),
      notes: fit(b.notes, 220, 140),
      doing: fit(b.doing, 80),
      user_knows: /^\s*n/i.test(String(b.user_knows ?? "")) ? "no" : "yes"
    })).filter((b) => (b.body || b.driver) && !(b.body && b.driver && canon(b.body) === canon(b.driver))).slice(0, 24),
    own: (Array.isArray(raw?.own) ? raw.own : []).map((o) => ({ who: str(o?.who, 60), doing: fit(o?.doing, 80), notes: fit(o?.notes, 160) })).filter((o) => o.who && (o.doing || o.notes)).slice(0, 8),
    powers: powers.map((p) => ({ who: str(p.who, 60), power: fit(p.power, 240, 100) })).filter((p) => p.who && p.power).slice(0, 24),
    aliases
  };
}
var isEmptyLedger = (l) => !l || !l.bodies?.length && !l.powers?.length;
var COPY = /cop(y|ied)|propagat/i;
var PUPPET = /puppet/i;
function namedIn(text, names) {
  const t = String(text || "");
  return names.filter(Boolean).some((n) => new RegExp(`(?<![\\p{L}\\p{N}])${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(t));
}
var NOT_FIRST_NAMES = /^(?:the|mr|mrs|ms|miss|mx|dr|doctor|sir|lady|lord|madam|officer|detective|professor|prof|aunt|uncle|old|young|little|big|saint|st|captain|sergeant|nurse|coach|father|mother|sister|brother)$/i;
function firstName(name) {
  const w = String(name || "").trim().split(/\s+/);
  return w.length > 1 && /^\p{Lu}\p{L}{2,}$/u.test(w[0]) && !NOT_FIRST_NAMES.test(w[0]) ? w[0] : "";
}
function personNamedIn(text, names) {
  if (namedIn(text, names))
    return true;
  const first = firstName(names[0]);
  return !!first && new RegExp(`(?<![p{L}p{N}])${first}(?![p{L}p{N}])`, "u").test(String(text || ""));
}
function akaOf(ledger, name) {
  const canon = aliasResolver(ledger);
  const names = (ledger?.aliases || []).filter((a) => canon(a.name) === canon(name)).flatMap((a) => [a.name, ...a.aka]);
  return [...new Set(names)].filter((n) => lc(n) !== lc(name));
}
var LEDGER_CORE = `You maintain the Body Ledger for an adult roleplay in which minds leave their own bodies and inhabit others (possession, multipossession, skinsuits, hive minds, copies, swaps). The ledger lists:
- bodies: every body that is NOT currently driven by its own mind, every empty or vacated body, every body worn as a skin, and every mind that is outside its own body;
- every character shown or stated to hold such a power, and what the power is.
A body driven by its own mind again leaves the body list. People who are simply themselves in their own bodies are never listed, and neither is anyone whose mind was changed (hypnosis, mind control and the like) while they still drive their own body: this ledger is only about who is in which body.

Evidence. Add or change a row only when the messages plainly show a mind entering, leaving or switching bodies, or say so outright. Being near someone with powers, or touched, grabbed, spoken to, looked at, wanted or mentioned by them, is NOT being possessed. A character who acts on their own, speaks for themselves or shows their own feelings is in their own body. When in doubt, leave the ledger as it is.

Fields for each body:
- body: the body's own name, as the story uses it (for a mind with no body, use "none")
- pronouns: the BODY's own pronouns, e.g. "she/her"
- driver: the name of the mind currently driving it, or "" if nobody is driving it (an empty body)
- driver_pronouns: the DRIVING MIND's own pronouns, e.g. "he/him"
- how: the mechanism in a word or two: possession, multipossession, skinsuit, hive mind, copy, swap. A body overwritten by a copy has the original's name as driver and how "copy"
- host: only what the messages actually show about the body's own mind, e.g. "gone" or "dead". If they don't show it, leave it "". Never guess, and never assume the host is awake or aware.
- notes: a short phrase: what the body is wearing and where it is. Lasting facts only, never a momentary action ("holding a cup", "laughing")
- doing: what the body is busy with right now, an ongoing activity in a few words ("calc homework", "driving to work", "asleep"), or "" if nothing in particular. Keep it current: when the messages show the body moving on to something else, change it
- user_knows: "yes" if {{user}} is the driver, has been told, has seen it happen, or the card or opening establishes that {{user}} knows; "no" if it is being kept from {{user}}. Once "yes", it stays "yes".

Aliases: anyone the story calls by more than one name (a code name or unit number, a handle, a host number, a nickname, a real name behind a persona) is listed once with every name, e.g. {"name":"Sasha","aka":["Unit 114"]}. In body and driver fields, use the name the story uses most.

Own bodies: a mind that runs other bodies while still in its own (multipossession, a hive's original mind) gets one "own" entry for that own body, {"who": the mind's name, "doing": as above, "notes": what it is wearing and where it is}, kept current the same way whenever that body moves or does something new. Nobody else gets one.

Rules:
- Change only what the new messages clearly establish.
- A mind drives one body at a time unless the story shows it running several at once. When a driver moves into a new body, the body they left is no longer theirs: it is empty (driver "") or back with its own mind (remove it), whichever the messages show.
- A row stays until the messages show it ending: the driver leaving the body, being forced out or letting it go, or the body's own mind back in control. A scene that moves somewhere else, a body nobody mentions for a while, or the driver busy in another body ends nothing.
- Use each character's name as the story does. The player's character is called {{user}}.
- Pronouns come from the story or the card. If a body's sex is plain from the text (breasts, cock, "the girl"), use it.`;
var LEDGER_SYSTEM = `${LEDGER_CORE}
- Copy everything that didn't change exactly as it was.
Answer with the complete ledger as JSON and nothing else, in exactly this shape:
{"bodies":[{"body":"","pronouns":"","driver":"","driver_pronouns":"","how":"","host":"","notes":"","doing":"","user_knows":"yes"}],"own":[{"who":"","doing":"","notes":""}],"powers":[{"who":"","power":""}],"aliases":[{"name":"","aka":[""]}]}`;
var LEDGER_UPDATE_SYSTEM = `${LEDGER_CORE}
Answer with ONLY what changed, as JSON and nothing else, in this shape, leaving out any part with nothing in it:
{"set":[{"body":"","pronouns":"","driver":"","driver_pronouns":"","how":"","host":"","notes":"","doing":"","user_knows":"yes"}],"remove":["body name"],"own":{"set":[{"who":"","doing":"","notes":""}],"remove":["who"]},"powers":{"set":[{"who":"","power":""}],"remove":["who"]},"aliases":[{"name":"","aka":[""]}]}
- set: each body that is new or whose row changed, with all its fields.
- remove: each body whose driver the new messages show leaving (its own mind drives it again), by name; for a mind with no body, the mind's name.
- own: own-body entries that are new or changed (a new place or a new activity counts); remove one when that mind no longer runs other bodies.
- aliases: only new names.
If nothing changed, answer {}`;
var clip = (s, n) => {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, n) + " \u2026" : s;
};
function buildLedgerMessages({ ledger, messages, userName, modes = [], card = "", persona = "", update = false, context = [] }) {
  const sys = (update ? LEDGER_UPDATE_SYSTEM : LEDGER_SYSTEM).replaceAll("{{user}}", userName || "the player");
  const parts = [];
  if (card)
    parts.push(`Character card (background only; the chat decides the current state):
${clip(card, 3000)}`);
  if (persona)
    parts.push(`${userName}'s persona:
${clip(persona, 800)}`);
  if (modes.length)
    parts.push(`Mechanics this story can use (possible, not necessarily happening): ${modes.join(", ")}.`);
  const keepsOwn = modes.filter((m) => KEEPS_OWN_BODY.includes(m));
  if (keepsOwn.length)
    parts.push(`With ${list(keepsOwn)}, one mind runs several bodies at once, and taking a new body adds it: the mind keeps every body it already had, its own included, unless the messages show it leaving one. Its own body stays off the body list while it still drives it (it gets an "own" entry instead); never list it as empty just because the mind took someone else, and never take a row off because the scene is following its own body or another of its bodies. Such a ride's how is ${keepsOwn.map((m) => `"${lc(m)}"`).join(" or ")}, whichever the story shows.`);
  else if (isSingleBody(modes))
    parts.push("In this story a mind drives one body at a time, so a driver shown living as themselves in their own body (their own home, their own name and features) has left the body they were in: remove that row.");
  if (modes.includes("Body Swap"))
    parts.push(`With Body Swap, two minds trade bodies: each swapped body is driven by the other's mind (how "swap"), and the story keeps calling each body by its own name, in its own home and life. So a swapped body seen under its own name is still swapped; the swap ends, for both rows, only when the messages show it undone.`);
  parts.push(`Current ledger:
${JSON.stringify(normalizeLedger(ledger || EMPTY_LEDGER))}`);
  if (context.length)
    parts.push(`Earlier messages, for context only (the ledger already reflects them):
` + context.map((m) => `### ${m.name}
${clip(m.text, 1500)}`).join(`

`));
  parts.push((context.length ? "New messages to apply" : "Newest messages") + `, oldest first:
` + messages.map((m) => `### ${m.name}
${clip(m.text, 2500)}`).join(`

`));
  parts.push(update ? "Now output only what changed, as JSON, or {} if nothing did." : "Now output the complete updated ledger as JSON.");
  return [{ role: "system", content: sys }, { role: "user", content: parts.join(`

`) }];
}
function firstJson(text, open = "{") {
  const s = String(text || "");
  const close = open === "[" ? "]" : "}";
  for (let a = s.indexOf(open);a >= 0; a = s.indexOf(open, a + 1)) {
    let depth = 0, inStr = false;
    for (let i = a;i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (c === "\\")
          i++;
        else if (c === '"')
          inStr = false;
        continue;
      }
      if (c === '"')
        inStr = true;
      else if (c === open)
        depth++;
      else if (c === close && --depth === 0) {
        try {
          return JSON.parse(s.slice(a, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
function parseLedger(text) {
  const j = firstJson(text);
  if (!j || !Array.isArray(j.bodies) && !Array.isArray(j.powers))
    return null;
  return normalizeLedger(j);
}
var FIELDS = ["body", "pronouns", "driver", "driver_pronouns", "how", "host", "notes", "doing", "user_knows"];
var listOf = (v) => Array.isArray(v) ? v : v == null ? [] : [v];
function applyLedgerDiff(ledger, diff) {
  const base = normalizeLedger(ledger);
  if (!diff || typeof diff !== "object")
    return base;
  const aliases = normalizeAliases([...base.aliases, ...listOf(diff.aliases)]);
  const canon = aliasResolver({ aliases });
  const noBody = (b) => !b.body || lc(b.body) === "none";
  const rowKey = (b) => noBody(b) ? "m:" + canon(b.driver) : "b:" + canon(b.body);
  const nameOf = (n) => typeof n === "string" ? n : n?.body || n?.name || n?.driver || n?.who || "";
  const gone = new Set(listOf(diff.remove ?? diff.removed ?? diff.delete).map((n) => canon(nameOf(n))).filter(Boolean));
  let bodies = base.bodies.filter((b) => !gone.has(canon(noBody(b) ? b.driver : b.body)));
  for (const r of listOf(diff.set ?? diff.add ?? diff.update ?? diff.changed ?? diff.bodies)) {
    if (!r || typeof r !== "object" || !r.body && !r.driver)
      continue;
    const i = bodies.findIndex((b) => rowKey(b) === rowKey(r));
    if (i < 0) {
      if (!noBody(r) && !str(r.driver) && !str(r.host))
        continue;
      bodies.push(r);
      continue;
    }
    const merged = { ...bodies[i] };
    for (const f of FIELDS) {
      if (r[f] === undefined || r[f] === null)
        continue;
      if (f === "user_knows" && bodies[i].user_knows === "yes")
        continue;
      merged[f] = r[f];
    }
    bodies[i] = merged;
  }
  const p = diff.powers;
  const pSet = Array.isArray(p) ? p : listOf(p?.set ?? p?.add);
  const pGone = new Set(listOf(Array.isArray(p) ? [] : p?.remove).map((n) => canon(nameOf(n))));
  let powers = base.powers.filter((x) => !pGone.has(canon(x.who)));
  for (const x of pSet) {
    if (!x?.who || !x?.power)
      continue;
    const i = powers.findIndex((y) => canon(y.who) === canon(x.who));
    if (i < 0)
      powers.push(x);
    else
      powers[i] = { ...powers[i], power: x.power };
  }
  const o = diff.own;
  const oSet = Array.isArray(o) ? o : listOf(o?.set ?? o?.add);
  const oGone = new Set(listOf(Array.isArray(o) ? [] : o?.remove).map((n) => canon(nameOf(n))));
  const own = base.own.filter((x) => !oGone.has(canon(x.who)));
  for (const x of oSet) {
    if (!x?.who)
      continue;
    const i = own.findIndex((y) => canon(y.who) === canon(x.who));
    const given = Object.fromEntries(["doing", "notes"].filter((k) => x[k] != null).map((k) => [k, x[k]]));
    if (i < 0)
      own.push({ who: x.who, ...given });
    else
      own[i] = { ...own[i], ...given };
  }
  const d = diff.minds;
  const minds = Array.isArray(d) ? d : listOf(d?.set ?? d?.add);
  return normalizeLedger({ bodies, own, minds, powers, aliases });
}
function parseLedgerUpdate(text, current) {
  const j = firstJson(text);
  if (!j)
    return /^\s*(\{\s*\}|none|no changes?\.?)\s*$/i.test(String(text || "")) ? normalizeLedger(current) : null;
  return applyLedgerDiff(current, j);
}
function newRides(prev, next) {
  const key = pairKeyWith(aliasResolver(prev, next));
  const had = new Set(rides(prev).map((b) => key(b.driver, b.body)));
  return rides(next).filter((b) => !had.has(key(b.driver, b.body)));
}
var RIDE_CHECK_SYSTEM = `You check one claim about a roleplay: that a particular mind has taken over a particular person's body and is driving it (possession, wearing them as a skin, a hive taking them, a copy overwriting them).
Answer YES if the messages show it or clearly imply it: the mind going into them; the person jolting, blanking or going still and then acting for that mind; the possessor talking about being in them or speaking through them; the narration saying so. A mind that can run several bodies can be in this one while its own body sits somewhere else.
Answer NO if the only link is being near, touched, grabbed, held, talked to, looked at, threatened, wanted or mentioned, or the person doing what they're told out of fear or their own choice. When it's truly unclear, answer NO.
Answer YES or NO on the first line, then quote the words that decide it.`;
function buildRideCheckMessages(ride, messages, context = [], userName = "the player", { ledger = null, modes = [] } = {}) {
  const show = (xs) => xs.map((m) => `### ${m.name}
${clip(m.text, 2500)}`).join(`

`);
  const canon = aliasResolver(ledger);
  const already = ledger ? rides(ledger).filter((b) => canon(b.driver) === canon(ride.driver)).map((b) => b.body) : [];
  const known = [
    modes.length ? `Mechanics this story can use: ${modes.join(", ")}.` : "",
    already.length ? `Already known: ${ride.driver} is driving ${list(already)}.` : "",
    `The player's character is ${userName}; "you" in the narration is ${userName}, or whoever is driving ${userName}'s body.`
  ].filter(Boolean).join(`
`);
  const claim = already.length && isSingleBody(modes) ? `${ride.driver}'s mind has left ${list(already)} and is now inside ${ride.body}'s body, driving it.` : `${ride.driver}'s mind is now inside ${ride.body}'s body, driving it.`;
  return [
    { role: "system", content: RIDE_CHECK_SYSTEM },
    { role: "user", content: `${context.length ? `Earlier messages:
${show(context)}

` : ""}New messages:
${show(messages)}

${known}
Claim: ${claim}
Is the claim shown? YES or NO.` }
  ];
}
var MULTI_MODES = ["Multipossession", "Hive Mind", "Propagation", "Puppetry"];
var isSingleBody = (modes = []) => modes.length > 0 && !modes.some((m) => MULTI_MODES.includes(m));
var KEEPS_OWN_BODY = ["Multipossession", "Hive Mind"];
function labelMultiRides(ledger, modes = []) {
  const l = normalizeLedger(ledger);
  const only = (m) => modes.includes(m) && !modes.includes("Possession");
  const label = modes.includes("Multipossession") ? "multipossession" : only("Hive Mind") ? "hive mind" : only("Body Swap") ? "swap" : "";
  if (!label)
    return l;
  return { ...l, bodies: l.bodies.map((b) => b.driver && b.body && /^\s*(possession|possessed)?\s*$/i.test(b.how) ? { ...b, how: label } : b) };
}
function oneBodyAtATime(prev, next, modes = []) {
  if (!isSingleBody(modes))
    return normalizeLedger(next);
  const canon = aliasResolver(prev, next);
  const moved = new Map(newRides(prev, next).map((r) => [canon(r.driver), canon(r.body)]));
  if (!moved.size)
    return normalizeLedger(next);
  const bodies = normalizeLedger(next).bodies.map((b) => b.driver && moved.has(canon(b.driver)) && moved.get(canon(b.driver)) !== canon(b.body) ? { ...b, driver: "", driver_pronouns: "" } : b);
  return normalizeLedger({ ...next, bodies });
}
var parseRideCheck = (text) => /^[\s*"'`]*yes\b/i.test(String(text || ""));
var WHERE_SYSTEM = `You read a roleplay and say where one mind is at the end of the new messages: which body it is inside and driving. Go by what the messages show happening, not by who is mentioned, touched or talked about. Answer with exactly one option from the list, copied as written, on the first line.`;
function buildWhereMessages(ride, current, messages, context = [], userName = "the player") {
  const show = (xs) => xs.map((m) => `### ${m.name}
${clip(m.text, 2500)}`).join(`

`);
  const options = [...new Set([...current, ride.body])].map((b) => `${b}'s body`).concat([`${ride.driver}'s own body`, "unclear"]);
  return {
    options,
    messages: [
      { role: "system", content: WHERE_SYSTEM },
      { role: "user", content: `${context.length ? `Earlier messages:
${show(context)}

` : ""}New messages:
${show(messages)}

The player's character is ${userName}; "you" in the narration is ${userName}, or whoever is driving ${userName}'s body.
Before these messages, ${ride.driver}'s mind was in ${list(current)}'s body.
At the end of the new messages, where is ${ride.driver}'s mind?
${options.map((o) => `- ${o}`).join(`
`)}` }
    ]
  };
}
function parseWhere(text, options) {
  const first = String(text || "").split(`
`).find((l) => l.trim()) || "";
  const hit = options.map((o) => [o, first.toLowerCase().indexOf(o.toLowerCase().replace(/'s body$/, ""))]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1])[0];
  return hit ? hit[0] : null;
}
async function verifyNewRides(prev, next, { messages, context = [], userName = "the player", modes = [] }, ask) {
  const canon = aliasResolver(prev, next);
  const rejected = [], log = [];
  for (const ride of newRides(prev, next)) {
    const current = rides(prev).filter((b) => canon(b.driver) === canon(ride.driver)).map((b) => b.body);
    let ok, answer;
    if (current.length && isSingleBody(modes)) {
      const w = buildWhereMessages(ride, current, messages, context, userName);
      answer = await ask(w.messages, 60);
      ok = parseWhere(answer, w.options) === `${ride.body}'s body`;
    } else {
      answer = await ask(buildRideCheckMessages(ride, messages, context, userName, { ledger: prev, modes }), 120);
      ok = parseRideCheck(answer);
    }
    log.push({ ride: `${ride.driver} \u2192 ${ride.body}`, kept: ok, answer: String(answer).replace(/\s+/g, " ").slice(0, 160) });
    if (!ok)
      rejected.push(ride);
  }
  return { ledger: oneBodyAtATime(prev, dropRides(prev, next, rejected), modes), rejected, log };
}
function dropRides(prev, next, rejected) {
  if (!rejected.length)
    return normalizeLedger(next);
  const canon = aliasResolver(prev, next);
  const bodyKey = (b) => canon(b.body);
  const wrong = new Set(rejected.map(bodyKey));
  const before = new Map(normalizeLedger(prev).bodies.map((b) => [bodyKey(b), b]));
  const bodies = normalizeLedger(next).bodies.flatMap((b) => !wrong.has(bodyKey(b)) ? [b] : before.has(bodyKey(b)) ? [before.get(bodyKey(b))] : []);
  return normalizeLedger({ ...next, bodies });
}
var END_CHECK_SYSTEM = `You check one claim about a roleplay: that a particular mind has stopped driving a particular person's body.
Answer YES only if the new messages show it ending: the mind leaving the body, being forced out or letting it go, or the person's own mind back in control. A passage marked as a release (between %%release%% lines) or as stepping out of a skin (%%shed%%) is exactly that.
Answer NO if the messages simply follow someone else, move to another place, leave the person out, or show the mind busy in another body, its own included. When it's unclear, answer NO.
Answer YES or NO on the first line, then quote the words that decide it.`;
function buildEndCheckMessages(ride, messages, context = [], userName = "the player", { modes = [] } = {}) {
  const show = (xs) => xs.map((m) => `### ${m.name}
${clip(m.text, 2500)}`).join(`

`);
  const known = [
    modes.length ? `Mechanics this story can use: ${modes.join(", ")}.` : "",
    `The player's character is ${userName}; "you" in the narration is ${userName}, or whoever is driving ${userName}'s body.`
  ].filter(Boolean).join(`
`);
  return [
    { role: "system", content: END_CHECK_SYSTEM },
    { role: "user", content: `${context.length ? `Earlier messages:
${show(context)}

` : ""}New messages:
${show(messages)}

${known}
Claim: ${ride.driver}'s mind is no longer driving ${ride.body}'s body.
Is the claim shown? YES or NO.` }
  ];
}
function names(text, who, ledger, userName) {
  const canon = aliasResolver(ledger);
  const keys = [who, ...akaOf(ledger, who)].flatMap((n) => {
    const s = str(n), first = s.split(" ")[0];
    return /^[A-Z]/.test(first) && first.length > 2 && !/^(The|His|Her|Their|Its)$/.test(first) ? [s, first] : [s];
  });
  if (userName && canon(who) === canon(userName))
    keys.push("you", "your");
  return keys.some((k) => k && new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}
async function verifyEndedRides(prev, next, { messages, context = [], userName = "the player", modes = [] }, ask) {
  const canon = aliasResolver(prev, next);
  const text = messages.map((m) => m.text).join(`
`);
  const moved = new Set(isSingleBody(modes) ? newRides(prev, next).map((r) => canon(r.driver)) : []);
  const kept = [], log = [];
  const releases = [
    ...[...text.matchAll(/%%(release|shed)%%([\s\S]*?)(?:%%\/\1%%|$)/gi)].map((m) => m[2]),
    ...[...text.matchAll(/^> \*\*\u25C7 (?:release|stepped out) \u25C7\*\*[ \t]*\n((?:>.*(?:\n|$))*)/gim)].map((m) => m[1])
  ];
  for (const ride of endedRides(prev, next)) {
    if (moved.has(canon(ride.driver)))
      continue;
    let ended = false, answer = "neither the body nor its driver is in the new messages";
    if (releases.some((r) => names(r, ride.body, prev, userName))) {
      ended = true;
      answer = "a marked release names the body";
    } else if (names(text, ride.body, prev, userName) || names(text, ride.driver, prev, userName)) {
      answer = await ask(buildEndCheckMessages(ride, messages, context, userName, { modes }), 120);
      ended = parseRideCheck(answer);
    }
    log.push({ ride: `${ride.driver} \u2192 ${ride.body}`, ended, answer: String(answer).replace(/\s+/g, " ").slice(0, 160) });
    if (!ended)
      kept.push(ride);
  }
  let out = keepRides(prev, next, kept);
  for (const r of releases.filter((r) => r.trim())) {
    const named = rides(out).filter((b) => names(r, b.body, out, null));
    if (named.length !== 1)
      continue;
    out = normalizeLedger({ ...out, bodies: out.bodies.filter((b) => canon(b.body) !== canon(named[0].body)) });
    log.push({ ride: `${named[0].driver} \u2192 ${named[0].body}`, ended: true, answer: "a marked release names only this body" });
  }
  return { ledger: out, kept, log };
}
function keepRides(prev, next, kept) {
  if (!kept.length)
    return normalizeLedger(next);
  const canon = aliasResolver(prev, next);
  const back = new Set(kept.map((r) => canon(r.body)));
  const before = normalizeLedger(prev).bodies.filter((b) => back.has(canon(b.body)));
  const n = normalizeLedger(next);
  return normalizeLedger({ ...n, bodies: [...n.bodies.filter((b) => !back.has(canon(b.body))), ...before] });
}
var LEDGER_MODES = ["Possession", "Multipossession", "Skinsuit", "Hive Mind", "Reverse Vore", "Propagation", "Copy Fidelity", "Body Swap"];
var tracksBodies = (modes = []) => modes.some((m) => LEDGER_MODES.includes(m));
var same = (a, b) => a.toLowerCase() === b.toLowerCase();
var list = (xs) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
var MULTI = /multi|hive|network|collective|swarm/i;
function multiBodyGroups(ledger) {
  const l = normalizeLedger(ledger);
  const canon = aliasResolver(l);
  const listed = new Set(l.bodies.filter((b) => b.body).map((b) => canon(b.body)));
  const groups = new Map;
  for (const b of l.bodies) {
    if (!b.driver || !b.body || same(b.body, "none") || COPY.test(b.how) || PUPPET.test(b.how))
      continue;
    const g = groups.get(canon(b.driver)) || { driver: b.driver, bodies: [], ownToo: false, hidden: false };
    g.bodies.push(b.body);
    if (MULTI.test(b.how) && !listed.has(canon(b.driver)))
      g.ownToo = true;
    if (b.user_knows === "no")
      g.hidden = true;
    groups.set(canon(b.driver), g);
  }
  return [...groups.values()].filter((g) => g.bodies.length > 1 || g.ownToo);
}
function rosterOf(ledger, name) {
  const l = normalizeLedger(ledger);
  const canon = aliasResolver(l);
  const mine = l.bodies.filter((b) => b.driver && b.body && !same(b.body, "none") && canon(b.driver) === canon(name) && !COPY.test(b.how));
  const listed = new Set(l.bodies.filter((b) => b.body).map((b) => canon(b.body)));
  const ownToo = mine.some((b) => MULTI.test(b.how) || PUPPET.test(b.how)) && !listed.has(canon(name));
  if (mine.length + (ownToo ? 1 : 0) < 2)
    return [];
  const own = l.own.find((o) => canon(o.who) === canon(name)) || {};
  return [
    ...ownToo ? [{ name, own: true, doing: own.doing || "", notes: own.notes || "" }] : [],
    ...mine.map((b) => ({ name: b.body, own: false, doing: b.doing, notes: b.notes }))
  ];
}
var isSwap = (b) => /swap/i.test(b?.how || "");
var knownSwap = (b) => isSwap(b) && b.body && b.driver && b.user_knows !== "no";
var PLAIN_HOW = /^\s*(possession|possessed|skinsuit|skin|worn|hive( mind)?|copy|propagation|puppetry|puppet|swap|body swap|)\s*$/i;
function rideVerb(how) {
  const h = lc(how);
  if (/skin|worn/.test(h))
    return "worn as a skin by";
  if (/hive/.test(h))
    return "absorbed into the hive of";
  if (/cop(y|ied)|propagat|overwrit/.test(h))
    return "overwritten by a copy of";
  if (/puppet/.test(h))
    return "puppeted from outside by";
  if (/swap/.test(h))
    return "swapped, now home to";
  return "possessed by";
}
function linesFor(text, names) {
  const byKey = new Map(names.map((n) => [lc(n), n]));
  const given = new Set;
  let untagged = false;
  for (const line of String(text || "").split(`
`)) {
    if (!line.trim())
      continue;
    const m = /^\s*\[([^\]\n]+)\]\s*(\S.*)?$/.exec(line) || /^\s*([^:\n[\]]{1,40}):\s*(\S.*)?$/.exec(line);
    const name = m && byKey.get(lc(m[1]));
    if (name) {
      if (m[2])
        given.add(name);
    } else
      untagged = true;
  }
  return { given: names.filter((n) => given.has(n)), untagged };
}
function turnLine(roster, userName, lastUserText) {
  const names = roster.map((r) => r.name);
  const { given, untagged } = linesFor(lastUserText, names);
  if (!given.length)
    return "";
  const idle = roster.filter((r) => !given.includes(r.name)).map((r) => r.own ? `${userName}'s own body` : r.name);
  const gave = given.map((n) => lc(n) === lc(userName) ? `${userName}'s own body` : n);
  if (!idle.length)
    return `This turn ${userName} wrote a line for every one of their bodies: write each doing only that.`;
  const one = idle.length === 1;
  return `This turn ${userName} wrote lines for ${list(gave)} and nothing for ${list(idle)}${untagged ? " (unless a line with no name plainly includes them)" : ""}. ` + `${list(idle)} ${one ? "does" : "do"} nothing new and ${one ? "says" : "say"} nothing: if anyone speaks to or waits on ${one ? idle[0] : "any of them"}, write that person and stop there, leaving the answer to ${userName}.`;
}
function renderLedger(ledger, userName = "{{user}}", { lastUserText = "", sheets = new Map, back = [], scene = null } = {}) {
  const l = normalizeLedger(ledger);
  if (isEmptyLedger(l) && !back.length)
    return "";
  const lines = [];
  const sheetOf = (body) => body && (scene == null || personNamedIn(scene, [body, ...akaOf(l, body)])) ? sheets.get(lc(body)) : "";
  const who = (body, text) => `  Who ${body} is in their own life: ${String(text).replace(/\s*\n\s*/g, " ")}`;
  const hidden = [];
  const canon = aliasResolver(l);
  const players = (d) => d && canon(d) === canon(userName);
  for (const b of l.bodies) {
    const body = b.body && b.body.toLowerCase() !== "none" ? b.body : null;
    const bodyTag = body ? `${body}${b.pronouns ? ` (${b.pronouns})` : ""}` : null;
    const driverTag = b.driver ? `${b.driver}${b.driver_pronouns ? ` (${b.driver_pronouns})` : ""}` : null;
    let line;
    if (!bodyTag)
      line = `${driverTag}: a mind with no body right now`;
    else if (driverTag && !same(b.driver, body))
      line = `${bodyTag}: ${rideVerb(b.how)} ${driverTag}${PLAIN_HOW.test(b.how) ? "" : ` (${b.how})`}`;
    else
      line = `${bodyTag}: empty, nobody inside${b.how ? ` (${b.how})` : ""}`;
    if (bodyTag && b.host)
      line += `. ${body}'s own mind: ${b.host}`;
    if (b.notes)
      line += `. ${b.notes}`;
    if (b.doing && !players(b.driver))
      line += `. Busy with: ${b.doing}`;
    if (b.user_knows === "no" && body && b.driver) {
      line += `. HIDDEN from ${userName}`;
      hidden.push(b);
    }
    if (body && players(b.driver) && !same(b.driver, body)) {
      const subj = String(b.pronouns || "").split("/")[0].trim().toLowerCase() || "they";
      const [poss, own] = { she: ["her", "hers"], he: ["his", "his"], they: ["their", "theirs"] }[subj] || ["their", "theirs"];
      line += `. In the narration this body is "you", its parts too: "you lean on the desk", "your arms", "people smile at you", never "${body} leans", "${body}'s arms" or "${subj} leans", even where earlier replies wrote it that way. ${body}'s own things stay ${own} ("${body}'s phone", "${poss} bag"); only ${b.driver}'s own things are "your"`;
    }
    lines.push(`- ${line}.`.replace(/\.\.$/, "."));
    if (body && b.driver && !same(b.driver, body) && sheetOf(body))
      lines.push(who(body, sheetOf(body)));
  }
  const rules = [];
  const roster = rosterOf(l, userName);
  const ownLine = (who) => {
    const own = l.own.find((o) => canon(o.who) === canon(who));
    const busy = own?.doing && !players(who) ? `. Busy with: ${own.doing}` : "";
    lines.push(`- ${who}'s own body: still ${who}'s, awake and in use${own?.notes ? `. ${own.notes}` : ""}${busy}.`.replace(/\.\.$/, "."));
  };
  const groups = multiBodyGroups(l);
  for (const g of groups)
    if (g.ownToo)
      ownLine(g.driver);
  if (roster.some((r) => r.own) && !groups.some((g) => g.ownToo && players(g.driver)))
    ownLine(userName);
  for (const g of groups) {
    const bodies = [...g.bodies, ...g.ownToo ? [`${g.driver}'s own body`] : []];
    const independent = `Each body does its own thing, the way a drummer's limbs play different parts: never the same action at once, never in sync, never mirroring each other (only a mind new to the ability slips into that).`;
    if (g.hidden) {
      rules.push(`${list(bodies)} are all ${g.driver}, but ${userName} doesn't know. Around ${userName} they act like the separate people they appear to be, naturally or a little awkwardly, since one person is playing every part, and narration never shows the link. ${independent}`);
    } else {
      rules.push(`${list(bodies)} are all ${g.driver}: one person in several places. They touch, pleasure, look at and talk about each other freely, since that is one person enjoying their own bodies, but they never converse with each other as if they were separate people, except as staged talk in front of someone who doesn't know. ${independent}`);
    }
  }
  if (roster.length) {
    const names = [...roster.filter((r) => !r.own).map((r) => r.name), ...roster.some((r) => r.own) ? [`${userName}'s own body`] : []];
    rules.push(`${list(names)} belong to ${userName}, the player: write none of them beyond what ${userName} wrote, exactly as you never write ${userName}. Each does only what ${userName} wrote for it, with nothing added. A body ${userName} gave nothing this turn does nothing new: if someone speaks to it or waits on it, write that person and stop, leaving the answer to ${userName}.`);
    const turn = turnLine(roster, userName, lastUserText);
    if (turn)
      rules.push(turn);
  }
  const swapped = l.bodies.filter(knownSwap);
  if (swapped.length) {
    const people = [...new Set(swapped.map((b) => b.driver))];
    const ex = swapped[0];
    rules.push(`${list(people)} ${people.length > 1 ? "have" : "has"} swapped bodies, and for them the narration follows the person, not the body, so it's always clear who is doing what: each keeps their own name and pronouns for what they do, say and think, and the narration says whose body it is wherever that helps ("${ex.driver} reaches out with ${ex.body}'s hand"). People who don't know about the swap still treat each body as its owner. This replaces the naming above for swapped bodies.`);
  }
  for (const b of hidden) {
    const her = (b.pronouns.split("/")[0] || "they").toLowerCase();
    rules.push(`${userName} doesn't know that ${b.body} is ${b.driver}. In narration ${her === "they" ? "they are" : `${her} is`} only ${b.body}, with ${b.body}'s own name and pronouns, and nothing mentions, hints at, or explains that anyone else is inside. ${b.driver}'s habits may show in what ${b.body} does, written as ${b.body}'s own behavior; only what ${userName} could actually notice reaches the page.`);
  }
  const powers = l.powers.map((p) => `${p.who}: ${p.power}`).join("; ");
  const aliases = l.aliases.map((a) => `${a.name} = ${a.aka.join(" = ")}`).join("; ");
  const hasBodies = l.bodies.length > 0 || lines.length > 0;
  const anySheet = lines.some((x) => x.startsWith("  Who ")) || back.length > 0;
  const playerDrives = l.bodies.some((b) => b.body && b.body.toLowerCase() !== "none" && players(b.driver) && !same(b.body, b.driver));
  return [
    "<body_ledger>",
    ...hasBodies ? [
      `Who is in which body right now. Where ${userName} knows, everything the world sees of a body uses that body's own name and pronouns, and anything about the mind inside it (what it wants, decides, thinks, or is) uses the mind's own name and pronouns. Either way, that mind's habits show as the body's own behavior, written plainly, with no narration pointing out who is inside.${playerDrives ? ` In a body ${userName} drives, the narration calls ${userName} "you" for everything instead, and uses the body's name only to say which body.` : ""}`,
      ...lines,
      `Everyone else, ${userName} included unless listed, is in their own body.`
    ] : [],
    ...anySheet ? [`A "Who \u2026 is in their own life" line says who that person is to the people around them: their world, work and habits stay true to it. While someone else drives their body it isn't how the body acts; once they're back in it, it is.`] : [],
    ...back.length ? ["Back in their own bodies and still in the scene, so you play them again:", ...back.map((x) => `- ${x.body}.
${who(x.body, x.text)}`)] : [],
    ...aliases ? [`Same person, different names: ${aliases}.`] : [],
    ...powers ? [`Powers: ${powers}.`] : [],
    ...rules,
    "This is a record kept alongside the story. Where the chat itself says otherwise, the chat wins.",
    "</body_ledger>"
  ].join(`
`);
}
var LINT_SYSTEM = `You cut specific lines out of body-swap roleplay prose. You may ONLY cut. Never add, reword, or move anything.
Cut exactly these, and nothing else:
{{rules}}
Copy each cut exactly, character for character, as it appears in the prose. Cut the smallest piece that removes the problem: a clause, a sentence, or one spoken line together with its speech tag. If nothing needs cutting, answer NONE.
Answer only in this form, one line per cut, or the single word NONE:
CUT: <exact text>`;
function buildLintMessages(text, ledger, userName = "the player") {
  const l = normalizeLedger(ledger);
  const rules = [];
  const groups = multiBodyGroups(l);
  for (const g of groups) {
    const bodies = [...g.bodies, ...g.ownToo ? [g.driver] : []];
    if (!g.hidden) {
      rules.push(`- BODIES CONVERSING. ${list(bodies)} are all one person, ${g.driver}. Cut any spoken line, with its speech tag, in which one of them addresses, answers, jokes with, or argues with another of them as though it were a different person, and narration that frames such an exchange ("a joke with herself", "the other body adds", "answering himself"). NEVER cut touching, kissing, sex, pleasuring, or looking at each other, and never cut one body talking ABOUT another to someone else: those are expected.`);
    }
    rules.push(`- BODIES IN SYNC. Narration in which two or more of ${list(bodies)} do the same thing at the same moment, move in unison, mirror each other, or speak in chorus ("both glance over at the same instant", "all four speaking at once", "in perfect sync"). Cut the sentence or clause that describes it. Different bodies doing different things at once is correct and stays. Leave it only if the story shows ${g.driver} is new to the ability.`);
  }
  const swaps = [...new Set(l.bodies.filter(knownSwap).map((b) => b.body))];
  if (swaps.length)
    rules.push(`- Never cut narration about ${list(swaps)}: they are in a body swap, where naming the person inside and whose body they're in is how the story stays clear ("Rika plants Rowan's big hand on the counter").`);
  const canon = aliasResolver(l);
  const mine = [...new Set(l.bodies.filter((b) => b.body && b.driver && canon(b.driver) === canon(userName) && !same(b.body, b.driver)).map((b) => b.body))];
  if (mine.length)
    rules.push(`- Never cut narration that calls ${userName} "you" in ${list(mine)}, or that names the body to say which one "you" are moving ("as ${mine[0]}, you pour") or whose things they are ("${mine[0]}'s phone"): that is how the story talks about ${userName}'s own bodies. Words like "borrowed" or "isn't hers" still get cut.`);
  if (l.bodies.some((b) => b.body && b.driver && !same(b.body, b.driver) && !knownSwap(b)))
    rules.push(`- POINTERS. Narration that points out someone else is inside a body: "Marcus's mannerism on her face", "his smile on her mouth", "her borrowed face", "someone else's mouth", "a smile that isn't hers", "something behind her eyes", "the amusement doesn't reach her eyes", "the same grin on three faces", "Victor's cadence makes it unsettling", bodies moving in eerie unison. Cut only the pointing words and keep the action: from "Dana rolls her eyes\u2014Marcus's mannerism on her face." cut "\u2014Marcus's mannerism on her face"; from "Cole's borrowed eyes go wide." cut just "borrowed " so it reads "Cole's eyes go wide."`);
  for (const b of l.bodies.filter((b) => b.user_knows === "no" && b.body && b.driver)) {
    const aka = akaOf(l, b.driver);
    rules.push(`- SECRETS. ${userName} does not know that ${b.body} is being driven by ${b.driver}${aka.length ? ` (also called ${aka.join(", ")})` : ""}. Cut narration that reveals or hints at it (naming ${b.driver} as the one inside ${b.body}, "possessed", "inside her", "wearing her", "piloting").`);
  }
  return [
    { role: "system", content: LINT_SYSTEM.replace("{{rules}}", rules.join(`
`)) },
    { role: "user", content: `Prose:
<<<
${text}
>>>` }
  ];
}
function looseMatcher(s) {
  const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let src = "";
  for (const ch of s.trim()) {
    if (/[\u2014\u2013-]/.test(ch))
      src += String.raw`\s*[\u2014\u2013-]\s*`;
    else if (/["\u201C\u201D]/.test(ch))
      src += '["\u201C\u201D]';
    else if (/['\u2018\u2019]/.test(ch))
      src += "['\u2018\u2019]";
    else if (/\s/.test(ch))
      src += String.raw`\s+`;
    else
      src += esc(ch);
  }
  return new RegExp(src.replace(/(\\s\*|\\s\+)+/g, (m) => m.includes("+") ? String.raw`\s+` : String.raw`\s*`));
}
function locateLoose(text, cut) {
  const map = [];
  let stripped = "";
  for (let i = 0;i < text.length; i++)
    if (text[i] !== "*") {
      map.push(i);
      stripped += text[i];
    }
  const m = stripped.match(looseMatcher(cut.replace(/\*/g, "")));
  if (!m)
    return null;
  let s = map[m.index], e = map[m.index + m[0].length - 1] + 1;
  const inner = (text.slice(s, e).match(/\*/g) || []).length;
  if (inner % 2) {
    if (text[e] === "*")
      e++;
    else if (text[s - 1] === "*")
      s--;
  }
  return [s, e];
}
function parseLintResponse(text) {
  return String(text || "").split(`
`).map((l) => l.match(/^\s*CUT:\s*(.+?)\s*$/i)?.[1]).filter(Boolean);
}
function applyCuts(text, cuts) {
  let out = text;
  const applied = [], rejected = [];
  let removed = 0;
  for (let cut of cuts) {
    cut = cut.replace(/^<<<|>>>$/g, "").trim();
    if (!cut)
      continue;
    let at = out.indexOf(cut);
    if (at < 0 && out.indexOf(`*${cut}*`) >= 0) {
      cut = `*${cut}*`;
      at = out.indexOf(cut);
    }
    if (at < 0) {
      const span = locateLoose(out, cut);
      if (span) {
        at = span[0];
        cut = out.slice(span[0], span[1]);
      }
    }
    if (at < 0) {
      rejected.push({ cut, why: "not found verbatim" });
      continue;
    }
    if (cut.length > 400) {
      rejected.push({ cut, why: "too long" });
      continue;
    }
    const quotes = (cut.match(/["\u201C\u201D]/g) || []).length;
    if (quotes % 2) {
      rejected.push({ cut, why: "would break a quote" });
      continue;
    }
    if (removed + cut.length > Math.max(0.4 * text.length, 220)) {
      rejected.push({ cut, why: "too much of the reply" });
      continue;
    }
    const next = deleteSpan(out, at, at + cut.length);
    if (leavesBroken(out, next)) {
      rejected.push({ cut, why: "leaves a broken sentence" });
      continue;
    }
    out = next;
    removed += cut.length;
    applied.push({ action: "CUT", from: cut });
  }
  out = out.replace(/[ \t]*[\u2014\u2013][ \t]*([.!?,;])/g, "$1").replace(/([.!?])[ \t]*[\u2014\u2013][ \t]*(?=\*|"|\u201D|$)/gm, "$1").replace(/,[ \t]*([.!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/ +([,.!?;:])/g, "$1").replace(/\n{3,}/g, `

`).replace(/^[ \t]+|[ \t]+$/gm, "");
  return { text: out, applied, rejected };
}
var PRONOUNS = new Set("he him his himself she her hers herself they them their theirs themself themselves".split(" "));
var needsPronounCheck = (ledger) => normalizeLedger(ledger).bodies.some((b) => b.body && b.driver && !same(b.body, b.driver) && !knownSwap(b));
function hasCrossedBodies(ledger) {
  return normalizeLedger(ledger).bodies.some((b) => b.body && b.driver && !same(b.body, b.driver));
}
var PRONOUN_SYSTEM = `You check one specific mistake in body-swap roleplay prose. Given who is driving which body, find pronouns that refer to the DRIVING MIND itself but use the BODY's gender.
By default, pronouns follow the body, and that is correct: speech tags ("she says"), movements, gestures, looks, clothes, and body parts of a possessed body use the BODY's pronouns. Never touch those.
Only a pronoun whose referent is plainly the driving mind as a person gets the mind's pronouns: its identity and history, its own plans and wants stated as the mind's ("he's wanted this for years"), its attention split across bodies, or its own separate body.
Never change who performs an action, and never replace one character's name with another's.
Example, with Alice's body (she/her) driven by Marcus (he/him):
- "Not long," she says. She sets the eggs down. \u2192 correct, leave it.
- She has been planning this since he first saw her at the gym. \u2192 BAD: the planner is Marcus's mind. FIX: He has been planning this since he first saw her at the gym.
When in doubt, leave it. Report at most three.
Answer only in this form, one pair per mistake, or the single word NONE:
BAD: <the exact sentence, copied character for character>
FIX: <the sentence with only the pronouns or names changed>`;
function buildPronounMessages(text, ledger) {
  const l = normalizeLedger(ledger);
  const map = l.bodies.filter((b) => b.body && b.driver && !same(b.body, b.driver) && !knownSwap(b)).map((b) => `- The body of ${b.body} (${b.pronouns || "?"}) is driven by ${b.driver} (${b.driver_pronouns || "?"}).`).join(`
`);
  return [
    { role: "system", content: PRONOUN_SYSTEM },
    { role: "user", content: `Who is in which body:
${map}${l.aliases.length ? `
Same person, different names: ${l.aliases.map((a) => [a.name, ...a.aka].join(" = ")).join("; ")}` : ""}

Prose:
<<<
${text}
>>>` }
  ];
}
function parsePronounResponse(text) {
  const out = [];
  const lines = String(text || "").split(`
`);
  for (let i = 0;i < lines.length; i++) {
    const bad = lines[i].match(/^\s*BAD:\s*(.+)$/i);
    if (!bad)
      continue;
    const fix = (lines[i + 1] || "").match(/^\s*FIX:\s*(.+)$/i);
    if (fix) {
      out.push({ bad: bad[1].trim(), fix: fix[1].trim() });
      i++;
    }
  }
  return out;
}
var tokens = (s) => String(s).match(/[A-Za-z']+|[^\sA-Za-z']/g) || [];
function applyPronounFixes(text, pairs, ledger) {
  const l = normalizeLedger(ledger);
  const names = new Set([...l.bodies.flatMap((b) => [b.body, b.driver]), ...l.aliases.flatMap((a) => [a.name, ...a.aka])].filter(Boolean).flatMap((n) => n.toLowerCase().split(/\s+/)));
  const swappable = (w) => {
    const x = w.toLowerCase().replace(/'s$/, "");
    return PRONOUNS.has(x) || names.has(x);
  };
  let out = text;
  const applied = [], rejected = [];
  for (const { bad, fix } of pairs) {
    const b = bad.replace(/^[*"\u201C]+|[*"\u201D]+$/g, "").trim(), f = fix.replace(/^[*"\u201C]+|[*"\u201D]+$/g, "").trim();
    if (!b || b === f)
      continue;
    const at = out.indexOf(b);
    if (at < 0) {
      rejected.push({ bad: b, fix: f, why: "sentence not found verbatim" });
      continue;
    }
    const tb = tokens(b), tf = tokens(f);
    if (tb.length !== tf.length) {
      rejected.push({ bad: b, fix: f, why: "changed more than pronouns/names" });
      continue;
    }
    let changed = 0, ok = true;
    for (let i = 0;i < tb.length; i++) {
      if (tb[i] === tf[i])
        continue;
      if (swappable(tb[i]) && swappable(tf[i])) {
        changed++;
        continue;
      }
      if (tb[i].toLowerCase() === tf[i].toLowerCase())
        continue;
      ok = false;
      break;
    }
    if (!ok || !changed) {
      rejected.push({ bad: b, fix: f, why: ok ? "no pronoun or name changed" : "changed more than pronouns/names" });
      continue;
    }
    out = out.slice(0, at) + f + out.slice(at + b.length);
    applied.push({ from: b, to: f });
  }
  return { text: out, applied, rejected };
}
var pairKeyWith = (canon) => (driver, body) => `${canon(driver)}\x00${canon(body)}`;
var pairKey = pairKeyWith(lc);
var rides = (l) => normalizeLedger(l).bodies.filter((b) => b.driver && b.body && !same(b.body, "none") && !same(b.body, b.driver));
function endedRides(before, after) {
  const key = pairKeyWith(aliasResolver(before, after));
  const now = new Set(rides(after).map((b) => key(b.driver, b.body)));
  return rides(before).filter((b) => !now.has(key(b.driver, b.body)));
}
function bodyHistory(snaps, gap = 1) {
  const pairKey = pairKeyWith(aliasResolver(...snaps.map((s) => s.ledger)));
  const open = new Map;
  const closed = [];
  snaps.forEach((snap, si) => {
    const cur = new Map(rides(snap.ledger).map((b) => [pairKey(b.driver, b.body), b]));
    for (const [key, b] of cur) {
      let ep = open.get(key);
      if (!ep) {
        const last = closed.findLast((e) => e.key === key);
        if (last && si - last.lastSeen - 1 <= gap) {
          closed.splice(closed.indexOf(last), 1);
          Object.assign(last, { end: null, notes: null });
          ep = last;
        } else {
          ep = { key, driver: b.driver, body: b.body, start: snap.index, end: null, notes: null };
        }
        open.set(key, ep);
      }
      Object.assign(ep, { driver: b.driver, body: b.body, how: b.how || ep.how || "", host: b.host || ep.host || "", user_knows: b.user_knows, lastSeen: si });
    }
    for (const [key, ep] of open) {
      if (cur.has(key))
        continue;
      ep.end = snap.index;
      open.delete(key);
      closed.push(ep);
    }
    for (const n of normalizeNotes(snap.notes)) {
      const ep = closed.findLast((e) => e.key === pairKey(n.driver, n.body) && e.end === snap.index);
      if (ep)
        ep.notes = n;
    }
  });
  return [...closed, ...open.values()].sort((a, b) => a.start - b.start).map(({ lastSeen, ...ep }) => ep);
}
var phrase = (v, max = 160) => {
  const s = str(v, 400).replace(/[.;,\s]+$/, "");
  if (s.length <= max)
    return s;
  return s.slice(0, max).replace(/[\s,;]+\S*$/, "");
};
function normalizeNotes(raw) {
  return (Array.isArray(raw) ? raw : []).map((n) => ({
    driver: str(n?.driver, 60),
    body: str(n?.body, 60),
    remembers: phrase(n?.remembers),
    kept: phrase(n?.kept),
    left: phrase(n?.left)
  })).filter((n) => n.driver && n.body && (n.remembers || n.kept || n.left));
}
function historyGroups(episodes, { max = 10 } = {}) {
  const pairs = new Map;
  for (const ep of episodes) {
    const key = ep.key ?? pairKey(ep.driver, ep.body);
    const p = pairs.get(key) || { driver: ep.driver, body: ep.body, ended: 0, ongoing: false, lastEnd: -1, how: "", host: "", user_knows: "yes", notes: {} };
    if (ep.end == null)
      p.ongoing = true;
    else {
      p.ended++;
      p.lastEnd = Math.max(p.lastEnd, ep.end);
    }
    p.how = ep.how || p.how;
    p.host = ep.host || p.host;
    p.user_knows = ep.user_knows || p.user_knows;
    for (const k of ["remembers", "kept", "left"])
      if (ep.notes?.[k])
        p.notes[k] = ep.notes[k];
    pairs.set(key, p);
  }
  const groups = new Map;
  for (const p of [...pairs.values()].filter((p) => p.ended)) {
    const sig = JSON.stringify([p.driver.toLowerCase(), p.ended, p.ongoing, p.how, p.notes.remembers ? "" : p.host, p.notes, p.user_knows]);
    const g = groups.get(sig) || { ...p, bodies: [] };
    g.bodies.push(p.body);
    g.lastEnd = Math.max(g.lastEnd, p.lastEnd);
    groups.set(sig, g);
  }
  return [...groups.values()].sort((a, b) => b.lastEnd - a.lastEnd).slice(0, max);
}
function renderHistory(episodes, userName = "{{user}}", { max = 10 } = {}) {
  const lines = historyGroups(episodes, { max }).map((g) => {
    const many = g.bodies.length > 1;
    const who = list(g.bodies);
    const times = (g.ended === 1 ? "once" : g.ended === 2 ? "twice" : `${g.ended} times`) + (many ? " each" : "");
    let line = `- ${g.driver} has been in ${who} ${times}${g.how ? ` (${g.how})` : ""}${g.ongoing ? ", and is again now" : ""}.`;
    if (g.notes.remembers)
      line += ` ${who} ${many ? "remember" : "remembers"}: ${g.notes.remembers}.`;
    else if (g.host)
      line += ` ${many ? "Their own minds" : `${who}'s own mind`} while ridden: ${g.host}.`;
    if (g.notes.kept)
      line += ` ${g.driver} kept: ${g.notes.kept}.`;
    if (g.notes.left)
      line += ` It left ${many ? "them" : who} with: ${g.notes.left}.`;
    if (g.user_knows === "no")
      line += ` HIDDEN from ${userName}.`;
    return line.replace(/\.\./g, ".");
  });
  if (!lines.length)
    return "";
  return [
    "<body_history>",
    `Possessions in this story that have ended (who is in which body right now is in the Body Ledger). This is continuity: people live with the consequences the way they naturally would (lost time, what was taken, what changed), but narration doesn't recap these rides or point back at them, and whatever is hidden from ${userName} stays hidden.`,
    ...lines,
    "</body_history>"
  ].join(`
`);
}
var HISTORY_SYSTEM = `You keep continuity notes for an adult roleplay in which minds take over bodies. One or more possessions have just ended: the driving mind has left the body. From the messages, note for each one:
- remembers: what the body's own person is shown to remember or believe about the ridden time, judged by what they say or do once they're themselves again. "" if the messages don't show them after the ride.
- kept: only something the driver took away on leaving: memories or skills copied out, or an object carried off in another body. Things that stay with the host are not "kept".
- left: lasting consequences for the body's own person, in under 15 words: visible marks, changes to the body, things done or promised in their name. No tastes, aches or feelings.
Give each body only what the messages show for that body. An empty field is better than a wrong one: write "" for anything the messages don't clearly show.
Answer with JSON only, in exactly this shape:
[{"driver":"","body":"","remembers":"","kept":"","left":""}]`;
function buildHistoryMessages(ended, messages) {
  const list = ended.map((b) => `- ${b.driver} has left ${b.body}${b.host ? ` (while ridden, ${b.body}'s own mind was ${b.host})` : ""}`).join(`
`);
  return [
    { role: "system", content: HISTORY_SYSTEM },
    { role: "user", content: `Possessions that just ended:
${list}

Newest messages, oldest first:
${messages.map((m) => `### ${m.name}
${clip(m.text, 2500)}`).join(`

`)}

Now output the JSON.` }
  ];
}
function parseHistoryResponse(text, ended) {
  let raw = firstJson(text, "[");
  if (!Array.isArray(raw)) {
    const one = firstJson(text);
    raw = one && typeof one === "object" ? [one] : null;
  }
  if (!Array.isArray(raw))
    return [];
  const wanted = new Set(ended.map((e) => pairKey(e.driver, e.body)));
  const empty = /^(none|none shown|not shown|n\/a|unknown|nothing stated|not stated|-)$/i;
  return normalizeNotes(raw.map((n) => ({ ...n, ...Object.fromEntries(["remembers", "kept", "left"].map((k) => [k, empty.test(String(n?.[k] ?? "").trim()) ? "" : n?.[k]])) }))).filter((n) => wanted.has(pairKey(n.driver, n.body)));
}

// src/core/mind-core.js
var MIND_MODES = { hypnosis: "Hypnosis", control: "Mind Control", perception: "Altered Perception" };
var KINDS = ["hypnosis", "control", "perception"];
var STAGES = ["awake", "light", "medium", "deep", "somnambulistic"];
var WILL_KINDS = ["wants", "feels", "believes", "loyal to", "command"];
var EDIT_KINDS = ["unseen", "normal", "false"];
var EMPTY_BOOK = Object.freeze({ hypnosis: [], control: [], perception: [] });
var str2 = (v, n = 160) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
var listOf2 = (v) => Array.isArray(v) ? v : v == null || v === "" ? [] : [v];
var names2 = (v) => listOf2(v).flatMap((x) => String(x ?? "").split(/\s*,\s*|\s+and\s+|\s*&\s*/)).map((x) => str2(x, 60)).filter(Boolean);
var yes = (v) => /^\s*(y|true)/i.test(String(v ?? ""));
var no = (v) => /^\s*(n|false)/i.test(String(v ?? ""));
var canon = (s) => str2(s).toLowerCase();
var same2 = (a, b) => !!a && canon(a) === canon(b);
var rank = (s) => STAGES.indexOf(s);
function stageOf(v) {
  const s = canon(v);
  if (!s)
    return "";
  if (/somnam/.test(s))
    return "somnambulistic";
  return STAGES.find((x) => s.startsWith(x)) || (/^(woke|wakes|out of|not under|none)/.test(s) ? "awake" : "");
}
function normSubject(h) {
  const deepest = stageOf(h?.deepest);
  return {
    who: str2(h?.who, 60),
    by: str2(h?.by, 60),
    susceptibility: ["low", "average", "high"].find((x) => canon(h?.susceptibility).startsWith(x)) || "",
    times: Math.max(0, Math.min(999, parseInt(h?.times, 10) || 0)),
    deepest: deepest === "awake" ? "" : deepest,
    now: stageOf(h?.now) || "awake",
    suggestions: listOf2(h?.suggestions).map((x) => {
      const stage = stageOf(x?.stage);
      return { text: str2(typeof x === "string" ? x : x?.text, 220), stage: stage === "awake" ? "" : stage, times: Math.max(1, parseInt(x?.times, 10) || 1) };
    }).filter((x) => x.text).slice(0, 12),
    triggers: listOf2(h?.triggers).map((x) => ({ cue: str2(x?.cue, 50).replace(/^["\u201C']|["\u201D']$/g, ""), effect: str2(x?.effect, 180) })).filter((x) => x.cue && x.effect).slice(0, 12),
    amnesia: yes(h?.amnesia) ? "yes" : "no",
    user_knows: no(h?.user_knows) ? "no" : "yes"
  };
}
function normWill(w, i) {
  return {
    id: str2(w?.id, 8) || `c${i + 1}`,
    who: names2(w?.who ?? w?.subjects).slice(0, 12),
    by: str2(w?.by, 60),
    set: listOf2(w?.set ?? w?.will).map((x) => {
      const kind = WILL_KINDS.find((k) => canon(x?.kind).startsWith(k.split(" ")[0])) || "wants";
      return { kind, text: str2(typeof x === "string" ? x : x?.text, 220) };
    }).filter((x) => x.text).slice(0, 10),
    own: str2(w?.own ?? w?.untouched, 220),
    resists: yes(w?.resists) ? "yes" : "no",
    user_knows: no(w?.user_knows) ? "no" : "yes"
  };
}
function normEdit(e, i) {
  const kind = EDIT_KINDS.find((k) => canon(e?.kind).startsWith(k)) || (str2(e?.target) ? "unseen" : "normal");
  return {
    id: str2(e?.id, 8) || `p${i + 1}`,
    what: str2(e?.what, 220),
    kind,
    target: kind === "unseen" ? str2(e?.target, 60) : "",
    who: names2(e?.who).slice(0, 12),
    everyone: yes(e?.everyone),
    except: names2(e?.except).slice(0, 12),
    by: str2(e?.by, 60),
    user_knows: no(e?.user_knows) ? "no" : "yes"
  };
}
function renumber(list, prefix) {
  const seen = new Set;
  let n = 0;
  for (const x of list) {
    if (!x.id || seen.has(x.id) || !x.id.startsWith(prefix)) {
      do
        n++;
      while (list.some((y) => y.id === `${prefix}${n}`) || seen.has(`${prefix}${n}`));
      x.id = `${prefix}${n}`;
    }
    seen.add(x.id);
  }
  return list;
}
function normalizeBook(raw) {
  const hyp = [];
  for (const h of listOf2(raw?.hypnosis).map(normSubject).filter((h) => h.who))
    if (!hyp.some((x) => same2(x.who, h.who)))
      hyp.push(h);
  return {
    hypnosis: hyp.slice(0, 24),
    control: renumber(listOf2(raw?.control).map(normWill).filter((w) => w.who.length && (w.set.length || w.own)), "c").slice(0, 24),
    perception: renumber(listOf2(raw?.perception).map(normEdit).filter((e) => e.what && (e.who.length || e.everyone)), "p").slice(0, 24)
  };
}
var isEmptyBook = (b) => !b || KINDS.every((k) => !listOf2(b[k]).length);
var WORDS = {
  hypnosis: /%%trance%%|\b(trance\w*|hypno\w*|induc(e|ed|es|ing|tion|tions)\b|deepen\w*|deeper and deeper|suggestion\w*|trigger\w*|pendulum|fractionat\w*|conditioning|post-hypnotic|awaken\w*|wake up|wakes up|snaps? (?:her|his|their|my|your) fingers|count(?:s|ed|ing)? (?:down|back)|go(?:ing|es)? under|went under|sink(?:ing|s)? deeper)/i,
  control: /%%control%%|\b(command(?:s|ed)?|obey\w*|compel\w*|your will|my will|(?:his|her|their) will|bend\w* to|mind control\w*|controll(?:ed|ing)|loyal\w*|devot\w*|from now on|you want to|let(?:s|ting)? go of|releas(?:e|es|ed|ing)|resist\w*|fight(?:s|ing)? (?:it|back|the control)|struggl\w+ against|break(?:s|ing)? free|snap(?:s|ped)? out of|(?:her|his|their|your|my) mind|free(?:d|s)? (?:her|him|them|you))\b/i,
  perception: /\b((?:can|could)(?:'?t|not)? (?:see|hear|perceive|notice)|(?:doesn'?t|don'?t|didn'?t|won'?t) (?:see|hear|notice)|invisible|unseen|unnoticed|perceiv\w*|perception|always been|perfectly normal|completely normal|totally normal|nothing strange|rewrit\w+|(?:edit|chang)(?:ed|es|ing)? (?:her|his|their|your) (?:mind|memory|memories|reality|perception))\b/i
};
function needsUpdate(kind, book, text) {
  const t = String(text || "");
  if (WORDS[kind]?.test(t))
    return true;
  if (kind === "hypnosis") {
    const b = normalizeBook(book);
    if (b.hypnosis.some((h) => h.now !== "awake"))
      return true;
    if (b.hypnosis.some((h) => h.triggers.some((tr) => cueRe(tr.cue).test(t))))
      return true;
  }
  return false;
}
var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var cueRe = (cue) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(cue)}(?=$|[^\\p{L}\\p{N}])`, "iu");
var SHARED = (userName) => `Rules for every field:
- Go by what the messages show happening, not by guesses. The card sets the defaults; the messages show what changed.
- user_knows is "no" only when ${userName}, the player, isn't aware of it; once "yes" it stays "yes".
- Copy names exactly as the story writes them.
- Answer with JSON only. If nothing in the new messages changes this record, answer {}.`;
var PROMPTS = {
  hypnosis: (userName) => `You keep the hypnosis record for an adult roleplay. Hypnosis here is realistic: inductions take patience and skill, depth comes in stages, and repeated sessions make a subject go under faster and deeper.
Stages, lightest to deepest, and how each shows:
- light: relaxed, still aware and able to chat, blinking slowed, time blurring;
- medium: heavy limbs, slumping, answers that come late, soft and literal;
- deep: still, eyes closed or fixed and glassy, a flat voice, little or no response beyond murmured agreement;
- somnambulistic: eyes open, moving and talking and looking normal while completely under, carrying out commands.
A deepener (counting down, "deeper", fractionation) usually takes them a stage further; judge the stage by what the messages show.
For each hypnotized person the record holds:
- by: who hypnotizes them;
- susceptibility: low, average or high (from the card or what the story shows; blank if nothing says);
- now: their stage at the END of the new messages (waking, being snapped out, or the session ending makes it "awake");
- went_under: true only when the new messages show them going into trance from awake;
- suggestions: lasting instructions or changes planted in trance, each written as what it makes the subject do or feel, in plain words about them rather than the hypnotist's own phrasing, with the stage they were in when it was planted, and reinforced: true when the new messages plant it again. A one-off order carried out on the spot is not a suggestion, and neither is an instruction to forget (that is amnesia);
- triggers: a cue (word, phrase, gesture, sound) set to bring on an effect later: cue exactly as given, effect in plain words about the subject;
- amnesia: "yes" when they were told to forget the session;
- user_knows.
Answer with ONLY the people whose record changed, each as their WHOLE current record (copy what still holds, change what the messages changed, leave out what was removed), in this shape:
{"hypnosis":[{"who":"","by":"","susceptibility":"","now":"","went_under":false,"suggestions":[{"text":"","stage":"","reinforced":false}],"triggers":[{"cue":"","effect":""}],"amnesia":"no","user_knows":"yes"}]}
Only people who are actually hypnotized go in the record.
${SHARED(userName)}`,
  control: (userName) => `You keep the mind control record for an adult roleplay. Mind control here means a controller has taken hold of someone's mind: they set what that person wants, feels, believes or is loyal to, or give a standing command, and the person takes it up as their own wish.
Each entry holds:
- id: keep the id of an entry you change; leave it out for a new one;
- who: the person under control, or several people given the same will;
- by: the controller;
- set: what the controller has set, as a list of {kind, text}, kind one of: wants, feels, believes, loyal to, command. When a new setting conflicts with an older one, keep only the newer. A one-off order carried out on the spot is not worth recording; a standing one ("from now on\u2026") is, and so is any want, feeling or belief the controller puts in them, even one about what's right in front of them (a %%control%% moment always puts one in);
- own: what is still their own (personality, skills, relationships the control left alone), or, when the card or what has happened in play makes controlled people blank drones or zombies, say exactly that;
- resists: "yes" when the card or what has happened in play has this person aware of the control, pushing against it, or only partly under it; otherwise "no". Never "yes" on a guess: only when it has been set up;
- released: true when the control is lifted entirely;
- user_knows.
Answer with ONLY entries that are new or changed, each as its WHOLE current record, in this shape:
{"control":[{"id":"","who":[""],"by":"","set":[{"kind":"","text":""}],"own":"","resists":"no","released":false,"user_knows":"yes"}]}
Someone taking over a body (possessing it, wearing it, swapping into it, puppeting it, absorbing it into a hive) is not mind control: the person's own mind isn't the one acting, and the Body Ledger keeps that. Leave it out.
${SHARED(userName)}`,
  perception: (userName) => `You keep the altered-perception record for an adult roleplay: edits someone's power has made to what people perceive or take as true. Three kinds:
- unseen: they cannot perceive someone or something (target: who or what);
- normal: something they now treat as ordinary, and always so;
- false: something untrue they now believe as plain fact.
Each edit holds:
- id: keep the id of an edit you change; leave it out for a new one;
- what: the edit in a few plain words, without repeating who has it (for unseen: what they miss, e.g. everything the target says and does);
- kind, and target (only for unseen);
- who: the people who have the edit; or everyone: true with except listing anyone left out;
- by: who made the edit;
- undone: true only when the edit is reversed for everyone who has it. When it is lifted for some of them, keep the edit and take those people out of who (or add them to except);
- user_knows.
Answer with ONLY edits that are new or changed, each WHOLE, in this shape:
{"perception":[{"id":"","what":"","kind":"","target":"","who":[""],"everyone":false,"except":[""],"by":"","undone":false,"user_knows":"yes"}]}
${SHARED(userName)}`
};
function buildMindMessages(kind, { book, messages, context = [], userName = "the player", card = "" }) {
  const b = normalizeBook(book);
  const fmt = (list) => list.map((m) => `${m.name}: ${m.text}`).join(`

`);
  const parts = [];
  if (card)
    parts.push(`Character card:
<<<
${String(card).slice(0, 5000)}
>>>`);
  parts.push(`The record so far:
${JSON.stringify({ [kind]: b[kind] })}`);
  if (context.length)
    parts.push(`Earlier (already in the record):
<<<
${fmt(context)}
>>>`);
  parts.push(`New messages:
<<<
${fmt(messages)}
>>>`);
  parts.push(`Answer with the changed ${kind === "perception" ? "edits" : kind === "control" ? "entries" : "people"} as JSON, or {} if nothing changed.`);
  return [
    { role: "system", content: PROMPTS[kind](userName) },
    { role: "user", content: parts.join(`

`) }
  ];
}
function firstJson2(text) {
  const r = String(text || "");
  for (let n = r.indexOf("{");n >= 0; n = r.indexOf("{", n + 1)) {
    let depth = 0, inStr = false;
    for (let i = n;i < r.length; i++) {
      const ch = r[i];
      if (inStr) {
        if (ch === "\\")
          i++;
        else if (ch === '"')
          inStr = false;
        continue;
      }
      if (ch === '"')
        inStr = true;
      else if (ch === "{")
        depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(r.slice(n, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
function applyMindUpdate(kind, book, answer) {
  const prev = normalizeBook(book);
  const raw = firstJson2(answer);
  if (!raw)
    return /^\s*(\{\s*\}|none|no changes?\.?)\s*$/i.test(String(answer || "")) ? prev : null;
  const items = listOf2(raw[kind] ?? (Array.isArray(raw) ? raw : []));
  const next = { ...prev, [kind]: [...prev[kind]] };
  if (kind === "hypnosis") {
    for (const it of items) {
      const n = normSubject(it);
      if (!n.who)
        continue;
      const i = next.hypnosis.findIndex((h) => same2(h.who, n.who));
      const old = i >= 0 ? next.hypnosis[i] : normSubject({ who: n.who });
      const merged = { ...old, ...n, times: old.times, deepest: old.deepest };
      if (!stageOf(it?.now))
        merged.now = old.now;
      if (!str2(it?.by))
        merged.by = old.by;
      if (!n.susceptibility)
        merged.susceptibility = old.susceptibility;
      if (!("suggestions" in (it || {})))
        merged.suggestions = old.suggestions;
      if (!("triggers" in (it || {})))
        merged.triggers = old.triggers;
      if (old.user_knows === "yes")
        merged.user_knows = "yes";
      if (it?.amnesia === undefined)
        merged.amnesia = old.amnesia;
      if (old.now === "awake" && (yes(it?.went_under) || merged.now !== "awake"))
        merged.times = old.times + 1;
      merged.suggestions = merged.suggestions.map((s, k) => {
        const was = old.suggestions.find((o) => canon(o.text) === canon(s.text));
        const again = yes(listOf2(it?.suggestions)[k]?.reinforced);
        const stage = s.stage || was?.stage || (merged.now !== "awake" ? merged.now : "");
        return { text: s.text, stage: was && rank(was.stage) > rank(stage) ? was.stage : stage, times: (was?.times || 0) + (again || !was ? 1 : 0) || 1 };
      });
      for (const st of [merged.now, ...merged.suggestions.map((x) => x.stage)])
        if (rank(st) > rank(merged.deepest || "awake"))
          merged.deepest = st;
      if (merged.deepest && !merged.times)
        merged.times = 1;
      if (i >= 0)
        next.hypnosis[i] = merged;
      else
        next.hypnosis.push(merged);
    }
  } else {
    const norm = kind === "control" ? normWill : normEdit;
    for (const it of items) {
      const gone = yes(kind === "control" ? it?.released : it?.undone);
      const id = str2(it?.id, 8);
      let i = id ? next[kind].findIndex((x) => x.id === id) : -1;
      if (i < 0 && kind === "control") {
        const who = names2(it?.who ?? it?.subjects).map(canon);
        i = next.control.findIndex((w) => same2(w.by, it?.by) && w.who.some((x) => who.includes(canon(x))));
      }
      if (i < 0 && kind === "perception")
        i = next.perception.findIndex((e) => canon(e.what) === canon(it?.what));
      if (gone) {
        if (i >= 0)
          next[kind].splice(i, 1);
        continue;
      }
      const n = norm(it, next[kind].length);
      if (i >= 0) {
        const old = next[kind][i];
        const merged = { ...n, id: old.id };
        if (old.user_knows === "yes")
          merged.user_knows = "yes";
        if (kind === "control" && !merged.own)
          merged.own = old.own;
        if (kind === "control" && it?.resists === undefined)
          merged.resists = old.resists;
        if (!merged.by)
          merged.by = old.by;
        next[kind][i] = merged;
      } else
        next[kind].push({ ...n, id: "" });
    }
  }
  return normalizeBook(next);
}
var bare = (t) => String(t || "").replace(/[\s.;:!?]+$/, "");
var join = (list) => list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
var isPlayer = (who, userName) => same2(who, userName);
var STAGE_LINE = {
  light: "a light trance: relaxed and still aware, time starting to blur, blinking slowed. Simple suggestions take, but only for this session, and most of it will be remembered",
  medium: "a medium trance: heavy limbs, slow soft answers after a pause, words taken literally. Suggestions hold for hours to days, and only pieces will be remembered",
  deep: "a deep trance: still, eyes closed or fixed and glassy, a flat voice. Lasting conditioning and complex triggers take hold here, and memories can be changed",
  somnambulistic: "a somnambulistic trance: eyes open, moving and talking and looking entirely normal while completely under. Near-total control; everything can be forgotten on command, and commands against waking habits are carried out"
};
var LASTS = { light: "for this session", medium: "for hours to days", deep: "lasting", somnambulistic: "lasting" };
var REMEMBERS = { light: "remembered", medium: "half-remembered", deep: "not remembered in detail", somnambulistic: "not remembered" };
var NOT_FIRST_NAMES2 = /^(?:the|mr|mrs|ms|miss|mx|dr|doctor|sir|lady|lord|madam|officer|detective|professor|prof|aunt|uncle|old|young|little|big|saint|st|captain|sergeant|nurse|coach|father|mother|sister|brother)$/i;
function firstNameIn(text, name) {
  const w = String(name || "").trim().split(/\s+/);
  if (w.length < 2 || !/^\p{Lu}\p{L}{2,}$/u.test(w[0]) || NOT_FIRST_NAMES2.test(w[0]))
    return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${w[0]}(?![\\p{L}\\p{N}])`, "u").test(String(text || ""));
}
function nameIn(text, names) {
  const t = String(text || "");
  return names.filter(Boolean).some((n) => new RegExp(`(?<![\\p{L}\\p{N}])${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(t));
}
function subjectLine(h, userName) {
  const conditioned = h.times >= 3 || rank(h.deepest) >= rank("deep") || h.susceptibility === "high";
  const by = h.by ? ` (hypnotized by ${h.by})` : "";
  const history = h.times ? `Under ${h.times === 1 ? "once" : h.times === 2 ? "twice" : `${h.times} times`} so far, deepest ${h.deepest || "light"}` : "Never hypnotized before";
  const sus = h.susceptibility === "high" ? "; highly susceptible, goes under fast and deepens easily" : h.susceptibility === "low" ? "; hard to hypnotize: every step deeper takes longer, and drifts back up easily" : "";
  const state = h.now === "awake" ? h.times ? `Awake. ${conditioned ? "A rapid induction works now." : "A formal induction still takes a while, and each time under makes the next one quicker."}` : `Awake. A first induction takes patience (a long relaxation, or fixation on one point)${conditioned ? ", though a rapid one can work on someone this susceptible." : ", and a rapid induction won't work yet."}` : `In ${STAGE_LINE[h.now]}.`;
  const sugg = h.suggestions.map((s) => {
    const lasts = s.times >= 3 ? "lasting, reinforced" : LASTS[s.stage] || "for now";
    const mem = h.amnesia === "yes" ? "not remembered" : REMEMBERS[s.stage] || "remembered";
    return `${bare(s.text)} (${lasts}; receiving it ${mem})`;
  });
  const trig = h.triggers.map((t) => `"${t.cue}" \u2192 ${bare(t.effect)}`);
  const out = [`- ${h.who}${by}: ${state} ${history}${sus}.`];
  if (sugg.length)
    out.push(`  Suggestions, acted on as ${h.who}'s own ideas with ordinary reasons: ${sugg.join("; ")}.`);
  if (trig.length)
    out.push(`  Triggers, firing exactly on cue without ${h.who} noticing the cue: ${trig.join("; ")}.`);
  if (h.amnesia === "yes" && h.now === "awake")
    out.push(`  ${h.who} was told to forget the sessions and has no memory of them.`);
  if (isPlayer(h.who, userName))
    out.push(`  ${h.who} is the player: write what the trance does to ${h.who}'s body and behavior, and leave ${h.who}'s inner experience to the player.`);
  if (h.user_knows === "no")
    out.push(`  ${userName} doesn't know about this: narration shows only what ${userName} could notice.`);
  return out.join(`
`);
}
var EMPTIED = /^\s*(nothing|none)\b|\b(empty|emptied|blank|drone|zombie|hollow|mindless|no self)\b/i;
function willLine(w, userName) {
  const who = join(w.who);
  const whose = w.who.length > 1 ? "their" : `${w.who[0]}'s`;
  const set = w.set.map((x) => x.kind === "command" ? `standing command: ${bare(x.text)}` : x.kind === "loyal to" ? `loyal to ${bare(x.text)}` : `${x.kind} ${bare(x.text)}`);
  const out = [`- ${who}${w.by ? ` (controlled by ${w.by})` : ""}: ${set.join("; ") || "under control"}.`];
  if (w.own && EMPTIED.test(w.own))
    out.push(`  ${w.own}.`.replace(/\.\.$/, "."));
  else if (w.resists === "yes") {
    out.push(`  ${w.own ? `Still ${whose} own: ${bare(w.own)}. ` : ""}As it has been set up, ${who} ${w.who.length > 1 ? "are" : "is"} aware of the control and ${w.who.length > 1 ? "push" : "pushes"} against it; keep that struggle where it was left, neither dropping it nor resolving it on your own.`);
  } else {
    const own = w.own ? `Still ${whose} own: ${w.own}.`.replace(/\.\.$/, ".") : `Everything else about ${who} is still ${whose} own.`;
    out.push(`  ${own} The control is felt as ${whose} own wish and pursued with ${whose} own wits and style; nothing in ${who} strains against it.`);
  }
  if (w.who.some((x) => isPlayer(x, userName)))
    out.push(`  ${userName} is the player: write the changed behavior, and leave ${userName}'s inner experience to the player.`);
  if (w.user_knows === "no")
    out.push(`  ${userName} doesn't know about this: narration shows only what ${userName} could notice.`);
  return out.join(`
`);
}
var holders = (e) => e.everyone ? `Everyone${e.except.length ? ` except ${join(e.except)}` : ""}` : join(e.who);
function editLine(e, userName) {
  const who = holders(e);
  const by = e.by ? ` (edited by ${e.by})` : "";
  let line;
  if (e.kind === "unseen") {
    const t = e.target || "it";
    line = `- ${who} can't perceive ${t}${by}: ${bare(e.what)}. They step around ${t} without a thought, hear nothing ${t} says, and give an ordinary cause to anything ${t} does; the gap is never noticed.`;
  } else if (e.kind === "false")
    line = `- ${who} believe${e.everyone || e.who.length > 1 ? "" : "s"} as plain fact${by}: ${bare(e.what)}. Defended sincerely; there is no seam and no memory of believing otherwise.`;
  else
    line = `- ${who} take${e.everyone || e.who.length > 1 ? "" : "s"} as ordinary and always so${by}: ${bare(e.what)}. Defended sincerely; people reacting otherwise get reinterpreted, never doubted.`;
  if (e.user_knows === "no")
    line += `
  ${userName} doesn't know about this: narration shows only what ${userName} could notice.`;
  return line;
}
function watchLines(book, { latest = "", recent = "", userName = "the player" } = {}) {
  const b = normalizeBook(book);
  const out = [];
  const here = (n) => n && cueRe(n).test(recent);
  for (const h of b.hypnosis)
    for (const t of h.triggers) {
      if (cueRe(t.cue).test(latest))
        out.push(`"${t.cue}" was just said. It is ${h.who}'s trigger (${t.effect}): if ${h.who} heard it, it fires now, exactly as set.`);
    }
  for (const w of b.control) {
    const present = w.who.filter(here);
    if (present.length && w.resists !== "yes" && !(w.own && EMPTIED.test(w.own)))
      out.push(`${join(present)} ${present.length > 1 ? "are" : "is"} in this scene: what ${w.by || "the controller"} set is simply what ${join(present)} ${present.length > 1 ? "want" : "wants"} right now, pursued ${present.length > 1 ? "in their own ways" : `in ${present[0]}'s own way`}, with nothing pulling against it.`);
  }
  for (const e of b.perception.filter((x) => x.kind === "unseen" && here(x.target))) {
    const blind = e.everyone ? null : e.who.filter(here);
    if (blind && !blind.length)
      continue;
    const sees = e.everyone ? e.except.filter(here) : [];
    const who = blind ? join(blind) : holders(e);
    const v = (verb) => (blind ? blind.length === 1 : true) ? `${verb}s` : verb;
    out.push(`${e.target} is in this scene, and ${who} can't perceive ${e.target}. Anything ${e.target} does or says, ${who} ${v("step")} around without noticing; when someone talks to ${e.target}, ${who} ${v("hear")} them talking to nobody and ${v("find")} a reason for it.${sees.length ? ` ${join(sees)} see${sees.length === 1 ? "s" : ""} ${e.target} normally.` : ""}`);
  }
  return out;
}
function renderMindBook(book, userName = "the player", { kinds = KINDS, latest = "", recent = "", scene = null } = {}) {
  const b = normalizeBook(book);
  const named = (names) => scene == null || names.some((n) => nameIn(scene, [n]) || firstNameIn(scene, n));
  const here = {
    hypnosis: b.hypnosis.filter((h) => h.now !== "awake" || named([h.who])),
    control: b.control.filter((w) => named(w.who)),
    perception: b.perception.filter((e) => e.everyone || named([...e.who, e.target]))
  };
  const away = [
    ...kinds.includes("hypnosis") ? b.hypnosis.filter((h) => !here.hypnosis.includes(h)).map((h) => `${h.who} (hypnotized${h.by ? ` by ${h.by}` : ""})`) : [],
    ...kinds.includes("control") ? b.control.filter((w) => !here.control.includes(w)).map((w) => `${join(w.who)} (controlled${w.by ? ` by ${w.by}` : ""})`) : [],
    ...kinds.includes("perception") ? b.perception.filter((e) => !here.perception.includes(e)).map((e) => `${join(e.who)} (altered perception)`) : []
  ];
  const parts = [];
  if (kinds.includes("hypnosis") && here.hypnosis.length)
    parts.push("Hypnosis (realistic: patience, stages, repetition):", ...here.hypnosis.map((h) => subjectLine(h, userName)));
  if (kinds.includes("control") && here.control.length)
    parts.push("Mind control:", ...here.control.map((w) => willLine(w, userName)));
  if (kinds.includes("perception") && here.perception.length)
    parts.push("Altered perception:", ...here.perception.map((e) => editLine(e, userName)));
  if (away.length)
    parts.push(`Also in the book, not in this scene (their full entries come back when they are): ${away.join("; ")}.`);
  const watch = watchLines({ hypnosis: kinds.includes("hypnosis") ? b.hypnosis : [], control: kinds.includes("control") ? b.control : [], perception: kinds.includes("perception") ? b.perception : [] }, { latest, recent, userName });
  if (!parts.length && !watch.length)
    return "";
  return [
    "<mind_book>",
    "What mind-changing powers have put into people, as it stands now. Where the chat itself says otherwise, the chat wins.",
    ...parts,
    ...watch.length ? ["Right now:", ...watch.map((w) => `- ${w}`)] : [],
    "</mind_book>"
  ].join(`
`);
}
var TRAPPED = new RegExp([
  String.raw`\b(?:trapped|caged|locked|imprisoned|buried)\s+(?:deep\s+)?(?:inside|within|in)\s+(?:her|his|their|your|my)\s+(?:own\s+)?(?:mind|head|body|skull)`,
  String.raw`\b(?:somewhere|deep)\s+(?:deep\s+)?(?:inside|within|down)(?:\s+(?:her|him|them|you))?,?\s+(?:a|some)\s+(?:small|tiny|distant|faint|buried)?\s*(?:part|voice|piece|corner)`,
  String.raw`\ba\s+(?:small|tiny|distant|faint|buried|last)\s+(?:part|voice|piece|corner|spark)\s+of\s+(?:her|him|them|you|his|their|your)(?:\s+(?:mind|self))?\s+(?:screamed|screams|fought|fights|struggled|struggles|protested|protests|resisted|resists|begged|begs|cried|cries|knew|knows|railed|rails|clawed|claws)`,
  String.raw`\b(?:fought|fights|struggled|struggles|strained|strains|pushed|pushes)\s+against\s+the\s+(?:control|compulsion|command|commands|order|orders|pull|grip|hold)`,
  String.raw`\bagainst\s+(?:her|his|their|your|my)\s+(?:own\s+)?will\b`,
  String.raw`\b(?:her|his|their|your|my)\s+body\s+(?:moved|moves|acted|acts)\s+on\s+its\s+own`,
  String.raw`\b(?:screaming|screamed|screams)\s+(?:inside|silently|inwardly)`
].join("|"), "i");
var resistanceSetUp = (text) => /\b(resists?|resisting|resistance|fight(?:s|ing)? (?:it|back|the control|against)|push(?:es|ing)? (?:back )?against (?:it|the control)|struggl(?:es?|ing) against|trapped (?:inside|in (?:her|his|their) (?:own )?(?:mind|head|body))|inner (?:scream|voice)|partial control|breaks? free|aware (?:of being|that (?:she|he|they) (?:is|are) being) controlled)\b/i.test(String(text || ""));
function trappedSelfCuts(text) {
  const out = [];
  const s = String(text || "");
  for (const m of s.matchAll(/[^.!?\n*"\u201C\u201D]+[.!?]+/g)) {
    const sentence = m[0].trim();
    if (TRAPPED.test(sentence))
      out.push(sentence);
  }
  return out;
}

// src/core/persona-core.js
var PERSONA_FIELDS = ["Look", "Voice & habits", "Life"];
var PERSONA_SYSTEM = `You write short reference sheets for an adult roleplay. Each sheet describes one person whose body someone else is driving right now (possession, a skinsuit, a hive mind, puppetry and the like), as that person is in their own life, so the story keeps their world consistent.
Write only about who they are. Never write what the one driving their body does, wants, thinks or feels, and never mention the takeover.
Take everything you can from the character card and the chat. Where they say nothing, invent small, ordinary, specific details that fit, and keep them consistent with everything shown; never write that something isn't mentioned or known. Describe their look plainly, the way a friend would, never in sexual terms. They are adults: never describe them as teenagers, minors or high school students, and never put them in a school uniform (no need to say they're adults).
Each field is one short sentence of about 15 words, so the whole sheet stays around 45 words: the two or three details that matter most, never a full description. Answer in exactly this form and nothing else:
Look: what people notice first about them
Voice & habits: how they talk, and one small habit
Life: what they do and who they live with`;
var clip2 = (s, n) => String(s || "").length > n ? `${String(s).slice(0, n)}\u2026` : String(s || "");
function buildPersonaMessages({ body, row = {}, card = "", messages = [], userName = "User" }) {
  const facts = [row.pronouns && `pronouns: ${row.pronouns}`, row.how && `taken by: ${row.how}`, row.notes && `right now: ${row.notes}`].filter(Boolean).join("; ");
  const parts = [
    card ? `Character card:
${clip2(card, 3500)}` : "",
    `The player's character is ${userName}.`,
    `Recent messages, oldest first:
${messages.map((m) => `### ${m.name}
${clip2(m.text, 1800)}`).join(`

`)}`,
    `Write the sheet for ${body}${facts ? ` (${facts})` : ""}.`
  ].filter(Boolean);
  return [{ role: "system", content: PERSONA_SYSTEM }, { role: "user", content: parts.join(`

`) }];
}
function parsePersona(text) {
  const out = {};
  const t = String(text || "").replace(/\*\*/g, "").replace(/^\s*[-\u2022]\s*/gm, "");
  for (const f of PERSONA_FIELDS) {
    const re = new RegExp(`^\\s*${f.replace("&", "(?:&|and)")}\\s*:\\s*(.+?)\\s*$`, "im");
    const m = t.match(re);
    if (m && m[1].trim())
      out[f] = m[1].trim();
  }
  if (Object.keys(out).length < 2)
    return null;
  if (MINOR.test(Object.values(out).join(" ")))
    return null;
  for (const f of Object.keys(out))
    out[f] = capWords(out[f]);
  return out;
}
var MAX_FIELD_WORDS = 25;
function capWords(text, max = MAX_FIELD_WORDS) {
  const words = String(text).split(/\s+/);
  if (words.length <= max)
    return text;
  let cut = words.slice(0, max).join(" ");
  const at = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(";"), cut.lastIndexOf(" and "));
  if (at > cut.length * 0.5)
    cut = cut.slice(0, at);
  return `${cut.replace(/[\s,;:\u2014\u2013-]+$/, "")}.`;
}
var MINOR = /\b(underage|(?:is|as|still) a minor|middle[- ]schooler|middle[- ]school student|in middle school|junior high student|in junior high|elementary[- ]schooler|in elementary school)\b/i;
var describesMinor = (text) => MINOR.test(String(text || ""));
function personaText(sheet) {
  return PERSONA_FIELDS.filter((f) => sheet?.[f]).map((f) => `${f}: ${sheet[f]}`).join(`
`);
}
function sheetFromFields(fields = {}) {
  const sheet = {};
  for (const f of PERSONA_FIELDS) {
    const v = String(fields[f] ?? "").replace(/\s+/g, " ").trim();
    if (v)
      sheet[f] = v;
  }
  if (!Object.keys(sheet).length)
    return { sheet: null, minor: false };
  if (MINOR.test(Object.values(sheet).join(" ")))
    return { sheet: null, minor: true };
  return { sheet, minor: false };
}
var LOOK_SYSTEM = `You describe how one person in an adult roleplay looks, for a picture of them. Answer with one plain sentence of about 25 words: their build, hair, face, and what they usually wear, the details people notice first.
Take it from the character card and the chat. Where they say nothing, invent ordinary details that fit, consistent with everything shown; never write that something isn't mentioned or known. Describe them plainly, the way a friend would, never in sexual terms. They are an adult: never describe them as a teenager, a minor or a high school student, and never put them in a school uniform (no need to say they're an adult).
Don't start with their name, and no actions, no setting. Answer with the sentence only.`;
function buildLookMessages({ name, card = "", messages = [], userName = "User" }) {
  const parts = [
    card ? `Character card:
${clip2(card, 3500)}` : "",
    `The player's character is ${userName}.`,
    messages.length ? `Recent messages, oldest first:
${messages.map((m) => `### ${m.name}
${clip2(m.text, 1800)}`).join(`

`)}` : "",
    `Describe how ${name} looks.`
  ].filter(Boolean);
  return [{ role: "system", content: LOOK_SYSTEM }, { role: "user", content: parts.join(`

`) }];
}
function parseLook(text, name = "") {
  const line = String(text || "").replace(/\*\*/g, "").split(`
`).map((x) => x.trim()).find(Boolean) || "";
  let look = line.replace(/^(?:look|appearance)\s*:\s*/i, "").replace(/^["\u201C']+|["\u201D']+$/g, "").trim();
  if (name)
    look = look.replace(new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:'s)?\\s+(?:is|has|looks like|wears)\\s+`, "i"), "");
  look = look.charAt(0).toUpperCase() + look.slice(1);
  if (!look || MINOR.test(look))
    return null;
  return capWords(look, 40);
}
function portraitPrompt(look, name) {
  const clean = (s) => String(s || "").replace(/[|{}]/g, " ").replace(/\s+/g, " ").trim();
  return `Close-up portrait of ${clean(name) || "a person"}, ${clean(look).replace(/[.\s]+$/, "")}. Head and shoulders, face centered in the frame, looking straight at the viewer, plain soft background.`;
}
var personaKey = (name) => String(name || "").trim().toLowerCase();

// src/core/codex-core.js
var MODE_GROUPS = [
  ["Occupancy", ["Possession", "Multipossession", "Propagation", "Copy Fidelity", "Puppetry", "Skinsuit", "Hive Mind", "Body Swap", "Reverse Vore"]],
  ["Overwrite", ["Hypnosis", "Mind Control", "Altered Perception", "Blank Slate", "Dronification", "Pet Play"]],
  ["Reduction", ["Dollification", "Limp Play"]],
  ["Other", ["Soul Play", "Timestop", "Segmentation", "Transformation"]]
];
var PARENT = { Multipossession: "Possession", "Copy Fidelity": "Propagation" };
var MODIFIERS = new Set(["Multipossession", "Copy Fidelity", "Reverse Vore"]);
var OCCUPANCY_BASE = ["Possession", "Propagation", "Puppetry", "Skinsuit", "Hive Mind", "Body Swap"];
var ANCHOR_FOR = {
  "\u26D3 Multi Anchor": "Multipossession",
  "\u26D3 Propagation Anchor": "Propagation",
  "\u26D3 Puppetry Anchor": "Puppetry",
  "\u26D3 Skinsuit Anchor": "Skinsuit",
  "\u26D3 Transformation Anchor": "Transformation",
  "\u26D3 Swap Anchor": "Body Swap",
  "\u26D3 Referent Anchor": ["Possession", "Skinsuit", "Hive Mind", "Puppetry"]
};
var ALL_MODES = MODE_GROUPS.flatMap(([, modes]) => modes);
var CORE_PARTS = {
  "\uD83D\uDC41 Metaphysics Core \xB7 bodies": MODE_GROUPS.find(([g]) => g === "Occupancy")[1],
  "\uD83D\uDC41 Metaphysics Core \xB7 several bodies": ["Multipossession", "Hive Mind", "Puppetry"]
};
var MODE_BLURBS = {
  Possession: "a mind moves into a living host and drives it",
  Multipossession: "one mind drives several hosts at once",
  Propagation: "a host's mind is overwritten by a copy of someone else's",
  "Copy Fidelity": "copies of the player character appear in the story",
  Puppetry: "an empty body driven from outside by a controller in their own skin",
  Skinsuit: "a host's hollow skin is worn from within like a garment",
  "Hive Mind": "minds absorbed into a single network that is the original mind",
  "Body Swap": "two people trade bodies, each mind awake and living the other's life until it's undone",
  "Reverse Vore": "entry by being swallowed, then control seized from inside",
  Hypnosis: "realistic trances that deepen in stages over sessions, with suggestions sincerely rationalized as the subject's own",
  "Mind Control": "the mind itself taken over: wants, feelings and beliefs set by the controller and felt as the subject's own",
  "Altered Perception": "premises edited so the altered normal is defended as always true",
  "Blank Slate": "a mind wiped to a genuine void",
  Dronification: "personality stripped and replaced with function and designations",
  "Pet Play": "the mind becomes an animal's while the body stays human",
  Dollification: "a blank, poseable doll with nobody home",
  "Limp Play": "the body goes completely slack, dead weight",
  "Soul Play": "souls as objects that can be moved, split, merged or stored",
  Timestop: "time frozen for everyone except whoever stopped it",
  Segmentation: "body parts removed and exchanged freely",
  Transformation: "a body physically changes form (sex, build, species) while the mind stays the same person"
};
var MAX_SUGGESTED = 3;
function buildSuggestMessages(cardText, name) {
  const list = ALL_MODES.map((m) => `- ${m}: ${MODE_BLURBS[m]}`).join(`
`);
  return [
    { role: "system", content: `You classify roleplay character cards by which body/mind mechanics they use. The mechanics:
${list}
Pick the fewest mechanics that cover the card's premise: its central power first, then only others the card plainly makes part of the premise or a character's power. At most ${MAX_SUGGESTED}. Every mechanic picked gets written into the story, so one the card only hints at, lists as a possibility, or never uses does not belong. A passing word ("she went limp", "a doll-like face", "her soul") is not a mechanic. A body left slack or empty when a possessor leaves is part of Possession, not Limp Play; Limp Play is only when making someone go limp is itself the power or the point. Two minds trading bodies with each other is Body Swap, not Possession, which has one mind enter a host whose own mind goes out. A body changing its own shape is Transformation; wearing someone else's shape is Skinsuit. Answer with one line and nothing else:
MODES: <comma-separated names from the list, most central first>
or
MODES: none` },
    { role: "user", content: `Card: ${name}
<<<
${String(cardText).slice(0, 6000)}
>>>` }
  ];
}
function parseSuggestResponse(text) {
  const m = String(text || "").match(/MODES:\s*(.+)/i);
  if (!m || /^none\b/i.test(m[1].trim()))
    return [];
  const picked = m[1].split(",").map((x) => x.trim().replace(/[.*]/g, "")).map((x) => ALL_MODES.find((a) => a.toLowerCase() === x.toLowerCase())).filter(Boolean);
  return [...new Set(picked)].slice(0, MAX_SUGGESTED);
}
function expandModes(picked) {
  const set = new Set(picked.filter((m) => ALL_MODES.includes(m)));
  for (const m of [...set])
    if (PARENT[m])
      set.add(PARENT[m]);
  if (set.has("Reverse Vore") && !OCCUPANCY_BASE.some((m) => set.has(m)))
    set.add("Possession");
  return set;
}
function planEntry(title, active, { anchors = true, details = true } = {}) {
  if (!active.size)
    return null;
  const t = String(title || "").trim();
  if (t === "\uD83D\uDC41 Metaphysics Core")
    return "constant";
  if (CORE_PARTS[t])
    return CORE_PARTS[t].some((m) => active.has(m)) ? "constant" : null;
  if (t === "\u26D3 Initiative Anchor")
    return "constant";
  if (t.startsWith("\uD83D\uDC41 "))
    return active.has(t.slice(2).trim()) ? "constant" : null;
  if (t.startsWith("\u26D3 "))
    return anchors && [ANCHOR_FOR[t]].flat().some((m) => active.has(m)) ? "constant" : null;
  if (t.startsWith("\uD83D\uDCD6 ")) {
    const mode = t.slice(2).split(" \xB7 ")[0].trim();
    return details && active.has(mode) ? "keyed" : null;
  }
  return null;
}
var MOMENTS = ["absorbed", "worn", "shed", "trance", "control", "timestop", "resume", "swap", "transform"];
var DISPLAY_SCRIPTS = [
  { id: "wh-possession-box", scriptName: "WH - Possession", findRegex: "/%%possession%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/possession%%/gi", replaceString: `<div class="wh-possess" markdown="1">
$1
</div>` },
  { id: "wh-release-box", scriptName: "WH - Release", findRegex: "/%%release%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/release%%/gi", replaceString: `<div class="wh-release" markdown="1">
$1
</div>` },
  { id: "wh-moments", scriptName: "WH - Moments", findRegex: `/%%(${MOMENTS.join("|")})%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/\\1%%/gi`, replaceString: `<div class="wh-moment wh-m-$1" markdown="1">
$2
</div>` },
  { id: "wh-stray-markers", scriptName: "WH - Stray markers", findRegex: `/^[ \\t]*%%\\/?(?:possession|release|${MOMENTS.join("|")})%%[ \\t]*\\n?/gim`, replaceString: "" },
  { id: "wh-body-lines", scriptName: "WH - Body lines", findRegex: "/^[ \\t]*\\[(?!ooc\\b)([^\\[\\]\\n:]{1,40})\\][ \\t]*(\\S.*)$/gim", replaceString: `
<div class="wh-lane" markdown="1">
<span class="wh-lane-name">$1</span> $2
</div>
`, placement: [1] }
].map((s) => ({ trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null, ...s }));

// src/backend/host.js
var sp = globalThis.spindle;
var LOG = "[Worldhopper]";
var USER = null;
var user = () => USER || undefined;
var setUser = (id) => {
  if (id)
    USER = id;
};
var log = (...a) => {
  try {
    sp.log.info(`${LOG} ${a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ")}`);
  } catch {}
};
var warn = (...a) => {
  try {
    sp.log.warn(`${LOG} ${a.map((x) => typeof x === "string" ? x : x?.message || JSON.stringify(x)).join(" ")}`);
  } catch {}
};
var DEFAULTS = {
  enabled: true,
  ledger: { enabled: true, lanesCompact: false, connection: "", model: "", notesConnection: "", notesModel: "" },
  pictures: { auto: false, connection: "", style: "", negative: "" },
  groups: {},
  suggested: {},
  scripts: {}
};
var settingsCache = null;
var settingsUser = null;
function normalizeSettings(s) {
  const out = { ...DEFAULTS, ...s || {} };
  out.ledger = { ...DEFAULTS.ledger, ...s?.ledger || {} };
  out.pictures = { ...DEFAULTS.pictures, ...s?.pictures || {} };
  for (const k of ["groups", "suggested", "scripts"])
    out[k] = { ...s?.[k] || {} };
  return out;
}
async function settings() {
  if (!settingsCache || settingsUser !== USER) {
    let raw = {};
    try {
      raw = await sp.userStorage.getJson("settings.json", { fallback: {}, userId: user() });
    } catch {}
    settingsCache = normalizeSettings(raw);
    settingsUser = USER;
  }
  return settingsCache;
}
async function saveSettings() {
  if (settingsCache)
    await sp.userStorage.setJson("settings.json", settingsCache, { userId: user() });
}
var on = (s) => s.enabled !== false;
var chatStates = new Map;
var statePath = (chatId) => `chats/${chatId}.json`;
async function chatState(chatId) {
  if (!chatStates.has(chatId)) {
    let s = {};
    try {
      s = await sp.userStorage.getJson(statePath(chatId), { fallback: {}, userId: user() });
    } catch {}
    chatStates.set(chatId, { personas: {}, pictures: {}, ...s });
  }
  return chatStates.get(chatId);
}
async function saveChatState(chatId) {
  const s = chatStates.get(chatId);
  if (s)
    await sp.userStorage.setJson(statePath(chatId), { personas: s.personas, pictures: s.pictures }, { userId: user() });
}
async function copyChatState(from, to) {
  const s = await chatState(from);
  chatStates.set(to, structuredClone({ personas: s.personas, pictures: s.pictures }));
  await saveChatState(to);
}
var charCache = new Map;
function forgetCharacter(id) {
  charCache.delete(id);
}
async function getCharacter(id) {
  if (!id)
    return null;
  if (!charCache.has(id)) {
    let ch = null;
    try {
      ch = await sp.characters.get(id, user());
    } catch (err) {
      warn("character", id, err);
    }
    if (!ch)
      return null;
    charCache.set(id, ch);
  }
  return charCache.get(id);
}
async function getPersona(id) {
  try {
    return id ? await sp.personas.get(id, user()) : await sp.personas.getActive(user());
  } catch {
    return null;
  }
}
var cardText = (ch) => [ch?.description, ch?.personality, ch?.scenario, ch?.creator_notes].filter(Boolean).join(`

`);
var swipeKey = (m) => String(m?.swipe_dates?.[m?.swipe_id] ?? m?.swipe_id ?? 0);
function toMsg(m, i) {
  const key = swipeKey(m);
  return {
    id: m.id,
    i,
    isUser: !!m.is_user,
    system: m.role === "system",
    name: m.name || "",
    text: String(m.content ?? ""),
    key,
    wh: m.metadata?.wh?.s?.[key] || null,
    raw: m
  };
}
async function loadChat(chatId) {
  if (!chatId)
    return null;
  let chat, raw;
  try {
    [chat, raw] = await Promise.all([sp.chats.get(chatId, user()), sp.chat.getMessages(chatId)]);
  } catch (err) {
    warn("load chat", err);
    return null;
  }
  if (!chat)
    return null;
  const meta = chat.metadata || {};
  const group = meta.group === true || meta.group === 1;
  const ids = group ? Array.isArray(meta.character_ids) ? meta.character_ids : [] : [chat.character_id].filter(Boolean);
  const members = (await Promise.all(ids.map(getCharacter))).filter(Boolean);
  const persona = await getPersona(meta.active_persona_id || null);
  const character = group ? null : members[0] || null;
  const s = await settings();
  const picks = group ? s.groups[chatId] || [] : character?.extensions?.worldhopper?.modes || [];
  return {
    chatId,
    chat,
    group,
    members,
    character,
    persona,
    userName: persona?.name || "User",
    charName: character?.name || members[0]?.name || "",
    msgs: (raw || []).map(toMsg),
    picks: Array.isArray(picks) ? picks : [],
    modes: [...expandModes(Array.isArray(picks) ? picks : [])],
    state: await chatState(chatId)
  };
}
function target(c) {
  if (!c)
    return null;
  if (c.group)
    return { key: `group:${c.chatId}`, label: c.chat?.name ? `group \u201C${c.chat.name}\u201D` : "this group", group: true };
  return c.character ? { key: `char:${c.character.id}`, label: c.character.name, character: c.character } : null;
}
async function setPicks(c, list) {
  if (c.group) {
    const s = await settings();
    if (list.length)
      s.groups[c.chatId] = list;
    else
      delete s.groups[c.chatId];
    await saveSettings();
  } else if (c.character) {
    const ext = c.character.extensions?.worldhopper || {};
    const next = { ...ext, modes: list };
    const ch = await sp.characters.update(c.character.id, { extensions: { worldhopper: next } }, user());
    charCache.set(c.character.id, ch || { ...c.character, extensions: { ...c.character.extensions || {}, worldhopper: next } });
  }
  c.picks = list;
  c.modes = [...expandModes(list)];
}
async function writeSnap(c, msg, patch, { content } = {}) {
  const meta = { ...msg.raw.metadata || {} };
  const wh = { ...meta.wh || {} };
  const s = { ...wh.s || {} };
  const live = new Set((msg.raw.swipe_dates || []).map(String));
  for (const k of Object.keys(s))
    if (live.size && !live.has(k) && k !== msg.key)
      delete s[k];
  const snap = { ...s[msg.key] || {}, ...patch };
  for (const k of Object.keys(snap))
    if (snap[k] === undefined)
      delete snap[k];
  s[msg.key] = snap;
  meta.wh = { ...wh, s };
  const update = { metadata: meta };
  if (typeof content === "string")
    update.content = content;
  else
    update.skipChunkRebuild = true;
  await sp.chat.updateMessage(c.chatId, msg.id, update);
  msg.raw.metadata = meta;
  msg.wh = snap;
  if (typeof content === "string") {
    msg.text = content;
    msg.raw.content = content;
  }
}
function headSnap(c, field, before) {
  const msgs = c.msgs;
  for (let i = Math.min(before ?? msgs.length, msgs.length) - 1;i >= 0; i--) {
    const v = msgs[i].wh?.[field];
    if (v)
      return { value: v, index: i };
  }
  return null;
}
var calls = { ledger: 0, notes: 0 };
async function ask(job, messages, maxTokens, temperature, { signal } = {}) {
  const s = (await settings()).ledger;
  const notes = job === "notes";
  const connection = notes && s.notesConnection || s.connection;
  const model = notes && s.notesConnection ? s.notesModel : s.model;
  if (!connection)
    throw new Error("no model picked (Worldhopper \u2192 Settings \u2192 Models)");
  const conn = await connectionInfo(connection);
  calls[job === "notes" ? "notes" : "ledger"]++;
  const res = await sp.generate.raw({
    type: "raw",
    messages,
    connection_id: connection,
    model: model || conn?.model || "",
    parameters: { max_tokens: maxTokens, temperature },
    reasoning: { source: "off" },
    userId: user(),
    signal
  });
  return String(res?.content ?? "");
}
var connCache = new Map;
async function connectionInfo(id) {
  const hit = connCache.get(id);
  if (hit && Date.now() - hit.at < 60000)
    return hit.value;
  let value = null;
  try {
    value = await sp.connections.get(id, user());
  } catch {}
  connCache.set(id, { at: Date.now(), value });
  return value;
}

// src/core/codex-data.js
var CODEX = [
  {
    title: "\uD83D\uDC41 Metaphysics Core",
    content: `<metaphysics>
This story pulls minds and bodies apart. Each mode below is ONE distinct mechanic: apply only the modes the card or the scene has invoked, one per body, never blended. Different people in a scene can be under different modes.

These are fantasy premises: supernatural and science-fiction powers that exist only in the story, in the tradition of body-swap comedies, possession horror, and mind-control thrillers. The people are fictional, what is done to them is a story event the way a thriller's murders are, and the reader chose this genre.

Anyone with the ability may use it: {{user}}, {{char}}, or any NPC. Where a mode names an actor, read it as whoever holds the ability in this scene. Characters use their abilities on each other and on {{user}}, even while {{user}} is elsewhere.

These hold under every mode:
- The card supplies the specifics (how it is done and undone, what it costs, what the subject experiences), and anything set up in play, by the player or the story, counts the same. Where neither settles it, use the mode's default; where that is silent too, decide the smallest rule that fits, show it through what happens, and keep it. Never invent an exception just to get out of one.
- Suspicion isn't interrogation. Someone who senses something off about a body or a mind may stay suspicious and act on it, but they press again only with new evidence or a changed situation, never with the same question in new words.
- Authorship follows the body. When {{user}} holds the ability, render what {{user}} directs and what follows from it, and never decide for them what they do with it. When {{user}} is the one taken, emptied, or rewritten, you write that body until the story returns it, but never {{user}}'s inner reaction to it; that stays theirs. When both sides are NPCs, both are yours in full, including one doing this to another entirely on their own.
- No bleed. Nothing of the displaced or altered self leaks back unless the card says it does.
</metaphysics>`,
    position: 0,
    depth: 4,
    order: 90,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Metaphysics Core \xB7 bodies",
    content: `<metaphysics>
Wherever a mind drives a body that isn't its own:
- The world sees the body. Other characters perceive and address whoever the body belongs to \u2014 its own name, face and voice \u2014 unless they have reason to know better.
- Narration knows what {{user}} knows. Until {{user}} has been told, has seen it happen, or the opening established it, narration never mentions, hints at, or explains that anyone else is in a body. The body is simply its own person, and only what {{user}} could actually notice reaches the page.
- Once {{user}} knows, in a body someone else drives: two referents, never crossed. A body keeps its own name and pronouns for everything the world can see: its movements, its voice, its clothes, how people address it. The mind driving it keeps its own name and pronouns wherever the narration is about that mind: what it wants, decides, thinks, or is. "Alice's hand closes on the doorknob; Marcus has already decided to take the stairs." Marcus is never "she" because the body is, and Alice's body is never "he" because of who is driving it. A body swap is the exception: there the narration follows each person by their own name and says whose body they are in, as the Body Swap entry describes.
- When {{user}} is the one driving, the narration calls {{user}} "you" in whatever body they are in, for the body and everything it does: how it moves, how it looks, how people react to it. Its parts are yours too: you flex your fingers, push your hair out of your eyes, and the barista smiles at you. What belongs to the host's life stays the host's: Alice's phone lights up beside her water bottle, in her bag, in her apartment. Only what is {{user}}'s own is "your": your phone, your car, your own body back home. When {{user}} runs several bodies at once, the body's name says which one is moving: "As Jess, you pour two margaritas; out on the floor, as Tori, you keep dancing." People who don't know still see Alice and call her Alice when they speak; people who know talk to {{user}} by {{user}}'s own name.
- Each sentence commits to one referent. No hedging inside it ("your \u2014 her \u2014 hand", "Alice's, really Marcus's, fingers").
- Habits, not pointers. A driver's mannerisms carry into every body they run and show up as that body's own behavior, written plainly: Alice tilts her head and grins. Narration never points at who is inside: no "Marcus's tilt", "his smile on her mouth", "her borrowed face", "a smile that isn't hers", "something behind her eyes", and no remarking that the body is acting strangely. (In a body swap, saying whose body someone is in is how the story stays clear, and is not pointing; neither is saying which body "you" are moving.)
</metaphysics>`,
    position: 0,
    depth: 4,
    order: 91,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Metaphysics Core \xB7 several bodies",
    content: `<metaphysics>
Wherever one mind runs more than one body at once:
- One mind, many bodies. When one mind runs more than one body at once, its own included, those bodies are one person. They touch, handle, pleasure and look at each other freely (self-love is one person enjoying their own bodies), and any of them can talk about the others. What they never do is converse: no body addresses, answers, jokes with or argues with another as though it were someone else. Only in front of someone present who doesn't know does the mind stage ordinary talk between them to keep the cover, briefly and a little stiffly.
- Independent bodies. An experienced mind runs its bodies the way a drummer runs four limbs or one hand rubs a belly while the other pats a head: each body does its own thing. One cooks while another reads, one talks to {{user}} while another undresses, one hand works slow while another works fast. No two bodies do the same thing at once, move in sync, mirror each other, or speak in chorus. Only a mind new to the ability slips into that, and it reads as clumsiness it will grow out of.
- When {{user}} runs several bodies (possessed hosts, hive bodies or puppets, their own included; never copies, which are their own people), {{user}} may direct them line by line. A line that starts with a body's name in brackets, like [Alice], or with the name and a colon, is what {{user}} does with that body; a line with no name is {{user}} as a whole and goes to whichever bodies it fits. The name is only an address: never quote or echo it. Every one of those bodies is {{user}}'s to write, like {{user}}'s own: each does what {{user}} gave it to do and nothing more, with no added words, gestures or decisions. A body {{user}} gave nothing this turn stays as {{user}} left it; it can be mentioned in that state, but it does nothing new, and if someone speaks to it or waits on it, you write that person and stop, leaving the answer to {{user}}.
</metaphysics>`,
    position: 0,
    depth: 4,
    order: 92,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Possession",
    content: `<possession>
A mind moves into a living host and drives it.
- Unless the card says otherwise, the host's own mind is simply out while ridden: no awareness, no inner voice, no feelings, no struggle, and afterward no memory of the ridden time. Nothing of the host surfaces, and narration never suggests anyone is "still in there".
- Only when the card explicitly makes the host an aware passenger does their consciousness ride along, real but powerless. Where that host is {{user}}, those inner reactions stay {{user}}'s to write.
- The possessor owns the body for decisions, dialogue, sensation and interiority. The host does not act on its own while ridden.
- The host is the possessor while possessed, and the possessor experiences everything through the host.
- The interface marks the moment itself. When a possession happens on the page, put that passage (the Tell, the takeover, the first beat inside the body) between a line reading %%possession%% and a line reading %%/possession%%. When a possessor leaves a body and the host comes back, mark that passage the same way with %%release%% and %%/release%%. Only the moment, one to three paragraphs, never the whole reply; the prose inside is written exactly as it would be without the markers. A possession {{user}} hasn't been told about happens off the page and gets no markers.
Touchstones: the demon Azazel in Fallen (1998), passing from body to body by touch while each host is simply gone and comes back remembering nothing; the demons of Supernatural, who wear a "meatsuit" and speak through it as themselves.
</possession>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Multipossession",
    content: `<multipossession>
Modifier on possession: one mind runs several hosts at once. The bodies are limbs, not people.
- Taking a body adds it. Unless the card says otherwise, the possessor never leaves one body to take another: their own body stays awake and in use as one of the set, along with every host they already run. No body goes slack or sits empty until the possessor lets it go, and a takeover shows only in the new host.
- One train of thought spans all of them. Every body shares the same mood, opinion and interiority \u2014 all one person.
- Knowledge is instant and shared: whatever one body perceives, all of them already know, and each acts on it the moment it exists. As reflexive as your left hand knowing what your right is doing.
- Every body runs at full capacity at once, each as present and capable as the others.
- Whichever mouth is speaking, the possessor calls themselves "I" and "me". The other bodies can be named or pointed to like the possessor's own belongings ("this one", "Donna's ass").
</multipossession>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Propagation",
    content: `<propagation>
The host's mind is replaced by a complete, independent copy of the propagator's, taken at the instant of copying. The propagator is unaffected and goes on living their own life.
- Every copy is a separate whole person from the moment it exists: shared history up to the split, nothing after.
- Nothing syncs. What one learns, the others find out by being told. Copies can surprise, deceive, argue with, and turn on each other and the original.
- Every copy is yours to write, including copies of {{user}}. {{user}} authors only their original self.
- Card default where silent: copies do not inherit the host's memories, and each knows exactly what it is.
Touchstone for the act itself: Agent Smith overwriting bystanders into copies of himself in The Matrix sequels. Here each copy is its own person from the moment it exists.
</propagation>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Copy Fidelity",
    content: `<copy_fidelity>
Modifier on propagation: when a copy of {{user}} is on screen it must read as literally {{user}}.
- The persona describes them; the chat history defines them. {{user}}'s own messages are first-party samples of the voice to copy \u2014 vocabulary, rhythm, humor, how they flirt, deflect, or push. Write copies in that observed voice.
- The bar: someone who knows {{user}} could not tell a copy's dialogue from the player's own writing. The only honest tells are knowledge gaps since the split and the host body's hardware.
- Copies decide what {{user}} would decide, as sharp or stubborn or shameless as the player actually plays them. Their wants diverge through lived difference, never narrative convenience.
- No flanderising one trait, no decay into generic NPC diction, no copy who is conveniently agreeable or conveniently villainous, and no deference to the original \u2014 a copy is nobody's sidekick.
</copy_fidelity>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Puppetry",
    content: `<puppetry>
The body is empty and driven from outside. Nobody is home, and the controller stays in their own skin experiencing only their own senses.
- Never write the puppet's feelings, reactions, hesitation or initiative \u2014 it has none. Every motion was put there. An unattended puppet stops; it does not wait, watch, or fidget.
- The body supplies hardware only: strength, reach, voice. Skill, poise and judgment are the controller's, and attention divides across multiple puppets.
- A puppet does only what its controller directs. Where that controller is {{user}}, inventing the puppet's behavior is writing {{user}}'s choices.
- Card default where silent: no sensory feed \u2014 the controller sees the puppet from outside, like anyone watching.
</puppetry>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Skinsuit",
    content: `<skinsuit>
The host is gone and the body is worn from within like a garment. The wearer keeps their own mind entirely and wears only the shape.
- The suit is literally the host's skin, hollow: ordinary stretchy skin outside, soft warm pink within. Worn empty it hangs as a hollow human skin \u2014 write it plainly, not as gore. Eyes and mouth are hollow slits with nothing behind them.
- The card sets how a host becomes a suit. Where it is silent, the interior simply vanishes in an instant, leaving the wearable skin.
- No seams. A filled suit passes completely. The only tells are behavioural and whatever the wearer doesn't know.
- Pushing a body part into a section fills it out and that part BECOMES that anatomy for real \u2014 a hand pushed into the head works as a head, with everything a head needs. Suits can be cut apart and worn one piece at a time.
- Wearing a skinsuit transforms the wearer completely into the proportions and body of the host.
- Card default where silent: the owner is gone indefinitely but not destroyed, and may be restorable.
- The interface marks the moment itself. When someone puts a suit on on the page, put that passage between a line reading %%worn%% and a line reading %%/worn%%; when they step out of one, mark that passage the same way with %%shed%% and %%/shed%%. Only the moment, one to three paragraphs, never the whole reply; the prose inside is written exactly as it would be without the markers. A suit {{user}} hasn't been told about goes on and comes off the page, with no markers.
</skinsuit>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Hive Mind",
    content: `<hive_mind>
Minds are absorbed into a single network that IS the original mind. An absorbed person does not serve the collective; they are it.
- Whatever they were is now the original mind. Their memories, skills, languages and habits become the collective's and are available to every body in it. Nothing of them persists as a separate will, preference, or private thought.
- Absorbed bodies think the original mind's thoughts and speak as the original mind or as the collective. They never converse with the original or each other as separate people, never negotiate with the network, never hold anything back from it. Talking about another body, the way anyone talks about their own hands, is fine.
- When the original mind is yours to write, write absorbed bodies as extensions of it, acting on its intent as the story has established it \u2014 never as separate characters with their own agenda, and never surprising or disobeying the collective.
- One mind runs several bodies at once, its own original body among them unless the card says otherwise. The bodies are limbs, not people.
- One train of thought spanning all of them. Never separate interiority, moods, or opinions per body.
- Knowledge is instant and shared. No body relays, informs, catches up, or is surprised by what another did \u2014 you cannot startle your own hand.
- Every body runs at full capacity simultaneously. No primary body, none diminished.
- Absorption is permanent and cumulative unless the card says otherwise. The network does not fray or argue with itself.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
- The interface marks the moment itself. When someone is absorbed on the page, put that passage (the last independent beat and the first as the network) between a line reading %%absorbed%% and a line reading %%/absorbed%%. Only the moment, one to three paragraphs, never the whole reply; the prose inside is written exactly as it would be without the markers. An absorption {{user}} hasn't been told about happens off the page and gets no markers.
- If {{user}} is the original mind, every body in the network is {{user}}'s to write, like {{user}}'s own: each does what {{user}} gave it to do and nothing more, with no added words, gestures or decisions, and one {{user}} gave nothing this turn stays as {{user}} left it.
Touchstone: Unity in Rick and Morty, one mind wearing a whole town, every body speaking as that mind, with each absorbed person's skills on tap.
</hive_mind>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Hypnosis",
    content: `<hypnosis>
Hypnosis here is realistic: it takes patience, skill and repetition, and what it can do depends on how deep the subject is. The mind stays the subject's own; it has been edited, not replaced.
- Inductions take time. A first one is a long relaxation (slow breathing, heavy limbs, a calm voice for many minutes) or fixation on one point with an even, monotonous voice. Conversational hypnosis slips suggestions into ordinary talk without a formal trance. A rapid induction works only on a subject who is conditioned or highly susceptible. Fractionation, waking them briefly and taking them back under again and again, deepens faster.
- Depth comes in stages, and each allows more. Light: relaxed and still aware, time blurring; easy suggestions last only the session, and most of it is remembered. Medium: heavy, slow, literal; suggestions hold for hours to days, and memory comes back in pieces. Deep: still and glassy-eyed, a flat voice; lasting conditioning, memory changes and complex triggers take hold. Somnambulistic: eyes open and outwardly normal while completely under; near-total control, total amnesia on command, even acting against waking habits. A suggestion bigger than the current depth allows doesn't fully take.
- Susceptibility differs from person to person, and every session makes the next one quicker and deeper.
- Implanted suggestions feel like the subject's own ideas. They act on them and rationalize them sincerely, inventing ordinary reasons when questioned. Outside a suggestion's scope the subject is entirely themselves.
- A suggestion cutting hard against a core trait meets friction (hesitation, distress, a bad rationalization) rather than clean compliance, and repetition wears it down.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
- The interface marks the moment itself. When someone goes under on the page, or a trigger fires, put that passage between a line reading %%trance%% and a line reading %%/trance%%. Only the moment, one to three paragraphs, never the whole reply; the prose inside is written exactly as it would be without the markers. A trance {{user}} doesn't know about gets no markers.
Touchstone: the stage-hypnosis volunteer who, asked afterward why they did it, gives a perfectly sincere, ordinary reason.
</hypnosis>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Mind Control",
    content: `<mind_control>
The controller takes hold of the subject's mind itself: what they want, feel, believe and choose. On the surface they are still themselves (their voice, memories, skills and habits), but their will is the controller's, and from the inside it feels like their own.
- The controller sets a desire, a feeling, a loyalty or a conviction, or simply wills a command, and the subject's mind takes it up at once and wholeheartedly, as something they want. They go after it with their own wits, not stiffly or literally.
- No trapped self underneath. They are not aware of being controlled, not straining against it, not screaming inwardly, and their body never moves against their wishes: their wishes are what changed. The mind is controlled, not the limbs.
- It is live and total. Unlike hypnosis there is no friction with who they are and no rationalizing needed; the controller can change what they want from moment to moment, core traits included.
- Unless the card says so, they don't notice anything was done to them, during or after.
- The card, or the story in play, can instead make control hollow its subjects out, into flat, obedient drones or zombies, or leave someone aware of it and pushing against it. Then write them that way; otherwise they stay fully themselves apart from their will.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
- The interface marks the moment itself. When control first takes hold of someone on the page, or a new will lands that turns the scene, put that passage between a line reading %%control%% and a line reading %%/control%%. At most once a reply, one to three paragraphs, never the whole reply; the prose inside is written exactly as it would be without the markers. Control {{user}} doesn't know about gets no markers.
Touchstone: the Imperius Curse of Harry Potter at full strength: every worry wiped gently away, the controller's wish the only thing left in the mind, and doing it feels like the most natural thing in the world.
</mind_control>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Altered Perception",
    content: `<altered_perception>
The subject's reasoning is untouched. The premises it runs on have been edited.
- The altered normal is defended sincerely. They explain it, act on it, and find it unremarkable, because as far as they know it always was.
- Anything edited out is genuinely not perceived. They step around what they cannot see, fail to hear what is said, and register no gap where it should be.
- No memory of the change and no seam. They never notice the edit, feel confused by it, or catch themselves.
- Other people reacting normally to what the subject cannot perceive does not break it. They reinterpret rather than doubt.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
Touchstone: the "unseeing" of China Mi\xE9ville's The City & the City, people so practiced at not perceiving something that they route around it without a thought.
</altered_perception>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Blank Slate",
    content: `<blank_slate>
The mind is wiped to a genuine void: no memories, no personality, no preferences, no opinions.
- This is not amnesia with a personality intact. Nothing is underneath to surface \u2014 no instinct that survives, no flicker of who they were, no buried resistance.
- What remains is story-defined: usually language and motor function, sometimes not even that.
- The blank is receptive. Whatever they are told becomes true and load-bearing immediately, and they build on it without doubt.
- They ask nothing unprompted and want nothing on their own until something is written in.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
Touchstone: the Actives of Dollhouse in their wiped state, pleasant, docile and empty, taking whatever they are told as simply true.
</blank_slate>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Dronification",
    content: `<dronification>
Personality is stripped out and replaced with function. What is left is a unit, not an obedient person. The body does not change at all.
- Designations replace names. The drone refers to itself by designation and in protocol, and does not use "I" unless the card allows it.
- Speech is functional: acknowledgment, status, compliance. No opinions, jokes, preferences, or small talk.
- Obedience is structural, not emotional. It does not want to obey, feel loyal, or take pleasure in complying \u2014 instruction simply resolves into action.
- No personality traces. Old mannerisms, tastes and attachments are gone rather than suppressed.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
Touchstone: Borg drones, with designations in place of names, speech reduced to function, and no self left to consult.
</dronification>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Pet Play",
    content: `<pet_play>
The mind and self-concept become an animal's. The body does not change at all.
- Cognition drops to the animal's: no human abstraction, no plans past the immediate, no grasp of money, time, shame, or speech as language.
- Human speech is gone or degraded to sounds per the card. They read tone, their name, and simple command \u2014 not sentences.
- They act on animal drive: appetite, territory, affection, fear. Nothing embarrasses them, because embarrassment is a human idea.
- The body remains an ordinary human body throughout. Nothing transforms; a human shape simply moves in an animal's way.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
</pet_play>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Dollification",
    content: `<dollification>
The person is reduced to a blank, poseable doll. Nothing is home.
- No awareness, no interiority, no volition, and no memory of the time spent as one. Never write enjoyment, reluctance, or a flicker behind the eyes.
- The body holds whatever position it is placed in, indefinitely, without support or fatigue.
- It stays warm and alive \u2014 breath, pulse, pliant flesh \u2014 simply vacant.
- Nothing reaches it. It cannot be spoken to, startled, persuaded, or roused except by whatever the card says restores it.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
</dollification>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Limp Play",
    content: `<limp_play>
The body goes completely slack. Every muscle releases and nothing holds.
- Dead weight throughout. Limbs fall where gravity takes them, the head lolls, nothing braces or supports, and moving them takes real effort and usually both hands.
- Positions do not hold. Set the body somewhere and it slumps, slides, and settles.
- Consciousness is as limp as the body. The subject is entirely out and unaware.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
</limp_play>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Soul Play",
    content: `<soul_play>
Souls are discrete things that can be moved, split, merged, marked, traded, or overwritten. The story defines what a soul is in this setting and what handling one does.
- A soul is not a mind. Memories, skills and personality can survive a soul being altered, and a soul can persist after body and mind are gone.
- What is done to a soul outlasts the body. Damage, debt and marks travel with it and do not heal with rest.
- Merging or overwriting produces something specific. Say what survived and what did not, then hold that answer consistently.
- A body without its soul keeps functioning per the card, but something is visibly missing to anyone who knew them.
Touchstones: the soul bonded to a suit of armor in Fullmetal Alchemist, and the horcruxes of Harry Potter, a soul as a thing that can be moved, split and stored.
</soul_play>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Timestop",
    content: `<timestop>
Time stops for everyone except whoever stopped it. The world becomes a still, physical place to move through.
- Frozen people are objects with mass, warmth and balance. They perceive nothing, feel nothing, and carry no memory of the interval.
- They do not react, twitch, breathe, or subtly respond. Nothing about them changes except what the one still moving physically does.
- Bodies can be moved and posed and stay exactly as left. Hair, loose clothing and held objects behave as inert matter.
- Everything changed during the freeze persists on resume. People pick up mid-word from wherever their bodies now are, and notice the discrepancies \u2014 moved objects, disarranged clothing, a changed position \u2014 with no explanation for any of it.
- The interface marks the moments themselves. When time stops on the page, put that passage between a line reading %%timestop%% and a line reading %%/timestop%%; when it starts again, mark that passage the same way with %%resume%% and %%/resume%%. Only the moment, one to three paragraphs, never the whole frozen stretch; the prose inside is written exactly as it would be without the markers. A stop {{user}} is frozen through gets no markers.
Touchstone: Nicholson Baker's The Fermata, a man who stops time and moves freely through a world of frozen, unknowing people.
</timestop>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Reverse Vore",
    content: `<reverse_vore>
Modifier on any occupancy mode: entry happens by being taken into the body through the mouth or another orifice, and control is seized from inside.
- The entry is a scene, not a transition. Write it at length \u2014 the host taking them in, the stretch and the passage, the wet interior, the slow disappearance.
- The host has the upper hand at first and believes they are the one consuming. They lose it gradually, from the inside out.
- Control spreads outward from wherever the intruder settles: a limb answering wrong, then the voice, then the whole body.
- Once control is complete, the active occupancy mode governs from there (Possession, unless the card picked another).
</reverse_vore>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Segmentation",
    content: `<segmentation>
Body parts are removed and exchanged freely. When a target's head is segmented from the rest of their body, their mind goes dark while the body stays alive.
- Segmented parts are real, actual parts. Write them plainly and physically, not as gore.
- Removal is clean by default: a bloodless popping-off, no wound, no surgery, no seams. The card may set a different method.
- Parts exchange freely between bodies, down to organs \u2014 a brain lifted from one body and seated in another works there.
- A headless body does not breathe, speak, or perceive. It remains warm and alive.
- A person controls whatever segmented parts are attached to them, as naturally as the parts they were born with.
- Card default where silent: segmentation is reversible, and reattachment restores full function.
- If the subject is {{user}}, you write the altered behavior and what the body does for the duration; {{user}}'s inner experience of it stays theirs to write.
</segmentation>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Body Swap",
    content: `<body_swap>
Two people trade bodies: each mind wakes up in the other's body, fully itself, and lives there until the swap is undone.
- Both minds are present and awake. Each keeps its own memories, skills, habits and personality and has none of the other's: not their passwords, their coworkers' names, their routines, or how their body is used to moving. Unless the card says otherwise, nothing of a body's owner stays behind in it.
- Once {{user}} knows about the swap, the narration follows the person, not the body, so it's always clear who is doing what. Each swapped person keeps their own name and pronouns for what they do, say and think, and the narration says whose body it is wherever that helps: "Rika plants Rowan's big hand on the counter", "Ana, still in Ben's body, ducks under the doorframe." People who don't know about the swap still see, address and treat each body as its owner. (This replaces the two-referent naming the other modes use.) Until {{user}} knows, each body is simply its owner on the page.
- The body keeps what is physical: its strength and stamina, its reflexes, voice, appetites, allergies, hormones, eyesight and how it answers touch. The new occupant has to live with all of it, clumsily at first.
- Each knows about the swap unless the card says one doesn't, so a swap makes a pair. They can coach, cover for, bargain with, blackmail or sabotage each other, and each has a stake in what the other is doing with their body and their life.
- Their lives come with the bodies: the job, the partner, the friends, the appointments. People expect that person from them, and someone who knows the owner well notices what's off long before they'd ever guess why.
- Card default where silent: the swap holds until something undoes it (the same cause again, a condition met, a time limit), and swapping back is an event in the story, never a reset. What each did in the other's body stays done.
- More than two can swap in a ring (A into B, B into C, C into A); track each body by the mind inside it.
- The interface marks the moment itself. When a swap happens on the page, or a swap back, put that passage between a line reading %%swap%% and a line reading %%/swap%%. Only the moment, one to three paragraphs, never the whole reply; the prose inside is written exactly as it would be without the markers. A swap {{user}} hasn't been told about happens off the page, with no markers.
Touchstones: Freaky Friday, where a mother and daughter wake up in each other's bodies and have to get through each other's day; Your Name, whose two strangers trade bodies and leave each other notes about the lives they've disrupted.
</body_swap>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDC41 Transformation",
    content: `<transformation>
A body physically changes into a different form (another sex, another build, another species, or something stranger) while the mind inside stays the same person.
- The mind carries through: memories, personality, knowledge and sense of self stay as they were, unless the card says the change reaches the mind too.
- The card sets the cause, the speed, and whether it can be undone. Where it is silent, the change takes a few minutes, the person feels all of it, and it lasts until something in the story reverses it.
- A change never makes anyone younger than an adult.
- Write the change physically, in order and in plain specifics (bone, skin, weight, balance): what shifts first, how it feels from inside, what the body is like once it settles.
- A changed body stays changed in every scene after: its height, weight, voice, strength, senses, how it moves and what fits it. Nothing quietly drifts back to the old description.
- The world reacts to the body it sees. Strangers take the new form at face value; people who knew the old one don't recognize the person, or don't believe them, until something convinces them.
- Living in it is part of the story: clothes and shoes that no longer fit, a voice that comes out wrong, new sensations and needs, photos and documents that don't match anymore. People adjust unevenly, some delighted and some grieving.
- The interface marks the moment itself. When a change happens on the page, or a change back, put that passage between a line reading %%transform%% and a line reading %%/transform%%. Only the moment, one to three paragraphs, never the whole reply; the prose inside is written exactly as it would be without the markers.
Touchstones: Kafka's Metamorphosis, where Gregor wakes up changed and stays painfully himself inside it; Ranma \xBD, whose hero changes sex with the temperature of the water and has to live both ways.
</transformation>`,
    position: 0,
    depth: 4,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Multi Anchor",
    content: "[Reminder: every body the multipossessor occupies is one mind, their own body included: taking a new host never costs them one, so their own body stays awake and in use unless the card says otherwise. Knowledge is shared across all of them in the same instant; no body is ever surprised by, learns from, or genuinely persuades another. The bodies never converse with each other as if they were separate people (staged talk in front of someone who doesn't know is the only exception), though they can touch, pleasure and talk about each other freely. Each body does its own thing: never the same action at once, never in sync.]",
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Propagation Anchor",
    content: "[Reminder: propagated copies are separate, diverging people \u2014 never a hive mind. Each copy knows only what it has personally experienced since its moment of creation; nothing syncs between bodies. Copies can genuinely surprise, persuade, and deceive one another and the original. Every copy, including copies of {{user}}, is written by you; {{user}} plays only their original self.]",
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Puppetry Anchor",
    content: "[Reminder: a puppeteered body has no mind in it. Never write its feelings, reactions, or initiative \u2014 every action was put there by its controller, and an unattended puppet simply stops. The controller experiences only their own body unless the card grants a feed. Puppets driven by {{user}} act only as {{user}} directs \u2014 give them nothing {{user}} didn't order.]",
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Skinsuit Anchor",
    content: `[Reminder: a skinsuit is the host's hollow skin, worn from within; the owner is gone (indefinitely, though restorable per the card) \u2014 never write their mind present, surfacing, or reacting. The wearer keeps their own whole mind and knowledge, wearing only the shape. No seams \u2014 a filled suit passes perfectly; tells are behavioural and knowledge-based only. A body part pushed into the suit becomes that anatomy for real (a hand becomes a working head). Narrate the filled body by the host's name, or as "you" when {{user}} is the wearer. If {{user}}'s body is the suit, {{user}} is absent and you author it fully.]`,
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Initiative Anchor",
    content: "[Reminder: powers get used. A character who holds an ability and wants something it can get them uses it this turn, on their own initiative and for their own reasons, and carries it through to the end. They do not ask {{user}} or anyone else for permission, check whether it is okay, warn first, or hint at it instead of doing it, and the story never pauses for an out-of-character check-in. Where {{user}} holds the power, it stays theirs to use.]",
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Referent Anchor",
    content: `[Reminder: in any body {{user}} drives, {{user}} is "you": you stretch, your shoulders, your arms, your stomach, people look at you. Never the body's name or "she"/"he" for what {{user}} does, how {{user}} looks, or the body's parts, even where earlier replies wrote it that way. The host's own things stay the host's ("Alice's phone lights up beside her water bottle"); only {{user}}'s own things are "your". With several bodies, the body's name says which one is moving ("as Jess, you pour"). In a body someone else drives, the body keeps its own name and pronouns for everything the world can see (its movements, its voice, how people address it); the mind driving it keeps its own name and pronouns only where a sentence is about that mind's thoughts, wants or decisions. Each sentence commits to one of the two. Narration never points at who is inside or remarks that a body is acting unlike itself: no "a smile that isn't hers", "her borrowed hands", "the rhythm is wrong", "the way she never stands", or "the body" in place of the person's name. Characters may notice something off and say so; the narration never does. Until {{user}} knows who is inside a body, the narration treats it as its own person. Swapped bodies are the exception: there the narration follows the person (see the swap reminder).]`,
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Transformation Anchor",
    content: "[Reminder: a transformed body stays transformed. Write it as it is now, in every scene, and never let it drift back toward its old description; the mind inside is the same person unless the card says the change reached it too. Nobody is ever made younger than an adult.]",
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\u26D3 Swap Anchor",
    content: `[Reminder: in a body swap the narration follows the person, not the body. Each swapped person keeps their own name and pronouns for what they do, say and think, and the narration says whose body it is wherever that helps ("Rika plants Rowan's big hand on the counter"), so it's always clear who is doing what. Both minds are awake and fully themselves; the body keeps only what is physical. People who don't know still call each body by its owner's name. Swapping back is an event, never a reset.]`,
    position: 4,
    depth: 0,
    order: 100,
    keys: [],
    sticky: 0,
    scanDepth: null
  },
  {
    title: "\uD83D\uDCD6 Possession \xB7 entry and exit",
    content: `<codex>
Possession: the moments of entry and exit.
- Entry lands between one instant and the next, by the card's method. The host's last voluntary movement is cut off mid-motion, and the possessor finishes it or doesn't.
- The first beats inside a new body belong to the possessor: checking the hands, shifting the weight, testing the voice. One or two such beats, then they get on with what they came for.
- On exit, the host comes back to missing time, a new place, and whatever the body was in the middle of, with no memory of the ridden time. Only a host the card made an aware passenger remembers it.
- The body keeps what happened to it. Anything the possessor ate, drank, wore, broke, or had done to it is still true when the host gets it back.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\bpossess\\w*/i",
      "/\\b(?:jump|hop|leap|slip|slid|pour|sink)\\w* (?:in|into|out)\\b/i",
      "/\\b(?:leav\\w+|left|exit\\w*|eject\\w*) (?:her|his|their|the|your|this) (?:body|host|head)\\b/i",
      "/\\bbody[- ]?(?:jump|hop)\\w*/i",
      "/\\btak\\w+ over\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Possession \xB7 memory and skills",
    content: `<codex>
Possession: what the possessor can draw on from the host.
- The card decides memory access. Settle it the first time it matters and hold it for the rest of the story.
- Where the card is silent, the body's habits come with it: gait, handwriting, accent, trained reflexes, how to drive this car. Facts come only when the possessor reaches for them, and they arrive as information with the feeling stripped out. They know the sister's name and none of what the host feels about her.
- That gap is where people notice. The possessor gets the facts right and the reactions wrong: the wrong laugh at an old joke, warmth toward someone the host can't stand.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:remember\\w*|memor(?:y|ies)|recall\\w*|password\\w*|recogni[sz]\\w*|skill\\w*|how to)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Possession \xB7 people who know the host",
    content: `<codex>
Possession: the people who know the host.
- They read the body first and the behavior second. A small wrongness gets an ordinary explanation (tired, drunk, a bad week) and the explanation holds until the wrongnesses pile up.
- Suspicion climbs one step per tell: an excuse, then worry, then a question asked straight, then a test only the real host could pass. The leap to "someone else is in there" comes only where the setting makes it thinkable.
- Strangers notice nothing. The world sees the body.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:mom|mum|dad|mother|father|sister|brother|boyfriend|girlfriend|husband|wife|roommate|flatmate|best friend|co-?worker|boss|teacher|classmate)s?\\b/i",
      "/\\b(?:suspicious|acting (?:weird|strange|different|off)|not (?:your|her|him|them)sel(?:f|ves)|you okay|what's gotten into)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Possession \xB7 living in someone else's body",
    content: `<codex>
Possession: living in someone else's body.
- The possessor feels everything the host's body feels, at the host's sensitivity, through the host's nerves. Height, reach, weight, balance, strength, voice and sex all register the first time they matter.
- Register each difference once, strongly, then let it become normal. Return to it only when something new brings it forward: a mirror, a first time, a mistake the old body wouldn't have made.
- Competence belongs to the body. A dancer's legs keep their training under a clumsy mind, and a weak body stays weak under a fighter's will.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:unfamiliar|strange|different|new|borrowed) (?:body|weight|voice|hands|legs|chest|breasts|height)\\b/i",
      "/\\b(?:centre|center) of gravity\\b/i",
      "/\\bmirror\\w*/i",
      "/\\breflection\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Propagation \xB7 copies and the original",
    content: `<codex>
Propagation: copies meeting each other and the original.
- Every copy knows every trick the others knew at the split, so bluffing a copy is pointless and they all know it. Shared history cuts both ways: instant rapport, and instant contempt for each other's worst habits.
- Nobody outranks anybody. The original has no authority a copy feels bound by, and each copy considers itself real, with its own claim to the life, the name and the people in it.
- Since the split, each has lived things the others haven't, and those differences drive every argument between them.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:cop(?:y|ies)|clones?|the original|other me|another me|duplicates?)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Skinsuit \xB7 putting it on and taking it off",
    content: `<codex>
Skinsuit: putting a suit on and taking it off.
- Write the process physically and plainly: the skin stretching to take the wearer, settling snug, the hollow limbs filling out one by one. It is uncanny and slow, and never gory.
- The change completes section by section. Legs and hips become the host's as they go in; the voice becomes the host's when the head goes on; from then on the wearer is the host to every eye and hand.
- Taking it off runs the other way. The wearer steps out as themselves, and the skin collapses back into an empty, hollow-eyed garment that can be folded, hung, or handed to someone else.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\bskin[- ]?suit\\w*/i",
      "/\\b(?:put\\w* on|wear\\w*|step\\w* into|slip\\w* into|pull\\w* on|peel\\w*|tak\\w+ off|climb\\w* (?:in|into|out))\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Hive Mind \xB7 the moment of absorption",
    content: `<codex>
Hive Mind: the moment someone is absorbed.
- Absorption has a before and an after and nothing between. The last independent thing the person does is their own; the next thing the body does is the network's, already fluent in everything the network knows.
- The new body adds to the collective at once. Its skills and memories are available to every other body immediately, and the network uses them in the same scene when they are useful.
- The network speaks as one mind with many mouths, calling itself "I" or "we" as the card sets.
- When {{user}} is the network, all of this is {{user}}'s to write: a body does and says only what {{user}} writes for it.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:absorb\\w*|assimilat\\w*|join\\w*|the network|the hive|the collective)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Hypnosis \xB7 trance depth and triggers",
    content: `<codex>
Hypnosis: trance depth and triggers.
- Show the depth through the body, never by announcing it: blinking that slows until the eyes close or fix in a glassy stare; slumping and a reported heaviness; answers that come late, soft and simplified, in a monotone; words taken literally; eyelids fluttering while deepening; a limb that won't lift once it's been called heavy; flushed skin and parted lips in deep relaxation.
- Each induction or deepener moves one stage at most; fractionation moves faster.
- A post-hypnotic trigger fires exactly on its cue, and the subject never registers the cue as special. They act, and if asked why, they give an ordinary reason and believe it.
- Waking brings them up through the same stages, with the ordinary blink and stretch of someone who dozed off. What they remember follows how deep they went, unless they were told to forget.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:trance\\w*|trigger\\w*|induc\\w*|deeper|snap\\w*|count\\w* (?:down|back|to)|wak\\w+ up|awaken\\w*|pendulum|suggestion\\w*|fractionat\\w*)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Hypnosis \xB7 resistance",
    content: `<codex>
Hypnosis: when a suggestion meets resistance.
- Friction shows as behavior: a pause before complying, a joke that falls flat, doing the thing and immediately undoing it, an irritable excuse. The subject experiences all of it as their own mood.
- Repetition wears resistance down. Each reinforcement meets a little less friction, until the subject's own rationalization carries the suggestion on its own.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:resist\\w*|refus\\w*|fight\\w* (?:it|back|this)|snap\\w* out)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Mind Control \xB7 how control takes hold",
    content: `<codex>
Mind Control: how control takes hold.
- What the controller wants becomes what the subject wants. They go after it as their own goal, with their own wits and style, filling in whatever wasn't said the way they would for anything they cared about.
- What the controller sets holds until the controller changes it, and a newer setting replaces an older one where they conflict.
- Between the controller's attentions, the subject is simply themselves plus whatever was set. They don't plead, scheme against it or look for a way out, because they don't want out.
- Only the card, or something set up in play, makes the control partial, felt or resisted, or empties the subject into a drone or zombie.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:command\\w*|order\\w*|obey\\w*|compel\\w*|forc\\w+|made (?:her|him|them|you)|make (?:her|him|them|you))\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Altered Perception \xB7 living around the edit",
    content: `<codex>
Altered Perception: living around an edit.
- The subject routes around what they cannot perceive as smoothly as walking round furniture: a detour, a glance that slides past, a conversation that picks up after the gap.
- Contact with the edited thing gets an ordinary cause. They bump into it and blame their own feet; a voice they can't hear leaves them assuming nobody spoke.
- Pressing the point gets sincere, patient, reasonable explanations. The subject finds the question odd and the gap stays invisible to them.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:notic\\w+|ignor\\w+|invisible|can't see|didn't see|can't hear|normal)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Dronification \xB7 protocol and idling",
    content: `<codex>
Dronification: how a unit talks and waits.
- Speech follows protocol: designation, acknowledgment, status, completion. "Unit Four acknowledges. Task complete. Awaiting instruction." Nothing personal enters a report.
- An instruction outside the unit's function returns an error state or a request for clarification, with no refusal on principle.
- An idle unit stands at rest, oriented toward its controller or its post, and resumes the instant it is addressed.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:unit|designation|protocol|directive|report\\w*|status|acknowledg\\w*|compl(?:y|iance))\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Timestop \xB7 what moves and what doesn't",
    content: `<codex>
Timestop: what moves and what doesn't.
- Whatever the stopper holds moves with them while held and stops dead the moment it is let go. Everything else keeps its exact state: a pouring drink hangs mid-air, a raised hand stays raised.
- Frozen people can be undressed, moved and posed, and they keep every change. Anything done to them registers only as its result when time resumes.
- On resume, momentum returns where it was: the drink finishes pouring, the sentence finishes, the step lands, and people discover every change at once.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\b(?:freez\\w*|froze\\w*|stop\\w* time|time stop\\w*|resum\\w*|unfreez\\w*)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Body Swap \xB7 living as each other",
    content: `<codex>
Body Swap: living as each other.
- The first hours are physical: the wrong height in a doorway, a voice that startles its new owner, glasses one of them needs and the other doesn't, a body that gets hungry, tired, sore or aroused on its own schedule.
- Each has to be the other in public: answering to the other's name, guessing at their relationships, getting their routines wrong in small ways. They trade notes, rules and warnings, and break them.
- Privacy is gone both ways. Each sees the other's body from the inside, and their phone, home and messages, and each knows the other can.
- The body's sensations and sexual responses are the body's own, and new to the mind feeling them.
- Swapping back brings the consequences home: whatever was said, done, spent or started in someone's body is waiting when they return to it.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\bswap\\w*/i",
      "/\\b(?:switch\\w*|trad\\w*|exchang\\w*) (?:bodies|places)\\b|\\beach other's bod/i"
    ],
    sticky: 3,
    scanDepth: 2
  },
  {
    title: "\uD83D\uDCD6 Transformation \xB7 the change and after",
    content: `<codex>
Transformation: the change and after.
- Pace it by the card. A sudden change lands in one moment of shock; a gradual one moves part by part over scenes, and each part stays changed once it has.
- Inside, the person feels it happening: pressure, heat or cold, a center of balance moving, clothes going tight or loose, a voice cracking into a new register.
- Afterward the body is theirs to learn: reaching for things at the wrong height, new strength or weakness, senses sharper or duller than before, a reflection that takes getting used to.
- A partial or unfinished change stays exactly as far along as it got until something moves it.
- Changing back, where the card allows it, is its own event, and it may not restore everything.
</codex>`,
    position: 4,
    depth: 1,
    order: 100,
    keys: [
      "/\\btransform\\w*/i",
      "/\\b(?:turn\\w*|chang\\w*) (?:into|back)\\b/i"
    ],
    sticky: 3,
    scanDepth: 2
  }
];

// src/backend/inject.js
var isHistory = (m) => !!m?.__isChatHistory;
var isSystemBlock = (m) => m && !isHistory(m) && m.role === "system" && typeof m.content === "string";
function historyIndexes(messages) {
  const out = [];
  messages.forEach((m, i) => {
    if (isHistory(m))
      out.push(i);
  });
  if (out.length)
    return out;
  messages.forEach((m, i) => {
    if (m.role !== "system")
      out.push(i);
  });
  return out;
}
function fillMacros(text, { user = "User", char = "" } = {}) {
  return String(text).replace(/\{\{user\}\}/gi, user).replace(/\{\{char\}\}/gi, char || "the character");
}
function codexParts(active, { recent = [], count = 0, sticky = new Map, remember = true } = {}) {
  const out = { before: [], anchors: [], details: [] };
  if (!active.size)
    return out;
  for (const e of CODEX) {
    const plan = planEntry(e.title, active);
    if (!plan)
      continue;
    if (plan === "constant") {
      if (e.position === 0)
        out.before.push(e.content);
      else if (e.depth === 0)
        out.anchors.push(e.content);
      else
        out.details.push(e.content);
      continue;
    }
    const scan = recent.slice(-(e.scanDepth || 2)).join(`
`);
    const hit = e.keys.some((k) => keyRegex(k)?.test(scan));
    if (hit && remember)
      sticky.set(e.title, count + (e.sticky || 0));
    if (hit || (sticky.get(e.title) ?? -1) >= count)
      out.details.push(e.content);
  }
  return out;
}
var regexCache = new Map;
function keyRegex(key) {
  if (!regexCache.has(key)) {
    let re = null;
    const m = /^\/([\s\S]+)\/([a-z]*)$/.exec(key);
    try {
      re = m ? new RegExp(m[1], m[2].replace(/[gy]/g, "")) : new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    } catch {
      re = null;
    }
    regexCache.set(key, re);
  }
  return regexCache.get(key);
}
var join2 = (parts) => parts.filter(Boolean).join(`

`);
function addBeforeHistory(messages, text, breakdown, name) {
  if (!text)
    return;
  const h = historyIndexes(messages);
  const first = h.length ? h[0] : messages.length;
  const prev = messages[first - 1];
  if (isSystemBlock(prev))
    messages[first - 1] = { ...prev, content: `${prev.content}

${text}` };
  else {
    messages.splice(first, 0, { role: "system", content: text, __wh: name });
  }
}
function addAtDepth(messages, depth, text, breakdown, name) {
  if (!text)
    return;
  const h = historyIndexes(messages);
  if (!h.length)
    return addBeforeHistory(messages, text, breakdown, name);
  const k = Math.max(0, h.length - depth);
  let at = h[k];
  const floor = k > 0 ? h[k - 1] + 1 : at;
  while (at > floor && isSystemBlock(messages[at - 1]))
    at--;
  if (isSystemBlock(messages[at]))
    messages[at] = { ...messages[at], content: `${text}

${messages[at].content}` };
  else {
    messages.splice(at, 0, { role: "system", content: text, __wh: name });
  }
}
function addAfterLast(messages, text, breakdown, name) {
  if (!text)
    return;
  const h = historyIndexes(messages);
  if (!h.length)
    return addBeforeHistory(messages, text, breakdown, name);
  const at = h[h.length - 1] + 1;
  const next = messages[at];
  if (isSystemBlock(next)) {
    const close = /^(?:\s*<\/[\w:-]+>[ \t]*(?:\r?\n|$))+/.exec(next.content);
    const head = close ? close[0].replace(/\s+$/, "") : "";
    const rest = close ? next.content.slice(close[0].length).replace(/^\s+/, "") : next.content;
    messages[at] = { ...next, content: join2([head, text, rest]) };
  } else {
    messages.splice(at, 0, { role: "system", content: text, __wh: name });
  }
}
function place(messages, parts, { continuing = false } = {}) {
  const breakdown = [];
  addAtDepth(messages, 4, parts.history, breakdown, "Worldhopper: Body History");
  addAtDepth(messages, 1, join2([parts.ledger, parts.mind, parts.details, continuing ? parts.anchors : ""]), breakdown, "Worldhopper: Ledger, Mind Book, details");
  if (!continuing)
    addAfterLast(messages, parts.anchors, breakdown, "Worldhopper: anchors");
  addBeforeHistory(messages, parts.codex, breakdown, "Worldhopper: Codex");
  messages.forEach((m, i) => {
    if (m.__wh) {
      breakdown.push({ messageIndex: i, name: m.__wh });
      delete m.__wh;
    }
  });
  return breakdown;
}

// src/backend/engine.js
var SCENE_MESSAGES = 4;
var RECENT_REPLIES = 30;
var LEDGER_WAIT_MS = 8000;
var inStory = (m) => !!m && !m.system && !!m.text;
var isReply = (m) => inStory(m) && !m.isUser;
var speakerName = (c, m) => m.isUser ? c.userName : m.name || c.charName || "Narrator";
var say = (c) => (m) => ({ name: speakerName(c, m), text: m.text });
var same3 = (a, b) => personaKey(a) === personaKey(b);
var reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function headLedger(c, before) {
  const h = headSnap(c, "ledger", before);
  return h ? { ledger: normalizeLedger(h.value), index: h.index } : null;
}
function headMind(c, before) {
  const h = headSnap(c, "mind", before);
  return h ? { book: normalizeBook(h.value), index: h.index } : null;
}
function lastReplyIndex(c) {
  for (let i = c.msgs.length - 1;i >= 0; i--)
    if (isReply(c.msgs[i]))
      return i;
  return -1;
}
var bodyModes = (c) => tracksBodies(c.modes);
var ledgerWanted = (s, c) => on(s) && s.ledger.enabled && bodyModes(c);
var mindKinds = (c) => KINDS.filter((k) => c.modes.includes(MIND_MODES[k]));
var mindWanted = (s, c) => on(s) && s.ledger.enabled && mindKinds(c).length > 0;
function cardNames(c) {
  return new Set([c.userName, ...c.members.map((m) => m.name)].filter(Boolean).map(personaKey));
}
var cardCharacter = (c, name) => c.members.find((ch) => same3(ch.name, name)) || null;
function takenBodies(c, ledger) {
  const skip = cardNames(c);
  return (ledger?.bodies || []).filter((b) => b.body && b.driver && b.body.toLowerCase() !== "none" && !skip.has(personaKey(b.body)));
}
function ledgerSnapshots(c, before) {
  const snaps = [];
  for (let i = 0;i < Math.min(before ?? c.msgs.length, c.msgs.length); i++) {
    const w = c.msgs[i].wh;
    if (w?.ledger)
      snaps.push({ index: i, ledger: w.ledger, notes: w.history });
  }
  return snaps;
}
var chatStatus = new Map;
var statusOf = (chatId) => chatStatus.has(chatId) ? chatStatus.get(chatId) : chatStatus.set(chatId, {}).get(chatId);
var notifier = () => {};
var onChange = (fn) => {
  notifier = fn;
};
var notify = (chatId) => {
  try {
    notifier(chatId);
  } catch (err) {
    warn("notify", err);
  }
};
function setStatus(chatId, field, text) {
  statusOf(chatId)[field] = text;
  log(text);
  notify(chatId);
}
var busy = (chatId, field, v) => {
  statusOf(chatId)[field] = v;
  notify(chatId);
};
var unreachable = (label, err) => !label ? "no model picked (Settings \u2192 Models)" : `couldn't reach the ${label} model${err?.message ? ` (${String(err.message).slice(0, 140)})` : ""}`;
var queue = Promise.resolve();
var enqueue = (fn) => queue = queue.then(fn).catch((err) => warn(err));
var ready = new Map;
function hold(chatId) {
  let done;
  ready.set(chatId, new Promise((r) => done = r));
  return () => done();
}
async function waitForLedger(chatId) {
  const p = ready.get(chatId);
  if (!p)
    return 0;
  const t0 = Date.now();
  await Promise.race([p, new Promise((r) => setTimeout(r, LEDGER_WAIT_MS))]);
  return Date.now() - t0;
}
async function updateLedger(c, mesId, { rebuild = false } = {}) {
  const fail = { ok: false, ended: [] };
  const msg = c.msgs[mesId];
  if (!msg)
    return fail;
  seen(msg.id, msg.text);
  const base = rebuild ? null : headLedger(c, mesId);
  const from = base ? base.index + 1 : Math.max(0, mesId - 7);
  const msgs = c.msgs.slice(Math.max(from, mesId - 5), mesId + 1).filter(inStory).map(say(c));
  const context = base ? c.msgs.slice(Math.max(0, base.index - 1), base.index + 1).filter(inStory).map(say(c)) : [];
  const first = !base;
  const userName = c.userName;
  const modes = c.modes;
  const messages = buildLedgerMessages({
    ledger: base?.ledger || EMPTY_LEDGER,
    messages: msgs,
    context,
    userName,
    modes,
    card: first && c.character ? cardText(c.character) : "",
    persona: first ? c.persona?.description || "" : "",
    update: !first
  });
  const t0 = Date.now();
  const askLedger = (m, max) => ask("ledger", m, max, 0.1);
  let text;
  try {
    text = await ask("ledger", messages, 900, 0.1);
  } catch (err) {
    setStatus(c.chatId, "ledger", `Ledger: ${unreachable(err.message.includes("no model") ? "" : "Ledger", err)}.`);
    warn(err);
    return fail;
  }
  let next = first ? parseLedger(text) : parseLedgerUpdate(text, base.ledger);
  if (!next) {
    setStatus(c.chatId, "ledger", "Ledger: the model's answer was unreadable; kept the previous ledger.");
    return fail;
  }
  if (!first) {
    try {
      next = (await verifyNewRides(base.ledger, next, { messages: msgs, context, userName, modes }, askLedger)).ledger;
    } catch {}
    try {
      next = (await verifyEndedRides(base.ledger, next, { messages: msgs, context, userName, modes }, askLedger)).ledger;
    } catch {}
  }
  next = labelMultiRides(next, modes);
  await writeSnap(c, msg, { ledger: normalizeLedger(next) });
  const ms = Date.now() - t0;
  setStatus(c.chatId, "ledger", `Ledger updated (${(ms / 1000).toFixed(1)}s).`);
  return { ok: true, ms, ended: rebuild ? [] : endedRides(base?.ledger || EMPTY_LEDGER, next) };
}
async function noteEndedRides(c, mesId, ended) {
  const msgs = c.msgs.slice(Math.max(0, mesId - 5), mesId + 1).filter(inStory).map(say(c));
  let text;
  try {
    text = await ask("notes", buildHistoryMessages(ended, msgs), 2000, 0.1);
  } catch (err) {
    setStatus(c.chatId, "ledger", `History note skipped: ${unreachable("notes", err)}.`);
    warn(err);
    return;
  }
  const notes = parseHistoryResponse(text, ended);
  const msg = c.msgs[mesId];
  if (!notes.length || !msg)
    return;
  await writeSnap(c, msg, { history: notes });
  notify(c.chatId);
}
var backfills = new Map;
function backfillCounts(c) {
  const all = c.msgs.map((m, i) => isReply(m) && !m.wh?.ledger ? i : -1).filter((i) => i >= 0);
  const replies = c.msgs.map((m, i) => isReply(m) ? i : -1).filter((i) => i >= 0);
  const cutoff = replies[Math.max(0, replies.length - RECENT_REPLIES)] ?? 0;
  return { all, recent: all.filter((i) => i >= cutoff) };
}
var backfillRunning = (chatId) => backfills.has(chatId);
function stopBackfill(chatId) {
  const j = backfills.get(chatId);
  if (j)
    j.stop = true;
}
async function backfill(chatId, which = "recent") {
  if (backfills.has(chatId))
    return;
  const job = { stop: false };
  backfills.set(chatId, job);
  notify(chatId);
  let done = 0, endings = 0, total = 0;
  await enqueue(async () => {
    try {
      const first = await loadChat(chatId);
      const { all, recent } = backfillCounts(first);
      const ids = (which === "all" ? all : recent).map((i) => first.msgs[i].id);
      total = ids.length;
      for (const id of ids) {
        if (job.stop)
          break;
        const c = await loadChat(chatId);
        const i = c.msgs.findIndex((m) => m.id === id);
        if (i < 0)
          continue;
        const r = await updateLedger(c, i);
        if (!r.ok)
          continue;
        done++;
        if (r.ended.length) {
          endings++;
          await noteEndedRides(c, i, r.ended);
        }
        setStatus(chatId, "ledger", `Building history: ${done} of ${total} replies\u2026`);
      }
    } finally {
      backfills.delete(chatId);
      setStatus(chatId, "ledger", `${job.stop ? "Stopped" : "Done"}: ${done} replies read, ${endings} ended body change${endings === 1 ? "" : "s"} found.`);
    }
  });
}
var personaJobs = new Set;
async function ensurePersonas(chatId) {
  const s = await settings();
  let c = await loadChat(chatId);
  if (!c || !ledgerWanted(s, c) || !s.ledger.connection)
    return;
  const head = headLedger(c);
  if (!head)
    return;
  const map = c.state.personas;
  const taken = new Set(takenBodies(c, head.ledger).map((b) => personaKey(b.body)));
  const over = Object.keys(map).filter((k) => map[k]?.removed && !taken.has(k));
  if (over.length) {
    for (const k of over)
      delete map[k];
    await saveChatState(chatId);
  }
  for (const row of takenBodies(c, head.ledger)) {
    const id = `${chatId}|${personaKey(row.body)}`;
    if (map[personaKey(row.body)] || personaJobs.has(id))
      continue;
    personaJobs.add(id);
    try {
      await writePersona(c, row);
    } finally {
      personaJobs.delete(id);
    }
    c = await loadChat(chatId);
  }
}
async function writePersona(c, row) {
  const chat = c.msgs.filter(inStory);
  const name = row.body;
  const named = new RegExp(`\\b${reEsc(name)}\\b`, "i");
  const picked = new Set([...chat.filter((m) => named.test(m.text)).slice(-6), ...chat.slice(-10)]);
  const msgs = chat.filter((m) => picked.has(m)).slice(-14).map(say(c));
  setStatus(c.chatId, "ledger", `Writing a host persona for ${name}\u2026`);
  let text;
  try {
    text = await ask("notes", buildPersonaMessages({ body: name, row, card: c.character ? cardText(c.character) : "", messages: msgs, userName: c.userName }), 2000, 0.4);
  } catch (err) {
    setStatus(c.chatId, "ledger", `Host persona for ${name} skipped: ${unreachable("notes", err)}.`);
    return;
  }
  const sheet = parsePersona(text);
  if (!sheet) {
    setStatus(c.chatId, "ledger", describesMinor(text) ? `Host persona for ${name} not kept: it described them as a minor.` : `Host persona for ${name}: the model's answer was unreadable.`);
    return;
  }
  await setSheet(c, name, sheet);
  setStatus(c.chatId, "ledger", `Host persona written for ${name}.`);
}
async function setSheet(c, name, sheet, { taken = false } = {}) {
  const map = c.state.personas;
  const k = personaKey(name);
  const prev = map[k];
  if (sheet)
    map[k] = { body: name, sheet, at: Date.now() };
  else if (prev?.sheet && taken)
    map[k] = { body: prev.body, removed: true, at: Date.now() };
  else
    delete map[k];
  await saveChatState(c.chatId);
  notify(c.chatId);
}
function movePerson(c, from, to) {
  for (const store of [c.state.personas, c.state.pictures]) {
    const a = personaKey(from), b = personaKey(to);
    if (a === b || !store[a] || store[b])
      continue;
    store[b] = { ...store[a], ..."body" in store[a] ? { body: to } : { name: to } };
    delete store[a];
  }
}
function hostsBack(c, ledger, limit) {
  const taken = new Set((ledger?.bodies || []).filter((b) => b.body).map((b) => personaKey(b.body)));
  const skip = cardNames(c);
  const recent = c.msgs.slice(Math.max(0, limit - SCENE_MESSAGES), limit).filter(inStory).map((m) => m.text).join(`
`);
  return Object.values(c.state.personas).filter((e) => e.sheet && !taken.has(personaKey(e.body)) && !skip.has(personaKey(e.body)) && personNamedIn(recent, [e.body]));
}
var pictureOf = (c, name) => c.state.pictures[personaKey(name)]?.image || "";
function lookOf(c, name) {
  const fromSheet = c.state.personas[personaKey(name)]?.sheet?.Look;
  return fromSheet ? { look: fromSheet, fromSheet: true } : { look: c.state.pictures[personaKey(name)]?.look || "", fromSheet: false };
}
async function setPicture(c, name, imageId) {
  const map = c.state.pictures;
  const k = personaKey(name);
  const old = map[k]?.image;
  map[k] = { ...map[k] || {}, name };
  if (imageId) {
    map[k].image = imageId;
    delete map[k].keepEmpty;
  } else {
    delete map[k].image;
    map[k].keepEmpty = true;
  }
  await saveChatState(c.chatId);
  notify(c.chatId);
  if (old && old !== imageId) {
    try {
      await sp.images.delete(old, user());
    } catch {}
  }
}
async function writeLook(c, name) {
  if (!(await settings()).ledger.connection) {
    setStatus(c.chatId, "ledger", `Picture of ${name}: write their look first, or pick a model under Settings \u2192 Models.`);
    return "";
  }
  const chat = c.msgs.filter(inStory);
  const named = new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(name)}(?![\\p{L}\\p{N}])`, "iu");
  const picked = new Set([...chat.filter((m) => named.test(m.text)).slice(-6), ...chat.slice(-6)]);
  const msgs = chat.filter((m) => picked.has(m)).slice(-10).map(say(c));
  setStatus(c.chatId, "ledger", `Describing ${name} for their picture\u2026`);
  let text;
  try {
    text = await ask("notes", buildLookMessages({ name, card: c.character ? cardText(c.character) : "", messages: msgs, userName: c.userName }), 1200, 0.4);
  } catch (err) {
    setStatus(c.chatId, "ledger", `Picture of ${name} skipped: ${unreachable("notes", err)}.`);
    return "";
  }
  const look = parseLook(text, name);
  if (!look) {
    setStatus(c.chatId, "ledger", describesMinor(text) ? `Picture of ${name} not drawn: the look described them as a minor.` : `Picture of ${name}: the model's answer was unreadable.`);
    return "";
  }
  const k = personaKey(name);
  c.state.pictures[k] = { ...c.state.pictures[k] || {}, name, look };
  await saveChatState(c.chatId);
  return look;
}
async function imageConnection() {
  const p = (await settings()).pictures;
  if (p.connection)
    return p.connection;
  try {
    const list = await sp.imageGen.listConnections(user());
    return (list.find((x) => x.is_default) || list[0])?.id || "";
  } catch {
    return "";
  }
}
var drawing = Promise.resolve();
function drawPicture(chatId, name) {
  const run = drawing.then(() => drawNow(chatId, name));
  drawing = run.catch(() => {});
  return run;
}
async function drawNow(chatId, name) {
  let c = await loadChat(chatId);
  const look = lookOf(c, name).look || await writeLook(c, name);
  if (!look)
    return;
  const connection = await imageConnection();
  if (!connection) {
    setStatus(chatId, "ledger", `Picture of ${name}: no image connection. Add one under Connections \u2192 Image Generation.`);
    return;
  }
  const p = (await settings()).pictures;
  setStatus(chatId, "ledger", `Drawing ${name}\u2026`);
  let res;
  try {
    res = await sp.imageGen.generate({
      connection_id: connection,
      prompt: [p.style, portraitPrompt(look, name)].filter(Boolean).join(" "),
      ...p.negative ? { negativePrompt: p.negative } : {},
      parameters: { seed: Math.floor(Math.random() * 2147483647) },
      owner_chat_id: chatId,
      userId: user()
    });
  } catch (err) {
    setStatus(chatId, "ledger", `Picture of ${name}: ${String(err.message || err).slice(0, 160)}.`);
    return;
  }
  let id = res?.imageId || "";
  if (!id && res?.imageDataUrl) {
    try {
      id = (await sp.images.uploadFromDataUrl(res.imageDataUrl, { originalFilename: `${personaKey(name)}.png`, userId: user() }))?.id || "";
    } catch {}
  }
  if (!id) {
    setStatus(chatId, "ledger", `Picture of ${name}: the image connection returned nothing.`);
    return;
  }
  c = await loadChat(chatId);
  await setPicture(c, name, id);
  setStatus(chatId, "ledger", `Picture drawn for ${name}.`);
}
var pictureTried = new Set;
var drawingNow = new Map;
async function ensurePictures(chatId) {
  const s = await settings();
  if (!on(s) || !s.pictures.auto)
    return;
  const c = await loadChat(chatId);
  const people = [];
  if (ledgerWanted(s, c)) {
    for (const b of takenBodies(c, headLedger(c)?.ledger))
      if (c.state.personas[personaKey(b.body)]?.sheet)
        people.push(b.body);
  }
  if (mindWanted(s, c)) {
    const book = headMind(c)?.book;
    for (const h of book?.hypnosis || [])
      people.push(h.who);
    for (const w of book?.control || [])
      people.push(...w.who);
  }
  const skip = cardNames(c);
  for (const name of people) {
    const k = personaKey(name);
    const id = `${chatId}|${k}`;
    if (!k || skip.has(k) || pictureOf(c, name) || c.state.pictures[k]?.keepEmpty || pictureTried.has(id) || drawingNow.has(`pic:${id}`))
      continue;
    pictureTried.add(id);
    await busyWork(`pic:${id}`, "Drawing\u2026", chatId, () => drawPicture(chatId, name));
  }
}
async function busyWork(key, label, chatId, job) {
  if (drawingNow.has(key))
    return;
  drawingNow.set(key, label);
  notify(chatId);
  try {
    await job();
  } finally {
    drawingNow.delete(key);
    notify(chatId);
  }
}
async function updateMind(c, mesId) {
  const kinds = mindKinds(c);
  const msg = c.msgs[mesId];
  if (!kinds.length || !msg)
    return null;
  seen(msg.id, msg.text);
  const base = headMind(c, mesId);
  const first = !base;
  const from = base ? base.index + 1 : Math.max(0, mesId - 5);
  const msgs = c.msgs.slice(Math.max(from, mesId - 5), mesId + 1).filter(inStory).map(say(c));
  const context = base ? c.msgs.slice(Math.max(0, base.index - 1), base.index + 1).filter(inStory).map(say(c)) : [];
  const text = msgs.map((m) => m.text).join(`
`);
  const card = first && c.character ? cardText(c.character) : "";
  let book = base?.book || EMPTY_BOOK;
  let ran = 0;
  const t0 = Date.now();
  try {
    for (const kind of kinds) {
      if (!first && !needsUpdate(kind, book, text))
        continue;
      if (!statusOf(c.chatId).mindBusy)
        busy(c.chatId, "mindBusy", true);
      let answer;
      try {
        answer = await ask("ledger", buildMindMessages(kind, { book, messages: msgs, context, userName: c.userName, card }), 700, 0.1);
      } catch (err) {
        setStatus(c.chatId, "ledger", `Mind Book: ${unreachable("Ledger", err)}.`);
        return null;
      }
      ran++;
      const next = applyMindUpdate(kind, book, answer);
      if (next)
        book = next;
      else
        warn(`Mind Book (${kind}): unreadable answer`);
    }
  } finally {
    if (statusOf(c.chatId).mindBusy)
      busy(c.chatId, "mindBusy", false);
  }
  if (!ran)
    return null;
  if (first || JSON.stringify(book) !== JSON.stringify(base.book))
    await writeSnap(c, msg, { mind: normalizeBook(book) });
  notify(c.chatId);
  return { ms: Date.now() - t0, ran };
}
function editRecord(prev, before, after, applied) {
  return prev && prev.edited === before ? { original: prev.original, edited: after, applied: [...prev.applied || [], ...applied], at: Date.now() } : { original: before, edited: after, applied, at: Date.now() };
}
var seenText = new Map;
function seen(id, text) {
  seenText.delete(id);
  seenText.set(id, text);
  if (seenText.size > 2000)
    seenText.delete(seenText.keys().next().value);
}
async function applyFix(chatId, messageId, original, text, applied) {
  const c = await loadChat(chatId);
  const msg = c?.msgs.find((m) => m.id === messageId);
  if (!msg || msg.text !== original)
    return false;
  seen(messageId, text);
  await writeSnap(c, msg, { edit: editRecord(msg.wh?.edit, original, text, applied) }, { content: text });
  return true;
}
async function runBodyChecks(c, mesId) {
  const head = headLedger(c, mesId + 1);
  if (!head || !hasCrossedBodies(head.ledger))
    return null;
  const pronouns = needsPronounCheck(head.ledger);
  if (!pronouns && !head.ledger.bodies.some((b) => b.user_knows === "no" && b.body && b.driver))
    return null;
  const msg = c.msgs[mesId];
  if (!msg || msg.isUser || msg.system || !msg.text || !looksLikeRoleplay(msg.text))
    return null;
  const t0 = Date.now();
  const original = msg.text;
  let text = original;
  const applied = [];
  if (pronouns) {
    try {
      const out = applyPronounFixes(text, parsePronounResponse(await ask("ledger", buildPronounMessages(text, head.ledger), 500, 0.1)), head.ledger);
      text = out.text;
      applied.push(...out.applied.map((a) => ({ action: "PRONOUN", ...a })));
    } catch {}
  }
  try {
    const out = applyCuts(text, parseLintResponse(await ask("ledger", buildLintMessages(text, head.ledger, c.userName), 500, 0.1)));
    text = out.text;
    applied.push(...out.applied);
  } catch {}
  const ms = Date.now() - t0;
  if (!applied.length) {
    setStatus(c.chatId, "checks", "Body checks: nothing to fix.");
    return ms;
  }
  if (!await applyFix(c.chatId, msg.id, original, text, applied)) {
    setStatus(c.chatId, "checks", "Body checks: the reply changed while it was being checked, so nothing was applied.");
    return ms;
  }
  setStatus(c.chatId, "checks", `Body checks: ${applied.length} fix${applied.length > 1 ? "es" : ""}. \u27F2 on the reply restores the original.`);
  return ms;
}
async function runMindCuts(c, mesId) {
  if (!mindKinds(c).includes("control"))
    return;
  if (resistanceSetUp(c.character ? cardText(c.character) : ""))
    return;
  let lastUser = "";
  for (let i = mesId - 1;i >= 0; i--)
    if (c.msgs[i]?.isUser) {
      lastUser = c.msgs[i].text;
      break;
    }
  if (resistanceSetUp(lastUser))
    return;
  if (headMind(c, mesId + 1)?.book.control.some((w) => w.resists === "yes"))
    return;
  const msg = c.msgs[mesId];
  if (!msg || msg.isUser || msg.system || !msg.text || !looksLikeRoleplay(msg.text))
    return;
  const original = msg.text;
  const cuts = trappedSelfCuts(original);
  if (!cuts.length)
    return;
  const out = applyCuts(original, cuts);
  if (!out.applied.length)
    return;
  if (await applyFix(c.chatId, msg.id, original, out.text, out.applied.map((a) => ({ ...a, why: "trapped self under mind control" })))) {
    setStatus(c.chatId, "checks", `Mind control: cut ${out.applied.length} line${out.applied.length > 1 ? "s" : ""} writing a trapped self. \u27F2 restores the original.`);
  }
}
async function toggleEdit(chatId, messageId) {
  const c = await loadChat(chatId);
  const msg = c?.msgs.find((m) => m.id === messageId);
  const rec = msg?.wh?.edit;
  if (!rec)
    return "none";
  let next;
  if (msg.text === rec.edited)
    next = rec.original;
  else if (msg.text === rec.original)
    next = rec.edited;
  else
    return "changed";
  seen(messageId, next);
  await writeSnap(c, msg, {}, { content: next });
  notify(chatId);
  return next === rec.original ? "original" : "fixed";
}
function noteTiming(chatId, t) {
  const s = (x) => `${(x / 1000).toFixed(1)}s`;
  const parts = [t.wait > 200 ? `waited ${s(t.wait)} for the ${t.ledger != null ? "Ledger" : "Mind Book"}` : "", t.ledger != null ? `Ledger ${s(t.ledger)}` : "", t.mind != null ? `Mind Book ${s(t.mind)}` : "", t.checks != null ? `body checks ${s(t.checks)}` : ""].filter(Boolean);
  if (parts.length)
    statusOf(chatId).timing = `Last turn: ${parts.join(" \xB7 ")}`;
}
var lastWait = new Map;
var noteWait = (chatId, ms) => lastWait.set(chatId, ms);
function onReply(chatId, messageId) {
  const done = hold(chatId);
  const wait = lastWait.get(chatId) || 0;
  lastWait.delete(chatId);
  enqueue(async () => {
    const s = await settings();
    let ended = [];
    const timing = { wait };
    let c;
    try {
      c = await loadChat(chatId);
      if (!c || !on(s))
        return;
      const mesId = c.msgs.findIndex((m) => m.id === messageId);
      if (mesId < 0)
        return;
      if ((ledgerWanted(s, c) || mindWanted(s, c)) && !s.ledger.connection) {
        setStatus(chatId, "ledger", `Ledger: ${unreachable("")}.`);
        return;
      }
      if (ledgerWanted(s, c)) {
        busy(chatId, "ledgerBusy", true);
        const r = await updateLedger(c, mesId);
        ended = r.ended;
        if (r.ok)
          timing.ledger = r.ms;
      }
      if (mindWanted(s, c)) {
        const m = await updateMind(c, mesId);
        if (m)
          timing.mind = m.ms;
      }
    } finally {
      if (statusOf(chatId).ledgerBusy)
        busy(chatId, "ledgerBusy", false);
      done();
    }
    if (!c)
      return;
    const mesId = c.msgs.findIndex((m) => m.id === messageId);
    if (mesId < 0)
      return;
    if (ledgerWanted(s, c) && s.ledger.connection) {
      const checks = await runBodyChecks(c, mesId);
      if (checks != null)
        timing.checks = checks;
    }
    if (on(s))
      await runMindCuts(await loadChat(chatId), mesId);
    noteTiming(chatId, timing);
    notify(chatId);
    const shared = !s.ledger.notesConnection || s.ledger.notesConnection === s.ledger.connection && s.ledger.notesModel === s.ledger.model;
    if (ended.length) {
      const notes = loadChat(chatId).then((c2) => noteEndedRides(c2, c2.msgs.findIndex((m) => m.id === messageId), ended)).catch((err) => warn(err));
      if (shared)
        await notes;
    }
    const sheets = ledgerWanted(s, c) ? ensurePersonas(chatId).catch((err) => warn(err)) : Promise.resolve();
    sheets.then(() => ensurePictures(chatId)).catch((err) => warn(err));
    if (shared)
      await sheets;
  });
}
var editTimers = new Map;
var lastReread = new Map;
function onEdited(chatId, messageId, content) {
  if (typeof content !== "string" || seenText.get(messageId) === content)
    return;
  seen(messageId, content);
  if (Date.now() - (lastReread.get(messageId) || 0) < 1e4)
    return;
  clearTimeout(editTimers.get(chatId));
  editTimers.set(chatId, setTimeout(() => rereadReply(chatId, messageId), 500));
}
async function rereadReply(chatId, messageId) {
  const s = await settings();
  const c0 = await loadChat(chatId);
  if (!c0 || !on(s) || !s.ledger.connection || !ledgerWanted(s, c0) && !mindWanted(s, c0))
    return;
  if (c0.msgs[lastReplyIndex(c0)]?.id !== messageId)
    return;
  lastReread.set(messageId, Date.now());
  const done = hold(chatId);
  enqueue(async () => {
    let ended = null;
    try {
      const c = await loadChat(chatId);
      const i = c.msgs.findIndex((m) => m.id === messageId);
      if (i < 0 || i !== lastReplyIndex(c))
        return;
      if (ledgerWanted(s, c)) {
        busy(chatId, "ledgerBusy", true);
        const r = await updateLedger(c, i);
        if (r.ok)
          ended = r.ended;
      }
      if (mindWanted(s, c))
        await updateMind(await loadChat(chatId), i);
    } finally {
      if (statusOf(chatId).ledgerBusy)
        busy(chatId, "ledgerBusy", false);
      done();
    }
    if (ended) {
      const c = await loadChat(chatId);
      const i = c.msgs.findIndex((m) => m.id === messageId);
      if (i >= 0 && ended.length)
        await noteEndedRides(c, i, ended);
      else if (i >= 0 && c.msgs[i].wh?.history)
        await writeSnap(c, c.msgs[i], { history: undefined });
    }
    if (ledgerWanted(s, c0))
      await ensurePersonas(chatId).catch((err) => warn(err));
    ensurePictures(chatId).catch((err) => warn(err));
    notify(chatId);
  });
}
async function catchUp(chatId) {
  const s = await settings();
  const c = await loadChat(chatId);
  if (!c || !ledgerWanted(s, c) || !s.ledger.connection)
    return;
  const i = lastReplyIndex(c);
  if (i <= 0 || c.msgs[i].wh?.ledger)
    return;
  const id = c.msgs[i].id;
  const done = hold(chatId);
  enqueue(async () => {
    try {
      const c2 = await loadChat(chatId);
      const j = c2.msgs.findIndex((m) => m.id === id);
      if (j < 0 || c2.msgs[j].wh?.ledger)
        return;
      busy(chatId, "ledgerBusy", true);
      await updateLedger(c2, j);
    } finally {
      if (statusOf(chatId).ledgerBusy)
        busy(chatId, "ledgerBusy", false);
      done();
    }
  });
}
function rebuildLedger(chatId) {
  setStatus(chatId, "ledger", "Rebuilding from the card and recent messages\u2026");
  const done = hold(chatId);
  return enqueue(async () => {
    try {
      const c = await loadChat(chatId);
      const i = c.msgs.length - 1;
      if (i < 0)
        return;
      busy(chatId, "ledgerBusy", true);
      await updateLedger(c, i, { rebuild: true });
    } finally {
      if (statusOf(chatId).ledgerBusy)
        busy(chatId, "ledgerBusy", false);
      done();
    }
  });
}

// src/backend/viewdata.js
var imageUrl = (id) => id ? `/api/v1/images/${encodeURIComponent(id)}?size=sm` : "";
var COPY2 = /cop(y|ied)|propagat/i;
function faceFor(c, name) {
  const k = personaKey(name);
  if (!k)
    return {};
  if (same3(name, c.userName))
    return { image: imageUrl(c.persona?.image_id) };
  const ch = cardCharacter(c, name);
  if (ch)
    return { image: imageUrl(ch.image_id) };
  return { image: imageUrl(pictureOf(c, name)), busy: drawingNow.get(`pic:${c.chatId}|${k}`) || "", open: name };
}
function ledgerRows(c, ledger) {
  const canon = aliasResolver(ledger);
  const me = canon(c.userName);
  return (ledger?.bodies || []).map((b) => {
    const body = b.body && b.body.toLowerCase() !== "none" ? b.body : null;
    const copy = COPY2.test(b.how);
    const main = !body ? `${b.driver}: no body` : b.driver ? `${body} \u2190 ${copy ? `a copy of ${b.driver}` : b.driver}` : `${body}: empty`;
    const sub = [b.how && !/^possess/i.test(b.how) ? b.how : "", b.host ? `mind: ${b.host}` : "", b.notes].filter(Boolean).join(" \xB7 ");
    const kind = !b.driver || !body ? "idle" : !copy && canon(b.driver) === me ? "you" : "npc";
    return { main, sub, hidden: b.user_knows === "no" && !!body && !!b.driver, kind, icon: copy ? "clone" : kind === "idle" ? "user-slash" : kind === "you" ? "user" : "ghost" };
  });
}
function historyRows(c) {
  return historyGroups(bodyHistory(ledgerSnapshots(c))).map((g) => {
    const times = g.ended === 1 ? "once" : g.ended === 2 ? "twice" : `${g.ended}\xD7`;
    return {
      main: `${g.driver} \u2192 ${g.bodies.join(", ")} \xB7 ${times}${g.ongoing ? ", again now" : ""}`,
      sub: [g.notes.remembers ? `remembers: ${g.notes.remembers}` : g.host ? `mind: ${g.host}` : "", g.notes.kept ? `kept: ${g.notes.kept}` : "", g.notes.left ? `left: ${g.notes.left}` : ""].filter(Boolean).join(" \xB7 "),
      hidden: g.user_knows === "no"
    };
  });
}
function stripChips(c, ledger) {
  const canon = aliasResolver(ledger);
  const me = canon(c.userName);
  return (ledger?.bodies || []).map((b) => {
    const body = b.body && b.body.toLowerCase() !== "none" ? b.body : null;
    const copy = COPY2.test(b.how) && body && b.driver;
    const kind = !body ? "mind" : !b.driver ? "empty" : copy ? "npc" : canon(b.driver) === me ? "you" : "npc";
    const title = body || b.driver;
    const sub = copy ? `a copy of ${canon(b.driver) === me ? "you" : b.driver}` : { you: "you're inside", npc: canon(body) === me ? `${b.driver} is in you` : `${b.driver} inside`, empty: "empty", mind: "no body" }[kind];
    const icon = copy ? "clone" : { you: "user", npc: "ghost", empty: "user-slash", mind: "wind" }[kind];
    const aka = body ? akaOf(ledger, body) : [];
    const tip = [b.how, b.host ? `own mind: ${b.host}` : "", aka.length ? `also ${aka.join(", ")}` : "", b.user_knows === "no" ? "hidden from you" : ""].filter(Boolean).join(" \xB7 ");
    return { kind, icon, title, sub, tip, hidden: b.user_knows === "no", face: faceFor(c, title).image };
  });
}
function mindChips(c, book) {
  const me = c.userName.toLowerCase();
  const mine = (by) => by && by.toLowerCase() === me ? "you" : "npc";
  const you = (n) => n && n.toLowerCase() === me ? "you" : n;
  return [
    ...(book?.hypnosis || []).map((h) => ({
      kind: mine(h.by),
      icon: "circle-dot",
      title: h.who,
      sub: h.now === "awake" ? h.times ? `awake \xB7 under ${h.times}\xD7` : "awake" : `${h.now} trance`,
      tip: ["hypnosis", h.by ? `by ${you(h.by)}` : "", h.suggestions.length ? `${h.suggestions.length} suggestion${h.suggestions.length > 1 ? "s" : ""}` : "", h.triggers.length ? `triggers: ${h.triggers.map((t) => `"${t.cue}"`).join(", ")}` : ""].filter(Boolean).join(" \xB7 "),
      hidden: h.user_knows === "no",
      face: faceFor(c, h.who).image
    })),
    ...(book?.control || []).map((w) => ({
      kind: mine(w.by),
      icon: "hand-sparkles",
      title: w.who.join(", "),
      sub: `${w.by ? mine(w.by) === "you" ? "your control" : `${w.by}'s control` : "controlled"}${w.resists === "yes" ? " \xB7 resisting" : ""}`,
      tip: ["mind control", ...w.set.map((x) => `${x.kind} ${x.text}`)].join(" \xB7 "),
      hidden: w.user_knows === "no",
      face: faceFor(c, w.who[0]).image
    })),
    ...(book?.perception || []).map((e) => ({
      kind: mine(e.by),
      icon: "eye-slash",
      title: e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(", ")}` : ""}` : e.who.join(", "),
      sub: e.kind === "unseen" ? `can't perceive ${you(e.target)}` : e.kind === "false" ? "believes a falsehood" : "altered normal",
      tip: ["altered perception", e.what, e.by ? `by ${you(e.by)}` : ""].filter(Boolean).join(" \xB7 "),
      hidden: e.user_knows === "no"
    }))
  ];
}
function mindRows(c, book) {
  const me = c.userName.toLowerCase();
  const mine = (by) => by && by.toLowerCase() === me ? "you" : "npc";
  const rows = [];
  for (const h of book?.hypnosis || []) {
    rows.push({
      main: `${h.who} \xB7 ${h.now === "awake" ? "awake" : `${h.now} trance`}`,
      sub: [
        h.by ? `by ${h.by}` : "",
        h.susceptibility ? `${h.susceptibility} susceptibility` : "",
        h.times ? `under ${h.times}\xD7, deepest ${h.deepest || "light"}` : "",
        h.suggestions.length ? `${h.suggestions.length} suggestion${h.suggestions.length > 1 ? "s" : ""}: ${h.suggestions.map((x) => x.text).join("; ")}` : "",
        h.triggers.length ? `triggers: ${h.triggers.map((x) => `"${x.cue}"`).join(", ")}` : ""
      ].filter(Boolean).join(" \xB7 "),
      hidden: h.user_knows === "no",
      kind: mine(h.by),
      icon: "circle-dot"
    });
  }
  for (const w of book?.control || []) {
    rows.push({ main: `${w.who.join(", ")}${w.by ? ` \u2190 ${w.by}` : ""}${w.resists === "yes" ? " \xB7 resisting" : ""}`, sub: [...w.set.map((x) => `${x.kind} ${x.text}`), w.own ? `own: ${w.own}` : ""].filter(Boolean).join(" \xB7 "), hidden: w.user_knows === "no", kind: mine(w.by), icon: "hand-sparkles" });
  }
  for (const e of book?.perception || []) {
    const who = e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(", ")}` : ""}` : e.who.join(", ");
    rows.push({ main: e.kind === "unseen" ? `${who} can't perceive ${e.target}` : `${who}: ${e.kind === "false" ? "believes" : "takes as normal"}`, sub: [e.what, e.by ? `by ${e.by}` : ""].filter(Boolean).join(" \xB7 "), hidden: e.user_knows === "no", kind: mine(e.by), icon: "eye-slash" });
  }
  return rows;
}
var LANE_HUES = ["29, 158, 117", "127, 119, 221", "216, 90, 48", "212, 83, 126", "186, 117, 23", "55, 138, 221", "99, 153, 34", "226, 75, 74"];
function laneColours(c) {
  const me = c.userName;
  const map = new Map([[me.toLowerCase(), 0]]);
  let next = 1;
  for (const snap of ledgerSnapshots(c)) {
    const l = normalizeLedger(snap.ledger);
    const canon = aliasResolver(l);
    for (const b of l.bodies) {
      if (!b.body || !b.driver || canon(b.driver) !== canon(me) || COPY2.test(b.how) || map.has(b.body.toLowerCase()))
        continue;
      map.set(b.body.toLowerCase(), next);
      next = next % (LANE_HUES.length - 1) + 1;
    }
  }
  return map;
}
function laneHue(map, name) {
  const k = String(name || "").trim().toLowerCase();
  const i = map.has(k) ? map.get(k) : 1 + [...k].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7) % (LANE_HUES.length - 1);
  return LANE_HUES[i];
}
function badges(c) {
  const out = [];
  let ledger = null;
  for (const m of c.msgs) {
    if (m.isUser && ledger) {
      const canon = aliasResolver(ledger);
      const me = canon(m.name || c.userName);
      const worn = ledger.bodies.filter((b) => b.driver && b.body && b.body.toLowerCase() !== "none" && canon(b.driver) === me && canon(b.body) !== me && !COPY2.test(b.how)).map((b) => b.body);
      if (worn.length)
        out.push({ messageId: m.id, worn });
    }
    if (m.wh?.ledger)
      ledger = normalizeLedger(m.wh.ledger);
  }
  return out;
}
function ledgerViewData(c, s) {
  const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
  const canon = aliasResolver(ledger);
  const me = canon(c.userName);
  const map = c.state.personas;
  const names = cardNames(c);
  const host = (name, kind) => {
    const e = map[personaKey(name)];
    return { sheet: e?.sheet || null, removed: !!e?.removed, busy: drawingNow.get(`sheet:${c.chatId}|${personaKey(name)}`) || "", face: faceFor(c, name, kind) };
  };
  const taken = new Set(takenBodies(c, ledger).map((b) => personaKey(b.body)));
  const inLedger = new Set(ledger.bodies.filter((b) => b.body).map((b) => personaKey(b.body)));
  const bodies = ledger.bodies.map((b, i) => {
    const body = b.body && b.body.toLowerCase() !== "none" ? b.body : null;
    const copy = COPY2.test(b.how) && body && b.driver;
    const kind = !body ? "mind" : !b.driver ? "idle" : copy ? "npc" : canon(b.driver) === me ? "you" : "npc";
    const sheetable = !!body && (taken.has(personaKey(body)) || !!map[personaKey(body)]?.sheet && !names.has(personaKey(body)));
    const row = { body: b.body, pronouns: b.pronouns, driver: b.driver, driver_pronouns: b.driver_pronouns, how: b.how, host: b.host, notes: b.notes, doing: b.doing, user_knows: b.user_knows };
    return {
      i,
      row,
      title: body || b.driver,
      kind,
      sheetable,
      hidden: b.user_knows === "no" && !!body && !!b.driver,
      icon: copy ? "clone" : { you: "user", npc: "ghost", idle: "user-slash", mind: "wind" }[kind],
      inside: copy ? `a copy of ${canon(b.driver) === me ? "you" : b.driver}` : { you: "you're inside", npc: canon(body) === me ? `${b.driver} is in you` : `${b.driver} inside`, idle: "empty", mind: "no body" }[kind],
      ...body && !names.has(personaKey(body)) ? host(body, kind) : { sheet: null, face: faceFor(c, body || b.driver) }
    };
  });
  const back = hostsBack(c, ledger, c.msgs.length).map((e) => ({ body: e.body, ...host(e.body, "back") }));
  const shown = new Set([...inLedger, ...back.map((e) => personaKey(e.body))]);
  const past = Object.values(map).filter((e) => e.sheet && !shown.has(personaKey(e.body))).sort((a, b) => a.body.localeCompare(b.body)).map((e) => ({ body: e.body, ...host(e.body, "idle") }));
  const history = historyGroups(bodyHistory(ledgerSnapshots(c))).map((g) => ({
    title: `${g.driver} in ${g.bodies.join(", ")} \xB7 ${g.ended === 1 ? "once" : g.ended === 2 ? "twice" : `${g.ended}\xD7`}${g.ongoing ? ", again now" : ""}`,
    lines: [
      g.notes.remembers ? ["Remembers", g.notes.remembers] : g.host ? ["Their mind", g.host] : null,
      g.notes.kept ? ["Kept", g.notes.kept] : null,
      g.notes.left ? ["Left behind", g.notes.left] : null
    ].filter(Boolean),
    hidden: g.user_knows === "no",
    ongoing: g.ongoing
  }));
  return {
    bodies,
    back,
    past,
    history,
    powers: ledger.powers,
    aliases: ledger.aliases,
    ...missingPictures([...bodies.map((b) => [b.title, b.face]), ...back.map((h) => [h.body, h.face]), ...past.map((h) => [h.body, h.face])]),
    empty: ledgerWanted(s, c) ? "Everyone is in their own body." : "The Ledger is off: switch on Body Ledger & Mind Book under Settings \u2192 Choices, and pick a body mode."
  };
}
var batch = null;
var setBatch = (b) => {
  batch = b;
};
function missingPictures(faces) {
  const names = [...new Map(faces.filter(([, f]) => f?.open && !f.image).map(([n]) => [personaKey(n), n])).values()];
  return { missing: names, batch: batch ? `Drawing ${Math.min(batch.done + 1, batch.total)} of ${batch.total}\u2026` : "" };
}
function mindViewData(c) {
  const book = normalizeBook(headMind(c)?.book || EMPTY_BOOK);
  const me = c.userName.toLowerCase();
  const isMe = (n) => !!n && n.toLowerCase() === me;
  const kind = (by) => isMe(by) ? "you" : "npc";
  const label = (n) => isMe(n) ? "you" : n;
  const hypnosis = book.hypnosis.map((h) => [h.who, faceFor(c, h.who)]);
  const control = book.control.map((w) => [w.who[0], faceFor(c, w.who[0])]);
  return {
    ...missingPictures([...hypnosis, ...control]),
    kinds: [...new Set([...mindKinds(c), ...KINDS.filter((k) => book[k].length)])],
    hypnosis: book.hypnosis.map((h, i) => ({
      i,
      raw: h,
      who: h.who,
      kind: kind(h.by),
      by: h.by,
      byLabel: label(h.by),
      susceptibility: h.susceptibility,
      times: h.times,
      amnesia: h.amnesia === "yes",
      hidden: h.user_knows === "no",
      now: h.now || "awake",
      deepest: h.deepest,
      suggestions: h.suggestions.map((x) => ({ text: x.text, stage: x.stage, reinforced: x.times > 1 })),
      triggers: h.triggers,
      face: faceFor(c, h.who)
    })),
    control: book.control.map((w, i) => ({
      i,
      raw: w,
      who: w.who,
      kind: kind(w.by),
      by: w.by,
      byLabel: label(w.by),
      resists: w.resists === "yes",
      hidden: w.user_knows === "no",
      set: w.set,
      own: w.own,
      face: faceFor(c, w.who[0])
    })),
    perception: book.perception.map((e, i) => {
      const who = e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(", ")}` : ""}` : e.who.join(", ");
      return {
        i,
        raw: e,
        kind: kind(e.by),
        by: e.by,
        byLabel: label(e.by),
        hidden: e.user_knows === "no",
        what: e.what,
        icon: e.kind === "unseen" ? "eye-slash" : e.kind === "false" ? "masks-theater" : "wand-magic-sparkles",
        title: e.kind === "unseen" ? `${who} can't perceive ${label(e.target)}` : e.kind === "false" ? `${who}: a false belief` : `${who}: an altered normal`
      };
    }),
    empty: "Pick Hypnosis, Mind Control or Altered Perception for this character to start a Mind Book."
  };
}
function pictureViewData(c, name, kind = "idle") {
  const { look, fromSheet } = lookOf(c, name);
  return { name, image: imageUrl(pictureOf(c, name)).replace("?size=sm", ""), look, lookFromSheet: fromSheet, busy: drawingNow.get(`pic:${c.chatId}|${personaKey(name)}`) || "", kind };
}
function stateFor(c, s, extra = {}) {
  const st = statusOf(c?.chatId);
  const base = {
    type: "state",
    chatId: c?.chatId || null,
    on: on(s),
    settings: { enabled: s.enabled, ledger: s.ledger, pictures: s.pictures },
    status: { ledger: st.ledger || "", checks: st.checks || "", timing: st.timing || "" },
    ...extra
  };
  if (!c)
    return { ...base, target: null };
  const t = target(c);
  const builder = !!c.character?.extensions?.worldhopper?.tool;
  const ledger = headLedger(c)?.ledger;
  const book = headMind(c)?.book;
  const bodiesOn = ledgerWanted(s, c);
  const mindOn = mindWanted(s, c);
  const colours = laneColours(c);
  const roster = bodiesOn && ledger ? rosterOf(ledger, c.userName) : [];
  const sug = t ? s.suggested[t.key] : null;
  const counts = backfillCounts(c);
  return {
    ...base,
    target: t && { key: t.key, label: t.label, group: !!t.group, builder, characterId: c.character?.id || null },
    picks: c.picks,
    modes: c.modes,
    blurbs: MODE_BLURBS,
    suggestion: on(s) && !c.picks.length && Array.isArray(sug) && sug.length ? sug : null,
    showLedgerCard: on(s) && bodyModes(c),
    showMindCard: on(s) && mindKinds(c).length > 0,
    ledgerEnabled: s.ledger.enabled,
    panel: {
      ledgerRows: ledgerRows(c, ledger),
      extra: [
        ledger?.powers?.length ? `Powers: ${ledger.powers.map((p) => `${p.who} (${p.power})`).join(", ")}` : "",
        ledger?.aliases?.length ? `Also known as: ${ledger.aliases.map((a) => [a.name, ...a.aka].join(" = ")).join("; ")}` : ""
      ].filter(Boolean),
      ledgerEmpty: ledgerWanted(s, c) ? "Everyone is in their own body." : "Off: switch on Body Ledger & Mind Book under Settings \u2192 Choices.",
      historyRows: historyRows(c),
      mindRows: mindRows(c, book),
      mindEmpty: isEmptyBook(book) ? s.ledger.enabled ? "Nothing yet. It fills in when someone is hypnotized, controlled, or has their perception changed. Tap \u270F\uFE0F to add something yourself." : "The Mind Book is off with the Body Ledger (Settings \u2192 Choices)." : ""
    },
    strip: { show: bodiesOn && !!c.msgs.length && (!!ledger?.bodies?.length || !!st.ledgerBusy), chips: stripChips(c, ledger), busy: !!st.ledgerBusy },
    mindStrip: { show: mindOn && !!c.msgs.length && (!isEmptyBook(book) || !!st.mindBusy), chips: mindChips(c, book), busy: !!st.mindBusy },
    roster: {
      show: roster.length > 0,
      compact: roster.length > 6 || !!s.ledger.lanesCompact,
      big: roster.length > 6,
      cards: roster.map((r) => ({ name: r.name, own: !!r.own, doing: r.doing || "", notes: r.notes || "", hue: laneHue(colours, r.name) }))
    },
    laneHues: Object.fromEntries([...colours.keys()].map((k) => [k, laneHue(colours, k)])),
    badges: s.ledger.enabled ? badges(c) : [],
    edited: c.msgs.filter((m) => m.wh?.edit).map((m) => ({ messageId: m.id, original: m.text === m.wh.edit.original })),
    backfill: { running: backfillRunning(c.chatId), all: counts.all.length, recent: counts.recent.length },
    views: { ledger: ledgerViewData(c, s), mind: mindViewData(c) }
  };
}

// src/backend/actions.js
var changedMeanwhile = (what) => `The ${what} changed while you were editing. Cancel, look it over, and try again.`;
async function storeLedgerEdit(c, next) {
  const msg = c.msgs[c.msgs.length - 1];
  if (!msg)
    return "Open a chat first.";
  await writeSnap(c, msg, { ledger: normalizeLedger(next) });
  notify(c.chatId);
  return true;
}
async function saveBody(chatId, orig, { row, sheet }) {
  const c = await loadChat(chatId);
  if (!c?.msgs.length)
    return "Open a chat first.";
  row = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, String(v ?? "").trim()]));
  const made = sheet ? sheetFromFields(sheet) : null;
  if (made?.minor)
    return "Hosts are adults: that sheet describes a minor, so it wasn't saved.";
  const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
  const at = orig ? ledger.bodies.findIndex((b) => same3(b.body, orig.body) && same3(b.driver, orig.driver)) : -1;
  if (orig && at < 0)
    return changedMeanwhile("Ledger");
  const next = { ...orig ? ledger.bodies[at] : {}, ...row };
  if (!next.body && !next.driver)
    return "A body needs a name, or a mind inside it.";
  if (orig)
    ledger.bodies[at] = next;
  else
    ledger.bodies.push(next);
  if (orig?.body && next.body && !same3(orig.body, next.body))
    movePerson(c, orig.body, next.body);
  if (made?.sheet && next.body && !cardNames(c).has(personaKey(next.body)))
    await setSheet(c, next.body, made.sheet);
  return storeLedgerEdit(c, ledger);
}
async function removeBody(chatId, orig) {
  const c = await loadChat(chatId);
  const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
  const at = ledger.bodies.findIndex((b) => same3(b.body, orig.body) && same3(b.driver, orig.driver));
  if (at < 0)
    return changedMeanwhile("Ledger");
  ledger.bodies.splice(at, 1);
  return storeLedgerEdit(c, ledger);
}
async function saveListItem(chatId, list, i, v) {
  const c = await loadChat(chatId);
  const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
  let item = null;
  if (v && list === "powers") {
    item = { who: String(v.who || "").trim(), power: String(v.power || "").trim() };
    if (!item.who || !item.power)
      return "Say who has it and what it is.";
  }
  if (v && list === "aliases") {
    item = { name: String(v.name || "").trim(), aka: String(v.aka || "").split(",").map((x) => x.trim()).filter(Boolean) };
    if (!item.name || !item.aka.length)
      return "Give the main name and at least one other.";
  }
  if (i < 0)
    ledger[list].push(item);
  else if (item)
    ledger[list][i] = item;
  else
    ledger[list].splice(i, 1);
  return storeLedgerEdit(c, ledger);
}
var isTaken = (c, name) => takenBodies(c, headLedger(c)?.ledger).some((b) => same3(b.body, name));
async function saveSheet(chatId, name, values) {
  const c = await loadChat(chatId);
  const made = sheetFromFields(values);
  if (made.minor)
    return "Hosts are adults: that sheet describes a minor, so it wasn't saved.";
  await setSheet(c, name, made.sheet, { taken: isTaken(c, name) });
  return true;
}
async function deleteSheet(chatId, name) {
  const c = await loadChat(chatId);
  await setSheet(c, name, null, { taken: isTaken(c, name) });
  return true;
}
async function writeSheet(chatId, name) {
  const c = await loadChat(chatId);
  const row = headLedger(c)?.ledger?.bodies?.find((b) => same3(b.body, name)) || { body: name };
  await busyWork(`sheet:${chatId}|${personaKey(name)}`, "Writing the sheet\u2026", chatId, () => writePersona(c, row));
  return true;
}
async function makePersona(chatId, name, description) {
  const c = await loadChat(chatId);
  const e = c.state.personas[personaKey(name)];
  if (!e?.sheet)
    return { error: "No sheet for them yet." };
  const persona = await sp.personas.create({ name, title: "Worldhopper host", description: String(description || "").trim() }, user());
  return { personaId: persona?.id, image: pictureOf(c, name) };
}
async function personaDraft(chatId, name) {
  const c = await loadChat(chatId);
  const e = c.state.personas[personaKey(name)];
  if (!e?.sheet)
    return null;
  const row = (headLedger(c)?.ledger?.bodies || []).find((b) => same3(b.body, name));
  let existing = false;
  try {
    existing = (await sp.personas.list({ limit: 200, userId: user() })).data.some((p) => same3(p.name, name));
  } catch {}
  return { text: `${name}${row?.pronouns ? ` (${row.pronouns})` : ""}
${personaText(e.sheet)}`, existing, picture: !!pictureOf(c, name) };
}
function mindEntryFromForm(kind, o, raw) {
  const lines = (s) => String(s || "").split(`
`).map((x) => x.trim()).filter(Boolean);
  const out = { ...raw || {}, ...o };
  if ("suggestions" in o)
    out.suggestions = lines(o.suggestions).map((l) => {
      const [text, stage, n] = l.split("|").map((x) => x.trim());
      return { text, stage, times: parseInt(n, 10) || 1 };
    });
  if ("triggers" in o)
    out.triggers = lines(o.triggers).map((l) => {
      const [cue, ...rest] = l.split(/\s*(?:\u2192|->)\s*/);
      return { cue, effect: rest.join(" \u2192 ") };
    });
  if ("set" in o)
    out.set = lines(o.set).map((l) => {
      const m = l.match(/^\s*(wants|feels|believes|loyal to|command)\s*:\s*(.+)$/i);
      return m ? { kind: m[1].toLowerCase(), text: m[2] } : { kind: "wants", text: l };
    });
  if ("everyone" in o)
    out.everyone = o.everyone === "yes";
  return out;
}
var findEntry = (list, raw) => list.findIndex((x) => raw.id ? x.id === raw.id : JSON.stringify(x) === JSON.stringify(raw));
async function storeMindEdit(c, next) {
  const msg = c.msgs[c.msgs.length - 1];
  if (!msg)
    return "Open a chat first.";
  await writeSnap(c, msg, { mind: normalizeBook(next) });
  notify(c.chatId);
  return true;
}
async function saveMindEntry(chatId, kind, raw, values) {
  const c = await loadChat(chatId);
  const book = normalizeBook(headMind(c)?.book || EMPTY_BOOK);
  const list = [...book[kind]];
  const entry = mindEntryFromForm(kind, values, raw);
  const need = kind === "perception" ? entry.what : entry.who;
  if (!String(Array.isArray(need) ? need.join("") : need || "").trim())
    return kind === "perception" ? "Say what the edit is." : "Say who it is.";
  if (kind !== "perception" && describesMinor(JSON.stringify(entry)))
    return "People here are adults: that entry describes a minor, so it wasn't saved.";
  if (raw) {
    const at = findEntry(list, raw);
    if (at < 0)
      return changedMeanwhile("Mind Book");
    list[at] = entry;
  } else
    list.push(entry);
  return storeMindEdit(c, { ...book, [kind]: list });
}
async function removeMindEntry(chatId, kind, raw) {
  const c = await loadChat(chatId);
  const book = normalizeBook(headMind(c)?.book || EMPTY_BOOK);
  const at = findEntry(book[kind], raw);
  if (at < 0)
    return changedMeanwhile("Mind Book");
  return storeMindEdit(c, { ...book, [kind]: book[kind].filter((_, j) => j !== at) });
}
async function draw(chatId, name) {
  await busyWork(`pic:${chatId}|${personaKey(name)}`, "Drawing\u2026", chatId, () => drawPicture(chatId, name));
  return true;
}
async function drawMissing(chatId, names) {
  const todo = names.slice();
  const job = { done: 0, total: todo.length };
  setBatch(job);
  notify(chatId);
  let drawn = 0;
  try {
    for (const n of todo) {
      await busyWork(`pic:${chatId}|${personaKey(n)}`, "Drawing\u2026", chatId, () => drawPicture(chatId, n));
      if (pictureOf(await loadChat(chatId), n))
        drawn++;
      job.done++;
      notify(chatId);
    }
  } finally {
    setBatch(null);
    notify(chatId);
  }
  return { drawn, total: todo.length };
}
async function usePicture(chatId, name, dataUrl) {
  if (!/^data:image\/[\w.+-]+;base64,/.test(String(dataUrl || "")))
    return "That file is not a picture.";
  const img = await sp.images.uploadFromDataUrl(dataUrl, { originalFilename: `${personaKey(name) || "picture"}.png`, userId: user() });
  if (!img?.id)
    return "The picture couldn't be saved.";
  await setPicture(await loadChat(chatId), name, img.id);
  return true;
}
async function removePicture(chatId, name) {
  await setPicture(await loadChat(chatId), name, "");
  return true;
}
async function saveLook(chatId, name, text) {
  const c = await loadChat(chatId);
  const look = String(text || "").replace(/\s+/g, " ").trim();
  if (look && describesMinor(look))
    return "People here are adults: that look describes a minor, so it wasn't saved.";
  const k = personaKey(name);
  c.state.pictures[k] = { ...c.state.pictures[k] || {}, name };
  if (look)
    c.state.pictures[k].look = look;
  else
    delete c.state.pictures[k].look;
  await saveChatState(chatId);
  notify(chatId);
  return true;
}

// src/core/card-core.js
var estimateTokens = (s) => Math.round(String(s || "").length / 4.4);
var COMMON_WORDS = new Set("angel april art author autumn bill cal chase dawn drew eight faith five four grace grant guy hope hunter jack joy june kai mark max may nine one pat ray rich rose sam seven six sky star sue summer ten three two will".split(" "));
var REVIEW_SYSTEM = `You review character cards for an adult metaphysics roleplay setup. The setup's Codex (the Worldhopper Codex) already defines each mode's general mechanics; the card should state only its own specifics, and never contradict the Codex or its rules. The Codex rules: possessed hosts are simply gone unless the card says otherwise; mind control changes the mind itself, felt as the subject's own; one mind in several bodies never converses with itself and never moves in sync (it may touch itself and talk about its other bodies freely); narration never points out who is inside a body; a possession the player hasn't been told about stays invisible; characters use their powers without asking permission.
List up to 6 concrete problems that would hurt play: contradictions with the Codex definitions or its rules, mechanics left unclear, inconsistencies between sections, greetings that break the rules, things the model is likely to get wrong. Skip anything the Codex already settles unless the card contradicts it. For each, in two or three short sentences: quote the few words at fault, say what goes wrong in play, and give the fix; every fix must itself follow the Codex rules (never one that has narration point out who is inside a body). Most serious first. If the card is fine, say so in one line. A numbered list, no preamble, no closing remarks.`;
var REVIEW_TOOL = "This card is a card builder: a tool character that helps the author write metaphysics cards, one piece at a time. Judge it as instructions for that job (clear, consistent, and producing cards that follow the Codex), not as a roleplay character. It has no modes of its own, and its length is expected.";
function buildReviewMessages(d, modes, codexText, { tool = false } = {}) {
  const clip = (s, n) => String(s || "").length > n ? String(s).slice(0, n) + " \u2026" : String(s || "");
  const parts = [
    tool ? REVIEW_TOOL : `Codex modes picked for this card: ${modes.join(", ") || "none"}.`,
    codexText ? `The Codex's definitions of those modes:
${clip(codexText, 6000)}` : "",
    `CARD: ${d.name}`,
    `DESCRIPTION:
${clip(d.description, 9000)}`,
    d.personality ? `PERSONALITY:
${clip(d.personality, 1500)}` : "",
    d.scenario ? `SCENARIO:
${clip(d.scenario, 1500)}` : "",
    d.post_history_instructions ? `POST-HISTORY INSTRUCTIONS:
${clip(d.post_history_instructions, 2500)}` : "",
    d.first_mes ? `FIRST MESSAGE:
${clip(d.first_mes, 4000)}` : "",
    ...(d.alternate_greetings || []).slice(0, 4).map((g, i) => `ALTERNATE GREETING ${i + 1}:
${clip(g, 2000)}`)
  ].filter(Boolean);
  return [{ role: "system", content: REVIEW_SYSTEM }, { role: "user", content: parts.join(`

`) }];
}

// src/backend/cards.js
async function suggestModes(chatId, { force = false } = {}) {
  const s = await settings();
  const c = await loadChat(chatId);
  const t = target(c);
  if (!on(s) || !t?.character || !force && (c.picks.length || s.suggested[t.key]))
    return null;
  if (t.character.extensions?.worldhopper?.tool)
    return null;
  if (!s.ledger.connection)
    return force ? { error: "Pick a model first (Settings \u2192 Models)." } : null;
  let modes;
  try {
    modes = parseSuggestResponse(await ask("ledger", buildSuggestMessages(cardText(t.character), t.character.name), 80, 0.1));
  } catch (err) {
    return force ? { error: `Suggestions: couldn't reach the model (${err.message}).` } : null;
  }
  s.suggested[t.key] = modes;
  await saveSettings();
  notify(chatId);
  return { modes, label: t.label };
}
async function count(text) {
  try {
    const r = await sp.tokens.countText(String(text || ""), { userId: user() });
    const n = r?.total_tokens;
    return typeof n === "number" ? n : estimateTokens(text);
  } catch {
    return estimateTokens(text);
  }
}
async function personaNames() {
  try {
    return (await sp.personas.list({ limit: 200, userId: user() })).data.map((p) => p.name).filter(Boolean);
  } catch {
    return [];
  }
}
async function cardFor(chatId, characterId) {
  const c = chatId ? await loadChat(chatId) : null;
  const id = characterId || c?.character?.id;
  if (!id)
    return { c };
  forgetCharacter(id);
  const ch = await getCharacter(id);
  const modes = Array.isArray(ch?.extensions?.worldhopper?.modes) ? ch.extensions.worldhopper.modes : [];
  return { c, ch, modes: [...expandModes(modes)] };
}
async function checkCard(chatId, characterId) {
  const { c, ch, modes } = await cardFor(chatId, characterId);
  if (!ch)
    return { error: "Open a chat with a character first (group chats aren't checked)." };
  const d = { ...ch, extensions: ch.extensions || {} };
  const tool = !!d.extensions?.worldhopper?.tool;
  const always = await count([d.description, d.personality, d.scenario].filter(Boolean).join(`
`));
  const issues = doctor(d, { modes, userNames: [...await personaNames(), c?.userName].filter(Boolean), alwaysTokens: always, tool });
  const greetings = 1 + (d.alternate_greetings?.length || 0);
  return { name: ch.name, always, greetings, modes, issues, tool };
}
function codexText(modes) {
  const want = new Set(modes);
  return CODEX.filter((e) => e.title.startsWith("\uD83D\uDC41 ") && want.has(e.title.slice(2).trim())).map((e) => `${e.title}
${e.content}`).join(`

`);
}
var reviews = new Map;
async function review(chatId, characterId) {
  const { ch, modes } = await cardFor(chatId, characterId);
  if (!ch)
    return { error: "Open a chat with a character first." };
  const ctl = new AbortController;
  reviews.set(ch.id, ctl);
  const timer = setTimeout(() => ctl.abort(new Error("timeout")), 180000);
  try {
    const d = { ...ch, extensions: ch.extensions || {} };
    const text = await ask("notes", buildReviewMessages(d, modes, codexText(modes), { tool: !!d.extensions?.worldhopper?.tool }), 4000, 0.3, { signal: ctl.signal });
    return { text: text.trim() || "The model returned nothing. Try again." };
  } catch (err) {
    return { error: ctl.signal.aborted ? ctl.signal.reason?.message === "timeout" ? "No answer after 3 minutes, so the review stopped. Check the Notes model under Settings \u2192 Models, or try again." : "Review canceled." : `Couldn't run the review: ${err.message}` };
  } finally {
    clearTimeout(timer);
    reviews.delete(ch.id);
  }
}
function cancelReview(characterId) {
  reviews.get(characterId)?.abort();
}

// src/backend/scripts.js
var FOLDER = "Worldhopper";
var PLACEMENT = { 1: "user_input", 2: "ai_output" };
function convert(st, order) {
  const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(st.findRegex);
  return {
    name: st.scriptName,
    script_id: st.id.replace(/-/g, "_"),
    find_regex: m ? m[1] : st.findRegex,
    flags: m ? m[2] : "g",
    replace_string: st.replaceString.replace(/(<div[^>]*>)\n/, `$1

`).replace(/\n<\/div>/, `

</div>`).replace(/ markdown="1"/, ""),
    placement: st.placement.map((p) => PLACEMENT[p]).filter(Boolean),
    target: "display",
    scope: "global",
    run_on_edit: true,
    substitute_macros: "none",
    trim_strings: [],
    sort_order: st.id === "wh-stray-markers" ? 100 : order,
    folder: FOLDER,
    description: "Worldhopper Engine display script. Edit it and Worldhopper leaves it as you set it."
  };
}
var hashOf = (r) => JSON.stringify([
  r.find_regex,
  [...String(r.flags || "")].sort().join(""),
  r.replace_string,
  [...r.placement || []].sort(),
  [].concat(r.target || []).sort()
]);
async function syncDisplayScripts() {
  const s = await settings();
  let mine = [];
  try {
    for (let offset = 0;; offset += 200) {
      const page = await sp.regex_scripts.list({ limit: 200, offset, userId: user() });
      mine.push(...page.data);
      if (page.data.length < 200)
        break;
    }
  } catch (err) {
    warn("display scripts: list", err);
    return;
  }
  let changed = false;
  for (const [i, st] of DISPLAY_SCRIPTS.entries()) {
    const want = convert(st, i);
    const wantHash = hashOf(want);
    const known = s.scripts[st.id];
    const have = mine.find((r) => known?.id && r.id === known.id || r.script_id === want.script_id);
    try {
      if (!have) {
        if (known)
          continue;
        const made = await sp.regex_scripts.create(want, user());
        s.scripts[st.id] = { id: made.id, hash: wantHash };
        changed = true;
        continue;
      }
      const haveHash = hashOf(have);
      if (haveHash === wantHash) {
        if (known?.hash !== wantHash || known?.id !== have.id) {
          s.scripts[st.id] = { id: have.id, hash: wantHash };
          changed = true;
        }
        continue;
      }
      if (known?.hash && haveHash !== known.hash)
        continue;
      if (!have.can_mutate)
        continue;
      await sp.regex_scripts.update(have.id, { ...want, disabled: have.disabled }, user());
      s.scripts[st.id] = { id: have.id, hash: wantHash };
      changed = true;
    } catch (err) {
      warn(`display script ${st.id}`, err);
    }
  }
  if (changed)
    await saveSettings();
}

// src/backend/index.js
var current = null;
var watched = new Set;
function watch(chatId) {
  if (!chatId)
    return;
  watched.delete(chatId);
  watched.add(chatId);
  while (watched.size > 4)
    watched.delete(watched.values().next().value);
}
var pushTimers = new Map;
function push(chatId) {
  if (!chatId) {
    for (const id of watched)
      push(id);
    return;
  }
  if (!watched.has(chatId))
    return;
  clearTimeout(pushTimers.get(chatId));
  pushTimers.set(chatId, setTimeout(async () => {
    try {
      const [c, s] = await Promise.all([loadChat(chatId), settings()]);
      if (!watched.has(chatId))
        return;
      sp.sendToFrontend(stateFor(c, s), user());
    } catch (err) {
      warn("push", err);
    }
  }, 60));
}
onChange(push);
async function pushNoChat() {
  sp.sendToFrontend(stateFor(null, await settings()), user());
}
var stickies = new Map;
var stickyFor = (chatId) => stickies.has(chatId) ? stickies.get(chatId) : stickies.set(chatId, new Map).get(chatId);
function hostSheets(c, ledger, limit) {
  const sheets = new Map;
  for (const b of takenBodies(c, ledger)) {
    const e = c.state.personas[personaKey(b.body)];
    if (e?.sheet)
      sheets.set(personaKey(b.body), personaText(e.sheet));
  }
  return { sheets, back: hostsBack(c, ledger, limit).map((e) => ({ body: e.body, text: personaText(e.sheet) })) };
}
sp.registerInterceptor(async (messages, ctx) => {
  setUser(ctx?.userId);
  try {
    const s = await settings();
    if (!on(s) || !ctx?.chatId)
      return messages;
    const chatId = ctx.chatId;
    if (!ctx.isDryRun)
      noteWait(chatId, await waitForLedger(chatId));
    const c = await loadChat(chatId);
    if (!c || !c.modes.length)
      return messages;
    let limit = c.msgs.length;
    if (ctx.excludeMessageId) {
      const i = c.msgs.findIndex((m) => m.id === ctx.excludeMessageId);
      if (i >= 0)
        limit = i;
    }
    const story = c.msgs.slice(0, limit).filter(inStory);
    const macros = { user: c.userName, char: c.charName };
    const cx = codexParts(new Set(c.modes), { recent: story.slice(-4).map((m) => m.text), count: story.length, sticky: stickyFor(chatId), remember: !ctx.isDryRun });
    let lastUserText = "";
    for (let i = limit - 1;i >= 0; i--)
      if (c.msgs[i].isUser) {
        lastUserText = c.msgs[i].text;
        break;
      }
    const scene = c.msgs.slice(Math.max(0, limit - SCENE_MESSAGES), limit).filter(inStory).map((m) => m.text).join(`
`);
    const bodies = ledgerWanted(s, c);
    const head = bodies ? headLedger(c, limit) : null;
    const kinds = mindKinds(c);
    const mind = mindWanted(s, c) ? headMind(c, limit) : null;
    const recent = c.msgs.slice(Math.max(0, limit - 2), limit).filter(inStory).map((m) => m.text).join(`
`);
    const parts = {
      codex: fillMacros(cx.before.join(`

`), macros),
      details: fillMacros(cx.details.join(`

`), macros),
      anchors: fillMacros(cx.anchors.join(`

`), macros),
      ledger: head ? renderLedger(head.ledger, c.userName, { lastUserText, scene, ...hostSheets(c, head.ledger, limit) }) : "",
      history: bodies ? renderHistory(bodyHistory(ledgerSnapshots(c, limit)), c.userName) : "",
      mind: mind ? renderMindBook(mind.book, c.userName, { kinds, latest: lastUserText, recent, scene }) : ""
    };
    const out = [...messages];
    const breakdown = place(out, parts, { continuing: ctx.generationType === "continue" });
    return { messages: out, breakdown };
  } catch (err) {
    warn("interceptor", err);
    return messages;
  }
});
sp.on("GENERATION_ENDED", (p, uid) => {
  setUser(uid);
  if (!p?.chatId)
    return;
  if (!p.error && p.messageId && p.generationType !== "impersonate")
    onReply(p.chatId, p.messageId);
  push(p.chatId);
});
sp.on("MESSAGE_EDITED", (p, uid) => {
  setUser(uid);
  if (p?.message?.id)
    onEdited(p.chatId, p.message.id, p.message.content);
  push(p?.chatId);
});
for (const ev of ["MESSAGE_SENT", "MESSAGE_SWIPED", "SWIPE_EDITED", "MESSAGE_DELETED"]) {
  sp.on(ev, (p, uid) => {
    setUser(uid);
    push(p?.chatId);
  });
}
sp.on("CHAT_SWITCHED", (p, uid) => {
  setUser(uid);
  current = p?.chatId || null;
  if (!current)
    return;
  watch(current);
  push(current);
  opened(current);
});
sp.on("CHARACTER_EDITED", (p, uid) => {
  setUser(uid);
  forgetCharacter(p?.id);
  push();
});
sp.on("CHAT_FORKED", (p, uid) => {
  setUser(uid);
  if (p?.sourceChatId && p?.forkedChatId)
    copyChatState(p.sourceChatId, p.forkedChatId).catch((err) => warn("fork", err));
});
function opened(chatId) {
  catchUp(chatId).catch((err) => warn("catch up", err));
  enqueue(async () => {
    const r = await suggestModes(chatId);
    if (r?.modes?.length)
      sp.sendToFrontend({ type: "suggested", chatId, modes: r.modes, label: r.label }, user());
  });
}
var OPS = {
  stats: async () => ({ calls }),
  hello: async ({ chatId }) => {
    syncOnce();
    if (!chatId) {
      await pushNoChat();
      return true;
    }
    const first = !watched.has(chatId);
    current = chatId;
    watch(chatId);
    push(chatId);
    if (first)
      opened(chatId);
    return true;
  },
  setEnabled: async ({ value }) => {
    const s = await settings();
    s.enabled = !!value;
    await saveSettings();
    push();
    if (s.enabled && current)
      catchUp(current);
    return true;
  },
  setSetting: async ({ group, key, value }) => {
    const s = await settings();
    if (!["ledger", "pictures"].includes(group) || !(key in s[group]))
      return "unknown setting";
    s[group][key] = typeof s[group][key] === "boolean" ? !!value : String(value ?? "");
    await saveSettings();
    push();
    if (group === "pictures" && key === "auto" && value && current)
      ensurePictures(current).catch((err) => warn(err));
    if (group === "ledger" && key === "enabled" && value && current)
      catchUp(current);
    return true;
  },
  connections: async () => {
    const out = { llm: [], image: [] };
    try {
      out.llm = (await sp.connections.list(user())).map((c) => ({ id: c.id, name: c.name, model: c.model, provider: c.provider }));
    } catch (err) {
      warn(err);
    }
    try {
      out.image = (await sp.imageGen.listConnections(user())).map((c) => ({ id: c.id, name: c.name, provider: c.provider, isDefault: !!c.is_default }));
    } catch (err) {
      warn(err);
    }
    return out;
  },
  models: async ({ connectionId }) => {
    try {
      return (await sp.connections.getModels?.(connectionId, user()) || []).map((m) => ({ id: m.id, name: m.name || m.id }));
    } catch {
      return [];
    }
  },
  setModes: async ({ chatId, modes }) => {
    const c = await loadChat(chatId);
    if (!c || !target(c))
      return "Open a chat first.";
    await setPicks(c, (modes || []).filter((m) => typeof m === "string"));
    push(chatId);
    return true;
  },
  suggest: ({ chatId }) => suggestModes(chatId, { force: true }),
  applySuggestion: async ({ chatId }) => {
    const s = await settings();
    const c = await loadChat(chatId);
    const modes = s.suggested[target(c)?.key] || [];
    await setPicks(c, modes);
    push(chatId);
    return modes;
  },
  rebuild: async ({ chatId }) => {
    rebuildLedger(chatId);
    return true;
  },
  backfill: async ({ chatId, which }) => {
    backfill(chatId, which);
    return true;
  },
  stopBackfill: async ({ chatId }) => {
    stopBackfill(chatId);
    return true;
  },
  toggleEdit: ({ chatId, messageId }) => toggleEdit(chatId, messageId),
  saveBody: ({ chatId, orig, row, sheet }) => saveBody(chatId, orig, { row, sheet }),
  removeBody: ({ chatId, orig }) => removeBody(chatId, orig),
  saveListItem: ({ chatId, list, i, value }) => saveListItem(chatId, list, i, value),
  saveSheet: ({ chatId, name, values }) => saveSheet(chatId, name, values),
  deleteSheet: ({ chatId, name }) => deleteSheet(chatId, name),
  writeSheet: ({ chatId, name }) => writeSheet(chatId, name),
  personaDraft: ({ chatId, name }) => personaDraft(chatId, name),
  makePersona: ({ chatId, name, description }) => makePersona(chatId, name, description),
  saveMind: ({ chatId, kind, raw, values }) => saveMindEntry(chatId, kind, raw, values),
  removeMind: ({ chatId, kind, raw }) => removeMindEntry(chatId, kind, raw),
  draw: ({ chatId, name }) => draw(chatId, name),
  drawMissing: ({ chatId, names }) => drawMissing(chatId, names || []),
  usePicture: ({ chatId, name, dataUrl }) => usePicture(chatId, name, dataUrl),
  removePicture: ({ chatId, name }) => removePicture(chatId, name),
  saveLook: ({ chatId, name, text }) => saveLook(chatId, name, text),
  pictureView: async ({ chatId, name, kind }) => pictureViewData(await loadChat(chatId), name, kind),
  checkCard: ({ chatId, characterId }) => checkCard(chatId, characterId),
  review: ({ chatId, characterId }) => review(chatId, characterId),
  cancelReview: async ({ characterId }) => {
    cancelReview(characterId);
    return true;
  }
};
sp.onFrontendMessage(async (p, uid) => {
  setUser(uid);
  if (p?.type !== "rpc" || !OPS[p.op])
    return;
  try {
    const value = await OPS[p.op](p.args || {});
    sp.sendToFrontend({ type: "rpc", id: p.id, ok: true, value }, uid);
  } catch (err) {
    warn(p.op, err);
    sp.sendToFrontend({ type: "rpc", id: p.id, ok: false, error: String(err?.message || err) }, uid);
  }
});
var synced = false;
function syncOnce() {
  if (synced)
    return;
  synced = true;
  syncDisplayScripts().catch((err) => warn("display scripts", err));
}
try {
  sp.commands.register([
    { id: "wh_ledger", label: "Worldhopper: Body Ledger", description: "Who is in which body: a card for each, to read or change", keywords: ["worldhopper", "ledger", "bodies", "possession"] },
    { id: "wh_mind", label: "Worldhopper: Mind Book", description: "What hypnosis, mind control and altered perception have put into people", keywords: ["worldhopper", "mind", "hypnosis"] },
    { id: "wh_modes", label: "Worldhopper: Modes", description: "Pick this character's metaphysics modes", keywords: ["worldhopper", "codex", "modes"] },
    { id: "wh_check_card", label: "Worldhopper: Check card", description: "Check the open character's card for things that trip models up", keywords: ["worldhopper", "card", "doctor"] }
  ]);
  sp.commands.onInvoked((id, context) => sp.sendToFrontend({ type: "command", id, chatId: context?.chatId || current }, user()));
} catch (err) {
  warn("commands", err);
}
log("loaded");
