// Worldhopper Engine for Lumiverse — the icons, as small inline SVGs in Lumiverse's line style (24px grid, stroked in
// the current color). Named after the Font Awesome icons the SillyTavern Engine used, so the views read the same.
const P = {
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'person': '<circle cx="12" cy="4.5" r="2"/><path d="M12 9v5M7 10.5l5-1.5 5 1.5M9 21l3-7 3 7"/>',
    'user-group': '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a6 6 0 0 0-4-5.6"/>',
    'user-slash': '<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 13-6.2"/><path d="m17 17 5 5M22 17l-5 5"/>',
    'user-check': '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="m16 11 2 2 4-4"/>',
    'ghost': '<path d="M9 10h.01M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
    'wind': '<path d="M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    'clone': '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'eye-slash': '<path d="M10.7 5.1A10.7 10.7 0 0 1 22 12a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
    'pen': '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'xmark': '<path d="M18 6 6 18M6 6l12 12"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'trash-can': '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'rotate': '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    'rotate-left': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    'wand-magic-sparkles': '<path d="m15 4-11 11a1.4 1.4 0 0 0 0 2l3 3a1.4 1.4 0 0 0 2 0L20 9a1.4 1.4 0 0 0 0-2l-3-3a1.4 1.4 0 0 0-2 0Z"/><path d="m12 7 5 5M5 3v4M3 5h4M19 15v4M17 17h4"/>',
    'shapes': '<path d="M8.3 10a.7.7 0 0 1-.6-1.1l3.7-6a.7.7 0 0 1 1.2 0l3.7 6a.7.7 0 0 1-.6 1.1z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
    'people-arrows': '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    'brain': '<path d="M12 5a3 3 0 1 0-6 .1 4 4 0 0 0-2.5 5.8 4 4 0 0 0 .6 6.6A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 6 .1 4 4 0 0 1 2.5 5.8 4 4 0 0 1-.6 6.6A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>',
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    'microchip': '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    'bolt': '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    'sliders': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    'toolbox': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    'clock-rotate-left': '<path d="M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    'stop': '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    'circle-question': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    'power-off': '<path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    'circle-dot': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1.5"/>',
    'hand-sparkles': '<path d="M9.9 2.4 8.5 6.6 4.3 8l4.2 1.4 1.4 4.2 1.4-4.2L15.5 8l-4.2-1.4zM18 13l-.9 2.6-2.6.9 2.6.9.9 2.6.9-2.6 2.6-.9-2.6-.9z"/>',
    'masks-theater': '<path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z"/><path d="M6 11c1.5 0 3 .5 3 2-2 0-3 0-3-2ZM18 11c-1.5 0-3 .5-3 2 2 0 3 0 3-2Z"/>',
    'spinner': '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
    'expand': '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    'up-right-and-down-left-from-center': '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    'down-left-and-up-right-to-center': '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
    'address-card': '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M6 16a3.5 3.5 0 0 1 6 0"/>',
    'feather-pointed': '<path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5zM16 8 2 22M17.5 15H9"/>',
    'feather': '<path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5zM16 8 2 22M17.5 15H9"/>',
    'location-dot': '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    'person-walking': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'tags': '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>',
    'house-user': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    'address-book': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="9" r="2"/><path d="M9 14a3 3 0 0 1 6 0"/>',
    'eraser': '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9"/>',
    'hand-fist': '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
    'arrow-right-long': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    'magnifying-glass': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'stethoscope': '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 12 0V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 12 0v-4"/><circle cx="20" cy="10" r="2"/>',
    'triangle-exclamation': '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
    'circle-info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    'hurricane': '<path d="M12 12a2.5 2.5 0 1 0 2.5 2.5"/><path d="M12 12a6 6 0 1 1 6-6"/><path d="M12 12a9 9 0 1 0 9 9"/>',
};

export function svg(name, cls = '') {
    const body = P[name] || P['circle-info'];
    return `<svg class="wh-i${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Font Awesome-style names ("fa-spinner fa-spin wh-dos-faint") as an icon: the first fa- name, the rest as classes. */
export function iconFor(spec) {
    const words = String(spec || '').split(/\s+/).filter(Boolean);
    const name = (words.find(w => w.startsWith('fa-') && w !== 'fa-spin' && w !== 'fa-solid') || '').replace(/^fa-/, '');
    const extra = words.filter(w => !w.startsWith('fa-')).concat(words.includes('fa-spin') ? ['wh-spin'] : []);
    return svg(name || spec, extra.join(' '));
}

export const ICON_SVG = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
