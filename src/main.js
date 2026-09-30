/**
 * Valor Forged — Fully Playable 3D Action RPG
 * Three.js + real GLB models
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

const MAX_LEVEL = 299;
const POTION_HEAL_FRACTION = 0.5;
const DEATH_GOLD_LOSS_FRACTION = 0.10;
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
    spider: 'models/monsters/spider/spider_rigged.glb',
    archer: 'models/monsters/archer/archer_stylized.glb',
    golem: 'models/monsters/golem/stone_golem.glb'
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
let mixers = [];
let townCenter = new THREE.Vector3(0, 0, 0);

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
function xpForLevel(lv) {
  if (lv >= MAX_LEVEL) return 0;
  const n = Math.max(0, lv - 1);
  return Math.floor(100 + n * 22 + Math.pow(n, 1.12) * 4);
}

function clampPlayerProgression() {
  const p = state.player;
  p.level = THREE.MathUtils.clamp(Math.floor(p.level || 1), 1, MAX_LEVEL);
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
    position: playerGroup ? {
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
  if (modelCache[path]) return Promise.resolve(modelCache[path].clone());
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      gltf => {
        modelCache[path] = gltf.scene;
        // enable shadows
        gltf.scene.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        resolve(gltf.scene.clone());
      },
      undefined,
      err => {
        console.warn('Failed to load', path, err);
        // fallback box
        const geo = new THREE.BoxGeometry(1, 1.5, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        resolve(new THREE.Mesh(geo, mat));
      }
    );
  });
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
  // clear previous
  while (envGroup.children.length) envGroup.remove(envGroup.children[0]);
  monsters.forEach(m => scene.remove(m.mesh));
  monsters = [];
  portals.forEach(p => { scene.remove(p); if (p.userData.light) scene.remove(p.userData.light); });
  portals = [];
  npcs.forEach(n => scene.remove(n.mesh));
  npcs = [];

  const cfg = ACT[actNum];
  scene.background = new THREE.Color(cfg.fog);
  scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ color: cfg.ground, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  envGroup.add(ground);

  // Scatter environment
  await scatterEnvironment(actNum);

  // Town area (always near origin)
  await buildTown();

  // Monsters
  await spawnMonsters(actNum);

  // Boss portal is only available until that Act's boss is defeated.
  if (!isBossDefeated(actNum) && !state.freeRoam) await spawnBossPortal(actNum);
}

async function scatterEnvironment(actNum) {
  const trees = MODEL_PATHS.env.tree;
  const pines = MODEL_PATHS.env.pine;
  const count = actNum === 1 ? 25 : actNum === 2 ? 40 : 15;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 70;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    // avoid town center
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;

    const path = actNum === 2
      ? pines[Math.floor(Math.random() * pines.length)]
      : trees[Math.floor(Math.random() * trees.length)];

    try {
      const m = await loadModel(path);
      fitModel(m, 4 + Math.random() * 4);
      m.position.set(x, 0, z);
      m.rotation.y = Math.random() * Math.PI * 2;
      envGroup.add(m);
    } catch {}
  }

  // Rocks
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - 0.5) * 120;
    const z = (Math.random() - 0.5) * 120;
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    try {
      const m = await loadModel(MODEL_PATHS.env.rock[Math.floor(Math.random() * 2)]);
      fitModel(m, 0.8 + Math.random() * 1.5);
      m.position.set(x, 0, z);
      envGroup.add(m);
    } catch {}
  }
}

async function buildTown() {
  // Inn
  try {
    const inn = await loadModel(MODEL_PATHS.buildings.inn);
    fitModel(inn, 6);
    inn.position.set(-8, 0, -6);
    envGroup.add(inn);
  } catch {}

  // Weapon shop
  try {
    const shop = await loadModel(MODEL_PATHS.buildings.shop);
    fitModel(shop, 4);
    shop.position.set(8, 0, -5);
    envGroup.add(shop);
  } catch {}

  // Weaponsmith NPC
  try {
    const smith = await loadModel(MODEL_PATHS.npcs.weaponsmith);
    fitModel(smith, 1.8);
    smith.position.set(8, 0, -2);
    scene.add(smith);
    npcs.push({ mesh: smith, role: 'Weaponsmith', type: 'shop' });
  } catch {
    // fallback
    const geo = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x886633 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(8, 0.9, -2);
    scene.add(m);
    npcs.push({ mesh: m, role: 'Weaponsmith', type: 'shop' });
  }

  // Innkeeper (reuse player model scaled)
  try {
    const innk = await loadModel(MODEL_PATHS.player.male);
    fitModel(innk, 1.7);
    innk.position.set(-8, 0, -2);
    scene.add(innk);
    npcs.push({ mesh: innk, role: 'Innkeeper', type: 'inn' });
  } catch {}

  // Alchemist
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
    playerGroup.add(playerModel);
  } catch {
    const geo = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    playerModel = new THREE.Mesh(geo, mat);
    playerModel.position.y = 0.9;
    playerGroup.add(playerModel);
  }

  playerGroup.position.set(0, 0, 4);
}

async function spawnMonsters(actNum) {
  const types = ACT[actNum].monsters;
  const count = 8 + actNum * 3;

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const angle = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 50;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const mon = await createMonster(type, x, z, false);
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
    // Each monster gets its own materials so hit-flash does not affect every clone.
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
  scene.add(mesh);

  // HP bar
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
    phase: 1
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

  // marker light
  const light = new THREE.PointLight(0x8844ff, 1.5, 15);
  light.position.copy(portal.position);
  scene.add(light);
  portal.userData.light = light;
}

// ===================== COMBAT & SYSTEMS =====================
function onClickAttack(e) {
  if (state.isDead || attackCooldown > 0 || !playerGroup) return;
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
  const dmg = state.player.attack + Math.floor(Math.random() * 8);
  mon.hp -= dmg;
  flashMonster(mon);
  applyKnockback(mon, 1.15);
  showDamage(mon.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), dmg);

  const pct = Math.max(0, mon.hp / mon.maxHp);
  mon.barFill.scale.x = pct;
  mon.barFill.position.x = -0.575 * (1 - pct);

  if (mon.hp <= 0) onMonsterDeath(mon);
}

function awardMonsterRewards(mon) {
  const playerLevel = Math.max(1, state.player.level);
  const ratio = THREE.MathUtils.clamp(mon.level / playerLevel, 0.25, 1.6);
  const baseXp = mon.isBoss ? 600 + mon.level * 35 : 45 + mon.level * 14;
  const xpGain = Math.max(1, Math.round(baseXp * ratio));
  const goldGain = mon.isBoss ? 100 + mon.level * 10 : 5 + mon.level * 5;

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
    const angle = Math.random() * Math.PI * 2;
    const r = 22 + Math.random() * 48;
    const respawned = await createMonster(type, Math.cos(angle) * r, Math.sin(angle) * r, false);
    if (generation === worldGeneration && state.currentAct === actAtDeath && !state.inBossRoom) monsters.push(respawned);
    else scene.remove(respawned.mesh);
  }, delay);
}

function onMonsterDeath(mon) {
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
  const lost = Math.floor(state.player.gold * DEATH_GOLD_LOSS_FRACTION);
  state.player.gold = Math.max(0, state.player.gold - lost);
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
  if (!playerGroup || state.player.potions <= 0 || state.player.hp >= state.player.maxHp || state.isDead) return;
  state.player.potions--;
  const heal = Math.floor(state.player.maxHp * POTION_HEAL_FRACTION);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
  showDamage(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), heal, 'heal');
  updateHUD();
  saveGame();
}

function tryInteract() {
  if (!playerGroup) return;
  for (const npc of npcs) {
    if (playerGroup.position.distanceTo(npc.mesh.position) < 4) {
      openNPC(npc);
      return;
    }
  }
}

function openNPC(npc) {
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
  if (envGroup) envGroup.visible = true;
  npcs.forEach(n => { n.mesh.visible = true; });
  portals.forEach(p => {
    p.visible = true;
    if (p.userData.light) p.userData.light.visible = true;
  });
}

function createBossArena(actNum) {
  clearBossArena();
  bossArenaGroup = new THREE.Group();
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

  scene.add(bossArenaGroup);
  envGroup.visible = false;
  npcs.forEach(n => { n.mesh.visible = false; });
  portals.forEach(p => {
    p.visible = false;
    if (p.userData.light) p.userData.light.visible = false;
  });
}

async function tryEnterPortal() {
  if (!playerGroup || state.inBossRoom || state.freeRoam) return;
  for (const p of portals) {
    if (p.userData.isPortal && playerGroup.position.distanceTo(p.position) < 5) {
      const req = ACT[state.currentAct].bossReq;
      if (state.player.level < req) {
        showOverlay('Too Weak', `You need level ${req} to challenge this boss. (Recommended ${ACT[state.currentAct].recommended})`, () => {});
        return;
      }

      state.inBossRoom = true;
      worldGeneration++;
      monsters.forEach(m => scene.remove(m.mesh));
      monsters = [];
      clearProjectiles();
      createBossArena(state.currentAct);
      playerGroup.position.set(0, 0, 12);

      const boss = await createMonster('boss', 0, -10, true);
      monsters.push(boss);
      showOverlay(`Act ${state.currentAct} Boss Room`, `The arena is sealed. Defeat the boss to continue.`, () => {});
      return;
    }
  }
}

async function rebuildWorld() {
  loading.classList.remove('hidden');
  $('loading-text').textContent = state.freeRoam ? 'Opening free roam...' : `Entering ${ACT[state.currentAct].name}...`;
  await buildAct(state.currentAct);
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

function spawnProjectile(mon) {
  if (!playerGroup || mon.hp <= 0) return;
  const start = mon.mesh.position.clone().add(new THREE.Vector3(0, mon.isBoss ? 2.2 : 1.3, 0));
  const target = playerGroup.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  const dir = target.sub(start).normalize();
  const isBossShot = mon.isBoss;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(isBossShot ? 0.38 : 0.22, 10, 10),
    new THREE.MeshStandardMaterial({
      color: isBossShot ? 0xff5722 : 0xd7ecff,
      emissive: isBossShot ? 0xaa2200 : 0x446688,
      emissiveIntensity: 1.1
    })
  );
  mesh.position.copy(start);
  scene.add(mesh);
  projectiles.push({
    mesh,
    velocity: dir.multiplyScalar(isBossShot ? 12 : 10),
    damage: mon.atk + Math.floor(Math.random() * 6),
    life: 4,
    owner: mon
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }
    const target = playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0));
    if (p.mesh.position.distanceTo(target) < 0.85) {
      state.player.hp = Math.max(0, state.player.hp - p.damage);
      showDamage(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), p.damage);
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      updateHUD();
      if (state.player.hp <= 0) onPlayerDeath();
    }
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

  // Movement
  const speed = 8;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  const move = new THREE.Vector3();
  if (keys['KeyW'] || keys['ArrowUp']) move.add(forward);
  if (keys['KeyS'] || keys['ArrowDown']) move.sub(forward);
  if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);
  if (keys['KeyD'] || keys['ArrowRight']) move.add(right);
  if (move.length() > 0) {
    move.normalize().multiplyScalar(speed * dt);
    playerGroup.position.add(move);
    // face movement
    const targetAngle = Math.atan2(move.x, move.z);
    playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, targetAngle + Math.PI, 0.15);
  }

  // Keep the player inside the sealed boss arena.
  if (state.inBossRoom) {
    const flat = new THREE.Vector2(playerGroup.position.x, playerGroup.position.z);
    const maxRadius = 16.2;
    if (flat.length() > maxRadius) {
      flat.setLength(maxRadius);
      playerGroup.position.x = flat.x;
      playerGroup.position.z = flat.y;
    }
  }

  // Camera
  const offset = new THREE.Vector3(0, 7, 11);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  camera.position.lerp(playerGroup.position.clone().add(offset), 0.1);
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.4, playerGroup.position.z);

  // Monster AI
  monsters.forEach(mon => {
    if (mon.hp <= 0 || state.isDead) return;
    mon.cooldown = Math.max(0, mon.cooldown - dt);
    mon.barBg.lookAt(camera.position);

    const dist = mon.mesh.position.distanceTo(playerGroup.position);
    const aggro = mon.isBoss ? 45 : 24;
    if (dist >= aggro) return;

    const dir = playerGroup.position.clone().sub(mon.mesh.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.0001) dir.normalize();
    mon.mesh.lookAt(playerGroup.position.x, mon.mesh.position.y, playerGroup.position.z);

    if (mon.isRanged) {
      // Ranged enemies keep some distance and fire actual projectiles.
      const preferred = mon.isBoss ? 13 : 10;
      if (dist > preferred + 2) mon.mesh.position.addScaledVector(dir, mon.speed * 0.7 * dt);
      else if (dist < preferred - 3) mon.mesh.position.addScaledVector(dir, -mon.speed * 0.55 * dt);
      if (dist < 18 && mon.cooldown <= 0) {
        mon.cooldown = mon.isBoss ? 1.15 : 1.65;
        spawnProjectile(mon);
      }
      return;
    }

    if (dist > 2.5) mon.mesh.position.addScaledVector(dir, mon.speed * dt);
    if (dist < 2.8 && mon.cooldown <= 0) {
      mon.cooldown = mon.isBoss ? 0.85 : 1.0;
      let dmg = mon.atk + Math.floor(Math.random() * 6);
      if (mon.isBoss && state.currentAct === 3) {
        const hpPct = mon.hp / mon.maxHp;
        mon.phase = hpPct < 0.33 ? 3 : hpPct < 0.66 ? 2 : 1;
        if (mon.phase === 2) dmg = Math.floor(dmg * 1.25);
        if (mon.phase === 3) dmg = Math.floor(dmg * 1.5);
      }
      state.player.hp = Math.max(0, state.player.hp - dmg);
      showDamage(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), dmg);
      const push = playerGroup.position.clone().sub(mon.mesh.position).setY(0).normalize();
      playerGroup.position.addScaledVector(push, mon.isBoss ? 1.2 : 0.55);
      updateHUD();
      if (state.player.hp <= 0) onPlayerDeath();
    }
  });

  updateProjectiles(dt);

  // Context prompt
  let prompt = '';
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
function init() {
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
    keys[e.code] = true;
    if (e.code === 'KeyH') usePotion();
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
  if (!fromSave) {
    state.player.name = $('username').value.trim() || 'Adventurer';
  }
  startScreen.classList.add('hidden');
  loading.classList.remove('hidden');
  $('loading-text').textContent = 'Loading models...';

  clampPlayerProgression();
  await setupThree();
  await buildAct(state.currentAct);
  await spawnPlayer();
  if (fromSave && state.savedPosition) {
    const pos = state.savedPosition;
    playerGroup.position.set(Number(pos.x) || 0, Number(pos.y) || 0, Number(pos.z) || 4);
  }
  updateHUD();
  hud.classList.remove('hidden');
  loading.classList.add('hidden');
  animate();
  saveGame();
}

init();
