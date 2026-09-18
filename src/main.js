/**
 * Valor Forged — Core Game Entry
 * 3D Action RPG with Three.js
 * Implements: movement, click-attack, 3 Acts, XP/Gold scaling,
 * shops, Inn save (localStorage), death penalty, mini-map, bosses.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // fallback only

// ===================== GAME STATE =====================
const state = {
  player: {
    name: 'Adventurer',
    gender: 'male',
    level: 1,
    xp: 0,
    xpToNext: 100,
    gold: 50,
    hp: 100,
    maxHp: 100,
    attack: 12,
    potions: 3,
    position: new THREE.Vector3(0, 0, 0),
    act: 1,
    weapon: { name: 'Rusty Sword', atk: 12, req: 1 }
  },
  flags: {
    act1BossDefeated: false,
    act2BossDefeated: false,
    act3BossDefeated: false,
    freeRoam: false
  },
  currentAct: 1,
  inBossRoom: false,
  isDead: false,
  interacting: false
};

// ===================== DOM REFS =====================
const startScreen = document.getElementById('start-screen');
const creditsScreen = document.getElementById('credits-screen');
const hud = document.getElementById('hud');
const loading = document.getElementById('loading');
const modal = document.getElementById('modal');
const overlay = document.getElementById('overlay');
const contextPrompt = document.getElementById('context-prompt');

// ===================== THREE SETUP =====================
let scene, camera, renderer, clock;
let playerMesh, playerGroup;
let monsters = [];
let npcs = [];
let portals = [];
let environmentGroup;
let keys = {};
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let minimapCtx;
let attackCooldown = 0;
let lastSavePos = new THREE.Vector3(0, 0, 5);

const ACT_CONFIG = {
  1: {
    name: 'Verdant Valley',
    groundColor: 0x3d8b40,
    fogColor: 0xa8d5a2,
    fogNear: 40,
    fogFar: 120,
    monsterTypes: ['slime', 'wolf'],
    bossLevelReq: 40,
    recommended: 46
  },
  2: {
    name: 'Shadowgrove Forest',
    groundColor: 0x1a3a1a,
    fogColor: 0x0f1f0f,
    fogNear: 15,
    fogFar: 60,
    monsterTypes: ['spider', 'archer'],
    bossLevelReq: 120,
    recommended: 126
  },
  3: {
    name: 'Highland Citadel',
    groundColor: 0x4a4a4a,
    fogColor: 0x2a2a2a,
    fogNear: 20,
    fogFar: 80,
    monsterTypes: ['golem', 'titan'],
    bossLevelReq: 200,
    recommended: 206
  }
};

// ===================== INIT =====================
function init() {
  // Start screen handlers
  document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.player.gender = btn.dataset.gender;
    });
  });

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('credits-btn').addEventListener('click', () => {
    startScreen.classList.add('hidden');
    creditsScreen.classList.remove('hidden');
  });
  document.getElementById('close-credits').addEventListener('click', () => {
    creditsScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('overlay-btn').addEventListener('click', hideOverlay);

  // Keyboard
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyH') usePotion();
    if (e.code === 'KeyT') tryInteract();
    if (e.code === 'KeyE') tryEnterPortal();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('click', onClickAttack);
  window.addEventListener('resize', onResize);

  // Try load save
  const saved = localStorage.getItem('valorForgedSave');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      Object.assign(state.player, data.player);
      Object.assign(state.flags, data.flags || {});
      state.currentAct = data.currentAct || 1;
      // restore position later
    } catch (e) { console.warn('Corrupt save'); }
  }

  loading.classList.add('hidden');
}

function startGame() {
  const name = document.getElementById('username').value.trim() || 'Adventurer';
  state.player.name = name;
  startScreen.classList.add('hidden');
  loading.classList.remove('hidden');

  setTimeout(() => {
    setupThree();
    buildAct(state.currentAct);
    spawnPlayer();
    spawnTownNPCs();
    spawnMonstersForAct();
    spawnPortal();
    hud.classList.remove('hidden');
    loading.classList.add('hidden');
    updateHUD();
    animate();
  }, 400);
}

// ===================== THREE SCENE =====================
function setupThree() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 8, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'game-canvas';
  document.body.appendChild(renderer.domElement);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // Minimap
  const canvas = document.getElementById('minimap');
  minimapCtx = canvas.getContext('2d');
}

function buildAct(actNum) {
  // Clear previous
  if (environmentGroup) scene.remove(environmentGroup);
  environmentGroup = new THREE.Group();
  scene.add(environmentGroup);

  const cfg = ACT_CONFIG[actNum];
  scene.background = new THREE.Color(cfg.fogColor);
  scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200, 32, 32);
  const groundMat = new THREE.MeshStandardMaterial({
    color: cfg.groundColor,
    roughness: 0.9,
    metalness: 0.05
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  environmentGroup.add(ground);

  // Decorative elements based on act
  if (actNum === 1) {
    // Grasslands — simple trees & rocks
    for (let i = 0; i < 40; i++) {
      const tree = createSimpleTree();
      tree.position.set(
        (Math.random() - 0.5) * 160,
        0,
        (Math.random() - 0.5) * 160
      );
      if (tree.position.length() < 12) continue; // keep clear near spawn
      environmentGroup.add(tree);
    }
  } else if (actNum === 2) {
    // Dense forest
    for (let i = 0; i < 80; i++) {
      const tree = createSimpleTree(true);
      tree.position.set(
        (Math.random() - 0.5) * 140,
        0,
        (Math.random() - 0.5) * 140
      );
      if (tree.position.length() < 10) continue;
      environmentGroup.add(tree);
    }
  } else {
    // Citadel ruins — platforms & pillars
    for (let i = 0; i < 25; i++) {
      const pillar = createPillar();
      pillar.position.set(
        (Math.random() - 0.5) * 100,
        0,
        (Math.random() - 0.5) * 100
      );
      if (pillar.position.length() < 15) continue;
      environmentGroup.add(pillar);
    }
    // Narrow bridges feel (raised platforms)
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.6, 40),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    bridge.position.set(0, 0.3, -40);
    bridge.receiveShadow = true;
    bridge.castShadow = true;
    environmentGroup.add(bridge);
  }

  // Town area near origin
  createTown();
}

function createSimpleTree(dark = false) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 2.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
  );
  trunk.position.y = 1.25;
  trunk.castShadow = true;
  group.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 3.5, 7),
    new THREE.MeshStandardMaterial({ color: dark ? 0x1a4a1a : 0x2d6a2d })
  );
  foliage.position.y = 3.8;
  foliage.castShadow = true;
  group.add(foliage);
  return group;
}

function createPillar() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x666666 })
  );
  base.position.y = 0.2;
  group.add(base);
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.55, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  col.position.y = 2.4;
  col.castShadow = true;
  group.add(col);
  return group;
}

function createTown() {
  // Simple buildings
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 });

  // Inn
  const inn = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), buildingMat);
  inn.position.set(-12, 2, 8);
  inn.castShadow = true;
  inn.receiveShadow = true;
  environmentGroup.add(inn);
  const roof1 = new THREE.Mesh(new THREE.ConeGeometry(5, 2.5, 4), roofMat);
  roof1.position.set(-12, 5.2, 8);
  roof1.rotation.y = Math.PI / 4;
  environmentGroup.add(roof1);

  // Shop
  const shop = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 4), buildingMat);
  shop.position.set(12, 1.75, 6);
  shop.castShadow = true;
  environmentGroup.add(shop);
}

// ===================== PLAYER =====================
function spawnPlayer() {
  if (playerGroup) scene.remove(playerGroup);
  playerGroup = new THREE.Group();

  // Body (simple capsule-like for prototype — replace with GLTF later)
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({
      color: state.player.gender === 'male' ? 0x3b82f6 : 0xec4899
    })
  );
  body.position.y = 1.1;
  body.castShadow = true;
  playerGroup.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffdbac })
  );
  head.position.y = 2.1;
  head.castShadow = true;
  playerGroup.add(head);

  // Sword
  const sword = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.1, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })
  );
  sword.position.set(0.55, 1.3, 0);
  sword.rotation.z = -0.3;
  playerGroup.add(sword);

  playerGroup.position.copy(state.player.position.length() > 0.1 ? state.player.position : new THREE.Vector3(0, 0, 5));
  scene.add(playerGroup);
  playerMesh = playerGroup;
}

// ===================== MONSTERS =====================
function spawnMonstersForAct() {
  // Clear old
  monsters.forEach(m => scene.remove(m.mesh));
  monsters = [];

  const cfg = ACT_CONFIG[state.currentAct];
  const count = 8 + state.currentAct * 3;

  for (let i = 0; i < count; i++) {
    const type = cfg.monsterTypes[Math.floor(Math.random() * cfg.monsterTypes.length)];
    const level = Math.max(1, state.player.level + Math.floor((Math.random() - 0.3) * 8) + (state.currentAct - 1) * 30);
    const mon = createMonster(type, level);
    mon.mesh.position.set(
      (Math.random() - 0.5) * 80,
      0,
      (Math.random() - 0.5) * 80 - 20
    );
    if (mon.mesh.position.length() < 18) mon.mesh.position.z -= 25;
    scene.add(mon.mesh);
    monsters.push(mon);
  }
}

function createMonster(type, level) {
  const group = new THREE.Group();
  let color, scale, hpMult, atkMult, speed, isRanged = false;

  switch (type) {
    case 'slime':
      color = 0x22c55e; scale = 0.9; hpMult = 1; atkMult = 0.8; speed = 2.2;
      break;
    case 'wolf':
      color = 0x78716c; scale = 1.1; hpMult = 1.3; atkMult = 1.1; speed = 3.5;
      break;
    case 'spider':
      color = 0x4c1d95; scale = 0.85; hpMult = 1.1; atkMult = 1.0; speed = 2.8; isRanged = true;
      break;
    case 'archer':
      color = 0x1e3a5f; scale = 1.0; hpMult = 0.9; atkMult = 1.4; speed = 2.0; isRanged = true;
      break;
    case 'golem':
      color = 0x57534e; scale = 1.6; hpMult = 2.2; atkMult = 1.5; speed = 1.4;
      break;
    case 'titan':
      color = 0x44403c; scale = 2.0; hpMult = 3.0; atkMult = 2.0; speed = 1.1;
      break;
    default:
      color = 0x22c55e; scale = 1; hpMult = 1; atkMult = 1; speed = 2;
  }

  // Body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.7 * scale, 10, 10),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.7 * scale;
  body.castShadow = true;
  group.add(body);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 6, 6), eyeMat);
  eye1.position.set(-0.25 * scale, 0.9 * scale, 0.5 * scale);
  group.add(eye1);
  const eye2 = eye1.clone();
  eye2.position.x = 0.25 * scale;
  group.add(eye2);

  // HP bar (sprite-like)
  const hpBar = createHPBar();
  hpBar.position.y = 1.8 * scale;
  group.add(hpBar);

  const maxHp = Math.floor(40 * hpMult * (1 + level * 0.15));
  const atk = Math.floor(8 * atkMult * (1 + level * 0.12));

  return {
    mesh: group,
    type,
    level,
    hp: maxHp,
    maxHp,
    atk,
    speed,
    isRanged,
    state: 'idle', // idle | chase | attack | dead
    cooldown: 0,
    target: null,
    hpBar
  };
}

function createHPBar() {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
  );
  group.add(bg);
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
  );
  fill.position.z = 0.01;
  group.add(fill);
  group.userData.fill = fill;
  return group;
}

function updateHPBar(mon) {
  const ratio = Math.max(0, mon.hp / mon.maxHp);
  mon.hpBar.userData.fill.scale.x = ratio;
  mon.hpBar.userData.fill.position.x = -0.575 * (1 - ratio);
  mon.hpBar.userData.fill.material.color.setHex(ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xfacc15 : 0xef4444);
}

// ===================== BOSS =====================
function spawnBoss() {
  // Remove normal monsters
  monsters.forEach(m => scene.remove(m.mesh));
  monsters = [];

  const bossLevel = ACT_CONFIG[state.currentAct].bossLevelReq + 10;
  let boss;

  if (state.currentAct === 1) {
    // Charging boss
    boss = createMonster('wolf', bossLevel);
    boss.mesh.scale.setScalar(1.8);
    boss.hp = boss.maxHp = 800;
    boss.atk = 35;
    boss.speed = 5;
    boss.isBoss = true;
    boss.pattern = 'charge';
    boss.chargeTimer = 0;
  } else if (state.currentAct === 2) {
    boss = createMonster('spider', bossLevel);
    boss.mesh.scale.setScalar(2.2);
    boss.hp = boss.maxHp = 1800;
    boss.atk = 45;
    boss.speed = 2.5;
    boss.isBoss = true;
    boss.pattern = 'homing';
    boss.isRanged = true;
  } else {
    boss = createMonster('titan', bossLevel);
    boss.mesh.scale.setScalar(2.5);
    boss.hp = boss.maxHp = 4000;
    boss.atk = 70;
    boss.speed = 1.8;
    boss.isBoss = true;
    boss.pattern = 'phases';
    boss.phase = 1;
  }

  boss.mesh.position.set(0, 0, -35);
  scene.add(boss.mesh);
  monsters.push(boss);
  state.inBossRoom = true;
}

// ===================== NPCs & PORTALS =====================
function spawnTownNPCs() {
  npcs.forEach(n => scene.remove(n.mesh));
  npcs = [];

  // Innkeeper
  const innkeeper = createNPC(0xffd700, 'Innkeeper');
  innkeeper.mesh.position.set(-12, 0, 5);
  scene.add(innkeeper.mesh);
  npcs.push(innkeeper);

  // Weaponsmith
  const smith = createNPC(0xc0c0c0, 'Weaponsmith');
  smith.mesh.position.set(10, 0, 4);
  scene.add(smith.mesh);
  npcs.push(smith);

  // Alchemist
  const alch = createNPC(0x22c55e, 'Alchemist');
  alch.mesh.position.set(14, 0, 4);
  scene.add(alch.mesh);
  npcs.push(alch);
}

function createNPC(color, role) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffdbac })
  );
  head.position.y = 1.85;
  group.add(head);
  return { mesh: group, role };
}

function spawnPortal() {
  portals.forEach(p => scene.remove(p));
  portals = [];

  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.35, 12, 32),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.4
    })
  );
  portal.position.set(0, 2.5, -55);
  portal.rotation.x = Math.PI / 2;
  portal.userData.isPortal = true;
  portal.userData.act = state.currentAct;
  scene.add(portal);
  portals.push(portal);

  // Sign
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 1.2, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
  );
  sign.position.set(3.5, 1.2, -55);
  scene.add(sign);
  portals.push(sign);
}

// ===================== COMBAT =====================
function onClickAttack(event) {
  if (state.isDead || state.interacting || attackCooldown > 0) return;
  if (startScreen.classList.contains('hidden') === false) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const targets = monsters.filter(m => m.hp > 0).map(m => m.mesh);
  const hits = raycaster.intersectObjects(targets, true);

  if (hits.length > 0) {
    // Find the monster
    let mon = null;
    for (const m of monsters) {
      if (m.mesh === hits[0].object || m.mesh.children.includes(hits[0].object)) {
        mon = m;
        break;
      }
    }
    if (!mon || mon.hp <= 0) return;

    // Distance check
    const dist = playerGroup.position.distanceTo(mon.mesh.position);
    if (dist > 6) return; // melee range for prototype

    // Deal damage
    const dmg = state.player.attack + Math.floor(Math.random() * 8);
    mon.hp -= dmg;
    updateHPBar(mon);
    showDamageNumber(mon.mesh.position, dmg);
    attackCooldown = 0.35;

    // Flash
    mon.mesh.children[0].material.emissive = new THREE.Color(0xffffff);
    mon.mesh.children[0].material.emissiveIntensity = 0.6;
    setTimeout(() => {
      if (mon.mesh.children[0]) {
        mon.mesh.children[0].material.emissiveIntensity = 0;
      }
    }, 80);

    // Knockback
    const dir = mon.mesh.position.clone().sub(playerGroup.position).normalize();
    mon.mesh.position.add(dir.multiplyScalar(0.6));

    if (mon.hp <= 0) {
      onMonsterDeath(mon);
    }
  }
}

function onMonsterDeath(mon) {
  mon.hp = 0;
  mon.state = 'dead';

  // XP formula from concept: Base_XP × (Monster_Level / Player_Level)
  const baseXP = 25 + mon.level * 3;
  const xpGain = Math.max(1, Math.floor(baseXP * (mon.level / Math.max(1, state.player.level))));
  // Gold: Base_Gold + (Monster_Level × 5)
  const goldGain = 8 + mon.level * 5;

  state.player.xp += xpGain;
  state.player.gold += goldGain;

  // Level up
  while (state.player.xp >= state.player.xpToNext && state.player.level < 299) {
    state.player.xp -= state.player.xpToNext;
    state.player.level++;
    state.player.maxHp += 12;
    state.player.hp = state.player.maxHp;
    state.player.attack += 3;
    state.player.xpToNext = Math.floor(100 * Math.pow(1.12, state.player.level - 1));
  }

  // Floating feedback
  showDamageNumber(mon.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), `+${xpGain} XP`, false);
  updateHUD();

  // Remove after short delay
  setTimeout(() => {
    scene.remove(mon.mesh);
    monsters = monsters.filter(m => m !== mon);
  }, 400);

  // Boss defeat
  if (mon.isBoss) {
    if (state.currentAct === 1) state.flags.act1BossDefeated = true;
    if (state.currentAct === 2) state.flags.act2BossDefeated = true;
    if (state.currentAct === 3) {
      state.flags.act3BossDefeated = true;
      state.flags.freeRoam = true;
      showOverlay('Victory!', 'You have conquered all three Acts!\nFree-roam unlocked. Level cap 299. Keep forging your legend.');
    } else {
      // Advance act
      state.currentAct++;
      state.inBossRoom = false;
      showOverlay(`Act ${state.currentAct - 1} Complete!`, `You may now enter Act ${state.currentAct}.\nLevel requirement rises. Prepare yourself.`);
      setTimeout(() => {
        buildAct(state.currentAct);
        spawnTownNPCs();
        spawnMonstersForAct();
        spawnPortal();
        playerGroup.position.set(0, 0, 5);
      }, 1500);
    }
  }
}

function showDamageNumber(worldPos, value, isDmg = true) {
  const vec = worldPos.clone().project(camera);
  const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;

  const el = document.createElement('div');
  el.className = 'dmg-num' + (isDmg && value > 30 ? ' crit' : '');
  el.textContent = isDmg ? value : value;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.getElementById('damage-numbers').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ===================== INTERACTION =====================
function tryInteract() {
  if (state.isDead) return;
  for (const npc of npcs) {
    const dist = playerGroup.position.distanceTo(npc.mesh.position);
    if (dist < 3.5) {
      openNPCMenu(npc);
      return;
    }
  }
}

function tryEnterPortal() {
  if (state.isDead || state.inBossRoom) return;
  for (const p of portals) {
    if (!p.userData.isPortal) continue;
    const dist = playerGroup.position.distanceTo(p.position);
    if (dist < 4) {
      const req = ACT_CONFIG[state.currentAct].bossLevelReq;
      if (state.player.level < req) {
        showOverlay('Too Weak', `You need Level ${req} to challenge this boss.\n(Recommended ${ACT_CONFIG[state.currentAct].recommended}+)`);
        return;
      }
      // Enter boss room
      playerGroup.position.set(0, 0, -20);
      spawnBoss();
      contextPrompt.classList.add('hidden');
      return;
    }
  }
}

function openNPCMenu(npc) {
  state.interacting = true;
  modal.classList.remove('hidden');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  if (npc.role === 'Innkeeper') {
    title.textContent = 'Innkeeper';
    body.innerHTML = `
      <p style="margin-bottom:1rem;color:#94a3b8;">Rest and record your progress.</p>
      <button class="primary-btn" id="save-btn" style="width:auto;padding:0.6rem 1.4rem;">Save Game</button>
    `;
    document.getElementById('save-btn').onclick = () => {
      saveGame();
      closeModal();
      showOverlay('Saved', 'Your progress has been recorded.\nYou will respawn here if you fall.');
    };
  } else if (npc.role === 'Weaponsmith') {
    title.textContent = 'Weaponsmith';
    const weapons = [
      { name: 'Iron Sword', atk: 22, cost: 120, req: 10 },
      { name: 'Steel Blade', atk: 38, cost: 350, req: 30 },
      { name: 'Knight\'s Edge', atk: 55, cost: 900, req: 60 },
      { name: 'Dragonfang', atk: 85, cost: 2200, req: 110 },
      { name: 'Titan Slayer', atk: 130, cost: 6000, req: 180 }
    ];
    weapons.forEach(w => {
      const canBuy = state.player.level >= w.req && state.player.gold >= w.cost;
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `
        <div>
          <strong>${w.name}</strong><br>
          <span style="font-size:0.8rem;color:#94a3b8;">ATK ${w.atk} · Req Lv ${w.req}</span>
        </div>
        <button ${canBuy ? '' : 'disabled'}>${w.cost} 🪙</button>
      `;
      if (canBuy) {
        div.querySelector('button').onclick = () => {
          state.player.gold -= w.cost;
          state.player.weapon = w;
          state.player.attack = w.atk;
          updateHUD();
          closeModal();
        };
      }
      body.appendChild(div);
    });
  } else if (npc.role === 'Alchemist') {
    title.textContent = 'Alchemist';
    const cost = 40;
    const canBuy = state.player.gold >= cost && state.player.potions < 10;
    body.innerHTML = `
      <div class="shop-item">
        <div>
          <strong>Health Potion</strong><br>
          <span style="font-size:0.8rem;color:#94a3b8;">Restores 50% HP · Max 10</span>
        </div>
        <button id="buy-potion" ${canBuy ? '' : 'disabled'}>${cost} 🪙</button>
      </div>
    `;
    if (canBuy) {
      document.getElementById('buy-potion').onclick = () => {
        state.player.gold -= cost;
        state.player.potions++;
        updateHUD();
        closeModal();
      };
    }
  }
}

function closeModal() {
  modal.classList.add('hidden');
  state.interacting = false;
}

function usePotion() {
  if (state.player.potions <= 0 || state.player.hp >= state.player.maxHp) return;
  state.player.potions--;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + Math.floor(state.player.maxHp * 0.5));
  updateHUD();
}

// ===================== SAVE / DEATH =====================
function saveGame() {
  lastSavePos.copy(playerGroup.position);
  const data = {
    player: { ...state.player, position: { x: playerGroup.position.x, y: 0, z: playerGroup.position.z } },
    flags: state.flags,
    currentAct: state.currentAct
  };
  // Strip non-serializable
  delete data.player.position; // already stored above
  data.player.pos = { x: playerGroup.position.x, z: playerGroup.position.z };
  localStorage.setItem('valorForgedSave', JSON.stringify(data));
}

function onPlayerDeath() {
  state.isDead = true;
  const lost = Math.floor(state.player.gold * 0.1);
  state.player.gold = Math.max(0, state.player.gold - lost);
  state.player.hp = state.player.maxHp;

  showOverlay('You Have Fallen', `Lost ${lost} gold (10%).\nRespawning at the last Inn...`);
  setTimeout(() => {
    playerGroup.position.copy(lastSavePos);
    state.isDead = false;
    state.inBossRoom = false;
    // Respawn normal monsters if was in boss
    if (monsters.some(m => m.isBoss)) {
      buildAct(state.currentAct);
      spawnTownNPCs();
      spawnMonstersForAct();
      spawnPortal();
    }
    hideOverlay();
    updateHUD();
  }, 2200);
}

function showOverlay(title, msg) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ===================== HUD & MINIMAP =====================
function updateHUD() {
  const p = state.player;
  document.getElementById('hp-bar').style.width = `${(p.hp / p.maxHp) * 100}%`;
  document.getElementById('hp-text').textContent = `${p.hp}/${p.maxHp}`;
  document.getElementById('xp-bar').style.width = `${(p.xp / p.xpToNext) * 100}%`;
  document.getElementById('xp-text').textContent = `${p.xp}/${p.xpToNext}`;
  document.getElementById('level-text').textContent = p.level;
  document.getElementById('gold-text').textContent = p.gold;
  document.getElementById('potion-text').textContent = p.potions;
}

function drawMinimap() {
  if (!minimapCtx || !playerGroup) return;
  const ctx = minimapCtx;
  const w = 160, h = 160;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Ground tint
  ctx.fillStyle = state.currentAct === 1 ? '#1a3a1a' : state.currentAct === 2 ? '#0a1f0a' : '#2a2a2a';
  ctx.fillRect(0, 0, w, h);

  // Scale: world ~200 units → map 160px
  const scale = 160 / 180;
  const cx = w / 2, cy = h / 2;

  // Town marker
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(cx, cy + 5 * scale, 4, 0, Math.PI * 2);
  ctx.fill();

  // Portal
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(cx, cy - 55 * scale, 5, 0, Math.PI * 2);
  ctx.fill();

  // Monsters
  ctx.fillStyle = '#ef4444';
  monsters.forEach(m => {
    if (m.hp <= 0) return;
    const mx = cx + m.mesh.position.x * scale;
    const my = cy - m.mesh.position.z * scale;
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player
  const px = cx + playerGroup.position.x * scale;
  const py = cy - playerGroup.position.z * scale;
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();

  // Facing arrow
  const angle = playerGroup.rotation.y;
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.sin(angle) * 10, py - Math.cos(angle) * 10);
  ctx.stroke();
}

// ===================== UPDATE LOOP =====================
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (attackCooldown > 0) attackCooldown -= dt;

  if (!playerGroup || state.isDead || state.interacting) {
    renderer.render(scene, camera);
    return;
  }

  // Movement
  const speed = 8;
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  let moved = false;
  if (keys['KeyW'] || keys['ArrowUp']) { playerGroup.position.addScaledVector(forward, speed * dt); moved = true; }
  if (keys['KeyS'] || keys['ArrowDown']) { playerGroup.position.addScaledVector(forward, -speed * dt); moved = true; }
  if (keys['KeyA'] || keys['ArrowLeft']) { playerGroup.position.addScaledVector(right, -speed * dt); moved = true; }
  if (keys['KeyD'] || keys['ArrowRight']) { playerGroup.position.addScaledVector(right, speed * dt); moved = true; }

  // Face movement
  if (moved) {
    const dir = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp']) dir.add(forward);
    if (keys['KeyS'] || keys['ArrowDown']) dir.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft']) dir.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) dir.add(right);
    if (dir.lengthSq() > 0.01) {
      const targetAngle = Math.atan2(dir.x, dir.z);
      playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, targetAngle, 0.15);
    }
  }

  // Camera follow (third person)
  const camOffset = new THREE.Vector3(0, 7, 11);
  camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
  const desired = playerGroup.position.clone().add(camOffset);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.5, playerGroup.position.z);

  // Monster AI
  monsters.forEach(mon => {
    if (mon.hp <= 0) return;
    mon.cooldown = Math.max(0, mon.cooldown - dt);

    // Always face HP bar to camera
    mon.hpBar.lookAt(camera.position);

    const dist = mon.mesh.position.distanceTo(playerGroup.position);

    if (dist < 18) {
      // Chase
      const dir = playerGroup.position.clone().sub(mon.mesh.position);
      dir.y = 0;
      dir.normalize();
      mon.mesh.position.addScaledVector(dir, mon.speed * dt);
      mon.mesh.lookAt(playerGroup.position.x, mon.mesh.position.y, playerGroup.position.z);

      // Attack if close
      if (dist < (mon.isRanged ? 12 : 2.8) && mon.cooldown <= 0) {
        mon.cooldown = mon.isRanged ? 1.8 : 1.1;
        // Deal damage to player
        const dmg = mon.atk + Math.floor(Math.random() * 6);
        state.player.hp -= dmg;
        showDamageNumber(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), dmg);
        updateHUD();
        if (state.player.hp <= 0) {
          state.player.hp = 0;
          onPlayerDeath();
        }
      }
    }
  });

  // Context prompts
  let prompt = '';
  for (const npc of npcs) {
    if (playerGroup.position.distanceTo(npc.mesh.position) < 3.5) {
      prompt = `Press T to talk to ${npc.role}`;
      break;
    }
  }
  if (!prompt) {
    for (const p of portals) {
      if (p.userData.isPortal && playerGroup.position.distanceTo(p.position) < 4) {
        prompt = 'Press E to enter Boss Room';
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

  // Portal rotation
  portals.forEach(p => {
    if (p.userData.isPortal) p.rotation.z += dt * 1.5;
  });

  drawMinimap();
  renderer.render(scene, camera);
}

function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===================== BOOT =====================
init();
