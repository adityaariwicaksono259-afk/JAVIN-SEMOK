const $ = (id) => document.getElementById(id);
const DATA = window.WORKOUT_DATA;

// ===== PARSE QUERY =====
const params = new URLSearchParams(location.search);
const exKey = params.get('ex') || 'pushup';
const ex = DATA.exercises[exKey] || DATA.exercises.pushup;

$('exTitle').textContent = ex.name;
$('exName').textContent = ex.name;
$('exDesc').textContent = ex.desc;
$('exTarget').textContent = ex.target;
$('exIcon').textContent = ex.icon;

// ===== THREE.JS SETUP =====
let scene, camera, renderer, stickman;
let playing = true;
let speed = 1;
let animTime = 0;

function initThree() {
  const canvas = $('exCanvas');
  const wrap = canvas.parentElement;
  const w = wrap.clientWidth;
  const h = Math.min(w * 1.1, 400);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e14);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 1.5, 5);
  camera.lookAt(0, 1, 0);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 5, 4);
  scene.add(dir);
  const fill = new THREE.PointLight(0x128c7e, 0.5);
  fill.position.set(-3, 2, 2);
  scene.add(fill);

  // Floor
  const floorGeo = new THREE.CircleGeometry(3, 32);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1f24, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  scene.add(floor);

  // Grid
  const grid = new THREE.GridHelper(6, 12, 0x128c7e, 0x1a3a35);
  grid.position.y = 0;
  scene.add(grid);

  // Build stickman
  stickman = buildStickman();
  scene.add(stickman.root);

  window.addEventListener('resize', onResize);
  onResize();

  setTimeout(() => $('exLoading').classList.add('hidden'), 500);
  animate();
}

function onResize() {
  const wrap = $('exCanvas').parentElement;
  const w = wrap.clientWidth;
  const h = Math.min(w * 1.1, 400);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ===== BUILD STICK FIGURE =====
function buildStickman() {
  const root = new THREE.Group();
  root.position.y = 0.05;

  const COLOR_HEAD = 0xffd700;
  const COLOR_BODY = 0x128c7e;
  const COLOR_LIMB = 0x25d366;

  const matHead = new THREE.MeshStandardMaterial({ color: COLOR_HEAD, roughness: 0.4, metalness: 0.2 });
  const matBody = new THREE.MeshStandardMaterial({ color: COLOR_BODY, roughness: 0.5 });
  const matLimb = new THREE.MeshStandardMaterial({ color: COLOR_LIMB, roughness: 0.5 });

  // HEAD
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), matHead);
  head.position.y = 2.35;
  root.add(head);

  // NECK
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), matBody);
  neck.position.y = 2.12;
  root.add(neck);

  // TORSO
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 12), matBody);
  torso.position.y = 1.78;
  root.add(torso);

  // HIPS
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), matBody);
  hips.position.y = 1.42;
  root.add(hips);

  // ARMS (rotating groups)
  function buildArm(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.22, 2.0, 0);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 4, 8), matLimb);
    upper.position.y = -0.22;
    g.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.45;
    g.add(elbow);

    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.32, 4, 8), matLimb);
    fore.position.y = -0.2;
    elbow.add(fore);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), matHead);
    hand.position.y = -0.4;
    elbow.add(hand);

    g.userData.elbow = elbow;
    return g;
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);
  root.add(armL);
  root.add(armR);

  // LEGS
  function buildLeg(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.11, 1.4, 0);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), matLimb);
    upper.position.y = -0.28;
    g.add(upper);

    const knee = new THREE.Group();
    knee.position.y = -0.56;
    g.add(knee);

    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.38, 4, 8), matLimb);
    fore.position.y = -0.23;
    knee.add(fore);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.2), matHead);
    foot.position.set(0, -0.44, 0.07);
    knee.add(foot);

    g.userData.knee = knee;
    return g;
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);
  root.add(legL);
  root.add(legR);

  return { root, head, torso, hips, armL, armR, legL, legR };
}

