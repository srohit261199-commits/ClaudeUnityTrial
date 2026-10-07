/* Shared behaviour for every page: transitions, cursor, slits, magnifier, image viewer,
   the studio line (contact), the welcome tour, and the scroll animations. The 3D lives in scene.js
   and talks to this file through window.SITE. */
(function () {
'use strict';
const D = window.DATA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const G = window.gsap, ST = window.ScrollTrigger, SPLIT = window.SplitText;
const IM = D.images, PR = D.projects;
const src = i => 'assets/img/' + IM[i].k + '.jpg';
const pad = n => String(n).padStart(2, '0');
const main = $('main'), PAGE = main.dataset.page;
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
const S = window.SITE = window.SITE || {};
let lenis = null;
const arrival = store.get('rs-nav'); store.del('rs-nav');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
/* a new page always opens at the top, even if the host restores the last page's scroll offset */
let touched = false;
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, () => { touched = true; }, { passive: true, once: true }));
const toTop = () => { if (!location.hash && !touched && window.scrollY > 0) { window.scrollTo(0, 0); lenis && lenis.scrollTo(0, { immediate: true }); } };
toTop();
addEventListener('load', toTop);
setTimeout(toTop, 300); setTimeout(toTop, 1200);

/* ================================================================ chrome added to every page */
document.body.insertAdjacentHTML('beforeend', `
  <div class="cursor" aria-hidden="true"></div>
  <div class="cursor-remote" aria-hidden="true"><svg viewBox="0 0 40 100"><rect x="4" y="8" width="32" height="88" rx="9" fill="#111" stroke="#fff" stroke-width="1.6"/><circle class="cr-ir" cx="20" cy="4" r="3" fill="#fff"/><circle cx="20" cy="24" r="6.5" fill="#fff"/><rect x="13" y="38" width="14" height="7" rx="2" fill="#9a9a9a"/><rect x="13" y="48" width="14" height="7" rx="2" fill="#9a9a9a"/><g fill="#9a9a9a"><rect x="9" y="62" width="6" height="5" rx="1"/><rect x="17" y="62" width="6" height="5" rx="1"/><rect x="25" y="62" width="6" height="5" rx="1"/><rect x="9" y="70" width="6" height="5" rx="1"/><rect x="17" y="70" width="6" height="5" rx="1"/><rect x="25" y="70" width="6" height="5" rx="1"/><rect x="9" y="78" width="6" height="5" rx="1"/><rect x="17" y="78" width="6" height="5" rx="1"/><rect x="25" y="78" width="6" height="5" rx="1"/></g></svg><i class="cr-beam"></i></div>
  <div class="tip" aria-hidden="true"></div>
  <div class="loupe" aria-hidden="true"><span>× 2.4</span></div>
  <div id="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" data-lenis-prevent>
    <img id="lbImg" alt="">
    <div class="lb-meta lbl"><span id="lbName"></span><span id="lbNo"></span></div>
    <button type="button" class="lb-nav lb-prev" id="lbPrev" aria-label="Previous image">←</button>
    <button type="button" class="lb-nav lb-next" id="lbNext" aria-label="Next image">→</button>
    <button type="button" class="lb-close lbl" id="lbClose">Close</button>
  </div>
  <div class="board" id="board" role="dialog" aria-modal="true" aria-label="Studio line" data-lenis-prevent>
    <div class="bd">
      <div class="bd-top lbl"><span>● Studio line</span><button type="button" class="bd-x lbl" id="bdClose">Esc ✕</button></div>
      <div class="bd-tape" aria-hidden="true"><i class="reel-dot"></i><div class="bd-bar"><b></b></div><i class="reel-dot"></i><span class="lbl">Tape A · side 1</span></div>
      <div class="bd-screen" aria-live="polite">
        <p class="bd-title">You've reached Rohit Sharma.</p>
        <p>Probably mid-render. Leave it with the machine.</p>
        <ul><li>Press 1 for email</li><li>Press 2 for LinkedIn</li><li>Press 3 for Behance</li><li>Press 4 to leave a message</li></ul>
        <p class="bd-out" id="bdOut"></p>
      </div>
      <div class="bd-keys">
        <button type="button" data-key="1"><b>1</b><span>Email</span></button>
        <a data-key="2" href="https://www.linkedin.com/in/rohit872" target="_blank" rel="noopener"><b>2</b><span>LinkedIn</span></a>
        <a data-key="3" href="https://www.behance.net/rohit872" target="_blank" rel="noopener"><b>3</b><span>Behance</span></a>
        <a data-key="4" href="mailto:s.rohit.261199@gmail.com?subject=Project%20enquiry"><b>4</b><span>Message</span></a>
      </div>
      <p class="lbl bd-hint">Press 1 to 4 on your keyboard</p>
    </div>
  </div>`);

