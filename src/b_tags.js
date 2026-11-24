/* ---------- cast tags: who is named where ---------- */
const M = {by: new Map(), ci: null, cs: null, color: new Map()};
const HL = {ok: !!(window.CSS && CSS.highlights && window.Highlight && window.StaticRange), map: new Map()};

function hlGet(key) {
  let h = HL.map.get(key);
  if (!h) { h = new Highlight(); HL.map.set(key, h); CSS.highlights.set('c-' + key, h); }
  return h;
}
function rgbOf(hex) { const n = parseInt(String(hex).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function buildMatchers() {
  M.by = new Map(); M.color = new Map();
  const typed = [];
  for (const c of P.cast) {
    M.color.set(c.id, c.color);
    for (const n of [c.name].concat(String(c.aliases || '').split(','))) {
      const s = clean(n).trim(); if (!s) continue;
      const k = s.toUpperCase(); if (!M.by.has(k)) { M.by.set(k, c.id); typed.push(s); }
    }
  }
  const keys = Array.from(M.by.keys());
  if (!keys.length) { M.ci = M.cs = null; return; }
  const rx = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
  const pat = s => cjk.test(s) ? rx(s) : '(?<![\\p{L}\\p{N}])' + rx(s) + '(?![\\p{L}\\p{N}])';
  const byLen = (a, b) => b.length - a.length;
  M.ci = new RegExp(keys.slice().sort(byLen).map(pat).join('|'), 'giu');
  const vars = new Set(typed); keys.forEach(k => { vars.add(k); vars.add(titleCase(k)); });
  M.cs = new RegExp(Array.from(vars).sort(byLen).map(pat).join('|'), 'gu');
}

function tagCSS() {
  let css = '';
  for (const c of P.cast) {
    const [r, g, b] = rgbOf(c.color), sel = `.tags-on ::highlight(c-${c.id})`;
    css += `${sel}{background-color:rgb(${r} ${g} ${b}/.2);text-decoration-line:underline;text-decoration-color:rgb(${r} ${g} ${b});text-decoration-thickness:2px;text-underline-offset:.18em}\n`;
    css += `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) ${sel}{background-color:rgb(${r} ${g} ${b}/.34)}}\n:root[data-theme="dark"] ${sel}{background-color:rgb(${r} ${g} ${b}/.34)}\n`;
  }
  css += '::highlight(c-mk){color:#8a9197}\n::highlight(c-eu){text-decoration-line:underline}\n::highlight(c-eb){text-shadow:.035em 0 0 currentColor,-.035em 0 0 currentColor}\n';
  $('#tagcss').textContent = css;
}

function unmark(el) {
  if (!el._hl) return;
  for (const [key, r] of el._hl) { const h = HL.map.get(key); if (h) h.delete(r); }
  el._hl = null;
}
function markBlock(el) {
  unmark(el);
  const tn = el.firstChild;
  if (!HL.ok || !tn || tn.nodeType !== 3) return;
  const x = tn.data, d = T()[el.dataset.t] || {}, list = [];
  const add = (key, a, b) => { const r = new StaticRange({startContainer: tn, startOffset: a, endContainer: tn, endOffset: b}); hlGet(key).add(r); list.push([key, r, a, b]); };
  const re = d.caps ? M.ci : M.cs;
  if (re) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(x))) { if (!m[0]) { re.lastIndex++; continue; } const cid = M.by.get(m[0].toUpperCase()); if (cid) add(cid, m.index, m.index + m[0].length); }
  }
  if (/[*_]/.test(x)) {
    const e = emph(x);
    if (e.drop) for (let i = 0; i < x.length; i++) {
      if (e.drop[i]) { let j = i; while (e.drop[j + 1]) j++; add('mk', i, j + 1); i = j; continue; }
      const f = e.raw[i]; if (f & 5) { let j = i; while (j + 1 < x.length && !e.drop[j + 1] && e.raw[j + 1] === f) j++; if (f & 4) add('eu', i, j + 1); if (f & 1) add('eb', i, j + 1); i = j; }
    }
  }
  if (list.length) el._hl = list;
}
function markAll() {
  for (const h of HL.map.values()) h.clear();
  for (const el of root.children) { el._hl = null; markBlock(el); }
}

/* The name on a cue line, without (V.O.), (O.S.), (CONT'D) and the like. */
function cueName(x) { return String(x).replace(/\([^)]*\)?/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase(); }

/* Give every speech (cue, acting direction, dialogue) its speaker's color for the margin rail. */
function tagSpeeches(reset) {
  let cur = null;
  for (const el of root.children) {
    const t = el.dataset.t; let cid = null;
    if (t === 'character') { cur = M.by.get(cueName(el.textContent)) || null; cid = cur; }
    else if (t === 'paren' || t === 'dialogue') cid = cur;
    else if (t !== 'note') cur = null;
    if (reset || (el._cid || null) !== cid) {
      el._cid = cid;
      if (cid) { el.classList.add('sp'); el.style.setProperty('--tag', M.color.get(cid)); }
      else { el.classList.remove('sp'); el.style.removeProperty('--tag'); }
    }
  }
}

let retagT = 0;
function rebuildTags(now) {
  buildMatchers(); tagCSS();
  if (now) { markAll(); tagSpeeches(true); schedule(); }
}
function retagSoon() { clearTimeout(retagT); retagT = setTimeout(() => rebuildTags(true), 180); }

function nextColor(cast) {
  cast = cast || P.cast;
  const used = new Set(cast.map(c => String(c.color).toLowerCase()));
  const free = PALETTE.find(p => !used.has(p));
  if (free) return free;
  const h = (cast.length * 137.508) % 360, s = .62, l = .5;       // past the palette: walk the hue wheel by the golden angle
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}
function guessAlias(name) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return '';
  const rest = words.filter(w => !HONORIFIC.test(w));
  const pick = rest[0];
  if (!pick || pick.length < 2 || pick.toUpperCase() === name.toUpperCase() || M.by.has(pick.toUpperCase())) return '';
  return pick.replace(/[,;:]+$/, '');
}
