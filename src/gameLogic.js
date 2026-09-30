export const MAX_LEVEL = 299;
export const POTION_HEAL_FRACTION = 0.5;
export const DEATH_GOLD_LOSS_FRACTION = 0.10;

export function xpForLevel(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  if (lv >= MAX_LEVEL) return 0;
  const n = lv - 1;
  return Math.floor(100 + n * 22 + Math.pow(n, 1.12) * 4);
}

export function calculateRewards(monsterLevel, playerLevel, isBoss = false) {
  const ml = Math.max(1, Number(monsterLevel) || 1);
  const pl = Math.max(1, Number(playerLevel) || 1);
  const ratio = Math.min(1.6, Math.max(0.25, ml / pl));
  const baseXp = isBoss ? 600 + ml * 35 : 45 + ml * 14;
  return {
    xp: Math.max(1, Math.round(baseXp * ratio)),
    gold: Math.round(isBoss ? 100 + ml * 10 : 5 + ml * 5)
  };
}

export function applyDeathPenalty(gold) {
  const current = Math.max(0, Math.floor(Number(gold) || 0));
  const lost = Math.floor(current * DEATH_GOLD_LOSS_FRACTION);
  return { lost, remaining: current - lost };
}

export function potionHealAmount(maxHp) {
  return Math.floor(Math.max(1, Number(maxHp) || 1) * POTION_HEAL_FRACTION);
}

export function clampLevel(level) {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(level) || 1)));
}

export function canEnterBoss(level, requirement) {
  return clampLevel(level) >= Math.max(1, Number(requirement) || 1);
}
