/* ---------- index, page guides, counts ---------- */
let L = {pages: [[]], first: [], labels: ['']}, refT = 0, ixHTML = '', activeIdx = -2, WORDS = 0;
function schedule() { clearTimeout(refT); refT = setTimeout(refresh, 160); }

function parseHeading(x) {
  const U = clean(x).trim().toUpperCase();
  const m = U.match(/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)(?:\s+|$)/);
  let rest = m ? U.slice(m[0].length) : U, time = '';
  const d = rest.lastIndexOf(' - ');
  if (d >= 0) {
    const tail = rest.slice(d + 3).trim();
    if (/\b(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|LATER|CONTINUOUS|AFTERNOON|SUNSET|SUNRISE|NOON|MIDNIGHT)\b/.test(tail)) { time = tail; rest = rest.slice(0, d); }
  }
  const p = m ? m[1].replace(/\./g, '') : '';
  return {
    ie: !p ? '' : p.indexOf('/') > 0 ? 'Int/Ext' : p === 'INT' ? 'Int' : p === 'EXT' ? 'Ext' : 'Est',
    loc: rest.trim(), time,
    night: /NIGHT|EVENING|DUSK|MIDNIGHT/.test(time), day: /DAY|MORNING|DAWN|AFTERNOON|NOON|SUNRISE|SUNSET/.test(time)
  };
}

function refresh() {
  clearTimeout(refT);
  const b = H.stack[H.i].b, kids = root.children, Fm = F[P.format], film = P.format === 'film';
  L = paginate(b, P.format);
  const rows = [], stats = new Map(P.cast.map(c => [c.id, {lines: 0, mentions: 0, scenes: new Set()}]));
  const unknown = new Map(), cues = new Map(), locs = new Set();
  let cur = null, n = 0, words = 0, lastPg = 1, sceneCount = 0;
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i], t = el.dataset.t, d = Fm.types[t] || {}, x = b[i] ? b[i].x : '';
    const pg = L.first[i], mark = pg > lastPg; if (pg > lastPg) lastPg = pg;
    if (!!el._pg !== mark) { el._pg = mark; el.classList.toggle('pg', mark); }
    el._pn = mark ? pg : 0;
    if (d.ix === 'group') { rows.push({kind: 'grp', el, x}); cur = null; n = 0; }
    else if (d.ix === 'scene') {
      cur = {kind: 'scene', el, x, n: ++n, page: pg || lastPg, cast: new Set(), snip: '', idx: rows.length}; rows.push(cur); sceneCount++;
      if (film) { const h = parseHeading(x); if (h.loc) locs.add(h.loc); }
    }
    else if (d.ix === 'sub') rows.push({kind: 'sub', el, x});
    else if (t === 'setting' && cur && !cur.snip) cur.snip = x;
    el._sc = cur ? cur.idx : -1;
    if (t !== 'note' && x) words += (x.match(/\S+/g) || []).length;
    if (t === 'character') {
      const nm = cueName(x); if (!nm) continue;
      cues.set(nm, (cues.get(nm) || 0) + 1);
      const s = el._cid && stats.get(el._cid);
      if (s) { s.lines++; if (cur) { s.scenes.add(cur.idx); cur.cast.add(el._cid); } }
      else unknown.set(nm, (unknown.get(nm) || 0) + 1);
    } else if (el._hl && t !== 'note') {
      for (const h of el._hl) { const s = stats.get(h[0]); if (s) { s.mentions++; if (cur) { s.scenes.add(cur.idx); cur.cast.add(h[0]); } } }
    }
  }
  const byCount = m => Array.from(m.entries()).sort((a, b2) => b2[1] - a[1]).map(e => e[0]);
  IX = {rows, locs: Array.from(locs), cues: byCount(cues)}; STATS = stats; WORDS = words;

  let h = '';
  rows.forEach((r, i) => {
    if (r.kind === 'grp') h += `<li class="grp">${esc(r.x || 'Act')}</li>`;
    else if (r.kind === 'sub') h += `<li class="sub"><button type="button" data-i="${i}"><span></span><span>${esc(titleCase(r.x) || 'Subheading')}</span></button></li>`;
    else {
      const dots = Array.from(r.cast).slice(0, 8).map(id => `<i style="--c:${esc(M.color.get(id))}"></i>`).join('');
      let main, meta = '';
      if (film) {
        const p = parseHeading(r.x);
        main = titleCase(p.loc) || 'Untitled scene';
        meta = (p.ie ? `<span>${p.ie}</span>` : '') + (p.time ? (p.night || p.day ? `<i class="dn${p.night ? ' night' : ''}"></i>` : '') + `<span>${esc(titleCase(p.time))}</span>` : '');
      } else { main = r.x || 'Untitled scene'; meta = r.snip ? `<span class="snip">${esc(r.snip)}</span>` : ''; }
      const pg = film ? r.page : (L.labels[r.page - 1] || r.page);
      h += `<li><button type="button" data-i="${i}"><span class="n">${r.n}</span><span class="loc">${esc(main)}</span><span class="pg" title="Page ${esc(pg)}">${esc(pg)}</span>` +
        (meta || dots ? `<span class="meta">${meta}${dots ? `<span class="dots">${dots}</span>` : ''}</span>` : '') + '</button></li>';
    }
  });
  if (!sceneCount) h += `<li class="none">${film ? 'Scene headings appear here as you add them. Right-click in the script and choose Scene heading.' : 'Acts and scenes appear here as you add them.'}</li>`;
  if (h !== ixHTML) { $('#ix').innerHTML = ixHTML = h; activeIdx = -2; }
  $('#scene-n').textContent = sceneCount || '';
  $('#cast-n').textContent = P.cast.length || '';

  $$('#cast-rows .cast-row').forEach(row => {
    const s = stats.get(row.dataset.id), out = row.querySelector('.stat'); if (!s || !out) return;
    const bits = [];
    if (s.lines) bits.push(s.lines + (s.lines === 1 ? ' speech' : ' speeches'));
    if (s.mentions) bits.push(plural(s.mentions, 'mention'));
    if (s.scenes.size) bits.push(plural(s.scenes.size, 'scene'));
    out.textContent = bits.length ? bits.join(', ') : 'Not in the script yet';
  });
  const strangers = byCount(unknown).slice(0, 6);
  let chips = P.cast.map(c => { const s = stats.get(c.id); return `<button type="button" class="chip" data-id="${c.id}" style="--c:${esc(c.color)}" title="Find ${esc(c.name)} in the script"><i></i>${esc(c.name || 'Unnamed')}<b>${s.lines + s.mentions}</b></button>`; }).join('');
  chips += strangers.slice(0, 3).map(nm => `<button type="button" class="chip ghost" data-name="${esc(titleCase(nm))}" title="Add ${esc(nm)} to the cast">Add ${esc(titleCase(nm))}</button>`).join('');
  $('#chips').innerHTML = chips || '<button type="button" class="chip ghost" data-go="cast">Add your first character</button>';
  const sug = $('#cast-suggest');
  sug.hidden = !strangers.length;
  if (strangers.length) sug.innerHTML = '<span>Speaking in the script, not in the cast yet:</span>' + strangers.map(nm => `<button type="button" class="chip ghost" data-name="${esc(titleCase(nm))}">Add ${esc(titleCase(nm))}</button>`).join('');
  placeTicks(); status();
}

