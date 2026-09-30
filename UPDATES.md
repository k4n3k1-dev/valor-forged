# Valor Forged — Full Gameplay / Acts Update

This build finishes the remaining non-audio gameplay work from the current concept while keeping the existing project structure.

## Implemented in this build

- Act 1 boss now uses a telegraphed straight-line **charge** with recovery windows.
- Act 2 boss now fires **homing fireballs**.
- Act 2 boss arena now contains physical **tree cover**; trees block player movement, line of sight and projectiles.
- Normal Act 2 ranged enemies respect cover and fire visible projectiles.
- Act 3 is now a proper **Highland Citadel** layout with stone platforms, ruined walls, towers, narrow bridges and a void below.
- Walking off Act 3 platforms/bridges triggers a **falling / void penalty** and returns the player to safety.
- Act 3 boss now has three real phases: **Charge → Projectile Barrage → Ground Slam**.
- World collision added for trees, rocks, buildings, ruins and boss-room cover.
- Portal-area **hint signs** added for all three Acts.
- Existing model animation clips are now used where available; player and non-animated enemies/bosses receive procedural movement/attack feedback.
- Animated monster variants are used for Slime, Wolf, Spider, Archer and Golem where bundled assets support them.
- Mini-map now also sketches the Act 3 citadel platforms / bridges.
- Added a reusable gameplay-logic module and a real Node test suite covering XP, rewards, death penalty, potions, level cap and boss gates.
- `npm test` now runs the automated test suite instead of a placeholder command.
- Added `CREDITS.md` with author, license and source URLs extracted directly from embedded GLB metadata where available.
- In-game Credits expanded with verified authors/licenses for the assets currently used by the game.
- Main module path is relative for safer deployment under GitHub Pages subpaths.

## Previous gameplay updates retained

- WASD and Arrow-key movement.
- Hit flash and knockback.
- Ranged enemy projectiles.
- Rebalanced XP / levelling and level-relative XP rewards.
- Enemy respawning.
- Level-scaled gold rewards.
- Potions restore 50% HP.
- Simple localStorage save/load with position, Act, boss flags and free-roam state.
- Death penalty of 10% gold.
- Sealed boss rooms.
- Improved minimap.
- Functional free roam after Act 3.
- Hard level cap of 299.

## Intentionally left for later

- Music.
- Sound effects / ambience / voice / other audio polish.
- Manual attribution for environment models whose GLB files do not contain embedded source/author/license metadata.
