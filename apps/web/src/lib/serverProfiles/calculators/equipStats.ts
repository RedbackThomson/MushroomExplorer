// Equip-stat-range calculator registry plus the built-in calculators.
//
// Calculators self-register on import. Profiles reference them by id, so a
// fork can add a native calculator without touching profile definitions or
// the rules-engine core.

import type { EquipStatCalculator, EquipStatKey, EquipStatRange } from '../types';

const REGISTRY = new Map<string, EquipStatCalculator>();

export function registerEquipStatCalculator(calc: EquipStatCalculator): void {
  REGISTRY.set(calc.id, calc);
}

export function getEquipStatCalculator(id: string | undefined | null): EquipStatCalculator | null {
  if (!id) return null;
  return REGISTRY.get(id) ?? null;
}

export function listEquipStatCalculatorIds(): string[] {
  return [...REGISTRY.keys()];
}

/**
 * Classic dropped-equip stat variance is roughly ±10% of the base value,
 * with a floor of 1 so small stats still wobble. This is an approximation:
 * the WZ data carries only the base value, and the exact roll tables are
 * server-side and unavailable to us.
 */
function vanillaVariance(base: number): number {
  return Math.max(1, Math.round(Math.abs(base) * 0.1));
}

/** A server "godly" roll can push a stat this far above its normal maximum. */
const GODLY_BONUS = 5;

registerEquipStatCalculator({
  id: 'vanilla-v83',
  range(_stat: EquipStatKey, base: number): EquipStatRange | null {
    if (base === 0) return null;
    const v = vanillaVariance(base);
    return { base, min: base - v, max: base + v };
  },
});

registerEquipStatCalculator({
  id: 'mapleroyals-v1',
  range(_stat: EquipStatKey, base: number): EquipStatRange | null {
    if (base === 0) return null;
    const v = vanillaVariance(base);
    return { base, min: base - v, max: base + v, godlyMax: base + v + GODLY_BONUS };
  },
});
