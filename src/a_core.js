const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const SELF = (() => {
  try {
    const mine = ['app', 'menu', 'ac', 'tip', 'toast', 'file', 'dlg-export', 'dlg-new', 'dlg-keys', 'dlg-ver', 'printroot'];   // every top-level element in body.html
    const head = Array.from(document.head.children).filter(n => n.tagName === 'META' || n.tagName === 'TITLE' || (n.tagName === 'LINK' && /fonts\.g/.test(n.href || ''))).map(n => n.outerHTML).join('\n');
    return {head, css: $('#appcss').textContent, body: mine.map(id => document.getElementById(id).outerHTML).join('\n'), log: document.getElementById('changelog').outerHTML, js: document.currentScript.textContent};
  } catch (e) { return null; }
})();
/* Versions: CHANGELOG.md is embedded in the page; its first "## x.y.z (date)" heading is the version running now. */
const LOG = (() => {
  const out = []; let cur = null;
  for (const line of ($('#changelog') ? $('#changelog').textContent : '').split('\n')) {
    const h = line.match(/^##\s+v?(\d[\d.]*)\s*(?:\((.*?)\))?/);
    if (h) { cur = {v: h[1], date: h[2] || '', items: []}; out.push(cur); }
    else if (cur && /^\s*[-*]\s+/.test(line)) cur.items.push(line.replace(/^\s*[-*]\s+/, ''));
  }
  return out;
})();
const VERSION = LOG.length ? LOG[0].v : '0';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const rid = () => Math.random().toString(36).slice(2, 9);
const clean = s => String(s == null ? '' : s).replace(/\u00a0/g, ' ').replace(/\s*[\r\n]+\s*/g, ' ');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const hosted = () => !!(window.claude && typeof window.claude.use === 'function');
const cap = n => hosted() ? Promise.resolve().then(() => window.claude.use(n)).catch(() => null) : Promise.resolve(null);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const roman = n => { let s = ''; [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].forEach(([v, r]) => { while (n >= v) { s += r; n -= v; } }); return s || 'I'; };
const unroman = s => { const v = {I: 1, V: 5, X: 10, L: 50, C: 100}; let n = 0; s = String(s).toUpperCase(); for (let i = 0; i < s.length; i++) { const a = v[s[i]] || 0, b = v[s[i + 1]] || 0; n += a < b ? -a : a; } return n || 1; };
const titleCase = s => String(s).toLowerCase().replace(/(^|[\s\-\/.'’(])([\p{L}])/gu, (m, a, b) => a + b.toUpperCase());
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* Column numbers are tenths of an inch from the left edge of a US Letter page (Courier 12pt is 10 characters to the inch). */
const F = {
  film: {
    name: 'Screenplay', base: 'action',
    order: ['scene', 'action', 'character', 'paren', 'dialogue', 'transition', 'sub', 'shot', 'note'],
    types: {
      scene: {label: 'Scene heading', hint: 'INT. or EXT., place, time of day', ph: 'INT. LOCATION - DAY', col: 15, w: 60, gw: 42, caps: 1, before: 2, enter: 'action', tab: 'action', ix: 'scene'},
      action: {label: 'Action', hint: 'Description of what we see and hear', ph: 'Describe what we see and hear', col: 15, w: 60, before: 1, enter: 'action', tab: 'character', tabNew: 'character'},
      character: {label: 'Character', hint: 'Who speaks next', ph: 'CHARACTER', col: 37, w: 38, gw: 13, caps: 1, before: 1, enter: 'dialogue', tab: 'transition', tabNew: 'paren'},
      paren: {label: 'Parenthetical', hint: 'Acting direction for the line', ph: 'acting direction', col: 31, w: 24, gw: 18, wrap: 1, before: 0, enter: 'dialogue', tab: 'dialogue', tabNew: 'dialogue'},
      dialogue: {label: 'Dialogue', hint: 'What the character says', ph: 'Dialogue', col: 25, w: 35, before: 0, enter: 'action', tab: 'paren', tabNew: 'paren'},
      transition: {label: 'Transition', hint: 'CUT TO: or FADE OUT.', ph: 'CUT TO:', col: 15, w: 60, gw: 11, right: 1, caps: 1, before: 1, enter: 'scene', tab: 'scene', tabNew: 'scene'},
      sub: {label: 'Subheading', hint: 'A new spot inside the same scene', ph: 'LATER', col: 15, w: 60, gw: 16, caps: 1, before: 1, enter: 'action', tab: 'shot', ix: 'sub'},
      shot: {label: 'Shot', hint: 'A camera direction, used sparingly', ph: 'CLOSE ON', col: 15, w: 60, gw: 22, caps: 1, before: 1, enter: 'action', tab: 'action', keep: 1},
      note: {label: 'Note', hint: 'For you only, left out of exports', ph: 'Note to self', col: 15, w: 60, skip: 1, before: 1, enter: 'action', tab: 'action'}
    }
  },
  stage: {
    name: 'Stage play', base: 'direction',
    order: ['act', 'scene', 'setting', 'atrise', 'character', 'paren', 'dialogue', 'direction', 'note'],
    types: {
      act: {label: 'Act', hint: 'ACT I, underlined', ph: 'ACT I', col: 40, w: 35, gw: 7, u: 1, before: 1, enter: 'scene', tab: 'scene', tabNew: 'scene', ix: 'group'},
      scene: {label: 'Scene', hint: 'Scene 1, underlined', ph: 'Scene 1', col: 40, w: 35, gw: 10, u: 1, before: 1, enter: 'setting', tab: 'setting', tabNew: 'setting', ix: 'scene'},
      setting: {label: 'Setting', hint: 'Description of the stage', ph: 'Describe the stage and what is on it', col: 40, w: 35, lab: 'SETTING:', before: 1, enter: 'atrise', tab: 'atrise', tabNew: 'atrise', keep: 1},
      atrise: {label: 'At rise', hint: 'Description as the lights come up', ph: 'Describe what we see as the lights come up', col: 40, w: 35, lab: 'AT RISE:', before: 1, enter: 'character', tab: 'character', tabNew: 'character'},
      character: {label: 'Character', hint: 'Who speaks next', ph: 'CHARACTER', col: 40, w: 35, gw: 13, caps: 1, before: 1, enter: 'dialogue', tab: 'direction', tabNew: 'paren'},
      paren: {label: 'Acting direction', hint: 'How the line is delivered', ph: 'acting direction', col: 35, w: 40, gw: 18, wrap: 1, before: 0, enter: 'dialogue', tab: 'dialogue', tabNew: 'dialogue'},
      dialogue: {label: 'Dialogue', hint: 'What the character says', ph: 'Dialogue', col: 10, w: 65, before: 0, enter: 'character', tab: 'character', tabNew: 'direction'},
      direction: {label: 'Stage direction', hint: 'Movement and action on stage', ph: 'stage direction', col: 35, w: 40, wrap: 1, before: 1, enter: 'character', tab: 'dialogue', tabNew: 'character'},
      note: {label: 'Note', hint: 'For you only, left out of exports', ph: 'Note to self', col: 10, w: 65, skip: 1, before: 1, enter: 'direction', tab: 'direction'}
    }
  }
};
const CONV = {
  film: {scene: 'scene', action: 'direction', character: 'character', paren: 'paren', dialogue: 'dialogue', transition: 'direction', sub: 'direction', shot: 'direction', note: 'note'},
  stage: {act: 'sub', scene: 'scene', setting: 'action', atrise: 'action', character: 'character', paren: 'paren', dialogue: 'dialogue', direction: 'action', note: 'note'}
};
const TIMES = ['DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MOMENTS LATER'];
const TRANS = ['CUT TO:', 'FADE OUT.', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'FADE TO BLACK.', 'FADE IN:'];
const PALETTE = ['#e5484d', '#2f7fe6', '#e9a100', '#12a594', '#8e4ec6', '#f76b15', '#3d9a50', '#d6409f', '#00a2c7', '#a87c56', '#5b5bd6', '#8db600', '#a0304f', '#7b8794'];
const HONORIFIC = /^(mr|mrs|ms|miss|mx|dr|sir|lady|lord|madame|madam|father|sister|brother|captain|capt|officer|detective|det|inspector|sergeant|sgt|professor|prof|judge|king|queen|prince|princess|uncle|aunt|old|young|the)\.?$/i;

function sample(format) {
  const film = format !== 'stage';
  const b = film ? [
    ['transition', 'FADE IN:'],
    ['scene', 'INT. ORPHEUM THEATRE - PROJECTION BOOTH - NIGHT'],
    ['action', 'A cramped room of humming machines. Dust turns in the beam. NORA VALE (60s, steady hands, reading glasses on a chain) threads film through a projector older than she is.'],
    ['action', 'Taped to the wall, a hand-lettered sign: FINAL SCREENING TONIGHT.'],
    ['action', 'The door bangs open. ELI (17, usher vest two sizes too big) stumbles in under a stack of film cans.'],
    ['character', 'ELI'], ['paren', 'out of breath'],
    ['dialogue', 'Mr. Vance says the buyers are here. He wants the house lights up at ten sharp.'],
    ['character', 'NORA'],
    ['dialogue', 'Mr. Vance can want what he likes. The picture ends when the picture ends.'],
    ['action', 'She locks the gate. The projector CLATTERS to life.'],
    ['character', 'ELI'], ['dialogue', "What's the last one?"],
    ['character', 'NORA'], ['paren', 'not looking up'], ['dialogue', 'The first one I ever ran.'],
    ['scene', 'INT. ORPHEUM THEATRE - LOBBY - CONTINUOUS'],
    ['action', 'Faded carpet. A popcorn machine gone cold. MR. VANCE (50s, suit too sharp for the room) checks his watch beside two BUYERS holding clipboards.'],
    ['character', 'MR. VANCE'], ['dialogue', "Ten o'clock and the keys are yours. Not a minute later."],
    ['action', 'Through the auditorium doors comes the swell of an old score. Vance frowns.'],
    ['character', "MR. VANCE (CONT'D)"], ['dialogue', 'Eli!'],
    ['scene', 'INT. ORPHEUM THEATRE - PROJECTION BOOTH - LATER'],
    ['action', 'Nora watches through the port glass. Eli hovers by the door.'],
    ['character', 'ELI'], ['dialogue', "He's going to fire me."],
    ['character', 'NORA'], ['dialogue', "There's no one left to fire you from anything, kid. Sit. Watch how it ends."],
    ['action', 'Eli sits. Light flickers across both their faces.'],
    ['character', 'NORA (V.O.)'], ['dialogue', 'Forty years, and I never once left before the credits.'],
    ['transition', 'CUT TO:'],
    ['scene', 'EXT. ORPHEUM THEATRE - NIGHT'],
    ['action', "The marquee buzzes, half its letters burned out. Nora's shadow crosses the booth window."],
    ['note', 'This is an example. Choose New script from the menu at the top right to start your own.'],
    ['transition', 'FADE OUT.']
  ] : [
    ['act', 'ACT I'], ['scene', 'Scene 1'],
    ['setting', 'The projection booth of the Orpheum Theatre. Two old projectors, a rewind bench, and a small port window that looks down on the house.'],
    ['atrise', 'NORA threads film through a projector. A hand-lettered sign on the wall reads FINAL SCREENING TONIGHT.'],
    ['direction', 'ELI bursts in under a stack of film cans.'],
    ['character', 'ELI'], ['paren', 'out of breath'],
    ['dialogue', 'Mr. Vance says the buyers are here. He wants the house lights up at ten sharp.'],
    ['character', 'NORA'],
    ['dialogue', 'Mr. Vance can want what he likes. The picture ends when the picture ends.'],
    ['direction', 'She locks the gate. The projector clatters to life.'],
    ['character', 'ELI'], ['dialogue', "What's the last one?"],
    ['character', 'NORA'], ['paren', 'not looking up'], ['dialogue', 'The first one I ever ran.'],
    ['direction', 'MR. VANCE appears in the doorway, watch in hand.'],
    ['character', 'MR. VANCE'], ['dialogue', "Ten o'clock and the keys are theirs. Not a minute later."],
    ['direction', 'He goes. Eli hovers by the door.'],
    ['character', 'ELI'], ['dialogue', "He's going to fire me."],
    ['character', 'NORA'], ['dialogue', "There's no one left to fire you from anything, kid. Sit. Watch how it ends."],
    ['direction', 'Eli sits. Light flickers across both their faces.'],
    ['note', 'This is an example. Choose New script from the menu at the top right to start your own.']
  ];
  return {
    v: 1, format: film ? 'film' : 'stage', sample: true, updatedAt: 0,
    title: {title: 'The Last Reel', credit: film ? 'Written by' : 'by', author: '', based: '', desc: film ? '' : 'A Play in One Act', contact: '', draft: ''},
    cast: [
      {id: 'nora', name: 'Nora Vale', desc: '60s. Projectionist at the Orpheum for forty years.', aliases: 'Nora', color: PALETTE[0]},
      {id: 'eli', name: 'Eli', desc: '17. An usher who wants to be anywhere else, until tonight.', aliases: '', color: PALETTE[1]},
      {id: 'vance', name: 'Mr. Vance', desc: '50s. The owner. He is selling the building at ten.', aliases: 'Vance', color: PALETTE[2]}
    ],
    castMeta: {scene: film ? '' : 'A single-screen cinema in a small town.', time: film ? '' : 'The night it closes.'},
    blocks: b.map(([t, x]) => ({t, x}))
  };
}
function blank(format) {
  const film = format !== 'stage';
  return {v: 1, format: film ? 'film' : 'stage', sample: false, updatedAt: Date.now(),
    title: {title: '', credit: film ? 'Written by' : 'by', author: '', based: '', desc: '', contact: '', draft: ''},
    cast: [], castMeta: {scene: '', time: ''},
    blocks: film ? [{t: 'transition', x: 'FADE IN:'}, {t: 'scene', x: ''}] : [{t: 'act', x: 'ACT I'}, {t: 'scene', x: 'Scene 1'}, {t: 'setting', x: ''}]};
}

/* ---------- shared state ---------- */
let P = null;                                  // the open project (blocks live in the page and in history)
const app = $('#app'), root = $('#script'), stage = $('#stage');
const ui = Object.assign({zoom: 0, tags: true, side: true}, store.get('cuemark.ui'));
const dockH = () => { const d = $('#dock'); return d ? d.offsetHeight : 0; };
const scriptTop = () => Math.max(0, $('#p-script').offsetTop - dockH() - 12);
const T = () => F[P.format].types;
const base = () => F[P.format].base;
const glyph = d => { const w = d.gw || d.w, l = d.right ? d.col + d.w - w : d.col; return `--l:${(l / 85 * 100).toFixed(1)}%;--w:${(w / 85 * 100).toFixed(1)}%`; };
