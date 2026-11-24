/* ---------- small pieces ---------- */
let toastT = 0;
function toast(msg, action, color) {
  const t = $('#toast');
  t.innerHTML = (color ? `<i style="--c:${esc(color)}"></i>` : '') + `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  t.hidden = false;
  if (action) t.querySelector('button').onclick = () => { t.hidden = true; action.run(); };
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, action ? 9000 : 3800);
}
function caretAt(x, y) {
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); return p ? {node: p.offsetNode, offset: p.offset} : null; }
  if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); return r ? {node: r.startContainer, offset: r.startOffset} : null; }
  return null;
}
function cidAt(el, off) {
  if (off >= 0 && el._hl) for (const h of el._hl) if (M.color.has(h[0]) && off >= h[2] && off <= h[3]) return h[0];
  return el.dataset.t === 'character' ? (el._cid || null) : null;
}

/* ---------- menus ---------- */
const menu = $('#menu');
let MENU = null, menuShut = {owner: '', at: 0};
function openMenu(html, x, y, opt) {
  hideAC(); hideTip();
  menu.innerHTML = html; menu.hidden = false; menu.style.left = menu.style.top = '0px';
  menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + 'px';
  MENU = Object.assign({i: -1}, opt);
}
function closeMenu() {
  if (!MENU) return;
  menuShut = {owner: MENU.owner || '', at: performance.now()};
  menu.hidden = true; menu.innerHTML = ''; MENU = null;
}
const justShut = owner => menuShut.owner === owner && performance.now() - menuShut.at < 300;
menu.addEventListener('mousedown', e => { if (e.target.type !== 'color') e.preventDefault(); });
menu.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled && MENU && MENU.pick) MENU.pick(b); });
document.addEventListener('mousedown', e => { if (MENU && !menu.contains(e.target)) closeMenu(); }, true);
window.addEventListener('blur', closeMenu);
document.addEventListener('keydown', e => {
  if (!MENU) return;
  const items = $$('[role="menuitem"]:not(:disabled)', menu), k = e.key, stop = () => { e.preventDefault(); e.stopPropagation(); };
  const light = () => items.forEach((b, i) => b.classList.toggle('on', i === MENU.i));
  if (k === 'Escape') { stop(); return closeMenu(); }
  if ((k === 'ArrowDown' || k === 'ArrowUp') && items.length) {
    stop(); const n = items.length, d = k === 'ArrowDown';
    MENU.i = MENU.i < 0 ? (d ? 0 : n - 1) : (MENU.i + (d ? 1 : n - 1)) % n; light(); items[MENU.i].scrollIntoView({block: 'nearest'}); return;
  }
  if (k === 'Enter') { stop(); const b = items[MENU.i]; return b ? MENU.pick(b) : closeMenu(); }
  if (MENU.kind === 'el' && (k === 'ArrowLeft' || k === 'ArrowRight')) { stop(); return MENU.pick($(`[data-mode="${MENU.mode === 'add' ? 'change' : 'add'}"]`, menu)); }
  if (MENU.kind === 'el' && /^[1-9]$/.test(k) && !e.metaKey && !e.ctrlKey && !e.altKey) { const b = $$('[data-t]', menu)[+k - 1]; if (b) { stop(); return MENU.pick(b); } }
  if (k.length === 1 && !e.metaKey && !e.ctrlKey) closeMenu();
}, true);

function elMenu(x, y, el, mode) {
  const Fm = F[P.format], t = el.dataset.t;
  mode = mode || (text(el) ? 'add' : 'change');
  let h = `<div class="seg" role="group" aria-label="What choosing does"><button type="button" data-mode="add" aria-pressed="${mode === 'add'}">Add below</button><button type="button" data-mode="change" aria-pressed="${mode === 'change'}">Change this line</button></div>`;
  for (const k of Fm.order) { const d = Fm.types[k]; h += `<button type="button" role="menuitem" data-t="${k}"${k === t ? ' class="cur"' : ''}><i class="g" style="${glyph(d)}"></i><span class="lab">${d.label}</span><span class="hint">${d.hint}</span></button>`; }
  const s = sel(), x0 = text(el); let ex = '';
  const tagItem = (name, label) => `<button type="button" role="menuitem" data-act="tag" data-v="${esc(name)}"><span class="lab">${label}</span></button>`;
  if (s && !s.collapsed && !s.multi) { const pick = x0.slice(s.a.off, s.b.off).trim(); if (pick && pick.length <= 40 && !M.by.has(pick.toUpperCase())) ex += tagItem(pick, `Tag “${esc(pick)}” as a character`); }
  if (t === 'character' && x0) { const n = cueName(x0); if (n && !M.by.has(n)) ex += tagItem(titleCase(n), `Add ${esc(n)} to the cast`); }
  const cid = cidAt(el, s && s.collapsed ? s.a.off : -1), who = cid && P.cast.find(c => c.id === cid);
  if (who) ex += `<button type="button" role="menuitem" data-act="goto" data-v="${who.id}"><i class="dot" style="--c:${esc(who.color)}"></i><span class="lab">${esc(who.name)} on the cast page</span></button>`;
  if (ex) h += '<hr>' + ex;
  h += '<p class="foot">Shift + right-click opens the browser menu, with spelling.</p>';
  openMenu(h, x, y, {kind: 'el', owner: 'el', mode, pick(b) {
    if (b.dataset.mode) return elMenu(parseFloat(menu.style.left), parseFloat(menu.style.top), el, b.dataset.mode);
    const d = b.dataset; closeMenu();
    if (d.t) changeType(el, d.t, mode);
    else if (d.act === 'tag') addChar(d.v, '');
    else if (d.act === 'goto') { const row = $(`.cast-row[data-id="${d.v}"]`); if (row) { jump($('#p-cast'), false); row.querySelector('.ds').focus({preventScroll: true}); } }
  }});
}
function elMenuAtCaret(el) {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  elMenu(r.left + parseFloat(cs.paddingLeft), r.bottom + 4, el, 'change');
}
root.addEventListener('contextmenu', e => {
  if (e.shiftKey) return;
  const el = blockOf(e.target) || (e.target === root ? root.lastElementChild : null); if (!el) return;
  e.preventDefault();
  const s = getSelection(); let inside = false;
  if (s.rangeCount && !s.isCollapsed && root.contains(s.anchorNode)) for (const r of s.getRangeAt(0).getClientRects()) if (e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2) inside = true;
  if (!inside) { const p = caretAt(e.clientX, e.clientY); if (p && el.contains(p.node) && p.node.nodeType === 3) caret(el, p.offset); else caretEnd(el); }
  elMenu(e.clientX + 2, e.clientY + 2, el);
});
let CUR = null;
const curEl = () => { const s = sel(); if (s) CUR = s.a.el; return CUR && CUR.isConnected ? CUR : (CUR = root.lastElementChild); };
$('#b-el').addEventListener('click', () => { if (justShut('elbtn')) return; const el = curEl(), r = $('#b-el').getBoundingClientRect(); if (!sel()) caretEnd(el); elMenu(r.left, r.bottom + 6, el, 'change'); MENU.owner = 'elbtn'; });
$$('.keep').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
$('#b-undo').addEventListener('click', undo);
$('#b-redo').addEventListener('click', redo);
$('#b-more').addEventListener('click', () => {
  if (justShut('more')) return;
  const r = $('#b-more').getBoundingClientRect(), other = P.format === 'film' ? 'stage' : 'film';
  const it = (a, l, hint) => `<button type="button" role="menuitem" data-act="${a}"><span class="lab">${l}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</button>`;
  openMenu(it('new', 'New script') + it('open', 'Open', 'Text, Word, Pages or project file') + it('save', 'Save a project file') + '<hr>' + it('fmt', 'Switch to ' + F[other].name.toLowerCase() + ' format') + it('keys', 'Shortcuts') + it('ver', 'Version history', 'v' + VERSION),
    r.right - 250, r.bottom + 6, {kind: 'more', owner: 'more', pick(b) {
      const a = b.dataset.act; closeMenu();
      if (a === 'new') $('#dlg-new').showModal();
      else if (a === 'open') $('#file').click();
      else if (a === 'save') saveProjectFile();
      else if (a === 'fmt') switchFormat(other);
      else if (a === 'keys') $('#dlg-keys').showModal();
      else if (a === 'ver') showVersions();
    }});
});
$('#fmt').addEventListener('click', e => { const b = e.target.closest('button'); if (b) switchFormat(b.dataset.f); });
$('#keys-close').addEventListener('click', () => $('#dlg-keys').close());
function showVersions() {
  const day = d => { const m = String(d).match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}) : d; };
  $('#ver-list').innerHTML = LOG.map((v, i) => `<section><h3>${esc(v.v)}${i ? '' : '<em>this version</em>'}<span>${esc(day(v.date))}</span></h3><ul>${v.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('') || '<p>No history is recorded in this copy.</p>';
  $('#dlg-ver').showModal();
}
$('#b-ver').textContent = 'v' + VERSION;
$('#b-ver').addEventListener('click', showVersions);
$('#ver-close').addEventListener('click', () => $('#dlg-ver').close());
$$('.mod-key').forEach(n => { n.textContent = isMac ? 'Cmd' : 'Ctrl'; });
$$('.alt-key').forEach(n => { n.textContent = isMac ? 'Option' : 'Alt'; });

/* ---------- completion: names, places, times, transitions ---------- */
const ac = $('#ac');
let AC = null, IX = {rows: [], locs: [], cues: []};
function hideAC() { if (AC) { AC = null; ac.hidden = true; } }
function suggest(el, x) {
  const t = el.dataset.t, U = x.toUpperCase(), film = P.format === 'film', out = [];
  const opt = (value, go, label, pre) => out.push({value, go, label: label || value, pre});
  if (film && t === 'scene') {
    const m = U.match(/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)\s+/);
    if (!m) { ['INT. ', 'EXT. ', 'INT./EXT. '].forEach(p => { if (p.indexOf(U) === 0 && p.trim() !== U.trim()) opt(p, false, p.trim()); }); return out; }
    const rest = U.slice(m[0].length), dash = rest.lastIndexOf(' - ');
    if (dash >= 0) { const part = rest.slice(dash + 3); if (!TIMES.includes(part)) TIMES.forEach(tm => { if (tm.indexOf(part) === 0) opt(x.slice(0, x.length - part.length) + tm, true, tm); }); if (out.length) return out; }
    IX.locs.forEach(l => { if (l !== rest && l.indexOf(rest) === 0) opt(x.slice(0, m[0].length) + l + ' - ', false, l, false); });
    return out.slice(0, 7);
  }
  if (t === 'character') {
    const par = U.lastIndexOf('(');
    if (par >= 0 && U.indexOf(')', par) < 0) { const part = U.slice(par); (film ? ['(V.O.)', '(O.S.)', "(CONT'D)"] : ['(CONT.)']).forEach(xn => { if (xn.indexOf(part) === 0) opt(x.slice(0, par) + (film ? xn : '(cont.)'), true, film ? xn : '(cont.)'); }); return out; }
    if (par >= 0 || (U && (M.by.has(U) || IX.cues.includes(U)))) return out;
    const names = [], seen = new Set(), push = n => { if (n && !seen.has(n)) { seen.add(n); names.push(n); } };
    let prev = '', alt = '', broke = false;                       // who has been talking in this scene
    for (let p = el.previousElementSibling; p; p = p.previousElementSibling) {
      const pt = p.dataset.t;
      if ((T()[pt] || {}).ix === 'scene') break;
      if (pt === 'character') { const n = cueName(text(p)); if (!n) continue; if (!prev) prev = n; else if (n !== prev) { alt = n; break; } }
      else if (!prev && pt !== 'dialogue' && pt !== 'paren' && pt !== 'note') broke = true;
    }
    if (!U) { push(alt); if (prev && broke) opt(prev + (film ? " (CONT'D)" : ' (cont.)'), true); }
    IX.cues.forEach(push); P.cast.forEach(c => push(clean(c.name).trim().toUpperCase()));
    names.forEach(n => { if (n !== U && n.indexOf(U) === 0 && !(n === prev && !U)) opt(n, true); });
    if (!U && alt) { const i = out.findIndex(o => o.value === alt); if (i > 0) out.unshift(out.splice(i, 1)[0]); }
    return out.slice(0, 7);
  }
  if (film && t === 'transition') TRANS.forEach(tr => { if (tr !== U && tr.indexOf(U) === 0) opt(tr, true); });
  return out;
}
function showAC() {
  hideAC();
  const s = sel(); if (!s || !s.collapsed || MENU) return;
  const el = s.a.el, x = text(el); if (s.a.off !== x.length) return;
  const items = suggest(el, x); if (!items.length) return;
  AC = {el, items, i: x && items[0].pre !== false ? 0 : -1};
  ac.innerHTML = items.map((it, i) => `<div data-i="${i}"${i === AC.i ? ' class="on"' : ''}>${esc(it.label)}</div>`).join('');
  ac.hidden = false;
  let r = getSelection().getRangeAt(0).getBoundingClientRect();
  if (!r.height) { const b = el.getBoundingClientRect(), cs = getComputedStyle(el); r = {left: b.left + parseFloat(cs.paddingLeft), bottom: b.bottom, top: b.bottom - 16}; }
  ac.style.left = Math.max(8, Math.min(r.left, innerWidth - ac.offsetWidth - 8)) + 'px';
  const below = r.bottom + 6;
  ac.style.top = (below + ac.offsetHeight > innerHeight - 8 ? r.top - ac.offsetHeight - 6 : below) + 'px';
}
function moveAC(d) { const n = AC.items.length; AC.i = AC.i < 0 ? (d > 0 ? 0 : n - 1) : (AC.i + d + n) % n; $$('div', ac).forEach((x, i) => x.classList.toggle('on', i === AC.i)); }
function acceptAC(viaEnter, i) {
  const it = AC.items[i == null ? AC.i : i], el = AC.el; hideAC();
  setText(el, it.value); markBlock(el); caretEnd(el);
  if (viaEnter && it.go) { tagSpeeches(); return doEnter(false); }
  done(); showAC();
}
ac.addEventListener('mousedown', e => { e.preventDefault(); const d = e.target.closest('div[data-i]'); if (d && AC) acceptAC(false, +d.dataset.i); });

