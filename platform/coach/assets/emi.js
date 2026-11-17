/* Emi — the ME.Coach guide. A procedural 3D character built with three.js (assets/vendor/three.min.js).
 * Emi.mount(el, { orbit, fps, zoom, onTap }) -> { play(name), say(text, ms), look(x, y), view(name), mood(name), destroy() }
 * Actions: idle, laugh, wink, giggle, hop, yawn, facepalm, heart, lookaround, tap, wave, nod, think, celebrate, point-left, point-right, sleep, dance, shy, surprised, breathe, cheer, stretch, thumbs
 */
(function () {
  'use strict';
  const T = () => window.THREE;
  const C = { skin: 0xf6dcc2, skinDk: 0xe9c3a2, navy: 0x2b3357, navyDk: 0x1d2440, gold: 0xd4ae36, cream: 0xfaf6ee, white: 0xffffff, ink: 0x1a1d2b, blush: 0xf29a9a, shoe: 0xf4f4f2, sole: 0x9aa0b4 };
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const bell = t => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  const lerp = (a, b, k) => a + (b - a) * k;

  function mat(color, o = {}) { const THREE = T(); return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .02 }, o)); }
  function textTexture(txt, { size = 128, bg = null, fg = '#1a1d2b', font = '800 64px system-ui, sans-serif' } = {}) {
    const THREE = T(), c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, size / 2, size / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function blobTexture() {
    const THREE = T(), c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(20,24,45,.38)'); r.addColorStop(1, 'rgba(20,24,45,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }

  /* ---------- the model ---------- */
  function build() {
    const THREE = T(), G = () => new THREE.Group(), M = (geo, m) => { const x = new THREE.Mesh(geo, m); x.castShadow = false; return x; };
    const skin = mat(C.skin, { roughness: .7 }), navy = mat(C.navy, { roughness: .65 }), navyDk = mat(C.navyDk, { roughness: .6 }), gold = mat(C.gold, { roughness: .35, metalness: .35 }),
      cream = mat(C.cream, { roughness: .8 }), white = mat(C.white, { roughness: .25 }), ink = mat(C.ink, { roughness: .3 }), blush = mat(C.blush, { transparent: true, opacity: .55, roughness: 1 }),
      shoe = mat(C.shoe, { roughness: .5 }), sole = mat(C.sole, { roughness: .7 });
    const root = G(), body = G(); root.add(body);
    const P = {};
    // legs
    for (const s of [-1, 1]) {
      const hip = G(); hip.position.set(.2 * s, .62, 0); body.add(hip);
      const leg = M(new THREE.CapsuleGeometry(.12, .28, 6, 14), navyDk); leg.position.y = -.2; hip.add(leg);
      const sh = M(new THREE.SphereGeometry(.17, 20, 14), shoe); sh.scale.set(1, .62, 1.35); sh.position.set(0, -.44, .05); hip.add(sh);
      const so = M(new THREE.CylinderGeometry(.17, .17, .04, 20), sole); so.scale.set(1, 1, 1.35); so.position.set(0, -.52, .05); hip.add(so);
      P[s < 0 ? 'legL' : 'legR'] = hip;
    }
    // torso: hoodie with cream belly, gold zip and chest badge
    const torso = G(); torso.position.y = .62; body.add(torso); P.torso = torso;
    const jacket = M(new THREE.CapsuleGeometry(.46, .42, 10, 28), navy); jacket.scale.set(1, 1, .86); jacket.position.y = .42; torso.add(jacket);
    const tee = M(new THREE.ConeGeometry(.13, .2, 3), cream); tee.rotation.set(Math.PI + .2, 0, 0); tee.position.set(0, .82, .33); torso.add(tee);
    for (const s2 of [-1, 1]) { const pk = M(new THREE.BoxGeometry(.2, .02, .02), navyDk); pk.position.set(.2 * s2, .25, .385); pk.rotation.z = .3 * s2; torso.add(pk); }
    const zip = M(new THREE.CylinderGeometry(.012, .012, .62, 8), gold); zip.position.set(0, .45, .395); zip.rotation.x = -.08; torso.add(zip);
    const badge = M(new THREE.CircleGeometry(.085, 32), new THREE.MeshStandardMaterial({ map: textTexture('ME.', { bg: '#d4ae36', fg: '#1d2440', font: '900 46px system-ui, sans-serif' }), roughness: .4 }));
    badge.position.set(-.2, .6, .37); badge.rotation.y = -.35; torso.add(badge);
    // scarf
    const scarf = M(new THREE.TorusGeometry(.33, .075, 14, 40), gold); scarf.rotation.x = Math.PI / 2 - .12; scarf.position.y = .86; scarf.scale.set(1, .95, 1); torso.add(scarf);
    const tail = M(new THREE.CapsuleGeometry(.06, .22, 6, 10), gold); tail.position.set(.17, .7, .3); tail.rotation.set(.25, 0, .5); torso.add(tail); P.scarfTail = tail;
    // arms
    for (const s of [-1, 1]) {
      const sho = G(); sho.position.set(.5 * s, .74, 0); torso.add(sho);
      const up = M(new THREE.CapsuleGeometry(.1, .24, 6, 12), navy); up.position.y = -.17; sho.add(up);
      const elb = G(); elb.position.y = -.33; sho.add(elb);
      const fo = M(new THREE.CapsuleGeometry(.09, .16, 6, 12), navy); fo.position.y = -.1; elb.add(fo);
      const cuff = M(new THREE.TorusGeometry(.085, .025, 8, 18), gold); cuff.rotation.x = Math.PI / 2; cuff.position.y = -.2; elb.add(cuff);
      const hand = M(new THREE.SphereGeometry(.11, 20, 14), skin); hand.position.y = -.3; elb.add(hand);
      const thumb = M(new THREE.CapsuleGeometry(.035, .06, 4, 8), skin); thumb.position.set(.07 * -s, -.27, .05); thumb.rotation.z = .6 * s; elb.add(thumb);
      sho.rotation.z = .16 * s; elb.rotation.x = -.15;
      P[s < 0 ? 'armL' : 'armR'] = sho; P[s < 0 ? 'elbL' : 'elbR'] = elb;
    }
    // head
    const neck = G(); neck.position.y = 1.0; torso.add(neck); P.neck = neck;
    const head = G(); head.position.y = .42; neck.add(head); P.head = head;
    const skull = M(new THREE.SphereGeometry(.56, 40, 30), skin); skull.scale.set(1.04, .96, .94); head.add(skull);
    for (const s of [-1, 1]) { const ear = M(new THREE.SphereGeometry(.12, 18, 12), skin); ear.scale.set(.55, 1, .8); ear.position.set(.56 * s, -.02, -.02); head.add(ear); const inner = M(new THREE.SphereGeometry(.07, 14, 10), mat(C.skinDk)); inner.scale.set(.4, .9, .6); inner.position.set(.6 * s, -.02, .0); head.add(inner); }
    // hair: cap + swoop + small curl
    const hairM = navyDk;
    const cap = M(new THREE.SphereGeometry(.585, 40, 24, 0, Math.PI * 2, 0, Math.PI * .52), hairM); cap.scale.set(1.05, .98, .96); cap.position.set(0, .03, -.035); cap.rotation.x = -.32; head.add(cap);
    const swoop = M(new THREE.TorusGeometry(.32, .11, 12, 30, Math.PI * .9), hairM); swoop.position.set(.06, .34, .3); swoop.rotation.set(-.55, .2, .35); head.add(swoop);
    const curl = M(new THREE.TorusGeometry(.07, .03, 8, 18, Math.PI * 1.6), hairM); curl.position.set(-.16, .5, .36); curl.rotation.set(-.4, 0, .8); head.add(curl);
    // a soft, bouncy hair tuft (no antenna: Emi is a person, not a robot)
    const tuft = G(); tuft.position.set(.04, .5, .1); head.add(tuft); P.tuft = tuft;
    for (let i = 0; i < 3; i++) { const lock = M(new THREE.CapsuleGeometry(.055 - i * .008, .2 - i * .03, 6, 10), hairM); lock.position.set(-.07 + i * .08, .1 - i * .015, -.03 * i); lock.rotation.set(-.35, 0, .55 - i * .5); tuft.add(lock); }
    // face
    const face = G(); face.position.z = .47; head.add(face); P.face = face;
    P.eyes = []; P.lids = []; P.brows = [];
    for (const s of [-1, 1]) {
      const eye = G(); eye.position.set(.2 * s, .03, .02); face.add(eye);
      const scl = M(new THREE.SphereGeometry(.125, 24, 18), white); scl.scale.set(.9, 1.08, .55); eye.add(scl);
      const pup = G(); eye.add(pup);
      const iris = M(new THREE.SphereGeometry(.085, 20, 16), mat(0x6b4226, { roughness: .2 })); iris.scale.set(.9, 1.05, .45); iris.position.z = .045; pup.add(iris);
      const pp = M(new THREE.SphereGeometry(.05, 16, 12), ink); pp.scale.set(.9, 1.05, .45); pp.position.z = .07; pup.add(pp);
      const hl = M(new THREE.SphereGeometry(.022, 10, 8), white); hl.position.set(.03, .035, .09); pup.add(hl);
      const hl2 = M(new THREE.SphereGeometry(.011, 8, 6), white); hl2.position.set(-.025, -.03, .09); pup.add(hl2);
      const lid = M(new THREE.SphereGeometry(.132, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin); lid.scale.set(.92, 1.1, .6); lid.rotation.x = -.05; lid.position.z = .005; eye.add(lid); lid.scale.y = .02;
      for (let l = 0; l < 2; l++) { const lash = M(new THREE.CapsuleGeometry(.008, .045, 3, 6), ink); lash.position.set((.1 + l * .025) * s, .1 - l * .02, .05); lash.rotation.z = (-.7 - l * .4) * s; eye.add(lash); }
      const brow = M(new THREE.CapsuleGeometry(.022, .12, 4, 8), hairM); brow.rotation.z = Math.PI / 2 + .12 * s; brow.position.set(.2 * s, .175, .03); face.add(brow);
      const cheek = M(new THREE.SphereGeometry(.075, 16, 12), blush); cheek.scale.set(1.2, .7, .3); cheek.position.set(.32 * s, -.13, -.02); face.add(cheek);
      P.eyes.push({ eye, pup }); P.lids.push(lid); P.brows.push(brow); (P.cheeks = P.cheeks || []).push(cheek);
    }
    const nose = M(new THREE.SphereGeometry(.04, 14, 10), mat(C.skinDk)); nose.position.set(0, -.07, .06); nose.scale.set(1.2, .9, .8); face.add(nose);
    const smile = M(new THREE.TorusGeometry(.085, .018, 8, 24, Math.PI), ink); smile.rotation.z = Math.PI; smile.position.set(0, -.17, .02); face.add(smile); P.smile = smile;
    const mouth = M(new THREE.SphereGeometry(.07, 20, 14), mat(0x5a2633, { roughness: .6 })); mouth.scale.set(1, .1, .35); mouth.position.set(0, -.19, .015); face.add(mouth); P.mouth = mouth;
    const tongue = M(new THREE.SphereGeometry(.04, 14, 10), mat(0xe2767a)); tongue.scale.set(1.1, .5, .4); tongue.position.set(0, -.04, .01); mouth.add(tongue);
    // props (hidden until an action needs them)
    const bulb = G(); bulb.position.set(.45, 1.95, .1); body.add(bulb); bulb.visible = false; P.bulb = bulb;
    const glass = M(new THREE.SphereGeometry(.12, 20, 16), mat(0xffe27a, { emissive: 0xffd34a, emissiveIntensity: .9, transparent: true, opacity: .95 })); bulb.add(glass);
    const base = M(new THREE.CylinderGeometry(.05, .06, .08, 12), mat(0x9aa0b4, { metalness: .6, roughness: .3 })); base.position.y = -.14; bulb.add(base);
    const heart = M(new THREE.SphereGeometry(.1, 16, 12), mat(0xe8607a, { emissive: 0xe8607a, emissiveIntensity: .3 })); heart.scale.set(1.2, 1, .6); heart.position.set(0, 2.05, .2); heart.visible = false; body.add(heart); P.heart = heart;
    P.zz = []; for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('Z', { fg: '#5b6fb3', font: '900 80px system-ui, sans-serif' }), transparent: true, depthWrite: false })); s.scale.set(.22, .22, 1); s.visible = false; body.add(s); P.zz.push(s); }
    P.stars = []; const starCols = ['#d4ae36', '#2a78d6', '#1baf7a', '#eb6834', '#e87ba4'];
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('★', { fg: starCols[i % 5], font: '900 96px system-ui, sans-serif' }), transparent: true, depthWrite: false })); s.scale.set(.18, .18, 1); s.visible = false; body.add(s); P.stars.push(s); }
    // ground shadow
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = .005; root.add(sh); P.shadow = sh;
    P.body = body; P.root = root;
    return P;
  }

  /* ---------- animation ---------- */
  const ACTIONS = { laugh: 2.4, wink: 1.4, giggle: 1.8, hop: 1.1, yawn: 2.6, facepalm: 2.4, heart: 2.4, lookaround: 2.6, tap: 2, wave: 2.4, nod: 1.4, think: 3.2, celebrate: 2.2, 'point-left': 2, 'point-right': 2, sleep: 6, dance: 3.6, shy: 2.2, surprised: 1.4, breathe: 8, cheer: 2, stretch: 2.6, thumbs: 1.8, listen: 2.4 };

  function mount(el, opt = {}) {
    const THREE = T(); if (!THREE || !el) return null;
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'emi-cv'; renderer.domElement.setAttribute('aria-label', 'Emi, your ME.Coach guide'); renderer.domElement.setAttribute('role', 'img');
    el.classList.add('emi-host'); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3c7, .95));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(2.5, 4, 3.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd98a, .65); rim.position.set(-3, 2.5, -2.5); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xb9c8ff, .35); fill.position.set(-2, 1, 3); scene.add(fill);
    const P = build(); scene.add(P.root);
    const st = { act: 'idle', t0: 0, dur: 0, yaw: opt.yaw || 0, pitch: .08, dist: opt.zoom || 6.3, vyaw: 0, lookX: 0, lookY: 0, lx: 0, ly: 0, blinkAt: 1.5, blinkT: -1, talkUntil: 0, auto: !!opt.autoRotate, mood: 'happy', running: true, visible: true, lastT: performance.now(), clock: 0, idleNext: 8 };
    const target = new THREE.Vector3(0, 1.25, 0);
    function size() { const w = el.clientWidth || 160, h = el.clientHeight || 200; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    size(); const ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(el);
    // bubble
    const bub = document.createElement('div'); bub.className = 'emi-bubble'; bub.hidden = true; el.appendChild(bub); bub.addEventListener('click', () => { bub.hidden = true; });
    function say(text, ms) { if (!text) { bub.hidden = true; return; } bub.textContent = text; bub.hidden = false; bub.classList.remove('in'); void bub.offsetWidth; bub.classList.add('in'); const d = ms || Math.min(9000, 1800 + text.length * 55); st.talkUntil = st.clock + Math.min(4, text.length * .06); clearTimeout(say.t); say.t = setTimeout(() => { bub.hidden = true; }, d); }
    function play(name) { if (!ACTIONS[name] && name !== 'idle') name = 'idle'; if (reduce() && ['celebrate', 'dance', 'stretch'].includes(name)) name = 'nod'; st.act = name; st.t0 = st.clock; st.dur = ACTIONS[name] || 0; if (name === 'celebrate' || name === 'cheer') burst(); }
    function burst() { P.stars.forEach((s, i) => { const a = (i / P.stars.length) * Math.PI * 2; s.userData = { a, v: 1.4 + Math.random() * 1.2, up: 2.2 + Math.random() * 1.4, t0: st.clock }; s.visible = true; }); }
    // input: drag to orbit (all angles), tap to react, pointer to look
    let drag = null; const cv = renderer.domElement;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: 0, yaw: st.yaw, pitch: st.pitch }; if (opt.orbit) cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(); st.lookX = ((e.clientX - r.left) / r.width) * 2 - 1; st.lookY = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!drag || !opt.orbit) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      st.yaw = drag.yaw - dx * .012; st.pitch = Math.max(-.35, Math.min(1.1, drag.pitch + dy * .006)); st.vyaw = -(e.movementX || 0) * .012; st.auto = false;
    });
    const end = () => { if (drag && drag.moved < 6) tap(); drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', () => { drag = null; });
    if (opt.orbit) cv.addEventListener('wheel', e => { e.preventDefault(); st.dist = Math.max(3.4, Math.min(10, st.dist + e.deltaY * .004)); }, { passive: false });
    cv.addEventListener('dblclick', () => { st.yaw = 0; st.pitch = .08; st.dist = opt.zoom || 6.3; });
    const reactions = ['laugh', 'giggle', 'wink', 'hop', 'heart', 'wave', 'shy', 'surprised', 'dance', 'thumbs', 'facepalm'];
    function tap() { const r = reactions[Math.floor(Math.random() * reactions.length)]; play(r); if (opt.onTap) opt.onTap(r); }
    const onGlobalMove = e => { if (opt.orbit) return; const r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .35; st.lookX = Math.max(-1, Math.min(1, (e.clientX - cx) / 500)); st.lookY = Math.max(-1, Math.min(1, (e.clientY - cy) / 400)); };
    window.addEventListener('pointermove', onGlobalMove, { passive: true });
    // pause when hidden or offscreen
    const io = window.IntersectionObserver ? new IntersectionObserver(es => { st.visible = es[0].isIntersecting; if (st.visible) loop(); }) : null; if (io) io.observe(el);
    const onVis = () => { if (!document.hidden) loop(); }; document.addEventListener('visibilitychange', onVis);
    const minDt = 1000 / (opt.fps || 60);
    let raf = 0;
    function loop() { if (raf || !st.running) return; raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0; if (!st.running || document.hidden || !st.visible) return;
      const dtMs = now - st.lastT; if (dtMs < minDt - 2) { loop(); return; }
      st.lastT = now; const dt = Math.min(.05, dtMs / 1000); st.clock += dt; animate(dt); renderer.render(scene, cam); loop();
    }
    function animate(dt) {
      const t = st.clock, rm = reduce(), k = Math.min(1, dt * 8), a = st.act, p = st.dur ? (t - st.t0) / st.dur : 0;
      if (st.dur && p >= 1) { st.act = 'idle'; st.dur = 0; }
      // camera orbit
      if (st.auto && !drag) st.yaw += dt * .35; else if (!drag) { st.yaw += st.vyaw; st.vyaw *= .92; }
      cam.position.set(Math.sin(st.yaw) * st.dist * Math.cos(st.pitch), target.y + Math.sin(st.pitch) * st.dist, Math.cos(st.yaw) * st.dist * Math.cos(st.pitch)); cam.lookAt(target);
      // defaults (idle pose), then action overrides
      const br = rm ? 0 : Math.sin(t * 2.1);
      let bodyY = br * .025, bodyRotY = 0, bodyRotZ = rm ? 0 : Math.sin(t * 1.05) * .02, torsoS = 1 + br * .012;
      let armL = { z: -.16 - br * .03, x: 0 }, armR = { z: .16 + br * .03, x: 0 }, elbL = -.15, elbR = -.15;
      let headX = 0, headY = 0, headZ = rm ? 0 : Math.sin(t * .9) * .03, mouthOpen = 0, smile = 1, browUp = 0, lidClose = 0, lidL = 0, lidR = 0, legL = 0, legR = 0, blushK = .55;
      if (!rm) { bodyRotZ += Math.sin(t * .37) * .025; headY += Math.sin(t * .23) * .06; }
      P.bulb.visible = false; P.heart.visible = false; P.zz.forEach(z => z.visible = false);
      if (a === 'wave') { const q = bell(p); armR = { z: lerp(.16, 2.6, ease(Math.min(1, p * 3))) * (p < .85 ? 1 : (1 - p) / .15), x: 0 }; elbR = -.3 + Math.sin(t * 12) * .5 * q; headZ += .12 * q; smile = 1.2; mouthOpen = .25 * q; }
      else if (a === 'nod') { headX = Math.sin(p * Math.PI * 4) * .18 * bell(p); smile = 1.1; }
      else if (a === 'think') { const q = bell(p); armR = { z: .16 - .2 * q, x: -1.05 * q }; elbR = -2.25 * q - .15; headZ = .16 * q; headX = -.12 * q; P.bulb.visible = p > .25; P.bulb.position.y = 1.95 + Math.sin(t * 4) * .03; P.bulb.scale.setScalar(Math.min(1, (p - .25) * 6)); browUp = .5 * q; smile = .6; st.lookY = -.6 * q; }
      else if (a === 'celebrate' || a === 'cheer') { const jump = a === 'celebrate' ? Math.abs(Math.sin(p * Math.PI * 2)) * .45 : Math.abs(Math.sin(p * Math.PI * 3)) * .2; bodyY += jump; if (a === 'celebrate') bodyRotY = ease(Math.min(1, p * 1.3)) * Math.PI * 2; armL = { z: -2.7, x: 0 }; armR = { z: 2.7, x: 0 }; elbL = elbR = -.2 + Math.sin(t * 16) * .15; mouthOpen = .8; smile = 1.4; browUp = .6; legL = -jump; legR = jump * .6; }
      else if (a === 'point-left' || a === 'point-right') { const s = a === 'point-left' ? -1 : 1, q = ease(Math.min(1, p * 3)) * (p < .85 ? 1 : (1 - p) / .15); if (s > 0) { armR = { z: 1.45 * q + .16, x: -.2 * q }; elbR = -.05; } else { armL = { z: -1.45 * q - .16, x: -.2 * q }; elbL = -.05; } headY = .45 * s * q; st.lookX = s; smile = 1.1; }
      else if (a === 'sleep') { const q = Math.min(1, p * 4) * (p < .9 ? 1 : (1 - p) / .1); lidClose = q; headX = .28 * q; headZ = .15 * q; smile = .4; bodyY -= .03 * q; P.zz.forEach((z, i) => { const ph = ((t * .45 + i / 3) % 1); z.visible = q > .5; z.position.set(.35 + ph * .35, 2.0 + ph * .6, .2); z.material.opacity = 1 - ph; z.scale.setScalar(.14 + ph * .14); }); }
      else if (a === 'dance') { const b = t * 7; bodyRotZ = Math.sin(b) * .14; bodyY += Math.abs(Math.sin(b)) * .08; armL = { z: -1.2 - Math.sin(b) * .5, x: .3 }; armR = { z: 1.2 - Math.sin(b) * .5, x: .3 }; elbL = elbR = -1 + Math.sin(b * 2) * .3; headZ = -Math.sin(b) * .15; legL = Math.max(0, Math.sin(b)) * .4; legR = Math.max(0, -Math.sin(b)) * .4; smile = 1.3; mouthOpen = .3; }
      else if (a === 'shy') { const q = bell(p); armL = { z: -.16 + .45 * q, x: -.55 * q }; armR = { z: .16 - .45 * q, x: -.55 * q }; elbL = elbR = -.15 - .9 * q + Math.sin(t * 9) * .12 * q; headX = .22 * q; st.lookY = .5 * q; headZ = .12 * q; blushK = .55 + .45 * q; lidClose = .45 * q; smile = 1.2; }
      else if (a === 'surprised') { const q = bell(p); bodyY += Math.sin(Math.min(1, p * 2) * Math.PI) * .15; browUp = 1 * q; mouthOpen = 1 * q; smile = 0; armL = { z: -.7 * q - .16, x: 0 }; armR = { z: .7 * q + .16, x: 0 }; }
      else if (a === 'breathe') { const cyc = (t - st.t0) % 8, inh = cyc < 4 ? ease(cyc / 4) : 1 - ease((cyc - 4) / 4); torsoS = 1 + inh * .06; armL.z -= inh * .25; armR.z += inh * .25; lidClose = .55; headX = -.06 * inh; P.heart.visible = true; P.heart.scale.setScalar(.9 + inh * .4); P.heart.position.y = 2.05 + inh * .1; smile = .9; }
      else if (a === 'stretch') { const q = bell(p); armL = { z: -2.9 * q - .16, x: 0 }; armR = { z: 2.9 * q + .16, x: 0 }; bodyY += .06 * q; lidClose = .6 * q; mouthOpen = .9 * q; smile = 0; torsoS = 1 + .04 * q; }
      else if (a === 'thumbs') { const q = bell(p); armR = { z: .5 * q + .16, x: -1.1 * q }; elbR = -1.1 * q - .1; headZ = -.08 * q; smile = 1.4; browUp = .3 * q; }
      else if (a === 'listen') { const q = bell(p); headZ = .22 * q; headX = -.05 * q; browUp = .3 * q; }
      else if (a === 'laugh') { const q = bell(p); headX = -.2 * q; bodyY += Math.abs(Math.sin(t * 17)) * .04 * q; bodyRotZ += Math.sin(t * 8.5) * .05 * q; armL = { z: -.35 * q - .16, x: -.7 * q }; armR = { z: .35 * q + .16, x: -.7 * q }; elbL = elbR = -1.1 * q - .15; mouthOpen = .95 * q; smile = 1.5; lidClose = .6 * q; browUp = .45 * q; blushK = .55 + .35 * q; }
      else if (a === 'wink') { const q = bell(p); lidR = q; headZ = -.16 * q; smile = 1.45; armR = { z: .7 * q + .16, x: -1.1 * q }; elbR = -.8 * q - .15; browUp = .2 * q; }
      else if (a === 'giggle') { const q = bell(p); armR = { z: -.15 * q + .16, x: -1.35 * q }; elbR = -2.3 * q - .1; headX = .1 * q; headZ = .1 * q; bodyY += Math.abs(Math.sin(t * 14)) * .03 * q; lidClose = .45 * q; smile = 1.35; blushK = .95; }
      else if (a === 'hop') { const j = Math.sin(Math.min(1, p) * Math.PI); bodyY += j * .38; legL = legR = j * .5; armL = { z: -.9 * j - .16, x: 0 }; armR = { z: .9 * j + .16, x: 0 }; smile = 1.35; mouthOpen = .35 * j; browUp = .4 * j; }
      else if (a === 'yawn') { const q = bell(p); mouthOpen = q; lidClose = .75 * q; headX = -.18 * q; armR = { z: 2.4 * q + .16, x: 0 }; armL = { z: -.2 * q - .16, x: -1.2 * q }; elbL = -1.7 * q - .1; smile = 0; torsoS = 1 + .03 * q; }
      else if (a === 'facepalm') { const q = bell(p); armR = { z: .05 + .1 * q, x: -1.55 * q }; elbR = -2.05 * q - .1; headX = .28 * q; headZ = .08 * q; lidClose = .85 * q; smile = .8; bodyY -= .03 * q; }
      else if (a === 'heart') { const q = bell(p); armL = { z: -2.3 * q - .16, x: -.35 * q }; armR = { z: 2.3 * q + .16, x: -.35 * q }; elbL = elbR = -1.7 * q - .15; P.heart.visible = q > .3; P.heart.position.set(0, 3.05 + Math.sin(t * 6) * .04, .25); P.heart.scale.setScalar(1.4 + Math.sin(t * 10) * .15); smile = 1.45; lidClose = .3 * q; blushK = .9; }
      else if (a === 'lookaround') { const q = bell(p); headY = Math.sin(p * Math.PI * 2) * .7 * q; st.lookX = Math.sin(p * Math.PI * 2) * q; browUp = .2 * q; }
      else if (a === 'tap') { const q = bell(p); legR = Math.abs(Math.sin(t * 9)) * .3 * q; headZ = Math.sin(t * 4.5) * .07 * q; armL = { z: -.2, x: 0 }; smile = 1.2; }
      else if (!rm && st.clock > st.idleNext) { st.idleNext = st.clock + 7 + Math.random() * 9; const idles = ['nod', 'listen', 'stretch', 'thumbs', 'wink', 'giggle', 'lookaround', 'tap', 'hop', 'yawn']; play(idles[Math.floor(Math.random() * idles.length)]); }
      if (smile >= 1.3 && a !== 'wink') lidClose = Math.max(lidClose, .28);
      // blink
      if (st.blinkT < 0 && t > st.blinkAt) { st.blinkT = 0; }
      if (st.blinkT >= 0) { st.blinkT += dt; const b = st.blinkT / .16; lidClose = Math.max(lidClose, b < 1 ? Math.sin(b * Math.PI) : 0); if (b >= 1) { st.blinkT = -1; st.blinkAt = t + 2 + Math.random() * 3.5; } }
      // talk
      if (t < st.talkUntil) mouthOpen = Math.max(mouthOpen, .35 + Math.abs(Math.sin(t * 18)) * .45);
      // apply
      P.body.position.y = lerp(P.body.position.y, bodyY, k * 1.5); P.body.rotation.y = a === 'celebrate' ? bodyRotY : lerp(P.body.rotation.y, bodyRotY, k); P.body.rotation.z = lerp(P.body.rotation.z, bodyRotZ, k);
      P.torso.scale.set(1 + (torsoS - 1) * .6, torsoS, 1 + (torsoS - 1) * .6);
      const ap = (arm, o) => { arm.rotation.z = lerp(arm.rotation.z, o.z, k); arm.rotation.x = lerp(arm.rotation.x, o.x, k); };
      ap(P.armL, armL); ap(P.armR, armR); P.elbL.rotation.x = lerp(P.elbL.rotation.x, elbL, k); P.elbR.rotation.x = lerp(P.elbR.rotation.x, elbR, k);
      P.legL.rotation.x = lerp(P.legL.rotation.x, -legL, k); P.legR.rotation.x = lerp(P.legR.rotation.x, -legR, k);
      st.lx = lerp(st.lx, st.lookX, k * .6); st.ly = lerp(st.ly, st.lookY, k * .6);
      P.head.rotation.y = lerp(P.head.rotation.y, headY + st.lx * .45, k); P.head.rotation.x = lerp(P.head.rotation.x, headX + st.ly * .22, k); P.head.rotation.z = lerp(P.head.rotation.z, headZ, k);
      P.eyes.forEach(({ pup }) => { pup.position.x = st.lx * .028; pup.position.y = -st.ly * .025; });
      P.lids.forEach((l, i) => { l.scale.y = lerp(l.scale.y, .02 + Math.max(lidClose, i ? lidR : lidL) * 1.08, Math.min(1, dt * 30)); });
      P.brows.forEach((b, i) => { b.position.y = .175 + browUp * .05; b.rotation.z = Math.PI / 2 + (i ? -1 : 1) * (.12 - browUp * .15); });
      P.cheeks.forEach(c => { c.material.opacity = blushK; });
      P.mouth.scale.y = lerp(P.mouth.scale.y, .08 + mouthOpen * .9, Math.min(1, dt * 20)); P.mouth.visible = P.mouth.scale.y > .12;
      P.smile.visible = !P.mouth.visible || mouthOpen < .5; P.smile.scale.set(1, Math.max(.15, smile), 1);
      // hair tuft bounces like a spring
      st.tv = (st.tv || 0) + ((P.body.position.y - (st.ty || 0)) * -14 - (P.tuft.rotation.x + .0) * 30) * dt - (st.tv || 0) * 4 * dt; st.ty = P.body.position.y;
      P.tuft.rotation.x = Math.max(-.6, Math.min(.6, P.tuft.rotation.x + st.tv * dt * 8)); P.tuft.rotation.z = Math.sin(t * 2.7) * .07 - P.body.rotation.z * 1.4;
      P.scarfTail.rotation.z = .5 + Math.sin(t * 2.6) * .08;
      P.shadow.scale.setScalar(1 - Math.min(.4, P.body.position.y * .8));
      // stars
      P.stars.forEach(s => { if (!s.visible) return; const u = s.userData, e = st.clock - u.t0; if (e > 1.6) { s.visible = false; return; } s.position.set(Math.cos(u.a) * u.v * e, 1.6 + u.up * e - 2.4 * e * e, Math.sin(u.a) * u.v * e * .6 + .2); s.material.opacity = 1 - e / 1.6; });
    }
    const VIEWS = { front: [0, .08], right: [Math.PI / 2, .08], back: [Math.PI, .08], left: [-Math.PI / 2, .08], top: [0, 1.05], three: [.6, .25] };
    function view(n) { const v = VIEWS[n] || VIEWS.front; st.auto = false; const y0 = st.yaw, p0 = st.pitch, t0 = performance.now(); let y1 = v[0]; while (y1 - y0 > Math.PI) y1 -= Math.PI * 2; while (y0 - y1 > Math.PI) y1 += Math.PI * 2; (function step() { const q = Math.min(1, (performance.now() - t0) / 600), e = ease(q); st.yaw = y0 + (y1 - y0) * e; st.pitch = p0 + (v[1] - p0) * e; if (q < 1) requestAnimationFrame(step); })(); }
    loop();
    return {
      play, say, view, mood(m) { st.mood = m; },
      look(x, y) { st.lookX = x; st.lookY = y; },
      autoRotate(on) { st.auto = !!on; },
      el, destroy() { st.running = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onGlobalMove); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); if (io) io.disconnect(); renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); el.innerHTML = ''; el.classList.remove('emi-host'); }
    };
  }
  function supported() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  window.Emi = { mount, supported, actions: Object.keys(ACTIONS) };
})();
