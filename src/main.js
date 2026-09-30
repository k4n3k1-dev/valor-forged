/**
 * Valor Forged — Fully Playable 3D Action RPG
 * Three.js + real GLB models
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  MAX_LEVEL,
  POTION_HEAL_FRACTION,
  DEATH_GOLD_LOSS_FRACTION,
  xpForLevel,
  calculateRewards,
  applyDeathPenalty,
  potionHealAmount,
  clampLevel,
  canEnterBoss
} from './gameLogic.js';
import { gameAudio } from './audio.js';

// ===================== CONSTANTS =====================
const ACT = {
  1: {
    name: 'Verdant Valley',
    ground: 0x3d8b40,
    fog: 0xa8d5a2,
    fogNear: 50,
    fogFar: 140,
    monsters: ['slime', 'wolf'],
    bossReq: 40,
    recommended: 46
  },
  2: {
    name: 'Shadowgrove Forest',
    ground: 0x1a3a1a,
    fog: 0x0f1f0f,
    fogNear: 25,
    fogFar: 90,
    monsters: ['spider', 'archer'],
    bossReq: 120,
    recommended: 126
  },
  3: {
    name: 'Highland Citadel',
    ground: 0x4a4a4a,
    fog: 0x2a2a2a,
    fogNear: 30,
    fogFar: 100,
    monsters: ['golem'],
    bossReq: 200,
    recommended: 206
  }
};

const WEAPONS = [
  { name: 'Rusty Sword', atk: 12, price: 0, req: 1 },
  { name: 'Iron Blade', atk: 22, price: 80, req: 8 },
  { name: 'Steel Saber', atk: 38, price: 220, req: 20 },
  { name: 'Knight’s Edge', atk: 55, price: 450, req: 35 },
  { name: 'Shadowfang', atk: 78, price: 900, req: 55 },
  { name: 'Dragonslayer', atk: 110, price: 1800, req: 90 },
  { name: 'Celestial Edge', atk: 160, price: 3500, req: 140 },
  { name: 'Mythril Greatsword', atk: 220, price: 7000, req: 180 }
];

const MONSTER_RESPAWN_MIN_MS = 2500;
const MONSTER_RESPAWN_MAX_MS = 5000;

const MODEL_PATHS = {
  player: {
    male: 'models/player/male.glb',
    female: 'models/player/female.glb'
  },
  monsters: {
    slime: 'models/monsters/slime/slime_animated.glb',
    wolf: 'models/monsters/wolf/wolf.glb',
    spider: 'models/monsters/spider/spider_detailed.glb',
    archer: 'models/monsters/archer/archer_goblin.glb',
    golem: 'models/monsters/golem/rock_golem.glb'
  },
  bosses: {
    1: 'models/bosses/act1_boss.glb',
    2: 'models/bosses/act2_boss.glb',
    3: 'models/bosses/act3_boss_golem.glb'
  },
  npcs: {
    weaponsmith: 'models/npcs/weaponsmith.glb'
  },
  buildings: {
    inn: 'models/buildings/low-poly_outsource_tavern.glb',
    shop: 'models/buildings/weapon_shop.glb'
  },
  env: {
    tree: ['models/environment/tree_01.glb', 'models/environment/tree_02.glb', 'models/environment/tree_03.glb'],
    pine: ['models/environment/pine_01.glb', 'models/environment/pine_02.glb'],
    bush: 'models/environment/bush.glb',
    rock: ['models/environment/rock_medium.glb', 'models/environment/rock_small.glb']
  }
};

// ===================== STATE =====================
const state = {
  player: {
    name: 'Kirito',
    gender: 'male',
    level: 1,
    xp: 0,
    xpToNext: 100,
    gold: 50,
    hp: 100,
    maxHp: 100,
    attack: 12,
    potions: 3,
    weaponIdx: 0,
    act: 1
  },
  flags: {
    act1BossDefeated: false,
    act2BossDefeated: false,
    act3BossDefeated: false
  },
  currentAct: 1,
  freeRoam: false,
  inBossRoom: false,
  isDead: false,
  bossPhase: 1
};

// ===================== THREE =====================
let scene, camera, renderer, clock;
let playerGroup, playerModel;
let monsters = [];
let npcs = [];
let portals = [];
let projectiles = [];
let envGroup;
let bossArenaGroup = null;
let worldGeneration = 0;
let keys = {};
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let attackCooldown = 0;
let minimapCtx;
let loader = new GLTFLoader();
let modelCache = {};
let modelAnimations = {};
let mixers = [];
let townCenter = new THREE.Vector3(0, 0, 0);
let worldColliders = [];
let coverColliders = [];
let bossCoverColliders = [];
let act3SafeZones = [];
let playerAttackAnimTimer = 0;
let playerVisualTime = 0;
let fallCooldown = 0;
let footstepTimer = 0;
let visualEffects = [];
let cameraShakeTime = 0;
let cameraShakeStrength = 0;

// ===================== DOM =====================
const $ = id => document.getElementById(id);
const startScreen = $('start-screen');
const creditsScreen = $('credits-screen');
const hud = $('hud');
const loading = $('loading');
const modal = $('modal');
const overlay = $('overlay');
const contextPrompt = $('context-prompt');

// ===================== UTILS =====================
function clampPlayerProgression() {
  const p = state.player;
  p.level = clampLevel(p.level);
  p.maxHp = 100 + (p.level - 1) * 12;
  p.hp = THREE.MathUtils.clamp(Number(p.hp) || p.maxHp, 0, p.maxHp);
  p.weaponIdx = THREE.MathUtils.clamp(Math.floor(p.weaponIdx || 0), 0, WEAPONS.length - 1);
  p.attack = WEAPONS[p.weaponIdx].atk + Math.floor((p.level - 1) * 1.5);
  p.potions = THREE.MathUtils.clamp(Math.floor(p.potions || 0), 0, 10);
  p.gold = Math.max(0, Math.floor(Number(p.gold) || 0));
  if (p.level >= MAX_LEVEL) {
    p.level = MAX_LEVEL;
    p.xp = 0;
    p.xpToNext = 0;
  } else {
    p.xp = Math.max(0, Math.floor(Number(p.xp) || 0));
    p.xpToNext = xpForLevel(p.level);
  }
}

function monsterLevelForAct(actNum, isBoss = false) {
  if (isBoss) return ACT[actNum].bossReq;
  const floor = actNum === 1 ? 1 : actNum === 2 ? 40 : 120;
  const ceiling = actNum === 1 ? 55 : actNum === 2 ? 135 : MAX_LEVEL;
  const variance = Math.floor(Math.random() * 7) - 3;
  return THREE.MathUtils.clamp(state.player.level + variance, floor, ceiling);
}

function isBossDefeated(actNum) {
  return Boolean(state.flags[`act${actNum}BossDefeated`]);
}

function showDamage(worldPos, amount, type = 'dmg') {
  const layer = $('damage-layer');
  const el = document.createElement('div');
  el.className = 'dmg-num' + (type === 'heal' ? ' heal' : type === 'xp' ? ' xp' : type === 'gold' ? ' gold' : '');
  if (type === 'xp') el.textContent = `+${amount} XP`;
  else if (type === 'gold') el.textContent = `+${amount}g`;
  else el.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;
  const v = worldPos.clone().project(camera);
  const x = (v.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function flashMonster(mon) {
  const touched = [];
  mon.mesh.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach(mat => {
      if (!mat) return;
      if (mat.emissive) {
        touched.push({ mat, emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity ?? 1 });
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = 1.8;
      } else if (mat.color) {
        touched.push({ mat, color: mat.color.clone() });
        mat.color.set(0xffffff);
      }
    });
  });
  setTimeout(() => {
    touched.forEach(t => {
      if (t.emissive) {
        t.mat.emissive.copy(t.emissive);
        t.mat.emissiveIntensity = t.intensity;
      }
      if (t.color) t.mat.color.copy(t.color);
    });
  }, 90);
}


function addCameraShake(strength = 0.08, duration = 0.12) {
  cameraShakeStrength = Math.max(cameraShakeStrength, strength);
  cameraShakeTime = Math.max(cameraShakeTime, duration);
}

function spawnBurst(position, color = 0xffcc66, count = 12, speed = 3.5, life = 0.45, size = 0.11) {
  if (!scene || !position) return;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    const v = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.4 + 0.25,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(speed * (0.55 + Math.random() * 0.65));
    velocities.push(v);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  visualEffects.push({ points, velocities, life, maxLife: life });
}

function updateVisualEffects(dt) {
  for (let i = visualEffects.length - 1; i >= 0; i--) {
    const fx = visualEffects[i];
    fx.life -= dt;
    const attr = fx.points.geometry.getAttribute('position');
    for (let j = 0; j < fx.velocities.length; j++) {
      const v = fx.velocities[j];
      v.y -= 4.5 * dt;
      attr.array[j * 3] += v.x * dt;
      attr.array[j * 3 + 1] += v.y * dt;
      attr.array[j * 3 + 2] += v.z * dt;
    }
    attr.needsUpdate = true;
    fx.points.material.opacity = Math.max(0, fx.life / fx.maxLife);
    if (fx.life <= 0) {
      scene.remove(fx.points);
      fx.points.geometry.dispose();
      fx.points.material.dispose();
      visualEffects.splice(i, 1);
    }
  }
}

function applyKnockback(mon, strength = 1) {
  if (!playerGroup || !mon?.mesh) return;
  const dir = mon.mesh.position.clone().sub(playerGroup.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
  dir.normalize();
  mon.mesh.position.addScaledVector(dir, mon.isBoss ? strength * 0.35 : strength);
}

function showOverlay(title, text, cb) {
  $('overlay-title').textContent = title;
  $('overlay-text').textContent = text;
  overlay.classList.remove('hidden');
  const btn = $('overlay-btn');
  const handler = () => {
    gameAudio.play('ui');
    overlay.classList.add('hidden');
    btn.removeEventListener('click', handler);
    if (cb) cb();
  };
  btn.addEventListener('click', handler);
}

function updateHUD() {
  const p = state.player;
  $('hud-name').textContent = p.name;
  $('hud-level').textContent = p.level;
  $('hud-atk').textContent = p.attack;
  $('hud-gold').textContent = p.gold;
  $('hud-potions').textContent = p.potions;
  $('hud-act').textContent = state.currentAct;
  $('hud-act-name').textContent = state.freeRoam ? `${ACT[state.currentAct].name} · Free Roam` : ACT[state.currentAct].name;
  const hpPct = Math.max(0, p.hp / p.maxHp * 100);
  $('hp-fill').style.width = hpPct + '%';
  $('hp-text').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
  if (p.level >= MAX_LEVEL || p.xpToNext <= 0) {
    $('xp-fill').style.width = '100%';
    $('xp-text').textContent = 'MAX';
  } else {
    const xpPct = THREE.MathUtils.clamp(p.xp / p.xpToNext * 100, 0, 100);
    $('xp-fill').style.width = xpPct + '%';
    $('xp-text').textContent = `${p.xp}/${p.xpToNext}`;
  }
}

function saveGame() {
  clampPlayerProgression();
  const data = {
    version: 2,
    player: { ...state.player },
    flags: { ...state.flags },
    currentAct: state.currentAct,
    freeRoam: state.freeRoam,
    position: playerGroup && !state.falling ? {
      x: playerGroup.position.x,
      y: playerGroup.position.y,
      z: playerGroup.position.z
    } : null
  };
  localStorage.setItem('valorForgedSave', JSON.stringify(data));
}

function loadGame() {
  const raw = localStorage.getItem('valorForgedSave');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data || !data.player) return false;
    Object.assign(state.player, data.player);
    Object.assign(state.flags, data.flags || {});
    state.currentAct = THREE.MathUtils.clamp(Number(data.currentAct) || state.player.act || 1, 1, 3);
    if (state.flags.act3BossDefeated) state.currentAct = 3;
    else if (state.flags.act2BossDefeated) state.currentAct = Math.max(state.currentAct, 3);
    else if (state.flags.act1BossDefeated) state.currentAct = Math.max(state.currentAct, 2);
    state.player.act = state.currentAct;
    state.freeRoam = Boolean(data.freeRoam || state.flags.act3BossDefeated);
    state.inBossRoom = false;
    state.isDead = false;
    state.savedPosition = data.position || null;
    clampPlayerProgression();
    return true;
  } catch (err) {
    console.warn('Could not load save:', err);
    return false;
  }
}

// ===================== MODEL LOADING =====================
function loadModel(path) {
  if (modelCache[path]) {
    try { return Promise.resolve(cloneSkeleton(modelCache[path])); }
    catch { return Promise.resolve(modelCache[path].clone(true)); }
  }
  return new Promise((resolve) => {
    loader.load(
      path,
      gltf => {
        modelCache[path] = gltf.scene;
        modelAnimations[path] = gltf.animations || [];
        gltf.scene.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        try { resolve(cloneSkeleton(gltf.scene)); }
        catch { resolve(gltf.scene.clone(true)); }
      },
      undefined,
      err => {
        console.warn('Failed to load', path, err);
        const geo = new THREE.BoxGeometry(1, 1.5, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        resolve(new THREE.Mesh(geo, mat));
      }
    );
  });
}

function createAnimationController(model, path) {
  const clips = modelAnimations[path] || [];
  if (!clips.length) return null;
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  clips.forEach(clip => {
    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  });
  const controller = { mixer, actions, current: null, path };
  mixers.push(controller);
  return controller;
}

function findAnimationAction(controller, stateName) {
  if (!controller) return null;
  const preferences = {
    idle: ['idle', 'squish', 'loop'],
    walk: ['walk', 'walking', 'jump'],
    attack: ['attack', 'keyaction'],
    hit: ['gethit', 'damage'],
    death: ['death', 'die']
  }[stateName] || [stateName];
  const entries = Object.entries(controller.actions);
  for (const key of preferences) {
    const found = entries.find(([name]) => name.includes(key));
    if (found) return found[1];
  }
  return entries.length ? entries[0][1] : null;
}

function playAnimation(controller, stateName, once = false) {
  if (!controller || controller.current === stateName) return;
  const next = findAnimationAction(controller, stateName);
  if (!next) return;
  Object.values(controller.actions).forEach(action => action.fadeOut(0.08));
  next.reset().fadeIn(0.08);
  if (once) {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.play();
  controller.current = stateName;
}

function fitModel(model, targetHeight = 1.8) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.01);
  model.scale.setScalar(scale);
  // ground the model
  box.setFromObject(model);
  model.position.y = -box.min.y;
  return model;
}


function addWorldCollider(x, z, radius, height = 6, type = 'solid') {
  const collider = { shape: 'circle', x, z, radius, height, type };
  worldColliders.push(collider);
  if (type === 'cover') coverColliders.push(collider);
  return collider;
}

function addBoxCollider(x, z, width, depth, height = 6, type = 'solid') {
  const collider = { shape: 'box', x, z, halfW: width / 2, halfD: depth / 2, height, type };
  worldColliders.push(collider);
  if (type === 'cover') coverColliders.push(collider);
  return collider;
}

function activeSolidColliders() {
  return state.inBossRoom ? bossCoverColliders : worldColliders;
}

function activeCoverColliders() {
  return state.inBossRoom ? bossCoverColliders : coverColliders;
}

function collidesAt(position, radius = 0.55, colliders = activeSolidColliders()) {
  for (const c of colliders) {
    const dx = position.x - c.x;
    const dz = position.z - c.z;
    if (c.shape === 'box') {
      if (Math.abs(dx) < c.halfW + radius && Math.abs(dz) < c.halfD + radius) return true;
    } else if (dx * dx + dz * dz < Math.pow(radius + c.radius, 2)) {
      return true;
    }
  }
  return false;
}

function moveWithCollisions(object, delta, radius = 0.55, requireAct3Walkable = false) {
  if (!object || delta.lengthSq() === 0) return false;
  const next = object.position.clone().add(delta);
  if (collidesAt(next, radius)) return false;
  if (requireAct3Walkable && state.currentAct === 3 && !state.inBossRoom && !isAct3Walkable(next.x, next.z)) return false;
  object.position.x = next.x;
  object.position.z = next.z;
  return true;
}

function segmentBlockedByCover(start, end, colliders = activeCoverColliders()) {
  const ax = start.x;
  const az = start.z;
  const bx = end.x;
  const bz = end.z;
  const abx = bx - ax;
  const abz = bz - az;
  const denom = abx * abx + abz * abz || 1;
  for (const c of colliders) {
    const t = THREE.MathUtils.clamp(((c.x - ax) * abx + (c.z - az) * abz) / denom, 0, 1);
    const px = ax + abx * t;
    const pz = az + abz * t;
    const dx = px - c.x;
    const dz = pz - c.z;
    if (dx * dx + dz * dz <= c.radius * c.radius) return true;
  }
  return false;
}

function isAct3Walkable(x, z) {
  return act3SafeZones.some(zone =>
    Math.abs(x - zone.x) <= zone.w / 2 && Math.abs(z - zone.z) <= zone.d / 2
  );
}

function addAct3SafeZone(x, z, w, d) {
  act3SafeZones.push({ x, z, w, d });
}

function createTextSprite(text, color = '#f7e7a3') {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 12, 18, 0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.fillStyle = color;
  ctx.font = 'bold 34px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(10.5, 1.75, 1);
  return sprite;
}

function createStoneSign(text, x, z) {
  const group = new THREE.Group();
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.6, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 1 })
  );
  stone.position.y = 1.1;
  stone.castShadow = true;
  group.add(stone);
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 1.2, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x544a3b, roughness: 1 })
  );
  post.position.y = 0.35;
  group.add(post);
  const label = createTextSprite(text);
  label.position.set(0, 2.65, 0.1);
  group.add(label);
  group.position.set(x, 0, z);
  envGroup.add(group);
  addWorldCollider(x, z, 1.15, 2.8, 'solid');
  return group;
}

function createBoxStructure({ x, y = 0, z, w, h, d, color = 0x68656a, collider = true }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.05 })
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  envGroup.add(mesh);
  if (collider) addBoxCollider(x, z, w, d, h, 'solid');
  return mesh;
}

function createAct3Architecture() {
  const stone = 0x55545a;
  const darkStone = 0x3b3a40;
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a494f, roughness: 0.95 });
  const voidMat = new THREE.MeshStandardMaterial({ color: 0x090a10, roughness: 1 });

  const voidFloor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), voidMat);
  voidFloor.rotation.x = -Math.PI / 2;
  voidFloor.position.y = -12;
  envGroup.add(voidFloor);

  const platforms = [
    { x: 0, z: 0, w: 30, d: 28 },
    { x: 0, z: -30, w: 7, d: 34 },
    { x: 0, z: -55, w: 28, d: 18 },
    { x: 30, z: -8, w: 22, d: 22 },
    { x: 19, z: -8, w: 16, d: 6 },
    { x: -30, z: 10, w: 22, d: 22 },
    { x: -19, z: 10, w: 16, d: 6 }
  ];

  platforms.forEach(p => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(p.w, 1.2, p.d), floorMat);
    slab.position.set(p.x, -0.6, p.z);
    slab.receiveShadow = true;
    envGroup.add(slab);
    addAct3SafeZone(p.x, p.z, p.w, p.d);
  });

  // Broken citadel walls around the central courtyard and portal platform.
  [
    [-13, -6, 2, 5, 10], [13, -6, 2, 7, 10], [-11, 9, 2, 4, 7], [11, 9, 2, 5, 7],
    [-12, -59, 2, 6, 8], [12, -59, 2, 6, 8], [-10, -50, 5, 4, 2], [10, -50, 5, 5, 2]
  ].forEach(([x, z, w, h, d]) => createBoxStructure({ x, z, w, h, d, color: stone }));

  // Citadel towers and ruined battlements.
  [[-11, -52], [11, -52], [-11, -61], [11, -61]].forEach(([x, z]) => {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.7, 8, 8),
      new THREE.MeshStandardMaterial({ color: darkStone, roughness: 1 })
    );
    tower.position.set(x, 4, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    envGroup.add(tower);
    addWorldCollider(x, z, 2.45, 8, 'solid');
  });

  // Low bridge-edge ruins: enough to sell the citadel without preventing falls.
  for (let z = -18; z >= -42; z -= 8) {
    createBoxStructure({ x: -3.6, z, w: 0.7, h: 1.1, d: 3.2, color: darkStone, collider: false });
    createBoxStructure({ x: 3.6, z, w: 0.7, h: 1.1, d: 3.2, color: darkStone, collider: false });
  }
}

function randomMonsterSpawnPoint(actNum) {
  if (actNum === 3) {
    const zones = [
      { x: 30, z: -8, w: 16, d: 16 },
      { x: -30, z: 10, w: 16, d: 16 },
      { x: 0, z: -55, w: 18, d: 11 }
    ];
    const zone = zones[Math.floor(Math.random() * zones.length)];
    return {
      x: zone.x + (Math.random() - 0.5) * zone.w,
      z: zone.z + (Math.random() - 0.5) * zone.d
    };
  }
  const angle = Math.random() * Math.PI * 2;
  const r = 20 + Math.random() * 50;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

function damagePlayer(amount, sourcePosition = null, knockbackStrength = 0) {
  if (state.isDead || !playerGroup) return;
  const dmg = Math.max(0, Math.floor(amount));
  state.player.hp = Math.max(0, state.player.hp - dmg);
  gameAudio.play('hurt');
  spawnBurst(playerGroup.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xff5544, 9, 2.5, 0.34, 0.09);
  addCameraShake(0.08, 0.12);
  showDamage(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), dmg);
  if (sourcePosition && knockbackStrength > 0) {
    const push = playerGroup.position.clone().sub(sourcePosition).setY(0);
    if (push.lengthSq() > 0.001) {
      push.normalize().multiplyScalar(knockbackStrength);
      moveWithCollisions(playerGroup, push, 0.55, false);
    }
  }
  updateHUD();
  if (state.player.hp <= 0) onPlayerDeath();
}

function updatePlayerVisual(dt, moving) {
  if (!playerModel) return;
  playerVisualTime += dt;
  const baseY = playerModel.userData.baseY ?? playerModel.position.y;
  playerModel.userData.baseY = baseY;
  const bob = moving ? Math.sin(playerVisualTime * 10) * 0.045 : Math.sin(playerVisualTime * 2.2) * 0.012;
  playerModel.position.y = baseY + bob;

  if (playerAttackAnimTimer > 0) {
    playerAttackAnimTimer = Math.max(0, playerAttackAnimTimer - dt);
    const progress = 1 - playerAttackAnimTimer / 0.28;
    playerModel.rotation.z = -Math.sin(progress * Math.PI) * 0.32;
    playerModel.rotation.x = Math.sin(progress * Math.PI) * 0.09;
  } else {
    playerModel.rotation.z = THREE.MathUtils.lerp(playerModel.rotation.z, moving ? Math.sin(playerVisualTime * 10) * 0.035 : 0, 0.2);
    playerModel.rotation.x = THREE.MathUtils.lerp(playerModel.rotation.x, 0, 0.2);
  }
}

function updateProceduralMonsterVisual(mon, dt, moving) {
  if (!mon || mon.animation) return;
  mon.visualTime = (mon.visualTime || Math.random() * 10) + dt;
  const baseY = mon.mesh.userData.baseY ?? mon.mesh.position.y;
  mon.mesh.userData.baseY = baseY;
  const amount = mon.isBoss ? 0.045 : 0.025;
  mon.mesh.position.y = baseY + Math.sin(mon.visualTime * (moving ? 6 : 2.5)) * amount;
  if (mon.aiState === 'telegraph' || mon.aiState === 'slamTelegraph') {
    const pulse = 1 + Math.sin(mon.visualTime * 18) * 0.035;
    mon.mesh.scale.multiplyScalar(pulse / (mon.lastPulse || 1));
    mon.lastPulse = pulse;
  } else if (mon.lastPulse && mon.lastPulse !== 1) {
    mon.mesh.scale.multiplyScalar(1 / mon.lastPulse);
    mon.lastPulse = 1;
  }
}

// ===================== SCENE BUILD =====================
async function setupThree() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 8, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Lights
  const hemi = new THREE.HemisphereLight(0xb1e1ff, 0x444422, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);

  envGroup = new THREE.Group();
  scene.add(envGroup);

  minimapCtx = $('minimap').getContext('2d');
}

async function buildAct(actNum) {
  worldGeneration++;
  clearBossArena();
  clearProjectiles();
  envGroup.visible = true;
  mixers = [];
  worldColliders = [];
  coverColliders = [];
  bossCoverColliders = [];
  act3SafeZones = [];

  while (envGroup.children.length) envGroup.remove(envGroup.children[0]);
  monsters.forEach(m => scene.remove(m.mesh));
  monsters = [];
  portals.forEach(p => {
    scene.remove(p);
    if (p.userData.light) scene.remove(p.userData.light);
  });
  portals = [];
  npcs.forEach(n => scene.remove(n.mesh));
  npcs = [];

  const cfg = ACT[actNum];
  scene.background = new THREE.Color(cfg.fog);
  scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);

  if (actNum === 3) {
    createAct3Architecture();
  } else {
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: cfg.ground, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    envGroup.add(ground);
  }

  await scatterEnvironment(actNum);
  await buildTown();
  await spawnMonsters(actNum);

  if (!isBossDefeated(actNum) && !state.freeRoam) await spawnBossPortal(actNum);
}

async function scatterEnvironment(actNum) {
  if (actNum === 3) {
    const rubbleSpots = [
      [-7, 8], [8, 6], [26, -13], [34, -4], [-26, 5], [-34, 14], [7, -55], [-6, -58]
    ];
    for (const [x, z] of rubbleSpots) {
      try {
        const path = MODEL_PATHS.env.rock[Math.floor(Math.random() * MODEL_PATHS.env.rock.length)];
        const m = await loadModel(path);
        fitModel(m, 0.9 + Math.random() * 1.3);
        m.position.set(x, 0, z);
        m.rotation.y = Math.random() * Math.PI * 2;
        envGroup.add(m);
        addWorldCollider(x, z, 0.8, 1.8, 'solid');
      } catch {}
    }
    return;
  }

  const trees = MODEL_PATHS.env.tree;
  const pines = MODEL_PATHS.env.pine;
  const count = actNum === 1 ? 25 : 44;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 70;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
    if (Math.abs(x) < 8 && z < -43 && z > -67) continue;

    const path = actNum === 2
      ? pines[Math.floor(Math.random() * pines.length)]
      : trees[Math.floor(Math.random() * trees.length)];

    try {
      const m = await loadModel(path);
      fitModel(m, 4 + Math.random() * 4);
      m.position.set(x, 0, z);
      m.rotation.y = Math.random() * Math.PI * 2;
      envGroup.add(m);
      addWorldCollider(x, z, actNum === 2 ? 1.35 : 1.1, 8, actNum === 2 ? 'cover' : 'solid');
    } catch {}
  }

  for (let i = 0; i < 14; i++) {
    const x = (Math.random() - 0.5) * 120;
    const z = (Math.random() - 0.5) * 120;
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    try {
      const m = await loadModel(MODEL_PATHS.env.rock[Math.floor(Math.random() * 2)]);
      fitModel(m, 0.8 + Math.random() * 1.5);
      m.position.set(x, 0, z);
      envGroup.add(m);
      addWorldCollider(x, z, 0.75, 2, 'solid');
    } catch {}
  }
}

async function buildTown() {
  try {
    const inn = await loadModel(MODEL_PATHS.buildings.inn);
    fitModel(inn, 6);
    inn.position.set(-8, 0, -6);
    envGroup.add(inn);
    addBoxCollider(-8, -6, 6.2, 5.2, 6, 'solid');
  } catch {}

  try {
    const shop = await loadModel(MODEL_PATHS.buildings.shop);
    fitModel(shop, 4);
    shop.position.set(8, 0, -5);
    envGroup.add(shop);
    addBoxCollider(8, -5, 5.2, 4.2, 4, 'solid');
  } catch {}

  try {
    const smith = await loadModel(MODEL_PATHS.npcs.weaponsmith);
    fitModel(smith, 1.8);
    smith.position.set(8, 0, -1.2);
    scene.add(smith);
    const animation = createAnimationController(smith, MODEL_PATHS.npcs.weaponsmith);
    playAnimation(animation, 'idle');
    npcs.push({ mesh: smith, role: 'Weaponsmith', type: 'shop', animation });
  } catch {
    const geo = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x886633 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(8, 0.9, -1.2);
    scene.add(m);
    npcs.push({ mesh: m, role: 'Weaponsmith', type: 'shop' });
  }

  try {
    const innk = await loadModel(MODEL_PATHS.player.male);
    fitModel(innk, 1.7);
    innk.position.set(-8, 0, -1.2);
    scene.add(innk);
    npcs.push({ mesh: innk, role: 'Innkeeper', type: 'inn' });
  } catch {}

  try {
    const alc = await loadModel(MODEL_PATHS.player.female);
    fitModel(alc, 1.65);
    alc.position.set(0, 0, -8);
    scene.add(alc);
    npcs.push({ mesh: alc, role: 'Alchemist', type: 'potion' });
  } catch {}
}

async function spawnPlayer() {
  if (playerGroup) scene.remove(playerGroup);
  playerGroup = new THREE.Group();
  scene.add(playerGroup);

  const path = MODEL_PATHS.player[state.player.gender] || MODEL_PATHS.player.male;
  try {
    playerModel = await loadModel(path);
    fitModel(playerModel, 1.8);
    playerModel.userData.baseY = playerModel.position.y;
    playerGroup.add(playerModel);
  } catch {
    const geo = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    playerModel = new THREE.Mesh(geo, mat);
    playerModel.position.y = 0.9;
    playerModel.userData.baseY = playerModel.position.y;
    playerGroup.add(playerModel);
  }

  playerGroup.position.set(0, 0, 4);
}

async function spawnMonsters(actNum) {
  const types = ACT[actNum].monsters;
  const count = 8 + actNum * 3;

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    let point = randomMonsterSpawnPoint(actNum);
    for (let attempts = 0; attempts < 8 && collidesAt(new THREE.Vector3(point.x, 0, point.z), 1.2, worldColliders); attempts++) {
      point = randomMonsterSpawnPoint(actNum);
    }
    const mon = await createMonster(type, point.x, point.z, false);
    monsters.push(mon);
  }
}

async function createMonster(type, x, z, isBoss = false) {
  const path = isBoss
    ? MODEL_PATHS.bosses[state.currentAct]
    : MODEL_PATHS.monsters[type] || MODEL_PATHS.monsters.slime;

  let mesh;
  try {
    mesh = await loadModel(path);
    const h = isBoss ? (state.currentAct === 3 ? 5 : 3.5) : (type === 'golem' ? 2.8 : type === 'wolf' ? 1.2 : 1.5);
    fitModel(mesh, h);
    mesh.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      obj.material = Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone();
    });
  } catch {
    const geo = new THREE.BoxGeometry(1.2, 1.5, 1.2);
    const mat = new THREE.MeshStandardMaterial({ color: isBoss ? 0xaa2222 : 0x44aa44 });
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.75;
  }

  mesh.position.set(x, 0, z);
  mesh.userData.baseY = mesh.position.y;
  scene.add(mesh);

  const barGeo = new THREE.PlaneGeometry(1.2, 0.12);
  const barMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const barBg = new THREE.Mesh(barGeo, barMat);
  barBg.position.y = isBoss ? 4 : 2.2;
  mesh.add(barBg);
  const fillGeo = new THREE.PlaneGeometry(1.15, 0.1);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
  const barFill = new THREE.Mesh(fillGeo, fillMat);
  barFill.position.z = 0.01;
  barBg.add(barFill);

  const level = monsterLevelForAct(state.currentAct, isBoss);
  const baseHp = isBoss
    ? 650 + level * (state.currentAct === 3 ? 18 : 14)
    : 42 + level * 9 + (type === 'golem' ? 80 : 0);
  const atk = isBoss
    ? 12 + Math.floor(level * 0.42)
    : 5 + Math.floor(level * 0.34);
  const animation = createAnimationController(mesh, path);
  playAnimation(animation, 'idle');

  return {
    mesh,
    type,
    level,
    isBoss,
    isRanged: type === 'archer' || (isBoss && state.currentAct === 2),
    hp: baseHp,
    maxHp: baseHp,
    atk,
    speed: isBoss ? 3.2 : (type === 'wolf' ? 5 : 3),
    cooldown: Math.random() * 0.5,
    barFill,
    barBg,
    phase: 1,
    animation,
    animLock: 0,
    aiState: isBoss ? 'idle' : 'chase',
    stateTimer: isBoss ? 0.8 : 0,
    warningMesh: null,
    chargeDir: new THREE.Vector3(),
    hasHitDuringCharge: false,
    visualTime: Math.random() * 8
  };
}

async function spawnBossPortal(actNum) {
  const geo = new THREE.TorusGeometry(2.2, 0.25, 8, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8844ff,
    emissive: 0x4422aa,
    emissiveIntensity: 0.6
  });
  const portal = new THREE.Mesh(geo, mat);
  portal.position.set(0, 2.5, -55);
  portal.rotation.x = Math.PI / 2;
  portal.userData.isPortal = true;
  portal.userData.act = actNum;
  scene.add(portal);
  portals.push(portal);

  const light = new THREE.PointLight(0x8844ff, 1.5, 15);
  light.position.copy(portal.position);
  scene.add(light);
  portal.userData.light = light;

  const hints = {
    1: 'Watch the stance. Dodge the charge.',
    2: 'The trees are your shield.',
    3: 'The bridge is narrow. Choose your steps wisely.'
  };
  createStoneSign(hints[actNum], -5.5, -49);
}

// ===================== COMBAT & SYSTEMS =====================
function onClickAttack(e) {
  if (state.isDead || state.falling || attackCooldown > 0 || !playerGroup) return;
  if (modal.classList.contains('hidden') === false) return;
  if (overlay.classList.contains('hidden') === false) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const targets = monsters.filter(m => m.hp > 0).map(m => m.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length === 0) return;

  let mon = null;
  for (const h of hits) {
    let obj = h.object;
    while (obj.parent && !monsters.find(m => m.mesh === obj)) obj = obj.parent;
    mon = monsters.find(m => m.mesh === obj);
    if (mon) break;
  }
  if (!mon || mon.hp <= 0) return;

  const dist = playerGroup.position.distanceTo(mon.mesh.position);
  if (dist > 4.5) return;

  attackCooldown = 0.45;
  playerAttackAnimTimer = 0.28;
  gameAudio.play('swing');
  const dmg = state.player.attack + Math.floor(Math.random() * 8);
  mon.hp -= dmg;
  flashMonster(mon);
  gameAudio.play('hit');
  spawnBurst(mon.mesh.position.clone().add(new THREE.Vector3(0, mon.isBoss ? 2 : 1.2, 0)), mon.isBoss ? 0xffd166 : 0xfff2a6, mon.isBoss ? 18 : 10, 3.8, 0.38, 0.105);
  if (mon.animation) {
    playAnimation(mon.animation, 'hit', true);
    mon.animLock = 0.22;
  }
  applyKnockback(mon, 1.15);
  showDamage(mon.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), dmg);

  const pct = Math.max(0, mon.hp / mon.maxHp);
  mon.barFill.scale.x = pct;
  mon.barFill.position.x = -0.575 * (1 - pct);

  if (mon.hp <= 0) onMonsterDeath(mon);
}

function awardMonsterRewards(mon) {
  const rewards = calculateRewards(mon.level, state.player.level, mon.isBoss);
  const xpGain = rewards.xp;
  const goldGain = rewards.gold;

  if (state.player.level < MAX_LEVEL) state.player.xp += xpGain;
  state.player.gold += goldGain;
  showDamage(mon.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0)), xpGain, 'xp');
  showDamage(mon.mesh.position.clone().add(new THREE.Vector3(0.7, 2.2, 0)), goldGain, 'gold');

  const startLevel = state.player.level;
  while (state.player.level < MAX_LEVEL && state.player.xp >= state.player.xpToNext) {
    state.player.xp -= state.player.xpToNext;
    state.player.level++;
    state.player.maxHp = 100 + (state.player.level - 1) * 12;
    state.player.hp = state.player.maxHp;
    state.player.attack = WEAPONS[state.player.weaponIdx].atk + Math.floor((state.player.level - 1) * 1.5);
    if (state.player.level >= MAX_LEVEL) {
      state.player.level = MAX_LEVEL;
      state.player.xp = 0;
      state.player.xpToNext = 0;
      break;
    }
    state.player.xpToNext = xpForLevel(state.player.level);
  }
  if (state.player.level > startLevel && !mon.isBoss) {
    gameAudio.play('levelUp');
    spawnBurst(playerGroup.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x66ccff, 24, 4.5, 0.75, 0.12);
    if (state.player.level >= MAX_LEVEL) showOverlay('Maximum Level!', `You reached the level cap: ${MAX_LEVEL}.`, () => {});
    else showOverlay('Level Up!', `You reached level ${state.player.level}!`, () => {});
  }
}

function scheduleMonsterRespawn(mon) {
  if (mon.isBoss || state.inBossRoom) return;
  const generation = worldGeneration;
  const actAtDeath = state.currentAct;
  const type = mon.type;
  const delay = MONSTER_RESPAWN_MIN_MS + Math.random() * (MONSTER_RESPAWN_MAX_MS - MONSTER_RESPAWN_MIN_MS);
  setTimeout(async () => {
    if (generation !== worldGeneration || state.currentAct !== actAtDeath || state.inBossRoom) return;
    const point = randomMonsterSpawnPoint(actAtDeath);
    const respawned = await createMonster(type, point.x, point.z, false);
    if (generation === worldGeneration && state.currentAct === actAtDeath && !state.inBossRoom) monsters.push(respawned);
    else scene.remove(respawned.mesh);
  }, delay);
}

function onMonsterDeath(mon) {
  removeBossWarning(mon);
  gameAudio.play(mon.isBoss ? 'victory' : 'enemyDeath');
  spawnBurst(mon.mesh.position.clone().add(new THREE.Vector3(0, mon.isBoss ? 2 : 1.1, 0)), mon.isBoss ? 0xf0d060 : 0xaa66ff, mon.isBoss ? 42 : 18, mon.isBoss ? 6 : 4, mon.isBoss ? 1.05 : 0.55, mon.isBoss ? 0.16 : 0.11);
  if (mon.isBoss) addCameraShake(0.18, 0.45);
  awardMonsterRewards(mon);
  const wasBoss = mon.isBoss;
  const defeatedAct = state.currentAct;

  scene.remove(mon.mesh);
  monsters = monsters.filter(m => m !== mon);

  if (!wasBoss) {
    scheduleMonsterRespawn(mon);
    updateHUD();
    saveGame();
    return;
  }

  state.flags[`act${defeatedAct}BossDefeated`] = true;
  state.inBossRoom = false;
  gameAudio.setScene(defeatedAct, false);
  clearProjectiles();
  clearBossArena();

  showOverlay('Boss Defeated!', `Act ${defeatedAct} boss has fallen. The path forward opens.`, async () => {
    if (defeatedAct < 3) {
      state.currentAct = defeatedAct + 1;
      state.player.act = state.currentAct;
      state.freeRoam = false;
      await rebuildWorld();
      saveGame();
    } else {
      state.freeRoam = true;
      state.currentAct = 3;
      state.player.act = 3;
      await rebuildWorld();
      saveGame();
      showOverlay('Victory!', `All three Acts are complete. Free roam is unlocked; keep fighting and level up to ${MAX_LEVEL}.`, () => {});
    }
  });

  updateHUD();
}

function onPlayerDeath() {
  if (state.isDead) return;
  state.isDead = true;
  gameAudio.play('death');
  const penalty = applyDeathPenalty(state.player.gold);
  const lost = penalty.lost;
  state.player.gold = penalty.remaining;
  state.player.hp = state.player.maxHp;
  clearProjectiles();
  showOverlay('You Died', `You lost ${lost} gold (10%). Returning to town...`, async () => {
    state.isDead = false;
    if (state.inBossRoom) {
      state.inBossRoom = false;
      clearBossArena();
      await rebuildWorld();
    }
    playerGroup.position.set(0, 0, 4);
    updateHUD();
    saveGame();
  });
}

function usePotion() {
  if (!playerGroup || state.falling || state.player.potions <= 0 || state.player.hp >= state.player.maxHp || state.isDead) return;
  state.player.potions--;
  gameAudio.play('potion');
  spawnBurst(playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x55ee88, 18, 3.1, 0.65, 0.105);
  const heal = potionHealAmount(state.player.maxHp);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
  showDamage(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), heal, 'heal');
  updateHUD();
  saveGame();
}

function tryInteract() {
  if (!playerGroup || state.falling) return;
  for (const npc of npcs) {
    if (playerGroup.position.distanceTo(npc.mesh.position) < 4) {
      openNPC(npc);
      return;
    }
  }
}

function openNPC(npc) {
  gameAudio.play('ui');
  $('modal-title').textContent = npc.role;
  const body = $('modal-body');
  body.innerHTML = '';

  if (npc.type === 'shop') {
    WEAPONS.forEach((w, i) => {
      const owned = state.player.weaponIdx === i;
      const canBuy = state.player.level >= w.req && state.player.gold >= w.price && !owned;
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `
        <div>
          <strong>${w.name}</strong><br>
          <small>ATK ${w.atk} · Req Lv ${w.req} · ${w.price}g</small>
        </div>
      `;
      const btn = document.createElement('button');
      btn.textContent = owned ? 'Equipped' : canBuy ? 'Buy' : 'Locked';
      btn.disabled = !canBuy;
      btn.onclick = () => {
        state.player.gold -= w.price;
        gameAudio.play('coin');
        state.player.weaponIdx = i;
        state.player.attack = w.atk + Math.floor((state.player.level - 1) * 1.5);
        updateHUD();
        saveGame();
        openNPC(npc);
      };
      row.appendChild(btn);
      body.appendChild(row);
    });
  } else if (npc.type === 'potion') {
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `<div><strong>Health Potion</strong><br><small>Restores 50% HP · 25g</small></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Buy';
    btn.disabled = state.player.gold < 25 || state.player.potions >= 10;
    btn.onclick = () => {
      state.player.gold -= 25;
      gameAudio.play('coin');
      state.player.potions++;
      updateHUD();
      saveGame();
      openNPC(npc);
    };
    row.appendChild(btn);
    body.appendChild(row);
  } else if (npc.type === 'inn') {
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `<div><strong>Rest & Save</strong><br><small>Fully restore HP · Free</small></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Rest';
    btn.onclick = () => {
      state.player.hp = state.player.maxHp;
      gameAudio.play('save');
      saveGame();
      updateHUD();
      closeModal();
      showOverlay('Rested', 'HP restored. Game saved.', () => {});
    };
    row.appendChild(btn);
    body.appendChild(row);
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  gameAudio.play('ui');
  modal.classList.add('hidden');
}

function clearProjectiles() {
  projectiles.forEach(p => scene.remove(p.mesh));
  projectiles = [];
}

function clearBossArena() {
  if (bossArenaGroup) {
    scene.remove(bossArenaGroup);
    bossArenaGroup = null;
  }
  bossCoverColliders = [];
  if (envGroup) envGroup.visible = true;
  npcs.forEach(n => { n.mesh.visible = true; });
  portals.forEach(p => {
    p.visible = true;
    if (p.userData.light) p.userData.light.visible = true;
  });
}

async function createBossArena(actNum) {
  clearBossArena();
  bossArenaGroup = new THREE.Group();
  bossCoverColliders = [];
  const palette = {
    1: { floor: 0x365b2c, wall: 0x6c7f52, glow: 0xffc857 },
    2: { floor: 0x101a12, wall: 0x253426, glow: 0x8b5cf6 },
    3: { floor: 0x303035, wall: 0x595963, glow: 0xff5a36 }
  }[actNum];

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(19, 19, 0.8, 40),
    new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 0.9 })
  );
  floor.position.y = -0.4;
  floor.receiveShadow = true;
  bossArenaGroup.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.8 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 5, 2.5), wallMat);
    pillar.position.set(Math.cos(a) * 18.2, 2.2, Math.sin(a) * 18.2);
    pillar.rotation.y = -a;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    bossArenaGroup.add(pillar);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(15.5, 0.18, 8, 64),
    new THREE.MeshStandardMaterial({ color: palette.glow, emissive: palette.glow, emissiveIntensity: 0.9 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  bossArenaGroup.add(ring);

  // Act 2 is a cover fight. These trees physically block the player and fireballs.
  if (actNum === 2) {
    const coverPositions = [
      [-6.5, -1.5], [6.5, -1.5], [-8.5, 7], [8.5, 7], [0, 4.5]
    ];
    for (const [x, z] of coverPositions) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.95, 5.2, 9),
        new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 1 })
      );
      trunk.position.y = 2.6;
      trunk.castShadow = true;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 5.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x173d20, roughness: 1 })
      );
      crown.position.y = 6.2;
      crown.castShadow = true;
      tree.add(trunk, crown);
      tree.position.set(x, 0, z);
      bossArenaGroup.add(tree);
      bossCoverColliders.push({ x, z, radius: 1.05, height: 8, type: 'cover' });
    }
  }

  // Act 3 gets ruined inner pillars to reinforce the citadel theme.
  if (actNum === 3) {
    [[-7, 5], [7, 5], [-9, -4], [9, -4]].forEach(([x, z], i) => {
      const h = i % 2 === 0 ? 4.2 : 6;
      const ruin = new THREE.Mesh(
        new THREE.BoxGeometry(2, h, 2),
        new THREE.MeshStandardMaterial({ color: 0x4a484f, roughness: 1 })
      );
      ruin.position.set(x, h / 2, z);
      ruin.rotation.y = i * 0.4;
      ruin.castShadow = true;
      bossArenaGroup.add(ruin);
      bossCoverColliders.push({ x, z, radius: 1.15, height: h, type: 'solid' });
    });
  }

  scene.add(bossArenaGroup);
  envGroup.visible = false;
  npcs.forEach(n => { n.mesh.visible = false; });
  portals.forEach(p => {
    p.visible = false;
    if (p.userData.light) p.userData.light.visible = false;
  });
}

async function tryEnterPortal() {
  if (!playerGroup || state.falling || state.inBossRoom || state.freeRoam) return;
  for (const p of portals) {
    if (p.userData.isPortal && playerGroup.position.distanceTo(p.position) < 5) {
      const req = ACT[state.currentAct].bossReq;
      if (!canEnterBoss(state.player.level, req)) {
        showOverlay('Too Weak', `You need level ${req} to challenge this boss. (Recommended ${ACT[state.currentAct].recommended})`, () => {});
        return;
      }

      gameAudio.play('portal');
      spawnBurst(p.position.clone(), 0x9b5cff, 30, 4.8, 0.8, 0.13);
      state.inBossRoom = true;
      gameAudio.setScene(state.currentAct, true);
      worldGeneration++;
      monsters.forEach(m => scene.remove(m.mesh));
      monsters = [];
      clearProjectiles();
      await createBossArena(state.currentAct);
      playerGroup.position.set(0, 0, 12);

      const boss = await createMonster('boss', 0, -10, true);
      monsters.push(boss);
      gameAudio.play('boss');
      showOverlay(`Act ${state.currentAct} Boss Room`, `The arena is sealed. Defeat the boss to continue.`, () => {});
      return;
    }
  }
}

async function rebuildWorld() {
  loading.classList.remove('hidden');
  $('loading-text').textContent = state.freeRoam ? 'Opening free roam...' : `Entering ${ACT[state.currentAct].name}...`;
  await buildAct(state.currentAct);
  gameAudio.setScene(state.currentAct, false);
  playerGroup.position.set(0, 0, 4);
  loading.classList.add('hidden');
  updateHUD();
}

// ===================== MINIMAP =====================
function drawMinimap() {
  if (!minimapCtx || !playerGroup) return;
  const ctx = minimapCtx;
  const s = 160;
  const scale = 1.2;
  const cx = s / 2;
  const cy = s / 2;

  ctx.fillStyle = state.inBossRoom ? '#16111d' : '#0a1a0a';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeRect(5, 5, s - 10, s - 10);

  if (state.inBossRoom) {
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    if (state.currentAct === 3) {
      ctx.strokeStyle = 'rgba(180,180,195,0.42)';
      ctx.lineWidth = 1;
      act3SafeZones.forEach(zone => {
        const x = cx + (zone.x - playerGroup.position.x) * scale - (zone.w * scale) / 2;
        const y = cy + (zone.z - playerGroup.position.z) * scale - (zone.d * scale) / 2;
        ctx.strokeRect(x, y, zone.w * scale, zone.d * scale);
      });
    }
    // Town / NPC markers.
    npcs.forEach(n => {
      const dx = (n.mesh.position.x - playerGroup.position.x) * scale;
      const dz = (n.mesh.position.z - playerGroup.position.z) * scale;
      if (Math.abs(dx) < 74 && Math.abs(dz) < 74) {
        ctx.fillStyle = n.type === 'inn' ? '#f0d060' : n.type === 'shop' ? '#e67e22' : '#2ecc71';
        ctx.fillRect(cx + dx - 2.5, cy + dz - 2.5, 5, 5);
      }
    });
  }

  ctx.fillStyle = '#e74c3c';
  monsters.forEach(m => {
    if (m.hp <= 0) return;
    const dx = (m.mesh.position.x - playerGroup.position.x) * scale;
    const dz = (m.mesh.position.z - playerGroup.position.z) * scale;
    if (Math.abs(dx) < 70 && Math.abs(dz) < 70) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dz, m.isBoss ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (!state.inBossRoom) {
    ctx.fillStyle = '#8844ff';
    portals.forEach(p => {
      const dx = (p.position.x - playerGroup.position.x) * scale;
      const dz = (p.position.z - playerGroup.position.z) * scale;
      if (Math.abs(dx) < 74 && Math.abs(dz) < 74) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dz, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Player + facing direction arrow.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-playerGroup.rotation.y);
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ddd';
  ctx.font = '9px sans-serif';
  ctx.fillText('N', 77, 12);
}

function spawnProjectile(mon, options = {}) {
  if (!playerGroup || mon.hp <= 0) return;
  gameAudio.play(mon.isBoss ? 'fireball' : 'projectile');
  const start = mon.mesh.position.clone().add(new THREE.Vector3(0, mon.isBoss ? 2.2 : 1.3, 0));
  const target = playerGroup.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  const dir = target.sub(start).normalize();
  const spread = options.spread || 0;
  if (spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
  const isBossShot = mon.isBoss;
  const radius = options.radius || (isBossShot ? 0.4 : 0.23);
  const color = options.color ?? (isBossShot ? 0xff5722 : 0xd7ecff);
  const emissive = options.emissive ?? (isBossShot ? 0xaa2200 : 0x446688);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 12),
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 1.25
    })
  );
  mesh.position.copy(start);
  scene.add(mesh);
  projectiles.push({
    mesh,
    velocity: dir.multiplyScalar(options.speed || (isBossShot ? 12 : 10)),
    speed: options.speed || (isBossShot ? 12 : 10),
    damage: options.damage || mon.atk + Math.floor(Math.random() * 6),
    life: options.life || 4.5,
    owner: mon,
    radius,
    homing: Boolean(options.homing),
    turnRate: options.turnRate || 2.8,
    blockedByCover: options.blockedByCover !== false
  });
}

function projectileHitsCover(projectile) {
  if (!projectile.blockedByCover) return false;
  for (const c of activeCoverColliders()) {
    const dx = projectile.mesh.position.x - c.x;
    const dz = projectile.mesh.position.z - c.z;
    if (dx * dx + dz * dz <= Math.pow(c.radius + projectile.radius, 2)) return true;
  }
  return false;
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;

    if (p.homing && playerGroup) {
      const desired = playerGroup.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(p.mesh.position).normalize().multiplyScalar(p.speed);
      p.velocity.lerp(desired, THREE.MathUtils.clamp(p.turnRate * dt, 0, 0.22));
    }

    p.mesh.position.addScaledVector(p.velocity, dt);
    const hitCover = projectileHitsCover(p);
    if (p.life <= 0 || hitCover) {
      if (hitCover) {
        gameAudio.play('blocked');
        spawnBurst(p.mesh.position.clone(), 0xd9c5a3, 8, 2.6, 0.30, 0.075);
      }
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    const target = playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0));
    if (p.mesh.position.distanceTo(target) < 0.85 + p.radius) {
      damagePlayer(p.damage, p.owner?.mesh?.position || null, p.owner?.isBoss ? 0.85 : 0.35);
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function removeBossWarning(mon) {
  if (!mon?.warningMesh) return;
  if (mon.warningMesh.parent) mon.warningMesh.parent.remove(mon.warningMesh);
  mon.warningMesh.geometry?.dispose?.();
  mon.warningMesh.material?.dispose?.();
  mon.warningMesh = null;
}

function beginCharge(mon, telegraphTime = 0.85, color = 0xff3b30) {
  removeBossWarning(mon);
  gameAudio.play('charge');
  mon.aiState = 'telegraph';
  mon.stateTimer = telegraphTime;
  mon.hasHitDuringCharge = false;
  mon.chargeDir.copy(playerGroup.position).sub(mon.mesh.position).setY(0);
  if (mon.chargeDir.lengthSq() < 0.001) mon.chargeDir.set(0, 0, 1);
  mon.chargeDir.normalize();

  const length = 27;
  const warning = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.04, length),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false })
  );
  warning.position.copy(mon.mesh.position).addScaledVector(mon.chargeDir, length / 2);
  warning.position.y = 0.08;
  warning.rotation.y = Math.atan2(mon.chargeDir.x, mon.chargeDir.z);
  (bossArenaGroup || scene).add(warning);
  mon.warningMesh = warning;
}

function updateChargePattern(mon, dt, config = {}) {
  const telegraph = config.telegraph ?? 0.85;
  const chargeSpeed = config.chargeSpeed ?? 18;
  const chargeTime = config.chargeTime ?? 1.0;
  const recovery = config.recovery ?? 1.15;
  const damageMult = config.damageMult ?? 1.45;

  mon.stateTimer -= dt;
  if (mon.aiState === 'idle') {
    if (mon.stateTimer <= 0) beginCharge(mon, telegraph, config.color);
    return;
  }

  if (mon.aiState === 'telegraph') {
    mon.mesh.lookAt(
      mon.mesh.position.x + mon.chargeDir.x,
      mon.mesh.position.y,
      mon.mesh.position.z + mon.chargeDir.z
    );
    if (mon.warningMesh?.material) mon.warningMesh.material.opacity = 0.28 + Math.sin(performance.now() * 0.018) * 0.18;
    if (mon.stateTimer <= 0) {
      removeBossWarning(mon);
      mon.aiState = 'charge';
      mon.stateTimer = chargeTime;
      mon.hasHitDuringCharge = false;
    }
    return;
  }

  if (mon.aiState === 'charge') {
    const delta = mon.chargeDir.clone().multiplyScalar(chargeSpeed * dt);
    moveWithCollisions(mon.mesh, delta, 1.1, false);
    const radial = new THREE.Vector2(mon.mesh.position.x, mon.mesh.position.z);
    if (radial.length() > 15.5) {
      radial.setLength(15.5);
      mon.mesh.position.x = radial.x;
      mon.mesh.position.z = radial.y;
      mon.stateTimer = 0;
    }
    if (!mon.hasHitDuringCharge && mon.mesh.position.distanceTo(playerGroup.position) < 2.4) {
      mon.hasHitDuringCharge = true;
      damagePlayer(Math.floor(mon.atk * damageMult), mon.mesh.position, 2.0);
    }
    if (mon.stateTimer <= 0) {
      mon.aiState = 'recovery';
      mon.stateTimer = recovery;
    }
    return;
  }

  if (mon.aiState === 'recovery' && mon.stateTimer <= 0) {
    mon.aiState = 'idle';
    mon.stateTimer = 0.55;
  }
}

function beginGroundSlam(mon) {
  removeBossWarning(mon);
  mon.aiState = 'slamTelegraph';
  mon.stateTimer = 0.95;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.8, 6.5, 48),
    new THREE.MeshBasicMaterial({ color: 0xff5722, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(mon.mesh.position);
  ring.position.y = 0.09;
  (bossArenaGroup || scene).add(ring);
  mon.warningMesh = ring;
}

function updateGroundSlam(mon, dt) {
  mon.stateTimer -= dt;
  const dist = mon.mesh.position.distanceTo(playerGroup.position);
  if (mon.aiState === 'slamTelegraph') {
    if (mon.warningMesh?.material) mon.warningMesh.material.opacity = 0.32 + Math.sin(performance.now() * 0.022) * 0.18;
    if (mon.stateTimer <= 0) {
      gameAudio.play('slam');
      spawnBurst(mon.mesh.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 0xff6b35, 38, 7.0, 0.65, 0.14);
      addCameraShake(0.20, 0.32);
      if (dist < 6.4) damagePlayer(Math.floor(mon.atk * 1.8), mon.mesh.position, 2.4);
      removeBossWarning(mon);
      mon.aiState = 'slamRecovery';
      mon.stateTimer = 0.9;
    }
    return;
  }
  if (mon.aiState === 'slamRecovery') {
    if (mon.stateTimer <= 0) {
      mon.aiState = 'idle';
      mon.stateTimer = 1.25;
    }
    return;
  }

  if (dist > 6.3) {
    const dir = playerGroup.position.clone().sub(mon.mesh.position).setY(0).normalize();
    moveWithCollisions(mon.mesh, dir.multiplyScalar(mon.speed * 0.78 * dt), 1.15, false);
  }
  if (mon.stateTimer <= 0 || dist < 5.8) beginGroundSlam(mon);
}

function updateAct2Boss(mon, dt, dist, dir) {
  mon.cooldown = Math.max(0, mon.cooldown - dt);
  const bossPos = mon.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0));
  const playerPos = playerGroup.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  const blocked = segmentBlockedByCover(bossPos, playerPos, bossCoverColliders);
  const preferred = 12;

  if (blocked) {
    // Reposition until the player is visible again; cover therefore matters tactically.
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    moveWithCollisions(mon.mesh, side.multiplyScalar(mon.speed * 0.75 * dt), 1.05, false);
    playAnimation(mon.animation, 'walk');
    return;
  }

  if (dist > preferred + 2) moveWithCollisions(mon.mesh, dir.clone().multiplyScalar(mon.speed * 0.55 * dt), 1.05, false);
  else if (dist < preferred - 3) moveWithCollisions(mon.mesh, dir.clone().multiplyScalar(-mon.speed * 0.45 * dt), 1.05, false);

  if (dist < 20 && mon.cooldown <= 0) {
    mon.cooldown = 1.35;
    spawnProjectile(mon, { homing: true, turnRate: 3.2, speed: 10.8, radius: 0.45, color: 0xff642e, emissive: 0xbb2600 });
    playAnimation(mon.animation, 'attack', true);
    mon.animLock = 0.45;
  }
}

function updateAct3Boss(mon, dt, dist, dir) {
  const hpPct = mon.hp / mon.maxHp;
  const nextPhase = hpPct < 0.33 ? 3 : hpPct < 0.66 ? 2 : 1;
  if (nextPhase !== mon.phase) {
    removeBossWarning(mon);
    mon.phase = nextPhase;
    mon.aiState = 'idle';
    mon.stateTimer = 0.7;
    mon.cooldown = 0.45;
    flashMonster(mon);
  }

  if (mon.phase === 1) {
    updateChargePattern(mon, dt, { telegraph: 0.95, chargeSpeed: 16, chargeTime: 1.0, recovery: 1.0, damageMult: 1.35, color: 0xff9f43 });
    return;
  }

  if (mon.phase === 2) {
    mon.cooldown = Math.max(0, mon.cooldown - dt);
    const preferred = 11;
    if (dist > preferred + 2) moveWithCollisions(mon.mesh, dir.clone().multiplyScalar(mon.speed * 0.55 * dt), 1.15, false);
    else if (dist < preferred - 2) moveWithCollisions(mon.mesh, dir.clone().multiplyScalar(-mon.speed * 0.45 * dt), 1.15, false);
    if (mon.cooldown <= 0) {
      mon.cooldown = 1.25;
      [-0.18, 0, 0.18].forEach(spread => spawnProjectile(mon, {
        spread,
        speed: 12.5,
        radius: 0.32,
        damage: Math.floor(mon.atk * 0.9),
        color: 0xffc04d,
        emissive: 0xb86b00
      }));
      mon.animLock = 0.45;
    }
    return;
  }

  updateGroundSlam(mon, dt);
}

function updateBossAI(mon, dt, dist, dir) {
  if (state.currentAct === 1) {
    updateChargePattern(mon, dt, { telegraph: 0.8, chargeSpeed: 18.5, chargeTime: 0.95, recovery: 1.2, damageMult: 1.5, color: 0xff3b30 });
  } else if (state.currentAct === 2) {
    updateAct2Boss(mon, dt, dist, dir);
  } else {
    updateAct3Boss(mon, dt, dist, dir);
  }
}

// ===================== LOOP =====================
function animate() {
  requestAnimationFrame(animate);
  if (!playerGroup || state.isDead) {
    if (renderer && scene && camera) renderer.render(scene, camera);
    return;
  }

  const dt = Math.min(clock.getDelta(), 0.05);
  attackCooldown = Math.max(0, attackCooldown - dt);
  fallCooldown = Math.max(0, fallCooldown - dt);
  footstepTimer = Math.max(0, footstepTimer - dt);
  mixers.forEach(controller => controller.mixer.update(dt));
  updateVisualEffects(dt);

  const uiBlocking = !overlay.classList.contains('hidden') || !modal.classList.contains('hidden');
  if (uiBlocking) {
    drawMinimap();
    renderer.render(scene, camera);
    return;
  }

  const speed = 8;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  const move = new THREE.Vector3();
  if (keys['KeyW'] || keys['ArrowUp']) move.add(forward);
  if (keys['KeyS'] || keys['ArrowDown']) move.sub(forward);
  if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);
  if (keys['KeyD'] || keys['ArrowRight']) move.add(right);

  let moving = false;
  if (!state.falling && move.length() > 0) {
    move.normalize().multiplyScalar(speed * dt);
    moving = moveWithCollisions(playerGroup, move, 0.55, false);
    if (moving) {
      const targetAngle = Math.atan2(move.x, move.z);
      playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, targetAngle + Math.PI, 0.15);
    }
  }

  // Highland Citadel: stepping off the platforms/bridges sends the player into the void.
  if (state.currentAct === 3 && !state.inBossRoom) {
    if (!state.falling && !isAct3Walkable(playerGroup.position.x, playerGroup.position.z)) {
      state.falling = true;
    }
    if (state.falling) {
      playerGroup.position.y -= 16 * dt;
      if (playerGroup.position.y < -8) {
        state.falling = false;
        playerGroup.position.set(0, 0, 4);
        if (fallCooldown <= 0) {
          fallCooldown = 1;
          damagePlayer(Math.max(1, Math.floor(state.player.maxHp * 0.2)));
        }
      }
    } else {
      playerGroup.position.y = THREE.MathUtils.lerp(playerGroup.position.y, 0, 0.3);
    }
  } else {
    state.falling = false;
    playerGroup.position.y = THREE.MathUtils.lerp(playerGroup.position.y, 0, 0.3);
  }

  if (state.inBossRoom) {
    const flat = new THREE.Vector2(playerGroup.position.x, playerGroup.position.z);
    const maxRadius = 16.2;
    if (flat.length() > maxRadius) {
      flat.setLength(maxRadius);
      playerGroup.position.x = flat.x;
      playerGroup.position.z = flat.y;
    }
  } else if (state.currentAct !== 3) {
    playerGroup.position.x = THREE.MathUtils.clamp(playerGroup.position.x, -94, 94);
    playerGroup.position.z = THREE.MathUtils.clamp(playerGroup.position.z, -94, 94);
  }

  if (moving && !state.falling && footstepTimer <= 0) {
    gameAudio.play('footstep');
    footstepTimer = 0.34;
  }
  updatePlayerVisual(dt, moving && !state.falling);

  const offset = new THREE.Vector3(0, 7, 11);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  camera.position.lerp(playerGroup.position.clone().add(offset), 0.1);
  if (cameraShakeTime > 0) {
    cameraShakeTime = Math.max(0, cameraShakeTime - dt);
    const fade = cameraShakeTime > 0 ? 1 : 0;
    camera.position.add(new THREE.Vector3(
      (Math.random() - 0.5) * cameraShakeStrength * fade,
      (Math.random() - 0.5) * cameraShakeStrength * 0.7 * fade,
      (Math.random() - 0.5) * cameraShakeStrength * fade
    ));
    if (cameraShakeTime <= 0) cameraShakeStrength = 0;
  }
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.4, playerGroup.position.z);

  monsters.forEach(mon => {
    if (mon.hp <= 0 || state.isDead) return;
    mon.cooldown = Math.max(0, mon.cooldown - dt);
    mon.animLock = Math.max(0, (mon.animLock || 0) - dt);
    mon.barBg.lookAt(camera.position);

    const dist = mon.mesh.position.distanceTo(playerGroup.position);
    const aggro = mon.isBoss ? 45 : 24;
    const dir = playerGroup.position.clone().sub(mon.mesh.position).setY(0);
    if (dir.lengthSq() > 0.0001) dir.normalize();
    mon.mesh.lookAt(playerGroup.position.x, mon.mesh.position.y, playerGroup.position.z);

    if (mon.isBoss) {
      updateBossAI(mon, dt, dist, dir);
      updateProceduralMonsterVisual(mon, dt, mon.aiState === 'charge');
      return;
    }

    if (dist >= aggro) {
      if (mon.animLock <= 0) playAnimation(mon.animation, 'idle');
      updateProceduralMonsterVisual(mon, dt, false);
      return;
    }

    if (mon.isRanged) {
      const start = mon.mesh.position.clone().add(new THREE.Vector3(0, 1.3, 0));
      const end = playerGroup.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      const blocked = segmentBlockedByCover(start, end, coverColliders);
      const preferred = 10;
      let didMove = false;

      if (blocked) {
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        didMove = moveWithCollisions(mon.mesh, side.multiplyScalar(mon.speed * 0.65 * dt), 0.7, false);
      } else if (dist > preferred + 2) {
        didMove = moveWithCollisions(mon.mesh, dir.clone().multiplyScalar(mon.speed * 0.7 * dt), 0.7, false);
      } else if (dist < preferred - 3) {
        didMove = moveWithCollisions(mon.mesh, dir.clone().multiplyScalar(-mon.speed * 0.55 * dt), 0.7, false);
      }

      if (!blocked && dist < 18 && mon.cooldown <= 0) {
        mon.cooldown = 1.65;
        spawnProjectile(mon);
        if (mon.animation) {
          playAnimation(mon.animation, 'attack', true);
          mon.animLock = 0.5;
        }
      } else if (mon.animLock <= 0) {
        playAnimation(mon.animation, didMove ? 'walk' : 'idle');
      }
      updateProceduralMonsterVisual(mon, dt, didMove);
      return;
    }

    let didMove = false;
    if (dist > 2.5) {
      didMove = moveWithCollisions(
        mon.mesh,
        dir.clone().multiplyScalar(mon.speed * dt),
        mon.type === 'golem' ? 0.95 : 0.65,
        state.currentAct === 3
      );
    }

    if (dist < 2.8 && mon.cooldown <= 0) {
      mon.cooldown = 1.0;
      const dmg = mon.atk + Math.floor(Math.random() * 6);
      damagePlayer(dmg, mon.mesh.position, 0.55);
      if (mon.animation) {
        playAnimation(mon.animation, 'attack', true);
        mon.animLock = 0.5;
      }
    } else if (mon.animLock <= 0) {
      playAnimation(mon.animation, didMove ? 'walk' : 'idle');
    }
    updateProceduralMonsterVisual(mon, dt, didMove);
  });

  updateProjectiles(dt);

  let prompt = '';
  if (!state.falling) {
    for (const npc of npcs) {
      if (playerGroup.position.distanceTo(npc.mesh.position) < 4) {
        prompt = `Press T — ${npc.role}`;
        break;
      }
    }
    if (!prompt && !state.freeRoam) {
      for (const p of portals) {
        if (playerGroup.position.distanceTo(p.position) < 5) {
          prompt = 'Press E — Enter Boss Room';
          break;
        }
      }
    }
  }
  if (prompt) {
    contextPrompt.textContent = prompt;
    contextPrompt.classList.remove('hidden');
  } else {
    contextPrompt.classList.add('hidden');
  }

  portals.forEach(p => { p.rotation.z += dt * 1.2; });
  drawMinimap();
  renderer.render(scene, camera);
}

// ===================== BOOT =====================
function updateAudioButtons() {
  const musicBtn = $('music-toggle');
  const sfxBtn = $('sfx-toggle');
  if (musicBtn) musicBtn.textContent = gameAudio.musicEnabled ? '🎵 Music: On' : '🎵 Music: Off';
  if (sfxBtn) sfxBtn.textContent = gameAudio.sfxEnabled ? '🔊 SFX: On' : '🔇 SFX: Off';
}

function init() {
  updateAudioButtons();
  $('music-toggle')?.addEventListener('click', async e => {
    e.stopPropagation();
    await gameAudio.unlock();
    gameAudio.toggleMusic();
    updateAudioButtons();
    gameAudio.play('ui');
  });
  $('sfx-toggle')?.addEventListener('click', async e => {
    e.stopPropagation();
    await gameAudio.unlock();
    gameAudio.toggleSfx();
    updateAudioButtons();
    gameAudio.play('ui');
  });
  document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.player.gender = btn.dataset.gender;
    });
  });

  $('start-btn').addEventListener('click', () => startGame(false));
  $('load-btn').addEventListener('click', () => {
    if (loadGame()) startGame(true);
    else alert('No save found.');
  });
  $('credits-btn').addEventListener('click', () => {
    startScreen.classList.add('hidden');
    creditsScreen.classList.remove('hidden');
  });
  $('close-credits').addEventListener('click', () => {
    creditsScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });
  $('modal-close').addEventListener('click', closeModal);

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    const uiBlocking = !overlay.classList.contains('hidden') || !modal.classList.contains('hidden');
    if (uiBlocking) return;
    keys[e.code] = true;
    if (e.code === 'KeyH') usePotion();
    if (e.code === 'KeyM') { gameAudio.toggleMusic(); updateAudioButtons(); }
    if (e.code === 'KeyN') { gameAudio.toggleSfx(); updateAudioButtons(); }
    if (e.code === 'KeyT') tryInteract();
    if (e.code === 'KeyE') tryEnterPortal();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('click', onClickAttack);
  window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

async function startGame(fromSave) {
  await gameAudio.unlock();
  if (!fromSave) {
    state.player.name = $('username').value.trim() || 'Adventurer';
  }
  startScreen.classList.add('hidden');
  loading.classList.remove('hidden');
  $('loading-text').textContent = 'Loading models...';

  clampPlayerProgression();
  await setupThree();
  await buildAct(state.currentAct);
  gameAudio.setScene(state.currentAct, false);
  await spawnPlayer();
  if (fromSave && state.savedPosition) {
    const pos = state.savedPosition;
    playerGroup.position.set(Number(pos.x) || 0, Number(pos.y) || 0, Number(pos.z) || 4);
    if (state.currentAct === 3 && !isAct3Walkable(playerGroup.position.x, playerGroup.position.z)) {
      playerGroup.position.set(0, 0, 4);
    }
  }
  updateHUD();
  hud.classList.remove('hidden');
  loading.classList.add('hidden');
  animate();
  saveGame();
}

init();
