# wh-power (optional, Windows only)

A SillyTavern server plugin that adds **Shut down SillyTavern** to the wand menu. It's for when you use SillyTavern from your phone and want to switch it off without getting up.

Anyone who can open your SillyTavern can use this button, so only install it if SillyTavern is reachable by you alone.

## Install

1. Copy this `wh-power` folder (in the extension's `extras/` folder) into `SillyTavern/plugins/`.
2. In `SillyTavern/config.yaml`, set `enableServerPlugins: true`.
3. Restart SillyTavern. The button appears in the wand menu once the Worldhopper Engine extension finds the plugin.

It uses PowerShell and taskkill, so it works on Windows only. **Shut down SillyTavern** also closes the console window SillyTavern was started from (Start.bat).
