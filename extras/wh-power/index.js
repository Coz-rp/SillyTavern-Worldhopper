// Worldhopper Power: an ST server plugin for shutting SillyTavern down from your phone. The button lives in the
// Worldhopper extension's wand menu. Routes sit behind ST's own whitelist, login and CSRF checks, like every other ST
// endpoint. Windows only (PowerShell, taskkill).
const { execFile } = require('child_process');

async function init(router) {
    router.get('/status', async (_req, res) => {
        const status = { ok: true };
        res.json(status);
    });

    router.post('/shutdown', (_req, res) => {
        res.json({ ok: true });
        // Answer first, then go: the page gets its reply before the server disappears.
        setTimeout(() => {
            execFile('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${process.ppid}").Name`],
                { windowsHide: true }, (err, stdout) => {
                    if (!err && /^cmd\.exe$/i.test(String(stdout).trim())) {
                        // Started from Start.bat: end the window and ST together.
                        execFile('taskkill', ['/PID', String(process.ppid), '/T', '/F'], { windowsHide: true }, () => process.exit(0));
                    } else {
                        process.exit(0);
                    }
                });
        }, 400);
    });
}

async function exit() { }

module.exports = {
    init,
    exit,
    info: { id: 'wh-power', name: 'Worldhopper Power', description: 'Shut SillyTavern down from any device (for phone use).' },
};