/* ================================================================ clock + nav */
const clockEl = $('#clock');
if (clockEl) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' });
  const tick = () => { clockEl.textContent = 'DXB ' + f.format(new Date()); };
  tick(); setInterval(tick, 15000);
}

/* ================================================================ cursor: a tiny inverting dot, and a TV remote over the wall */
const cur = $('.cursor'), remoteCur = $('.cursor-remote'), tipEl = $('.tip');
let domLabel = null, sceneLabel = null, onWall = false;
function paintCursor() { cur.classList.toggle('is-label', !!(sceneLabel || domLabel)); }
function setWall(v) {
  if (v === onWall) return;
  onWall = v; html.classList.toggle('on-wall', v);
  if (!v) S.tip && S.tip(null);
}
S.cursor = l => { sceneLabel = l; paintCursor(); };
S.remoteClick = () => {
  remoteCur.classList.remove('fire'); void remoteCur.offsetWidth; remoteCur.classList.add('fire');
};
S.tip = t => { if (t) { tipEl.textContent = t; tipEl.classList.add('on'); } else tipEl.classList.remove('on'); };
const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: .5, ny: .5 };
addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.nx = e.clientX / innerWidth; mouse.ny = e.clientY / innerHeight; }, { passive: true });
document.addEventListener('pointerover', e => {
  const t = e.target.closest('[data-cursor]');
  domLabel = t ? t.dataset.cursor : null; paintCursor();
  setWall(!!e.target.closest('#wall canvas, #wall .wall-ui'));
});
/* scrolling moves the page under a still pointer, so check what is under it */
let wallQ = false;
addEventListener('scroll', () => {
  if (wallQ || !FINE) return; wallQ = true;
  requestAnimationFrame(() => {
    wallQ = false;
    const el = document.elementFromPoint(mouse.x, mouse.y);
    setWall(!!(el && el.closest('#wall canvas, #wall .wall-ui')));
  });
}, { passive: true });

