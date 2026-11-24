/* ---------- Open: read a text, Word or Pages file and format it as a script ---------- */
const SCENE_RE = /^(\d+[A-Z]?[.)]?\s+)?(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)[\s.]/i;
const SUB_RE = /^(LATER|MOMENTS LATER|A MOMENT LATER|CONTINUOUS|SAME TIME|BACK TO SCENE\.?|BACK TO PRESENT\.?|INTERCUT.*|MONTAGE.*|SERIES OF SHOTS.*|END (OF )?MONTAGE\.?|FLASHBACK.*|END (OF )?FLASHBACK\.?|DREAM SEQUENCE.*|SUPER:.*|TITLE CARD:.*|THE END\.?)$/;
const STYLE_MAP = [[/\baction\b|description/, 'action'], [/scene|slug/, 'scene'], [/parenthetical|wryly/, 'paren'], [/character|speaker|\bcue\b/, 'character'], [/dialog/, 'dialogue'], [/transition/, 'transition'], [/\bshot\b/, 'shot']];
const allCaps = s => /\p{Lu}/u.test(s) && !/\p{Ll}/u.test(s.replace(/\([^)]*\)/g, ''));
const userErr = msg => Object.assign(new Error(msg), {user: true});

/* A record is one paragraph as found: {x: text, ind: left indent in inches, al: 'c' | 'r' | '', st: style name, gap: blank line before}. */
function stageBlocks(recs) {
  const out = [], push = (t, x) => { x = clean(x).trim(); if (x) out.push({t, x}); };
  let open = false;
  for (const r of recs) {
    const x = r.x, last = out[out.length - 1]; let m;
    if (r.gap) open = false;
    if (/^act\b/i.test(x) && x.length < 24) push('act', x);
    else if (/^scene\b/i.test(x) && x.length < 24) push('scene', x);
    else if ((m = x.match(/^setting\s*:\s*(.*)$/i))) push('setting', m[1]);
    else if ((m = x.match(/^at rise\s*:\s*(.*)$/i))) push('atrise', m[1]);
    else if (/^\(.*\)$/.test(x)) push(last && last.t === 'character' ? 'paren' : 'direction', x.slice(1, -1));
    else if ((m = x.match(/^(\p{Lu}[\p{Lu}\d .'#&-]{1,28}?)(\s*\([^)]*\))?:\s+(\S.*)$/u))) { push('character', m[1]); if (m[2]) push('paren', m[2].trim().slice(1, -1)); push('dialogue', m[3]); open = true; continue; }
    else if (allCaps(x) && x.length < 40) push('character', x);
    else if (open && last && last.t === 'dialogue') { last.x += ' ' + x; continue; }
    else { push('dialogue', x); open = true; continue; }
    open = false;
  }
  return out;
}

function filmBlocks(recs) {
  const out = [], push = (t, x) => { x = clean(x).trim(); if (x) out.push({t, x}); };
  const tally = new Map();
  for (const r of recs) { const v = Math.round((r.ind || 0) * 10) / 10; tally.set(v, (tally.get(v) || 0) + 1); }
  const need = Math.max(2, recs.length * 0.05), levels = Array.from(tally.keys()).sort((a, b) => a - b);
  const hit = levels.find(v => tally.get(v) >= need), base = hit !== undefined ? hit : (levels[0] || 0);         // the left margin that action and headings share
  const shaped = recs.filter(r => (r.ind || 0) - base >= 1 || r.al === 'c').length;
  const layout = shaped >= Math.max(2, recs.length * 0.03);                      // the file carries indents or centering we can trust
  const blankless = recs.filter(r => r.gap).length < recs.length * 0.1;
  const labels = new Map();
  for (const r of recs) { const m = r.x.match(/^([^:]{2,30}):\s+\S/); if (m) labels.set(m[1].toUpperCase(), (labels.get(m[1].toUpperCase()) || 0) + 1); }
  let speech = 0;                                                               // 0 none, 1 just after a cue or acting direction, 2 inside the lines
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i], nx = recs[i + 1], x = r.x, U = x.toUpperCase(), cap = allCaps(x), rel = (r.ind || 0) - base; let m;
    if (r.gap && !layout) speech = 0;
    if ((m = x.match(/^\[\[(.*)\]\]$/))) { push('note', m[1]); speech = 0; continue; }
    const named = r.st ? (STYLE_MAP.find(([re]) => re.test(r.st.toLowerCase())) || [])[1] : '';
    if (named) {
      push(named, named === 'paren' ? x.replace(/^\(\s*/, '').replace(/\s*\)$/, '') : x);
      speech = named === 'character' || named === 'paren' ? 1 : named === 'dialogue' ? 2 : 0; continue;
    }
    if (SCENE_RE.test(x) && x.length < 90 && !/[a-z]{3,}[.!?]$/.test(x)) {
      const n = x.match(/^(\d+[A-Z]?)[.)]?\s+/); let h = n ? x.slice(n[0].length) : x;
      if (n && h.slice(-n[1].length - 1) === ' ' + n[1]) h = h.slice(0, -n[1].length - 1);
      push('scene', h); speech = 0; continue;
    }
    if (/^\.[^.\s]/.test(x)) { push('scene', x.slice(1)); speech = 0; continue; }
    if (/^>/.test(x) && !/<$/.test(x)) { push('transition', x.slice(1)); speech = 0; continue; }
    if (cap && x.length < 40 && (/\bTO:$/.test(U) || /^FADE (IN|OUT|TO BLACK|TO WHITE)[.:]?$/.test(U) || /^(CUT TO BLACK|SMASH CUT|FREEZE FRAME)[.:]?$/.test(U) || r.al === 'r' || rel >= 3.4)) { push('transition', x); speech = 0; continue; }
    if (/^\(.+\)$/.test(x) && speech) { push('paren', x.slice(1, -1)); speech = 1; continue; }
    if ((m = x.match(/^([^:]{2,30}?)(\s*\([^)]*\))?:\s+(\S.*)$/)) && !SCENE_RE.test(x) &&
        (allCaps(m[1]) ? /^[\p{Lu}\d .'#&-]+$/u.test(m[1]) : labels.get(m[1].toUpperCase()) >= 3 && m[1].split(/\s+/).length <= 3)) {
      push('character', m[1] + (m[2] || '')); push('dialogue', m[3]); speech = 0; continue;         // "NORA: Keep up, kid."
    }
    const cueLike = cap && x.length <= 40 && x.split(/\s+/).length <= 5 && !/[!?,]$/.test(x) && !SUB_RE.test(U) && nx && !SCENE_RE.test(nx.x);
    if (/^@/.test(x) || (cueLike && (layout ? (r.al === 'c' || rel >= 1.2) : ((!nx.gap && !allCaps(nx.x)) || /^\(.+\)$/.test(nx.x))))) {
      push('character', x.replace(/^@/, '').replace(/\s*\^$/, '')); speech = 1; continue;
    }
    if (speech && (layout ? (rel >= 0.4 || (speech === 1 && !cap)) : (speech === 1 || !blankless))) { push('dialogue', x); speech = 2; continue; }
    speech = 0;
    if (cap && x.length < 50 && SUB_RE.test(U)) { push('sub', x); continue; }
    push('action', x.replace(/^!/, ''));
  }
  return out;
}

/* Pull a title and author off the front of the file, when the first lines read like a title page. */
function splitTitle(recs, title) {
  const first = recs.findIndex(r => SCENE_RE.test(r.x) || /^FADE IN:?$/i.test(r.x));
  const head = recs.slice(0, first < 0 ? Math.min(recs.length, 8) : Math.min(first, 16));
  const by = head.findIndex(r => /^((written|screenplay|teleplay|story|a (screen)?play)\s+)?by\b/i.test(r.x) && r.x.length < 80);
  const line = by > 0 ? head[by].x : '', rest = line.replace(/^.*?\bby\b[\s:]*/i, '');
  if (by > 0 && by <= 4 && head.slice(0, by).map(r => r.x).join(' ').length <= 80 && rest.split(/\s+/).length <= 6 && !/[.!?]$/.test(rest)) {
    title.title = head.slice(0, by).map(r => r.x).join(' ').slice(0, 120);
    title.credit = rest ? line.slice(0, line.length - rest.length).trim() : line;
    title.author = rest || (head[by + 1] ? head[by + 1].x : '');
    return recs.slice(first >= 0 ? first : by + (rest ? 1 : 2));
  }
  if (first > 0 && first <= 6 && head[0].al === 'c') { title.title = head[0].x; return recs.slice(first); }
  return recs;
}

function autoFormat(recs, opt) {
  opt = opt || {};
  const title = Object.assign({}, opt.title), junk = /^(\d{1,3}\.?|\(?(MORE|CONTINUED)\)?:?|CONTINUED:?\s*(\(\d+\))?)$/i, kept = [];
  let carry = false;
  for (const r of recs) { if (!r.x || junk.test(r.x)) { carry = carry || r.gap || !r.x; continue; } kept.push(carry && !r.gap ? Object.assign({}, r, {gap: true}) : r); carry = false; }
  const stage = opt.force ? opt.force === 'stage' : kept.some(r => /^(ACT\s+([IVXL]+|\d+|ONE|TWO|THREE|FOUR|FIVE)\b.{0,12}$|AT RISE\s*:|SETTING\s*:)/i.test(r.x));
  const body = opt.keepTitle ? kept : splitTitle(kept, title);
  return {format: stage ? 'stage' : 'film', blocks: stage ? stageBlocks(body) : filmBlocks(body), title};
}

/* Plain text: Fountain, a typed-out script, or a text export that lays the page out with spaces. */
function textRecs(txt) {
  const lines = String(txt).replace(/\r\n?/g, '\n').replace(/\f/g, '\n').split('\n'), recs = [], title = {};
  let i = 0, gap = true;
  if (/^(title|credit|author|authors|source|draft date|contact|copyright)\s*:/i.test(lines[0] || '')) {              // Fountain title page
    const keys = {title: 'title', credit: 'credit', author: 'author', authors: 'author', source: 'based', 'draft date': 'draft', contact: 'contact'};
    let k = '';
    for (; i < lines.length && lines[i].trim(); i++) {
      const m = /^\s/.test(lines[i]) ? null : lines[i].match(/^([A-Za-z ]+):\s*(.*)$/);
      if (m) k = keys[m[1].toLowerCase()] || '';
      const v = (m ? m[2] : lines[i]).trim();
      if (k && v) title[k] = title[k] ? title[k] + (k === 'contact' ? '\n' : ' ') + v : v;
    }
  }
  const blanks = lines.filter(l => !l.trim()).length, wrapped = blanks > lines.length * 0.12;
  const prose = s => /\p{Ll}/u.test(s) && !/^\(.*\)$/.test(s) && !/^[@>.]/.test(s);
  for (; i < lines.length; i++) {
    const raw = lines[i].replace(/\t/g, '     ').replace(/\s+$/, ''), x = raw.trim();
    if (!x) { gap = true; continue; }
    const ind = (raw.length - raw.trimStart().length) / 10, prev = recs[recs.length - 1];
    if (wrapped && prev && !gap && Math.abs(prev.ind - ind) < 0.15 && prose(prev.x) && !allCaps(x) && !/^[(\[>.@!]/.test(x) && !SCENE_RE.test(x)) prev.x += ' ' + x;   // a hard-wrapped line belongs to the paragraph above
    else recs.push({x, ind, al: '', st: '', gap});
    gap = false;
  }
  return {recs, title};
}
/* Pasted text goes through the same formatter, in the format already open. */
function parseText(txt, fk) { return autoFormat(textRecs(txt).recs, {force: fk, keepTitle: true}).blocks; }

/* ---- zip (Word and Pages files are zip packages) ---- */
async function inflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function unzip(buf, want) {
  const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength), td = new TextDecoder(), out = new Map();
  let e = u.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < n && p + 46 <= u.length && dv.getUint32(p, true) === 0x02014b50; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), at = dv.getUint32(p + 42, true);
    const name = td.decode(u.subarray(p + 46, p + 46 + nlen));
    if (want(name)) {
      const start = at + 30 + dv.getUint16(at + 26, true) + dv.getUint16(at + 28, true), data = u.subarray(start, start + csize);
      out.set(name, method === 0 ? data : await inflate(data));
    }
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/* ---- Word .docx ---- */
function docxRecs(files) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const xml = b => new DOMParser().parseFromString(new TextDecoder().decode(b), 'application/xml');
  const kid = (el, name) => { if (el) for (const c of el.children) if (c.localName === name) return c; return null; };
  const at = (el, name) => el ? (el.getAttributeNS(W, name) || el.getAttribute('w:' + name) || '') : '';
  const on = el => !!el && !/^(0|false|off)$/i.test(at(el, 'val'));
  const props = pPr => { const ind = kid(pPr, 'ind'), jc = at(kid(pPr, 'jc'), 'val'), o = {};
    if (ind) { const l = at(ind, 'left') || at(ind, 'start'); if (l !== '') o.ind = (parseFloat(l) || 0) / 1440; const f = parseFloat(at(ind, 'firstLine')); if (f) o.first = f / 1440; }
    if (jc) o.al = /center/i.test(jc) ? 'c' : /right|end/i.test(jc) ? 'r' : '';
    return o; };
  const styles = new Map(); let normal = '';
  if (files.has('word/styles.xml')) for (const s of xml(files.get('word/styles.xml')).getElementsByTagNameNS(W, 'style')) {
    if (at(s, 'type') && at(s, 'type') !== 'paragraph') continue;
    const o = props(kid(s, 'pPr')); o.name = at(kid(s, 'name'), 'val'); o.base = at(kid(s, 'basedOn'), 'val');
    const rp = kid(s, 'rPr'); if (rp && kid(rp, 'caps')) o.caps = on(kid(rp, 'caps'));
    styles.set(at(s, 'styleId'), o);
    if (at(s, 'default') && !/^(0|false|off)$/i.test(at(s, 'default'))) normal = at(s, 'styleId');
  }
  const resolve = id => { const o = {}; for (let n = 0, s = styles.get(id); s && n < 12; n++, s = styles.get(s.base)) for (const k of ['ind', 'first', 'al', 'caps']) if (o[k] === undefined && s[k] !== undefined) o[k] = s[k]; return o; };
  const recs = []; let gap = true;
  const doc = xml(files.get('word/document.xml'));
  for (const p of doc.getElementsByTagNameNS(W, 'p')) {
    let up = p.parentNode, nested = false;
    for (; up && up.nodeType === 1; up = up.parentNode) if (up.localName === 'p' || up.localName === 'Fallback') { nested = true; break; }
    if (nested) continue;
    const pPr = kid(p, 'pPr'), sid = at(kid(pPr, 'pStyle'), 'val') || normal, st = styles.get(sid), base = resolve(sid), own = props(pPr);
    let text = '', capLen = 0, len = 0;
    const walk = (node, caps) => { for (const c of node.children) { const ln = c.localName;
      if (ln === 'p' || ln === 'Fallback' || ln === 'pPr' || ln === 'rPr' || ln === 'del') continue;
      if (ln === 't') { text += c.textContent; len += c.textContent.length; if (caps) capLen += c.textContent.length; }
      else if (ln === 'tab') text += '\t';
      else if (ln === 'br' || ln === 'cr') text += '\n';
      else if (ln === 'noBreakHyphen') text += '-';
      else if (ln === 'r') { const rp = kid(c, 'rPr'), cp = rp && kid(rp, 'caps'); walk(c, cp ? on(cp) : caps); }
      else walk(c, caps); } };
    walk(p, !!base.caps);
    const ind0 = (own.ind !== undefined ? own.ind : base.ind || 0) + (own.first !== undefined ? own.first : base.first || 0), al = own.al !== undefined ? own.al : base.al || '';
    const caps = len > 0 && capLen === len, name = st && st.name && !/^(normal|default|body text|standard|text body)/i.test(st.name) ? st.name : '';
    for (const part of text.split('\n')) {
      const lead = (part.match(/^[\t ]*/) || [''])[0], x = part.trim();
      if (!x) { gap = true; continue; }
      const tabs = (lead.match(/\t/g) || []).length;
      recs.push({x: (caps ? x.toUpperCase() : x).replace(/\t+/g, ' '), ind: Math.max(0, ind0) + tabs * 0.5 + (lead.length - tabs) * 0.08, al, st: name, gap}); gap = false;
    }
  }
  return {recs, title: {}};
}

/* ---- Apple Pages: zip of Snappy-compressed protobuf archives; the text sits in TSWP storage messages ---- */
function unsnap(src) {
  let p = 0, len = 0, mul = 1, b;
  do { b = src[p++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
  const out = new Uint8Array(len); let o = 0;
  while (p < src.length && o < len) {
    const tag = src[p++], kind = tag & 3;
    if (kind === 0) {
      let n = tag >> 2;
      if (n >= 60) { const k = n - 59; n = 0; for (let i = 0; i < k; i++) n += src[p++] * Math.pow(256, i); }
      n += 1; out.set(src.subarray(p, p + n), o); p += n; o += n;
    } else {
      let n, off;
      if (kind === 1) { n = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | src[p++]; }
      else if (kind === 2) { n = (tag >> 2) + 1; off = src[p] | (src[p + 1] << 8); p += 2; }
      else { n = (tag >> 2) + 1; off = (src[p] | (src[p + 1] << 8) | (src[p + 2] << 16)) + src[p + 3] * 16777216; p += 4; }
      if (!off || off > o) throw new Error('bad snappy copy');
      for (let i = 0; i < n; i++, o++) out[o] = out[o - off];
    }
  }
  return out;
}
function iwaBytes(u) {
  const parts = []; let total = 0;
  for (let p = 0; p + 4 <= u.length;) { const n = u[p + 1] | (u[p + 2] << 8) | (u[p + 3] << 16), c = unsnap(u.subarray(p + 4, p + 4 + n)); parts.push(c); total += c.length; p += 4 + n; }
  const out = new Uint8Array(total); let o = 0;
  for (const c of parts) { out.set(c, o); o += c.length; }
  return out;
}
function varint(u, p) { let r = 0, mul = 1, b; do { b = u[p++]; r += (b & 127) * mul; mul *= 128; } while (b & 128 && p < u.length); return [r, p]; }
function pbEach(u, each) {
  for (let p = 0; p < u.length;) {
    let key, n; [key, p] = varint(u, p);
    const f = Math.floor(key / 8), w = key % 8;
    if (w === 0) { [n, p] = varint(u, p); each(f, 0, n); }
    else if (w === 2) { [n, p] = varint(u, p); each(f, 2, u.subarray(p, p + n)); p += n; }
    else if (w === 5) p += 4; else if (w === 1) p += 8; else return;
  }
}
function iwaStorages(u, out) {
  const td = new TextDecoder();
  for (let p = 0; p < u.length;) {
    let n; [n, p] = varint(u, p);
    if (!n || p + n > u.length) return;
    const msgs = [];
    pbEach(u.subarray(p, p + n), (f, w, v) => { if (f === 2 && w === 2) { const m = {type: 0, len: 0}; pbEach(v, (g, w2, x) => { if (w2 === 0 && g === 1) m.type = x; else if (w2 === 0 && g === 3) m.len = x; }); msgs.push(m); } });
    p += n;
    for (const m of msgs) {
      if (m.type === 2001 || m.type === 2005) {                                   // TSWP.StorageArchive: kind = field 1 (0 is the body), text = field 3
        let kind = 3; const text = [];
        pbEach(u.subarray(p, p + m.len), (f, w, v) => { if (f === 1 && w === 0) kind = v; else if (f === 3 && w === 2) text.push(td.decode(v)); });
        out.push({kind, text: text.join('')});
      }
      p += m.len;
    }
  }
}
async function pagesRecs(files) {
  if (files.has('Index.zip')) (await unzip(files.get('Index.zip').slice().buffer, n => /\.iwa$/.test(n))).forEach((v, k) => files.set(k, v));
  const names = Array.from(files.keys()).filter(n => /\.iwa$/.test(n)).sort((a, b) => (/Document\.iwa$/.test(b) ? 1 : 0) - (/Document\.iwa$/.test(a) ? 1 : 0));
  if (!names.length) throw userErr('That Pages file is in an older format. In Pages, choose File, Export To, Word, then open the .docx here.');
  const found = [];
  for (const n of names) { try { iwaStorages(iwaBytes(files.get(n)), found); } catch (e) { /* skip an archive we cannot read */ } }
  const real = found.filter(s => s.text.trim()), bodies = real.filter(s => s.kind === 0);
  const pick = bodies.length ? bodies : real.sort((a, b) => b.text.length - a.text.length).slice(0, 1);
  const text = pick.map(s => s.text).join('\n').replace(/[\u2028\u2029\u000b\u000c\u0004\u0005]/g, '\n').replace(/[\ufffc\ufeff\u0000-\u0008\u000e-\u001f]/g, '');
  const recs = []; let gap = true;
  for (const line of text.split('\n')) {
    const lead = (line.match(/^[\t ]*/) || [''])[0], x = line.trim();
    if (!x) { gap = true; continue; }
    const tabs = (lead.match(/\t/g) || []).length;
    recs.push({x: x.replace(/\t+/g, ' '), ind: tabs * 0.5 + (lead.length - tabs) * 0.08, al: '', st: '', gap}); gap = false;
  }
  return {recs, title: {}};
}

/* ---- putting an opened file on the page ---- */
function swapProject(np, label) {
  const prev = projectJSON(), wasSample = P.sample;
  loadProject(np); touch();
  stage.scrollTop = scriptTop();
  toast(label, {label: 'Undo', run() { loadProject(prev); if (wasSample) { clearTimeout(saveT); store.set(KEY, null); } else touch(); stage.scrollTop = scriptTop(); }});
}
async function openFile(f) {
  if (!f) return;
  const name = f.name || 'file', ext = (name.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase(), stem = name.replace(/\.[^.]+$/, '').replace(/\.(fountain|cuemark)$/i, '');
  let got = null;
  try {
    const buf = await f.arrayBuffer(), u = new Uint8Array(buf);
    if (u[0] === 0xd0 && u[1] === 0xcf && u[2] === 0x11 && u[3] === 0xe0) throw userErr('That is an older Word file (.doc). In Word, save it as .docx, then open that.');
    if (u[0] === 0x50 && u[1] === 0x4b) {
      if (typeof DecompressionStream === 'undefined') throw userErr('This browser cannot unpack Word or Pages files. Try a current Chrome, Edge, Safari or Firefox.');
      const files = await unzip(buf, n => n === 'word/document.xml' || n === 'word/styles.xml' || /^Index\/.*\.iwa$/.test(n) || n === 'Index.zip');
      if (files.has('word/document.xml')) got = docxRecs(files);
      else if (ext === 'pages' || files.size) got = await pagesRecs(files);
      else throw userErr('That file is not a Word or Pages document.');
    } else {
      let txt = u[0] === 0xff && u[1] === 0xfe ? new TextDecoder('utf-16le').decode(u) : u[0] === 0xfe && u[1] === 0xff ? new TextDecoder('utf-16be').decode(u) : new TextDecoder().decode(u);
      if ((txt.match(/\ufffd/g) || []).length > 3) txt = new TextDecoder('windows-1252').decode(u);
      txt = txt.replace(/^\ufeff/, '');
      if (/^\s*\{\\rtf/.test(txt)) throw userErr('That is an RTF file. Save it as .docx or plain text, then open that.');
      let p = null; try { p = JSON.parse(txt); } catch (e) { p = null; }
      if (p && Array.isArray(p.blocks)) { p.sample = false; return swapProject(p, 'Opened ' + name + '.'); }
      if (p && typeof p === 'object') throw userErr('That file is not a CueMark project.');
      got = textRecs(txt);
    }
  } catch (e) { return toast(e && e.user ? e.message : 'CueMark could not read that file.'); }
  const res = autoFormat(got.recs, {title: got.title});
  if (!res.blocks.length) return toast('No script text was found in that file.');
  const np = blank(res.format); np.blocks = res.blocks;
  np.title.title = res.title.title || stem;
  for (const k of ['author', 'credit', 'based', 'draft', 'contact']) if (res.title[k]) np.title[k] = res.title[k];
  const said = new Map();                                                        // anyone who speaks twice or more joins the cast
  for (const b of res.blocks) if (b.t === 'character') { const n = cueName(b.x); if (n) said.set(n, (said.get(n) || 0) + 1); }
  said.forEach((n, who) => { if (n >= 2 && np.cast.length < 40) np.cast.push({id: rid(), name: titleCase(who), desc: '', aliases: '', color: nextColor(np.cast)}); });
  swapProject(np, `Opened ${name}: ${plural(res.blocks.length, 'line')} formatted` + (np.cast.length ? `, ${plural(np.cast.length, 'character')} tagged.` : '.'));
}
$('#file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; openFile(f); });
$('#b-open').addEventListener('click', () => $('#file').click());
window.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
window.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { e.preventDefault(); openFile(f); } });
