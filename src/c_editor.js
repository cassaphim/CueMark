/* ---------- script blocks ---------- */
const text = el => el.textContent;
function cls(el) {
  const t = el.dataset.t, d = T()[t] || {}, x = el.textContent;
  el.className = 'el t-' + t + (d.wrap ? ' pw' : '') + (d.lab ? ' lb' : '') + (x ? '' : ' is-empty') + (el._cid ? ' sp' : '') + (el._pg ? ' pg' : '') +
    (t === 'transition' && /^\s*fade in:?\s*$/i.test(x) ? ' left' : '');
}
function setType(el, t) {
  if (!T()[t]) t = base();
  el.dataset.t = t; el.dataset.ph = T()[t].ph; cls(el);
}
function setText(el, s) { el.textContent = s; cls(el); }
function mk(t, x) { const el = document.createElement('div'); if (x) el.textContent = x; setType(el, t); return el; }
function drop(el) { unmark(el); el.remove(); }
function insertAfter(ref, el) { root.insertBefore(el, ref ? ref.nextSibling : root.firstChild); }

/* ---------- selection ---------- */
function blockOf(n) { while (n && n !== root) { if (n.parentNode === root) return n.nodeType === 1 ? n : null; n = n.parentNode; } return null; }
function point(n, o) {
  if (n === root) {
    const k = root.children; if (!k.length) return null;
    if (o >= k.length) { const el = k[k.length - 1]; return {el, off: el.textContent.length}; }
    return {el: k[o], off: 0};
  }
  const el = blockOf(n); if (!el) return null;
  if (n === el) return {el, off: o ? el.textContent.length : 0};
  const r = document.createRange(); r.selectNodeContents(el);
  try { r.setEnd(n, o); } catch (e) { return {el, off: 0}; }
  return {el, off: r.toString().length};
}
function sel() {
  const s = getSelection(); if (!s.rangeCount) return null;
  const r = s.getRangeAt(0); if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const a = point(r.startContainer, r.startOffset), b = point(r.endContainer, r.endOffset);
  if (!a || !b) return null;
  return {a, b, collapsed: r.collapsed, multi: a.el !== b.el};
}
function reveal(el) {
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  if (r.bottom > s.bottom - 56) stage.scrollTop += r.bottom - s.bottom + 56;
  else if (r.top < s.top + dockH() + 8) stage.scrollTop -= s.top + dockH() + 8 - r.top;
}
function selectIn(el, a, b) {
  const r = document.createRange(), t = el.firstChild;
  if (t && t.nodeType === 3) { r.setStart(t, Math.max(0, Math.min(a, t.length))); r.setEnd(t, Math.max(0, Math.min(b, t.length))); }
  else { r.setStart(el, 0); r.collapse(true); }
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  if (document.activeElement !== root) root.focus({preventScroll: true});
  reveal(el);
}
const caret = (el, off) => selectIn(el, off, off);
const caretEnd = el => caret(el, el.textContent.length);

/* ---------- history ---------- */
const H = {stack: [], i: -1, at: 0, kind: ''};
function snap() {
  const b = [], s = sel(); let c = null, i = 0;
  for (const el of root.children) {
    const x = el.textContent, t = el.dataset.t; let r = el._r;
    if (!r || r.x !== x || r.t !== t) r = el._r = {t, x};
    b.push(r); if (s && s.a.el === el) c = [i, s.a.off]; i++;
  }
  return {f: P.format, b, c};
}
function commit(kind) {
  const now = Date.now(), sn = snap(), top = H.stack[H.i];
  if (kind === 'type' && H.kind === 'type' && now - H.at < 900 && H.i > 0 && H.i === H.stack.length - 1 && top.b.length === sn.b.length) H.stack[H.i] = sn;
  else { H.stack.length = H.i + 1; H.stack.push(sn); if (H.stack.length > 300) H.stack.shift(); H.i = H.stack.length - 1; }
  H.at = now; H.kind = kind; touch();
}
function restore(sn) {
  if (sn.f !== P.format) applyFormat(sn.f);
  render(sn.b);
  if (sn.c && root.children[sn.c[0]]) caret(root.children[sn.c[0]], sn.c[1]);
  H.kind = ''; touch(); schedule(); hideAC();
}
function undo() { if (H.i > 0) restore(H.stack[--H.i]); }
function redo() { if (H.i < H.stack.length - 1) restore(H.stack[++H.i]); }
function render(blocks) {
  const f = document.createDocumentFragment();
  for (const b of blocks) { const ok = !!T()[b.t]; const el = mk(ok ? b.t : base(), b.x); if (ok) el._r = b; f.append(el); }
  root.textContent = ''; root.append(f);
  if (!root.firstChild) root.append(mk(base(), ''));
  markAll(); tagSpeeches(true);
}
function done(kind) {
  if (kind !== 'type') tagSpeeches();
  commit(kind || 'struct'); schedule(); status();
}