/* ================================================================ leaving a page */
let leaving = false;
let gone = false;
function finish(href) { if (gone) return; gone = true; location.href = href; }
function go(href, o = {}) {
  if (leaving) return;
  leaving = true;
  if (!G || RM || document.hidden) return finish(href);
  setTimeout(() => finish(href), 1800);           /* never strand the visitor if an animation stalls */
  lenis && lenis.stop();
  if (o.img) {                                     /* from the wall: the render fills the screen */
    store.set('rs-nav', 'zoom');
    const z = document.createElement('div'); z.className = 'zoom';
    z.innerHTML = `<img src="${o.img}" alt="" style="object-position:${o.pos || '50% 50%'}">`;
    document.body.appendChild(z);
    G.fromTo(z, { opacity: 0 }, { opacity: 1, duration: .4, ease: 'power2.out', onComplete: () => finish(href) });
    return;
  }
  if (o.color) {                                   /* from the RohitOS screen: fade to its boot black */
    store.set('rs-nav', 'zoom');
    const z = document.createElement('div'); z.className = 'zoom'; z.style.background = o.color;
    document.body.appendChild(z);
    G.fromTo(z, { opacity: 0 }, { opacity: 1, duration: .35, ease: 'power2.out', onComplete: () => finish(href) });
    return;
  }
  if (o.el) {                                      /* from a slit: the slit opens to full screen */
    store.set('rs-nav', 'zoom');
    const r = o.el.getBoundingClientRect(), im = $('img', o.el);
    const z = document.createElement('div'); z.className = 'zoom';
    z.innerHTML = `<img src="${im.currentSrc || im.src}" alt="" style="object-position:${im.style.objectPosition || '50% 50%'}">`;
    document.body.appendChild(z);
    G.fromTo(z, { clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)` },
      { clipPath: 'inset(0px 0px 0px 0px)', duration: 1, ease: 'expo.inOut', onComplete: () => finish(href) });
    G.fromTo($('img', z), { scale: 1.08 }, { scale: 1, duration: 1, ease: 'expo.inOut' });
    return;
  }
  store.set('rs-nav', 'curtain');
  G.fromTo('.curtain', { yPercent: 100 }, { yPercent: 0, duration: .75, ease: 'expo.inOut', onComplete: () => finish(href) });
}
S.go = go;
addEventListener('pageshow', e => {
  if (!e.persisted) return;
  leaving = false; gone = false; $$('.zoom').forEach(z => z.remove());
  if (G) G.set('.curtain', { yPercent: 100 }); html.classList.remove('arrive');
  lenis && lenis.start();
});
function scrollToEl(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  if (a.hasAttribute('data-board')) { e.preventDefault(); return openBoard(); }
  const href = a.getAttribute('href');
  if (/^(mailto:|tel:|https?:)/.test(href)) return;
  if (href[0] === '#') { e.preventDefault(); return scrollToEl($(href)); }
  if (PAGE === 'home' && (href === './' || href === './#work')) { e.preventDefault(); return scrollToEl(href === './' ? $('#top') : $('#work')); }
  e.preventDefault();
  if (a.classList.contains('slit') && !a.classList.contains('is-text')) go(href, { el: a });
  else go(href);
});

/* ================================================================ slits: windows onto renders fixed to the viewport */
const slits = $$('.slit:not(.is-text)').map(el => ({ el, box: $('.slit-img', el), x: 0, y: 0, s: 1.12 }));
if (slits.length) {
  (function frame() {
    requestAnimationFrame(frame);
    for (const s of slits) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > innerHeight + 40) continue;
      const hov = FINE && s.el.matches(':hover');
      const tx = hov && !RM ? (.5 - mouse.nx) * 70 : 0, ty = hov && !RM ? (.5 - mouse.ny) * 46 : 0;
      s.x += (tx - s.x) * .08; s.y += (ty - s.y) * .08; s.s += ((hov ? 1.03 : FINE ? 1.12 : 1.04) - s.s) * .06;
      s.box.style.transform = `translate3d(${(s.x - r.left).toFixed(1)}px,${(s.y - r.top).toFixed(1)}px,0) scale(${s.s.toFixed(4)})`;
    }
  })();
}

/* ================================================================ image viewer */
const lb = { list: [], i: 0 }, lbEl = $('#lightbox'), lbImg = $('#lbImg');
function lbShow() {
  const k = lb.list[lb.i], m = IM[k];
  lbImg.src = src(k); lbImg.alt = `${m.l}, render`;
  $('#lbName').textContent = `${m.l} · ${m.w} × ${m.h} px`;
  $('#lbNo').textContent = `${pad(lb.i + 1)} / ${pad(lb.list.length)}`;
  (new Image()).src = src(lb.list[(lb.i + 1) % lb.list.length]);
}
function openLightbox(list, i) {
  lb.list = list; lb.i = Math.max(0, i); lbShow();
  lbEl.classList.add('on'); lenis && lenis.stop(); hideLoupe();
  if (G) G.fromTo(lbImg, { scale: .94, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'expo.out' });
}
function closeLightbox() { lbEl.classList.remove('on'); lenis && lenis.start(); }
function lbStep(d) {
  lb.i = (lb.i + d + lb.list.length) % lb.list.length; lbShow();
  if (G) G.fromTo(lbImg, { x: 30 * d, opacity: 0 }, { x: 0, opacity: 1, duration: .5, ease: 'power3.out' });
}
$('#lbPrev').onclick = () => lbStep(-1);
$('#lbNext').onclick = () => lbStep(1);
$('#lbClose').onclick = closeLightbox;
lbEl.addEventListener('click', e => { if (e.target === lbEl) closeLightbox(); });
let lbX = null;
lbEl.addEventListener('pointerdown', e => { lbX = e.clientX; });
lbEl.addEventListener('pointerup', e => { if (lbX !== null && Math.abs(e.clientX - lbX) > 50 && e.target === lbImg) lbStep(e.clientX < lbX ? 1 : -1); lbX = null; });
const thisProject = PR.find(p => p.id === main.dataset.id);
document.addEventListener('click', e => {
  const f = e.target.closest('.g[data-i]');
  if (f && thisProject) openLightbox(thisProject.album_i, thisProject.album_i.indexOf(+f.dataset.i));
});

/* ================================================================ magnifier over gallery renders */
const loupe = $('.loupe'), LS = 240, LZ = 2.4;
let loupeSrc = '';
function hideLoupe() { loupe.classList.remove('on'); cur.classList.remove('is-hidden'); }
if (FINE && PAGE === 'project') {
  document.addEventListener('pointermove', e => {
    const fig = e.target.closest && e.target.closest('.g');
    const img = fig && $('img', fig);
    if (!img || lbEl.classList.contains('on')) return hideLoupe();
    const r = img.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return hideLoupe();
    const s = img.currentSrc || img.src;
    if (s !== loupeSrc) { loupeSrc = s; loupe.style.backgroundImage = `url("${s}")`; }
    /* the picture may be cropped by object-fit: cover, so map the pointer onto the drawn image */
    const nw = img.naturalWidth || r.width, nh = img.naturalHeight || r.height, k = Math.max(r.width / nw, r.height / nh);
    const dw = nw * k, dh = nh * k, op = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const ox = (r.width - dw) * (isNaN(op[0]) ? .5 : op[0]), oy = (r.height - dh) * (isNaN(op[1]) ? .5 : op[1]);
    const bw = dw * LZ, bh = dh * LZ, px = e.clientX - r.left - ox, py = e.clientY - r.top - oy;
    loupe.style.backgroundSize = `${bw}px ${bh}px`;
    loupe.style.backgroundPosition = `${(-(px * LZ) + LS / 2).toFixed(1)}px ${(-(py * LZ) + LS / 2).toFixed(1)}px`;
    loupe.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
    loupe.classList.add('on'); cur.classList.add('is-hidden');
  }, { passive: true });
  document.addEventListener('pointerleave', hideLoupe);
}

/* ================================================================ studio line (contact) */
const board = $('#board'), bdOut = $('#bdOut');
let boardOn = false;
function openBoard() {
  boardOn = true; board.classList.add('on'); lenis && lenis.stop(); bdOut.innerHTML = '';
  if (G) G.fromTo('.bd', { y: 40, opacity: 0, rotateX: 12 }, { y: 0, opacity: 1, rotateX: 0, duration: .8, ease: 'expo.out' });
  setTimeout(() => $('[data-key="1"]', board).focus({ preventScroll: true }), 60);
}
function closeBoard() { boardOn = false; board.classList.remove('on'); lenis && lenis.start(); }
S.openBoard = openBoard;
$('#bdClose').onclick = closeBoard;
board.addEventListener('click', e => { if (e.target === board) closeBoard(); });
function press(k) {
  const key = $(`[data-key="${k}"]`, board);
  if (!key) return;
  key.classList.add('hit'); setTimeout(() => key.classList.remove('hit'), 220);
  if (k === '1') bdOut.innerHTML = 'Email: <a href="mailto:s.rohit.261199@gmail.com">s.rohit.261199@gmail.com</a>';
  if (k === '2') bdOut.textContent = 'Opening LinkedIn in a new tab.';
  if (k === '3') bdOut.textContent = 'Opening Behance in a new tab.';
  if (k === '4') bdOut.innerHTML = 'Your mail app should open. If not, write to <a href="mailto:s.rohit.261199@gmail.com">s.rohit.261199@gmail.com</a>';
}
board.addEventListener('click', e => { const k = e.target.closest('[data-key]'); if (k) press(k.dataset.key); });
$$('[data-board]').forEach(a => a.setAttribute('aria-haspopup', 'dialog'));
document.addEventListener('click', e => { if (e.target.closest('[data-line-open]')) openBoard(); });

/* ================================================================ the help button steps aside for the footer */
const helpBtn = $('.help'), footEl = $('.site-foot');
if (helpBtn && footEl) new IntersectionObserver(es => helpBtn.classList.toggle('away', es[0].isIntersecting)).observe(footEl);

/* ================================================================ welcome tour (home) */
const ICON = {
  tv: '<rect x="8" y="16" width="48" height="34" rx="6"/><rect x="14" y="21" width="30" height="24" rx="4"/><path d="M24 16 18 6M40 16l6-10"/><circle cx="50" cy="27" r="2"/><circle cx="50" cy="36" r="2"/>',
  remote: '<rect x="22" y="6" width="20" height="52" rx="6"/><circle cx="32" cy="16" r="4"/><path d="M27 27h10M27 33h10M27 41h2M31 41h2M35 41h2M27 47h2M31 47h2M35 47h2"/>',
  cursor: '<path d="M18 8v40l10-10 7 16 6-3-7-15h14z"/>',
  phone: '<path d="M14 20c0-6 8-10 18-10s18 4 18 10l-8 4-4-6h-12l-4 6z"/><rect x="18" y="28" width="28" height="26" rx="5"/><path d="M26 36h2M31 36h2M36 36h2M26 41h2M31 41h2M36 41h2M26 46h2M31 46h2M36 46h2"/>',
};
const STEPS = [
  { i: 'tv', k: 'Welcome', t: 'Welcome to the studio', b: "This is Rohit Sharma's portfolio, set up as a wall of screens. Each screen is a different project." },
  { i: 'remote', k: 'Step 1 of 3', t: 'Your cursor is the remote', b: 'Over the wall, your cursor turns into a TV remote. Click anywhere to switch the screens on, and click again to change channel. On a phone, tap.' },
  { i: 'cursor', k: 'Step 2 of 3', t: 'Open any screen', b: 'Click a screen to step inside that project. The big one boots RohitOS, a desktop with everything else.' },
  { i: 'phone', k: 'Step 3 of 3', t: 'Pick up the phone', b: 'The wall phone is the studio line: email, LinkedIn and Behance. Press Esc to close whatever is open.' },
];
const tour = $('#tour');
let tourOn = false, step = 0;
function drawStep() {
  const s = STEPS[step];
  $('.tr-icon', tour).innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${ICON[s.i]}</svg>`;
  $('.tr-k', tour).textContent = s.k; $('#tourTitle').textContent = s.t; $('.tr-body', tour).textContent = s.b;
  $$('.tr-dots i', tour).forEach((d, n) => d.classList.toggle('on', n === step));
  $('.tr-back', tour).hidden = step === 0;
  $('.tr-next', tour).textContent = step === STEPS.length - 1 ? 'Start exploring' : 'Next →';
  if (G) G.fromTo($$('.tr-icon, .tr-k, #tourTitle, .tr-body', tour), { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .04, ease: 'expo.out' });
}
function openTour() {
  if (!tour) return;
  step = 0; tourOn = true; tour.classList.add('on'); lenis && lenis.stop(); drawStep();
  if (G) G.fromTo('.tr-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'expo.out' });
  setTimeout(() => $('.tr-next', tour).focus({ preventScroll: true }), 60);
}
function closeTour() { if (!tourOn) return; tourOn = false; tour.classList.remove('on'); lenis && lenis.start(); store.lset('rs-tour', '1'); }
if (tour) {
  tour.querySelector('.tr-dots').innerHTML = STEPS.map(() => '<i></i>').join('');
  $('.tr-next', tour).onclick = () => { if (step < STEPS.length - 1) { step++; drawStep(); } else closeTour(); };
  $('.tr-back', tour).onclick = () => { if (step > 0) { step--; drawStep(); } };
  $('.tr-skip', tour).onclick = closeTour;
  tour.addEventListener('click', e => { if (e.target === tour) closeTour(); });
  $$('[data-tour]').forEach(b => b.addEventListener('click', openTour));
}

document.addEventListener('keydown', e => {
  if (lbEl.classList.contains('on')) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') lbStep(1);
    if (e.key === 'ArrowLeft') lbStep(-1);
    return;
  }
  if (boardOn) {
    if (e.key === 'Escape') return closeBoard();
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); press(e.key); const k = $(`a[data-key="${e.key}"]`, board); if (k) k.click(); }
    return;
  }
  if (tourOn) {
    if (e.key === 'Escape') closeTour();
    if (e.key === 'ArrowRight') $('.tr-next', tour).click();
    if (e.key === 'ArrowLeft' && step > 0) $('.tr-back', tour).click();
  }
});