// ===== ANIMATIONS =====
function animateStickman(t) {
  const s = stickman;
  // Reset base pose
  s.root.rotation.set(0, 0, 0);
  s.root.position.set(0, 0.05, 0);
  s.head.position.set(0, 2.35, 0);
  s.torso.position.set(0, 1.78, 0);
  s.torso.rotation.set(0, 0, 0);
  s.hips.position.set(0, 1.42, 0);
  s.armL.rotation.set(0, 0, 0);
  s.armR.rotation.set(0, 0, 0);
  s.armL.userData.elbow.rotation.set(0, 0, 0);
  s.armR.userData.elbow.rotation.set(0, 0, 0);
  s.legL.rotation.set(0, 0, 0);
  s.legR.rotation.set(0, 0, 0);
  s.legL.userData.knee.rotation.set(0, 0, 0);
  s.legR.userData.knee.rotation.set(0, 0, 0);
  s.legL.position.set(-0.11, 1.4, 0);
  s.legR.position.set(0.11, 1.4, 0);

  const anim = ex.anim || 'pushup';
  const cycle = Math.sin(t * 2 * speed);

  if (anim === 'pushup') {
    // Body horizontal, up-down
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 1.2 + cycle * 0.15;
    s.armL.rotation.z = 0.6 + cycle * 0.5;
    s.armR.rotation.z = -0.6 - cycle * 0.5;
    s.armL.userData.elbow.rotation.z = -0.3 - cycle * 0.4;
    s.armR.userData.elbow.rotation.z = 0.3 + cycle * 0.4;
  } else if (anim === 'plank') {
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 1.2 + Math.sin(t * 8 * speed) * 0.01;
  } else if (anim === 'dips') {
    s.root.position.y = 0.7 + cycle * 0.15;
    s.armL.rotation.x = -0.3;
    s.armR.rotation.x = -0.3;
    s.legL.userData.knee.rotation.x = 0.8;
    s.legR.userData.knee.rotation.x = 0.8;
  } else if (anim === 'squat') {
    const down = Math.abs(cycle) * 0.35;
    s.root.position.y = 0.05 - down;
    s.legL.rotation.x = 0.9 * Math.abs(cycle);
    s.legR.rotation.x = 0.9 * Math.abs(cycle);
    s.legL.userData.knee.rotation.x = -1.6 * Math.abs(cycle);
    s.legR.userData.knee.rotation.x = -1.6 * Math.abs(cycle);
    s.armL.rotation.x = -0.8 * Math.abs(cycle);
    s.armR.rotation.x = -0.8 * Math.abs(cycle);
  } else if (anim === 'jumpingjack') {
    const spread = Math.abs(cycle) * 0.9;
    s.armL.rotation.z = spread;
    s.armR.rotation.z = -spread;
    s.legL.rotation.z = spread * 0.4;
    s.legR.rotation.z = -spread * 0.4;
    s.root.position.y = 0.05 + Math.max(0, cycle) * 0.15;
  } else if (anim === 'burpees') {
    // Kombinasi squat + pushup
    const phase = (t * speed) % 2;
    if (phase < 1) {
      const down = Math.abs(cycle) * 0.35;
      s.root.position.y = 0.05 - down;
      s.legL.rotation.x = 0.9 * Math.abs(cycle);
      s.legR.rotation.x = 0.9 * Math.abs(cycle);
      s.legL.userData.knee.rotation.x = -1.6 * Math.abs(cycle);
      s.legR.userData.knee.rotation.x = -1.6 * Math.abs(cycle);
    } else {
      s.root.rotation.x = -Math.PI / 2.4;
      s.root.position.y = 1.2 + cycle * 0.15;
      s.armL.rotation.z = 0.6 + cycle * 0.5;
      s.armR.rotation.z = -0.6 - cycle * 0.5;
    }
  } else if (anim === 'mountain') {
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 1.2;
    const legPhase = (t * 4 * speed) % (Math.PI * 2);
    s.legL.rotation.x = Math.sin(legPhase) * 0.8;
    s.legR.rotation.x = Math.sin(legPhase + Math.PI) * 0.8;
    s.legL.userData.knee.rotation.x = -1.2 - Math.sin(legPhase) * 0.5;
    s.legR.userData.knee.rotation.x = -1.2 - Math.sin(legPhase + Math.PI) * 0.5;
  } else if (anim === 'highknee') {
    const legPhase = (t * 5 * speed) % (Math.PI * 2);
    s.legL.rotation.x = -Math.max(0, Math.sin(legPhase)) * 1.2;
    s.legR.rotation.x = -Math.max(0, Math.sin(legPhase + Math.PI)) * 1.2;
    s.legL.userData.knee.rotation.x = Math.max(0, Math.sin(legPhase)) * -1.5;
    s.legR.userData.knee.rotation.x = Math.max(0, Math.sin(legPhase + Math.PI)) * -1.5;
    s.armL.rotation.x = Math.sin(legPhase) * 0.8;
    s.armR.rotation.x = Math.sin(legPhase + Math.PI) * 0.8;
  } else if (anim === 'skater') {
    const side = Math.sin(t * 2 * speed);
    s.root.rotation.z = side * 0.15;
    s.legL.rotation.z = side * 0.4;
    s.legR.rotation.z = -side * 0.4;
    s.armL.rotation.z = 0.4 + side * 0.3;
    s.armR.rotation.z = -0.4 + side * 0.3;
  } else if (anim === 'lunges') {
    const phase = Math.sin(t * 2 * speed);
    s.legL.rotation.x = phase * 0.8;
    s.legR.rotation.x = -phase * 0.8;
    s.legL.userData.knee.rotation.x = -Math.abs(phase) * 1.4;
    s.legR.userData.knee.rotation.x = -Math.abs(phase) * 1.4;
    s.root.position.y = 0.05 - Math.abs(phase) * 0.15;
  } else if (anim === 'calf') {
    const up = Math.max(0, cycle);
    s.root.position.y = 0.05 + up * 0.15;
    s.legL.rotation.x = -up * 0.3;
    s.legR.rotation.x = -up * 0.3;
  } else if (anim === 'wallsit') {
    s.root.position.y = 0.05 - 0.3;
    s.legL.rotation.x = 1.4;
    s.legR.rotation.x = 1.4;
    s.legL.userData.knee.rotation.x = -1.6;
    s.legR.userData.knee.rotation.x = -1.6;
    s.armL.rotation.x = -0.4;
    s.armR.rotation.x = -0.4;
  } else if (anim === 'bridge') {
    s.root.rotation.x = -Math.PI / 2.6;
    s.root.position.y = 1.0 + Math.abs(cycle) * 0.2;
  } else if (anim === 'crunch') {
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 1.1;
    s.torso.rotation.x = -Math.abs(cycle) * 0.5;
    s.armL.rotation.x = -Math.abs(cycle) * 0.8;
    s.armR.rotation.x = -Math.abs(cycle) * 0.8;
  } else if (anim === 'situp') {
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 1.1;
    s.torso.rotation.x = -Math.abs(cycle) * 0.9;
    s.head.position.y = 2.35 - Math.abs(cycle) * 0.3;
    s.armL.rotation.x = -Math.abs(cycle) * 0.6;
    s.armR.rotation.x = -Math.abs(cycle) * 0.6;
  } else if (anim === 'legraise') {
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 1.1;
    s.legL.rotation.x = -Math.abs(cycle) * 1.3;
    s.legR.rotation.x = -Math.abs(cycle) * 1.3;
  } else if (anim === 'russian') {
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 1.1;
    s.torso.rotation.x = -0.6;
    s.torso.rotation.z = Math.sin(t * 3 * speed) * 0.5;
    s.armL.rotation.x = -0.8;
    s.armR.rotation.x = -0.8;
  } else if (anim === 'superman') {
    s.root.rotation.x = -Math.PI / 2.4;
    s.root.position.y = 0.9;
    s.armL.rotation.x = Math.PI + Math.abs(cycle) * 0.3;
    s.armR.rotation.x = Math.PI + Math.abs(cycle) * 0.3;
    s.legL.rotation.x = -Math.abs(cycle) * 0.3;
    s.legR.rotation.x = -Math.abs(cycle) * 0.3;
  } else if (anim === 'pullup') {
    const up = Math.max(0, cycle);
    s.root.position.y = 0.05 + up * 0.4;
    s.armL.rotation.z = 0.8 - up * 0.6;
    s.armR.rotation.z = -0.8 + up * 0.6;
    s.armL.rotation.x = -1.5 + up * 0.4;
    s.armR.rotation.x = -1.5 + up * 0.4;
    s.legL.rotation.x = -0.3 + up * 0.3;
    s.legR.rotation.x = -0.3 + up * 0.3;
  } else if (anim === 'row') {
    s.root.rotation.x = -Math.PI / 4;
    s.armL.rotation.x = -1.2 + cycle * 0.7;
    s.armR.rotation.x = -1.2 + cycle * 0.7;
  } else if (anim === 'curl') {
    const c = Math.abs(cycle);
    s.armL.userData.elbow.rotation.x = -c * 2.0;
    s.armR.userData.elbow.rotation.x = -c * 2.0;
  } else if (anim === 'stretch' || anim === 'yoga') {
    s.armL.rotation.z = 0.8 + Math.sin(t * speed) * 0.3;
    s.armR.rotation.z = -0.8 - Math.sin(t * speed) * 0.3;
    s.root.position.y = 0.05 + Math.sin(t * speed) * 0.05;
  } else if (anim === 'walk') {
    const legPhase = t * 4 * speed;
    s.legL.rotation.x = Math.sin(legPhase) * 0.6;
    s.legR.rotation.x = Math.sin(legPhase + Math.PI) * 0.6;
    s.armL.rotation.x = Math.sin(legPhase + Math.PI) * 0.4;
    s.armR.rotation.x = Math.sin(legPhase) * 0.4;
  } else if (anim === 'breathe') {
    const b = Math.sin(t * speed * 0.5);
    s.torso.scale.set(1 + b * 0.05, 1 + b * 0.03, 1 + b * 0.05);
    s.root.position.y = 0.05 + b * 0.03;
  }
}