/* ---------- who is this? hover a tagged name ---------- */
const tip = $('#tip'); let tipT = 0, tipFor = '';
function hideTip() { clearTimeout(tipT); tipFor = ''; tip.hidden = true; }
root.addEventListener('mousemove', e => {
  const el = blockOf(e.target);
  if (MENU || e.buttons || !el || !el._hl || !app.classList.contains('tags-on')) return hideTip();
  let hit = null;
  for (const h of el._hl) {
    if (!M.color.has(h[0])) continue;
    const r = document.createRange();
    try { r.setStart(el.firstChild, h[2]); r.setEnd(el.firstChild, h[3]); } catch (err) { continue; }
    for (const q of r.getClientRects()) if (e.clientX >= q.left && e.clientX <= q.right && e.clientY >= q.top && e.clientY <= q.bottom) hit = {id: h[0], q};
    if (hit) break;
  }
  if (!hit) return hideTip();
  const key = hit.id + ':' + Math.round(hit.q.left) + ':' + Math.round(hit.q.top);
  if (key === tipFor) return;
  hideTip(); tipFor = key;
  tipT = setTimeout(() => {
    const c = P.cast.find(c => c.id === hit.id); if (!c) return;
    tip.innerHTML = `<i style="--c:${esc(c.color)}"></i><span><b>${esc(c.name)}</b>${c.desc ? ' ' + esc(c.desc) : ''}</span>`;
    tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(hit.q.left, innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = (hit.q.top - tip.offsetHeight - 6 < 8 ? hit.q.bottom + 6 : hit.q.top - tip.offsetHeight - 6) + 'px';
  }, 320);
});
root.addEventListener('mouseleave', hideTip);
root.addEventListener('keydown', hideTip);
let scrollQ = 0;
stage.addEventListener('scroll', () => { hideTip(); if (!scrollQ) scrollQ = requestAnimationFrame(() => { scrollQ = 0; $('#dock').classList.toggle('stuck', stage.scrollTop > 6); if (AC) showAC(); placeActive(); }); }, {passive: true});
['wheel', 'touchmove'].forEach(ev => stage.addEventListener(ev, () => { if (MENU) closeMenu(); }, {passive: true}));

/* ---------- title page ---------- */
const TP = {title: '#tp-title', desc: '#tp-desc', credit: '#tp-credit', author: '#tp-author', based: '#tp-based', contact: '#tp-contact', draft: '#tp-draft'};
function syncTitle() {
  const t = clean(P.title.title).trim();
  $('#doc-name').textContent = t || 'Untitled script';
  $('.tp-rule').textContent = '_'.repeat((t || 'Title').length);
}
function fillTitle() {
  for (const k in TP) $(TP[k]).value = P.title[k] || '';
  $('#tp-credit').placeholder = P.format === 'film' ? 'Written by' : 'by';
  $('#cm-scene').value = P.castMeta.scene || ''; $('#cm-time').value = P.castMeta.time || '';
  syncTitle();
}
for (const k in TP) $(TP[k]).addEventListener('input', e => { P.title[k] = e.target.value; syncTitle(); touch(); });
$('#cm-scene').addEventListener('input', e => { P.castMeta.scene = e.target.value; touch(); });
$('#cm-time').addEventListener('input', e => { P.castMeta.time = e.target.value; touch(); });

/* ---------- cast page ---------- */
let STATS = new Map();
const fitName = i => { i.style.width = Math.max(3, i.value.length + 0.5) + 'ch'; };
const grow = a => { a.style.height = '1.2em'; a.style.height = a.scrollHeight + 'px'; };
function renderCast() {
  $('#cast-rows').innerHTML = P.cast.map(c => `<div class="cast-row" data-id="${c.id}">
    <button type="button" class="sw" style="--c:${esc(c.color)}" aria-label="Change the color for ${esc(c.name)}" title="Change color"></button>
    <div class="who"><input class="nm" id="nm-${c.id}" value="${esc(c.name)}" aria-label="Character name" spellcheck="false" autocomplete="off"><span>:</span></div>
    <textarea class="ds" id="ds-${c.id}" rows="1" aria-label="Description of ${esc(c.name)}" placeholder="Age, role, a trait or two">${esc(c.desc)}</textarea>
    <button type="button" class="x" aria-label="Remove ${esc(c.name)}" title="Remove from cast">×</button>
    <div class="aka"><label>Also called <input class="al" id="al-${c.id}" value="${esc(c.aliases)}" placeholder="other names, separated by commas" spellcheck="false" autocomplete="off"></label><span class="stat"></span></div>
  </div>`).join('');
  $$('#cast-rows .nm').forEach(fitName); $$('#cast-rows .ds').forEach(grow);
  $('#next-sw').style.setProperty('--c', nextColor());
  $('#cast-n').textContent = P.cast.length || '';
}
function addChar(name, desc) {
  name = clean(name).trim(); if (!name) return null;
  if (M.by.has(name.toUpperCase())) { toast(name + ' is already in the cast.'); return null; }
  const c = {id: rid(), name, desc: clean(desc).trim(), aliases: guessAlias(name), color: nextColor()};
  P.cast.push(c); rebuildTags(true); renderCast(); refresh(); touch();
  const st = STATS.get(c.id), n = st ? st.lines + st.mentions : 0;
  toast(n ? `${name} is now tagged in ${plural(n, 'place')}.` : `${name} is in the cast. Their color appears wherever you write the name.`, null, c.color);
  return c;
}
function removeChar(id) {
  const i = P.cast.findIndex(c => c.id === id); if (i < 0) return;
  const c = P.cast.splice(i, 1)[0];
  const again = () => { rebuildTags(true); renderCast(); refresh(); touch(); };
  again();
  toast((c.name || 'Character') + ' removed from the cast.', {label: 'Undo', run() { P.cast.splice(Math.min(i, P.cast.length), 0, c); again(); }});
}
$('#cast-rows').addEventListener('input', e => {
  const row = e.target.closest('.cast-row'), c = row && P.cast.find(c => c.id === row.dataset.id); if (!c) return;
  const k = e.target.classList;
  if (k.contains('nm')) { c.name = e.target.value; fitName(e.target); }
  else if (k.contains('ds')) { c.desc = clean(e.target.value); grow(e.target); }
  else if (k.contains('al')) c.aliases = e.target.value;
  retagSoon(); touch();
});
$('#cast-rows').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#add-name').focus(); } });
$('#cast-rows').addEventListener('click', e => {
  const row = e.target.closest('.cast-row'), c = row && P.cast.find(c => c.id === row.dataset.id); if (!c) return;
  if (e.target.classList.contains('x')) return removeChar(c.id);
  if (!e.target.classList.contains('sw') || justShut('pal' + c.id)) return;
  const used = new Map(P.cast.filter(o => o.id !== c.id).map(o => [String(o.color).toLowerCase(), o.name])), r = e.target.getBoundingClientRect();
  const h = '<div class="pal">' + PALETTE.map(p => `<button type="button" data-color="${p}" style="--c:${p}" aria-label="Color ${p}"${used.has(p) ? ` disabled title="Used by ${esc(used.get(p))}"` : ''}${String(c.color).toLowerCase() === p ? ' class="on"' : ''}></button>`).join('') +
    `</div><label class="pal-custom">Any other color <input type="color" id="pal-any" value="${esc(c.color)}"></label>`;
  const set = col => { c.color = col; e.target.style.setProperty('--c', col); rebuildTags(true); $('#next-sw').style.setProperty('--c', nextColor()); refresh(); touch(); };
  openMenu(h, r.left, r.bottom + 6, {kind: 'pal', owner: 'pal' + c.id, pick(b) { if (b.dataset.color) { closeMenu(); set(b.dataset.color); } }});
  $('#pal-any').addEventListener('input', ev => set(ev.target.value));
});
$('#cast-add').addEventListener('submit', e => {
  e.preventDefault();
  const n = $('#add-name'), d = $('#add-desc');
  if (!n.value.trim()) return n.focus();
  if (addChar(n.value, d.value)) { n.value = ''; d.value = ''; n.focus(); }
});
$('#cast-suggest').addEventListener('click', e => { const b = e.target.closest('button[data-name]'); if (b) addChar(b.dataset.name, ''); });

/* ---------- moving around ---------- */
function jump(el, focus) {
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), mt = parseFloat(getComputedStyle(el).paddingTop) || 0;
  const top = stage.scrollTop + r.top - s.top + (el.classList.contains('el') ? mt : 0) - dockH() - 14;
  stage.scrollTo({top, behavior: reduced ? 'auto' : 'smooth'});
  if (focus && el.classList.contains('el')) {
    const rg = document.createRange(), t = el.firstChild;
    if (t && t.nodeType === 3) rg.setStart(t, t.length); else rg.setStart(el, 0);
    rg.collapse(true); const g = getSelection(); g.removeAllRanges(); g.addRange(rg); root.focus({preventScroll: true});
  }
  app.classList.remove('drawer');
}
$('.docnav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) jump($('#p-' + b.dataset.go), false); });
$('#b-title').addEventListener('click', () => { jump($('#p-title'), false); $('#tp-title').focus({preventScroll: true}); });
$('#ix').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); const sc = b && IX.rows[+b.dataset.i]; if (sc && sc.el.isConnected) jump(sc.el, true); });
$('#b-scene').addEventListener('click', () => {
  const n = mk('scene', ''); root.append(n); prefill(n); markBlock(n); caretEnd(n); done(); showAC(); app.classList.remove('drawer');
});
const chipAt = new Map();
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.go) { jump($('#p-cast'), false); return $('#add-name').focus({preventScroll: true}); }
  if (b.dataset.name) return addChar(b.dataset.name, '');
  const id = b.dataset.id, hits = [];
  for (const el of root.children) if (el._hl) for (const h of el._hl) if (h[0] === id) hits.push([el, h[2], h[3]]);
  if (!hits.length) return toast('That name is not in the script yet.');
  const i = ((chipAt.get(id) || 0)) % hits.length; chipAt.set(id, i + 1);
  selectIn(hits[i][0], hits[i][1], hits[i][2]);
  const r = hits[i][0].getBoundingClientRect(), s = stage.getBoundingClientRect();
  if (r.top < s.top + 60 || r.bottom > s.bottom - 120) stage.scrollTop += r.top - s.top - s.height / 3;
  app.classList.remove('drawer');
});
$('#b-side').addEventListener('click', () => {
  if (matchMedia('(max-width:900px)').matches) app.classList.toggle('drawer');
  else { ui.side = !ui.side; app.classList.toggle('no-side', !ui.side); store.set('cuemark.ui', ui); applyZoom(); }
});
$('#tags').addEventListener('change', e => { ui.tags = e.target.checked; app.classList.toggle('tags-on', ui.tags); store.set('cuemark.ui', ui); });