/* ================================================================ the Hindi name at the end fills the width */
const hiEl = $('.foot-hi');
if (hiEl) {
  const fitHi = () => {
    hiEl.style.fontSize = '100px';
    const w = hiEl.getBoundingClientRect().width;
    if (w) hiEl.style.fontSize = (100 * hiEl.parentElement.clientWidth * .96 / w).toFixed(2) + 'px';
  };
  fitHi(); addEventListener('resize', fitHi);
  document.fonts && document.fonts.ready.then(fitHi);
}

/* ================================================================ motion reels play near view */
const reelIO = new IntersectionObserver(es => es.forEach(e => {
  const v = e.target;
  if (e.isIntersecting) { if (v.preload !== 'auto') v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
}), { rootMargin: '10% 0px 10% 0px' });
$$('.reel video').forEach(v => reelIO.observe(v));

/* ================================================================ without GSAP, stop here */
function settle() { html.classList.remove('pre', 'arrive'); }
if (!G || !ST) { settle(); if (tour && !store.lget('rs-tour')) openTour(); return; }
G.registerPlugin(ST); if (SPLIT) G.registerPlugin(SPLIT);
G.config({ nullTargetWarn: false });
if (!RM && window.Lenis) {
  lenis = new window.Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .95, touchMultiplier: 1.4 });
  lenis.on('scroll', ST.update);
  G.ticker.add(t => lenis.raf(t * 1000));
  G.ticker.lagSmoothing(0);
}
S.lenis = () => lenis;