function placeTicks() {
  if (!P) return;
  let h = '';
  for (const el of root.children) if (el._pn) {
    const mt = parseFloat(getComputedStyle(el).paddingTop) || 0;
    h += `<span style="top:${(el.offsetTop + mt / 2).toFixed(1)}px">${esc(P.format === 'film' ? el._pn : (L.labels[el._pn - 1] || el._pn))}</span>`;
  }
  $('#ticks').innerHTML = h;
}

function placeActive() {
  let idx = -1; const s = sel();
  if (s && document.activeElement === root) { for (let p = s.a.el; p; p = p.previousElementSibling) if (p._sc != null) { idx = p._sc; break; } }
  else {
    const line = stage.getBoundingClientRect().top + 140;
    for (const r of IX.rows) { if (r.kind !== 'scene' || !r.el.isConnected) continue; if (r.el.getBoundingClientRect().top <= line) idx = r.idx; else break; }
  }
  if (idx === activeIdx) return;
  activeIdx = idx;
  $$('#ix button[data-i]').forEach(b => {
    const on = +b.dataset.i === idx; b.setAttribute('aria-current', String(on));
    if (on) { const w = b.closest('.ix-wrap'), br = b.getBoundingClientRect(), wr = w.getBoundingClientRect(); if (br.top < wr.top) w.scrollTop -= wr.top - br.top + 8; else if (br.bottom > wr.bottom) w.scrollTop += br.bottom - wr.bottom + 8; }
  });
}

function status() {
  if (!P) return;
  const el = curEl(); if (!el) return;
  const film = P.format === 'film', t = el.dataset.t, d = T()[t] || T()[base()], x = text(el), lab = k => (T()[k] || T()[base()]).label.toLowerCase();
  $('#el-name').textContent = $('#st-el').textContent = d.label;
  $('#el-g').style.cssText = $('#st-g').style.cssText = glyph(d);
  $('#st-next').textContent = x
    ? `Enter adds ${lab(d.enter)}. Tab adds ${film && t === 'scene' ? 'the time of day' : lab(d.tabNew || d.enter)}.`
    : t === base() ? `Enter opens the element menu. Tab makes this a ${lab(d.tab)} line.` : `Tab makes this a ${lab(d.tab || base())} line. Enter makes it ${lab(base())}.`;
  let i = Array.prototype.indexOf.call(root.children, el), pg = 0;
  for (; i >= 0 && !pg; i--) pg = L.first[i] || 0;
  const total = L.pages.length, last = L.pages[total - 1] || [];
  $('#st-page').textContent = `Page ${pg || 1} of ${total}`;
  const mins = total - 1 + last.length / LPP;
  $('#st-time').textContent = film ? (mins < 1 ? 'Under a minute' : 'About ' + Math.round(mins) + ' min') : '';
  $('#st-words').textContent = WORDS.toLocaleString() + (WORDS === 1 ? ' word' : ' words');
  $('#b-undo').disabled = H.i <= 0; $('#b-redo').disabled = H.i >= H.stack.length - 1;
  placeActive();
}
let statusQ = 0;
document.addEventListener('selectionchange', () => {
  if (AC) { const s = sel(); if (!s || !s.collapsed || s.a.el !== AC.el || s.a.off !== text(AC.el).length) hideAC(); }
  if (!statusQ) statusQ = requestAnimationFrame(() => { statusQ = 0; status(); });
});
root.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== root) hideAC(); }, 120));