/* ---------- page size ---------- */
const ZOOMS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6];
function applyZoom() {
  const fit = (stage.clientWidth - 34) / 51;                      // a page is 85 characters, which is 51em in Courier
  const fs = ui.zoom ? 16 * ui.zoom : Math.max(9, Math.min(17, fit));
  stage.style.setProperty('--fs', fs.toFixed(2) + 'px');
  $('#z-val').textContent = ui.zoom ? Math.round(ui.zoom * 100) + '%' : 'Fit';
  placeTicks();
}
function stepZoom(d) {
  const now = ui.zoom || parseFloat(stage.style.getPropertyValue('--fs')) / 16;
  const next = d > 0 ? ZOOMS.find(z => z > now + 0.01) : ZOOMS.slice().reverse().find(z => z < now - 0.01);
  if (next) { ui.zoom = next; store.set('cuemark.ui', ui); applyZoom(); }
}
$('#z-in').addEventListener('click', () => stepZoom(1));
$('#z-out').addEventListener('click', () => stepZoom(-1));
$('#z-val').addEventListener('click', () => { ui.zoom = 0; store.set('cuemark.ui', ui); applyZoom(); });
$('#z-val').title = 'Fit the page to the window';
$('#z-val').style.cursor = 'pointer';
window.addEventListener('resize', () => { closeMenu(); hideAC(); applyZoom(); });