if (FINE) {
  const pos = { x: mouse.x, y: mouse.y }, tp = { x: mouse.x, y: mouse.y };
  G.ticker.add(() => {
    pos.x += (mouse.x - pos.x) * .22; pos.y += (mouse.y - pos.y) * .22;
    cur.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
    remoteCur.style.transform = `translate3d(${mouse.x}px,${mouse.y}px,0) rotate(-16deg)`;
    tp.x += (mouse.x - tp.x) * .14; tp.y += (mouse.y - tp.y) * .14;
    tipEl.style.transform = `translate3d(${tp.x + (onWall ? 40 : 22)}px,${tp.y + (onWall ? 34 : 26)}px,0)`;
  });
}

function marquee(track) {
  const dir = +track.dataset.dir || 1;
  let x = 0, w = 0, skew = 0;
  const measure = () => { w = track.firstElementChild.getBoundingClientRect().width; };
  measure(); addEventListener('resize', measure);
  document.fonts && document.fonts.ready.then(measure);
  G.ticker.add((t, dt) => {
    const vel = lenis ? lenis.velocity : 0;
    if (!RM) x += dir * (.06 + Math.min(Math.abs(vel) * .03, 1.4)) * dt;
    if (w) x = ((x % w) + w) % w;
    skew += ((RM ? 0 : G.utils.clamp(-8, 8, vel * -.35)) - skew) * .1;
    track.style.transform = `translate3d(${(x - w).toFixed(2)}px,0,0) skewX(${(skew * dir).toFixed(2)}deg)`;
  });
}
$$('.mq-track').forEach(marquee);
function split(el, type = 'lines,chars') {
  if (!SPLIT || !el) return null;
  return SPLIT.create(el, { type, linesClass: type.includes('chars') ? 'split-line' : 'split-free' });
}
const rise = (el, start = 'top 80%') => { const s = split(el); if (s) G.from(s.chars, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: .025, scrollTrigger: { trigger: el, start } }); };

