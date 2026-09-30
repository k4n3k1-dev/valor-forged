# ⚔️ Valor Forged

**A single-player 3D Action RPG** that runs entirely in the browser.  
Built with **Three.js**. Three distinct Acts · deep progression · free-roam endgame.

> *"Three levels, three distinct experiences, one legend."*

---

## 🎮 Features (as implemented)

| Feature | Status |
|---------|--------|
| WASD / Arrow movement + third-person camera | ✅ |
| Click-to-attack (Raycaster) | ✅ |
| Hit flash + knockback combat feedback | ✅ |
| Floating damage / XP / gold numbers + HP bars | ✅ |
| Melee chase AI + projectile-based ranged enemies | ✅ |
| Enemy respawning for continued progression | ✅ |
| 3 Acts with distinct environments and gameplay | ✅ |
| Sealed boss arenas with level requirements (40 / 120 / 200) | ✅ |
| Act 1 telegraphed straight-line charge boss | ✅ |
| Act 2 homing-fireball boss + tree cover / line-of-sight | ✅ |
| Act 3 Charge → Shoot → Ground Slam boss phases | ✅ |
| Act 3 citadel, bridges, void and falling mechanic | ✅ |
| Environment collision (trees / rocks / buildings / ruins) | ✅ |
| Portal hint signs | ✅ |
| Model/procedural character and enemy animation handling | ✅ |
| Rebalanced XP / level progression | ✅ |
| Level-scaled gold rewards + Weapon & Potion shops | ✅ |
| Health potions restore 50% HP (max 10) | ✅ |
| Simple localStorage save / load, including position | ✅ |
| Death penalty: lose 10% gold and return to town | ✅ |
| Mini-map with enemies, NPC/town markers, portal and facing arrow | ✅ |
| First-load splash + main menu + character creation | ✅ |
| Opening story + Act transitions + ending story | ✅ |
| Skippable five-step tutorial | ✅ |
| In-game Esc/Menu controls + objective reference | ✅ |
| Post-game free roam with recurring enemies | ✅ |
| Hard level cap: 299 | ✅ |
| Credits screen + CREDITS.md with verified embedded asset metadata | ✅ / some environment attribution still pending |
| Automated gameplay-logic tests | ✅ |
| Music system + fallback dark cinematic bed | ✅ |
| Procedural combat / UI / environment SFX | ✅ |
| Act-specific ambience + boss audio mode | ✅ |

---

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Development server
npm run dev

# 3. Production build
npm run build
```

Open the URL shown by Vite (usually `http://localhost:5173`).

### Audio note

The game works immediately with built-in procedural music/ambience/SFX. If you have legal permission to use the requested commercial track, place it at:

```text
public/audio/music/dark-aria.mp3
```

The game detects it automatically; otherwise it falls back to the built-in original dark cinematic music bed.

---

## 🕹️ Controls

| Key / Action | Effect |
|--------------|--------|
| **W A S D** or Arrow Keys | Move |
| **Left Click** on monster | Attack (melee range) |
| **H** | Use Health Potion (50% HP, max 10) |
| **T** | Talk to NPC (Innkeeper / Weaponsmith / Alchemist) |
| **E** | Enter glowing portal (Boss Room) |
| **M** | Toggle music |
| **N** | Toggle sound effects |
| **Esc** | Open / close the in-game menu |

---

## 🏰 The Three Acts

| Act | Environment | Core Skill Tested | Boss Pattern | Level Req |
|-----|-------------|-------------------|--------------|-----------|
| 1 — Verdant Valley | Open grasslands | Positioning & click-trading | Straight-line charge | 40 |
| 2 — Shadowgrove Forest | Dense foggy forest | Precision & cover | Homing projectiles | 120 |
| 3 — Highland Citadel | Ruined fortress / bridges | Resource management | 3-phase (Charge → Shoot → Slam) | 200 |

After defeating the Act 3 boss you enter **free-roam** mode. Normal enemies continue respawning so progression can continue to the hard level cap of **299**.

---

## 📦 External Assets & Credits

All third-party libraries and 3D models are credited where source metadata is available. Audio is handled as follows:

1. Combat, UI and ambience SFX are original procedural Web Audio synthesis included in the code.
2. The project looks for an optional licensed background file at `public/audio/music/dark-aria.mp3`. The commercial track itself is **not bundled**.
3. If that file is absent, the game automatically uses an original dark-cinematic procedural music bed.

The build includes `CREDITS.md`, generated from author/source/license metadata embedded in the bundled GLB files. Some environment assets do not contain embedded attribution metadata, so those source details still need to be added manually before final submission.

**Libraries in use**
- Three.js (MIT)
- Vite (MIT)

---

## 🔄 GitHub Actions

Pushing to `main` automatically:

1. Installs dependencies
2. Runs tests
3. Builds the production bundle
4. Deploys to **GitHub Pages**

Live URL will be:  
`https://<your-username>.github.io/valor-forged/`

---

## 🛠️ Recommended Development Order (from concept)

1. WASD + camera (done)
2. Click-attack + one slime (done)
3. Inn save + Shop UI (done)
4. Mini-map (done)
5. Act 1 Boss charge mechanic (done)
6. Act 2 forest + cover (done)
7. Act 3 bridges + 3-phase boss (done)
8. Gameplay polish, collision, tests and Credits (done)
9. Audio polish — music system, ambience and SFX (done)
10. Story, tutorial, objective guidance and in-game menu (done)

---

## 📌 Notes for the LAMP / Department Server

The entire game is **client-side only**.  
After building (`npm run build`) simply upload the contents of the `dist/` folder to any static web root. No Node.js, no database, no server-side code required.

---

## License

MIT — feel free to fork, extend and credit the original concept.

**Valor Forged** — Core gameplay, all three Acts, story flow, skippable tutorial, in-game controls menu, audio systems, visual feedback, tests and deployment workflow are implemented. Final user playtesting is the remaining step.


## Current character quality

The current build uses fully rigged KayKit Knight/Rogue player characters with skeletal movement and attack animation, visible held weapons, animated guardian models, camera collision, improved foliage rendering, and directional damage feedback. The original static male/female files remain in the repository only as historical bundled assets; they are no longer the normal player visuals.
