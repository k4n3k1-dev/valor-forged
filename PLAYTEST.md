# Valor Forged — Final Playtest Checklist

Run `npm install`, then `npm run dev` and play normally.

## Start / Audio
- Start a new game and confirm music/ambience begins after clicking Begin Adventure.
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
