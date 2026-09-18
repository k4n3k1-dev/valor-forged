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

const MODEL_PATHS = {
  player: {
    male: '/models/player/male.glb',
    female: '/models/player/female.glb'
  },
  monsters: {
    slime: '/models/monsters/slime/slime_animated.glb',
    wolf: '/models/monsters/wolf/wolf.glb',
    spider: '/models/monsters/spider/spider_rigged.glb',
    archer: '/models/monsters/archer/archer_stylized.glb',
    golem: '/models/monsters/golem/stone_golem.glb'
  },
  bosses: {
    1: '/models/bosses/act1_boss.glb',
    2: '/models/bosses/act2_boss.glb',
    3: '/models/bosses/act3_boss_golem.glb'
  },
  npcs: {
    weaponsmith: '/models/npcs/weaponsmith.glb'
  },
  buildings: {
    inn: '/models/buildings/low-poly_outsource_tavern.glb',
    shop: '/models/buildings/weapon_shop.glb'
  },
  env: {
    tree: ['/models/environment/tree_01.glb', '/models/environment/tree_02.glb', '/models/environment/tree_03.glb'],
    pine: ['/models/environment/pine_01.glb', '/models/environment/pine_02.glb'],
    bush: '/models/environment/bush.glb',
    rock: ['/models/environment/rock_medium.glb', '/models/environment/rock_small.glb']
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
let envGroup;
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
  return Math.floor(100 * Math.pow(1.15, lv - 1));
}

function showDamage(worldPos, amount, type = 'dmg') {
  const layer = $('damage-layer');
  const el = document.createElement('div');
  el.className = 'dmg-num' + (type === 'heal' ? ' heal' : type === 'xp' ? ' xp' : '');
  el.textContent = type === 'xp' ? `+${amount} XP` : (type === 'heal' ? `+${amount}` : `-${amount}`);
  // project to screen
  const v = worldPos.clone().project(camera);
  const x = (v.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
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
  $('hud-act-name').textContent = ACT[state.currentAct].name;
  const hpPct = Math.max(0, p.hp / p.maxHp * 100);
  $('hp-fill').style.width = hpPct + '%';
  $('hp-text').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
  const xpPct = p.xp / p.xpToNext * 100;
  $('xp-fill').style.width = xpPct + '%';
  $('xp-text').textContent = `${p.xp}/${p.xpToNext}`;
}

function saveGame() {
  const data = {
    player: { ...state.player },
    flags: { ...state.flags },
    currentAct: state.currentAct
  };
  localStorage.setItem('valorForgedSave', JSON.stringify(data));
}

function loadGame() {
  const raw = localStorage.getItem('valorForgedSave');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    Object.assign(state.player, data.player);
    Object.assign(state.flags, data.flags || {});
    state.currentAct = data.currentAct || 1;
    return true;
  } catch {
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
  // clear previous
  while (envGroup.children.length) envGroup.remove(envGroup.children[0]);
  monsters.forEach(m => scene.remove(m.mesh));
  monsters = [];
  portals.forEach(p => scene.remove(p));
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

  // Boss portal
  await spawnBossPortal(actNum);
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

  const baseHp = isBoss
    ? 500 * state.currentAct * state.currentAct
    : 30 + state.player.level * 8 + (type === 'golem' ? 40 : 0);
  const atk = isBoss
    ? 15 + state.currentAct * 12
    : 6 + Math.floor(state.player.level * 0.8);

  return {
    mesh,
    type,
    isBoss,
    isRanged: type === 'archer' || (isBoss && state.currentAct === 2),
    hp: baseHp,
    maxHp: baseHp,
    atk,
    speed: isBoss ? 3.5 : (type === 'wolf' ? 5 : 3),
    cooldown: 0,
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

  // find which monster
  let mon = null;
  for (const h of hits) {
    let obj = h.object;
    while (obj.parent && !monsters.find(m => m.mesh === obj)) obj = obj.parent;
    mon = monsters.find(m => m.mesh === obj);
    if (mon) break;
  }
  if (!mon || mon.hp <= 0) return;

  const dist = playerGroup.position.distanceTo(mon.mesh.position);
  if (dist > 4.5) return; // melee range

  attackCooldown = 0.45;
  const dmg = state.player.attack + Math.floor(Math.random() * 8);
  mon.hp -= dmg;
  showDamage(mon.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), dmg);

  // update bar
  const pct = Math.max(0, mon.hp / mon.maxHp);
  mon.barFill.scale.x = pct;
  mon.barFill.position.x = -0.575 * (1 - pct);

  if (mon.hp <= 0) {
    onMonsterDeath(mon);
  }
}

function onMonsterDeath(mon) {
  const xpGain = mon.isBoss
    ? 200 * state.currentAct * state.currentAct
    : 15 + state.player.level * 3 + Math.floor(Math.random() * 10);
  const goldGain = mon.isBoss
    ? 150 * state.currentAct
    : 5 + Math.floor(Math.random() * 12);

  state.player.xp += xpGain;
  state.player.gold += goldGain;
  showDamage(mon.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0)), xpGain, 'xp');

  // level up loop
  while (state.player.xp >= state.player.xpToNext) {
    state.player.xp -= state.player.xpToNext;
    state.player.level++;
    state.player.xpToNext = xpForLevel(state.player.level);
    state.player.maxHp = 100 + (state.player.level - 1) * 12;
    state.player.hp = state.player.maxHp;
    state.player.attack = WEAPONS[state.player.weaponIdx].atk + Math.floor((state.player.level - 1) * 1.5);
    showOverlay('Level Up!', `You reached level ${state.player.level}!`, () => {});
  }

  if (mon.isBoss) {
    if (state.currentAct === 1) state.flags.act1BossDefeated = true;
    if (state.currentAct === 2) state.flags.act2BossDefeated = true;
    if (state.currentAct === 3) state.flags.act3BossDefeated = true;
    state.inBossRoom = false;
    showOverlay('Boss Defeated!', `Act ${state.currentAct} boss has fallen. The path forward opens.`, () => {
      if (state.currentAct < 3) {
        state.currentAct++;
        state.player.act = state.currentAct;
        rebuildWorld();
      } else {
        showOverlay('Victory!', 'You have completed all three Acts. Free roam unlocked.', () => {});
      }
    });
  }

  scene.remove(mon.mesh);
  monsters = monsters.filter(m => m !== mon);
  updateHUD();
  saveGame();
}