/* ---------- formats ---------- */
function applyFormat(f) {
  P.format = f; app.dataset.format = f;
  $$('#fmt button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
  const cr = P.title.credit;
  if (f === 'stage' && (!cr || cr === 'Written by')) P.title.credit = 'by';
  if (f === 'film' && (!cr || cr === 'by')) P.title.credit = 'Written by';
  fillTitle();
}
function switchFormat(f) {
  if (f === P.format) return;
  const map = CONV[P.format], blocks = H.stack[H.i].b.map(b => ({t: map[b.t] || F[f].base, x: b.x}));
  applyFormat(f); render(blocks); done(); applyZoom();
  toast('Now in ' + F[f].name.toLowerCase() + ' format. Undo takes you back.');
}
function prefill(el) {
  if (P.format !== 'stage' || text(el)) return;
  const t = el.dataset.t; if (t !== 'act' && t !== 'scene') return;
  let n = 0;
  for (let p = el.previousElementSibling; p; p = p.previousElementSibling) { if (p.dataset.t === t) n++; else if (t === 'scene' && p.dataset.t === 'act') break; }
  setText(el, t === 'act' ? 'ACT ' + roman(n + 1) : 'Scene ' + (n + 1));
}
function retype(el, t) {
  el._cid = null; el.style.removeProperty('--tag');
  const d = T()[t] || {};
  if (d.wrap) { const x = text(el), y = x.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, ''); if (y !== x) el.textContent = y; }
  setType(el, t); prefill(el); markBlock(el);
}

/* ---------- editing ---------- */
function delSel(s) {
  const A = s.a.el, B = s.b.el;
  if (A === B) { const x = text(A); setText(A, x.slice(0, s.a.off) + x.slice(s.b.off)); }
  else {
    const tail = text(B).slice(s.b.off);
    for (let n = A.nextSibling; n && n !== B;) { const nx = n.nextSibling; drop(n); n = nx; }
    drop(B); setText(A, text(A).slice(0, s.a.off) + tail);
  }
  markBlock(A); caret(A, s.a.off);
}
function insertText(str) {
  const s = sel(); if (!s) return;
  const el = s.a.el, x = text(el);
  setText(el, x.slice(0, s.a.off) + str + x.slice(s.multi ? s.a.off : s.b.off));
  markBlock(el); caret(el, s.a.off + str.length);
}
function doEnter(same) {
  let s = sel(); if (!s) return;
  if (!s.collapsed) { delSel(s); s = sel(); }
  const el = s.a.el, off = s.a.off, x = text(el), t = el.dataset.t, d = T()[t];
  if (!x) {
    if (t !== base()) { retype(el, base()); caret(el, 0); return done(); }
    return elMenuAtCaret(el);
  }
  if (off === 0) { root.insertBefore(mk(t === 'character' ? base() : t, ''), el); caret(el, 0); return done(); }
  const right = x.slice(off).replace(/^\s+/, '');
  setText(el, x.slice(0, off).replace(/\s+$/, '')); markBlock(el);
  const n = mk(right || same ? t : d.enter, right);
  insertAfter(el, n); prefill(n); markBlock(n);
  caret(n, right ? 0 : text(n).length); done(); showAC();
}
function doTab(back) {
  const s = sel(); if (!s || s.multi) return;
  const el = s.a.el, t = el.dataset.t, d = T()[t], x = text(el);
  if (back) { if (!x && t !== base()) { retype(el, base()); caret(el, 0); done(); } return; }
  if (!x) { retype(el, d.tab || base()); caretEnd(el); done(); return showAC(); }
  if (P.format === 'film' && t === 'scene') {
    if (!/ - $/.test(x)) { setText(el, x.replace(/[\s-]+$/, '') + ' - '); markBlock(el); caretEnd(el); done('type'); }
    return showAC();
  }
  const n = mk(d.tabNew || d.enter, ''); insertAfter(el, n); prefill(n); markBlock(n); caretEnd(n); done(); showAC();
}
function mergeBack(el) {
  const p = el.previousElementSibling;
  if (!p) { if (el.dataset.t !== base()) { retype(el, base()); caret(el, 0); done(); } return; }
  const px = text(p), x = text(el);
  if (!px && x) { drop(p); caret(el, 0); return done(); }
  drop(el); setText(p, px + x); markBlock(p); caret(p, px.length); done();
}
function mergeFwd(el) {
  const n = el.nextElementSibling; if (!n) return;
  const x = text(el);
  if (!x) { drop(el); caret(n, 0); return done(); }
  const nx = text(n); drop(n); setText(el, x + nx); markBlock(el); caret(el, x.length); done();
}
function wrapEmph(mark) {
  const s = sel(); if (!s || s.multi || s.collapsed) return;
  const el = s.a.el, x = text(el), m = mark.length; let a = s.a.off, b = s.b.off;
  if (x.slice(a - m, a) === mark && x.slice(b, b + m) === mark) { setText(el, x.slice(0, a - m) + x.slice(a, b) + x.slice(b + m)); a -= m; b -= m; }
  else { setText(el, x.slice(0, a) + mark + x.slice(a, b) + mark + x.slice(b)); a += m; b += m; }
  markBlock(el); selectIn(el, a, b); done();
}
function changeType(el, t, mode) {
  if (mode === 'change' || !text(el)) { retype(el, t); caretEnd(el); }
  else { const n = mk(t, ''); insertAfter(el, n); prefill(n); markBlock(n); caretEnd(n); }
  done(); showAC();
}

