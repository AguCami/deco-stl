import { buildShell } from '../geometry/shell';
import { SURFACE_PATTERNS, segmentsFor, smoothProfile, styleRadius, type SurfacePattern } from '../geometry/profile';
import { reader, type Generator, type Param, type Values } from './types';

const RESOLUTION: Param = {
  key: 'res',
  label: 'Resolución',
  group: 'Impresión',
  type: 'select',
  fixed: true,
  default: 'medium',
  options: [
    { value: 'low', label: 'Borrador' },
    { value: 'medium', label: 'Normal' },
    { value: 'high', label: 'Alta' },
  ],
};

const RES = {
  low: { segments: 96, rows: 60 },
  medium: { segments: 180, rows: 120 },
  high: { segments: 320, rows: 240 },
} as const;

interface ShapeDefaults {
  height: [number, number, number];
  radii: [number, number, number, number];
  maxRadius: number;
}

function shapeParams(d: ShapeDefaults): Param[] {
  const g = 'Forma';
  const r = (key: string, label: string, def: number): Param => ({
    key, label, group: g, type: 'range', min: 8, max: d.maxRadius, step: 1, default: def, unit: 'mm',
  });
  return [
    { key: 'height', label: 'Altura', group: g, type: 'range', min: d.height[0], max: d.height[1], step: 1, default: d.height[2], unit: 'mm' },
    r('r0', 'Radio base', d.radii[0]),
    r('r1', 'Radio vientre', d.radii[1]),
    r('r2', 'Radio cuello', d.radii[2]),
    r('r3', 'Radio boca', d.radii[3]),
    { key: 'belly', label: 'Altura del vientre', group: g, type: 'range', min: 0.15, max: 0.6, step: 0.01, default: 0.35 },
    { key: 'neck', label: 'Altura del cuello', group: g, type: 'range', min: 0.62, max: 0.95, step: 0.01, default: 0.78 },
  ];
}

const STYLE_PARAMS: Param[] = [
  { key: 'sides', label: 'Lados (0 = redondo)', group: 'Estilo', type: 'range', min: 0, max: 12, step: 1, default: 0 },
  { key: 'twist', label: 'Giro', group: 'Estilo', type: 'range', min: -360, max: 360, step: 5, default: 0, unit: '°' },
  { key: 'pattern', label: 'Textura', group: 'Estilo', type: 'select', options: SURFACE_PATTERNS, default: 'none' },
  { key: 'count', label: 'Repeticiones', group: 'Estilo', type: 'range', min: 2, max: 48, step: 1, default: 16 },
  { key: 'depth', label: 'Profundidad textura', group: 'Estilo', type: 'range', min: 0, max: 10, step: 0.1, default: 2.5, unit: 'mm' },
];

const wallParam = (def: number): Param => ({
  key: 'wall', label: 'Grosor de pared', group: 'Impresión', type: 'range', min: 0.8, max: 6, step: 0.1, default: def, unit: 'mm', fixed: true,
});
const baseParam = (def: number): Param => ({
  key: 'base', label: 'Grosor del fondo', group: 'Impresión', type: 'range', min: 1, max: 12, step: 0.2, default: def, unit: 'mm', fixed: true,
});
const SOLID: Param = {
  key: 'solid', label: 'Sólido (para modo jarrón del slicer)', group: 'Impresión', type: 'toggle', default: false, fixed: true,
  hint: 'Exporta la pieza maciza; activá "Spiralize / Vase mode" en el slicer para imprimirla con una sola pared.',
};