function onPlayerDeath() {
  state.isDead = true;
  state.player.gold = Math.floor(state.player.gold * 0.5);
  state.player.hp = state.player.maxHp;
  showOverlay('You Died', 'Half your gold was lost. Returning to town...', () => {
    state.isDead = false;
    playerGroup.position.set(0, 0, 4);
    if (state.inBossRoom) {
      state.inBossRoom = false;
      rebuildWorld();
    }
    updateHUD();
    saveGame();
  });
}

function usePotion() {
  if (state.player.potions <= 0 || state.player.hp >= state.player.maxHp) return;
  state.player.potions--;
  const heal = Math.floor(state.player.maxHp * 0.4);
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
    row.innerHTML = `<div><strong>Health Potion</strong><br><small>Restores 40% HP · 25g</small></div>`;
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

async function tryEnterPortal() {
  if (!playerGroup || state.inBossRoom) return;
  for (const p of portals) {
    if (p.userData.isPortal && playerGroup.position.distanceTo(p.position) < 5) {
      const req = ACT[state.currentAct].bossReq;
      if (state.player.level < req) {
        showOverlay('Too Weak', `You need level ${req} to challenge this boss. (Recommended ${ACT[state.currentAct].recommended})`, () => {});
        return;
      }
      // Enter boss room
      state.inBossRoom = true;
      monsters.forEach(m => scene.remove(m.mesh));
      monsters = [];
      playerGroup.position.set(0, 0, 8);

      const boss = await createMonster('boss', 0, -10, true);
      monsters.push(boss);
      showOverlay('Boss Room', `Defeat the Act ${state.currentAct} boss!`, () => {});
      return;
    }
  }
}

async function rebuildWorld() {
  loading.classList.remove('hidden');
  $('loading-text').textContent = `Entering ${ACT[state.currentAct].name}...`;
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
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(0, 0, s, s);

  const scale = 1.2;
  const cx = s / 2;
  const cy = s / 2;

  // monsters
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

  // portal
  ctx.fillStyle = '#8844ff';
  portals.forEach(p => {
    const dx = (p.position.x - playerGroup.position.x) * scale;
    const dz = (p.position.z - playerGroup.position.z) * scale;
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dz, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // player
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
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
  if (keys['KeyW']) move.add(forward);
  if (keys['KeyS']) move.sub(forward);
  if (keys['KeyA']) move.sub(right);
  if (keys['KeyD']) move.add(right);
  if (move.length() > 0) {
    move.normalize().multiplyScalar(speed * dt);
    playerGroup.position.add(move);
    // face movement
    const targetAngle = Math.atan2(move.x, move.z);
    playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, targetAngle + Math.PI, 0.15);
  }

  // Camera
  const offset = new THREE.Vector3(0, 7, 11);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  camera.position.lerp(playerGroup.position.clone().add(offset), 0.1);
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.4, playerGroup.position.z);

  // Monster AI
  monsters.forEach(mon => {
    if (mon.hp <= 0) return;
    mon.cooldown = Math.max(0, mon.cooldown - dt);
    mon.barBg.lookAt(camera.position);

    const dist = mon.mesh.position.distanceTo(playerGroup.position);
    const aggro = mon.isBoss ? 40 : 18;

    if (dist < aggro) {
      const dir = playerGroup.position.clone().sub(mon.mesh.position);
      dir.y = 0;
      dir.normalize();
      mon.mesh.position.addScaledVector(dir, mon.speed * dt);
      mon.mesh.lookAt(playerGroup.position.x, mon.mesh.position.y, playerGroup.position.z);

      const range = mon.isRanged ? 14 : 2.8;
      if (dist < range && mon.cooldown <= 0) {
        mon.cooldown = mon.isRanged ? 1.6 : 1.0;
        let dmg = mon.atk + Math.floor(Math.random() * 6);
        // Act 3 boss phases
        if (mon.isBoss && state.currentAct === 3) {
          const hpPct = mon.hp / mon.maxHp;
          if (hpPct < 0.33) mon.phase = 3;
          else if (hpPct < 0.66) mon.phase = 2;
          if (mon.phase === 2) dmg = Math.floor(dmg * 1.3);
          if (mon.phase === 3) dmg = Math.floor(dmg * 1.6);
        }
        state.player.hp -= dmg;
        showDamage(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), dmg);
        updateHUD();
        if (state.player.hp <= 0) {
          state.player.hp = 0;
          onPlayerDeath();
        }
      }
    }
  });

  // Context prompt
  let prompt = '';
  for (const npc of npcs) {
    if (playerGroup.position.distanceTo(npc.mesh.position) < 4) {
      prompt = `Press T — ${npc.role}`;
      break;
    }
  }
  if (!prompt) {
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

  await setupThree();
  await buildAct(state.currentAct);
  await spawnPlayer();
  updateHUD();
  hud.classList.remove('hidden');
  loading.classList.add('hidden');
  animate();
  saveGame();
}

init();
