/* ---------- layout: the clean Courier manuscript ---------- */
const LPP = 54, TOPROW = 6, MORE = {col: 37, segs: [{t: '(MORE)', s: 0}]};

/* Fountain-style emphasis: **bold**, *italic*, _underline_. Returns the text without the marks, with a style flag per character. */
function emph(s) {
  if (!/[*_]/.test(s)) return {c: s, f: null};
  const n = s.length, raw = new Uint8Array(n), drop = new Uint8Array(n); let w = s;
  const pass = (re, bit, m) => { w = w.replace(re, (all, inner, at) => {
    const end = at + all.length;
    for (let k = at; k < at + m; k++) drop[k] = 1;
    for (let k = end - m; k < end; k++) drop[k] = 1;
    for (let k = at + m; k < end - m; k++) raw[k] |= bit;
    return '\u0001'.repeat(m) + inner + '\u0001'.repeat(m);
  }); };
  pass(/\*\*\*(?=\S)(.+?)(?<=\S)\*\*\*/g, 3, 3);
  pass(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, 1, 2);
  pass(/\*(?=\S)(.+?)(?<=\S)\*/g, 2, 1);
  pass(/(?<![\p{L}\p{N}])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}])/gu, 4, 1);
  let c = ''; const f = [];
  for (let k = 0; k < n; k++) if (!drop[k]) { c += s[k]; f.push(raw[k]); }
  if (c.length === n) return {c: s, f: null};
  return {c, f: Uint8Array.from(f), drop, raw};
}
function wrapIdx(s, w, w1) {
  const out = [], n = s.length; let a = 0, width = w1 || w;
  while (a < n) {
    if (n - a <= width) { out.push([a, n]); break; }
    let b = s.lastIndexOf(' ', a + width);
    if (b <= a) { b = a + width; out.push([a, b]); a = b; }
    else { let e = b; while (e > a && s[e - 1] === ' ') e--; out.push([a, e]); a = b + 1; }
    while (s[a] === ' ') a++;
    width = w;
  }
  if (!out.length) out.push([0, 0]);
  return out;
}
function segsOf(c, f, a, b, add) {
  if (!f) return [{t: c.slice(a, b), s: add}];
  const out = []; let i = a;
  while (i < b) { let j = i; while (j + 1 < b && f[j + 1] === f[i]) j++; out.push({t: c.slice(i, j + 1), s: f[i] | add}); i = j + 1; }
  return out.length ? out : [{t: '', s: add}];
}
const plainLines = (s, w) => { s = clean(s).trim(); return s ? wrapIdx(s, w).map(([a, b]) => s.slice(a, b)) : []; };

function linesFor(t, d, x, bi) {
  if (d.wrap) x = x.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
  if (d.caps) x = x.toUpperCase();
  const e = emph(x); let c = e.c, f = e.f;
  if (d.wrap) { c = '(' + c + ')'; if (f) { const g = new Uint8Array(c.length); g.set(f, 1); f = g; } }
  const hang = d.wrap ? 1 : 0, kind = t === 'character' ? 'cue' : t === 'paren' ? 'par' : t === 'dialogue' ? 'dlg' : 'x';
  const left = d.right && /^FADE IN:?$/.test(c);
  return wrapIdx(c, d.w - hang, d.w).map(([a, b], i) => {
    const l = {col: d.right && !left ? d.col + d.w - (b - a) : d.col + (i ? hang : 0), segs: segsOf(c, f, a, b, d.u ? 4 : 0), bi, k: kind};
    if (d.lab && !i) l.pre = {col: d.lcol || (d.col === 40 ? 10 : d.col), t: d.lab};
    return l;
  });
}

