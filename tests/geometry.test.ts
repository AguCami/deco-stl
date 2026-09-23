import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { GENERATORS } from '../src/generators';
import { defaults, randomize, sanitize, type Values } from '../src/generators/types';
import { analyze, type MeshData } from '../src/geometry/mesh';
import { toBinarySTL } from '../src/export/stl';
import { setFontReader } from '../src/text/fonts';

beforeAll(() => {
  // En Node no hay fetch de assets de Vite: leemos las fuentes del disco.
  setFontReader(async (f) => {
    const buf = readFileSync(fileURLToPath(new URL(`../src/assets/fonts/${f.file}`, import.meta.url)));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  });
});

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
  const base = defaults(g);
  const cases: [string, Values][] = [
    ['por defecto', base],
    ...g.presets.map((p): [string, Values] => [p.name, { ...base, ...p.values }]),
  ];
  const r = rng(g.id.length * 7919);
  for (let i = 0; i < 4; i++) cases.push([`aleatorio ${i}`, randomize(g, base, r)]);
  for (const p of g.params) if (p.type === 'toggle') cases.push([`${p.key} = ${!p.default}`, { ...base, [p.key]: !p.default }]);
  if (g.params.some((p) => p.key === 'text')) {
    cases.push(['texto en relieve', { ...base, text: 'Hola ñandú', font: 'righteous' }]);
    cases.push(['texto grabado', { ...base, text: 'Deco', font: 'bebas', engrave: true }]);
    cases.push(['texto cursivo', { ...base, text: 'Luna', font: 'pacifico' }]);
  }

  it.each(cases)('%s → sólido cerrado', async (_name, values) => {
    const mesh = await g.build(sanitize(g, values));
    const { bad, degenerate } = checkWatertight(mesh);
    expect(bad).toBe(0);
    expect(degenerate).toBe(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    const stats = analyze(mesh);
    expect(stats.volume).toBeGreaterThan(0); // normales hacia afuera
    expect(stats.size[2]).toBeGreaterThan(0);
  });
});

describe('imprimible sin soportes', () => {
  const flat = ['frame', 'letters', 'coaster', 'panel', 'hook'];
  it.each(GENERATORS.filter((g) => flat.includes(g.id)).flatMap((g) => g.presets.map((p) => [g.name, p.name, g, p.values] as const)))(
    '%s · %s',
    async (_g, _p, g, preset) => {
      const stats = analyze(await g.build(sanitize(g, { ...defaults(g), ...preset })));
      expect(stats.overhang).toBeLessThan(0.03);
    },
  );
});

describe('texto', () => {
  it('agrega volumen al jarrón', async () => {
    const vase = GENERATORS.find((g) => g.id === 'vase')!;
    const plain = analyze(await vase.build(defaults(vase)));
    const withText = analyze(await vase.build({ ...defaults(vase), text: 'Flores' }));
    const engraved = analyze(await vase.build({ ...defaults(vase), text: 'Flores', engrave: true }));
    expect(withText.volume).toBeGreaterThan(plain.volume);
    expect(engraved.volume).toBeLessThan(plain.volume);
  });
});

describe('STL', () => {
  it('escribe el tamaño correcto', async () => {
    const mesh = await GENERATORS[0].build(defaults(GENERATORS[0]));
    const buf = toBinarySTL(mesh);
    const count = mesh.indices.length / 3;
    expect(buf.byteLength).toBe(84 + 50 * count);
    expect(new DataView(buf).getUint32(80, true)).toBe(count);
  });
});
