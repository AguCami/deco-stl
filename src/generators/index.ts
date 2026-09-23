import { bowl, candleHolder, lampshade, pencilCup, planter, vase } from './vessels';
import { letters, photoFrame, wallHook } from './objects';
import { coaster, wallPanel } from './slabs';
import type { Generator } from './types';

export const GENERATORS: Generator[] = [
  vase,
  planter,
  candleHolder,
  bowl,
  lampshade,
  pencilCup,
  coaster,
  wallPanel,
  photoFrame,
  wallHook,
  letters,
];

export function findGenerator(id: string | undefined): Generator | undefined {
  return GENERATORS.find((g) => g.id === id);
}
