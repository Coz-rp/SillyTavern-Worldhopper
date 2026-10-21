# Worldhopper Engine for Lumiverse

Tools for metaphysics roleplay in [Lumiverse](https://lumiverse.chat): possession, body swaps, hypnosis, mind control, skinsuits, hive minds, dolls, time stops, and every other way to take someone apart and put them back wrong.

This is the Lumiverse version of the [Worldhopper Engine for SillyTavern](https://github.com/Coz-rp/SillyTavern-Worldhopper). Both share the same Codex and the same Ledger, Mind Book, and card-check logic; only the parts that talk to the app are different.

## What it does

- **Codex modes.** Pick the kinds of metaphysics a character uses (21 modes and modifiers, from Possession to Transformation). Worldhopper adds the matching rules to every reply in that chat, so the model knows how each one works. Only what you pick is ever used. A character's picks are saved on its card (they travel with it); a group's are saved with the group chat.
- **Body Ledger.** Who is in which body right now, updated after each reply in chats with a body mode, and given to the model so names, pronouns, and every change stay straight. Each body someone takes over gets a short sheet on who its owner is in their own life. When you run several bodies at once, a card per body sits over the message box: tap one to start a line like `[Kayla] ` for that body.
- **Body History.** Past body changes, with a note on each: what the owner remembers, what was kept, and what was left behind.
- **Mind Book.** What hypnosis, mind control, and altered perception have put into people: trance depth, suggestions and triggers, what a controller has set in someone's will, and who can't perceive what.
- **Checks.** After each reply in a chat where someone is in another body, a pronoun check and a cut-only pass for the body rules (bodies of one mind talking to each other, narration pointing at who is inside, anything that gives away a change you haven't been told about). The original is kept: ⟲ on the message switches back and forth.
- **Moment boxes.** The writer marks takeovers, releases, trances, and other moments; they show as styled boxes in the chat.
- **Pictures.** A face for each host and each person in the Mind Book, drawn through one of your image connections when you tap them (or on their own, if you like).
- **Check card.** The Card Doctor reads a character's card for things that trip models up, and a deeper review has your notes model check the whole card against the Codex.

## Install

1. In Lumiverse, open **Extensions** and install from this repository's URL.
2. Grant the permissions it asks for (see below), and enable it.
3. Open the **Worldhopper** tab in the drawer, then **Settings → Models**, and pick a connection for the background jobs.

### Pick a fast, cheap model

The Ledger runs after every reply in a chat with body modes, and your next reply waits for it (briefly). Give it its own model: a local one, or a cheap and fast API model (the Flash, Haiku, or mini tier). Your big roleplay model would work, but at big-model prices on every reply. You can point the jobs at any connection and, if you like, type in a different model to use with that connection's key.

### Permissions

| Permission | What it's for |
| --- | --- |
| generation | The background jobs (Ledger, Mind Book, checks, notes, suggestions), and listing your connections in Settings |
| interceptor | Putting the Codex rules, the Ledger, and the Mind Book into the prompt |
| chats, chat_mutation | Reading the chat, keeping the Ledger and Mind Book on each reply, and applying the checks' fixes |
| characters | Your characters' modes (saved on the card) and Check card |
| personas | Your persona's name, and "Make a persona" from a host's sheet |
| regex_scripts | Installing the display scripts for the moment boxes and body lines (a "Worldhopper" folder in your regex scripts) |
| presets | Telling you when your preset's ✚ Metaphysics Check block is off |
| image_gen, images | Drawing and keeping pictures of hosts and Mind Book people |

## Where things go

- **In the prompt:** the picked modes' rules at the end of the system prompt; the Body Ledger, the Mind Book, and detail entries just above the last message (above a preset wrapper like the Worldhopper presets' `<last_message>`); the anchors right after the last message; Body History a few messages further back. They show in Lumiverse's prompt breakdown.
- **On your screen:** the Worldhopper tab in the drawer, a Worldhopper tab in the character editor (a card's modes and Check card), the Ledger and Mind Book bars above the chat (tap to open), the body roster over the message box, "as …" badges on your messages, and ⟲ on replies the checks changed.
- **Your data:** the Ledger, Mind Book, and history notes live on each reply (in its metadata, per swipe), so swipes and deletes roll them back. Host sheets and pictures live with the extension, per chat. Mode picks live on the character card.

## Works best with

The Worldhopper presets (on the [Worldhopper site](https://coz-rp.github.io/)) mark the moments the boxes show and have a ✚ Metaphysics Check block for bodies and minds. Any preset works; the Codex and the Ledger don't depend on one.

## Building from source

`dist/` is committed, so Lumiverse installs it as is. To change it:

```
bun install
node tools/sync-core.cjs   # the shared core modules and the Codex, from the SillyTavern Engine
node tools/build.cjs       # dist/backend.js and dist/frontend.js
```

The core modules in `src/core/` come from the SillyTavern Engine; change them there.

## License

Public domain ([The Unlicense](LICENSE)).
