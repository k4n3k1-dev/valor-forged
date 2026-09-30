# Valor Forged — Gameplay Update

This build updates the existing project without replacing its overall structure.

## Implemented

- WASD **and Arrow-key** movement.
- White **hit flash** on damaged monsters.
- **Knockback** for player melee attacks; enemies can also push the player slightly on contact.
- Real **ranged projectiles** for archers and the Act 2 ranged boss.
- Rebalanced **XP / levelling** with level-relative XP rewards and reachable 40 / 120 / 200 gates.
- Normal monsters **respawn** after a short delay so progression and free roam do not run out of enemies.
- Level-scaled **gold** rewards using `base + monsterLevel * 5` for regular enemies.
- Potions now restore **50% HP**.
- Simple `localStorage` **save/load**, including player position, Act, boss flags and free-roam state. Older saves are migrated when possible.
- Death penalty corrected to **10% of current gold**.
- Proper sealed **boss arenas** with themed floors, boundary pillars and arena minimap presentation.
- Improved **minimap**: player facing arrow, enemy/boss dots, NPC/town markers, portal marker and boss-arena ring.
- Act 3 victory now enters functioning **free roam** with respawning enemies.
- Hard **level cap 299** with `MAX` shown on the XP bar.
- Credits screen expanded with the assets/libraries currently identifiable from this repository; exact per-asset URLs/licenses still need to be completed by the developer.
- Bundled model paths made relative so they work more reliably under GitHub Pages subpaths.

## Still intentionally left for later

- Full per-asset credit URLs and license details.
- Music and sound effects.
- The more elaborate unique boss attack patterns from the original concept (charge / homing-cover / full charge-shoot-slam state machine).
- Additional animation/polish.
