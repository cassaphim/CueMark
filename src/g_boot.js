/* ---------- saving ---------- */
const KEY = 'cuemark.project.v1';
const cloud = {on: false, col: null, parts: [], busy: false, due: false, last: 0, t: 0};
let saveT = 0, saveState = '';
function setSave(st) {
  saveState = st;
  const el = $('#st-save');
  el.textContent = {idle: 'Example script', saving: 'Saving', cloud: 'Saved', local: 'Saved on this device', full: 'Saved on this device only', fail: 'Not saved'}[st] || '';
  el.title = {cloud: 'Saved to your Claude account and to this browser.', local: 'Saved in this browser. Save a project file to keep a copy elsewhere.', full: 'Your online space for this page is full. The script is saved in this browser.', fail: 'This browser would not store the script. Save a project file to keep your work.'}[st] || '';
}
function touch() {
  if (!P) return;
  P.updatedAt = Date.now(); P.sample = false;
  if (saveState !== 'saving') setSave('saving');
  clearTimeout(saveT); saveT = setTimeout(saveLocal, 500);
}
function saveLocal() {
  clearTimeout(saveT);
  if (!P || P.sample) return;
  const ok = store.set(KEY, projectJSON());
  if (cloud.on) cloudLater(); else setSave(ok ? 'local' : 'fail');
}
function cloudLater(ms) {
  if (!cloud.on || !P || P.sample) return;
  clearTimeout(cloud.t);
  cloud.t = setTimeout(cloudSave, Math.max(ms == null ? 3500 : ms, 12000 - (Date.now() - cloud.last), 0));
}
const within = (p, ms) => Promise.race([p, new Promise((res, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function cloudSave() {
  if (!cloud.on) return;
  if (cloud.busy) { cloud.due = true; return; }
  cloud.busy = true;
  try {
    const json = JSON.stringify(projectJSON()), parts = [];
    for (let i = 0; i < json.length;) {                              // pieces small enough for one stored document
      let e = Math.min(json.length, i + 60000); const c = json.charCodeAt(e - 1);
      if (e < json.length && c >= 0xD800 && c <= 0xDBFF) e--;
      parts.push(json.slice(i, e)); i = e;
    }
    for (let i = 0; i < parts.length; i++) if (parts[i] !== cloud.parts[i]) await cloud.col.doc('script-part-' + i).set({json: parts[i]});
    await cloud.col.doc('script').set({v: 1, parts: parts.length, updatedAt: P.updatedAt});
    for (let i = parts.length; i < cloud.parts.length; i++) { try { await cloud.col.doc('script-part-' + i).delete(); } catch (e) { /* a stale piece is harmless */ } }
    cloud.parts = parts; cloud.last = Date.now(); setSave('cloud');
  } catch (e) {
    const code = e && e.code;
    if (code === 'quota_exceeded') setSave('full'); else setSave('local');
    if (code && code !== 'unavailable' && code !== 'resource_exhausted') cloud.on = false;
  }
  cloud.busy = false;
  if (cloud.due) { cloud.due = false; cloudLater(); }
}
let bootStamp = 0, cloudTried = false;
async function initCloud() {
  if (!hosted() || cloudTried) return;
  cloudTried = true;
  try {
    const [db, user] = await Promise.all([cap('db'), cap('user')]);
    if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    cloud.col = db.collection('data/users/' + id);
    const meta = await within(cloud.col.doc('script').get(), 10000);
    if (meta.exists) {
      const m = meta.data(), parts = [];
      for (let i = 0; i < m.parts; i++) { const d = await within(cloud.col.doc('script-part-' + i).get(), 10000); if (!d.exists) throw new Error('missing part'); parts.push(String(d.data().json || '')); }
      const remote = JSON.parse(parts.join(''));
      cloud.parts = parts; cloud.on = true;
      if (remote && Array.isArray(remote.blocks) && (remote.updatedAt || 0) > bootStamp) { remote.sample = false; loadProject(remote); store.set(KEY, remote); setSave('cloud'); }
      else if (!P.sample) cloudLater(0);
    } else { cloud.on = true; if (!P.sample) cloudLater(0); }
  } catch (e) { cloud.on = false; }
}
window.addEventListener('beforeunload', () => { if (P && !P.sample && saveState === 'saving') store.set(KEY, projectJSON()); });
document.addEventListener('visibilitychange', () => { if (document.hidden && P && !P.sample) { saveLocal(); if (cloud.on) cloudLater(0); } });

/* ---------- opening a project ---------- */
function loadProject(p) {
  const fmt = p.format === 'stage' ? 'stage' : 'film';
  P = {
    v: 1, format: fmt, sample: !!p.sample, updatedAt: p.updatedAt || 0,
    title: Object.assign({title: '', credit: fmt === 'film' ? 'Written by' : 'by', author: '', based: '', desc: '', contact: '', draft: ''}, p.title),
    cast: (Array.isArray(p.cast) ? p.cast : []).map(c => ({id: String(c.id || rid()).replace(/[^a-z0-9]/gi, '') || rid(), name: String(c.name || ''), desc: String(c.desc || ''), aliases: String(c.aliases || ''), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : PALETTE[0]})),
    castMeta: Object.assign({scene: '', time: ''}, p.castMeta)
  };
  applyFormat(fmt);
  buildMatchers(); tagCSS(); renderCast();
  render((Array.isArray(p.blocks) ? p.blocks : []).map(b => ({t: String(b.t || ''), x: clean(b.x)})));
  H.stack = [snap()]; H.i = 0; H.kind = ''; CUR = root.firstElementChild; chipAt.clear();
  refresh(); applyZoom(); $('#toast').hidden = true;
  setSave(P.sample ? 'idle' : cloud.on ? 'cloud' : 'local');
}
$('#new-cancel').addEventListener('click', () => $('#dlg-new').close());
$('#new-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = $('#nf-stage').checked ? 'stage' : 'film', p = $('#ns-sample').checked ? sample(f) : blank(f);
  $('#dlg-new').close();
  loadProject(p);
  if (!p.sample) { touch(); const el = root.lastElementChild; jump($('#p-script'), false); if (el) caretEnd(el); showAC(); }
  else { store.set(KEY, null); stage.scrollTop = scriptTop(); }
});
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey; if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === 's') { e.preventDefault(); saveLocal(); if (cloud.on) cloudLater(0); toast(P.sample ? 'This is the example script. Your own work saves as you type.' : 'Your script saves as you type.'); }
  else if (k === 'e' && e.shiftKey) { e.preventDefault(); $('#b-export').click(); }
});

/* ---------- start ---------- */
function start(hot) {
  app.classList.toggle('tags-on', ui.tags); $('#tags').checked = ui.tags;
  app.classList.toggle('no-side', !ui.side);
  const saved = (hot && hot.project) || store.get(KEY), mine = saved && Array.isArray(saved.blocks);
  bootStamp = mine ? (saved.updatedAt || 0) : 0;          // what this browser had before anything was typed
  loadProject(mine ? saved : sample('film'));
  stage.scrollTop = scriptTop();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { applyZoom(); $$('#cast-rows .ds').forEach(grow); stage.scrollTop = scriptTop(); });
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({project: projectJSON()})); } catch (e) { /* not in the viewer */ }
  initCloud(); setTimeout(initCloud, 1500);
}
const hotApi = window.claude && window.claude.hot;
if (hotApi && typeof hotApi.ready === 'function') hotApi.ready(start); else start((hotApi && hotApi.data) || {});