/* Keep the page well-formed after the browser edits it. */
function fixRoot() {
  let bad = !root.firstChild;
  for (let n = root.firstChild; n && !bad; n = n.nextSibling) if (n.nodeType !== 1 || !n.dataset.t) bad = true;
  if (!bad) return;
  let last = null;
  for (let n = root.firstChild; n;) {
    const nx = n.nextSibling;
    if (n.nodeType === 1 && n.dataset.t) { n = nx; continue; }
    const x = clean(n.textContent);
    if (x.trim()) { last = mk(base(), x); root.replaceChild(last, n); markBlock(last); } else n.remove();
    n = nx;
  }
  if (!root.firstChild) { last = mk(base(), ''); root.append(last); }
  if (last) caretEnd(last);
}
function tidy(el) {
  const f = el.firstChild; if (!f) return;
  if (f === el.lastChild && f.nodeType === 3 && !/[\n ]/.test(f.data)) return;
  const s = getSelection(); let off = -1;
  if (s.rangeCount && el.contains(s.focusNode)) { const p = point(s.focusNode, s.focusOffset); if (p) off = p.off; }
  const x = clean(el.textContent); el.textContent = x;
  if (off >= 0) caret(el, Math.min(off, x.length));
}
/* Format as you type: "int." starts a scene heading, "(" starts an acting direction, "CUT TO:" is a transition. */
function auto(el) {
  const t = el.dataset.t, x = text(el), d = T()[t] || {};
  const keep = nt => { const s = sel(), off = s ? s.a.off : x.length; retype(el, nt); caret(el, Math.min(off, text(el).length)); return true; };
  if (d.wrap && x[0] === '(') { const s = sel(), off = s ? s.a.off : 1, y = x.slice(1).replace(/\)$/, ''); setText(el, y); caret(el, Math.max(0, Math.min(off - 1, y.length))); return false; }
  const p = el.previousElementSibling, pt = p ? p.dataset.t : '';
  if (P.format === 'film' && t === 'action') {
    if (/^(int|ext|est|i\/e|int\.?\/ext)[. ]$/i.test(x)) return keep('scene');
    if (/^((smash |match |jump |hard )?cut|dissolve|fade|wipe) to:$/i.test(x) || /^fade (in:|out\.)$/i.test(x)) return keep('transition');
    if (x === '(' && /^(character|dialogue|paren)$/.test(pt)) { setText(el, ''); retype(el, 'paren'); caret(el, 0); return true; }
  }
  if (P.format === 'stage' && x === '(' && t === 'dialogue') { setText(el, ''); retype(el, pt === 'character' ? 'paren' : 'direction'); caret(el, 0); return true; }
  return false;
}
function afterNative() {
  fixRoot();
  const s = sel(), el = s ? s.a.el : null; let struct = false;
  if (el) { tidy(el); struct = auto(el); cls(el); markBlock(el); if (el.dataset.t === 'character') tagSpeeches(); }
  done(struct ? 'struct' : 'type'); showAC();
}

