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

## Remaining manual attribution note

- Some environment models still lack embedded source/author/license metadata, so their attribution cannot be reconstructed safely from the bundled files alone.

## Final audio & polish pass

- Added `src/audio.js` Web Audio director.
- Added music/SFX toggles and M/N shortcuts.
- Added procedural sword, impact, enemy, player, projectile, potion, coin, portal, boss, charge, slam, level-up, victory, footstep and UI sounds.
- Added Act-specific procedural ambience and boss-mode ambience.
- Added optional `public/audio/music/dark-aria.mp3` music slot with automatic original fallback music when absent.
- Added hit/death/potion/portal/slam particle bursts and heavy-hit camera shake.
- Changed the stylesheet URL to a relative path for safer subdirectory/GitHub Pages hosting.

## Story, Tutorial & Menu Pass
- Added a first-load Valor Forged boot/loading splash.
- Added a main menu with New Adventure, Continue, Controls and Credits.
- Added a three-part opening story explaining the Fracture, the three guardians and the player's purpose.
- Added character creation after the prologue.
- Added a five-step skippable tutorial covering movement, combat, potions, progression, NPCs, portals, boss requirements and the overall goal.
- Added Act I→II and Act II→III story transitions.
- Added a three-part ending/epilogue before free roam.
- Added an always-available in-game menu on Esc / HUD Menu with current objective, Controls, Credits, Resume and Save & Return to Main Menu.
- Added a persistent HUD objective line.