/* Break the script into pages of 54 lines. Speeches stay with their speaker; headings stay with what follows. */
function paginate(blocks, fk, lpp) {
  lpp = lpp || LPP;
  const Fm = F[fk], film = fk === 'film', items = [];
  blocks.forEach((b, bi) => { const d = Fm.types[b.t]; if (!d || d.skip) return; const x = clean(b.x).trim(); if (!x) return; items.push({bi, t: b.t, d, x, lines: linesFor(b.t, d, x, bi)}); });
  const pages = [], labels = [], first = new Array(blocks.length).fill(0);
  let page = null, act = 'I', scn = 1, sawAct = false, sawScene = false;
  const label = () => film ? (pages.length > 1 ? pages.length + '.' : '') : act + '-' + scn + '-' + pages.length;
  const open = () => { page = []; pages.push(page); labels.push(label()); };
  const room = () => lpp - page.length;
  const put = (lines, gap) => { for (let k = 0; k < gap; k++) page.push(null); for (const l of lines) { if (l.bi != null && !first[l.bi]) first[l.bi] = pages.length; page.push(l); } };
  open();
  for (let i = 0; i < items.length; i++) {
    const it = items[i], nx = items[i + 1];
    if (!film && (it.t === 'act' || it.t === 'scene')) {
      if (it.t === 'act') { const m = it.x.match(/([ivxlc]+|\d+)\s*$/i); act = m ? (/\d/.test(m[1]) ? roman(+m[1]) : m[1].toUpperCase()) : (sawAct ? roman(unroman(act) + 1) : act); sawAct = true; scn = 1; sawScene = false; }
      else { const m = it.x.match(/(\d+)\s*$/); scn = m ? +m[1] : (sawScene ? scn + 1 : scn); sawScene = true; }
      const prev = items[i - 1];
      if (page.length && !(it.t === 'scene' && prev && prev.t === 'act')) open(); else labels[pages.length - 1] = label();
    }
    if (it.t === 'character') {
      let lines = it.lines.slice(), j = i + 1;
      while (j < items.length && (items[j].t === 'paren' || items[j].t === 'dialogue')) { lines = lines.concat(items[j].lines); j++; }
      i = j - 1;
      const name = it.x.toUpperCase().replace(/\s*\((CONT'D|CONT’D|CONT\.|CONTINUED)\)\s*$/, '');
      const contd = {col: it.d.col, segs: [{t: name + (film ? " (CONT'D)" : ' (cont.)'), s: 0}], k: 'cue'};
      let rest = lines, top = true;
      for (;;) {
        const g = page.length && top ? it.d.before : 0, res = film ? 1 : 0;
        if (g + rest.length <= room()) { put(rest, g); break; }
        let k = Math.min(room() - g - res, rest.length - 2);
        while (k >= 3 && !(rest[k - 1].k === 'dlg' && rest[k].k === 'dlg')) k--;
        if (k < 3 && page.length) { open(); continue; }
        if (k < 3) k = Math.max(1, room() - res);
        put(rest.slice(0, k), g); if (film) page.push(MORE);
        open(); rest = [contd].concat(rest.slice(k)); top = false;
      }
      continue;
    }
    if ((it.d.ix || it.d.keep) && page.length && nx) {
      const need = it.d.before + it.lines.length + nx.d.before + (nx.t === 'character' ? 3 : Math.min(2, nx.lines.length));
      if (need > room()) open();
    }
    let rest = it.lines, top = true;
    for (;;) {
      const g = page.length && top ? it.d.before : 0;
      if (g + rest.length <= room()) { put(rest, g); break; }
      const k = room() - g;
      if (k >= 2 && rest.length - k >= 2) { put(rest.slice(0, k), g); open(); rest = rest.slice(k); top = false; }
      else if (page.length) open();
      else { const r = room(); put(rest.slice(0, r), 0); open(); rest = rest.slice(r); top = false; }
    }
  }
  if (pages.length > 1 && !pages[pages.length - 1].length) { pages.pop(); labels.pop(); }
  return {pages, first, labels};
}

/* ---------- pages as placed text: {label, items: [{row, col, segs}]} ---------- */
function scriptPages(lay) {
  return lay.pages.map((pg, n) => {
    const items = [];
    pg.forEach((l, i) => { if (!l) return; items.push({row: TOPROW + i, col: l.col, segs: l.segs}); if (l.pre) items.push({row: TOPROW + i, col: l.pre.col, segs: [{t: l.pre.t, s: 0}]}); });
    const lab = lay.labels[n];
    if (lab) items.push({row: 3, col: 75 - lab.length, segs: [{t: lab, s: 0}]});
    return {items};
  });
}
function titlePage() {
  const t = P.title, items = [], film = P.format === 'film';
  const put = (row, col, s, st) => { if (s) items.push({row, col, segs: [{t: s, s: st || 0}]}); };
  const title = (clean(t.title).trim() || 'Untitled').toUpperCase();
  const contact = String(t.contact || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8);
  if (film) {
    let r = 21; const mid = (s, st) => put(r, 15 + Math.max(0, Math.floor((60 - s.length) / 2)), s, st);
    plainLines(title, 50).forEach(l => { mid(l, 1); r++; });
    const by = plainLines(t.author, 50);
    r += 3; if (by.length && clean(t.credit).trim()) { mid(clean(t.credit).trim()); r += 2; }
    by.forEach(l => { mid(l); r++; });
    if (clean(t.based).trim()) { r += 3; plainLines(t.based, 50).forEach(l => { mid(l); r++; }); }
    contact.forEach((l, i) => put(60 - contact.length + i, 15, l.slice(0, 40)));
    const d = clean(t.draft).trim(); if (d) put(59, 75 - d.length, d);
  } else {
    let r = 21; put(r++, 40, title.slice(0, 35)); put(r++, 40, '_'.repeat(Math.min(35, title.length))); r++;
    plainLines(t.desc, 35).forEach(l => put(r++, 40, l)); if (clean(t.desc).trim()) r++;
    const by = plainLines(t.author, 35);
    if (by.length) { put(r, 40, clean(t.credit).trim() || 'by'); r += 2; }
    by.forEach(l => put(r++, 40, l));
    const w = contact.reduce((m, l) => Math.max(m, l.length), 0);
    contact.forEach((l, i) => put(60 - contact.length + i, Math.max(40, 75 - w), l.slice(0, 35)));
  }
  return {items};
}
function castPages() {
  const rows = [], film = P.format === 'film';                    // each row: null (blank) or a list of placed pieces
  const head = s => rows.push([{col: 15 + Math.floor((60 - s.length) / 2), segs: [{t: s, s: 4}]}]);
  head('Cast of Characters'); rows.push(null);
  for (const c of P.cast) {
    const name = clean(c.name).trim(); if (!name) continue;
    const who = name + ':', desc = plainLines(c.desc, 35);
    if (who.length > 24 || !desc.length) { rows.push([{col: 15, segs: [{t: who.slice(0, 60), s: 0}]}]); desc.forEach(l => rows.push([{col: 40, segs: [{t: l, s: 0}]}])); }
    else desc.forEach((l, i) => rows.push((i ? [] : [{col: 15, segs: [{t: who, s: 0}]}]).concat([{col: 40, segs: [{t: l, s: 0}]}])));
    rows.push(null);
  }
  if (!film) [['Scene', P.castMeta.scene], ['Time', P.castMeta.time]].forEach(([h, v]) => {
    const ls = plainLines(v, 60); if (!ls.length) return;
    rows.push(null); head(h); rows.push(null); ls.forEach(l => rows.push([{col: 15, segs: [{t: l, s: 0}]}]));
  });
  const pages = [];
  for (let i = 0; i < rows.length; i += LPP) {
    const items = []; rows.slice(i, i + LPP).forEach((r, k) => { if (r) r.forEach(p => items.push({row: TOPROW + k, col: p.col, segs: p.segs})); });
    pages.push({items});
  }
  return pages;
}
function allPages(withTitle, withCast) {
  const blocks = H.stack[H.i].b;
  let out = [];
  if (withTitle) out.push(titlePage());
  if (withCast && P.cast.some(c => clean(c.name).trim())) out = out.concat(castPages());
  return out.concat(scriptPages(paginate(blocks, P.format)));
}
function pageRows(pg, html) {
  const rows = new Array(66).fill('');
  const byRow = new Map();
  for (const it of pg.items) { if (it.row < 0 || it.row > 65) continue; if (!byRow.has(it.row)) byRow.set(it.row, []); byRow.get(it.row).push(it); }
  byRow.forEach((list, r) => {
    list.sort((a, b) => a.col - b.col); let s = '', at = 0;
    for (const it of list) {
      if (it.col > at) { s += ' '.repeat(it.col - at); at = it.col; }
      for (const sg of it.segs) {
        let x = html ? esc(sg.t) : sg.t;
        if (html) { if (sg.s & 4) x = '<u>' + x + '</u>'; if (sg.s & 2) x = '<i>' + x + '</i>'; if (sg.s & 1) x = '<b>' + x + '</b>'; }
        s += x; at += sg.t.length;
      }
    }
    rows[r] = s;
  });
  return rows;
}

/* ---------- PDF: text set in the standard Courier that every PDF reader carries ---------- */
const CP1252 = {0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159};
function pdfStr(s) {
  let o = '';
  for (const ch of String(s)) {
    let c = ch.codePointAt(0);
    if (c > 255 || (c >= 128 && c < 160)) c = CP1252[c] || 63;
    if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
    else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0');
    else o += String.fromCharCode(c);
  }
  return o;
}
const needsMore = s => { for (const ch of String(s)) { const c = ch.codePointAt(0); if ((c > 255 || (c >= 128 && c < 160)) && !CP1252[c]) return true; } return false; };
function makePDF(pages, meta) {
  const objs = ['', ''], add = s => { objs.push(s); return objs.length; };
  const fonts = ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'].map(n => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`));
  const res = '<< /Font << ' + fonts.map((f, i) => `/F${i + 1} ${f} 0 R`).join(' ') + ' >> >>', kids = [];
  for (const pg of pages) {
    let c = '0.6 w\n';
    for (const it of pg.items) {
      let x = it.col * 7.2; const y = 792 - (it.row + 1) * 12 + 3;
      for (const sg of it.segs) {
        const w = sg.t.length * 7.2; if (!sg.t) continue;
        c += `BT /F${1 + (sg.s & 1 ? 1 : 0) + (sg.s & 2 ? 2 : 0)} 12 Tf ${x.toFixed(1)} ${y} Td (${pdfStr(sg.t)}) Tj ET\n`;
        if (sg.s & 4) c += `${x.toFixed(1)} ${y - 1.8} m ${(x + w).toFixed(1)} ${y - 1.8} l S\n`;
        x += w;
      }
    }
    const content = add(`<< /Length ${c.length} >>\nstream\n${c}endstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${res} /Contents ${content} 0 R >>`));
  }
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${pdfStr(meta.title)}) /Author (${pdfStr(meta.author)}) /Creator (CueMark ${VERSION}) >>`);
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

/* ---------- plain text ---------- */
function fountain(blocks) {
  const t = P.title, out = [], head = [];
  const kv = (k, v) => { v = clean(v).trim(); if (v) head.push(k + ': ' + v); };
  kv('Title', t.title); if (clean(t.author).trim()) kv('Credit', t.credit); kv('Author', t.author); kv('Source', t.based); kv('Draft date', t.draft);
  const contact = String(t.contact || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (contact.length) head.push('Contact:\n' + contact.map(l => '    ' + l).join('\n'));
  for (const b of blocks) {
    const x = clean(b.x).trim(); if (!x) continue;
    const U = x.toUpperCase(), para = s => out.push('', s);
    if (b.t === 'scene') para(/^(INT|EXT|EST|I\/E|INT\.?\/EXT)[. ]/.test(U) ? U : '.' + U);
    else if (b.t === 'character') para(U);
    else if (b.t === 'paren') out.push('(' + x.replace(/^\(|\)$/g, '') + ')');
    else if (b.t === 'dialogue') out.push(x);
    else if (b.t === 'transition') para(/TO:$/.test(U) || /^FADE IN:?$/.test(U) ? U : '> ' + U);
    else if (b.t === 'note') para('[[' + x + ']]');
    else if (b.t === 'sub' || b.t === 'shot') para('.' + U);
    else para(/[A-Z]/.test(x) && !/[a-z]/.test(x) ? '!' + x : x);
  }
  return (head.length ? head.join('\n') + '\n' : '') + out.join('\n').replace(/^\n+/, '\n') + '\n';
}
function flowText(blocks) {
  const t = P.title, lay = paginate(blocks, P.format, 1e9), out = [];
  out.push((clean(t.title).trim() || 'Untitled').toUpperCase(), '');
  if (clean(t.author).trim()) out.push((clean(t.credit).trim() || 'by') + ' ' + clean(t.author).trim(), '');
  out.push('');
  const pg = scriptPages(lay)[0], rows = new Map();
  for (const it of pg.items) { if (it.row < TOPROW) continue; if (!rows.has(it.row)) rows.set(it.row, []); rows.get(it.row).push(it); }
  const max = Math.max(TOPROW, ...rows.keys());
  for (let r = TOPROW; r <= max; r++) {
    const list = (rows.get(r) || []).sort((a, b) => a.col - b.col); let s = '', at = 10;
    for (const it of list) { if (it.col > at) { s += ' '.repeat(it.col - at); at = it.col; } for (const sg of it.segs) { s += sg.t; at += sg.t.length; } }
    out.push(s);
  }
  return out.join('\n') + '\n';
}
function scriptText() { const b = H.stack[H.i].b; return P.format === 'film' ? fountain(b) : flowText(b); }

/* ---------- saving files ---------- */
let DL = null, dlAsked = null;
const downloads = () => dlAsked || (dlAsked = cap('downloads').then(d => (DL = d)));
const fileStem = () => (clean(P.title.title).trim() || 'Untitled script').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
async function saveFile(name, data, mime) {
  if (hosted()) {
    const d = await downloads();
    if (!d) return toast('Downloads are not available in this view. Use Copy script text instead.');
    try { await d.save({filename: name, data: typeof data === 'string' ? data : new Blob([data], {type: mime})}); toast('Saved ' + name + '.'); }
    catch (e) {
      if (e && e.code === 'declined') return;
      toast(e && (e.code === 'rejected_extension' || e.code === 'extension_not_enabled') ? 'This view cannot save that kind of file.' : 'The file could not be saved here. Try again in a moment.');
    }
    return;
  }
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([data], {type: mime}));
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Saved ' + name + '.');
}
function projectJSON() { return Object.assign({}, P, {app: 'cuemark', appVersion: VERSION, blocks: H.stack[H.i].b.map(b => ({t: b.t, x: b.x}))}); }
function saveProjectFile() { saveFile(fileStem() + '.cuemark.json', JSON.stringify(projectJSON(), null, 1), 'application/json'); }
/* ---------- the two pinned downloads ---------- */
async function appSource() {
  if (!hosted() && /^https?:$/.test(location.protocol)) {             // on a web host, hand over the exact file being served
    try { const r = await fetch(location.href.split(/[?#]/)[0], {cache: 'no-store'}); const t = r.ok ? await r.text() : ''; if (t.indexOf('id="appcss"') > 0) return t; } catch (e) { /* fall through to the copy taken at load */ }
  }
  if (!SELF) return '';
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + SELF.head + '\n<style id="appcss">' + SELF.css + '</style>\n<style id="tagcss"></style>\n</head>\n<body>\n' + SELF.body + '\n' + SELF.log + '\n<script>' + SELF.js + '<\/script>\n</body>\n</html>\n';
}
$('#b-dl-app').addEventListener('click', async () => {
  const src = await appSource();
  if (!src) return toast('The app file could not be put together here.');
  saveFile('CueMark-' + VERSION + '.html', src, 'text/html');
});
$('#b-dl-script').addEventListener('click', () => {
  const pages = allPages($('#ex-title').checked, $('#ex-cast').checked);
  saveFile(fileStem() + '.pdf', makePDF(pages, {title: clean(P.title.title).trim() || 'Untitled', author: clean(P.title.author).trim()}), 'application/pdf');
});

/* ---------- export ---------- */
const dlgEx = $('#dlg-export');
let exPages = [];
function drawExport() {
  exPages = allPages($('#ex-title').checked, $('#ex-cast').checked);
  const view = $('#ex-view');
  view.style.setProperty('--pfs', Math.max(6, Math.min(11.5, (view.clientWidth - 36) / 51)).toFixed(2) + 'px');
  view.innerHTML = exPages.map(pg => '<pre class="pg">' + pageRows(pg, true).join('\n') + '</pre>').join('');
  const film = P.format === 'film';
  $('#ex-sum').textContent = `${F[P.format].name} format, ${plural(exPages.length, 'page')}, Courier 12 point on US Letter. Character colors, notes and page guides are left out.`;
  const odd = needsMore(H.stack[H.i].b.map(b => b.x).join(' ') + P.cast.map(c => c.name + c.desc).join(' ') + Object.values(P.title).join(' '));
  const note = $('#ex-note'); note.hidden = !odd;
  if (odd) note.textContent = 'Some characters here are outside standard Courier and show as ? in the PDF.' + (hosted() ? '' : ' Print keeps them.');
  $('#ex-txt').textContent = film ? 'Download Fountain text' : 'Download plain text';
  $('#ex-print').hidden = hosted();
}
$('#b-export').addEventListener('click', () => {
  dlgEx.showModal(); drawExport();
  if (hosted()) downloads().then(d => { $('#ex-pdf').hidden = $('#ex-txt').hidden = !d; });
});
$('#ex-title').addEventListener('change', drawExport);
$('#ex-cast').addEventListener('change', drawExport);
$('#ex-close').addEventListener('click', () => dlgEx.close());
$('#ex-pdf').addEventListener('click', () => saveFile(fileStem() + '.pdf', makePDF(exPages, {title: clean(P.title.title).trim() || 'Untitled', author: clean(P.title.author).trim()}), 'application/pdf'));
$('#ex-txt').addEventListener('click', () => saveFile(fileStem() + (P.format === 'film' && !hosted() ? '.fountain' : '.txt'), scriptText(), 'text/plain'));
$('#ex-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(scriptText()); toast('Script text copied.'); }
  catch (e) { toast('Copying is blocked here. Use the download buttons instead.'); }
});
$('#ex-print').addEventListener('click', () => {
  $('#printroot').innerHTML = exPages.map(pg => '<pre class="pg">' + pageRows(pg, true).join('\n') + '</pre>').join('');
  try { window.print(); } catch (e) { toast('Printing is not available here. Download the PDF instead.'); }
});