root.addEventListener('beforeinput', e => {
  const it = e.inputType;
  if (it === 'historyUndo') { e.preventDefault(); return undo(); }
  if (it === 'historyRedo') { e.preventDefault(); return redo(); }
  if (it.indexOf('format') === 0) { e.preventDefault(); const mark = {formatBold: '**', formatItalic: '*', formatUnderline: '_'}[it]; if (mark) wrapEmph(mark); return; }
  if (it === 'insertFromDrop') return e.preventDefault();
  if (it === 'insertFromPaste' || e.isComposing || it === 'insertCompositionText') return;
  const s = sel(); if (!s) return;
  if (it === 'insertParagraph' || it === 'insertLineBreak') { e.preventDefault(); return doEnter(it === 'insertLineBreak'); }
  if (s.multi) { e.preventDefault(); delSel(s); if (it === 'insertText' && e.data) insertText(e.data); return done(); }
  if (s.collapsed && it.indexOf('delete') === 0) {
    const el = s.a.el;
    if (/Backward$/.test(it) && s.a.off === 0) { e.preventDefault(); return mergeBack(el); }
    if (/Forward$/.test(it) && s.a.off === text(el).length) { e.preventDefault(); return mergeFwd(el); }
  }
});
root.addEventListener('input', e => { if (!e.isComposing) afterNative(); });
root.addEventListener('compositionstart', () => { const s = sel(); if (s && s.multi) delSel(s); });
root.addEventListener('compositionend', () => setTimeout(afterNative, 0));
root.addEventListener('dragstart', e => e.preventDefault());
root.addEventListener('drop', e => e.preventDefault());

root.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;
  const mod = e.metaKey || e.ctrlKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (AC) {
    if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); return moveAC(k === 'ArrowDown' ? 1 : -1); }
    if ((k === 'Enter' || k === 'Tab') && AC.i >= 0) { e.preventDefault(); return acceptAC(k === 'Enter'); }
    if (k === 'Escape') { e.preventDefault(); return hideAC(); }
  }
  if (k === 'Enter') { e.preventDefault(); return doEnter(e.shiftKey); }
  if (k === 'Tab' && !mod && !e.altKey) { e.preventDefault(); return doTab(e.shiftKey); }
  if (mod && !e.altKey && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (mod && !e.altKey && k === 'y') { e.preventDefault(); return redo(); }
  if (mod && !e.altKey && !e.shiftKey && (k === 'b' || k === 'i' || k === 'u')) { e.preventDefault(); return wrapEmph({b: '**', i: '*', u: '_'}[k]); }
  if (e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) {
    const t = F[P.format].order[+e.code.slice(5) - 1], s = sel();
    if (t && s) { e.preventDefault(); changeType(s.a.el, t, 'change'); }
  }
});

/* ---------- clipboard ---------- */
function plainOf(blocks) {
  const out = [];
  for (const b of blocks) {
    const x = b.x, U = x.toUpperCase(), d = T()[b.t] || {};
    if (b.t === 'paren' || b.t === 'direction') out.push((b.t === 'direction' ? '\n' : '') + '(' + x + ')');
    else if (b.t === 'dialogue') out.push(x);
    else if (b.t === 'note') out.push('\n[[' + x + ']]');
    else if (d.lab) out.push('\n' + d.lab + ' ' + x);
    else out.push('\n' + (d.caps ? U : x));
  }
  return out.join('\n').replace(/^\n+/, '') + '\n';
}
function onCopy(e, cut) {
  const s = sel(); if (!s || s.collapsed || !s.multi) return;
  e.preventDefault();
  const blocks = [];
  for (let el = s.a.el; el; el = el.nextElementSibling) {
    const x = text(el);
    blocks.push({t: el.dataset.t, x: x.slice(el === s.a.el ? s.a.off : 0, el === s.b.el ? s.b.off : x.length)});
    if (el === s.b.el) break;
  }
  e.clipboardData.setData('text/plain', plainOf(blocks.filter(b => b.x)));
  try { e.clipboardData.setData('application/x-cuemark', JSON.stringify({f: P.format, b: blocks})); } catch (err) { /* plain text is enough */ }
  if (cut) { delSel(s); done(); }
}
root.addEventListener('copy', e => onCopy(e, false));
root.addEventListener('cut', e => onCopy(e, true));
root.addEventListener('paste', e => {
  e.preventDefault();
  const cd = e.clipboardData; let blocks = null;
  try { const own = JSON.parse(cd.getData('application/x-cuemark') || 'null'); if (own && own.f === P.format && Array.isArray(own.b)) blocks = own.b.filter(b => b.x); } catch (err) { blocks = null; }
  const txt = cd.getData('text/plain');
  if (!blocks) {
    if (!txt) return;
    if (!/\n/.test(txt.trim())) blocks = [{t: '', x: clean(txt)}]; else blocks = parseText(txt, P.format);
  }
  if (!blocks.length) return;
  let s = sel(); if (!s) return;
  if (!s.collapsed) { delSel(s); s = sel(); }
  if (blocks.length === 1) { insertText(blocks[0].x); return afterNative(); }
  const el = s.a.el, empty = !text(el); let last = el;
  for (const b of blocks) { const n = mk(b.t, b.x); insertAfter(last, n); markBlock(n); last = n; }
  if (empty) drop(el);
  caretEnd(last); done();
  toast(plural(blocks.length, 'line') + ' pasted and formatted.');
});
