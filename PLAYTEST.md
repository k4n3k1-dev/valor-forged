# Valor Forged — Final Playtest Checklist

Run `npm install`, then `npm run dev` and play normally.

## First Load / Story / Tutorial
- Confirm the first-load “Forging the realm...” splash appears before the main menu.
- Start New Adventure and read/skip the three-part opening story.
- Create a name/avatar and confirm the five-step tutorial appears.
- Use Back / Next and Skip Tutorial; both routes should enter Act I correctly.
- During gameplay press `Esc` or click `☰ Menu`; confirm Resume, Controls, Credits, objective, and Save & Return to Main Menu work.
- Defeat Act 1 and Act 2 bosses and confirm the story transition into the next Act appears.
- Defeat Act 3 and confirm the ending story appears before free roam.

## Start / Audio
- Start a new game and confirm music/ambience begins after entering the adventure.
- Toggle Music with `M` or the HUD button.
- Toggle SFX with `N` or the HUD button.
- If `public/audio/music/dark-aria.mp3` is absent, confirm the built-in dark cinematic fallback is audible.

## Core Combat
- Test WASD and Arrow movement.
- Attack normal enemies: swing sound, impact sound, hit flash, knockback and particles should appear.
- Let enemies hit you: hurt sound, damage number and light camera shake should occur.
- Test ranged enemies and tree/cover projectile blocking.
- Use a potion with `H`: 50% heal, green particles and potion sound.

## Progression / Economy
- Verify XP, level-ups and gold rewards.
- Buy a weapon and potion from town NPCs.
- Rest/save at the Inn, refresh the page, and Continue Save.
- Die once and confirm 10% gold loss and town respawn.

## Act 1
- Reach/use the boss portal.
- Confirm charge telegraph, straight-line charge, recovery and boss arena.

## Act 2
- Confirm homing fireballs.
- Hide behind arena trees and confirm projectiles can be blocked.

## Act 3
- Walk the citadel platforms/bridges.
- Step into the void and confirm fall/reset damage.
- Confirm boss phases: Charge -> Shoot -> Ground Slam.
- Check slam sound, particles and stronger camera shake.

## Endgame
- Defeat Act 3 boss.
- Confirm Victory and free roam.
- Confirm enemies continue respawning.
- Confirm level cannot exceed 299.

## Credits / Deployment
- Open Credits from the start screen.
- `npm test` should report 7 passing tests.
- `npm run build` should produce `dist/` for deployment once dependencies are installed.

## Character / world quality checks

During the next browser playthrough, specifically verify:

- The selected player loads as the rigged KayKit Knight/Rogue rather than the old black T-pose model.
- Idle and movement visibly animate the skeleton (hips, knees, legs and arms), and clicking an enemy triggers a melee attack clip.
- A sword is visibly attached to the player’s right hand during movement and combat.
- Act I/II guardian models animate rather than sliding as static meshes.
- Trees/foliage no longer create giant opaque black cards over the screen.
- The camera pulls forward instead of clipping through a tree or building.
- Houses/shops remain upright and large environment props no longer appear to be fallen buildings.
- Melee enemies cannot damage the player through a solid tree/building/ruin.
- When damage comes from off-screen, the red directional indicator points toward the attacker.
- Verdant Valley and Shadowgrove show their roads, town dressing, foliage clusters, rocks, water feature and distant terrain rather than only a flat ground plane.

## Safe town / forest overhaul checks

- Confirm `W` / Up moves the character forward into the scene and `S` / Down moves back toward the camera.
- Walk the entire fenced town and confirm the gate is the intended exit toward the forest.
- Pull a monster toward the settlement and confirm it **will not enter the safe zone or damage you inside it**.
- Confirm the green `SAFE ZONE` badge appears while inside town and disappears after leaving.
- Walk around the hub and confirm several civilian NPCs patrol the streets/plaza without showing a Talk prompt.
- Confirm the Innkeeper, Weaponsmith and Alchemist remain the only town NPCs that open gameplay menus.
- Check that the hub reads as a settlement: multiple buildings, market/plaza, benches, lamps, fencing/gate and civilians rather than isolated props.
- Leave town and confirm Verdant Valley / Shadowgrove transition into denser forest belts and combat clearings.
- Confirm normal enemies spawn outside the protected town / main road instead of beside shop NPCs.
- If the optional KayKit/Gobkit CDN assets fail to load, verify the bundled fallback buildings/trees still produce a playable world rather than invisible objects.
