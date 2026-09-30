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
| 3 Acts with themed environments and enemies | ✅ |
| Sealed boss arenas with level requirements (40 / 120 / 200) | ✅ |
| Rebalanced XP / level progression | ✅ |
| Level-scaled gold rewards + Weapon & Potion shops | ✅ |
| Health potions restore 50% HP (max 10) | ✅ |
| Simple localStorage save / load, including position | ✅ |
| Death penalty: lose 10% gold and return to town | ✅ |
| Mini-map with enemies, NPC/town markers, portal and facing arrow | ✅ |
| Start screen (username + gender) | ✅ |
| Post-game free roam with recurring enemies | ✅ |
| Hard level cap: 299 | ✅ |
| Credits screen with currently identifiable bundled assets | ✅ / attribution details pending |
| Full unique boss attack patterns from the concept | 🚧 Further polish |
| Music / sound effects | 🚧 Not added yet |

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

---

## 🕹️ Controls

| Key / Action | Effect |
|--------------|--------|
| **W A S D** or Arrow Keys | Move |
| **Left Click** on monster | Attack (melee range) |
| **H** | Use Health Potion (50% HP, max 10) |
| **T** | Talk to NPC (Innkeeper / Weaponsmith / Alchemist) |
| **E** | Enter glowing portal (Boss Room) |

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

All third-party libraries, 3D models, textures and audio will be:

1. Selected by the developer
2. Fully credited inside the in-game **Credits** screen (with URLs + licenses)

The current build already contains bundled GLB models for the player, monsters, bosses, NPCs, buildings and environment. Exact creator/source/license metadata still needs to be completed per asset before final submission.

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
5. Act 1 Boss charge mechanic
6. Act 2 forest + cover
7. Act 3 bridges + 3-phase boss
8. Polish, potions, death, Credits, balance

---

## 📌 Notes for the LAMP / Department Server

The entire game is **client-side only**.  
After building (`npm run build`) simply upload the contents of the `dist/` folder to any static web root. No Node.js, no database, no server-side code required.

---

## License

MIT — feel free to fork, extend and credit the original concept.

**Valor Forged** — Concept fully fleshed out. Ready for continued development.