/** Radio (t, θ) a partir de los parámetros de forma y estilo comunes. */
function vesselRadius(v: Values) {
  const { num, str } = reader(v);
  const profile = smoothProfile([
    [0, num('r0')],
    [num('belly'), num('r1')],
    [num('neck'), num('r2')],
    [1, num('r3')],
  ]);
  const meanR = (num('r0') + num('r1') + num('r2') + num('r3')) / 4;
  const radius = styleRadius(profile, {
    sides: num('sides'),
    twist: num('twist'),
    pattern: str('pattern') as SurfacePattern,
    count: num('count'),
    depth: num('depth'),
    aspect: num('height') / (2 * Math.PI * meanR),
  });
  const res = RES[str('res') as keyof typeof RES] ?? RES.medium;
  const twist = (num('twist') * Math.PI) / 180;
  return {
    radius,
    segments: segmentsFor(res.segments, num('sides')),
    rows: res.rows,
    phase: (t: number) => twist * t,
  };
}

export const vase: Generator = {
  id: 'vase',
  name: 'Jarrón',
  description: 'Jarrones de revolución con giro, facetas y texturas.',
  params: [
    ...shapeParams({ height: [60, 320, 180], radii: [35, 58, 32, 42], maxRadius: 120 }),
    ...STYLE_PARAMS,
    wallParam(2),
    baseParam(3),
    SOLID,
    RESOLUTION,
  ],
  presets: [
    { name: 'Espiral hexagonal', values: { sides: 6, twist: 120, pattern: 'none', r0: 40, r1: 55, r2: 38, r3: 46 } },
    { name: 'Clásico estriado', values: { sides: 0, twist: 0, pattern: 'ribs', count: 24, depth: 2.5 } },
    { name: 'Diamantes', values: { sides: 0, twist: 0, pattern: 'diamonds', count: 14, depth: 3, r0: 45, r1: 55, r2: 42, r3: 45 } },
    { name: 'Gallones retorcidos', values: { sides: 0, twist: 90, pattern: 'scallops', count: 10, depth: 5 } },
    { name: 'Botella burbujas', values: { height: 220, r0: 42, r1: 50, r2: 16, r3: 20, neck: 0.85, pattern: 'bubbles', count: 12, depth: 3 } },
  ],
  build(v) {
    const { num, bool } = reader(v);
    const { radius, segments, rows, phase } = vesselRadius(v);
    return buildShell({ height: num('height'), segments, rows, phase, outer: radius, wall: num('wall'), base: num('base'), solid: bool('solid') });
  },
};

export const planter: Generator = {
  id: 'planter',
  name: 'Maceta',
  description: 'Macetas con agujero de drenaje opcional.',
  params: [
    ...shapeParams({ height: [40, 220, 110], radii: [42, 52, 58, 62], maxRadius: 120 }),
    ...STYLE_PARAMS,
    wallParam(2.4),
    baseParam(4),
    { key: 'drain', label: 'Agujero de drenaje (radio)', group: 'Impresión', type: 'range', min: 0, max: 20, step: 0.5, default: 6, unit: 'mm' },
    RESOLUTION,
  ],
  presets: [
    { name: 'Geométrica', values: { sides: 8, twist: 45, pattern: 'none' } },
    { name: 'Acanalada', values: { sides: 0, twist: 0, pattern: 'scallops', count: 18, depth: 3 } },
    { name: 'Ondas', values: { sides: 0, twist: 30, pattern: 'waves', count: 20, depth: 2.5 } },
    { name: 'Cilíndrica anillos', values: { r0: 50, r1: 50, r2: 50, r3: 52, pattern: 'rings', count: 6, depth: 2 } },
  ],
  build(v) {
    const { num } = reader(v);
    const { radius, segments, rows, phase } = vesselRadius(v);
    return buildShell({
      height: num('height'), segments, rows, phase, outer: radius, wall: num('wall'), base: num('base'), drainHole: num('drain'),
    });
  },
};