// ===== MAIN LOOP =====
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (playing) animTime += dt;

  animateStickman(animTime);

  // Slow rotate camera
  const camAngle = Math.sin(animTime * 0.4) * 0.4;
  camera.position.x = Math.sin(camAngle) * 5;
  camera.position.z = Math.cos(camAngle) * 5;
  camera.lookAt(0, 1.2, 0);

  renderer.render(scene, camera);
}

// ===== CONTROLS =====
$('exPlay').onclick = () => {
  playing = !playing;
  $('exPlay').textContent = playing ? '⏸️ PAUSE' : '▶️ PLAY';
};

$('exReset').onclick = () => {
  animTime = 0;
  playing = true;
  $('exPlay').textContent = '⏸️ PAUSE';
};

const speeds = [1, 1.5, 2, 0.5];
let speedIdx = 0;
$('exSpeed').onclick = () => {
  speedIdx = (speedIdx + 1) % speeds.length;
  speed = speeds[speedIdx];
  $('exSpeed').textContent = '⚡ ' + speed + 'x';
};

// ===== TIMER =====
let timerSec = 0;
let timerRunning = false;
let timerInt = null;

function fmtTimer(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return m + ':' + sec;
}

$('exStartTimer').onclick = () => {
  if (timerRunning) {
    timerRunning = false;
    clearInterval(timerInt);
    $('exStartTimer').textContent = '▶ START';
  } else {
    timerRunning = true;
    $('exStartTimer').textContent = '⏸️ PAUSE';
    timerInt = setInterval(() => {
      timerSec++;
      $('exTimer').textContent = fmtTimer(timerSec);
    }, 1000);
  }
};

$('exResetTimer').onclick = () => {
  timerRunning = false;
  clearInterval(timerInt);
  timerSec = 0;
  $('exTimer').textContent = '00:00';
  $('exStartTimer').textContent = '▶ START';
};

// ===== INIT =====
if (typeof THREE === 'undefined') {
  $('exLoading').innerHTML = '⚠️ 3D library gagal load. Cek koneksi.';
} else {
  try {
    initThree();
  } catch(e) {
    console.error(e);
    $('exLoading').innerHTML = '⚠️ Error: ' + e.message;
  }
}
