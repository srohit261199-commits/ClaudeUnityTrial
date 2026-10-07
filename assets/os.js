/* RohitOS: the desktop behind the big screen on the wall.
   Windows open from the desktop icons, the dock and the menu bar; drag them by the title bar. */
(function () {
'use strict';
const desk = document.getElementById('osDesk');
if (!desk) return;
const D = window.DATA, S = window.SITE || {};
const os = document.querySelector('.os');
const G = window.gsap, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => innerWidth < 760;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

/* where each window first appears: left, top, width.
   On a desktop the OS boots with About, Projects (just under About) and Motion (over both) open. */
const PLACE = {
  about: [178, 17, 520], resume: [210, 40, 600], projects: [176, 'below-about', 600], motion: [580, 184, 620],
  toolkit: [430, 120, 440], contact: [470, 150, 440], settings: [540, 170, 380], help: [600, 110, 380], roll: [0, 40, 760],
};
let z = 20;
const wins = {};

function place(w, id) {
  let [l, t, width] = PLACE[id] || [200, 60, 480];
  const W = desk.clientWidth, H = desk.clientHeight;
  if (t === 'below-about') { const a = wins.about; t = a && !a.hidden ? a.offsetTop + a.offsetHeight + 20 : 50; }
  const ww = Math.min(width, W - 24);
  let left = id === 'roll' ? Math.max(12, (W - ww) / 2 + 40) : Math.min(l, W - ww - 12);
  w.style.width = ww + 'px';
  w.style.left = Math.max(12, left) + 'px';
  w.style.top = Math.max(8, Math.min(t, H - 160)) + 'px';
  fitHeight(w);
}
/* a window never runs past the bottom of the desk */
function fitHeight(w) { if (!narrow()) w.style.maxHeight = Math.max(200, desk.clientHeight - w.offsetTop - 78) + 'px'; }
function focus(w) {
  Object.values(wins).forEach(x => x.classList.remove('top'));
  w.classList.add('top'); w.style.zIndex = ++z;
}
function open(id) {
  if (id === 'line') return S.openBoard && S.openBoard();
  let w = wins[id];
  const appear = !w || w.hidden;
  if (!w) {
    const tpl = document.getElementById('tpl-' + id);
    if (!tpl) return;
    w = tpl.content.firstElementChild.cloneNode(true);
    desk.appendChild(w); wins[id] = w; place(w, id); wire(w, id);
  }
  w.hidden = false; focus(w);
  $$('.os-icon').forEach(i => i.classList.toggle('sel', i.dataset.open === id));
  if (appear && G && !RM) G.fromTo(w, { scale: .92, opacity: 0, transformOrigin: '50% 30%' }, { scale: 1, opacity: 1, duration: .45, ease: 'expo.out' });
  /* a cloned <video> does not pick up `muted` as a property, and only muted video may autoplay at boot */
  if (id === 'motion') { const v = w.querySelector('video'); if (v) { v.muted = true; v.play().catch(() => {}); } }
}
function close(id) {
  const w = wins[id]; if (!w) return;
  w.hidden = true; w.querySelectorAll('video').forEach(v => v.pause());
  $$('.os-icon').forEach(i => { if (i.dataset.open === id) i.classList.remove('sel'); });
}
function $$(s, r = document) { return [...r.querySelectorAll(s)]; }

/* drag by the title bar */
function wire(w, id) {
  w.addEventListener('pointerdown', () => focus(w));
  w.querySelector('.os-x').addEventListener('click', () => close(id));
  const bar = w.querySelector('.os-bar');
  let sx, sy, ox, oy, on = false;
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('.os-x') || narrow()) return;
    on = true; sx = e.clientX; sy = e.clientY; ox = w.offsetLeft; oy = w.offsetTop;
    bar.setPointerCapture(e.pointerId); w.classList.add('drag');
  });
  bar.addEventListener('pointermove', e => {
    if (!on) return;
    const W = desk.clientWidth, H = desk.clientHeight;
    w.style.left = Math.min(W - 60, Math.max(-w.offsetWidth + 80, ox + e.clientX - sx)) + 'px';
    w.style.top = Math.min(H - 40, Math.max(0, oy + e.clientY - sy)) + 'px';
  });
  const end = () => { on = false; w.classList.remove('drag'); fitHeight(w); };
  bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  if (id === 'motion') wireMotion(w);
  if (id === 'roll') wireRoll(w);
  if (id === 'settings') wireSettings(w);
}

