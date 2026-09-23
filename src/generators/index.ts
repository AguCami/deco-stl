import { bowl, candleHolder, lampshade, planter, vase } from './vessels';
import { coaster, wallPanel } from './slabs';
import type { Generator } from './types';

export const GENERATORS: Generator[] = [vase, planter, candleHolder, bowl, lampshade, coaster, wallPanel];

export function findGenerator(id: string | undefined): Generator | undefined {
  return GENERATORS.find((g) => g.id === id);
}