/* ---------------------------------------------------------------- arriving */
function curtainOut() {
  if (arrival === 'curtain') G.fromTo('.curtain', { yPercent: 0 }, { yPercent: -100, duration: .9, ease: 'expo.inOut', delay: .05 });
  html.classList.remove('arrive');
}

/* ---------------------------------------------------------------- home */
function home() {
  const tl = G.timeline({ delay: arrival === 'curtain' ? .35 : .1 });
  tl.from('#wall canvas', { opacity: 0, y: 40, duration: 1.4, ease: 'expo.out' })
    .from('.wall-cap, .wall-cue, .help', { opacity: 0, y: 16, duration: 1, ease: 'expo.out', stagger: .06 }, .4)
    .from('.bar', { opacity: 0, duration: 1 }, .3);
  html.classList.remove('pre');
  if (tour && !store.lget('rs-tour')) setTimeout(openTour, 1500);

  G.fromTo('.bold-type span', { yPercent: 55 }, { yPercent: -10, ease: 'none', stagger: .12,
    scrollTrigger: { trigger: '#work', start: 'top bottom', end: 'top 10%', scrub: .5 } });
  $$('#work .slit').forEach((s, n) => G.fromTo(s, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut',
    delay: (n % 4) * .06, scrollTrigger: { trigger: s, start: 'top 95%' } }));

  const chev = $('#chev'), path = $('#chevPath');
  if (chev) {
    const P = [[300, 30], [570, 400], [300, 770], [30, 400]];
    path.setAttribute('d', 'M300,30 ' + P.map((p, n) => {
      const q = P[(n + 1) % 4], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      return `Q${(mx + (300 - mx) * .16).toFixed(1)},${(my + (400 - my) * .16).toFixed(1)} ${q[0]},${q[1]}`;
    }).join(' ') + ' Z');
    const L = path.getTotalLength();
    G.set(path, { strokeDasharray: L, strokeDashoffset: L });
    G.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#work', start: 'top 70%', end: 'bottom 30%', scrub: .6 } })
      .set(chev, { visibility: 'visible' })
      .fromTo(chev, { yPercent: 70 }, { yPercent: 0, duration: 1 })
      .to(path, { strokeDashoffset: 0, duration: 1 }, 0)
      .to(chev, { yPercent: -10, duration: 1.6 })
      .to(chev, { yPercent: -160, duration: 1.2 });
  }
  if (location.hash === '#work') setTimeout(() => { lenis ? lenis.scrollTo('#work', { immediate: true }) : $('#work').scrollIntoView(); ST.refresh(); }, 60);
}