export const bowl: Generator = {
  id: 'bowl',
  name: 'Cuenco',
  description: 'Cuencos y vaciabolsillos decorativos.',
  params: [
    ...shapeParams({ height: [20, 140, 60], radii: [32, 58, 72, 76], maxRadius: 140 }),
    ...STYLE_PARAMS,
    wallParam(2),
    baseParam(3),
    RESOLUTION,
  ],
  presets: [
    { name: 'Loto', values: { pattern: 'scallops', count: 12, depth: 5, twist: 0, sides: 0 } },
    { name: 'Facetado', values: { sides: 9, twist: 40, pattern: 'none' } },
    { name: 'Vaciabolsillos bajo', values: { height: 35, r0: 55, r1: 68, r2: 74, r3: 76, pattern: 'ribs', count: 30, depth: 1.5 } },
  ],
  build(v) {
    const { num } = reader(v);
    const { radius, segments, rows, phase } = vesselRadius(v);
    return buildShell({ height: num('height'), segments, rows, phase, outer: radius, wall: num('wall'), base: num('base') });
  },
};

export const lampshade: Generator = {
  id: 'lampshade',
  name: 'Pantalla',
  description: 'Pantallas de lámpara (tubo abierto) para LED.',
  params: [
    ...shapeParams({ height: [60, 260, 150], radii: [70, 78, 60, 45], maxRadius: 130 }),
    ...STYLE_PARAMS,
    wallParam(1.2),
    RESOLUTION,
  ],
  presets: [
    { name: 'Remolino', values: { sides: 0, twist: 180, pattern: 'ribs', count: 24, depth: 3 } },
    { name: 'Cónica facetada', values: { r0: 80, r1: 72, r2: 55, r3: 45, sides: 10, twist: 72, pattern: 'none' } },
    { name: 'Diamantes', values: { pattern: 'diamonds', count: 18, depth: 3, twist: 0, sides: 0 } },
  ],
  build(v) {
    const { num } = reader(v);
    const { radius, segments, rows, phase } = vesselRadius(v);
    return buildShell({ height: num('height'), segments, rows, phase, outer: radius, wall: num('wall'), base: 0, openBottom: true });
  },
};

const CANDLES: Record<string, number> = { tealight: 39.5, maxi: 59, taper: 22, pillar: 70 };

export const candleHolder: Generator = {
  id: 'candle',
  name: 'Portavelas',
  description: 'Portavelas con hueco a medida para la vela.',
  params: [
    ...shapeParams({ height: [25, 160, 55], radii: [34, 38, 32, 30], maxRadius: 90 }),
    ...STYLE_PARAMS,
    {
      key: 'candle', label: 'Tipo de vela', group: 'Vela', type: 'select', default: 'tealight', fixed: true,
      options: [
        { value: 'tealight', label: 'Tealight (Ø 39,5 mm)' },
        { value: 'maxi', label: 'Tealight maxi (Ø 59 mm)' },
        { value: 'taper', label: 'Vela cónica (Ø 22 mm)' },
        { value: 'pillar', label: 'Vela pilar (Ø 70 mm)' },
      ],
    },
    { key: 'cavity', label: 'Profundidad del hueco', group: 'Vela', type: 'range', min: 8, max: 60, step: 1, default: 18, unit: 'mm', fixed: true },
    RESOLUTION,
  ],
  presets: [
    { name: 'Facetado', values: { sides: 7, twist: 50, pattern: 'none' } },
    { name: 'Gallones', values: { sides: 0, twist: 0, pattern: 'scallops', count: 12, depth: 3 } },
    { name: 'Candelabro cónico', values: { candle: 'taper', height: 110, r0: 40, r1: 24, r2: 16, r3: 20, belly: 0.3, neck: 0.8, cavity: 25, pattern: 'rings', count: 8, depth: 1.5 } },
  ],
  build(v) {
    const { num, str } = reader(v);
    const { radius, segments, rows, phase } = vesselRadius(v);
    const H = num('height');
    const hole = (CANDLES[str('candle')] ?? CANDLES.tealight) / 2 + 0.6; // holgura
    const minOuter = hole + 2;
    return buildShell({
      height: H, segments, rows, phase,
      outer: (t, a) => Math.max(minOuter, radius(t, a)),
      inner: () => hole,
      wall: 0,
      base: Math.max(2, H - num('cavity')),
    });
  },
};