/* Motion.mov: one player, a row of cuts */
function wireMotion(w) {
  const v = w.querySelector('video'), btns = $$('[data-reel]', w);
  btns.forEach(b => b.addEventListener('click', () => {
    v.src = `assets/reel/${b.dataset.reel}.mp4`; v.poster = `assets/reel/${b.dataset.reel}-poster.jpg`;
    v.play().catch(() => {});
    btns.forEach(x => x.setAttribute('aria-pressed', x === b));
  }));
}

/* Renders.dir: a magazine spread; click the picture for the next render */
function wireRoll(w) {
  const fig = w.querySelector('.os-mag-r'), img = fig.querySelector('img'), cap = fig.querySelector('figcaption span');
  const no = fig.querySelector('figcaption b');
  const list = D.projects.flatMap(p => p.album_i.slice(0, 3).map(i => [i, p.name]));
  let k = 0;
  const show = () => {
    const [i, name] = list[k], m = D.images[i];
    img.src = `assets/img/${m.k}.jpg`; img.alt = `${name}, render`; img.style.objectPosition = m.f;
    cap.textContent = name; no.textContent = `${String(k + 1).padStart(2, '0')} / ${list.length}`;
    if (G && !RM) G.fromTo(img, { opacity: .2, scale: 1.04 }, { opacity: 1, scale: 1, duration: .6, ease: 'power2.out' });
  };
  fig.addEventListener('click', () => { k = (k + 1) % list.length; show(); });
  fig.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fig.click(); } });
  show();
}

/* Settings: grain, invert, the signature wallpaper */
const PREFS = {
  grain: { on: true, apply: v => { const g = document.querySelector('.grain'); if (g) g.hidden = !v; } },
  invert: { on: false, apply: v => os.classList.toggle('inv', v) },
  wallpaper: { on: true, apply: v => { const s = document.querySelector('.os-sig'); if (s) s.hidden = !v; } },
};
Object.entries(PREFS).forEach(([k, p]) => { const saved = store.get('rs-os-' + k); if (saved !== null) p.on = saved === '1'; p.apply(p.on); });
function wireSettings(w) {
  $$('[data-pref]', w).forEach(b => {
    const p = PREFS[b.dataset.pref];
    const paint = () => { b.setAttribute('aria-checked', p.on); b.querySelector('b').textContent = p.on ? 'On' : 'Off'; };
    paint();
    b.addEventListener('click', () => { p.on = !p.on; p.apply(p.on); store.set('rs-os-' + b.dataset.pref, p.on ? '1' : '0'); paint(); });
  });
}

/* every [data-open] in the page opens its window; [data-line] opens the studio line */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-open]');
  if (t) { e.preventDefault(); open(t.dataset.open); }
  if (e.target.closest('[data-line]')) S.openBoard && S.openBoard();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('#board.on, #lightbox.on')) return;
  const top = Object.entries(wins).filter(([, w]) => !w.hidden).sort((a, b) => b[1].style.zIndex - a[1].style.zIndex)[0];
  if (top) close(top[0]);
});

/* clock */
const clock = document.getElementById('osClock');
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const tick = () => { clock.textContent = fmt.format(new Date()); };
tick(); setInterval(tick, 1000);

/* boot, then the desk with About, Projects and Motion open (Motion on top, playing) */
const boot = document.querySelector('.os-boot');
setTimeout(() => {
  boot.classList.add('done');
  open('about');
  if (narrow()) return;
  setTimeout(() => open('projects'), 160);
  setTimeout(() => open('motion'), 320);
}, RM ? 200 : 1300);
/* Chrome holds back video in a tab that opened in the background; start the reel once it is seen or touched */
const resumeReel = () => {
  const w = wins.motion, v = w && !w.hidden && w.querySelector('video');
  if (v && v.paused && !document.hidden) { v.muted = true; v.play().catch(() => {}); }
};
document.addEventListener('visibilitychange', resumeReel);
addEventListener('pointerdown', resumeReel, { once: true });
addEventListener('pageshow', e => { if (e.persisted) boot.classList.add('done'); });
})();