/* ---------------------------------------------------------------- project */
function project() {
  const title = $('.ph-title'), s = split(title);
  html.classList.remove('pre');
  const tl = G.timeline({ delay: arrival === 'curtain' ? .35 : .05 });
  if (arrival !== 'zoom') tl.from('.ph-img', { scale: 1.18, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0);
  if (s) tl.from(s.chars, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: .03 }, .15);
  tl.from('.ph-txt .lbl, .ph-cue', { opacity: 0, y: 14, duration: 1, ease: 'expo.out', stagger: .08 }, .4)
    .from('.bar', { opacity: 0, duration: 1 }, .3);
  G.to('.ph-img', { yPercent: 16, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.ph', start: 'top top', end: 'bottom top', scrub: true } });
  G.to('.ph-txt', { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.ph', start: '30% top', end: 'bottom top', scrub: true } });
  const sh = split($('.pi-short'), 'lines');
  if (sh) G.from(sh.lines, { y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '.pi', start: 'top 80%' } });
  G.from('.pi-meta > div', { y: 20, opacity: 0, duration: .9, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: '.pi', start: 'top 75%' } });
  rise($('.tt-title'), 'top 85%');
  $$('.g').forEach((f, n) => {
    G.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', delay: (n % 3) * .07, scrollTrigger: { trigger: f, start: 'top 92%' } });
    G.fromTo($('img', f), { scale: 1.25 }, { scale: 1, duration: 1.8, ease: 'expo.out', delay: (n % 3) * .07, scrollTrigger: { trigger: f, start: 'top 92%' } });
  });
  $$('.pn .slit').forEach(s2 => G.fromTo(s2, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: s2, start: 'top 95%' } }));
}

