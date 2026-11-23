/* Ava (formerly Emi) — the ME.Coach coach. A procedural 3D character built with three.js (assets/vendor/three.min.js).
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
    const skin = mat(0xe8b596, { roughness: .6 }), skinDk = mat(0xd99f80, { roughness: .7 }), shirt = mat(0xf7f6f2, { roughness: .78 }), shirtSh = mat(0xe4e2dc, { roughness: .8 }),
      tieM = mat(0x3b82c4, { roughness: .45 }), tieDk = mat(0x2f6aa3, { roughness: .5 }), belt = mat(0x8a5a32, { roughness: .45 }), buckle = mat(0xc8a24a, { roughness: .3, metalness: .6 }),
      pants = mat(0x3d4250, { roughness: .7 }), shoe = mat(0x2a2522, { roughness: .4 }), hairM = mat(0x5b3a29, { roughness: .55 }), hairHi = mat(0x6e4934, { roughness: .5 }),
      white = mat(C.white, { roughness: .25 }), ink = mat(0x24201f, { roughness: .35 }), rim = mat(0x1d1d22, { roughness: .3, metalness: .4 }), lens = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .12, roughness: .05, metalness: .1 }),
      blush = mat(0xf0938f, { transparent: true, opacity: .45, roughness: 1 }), lip = mat(0xc4606a, { roughness: .5 });
    const root = G(), body = G(); root.add(body); const P = {};
    // legs: slim trousers, dark shoes
    for (const s of [-1, 1]) {
      const hip = G(); hip.position.set(.14 * s, .78, 0); body.add(hip);
      const leg = M(new THREE.CapsuleGeometry(.105, .5, 6, 14), pants); leg.position.y = -.33; hip.add(leg);
      const sh = M(new THREE.SphereGeometry(.11, 18, 12), shoe); sh.scale.set(.9, .55, 1.55); sh.position.set(0, -.7, .06); hip.add(sh);
      P[s < 0 ? 'legL' : 'legR'] = hip;
    }
    // torso: white shirt, belt, blue tie, collar
    const torso = G(); torso.position.y = .78; body.add(torso); P.torso = torso;
    const hips = M(new THREE.SphereGeometry(.26, 24, 16), pants); hips.scale.set(.98, .45, .8); hips.position.y = .0; torso.add(hips);
    const chest = M(new THREE.CapsuleGeometry(.29, .38, 10, 24), shirt); chest.scale.set(1.04, 1, .78); chest.position.y = .42; torso.add(chest);
    const waist = M(new THREE.CylinderGeometry(.255, .27, .08, 28), belt); waist.scale.set(1.04, 1, .82); waist.position.y = .1; torso.add(waist);
    const bk = M(new THREE.BoxGeometry(.07, .055, .02), buckle); bk.position.set(0, .1, .232); torso.add(bk);
    const tie = G(); tie.position.set(0, .8, .228); torso.add(tie); P.scarfTail = tie;
    const knot = M(new THREE.ConeGeometry(.04, .06, 4), tieDk); knot.rotation.set(Math.PI, Math.PI / 4, 0); knot.position.y = -.01; tie.add(knot);
    const blade = M(new THREE.BoxGeometry(.075, .5, .015), tieM); blade.position.y = -.28; tie.add(blade);
    const tip = M(new THREE.ConeGeometry(.054, .06, 4), tieM); tip.rotation.set(Math.PI, Math.PI / 4, 0); tip.scale.set(1, 1, .25); tip.position.y = -.555; tie.add(tip);
    for (const s of [-1, 1]) { const col = M(new THREE.BoxGeometry(.13, .05, .015), shirt); col.position.set(.06 * s, .835, .225); col.rotation.set(-.3, 0, -.55 * s); torso.add(col); }
    // arms: shirt sleeves rolled to the elbow
    for (const s of [-1, 1]) {
      const sho = G(); sho.position.set(.36 * s, .7, 0); torso.add(sho);
      const up = M(new THREE.CapsuleGeometry(.085, .26, 6, 12), shirt); up.position.y = -.17; sho.add(up);
      const elb = G(); elb.position.y = -.34; sho.add(elb);
      const roll = M(new THREE.TorusGeometry(.078, .03, 8, 18), shirtSh); roll.rotation.x = Math.PI / 2; roll.position.y = .0; elb.add(roll);
      const fo = M(new THREE.CapsuleGeometry(.06, .2, 6, 12), skin); fo.position.y = -.13; elb.add(fo);
      const hand = M(new THREE.SphereGeometry(.07, 18, 12), skin); hand.scale.set(.85, 1.15, .7); hand.position.y = -.3; elb.add(hand);
      const thumb = M(new THREE.CapsuleGeometry(.022, .045, 4, 8), skin); thumb.position.set(.045 * -s, -.27, .035); thumb.rotation.z = .6 * s; elb.add(thumb);
      sho.rotation.z = .1 * s; elb.rotation.x = -.15;
      P[s < 0 ? 'armL' : 'armR'] = sho; P[s < 0 ? 'elbL' : 'elbR'] = elb;
    }
    // neck and head
    const neck = G(); neck.position.y = .86; torso.add(neck); P.neck = neck;
    const nk = M(new THREE.CylinderGeometry(.06, .07, .16, 14), skin); nk.position.y = .06; neck.add(nk);
    const head = G(); head.position.y = .4; neck.add(head); P.head = head;
    const skull = M(new THREE.SphereGeometry(.34, 40, 30), skin); skull.scale.set(.92, 1.1, .95); head.add(skull);
    const jaw = M(new THREE.SphereGeometry(.2, 24, 16), skin); jaw.scale.set(1, .85, .85); jaw.position.set(0, -.16, .04); head.add(jaw);
    for (const s of [-1, 1]) { const ear = M(new THREE.SphereGeometry(.06, 14, 10), skin); ear.scale.set(.5, 1, .7); ear.position.set(.315 * s, -.02, -.01); head.add(ear); }
    // hair: shoulder-length waves, side parting, a bouncy front lock
    const back = M(new THREE.SphereGeometry(.4, 32, 24), hairM); back.scale.set(1.02, 1.18, .9); back.position.set(0, .0, -.1); head.add(back);
    const cap = M(new THREE.SphereGeometry(.36, 36, 22, 0, Math.PI * 2, 0, Math.PI * .5), hairM); cap.scale.set(1.0, 1.0, 1.03); cap.position.set(0, .05, 0); cap.rotation.x = -.3; head.add(cap);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const lock = M(new THREE.CapsuleGeometry(.075 - i * .01, .34 - i * .05, 6, 10), i % 2 ? hairHi : hairM); lock.position.set((.27 + i * .03) * s, -.28 - i * .03, -.04 - i * .07); lock.rotation.set(.15 + i * .1, 0, (.18 - i * .06) * s); head.add(lock); const curl = M(new THREE.SphereGeometry(.07 - i * .008, 12, 10), hairM); curl.position.set((.31 + i * .04) * s, -.5 - i * .03, -.02 - i * .07); head.add(curl); }
    const tuft = G(); tuft.position.set(-.08, .26, .24); head.add(tuft); P.tuft = tuft;
    const fr = M(new THREE.SphereGeometry(.2, 24, 16), hairM); fr.scale.set(1.25, .42, .55); fr.rotation.set(-.35, 0, -.42); fr.position.set(.1, -.06, -.02); tuft.add(fr);
    const fr2 = M(new THREE.SphereGeometry(.12, 18, 12), hairHi); fr2.scale.set(1.3, .45, .55); fr2.rotation.set(-.3, 0, .35); fr2.position.set(-.1, -.03, -.06); tuft.add(fr2);
    // face
    const face = G(); face.position.z = .3; head.add(face); P.face = face;
    P.eyes = []; P.lids = []; P.brows = [];
    for (const s of [-1, 1]) {
      const eye = G(); eye.position.set(.115 * s, .02, .015); face.add(eye);
      const scl = M(new THREE.SphereGeometry(.068, 22, 16), white); scl.scale.set(1.05, .78, .45); eye.add(scl);
      const pup = G(); eye.add(pup);
      const iris = M(new THREE.SphereGeometry(.043, 18, 14), mat(0x5e3b24, { roughness: .2 })); iris.scale.set(1, 1, .45); iris.position.z = .022; pup.add(iris);
      const pp = M(new THREE.SphereGeometry(.023, 14, 10), ink); pp.scale.set(1, 1, .45); pp.position.z = .034; pup.add(pp);
      const hl = M(new THREE.SphereGeometry(.011, 8, 6), white); hl.position.set(.014, .016, .044); pup.add(hl);
      const lid = M(new THREE.SphereGeometry(.072, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin); lid.scale.set(1.05, .85, .5); lid.position.z = .003; eye.add(lid); lid.scale.y = .02;
      const liner = M(new THREE.CapsuleGeometry(.009, .1, 3, 8), ink); liner.rotation.z = Math.PI / 2 + .12 * s; liner.position.set(.004 * s, .042, .03); eye.add(liner);
      const lash = M(new THREE.CapsuleGeometry(.006, .03, 3, 6), ink); lash.position.set(.06 * s, .045, .025); lash.rotation.z = -.9 * s; eye.add(lash);
      const brow = M(new THREE.CapsuleGeometry(.011, .085, 4, 8), hairM); brow.rotation.z = Math.PI / 2 + .12 * s; brow.position.set(.115 * s, .118, .025); face.add(brow);
      const cheek = M(new THREE.SphereGeometry(.05, 16, 12), blush); cheek.scale.set(1.3, .7, .3); cheek.position.set(.17 * s, -.08, -.035); face.add(cheek);
      // glasses: thin dark rims
      const rimR = M(new THREE.TorusGeometry(.083, .008, 8, 32), rim); rimR.scale.set(1.12, .82, 1); rimR.position.set(.118 * s, .02, .075); face.add(rimR);
      const glass = M(new THREE.CircleGeometry(.083, 28), lens); glass.scale.set(1.12, .82, 1); glass.position.set(.118 * s, .02, .074); face.add(glass);
      const arm = M(new THREE.BoxGeometry(.006, .008, .3), rim); arm.position.set(.215 * s, .03, -.08); arm.rotation.y = .12 * s; face.add(arm);
      P.eyes.push({ eye, pup }); P.lids.push(lid); P.brows.push(brow); (P.cheeks = P.cheeks || []).push(cheek);
    }
    const bridge = M(new THREE.TorusGeometry(.025, .006, 6, 12, Math.PI), rim); bridge.position.set(0, .035, .08); face.add(bridge); P.glassesY = 0;
    const nose = M(new THREE.SphereGeometry(.024, 14, 10), skinDk); nose.position.set(0, -.07, .045); nose.scale.set(1, .9, 1.1); face.add(nose);
    const smile = M(new THREE.TorusGeometry(.05, .011, 8, 24, Math.PI), lip); smile.rotation.z = Math.PI; smile.position.set(0, -.15, .01); face.add(smile); P.smile = smile;
    const mouth = M(new THREE.SphereGeometry(.045, 20, 14), mat(0x7a2f3a, { roughness: .6 })); mouth.scale.set(1, .1, .35); mouth.position.set(0, -.16, .005); face.add(mouth); P.mouth = mouth;
    const teeth = M(new THREE.BoxGeometry(.05, .012, .01), white); teeth.position.set(0, .02, .012); mouth.add(teeth);
    // props
    const bulb = G(); bulb.position.set(.38, 2.0, .1); body.add(bulb); bulb.visible = false; P.bulb = bulb;
    bulb.add(M(new THREE.SphereGeometry(.1, 20, 16), mat(0xffe27a, { emissive: 0xffd34a, emissiveIntensity: .9, transparent: true, opacity: .95 })));
    const heart = M(new THREE.SphereGeometry(.09, 16, 12), mat(0xe8607a, { emissive: 0xe8607a, emissiveIntensity: .35 })); heart.scale.set(1.2, 1, .6); heart.position.set(0, 2.2, .2); heart.visible = false; body.add(heart); P.heart = heart;
    P.zz = []; for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('Z', { fg: '#5b6fb3', font: '900 80px system-ui, sans-serif' }), transparent: true, depthWrite: false })); s.scale.set(.2, .2, 1); s.visible = false; body.add(s); P.zz.push(s); }
    P.stars = []; const starCols = ['#d4ae36', '#3b82c4', '#1baf7a', '#eb6834', '#e87ba4'];
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('★', { fg: starCols[i % 5], font: '900 96px system-ui, sans-serif' }), transparent: true, depthWrite: false })); s.scale.set(.16, .16, 1); s.visible = false; body.add(s); P.stars.push(s); }
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = .005; root.add(sh); P.shadow = sh;
    P.body = body; P.root = root;
    return P;
  }

  /* ---------- animation ---------- */
  const ACTIONS = { glasses: 1.8, caring: 2.6, proud: 2.4, explain: 3, laugh: 2.4, wink: 1.4, giggle: 1.8, hop: 1.1, yawn: 2.6, facepalm: 2.4, heart: 2.4, lookaround: 2.6, tap: 2, wave: 2.4, nod: 1.4, think: 3.2, celebrate: 2.2, 'point-left': 2, 'point-right': 2, sleep: 6, dance: 3.6, shy: 2.2, surprised: 1.4, breathe: 8, cheer: 2, stretch: 2.6, thumbs: 1.8, listen: 2.4 };

  function mount(el, opt = {}) {
    const THREE = T(); if (!THREE || !el) return null;
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'emi-cv'; renderer.domElement.setAttribute('aria-label', 'Ava, your ME.Coach coach'); renderer.domElement.setAttribute('role', 'img');
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
    const reactions = ['laugh', 'giggle', 'wink', 'glasses', 'heart', 'wave', 'shy', 'proud', 'caring', 'thumbs', 'hop'];
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
      let headX = 0, headY = 0, headZ = rm ? 0 : Math.sin(t * .9) * .03, mouthOpen = 0, smile = 1, browUp = 0, browTilt = 0, lidClose = 0, lidL = 0, lidR = 0, legL = 0, legR = 0, blushK = .45;
      const MD = { happy: [1.15, 0, 0, 0, 0, .5], calm: [.9, 0, 0, .22, 0, .4], excited: [1.4, .4, 0, 0, 0, .8], thinking: [.6, .25, .2, 0, .1, .4], caring: [.85, .1, .55, 0, .15, .6], proud: [1.3, .1, 0, .1, 0, .55], surprised: [.3, .8, 0, 0, 0, .5], focused: [.7, -.1, 0, .15, 0, .35], sad: [.2, .1, .7, .2, .1, .3] }[st.mood] || [1, 0, 0, 0, 0, .45];
      smile = MD[0]; browUp = MD[1]; browTilt = MD[2]; lidClose = MD[3]; headZ += MD[4]; blushK = MD[5];
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
      else if (a === 'glasses') { const q = bell(p); armR = { z: .1, x: -1.45 * q }; elbR = -2.1 * q - .1; headX = .05 * q; smile = 1.1; browUp = .15 * q; }
      else if (a === 'caring') { const q = bell(p); armL = { z: -.05, x: -1.0 * q }; elbL = -1.35 * q - .1; headZ = .18 * q; browTilt = .5 * q; smile = .95; blushK = .7; lidClose = .2 * q; }
      else if (a === 'proud') { const q = bell(p); armL = { z: -.8 * q - .1, x: .15 * q }; armR = { z: .8 * q + .1, x: .15 * q }; elbL = elbR = -1.4 * q - .1; headX = -.1 * q; smile = 1.35; bodyY += .02 * q; }
      else if (a === 'explain') { const q = bell(p); armR = { z: .35 + Math.sin(t * 4) * .18 * q, x: -.7 * q }; elbR = -.9 * q + Math.sin(t * 5) * .25 * q; armL = { z: -.25 - Math.sin(t * 3.3) * .1 * q, x: -.4 * q }; elbL = -.6 * q; headZ = Math.sin(t * 2) * .07; browUp = .15 + Math.sin(t * 3) * .1; smile = 1.1; }
      else if (a === 'laugh') { const q = bell(p); headX = -.2 * q; bodyY += Math.abs(Math.sin(t * 17)) * .04 * q; bodyRotZ += Math.sin(t * 8.5) * .05 * q; armL = { z: -.35 * q - .16, x: -.7 * q }; armR = { z: .35 * q + .16, x: -.7 * q }; elbL = elbR = -1.1 * q - .15; mouthOpen = .95 * q; smile = 1.5; lidClose = .6 * q; browUp = .45 * q; blushK = .55 + .35 * q; }
      else if (a === 'wink') { const q = bell(p); lidR = q; headZ = -.16 * q; smile = 1.45; armR = { z: .7 * q + .16, x: -1.1 * q }; elbR = -.8 * q - .15; browUp = .2 * q; }
      else if (a === 'giggle') { const q = bell(p); armR = { z: -.15 * q + .16, x: -1.35 * q }; elbR = -2.3 * q - .1; headX = .1 * q; headZ = .1 * q; bodyY += Math.abs(Math.sin(t * 14)) * .03 * q; lidClose = .45 * q; smile = 1.35; blushK = .95; }
      else if (a === 'hop') { const j = Math.sin(Math.min(1, p) * Math.PI); bodyY += j * .38; legL = legR = j * .5; armL = { z: -.9 * j - .16, x: 0 }; armR = { z: .9 * j + .16, x: 0 }; smile = 1.35; mouthOpen = .35 * j; browUp = .4 * j; }
      else if (a === 'yawn') { const q = bell(p); mouthOpen = q; lidClose = .75 * q; headX = -.18 * q; armR = { z: 2.4 * q + .16, x: 0 }; armL = { z: -.2 * q - .16, x: -1.2 * q }; elbL = -1.7 * q - .1; smile = 0; torsoS = 1 + .03 * q; }
      else if (a === 'facepalm') { const q = bell(p); armR = { z: .05 + .1 * q, x: -1.55 * q }; elbR = -2.05 * q - .1; headX = .28 * q; headZ = .08 * q; lidClose = .85 * q; smile = .8; bodyY -= .03 * q; }
      else if (a === 'heart') { const q = bell(p); armL = { z: -2.3 * q - .16, x: -.35 * q }; armR = { z: 2.3 * q + .16, x: -.35 * q }; elbL = elbR = -1.7 * q - .15; P.heart.visible = q > .3; P.heart.position.set(0, 3.05 + Math.sin(t * 6) * .04, .25); P.heart.scale.setScalar(1.4 + Math.sin(t * 10) * .15); smile = 1.45; lidClose = .3 * q; blushK = .9; }
      else if (a === 'lookaround') { const q = bell(p); headY = Math.sin(p * Math.PI * 2) * .7 * q; st.lookX = Math.sin(p * Math.PI * 2) * q; browUp = .2 * q; }
      else if (a === 'tap') { const q = bell(p); legR = Math.abs(Math.sin(t * 9)) * .3 * q; headZ = Math.sin(t * 4.5) * .07 * q; armL = { z: -.2, x: 0 }; smile = 1.2; }
      else if (!rm && st.clock > st.idleNext) { st.idleNext = st.clock + 7 + Math.random() * 9; const idles = ['nod', 'listen', 'glasses', 'thumbs', 'wink', 'giggle', 'lookaround', 'tap', 'proud', 'stretch']; play(idles[Math.floor(Math.random() * idles.length)]); }
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
      P.brows.forEach((b, i) => { b.position.y = .118 + browUp * .03; b.rotation.z = Math.PI / 2 + (i ? -1 : 1) * (.12 - browUp * .12 - browTilt * .45); });
      P.cheeks.forEach(c => { c.material.opacity = blushK; });
      P.mouth.scale.y = lerp(P.mouth.scale.y, .08 + mouthOpen * .9, Math.min(1, dt * 20)); P.mouth.visible = P.mouth.scale.y > .12;
      P.smile.visible = !P.mouth.visible || mouthOpen < .5; P.smile.scale.set(1, Math.max(.15, Math.abs(smile - .35) + .15), 1); P.smile.rotation.z = smile < .35 ? 0 : Math.PI; P.smile.position.y = smile < .35 ? -.165 : -.15;
      // hair tuft bounces like a spring
      st.tv = (st.tv || 0) + ((P.body.position.y - (st.ty || 0)) * -14 - (P.tuft.rotation.x + .0) * 30) * dt - (st.tv || 0) * 4 * dt; st.ty = P.body.position.y;
      P.tuft.rotation.x = Math.max(-.6, Math.min(.6, P.tuft.rotation.x + st.tv * dt * 8)); P.tuft.rotation.z = Math.sin(t * 2.7) * .07 - P.body.rotation.z * 1.4;
      P.scarfTail.rotation.z = Math.sin(t * 2.6) * .03 - P.body.rotation.z * .6; P.scarfTail.rotation.x = Math.max(-.4, -P.body.position.y * .8);
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
