import { describe, expect, it } from 'vitest';
import { GENERATORS } from '../src/generators';
import { defaults, randomize, sanitize } from '../src/generators/types';
import { analyze, type MeshData } from '../src/geometry/mesh';
import { toBinarySTL } from '../src/export/stl';

/** Cada arista dirigida aparece una sola vez y su opuesta también: malla cerrada y orientada. */
function checkWatertight(mesh: MeshData) {
  const edges = new Map<string, number>();
  const ix = mesh.indices;
  let degenerate = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const tri = [ix[t], ix[t + 1], ix[t + 2]];
    if (new Set(tri).size < 3) degenerate++;
    for (let e = 0; e < 3; e++) {
      const key = `${tri[e]}:${tri[(e + 1) % 3]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let bad = 0;
  for (const [key, n] of edges) {
    const [a, b] = key.split(':');
    if (n !== 1 || edges.get(`${b}:${a}`) !== 1) bad++;
  }
  return { bad, degenerate };
}

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe.each(GENERATORS)('$name', (g) => {
  const cases: [string, Record<string, unknown>][] = [
    ['por defecto', defaults(g)],
    ...g.presets.map((p): [string, Record<string, unknown>] => [p.name, { ...defaults(g), ...p.values }]),
  ];
  const r = rng(g.id.length * 7919);
  for (let i = 0; i < 4; i++) cases.push([`aleatorio ${i}`, randomize(g, { ...defaults(g), res: g.params.find((p) => p.key === 'res')?.default ?? '' }, r)]);
  for (const p of g.params) if (p.type === 'toggle') cases.push([`${p.key} activado`, { ...defaults(g), [p.key]: true }]);

  it.each(cases)('%s → sólido cerrado', (_name, values) => {
    const mesh = g.build(sanitize(g, values as never));
    const { bad, degenerate } = checkWatertight(mesh);
    expect(bad).toBe(0);
    expect(degenerate).toBe(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    const stats = analyze(mesh);
    expect(stats.volume).toBeGreaterThan(0); // normales hacia afuera
    expect(stats.size[2]).toBeGreaterThan(0);
  });
});

describe('STL', () => {
  it('escribe el tamaño correcto', () => {
    const mesh = GENERATORS[0].build(defaults(GENERATORS[0]));
    const buf = toBinarySTL(mesh);
    const count = mesh.indices.length / 3;
    expect(buf.byteLength).toBe(84 + 50 * count);
    expect(new DataView(buf).getUint32(80, true)).toBe(count);
  });
});