/* ---------------------------------------------------------------- motion, about */
function motion() {
  html.classList.remove('pre');
  const s = split($('.mo-head h1'));
  if (s) G.from(s.chars, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: .03, delay: arrival === 'curtain' ? .35 : .05 });
  G.from('.mo-head p', { opacity: 0, y: 14, duration: 1, delay: .5 });
  G.from('.reel', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: '.mo-grid', start: 'top 90%' } });
}
function about() {
  html.classList.remove('pre');
  const s = split($('.ab-lede'), 'lines');
  if (s) G.from(s.lines, { y: 50, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: .08, delay: arrival === 'curtain' ? .35 : .05 });
  G.from('.ab-bio p, .xp li, .kit div', { y: 24, opacity: 0, duration: .9, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: '.ab-grid', start: 'top 85%' } });
  $$('[data-count]').forEach(b => {
    const end = +b.dataset.count, suf = b.dataset.suffix || '', o = { v: 0 };
    ST.create({ trigger: b, start: 'top 88%', once: true, onEnter: () =>
      G.to(o, { v: end, duration: 1.8, ease: 'expo.out', onUpdate: () => { b.textContent = Math.round(o.v).toLocaleString('en-US') + suf; } }) });
  });
}

curtainOut();
({ home, project, motion, about }[PAGE] || (() => html.classList.remove('pre')))();
G.from('.foot-sig', { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.site-foot', start: 'top 92%' } });
const hiWords = $$('.foot-hi span');
if (hiWords.length) {
  const tilt = [-4, 3];
  hiWords.forEach((w, n) => G.set(w, { rotate: tilt[n % 2] }));
  G.from(hiWords, { yPercent: 80, rotate: (n) => tilt[n % 2] * 3, duration: 1.5, ease: 'expo.out', stagger: .12,
    scrollTrigger: { trigger: '.foot-hi', start: 'top 98%' } });
  if (FINE && !RM) {
    const lean = hiWords.map(w => ({ r: G.quickTo(w, 'rotate', { duration: .8, ease: 'power3.out' }), y: G.quickTo(w, 'y', { duration: .8, ease: 'power3.out' }) }));
    $('.site-foot').addEventListener('pointermove', e => {
      hiWords.forEach((w, n) => {
        const b = w.getBoundingClientRect(), dx = (e.clientX - (b.left + b.width / 2)) / innerWidth;
        lean[n].r(tilt[n % 2] + dx * 10); lean[n].y(-Math.max(0, 1 - Math.abs(dx) * 3) * 18);
      });
    });
    $('.site-foot').addEventListener('pointerleave', () => hiWords.forEach((w, n) => { lean[n].r(tilt[n % 2]); lean[n].y(0); }));
  }
}
addEventListener('load', () => ST.refresh());
})();
