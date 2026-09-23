import { buildPolarSlab, buildRectSlab } from '../geometry/slab';
import { polygonFactor, segmentsFor } from '../geometry/profile';
import { reader, type Generator } from './types';

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const tri = (x: number) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);

/** Patrones polares: devuelven un valor en [0, 1] para (rho, θ). */
const POLAR: Record<string, (rho: number, theta: number, k: number) => number> = {
  rings: (rho, _t, k) => 0.5 + 0.5 * Math.cos(TAU * k * rho * 0.5),
  sunburst: (rho, t, k) => smoothstep(0.1, 0.25, rho) * tri((t / TAU) * k * 2),
  spiral: (rho, t, k) => 0.5 + 0.5 * Math.cos(Math.round(k / 2) * t - TAU * 2.5 * rho),
  flower: (rho, t, k) => {
    const petals = Math.max(3, Math.round(k / 2));
    const edge = 0.25 + 0.7 * Math.abs(Math.cos((petals * t) / 2));
    const inner = 0.15 + 0.35 * Math.abs(Math.cos((petals * t) / 2 + Math.PI / 2));
    return Math.max(1 - smoothstep(edge - 0.1, edge, rho), 0.6 * (1 - smoothstep(inner - 0.08, inner, rho)));
  },
  mandala: (rho, t, k) => {
    // Cuatro anillos de pétalos con meseta plana, alternando su desfase.
    const bands = 4;
    const b = Math.min(bands - 1, Math.floor(rho * bands));
    const f = rho * bands - b;
    const petals = Math.max(3, Math.round((k / 2) * (b === 0 ? 0.75 : b)));
    const a = (petals * t) / 2 + (b % 2 ? Math.PI / 2 : 0);
    const edge = 0.2 + 0.75 * Math.abs(Math.cos(a));
    const start = b === 0 ? 1 : smoothstep(0.02, 0.1, f);
    return smoothstep(edge, edge - 0.14, f) * start;
  },
  ripple: (rho, t, k) => 0.5 + 0.5 * Math.sin(TAU * k * 0.4 * rho + 0.8 * Math.cos(6 * t)),
};

export const coaster: Generator = {
  id: 'coaster',
  name: 'Posavasos',
  description: 'Posavasos y platitos con relieve.',
  params: [
    {
      key: 'shape', label: 'Contorno', group: 'Forma', type: 'select', default: '0',
      options: [
        { value: '0', label: 'Círculo' },
        { value: '4', label: 'Cuadrado' },
        { value: '6', label: 'Hexágono' },
        { value: '8', label: 'Octógono' },
      ],
    },
    { key: 'diameter', label: 'Diámetro', group: 'Forma', type: 'range', min: 60, max: 200, step: 1, default: 100, unit: 'mm' },
    { key: 'base', label: 'Grosor base', group: 'Forma', type: 'range', min: 1.2, max: 8, step: 0.2, default: 3, unit: 'mm', fixed: true },
    {
      key: 'pattern', label: 'Diseño', group: 'Relieve', type: 'select', default: 'mandala',
      options: [
        { value: 'mandala', label: 'Mandala' },
        { value: 'flower', label: 'Flor' },
        { value: 'sunburst', label: 'Rayos de sol' },
        { value: 'spiral', label: 'Espiral' },
        { value: 'rings', label: 'Anillos' },
        { value: 'ripple', label: 'Ondas de agua' },
      ],
    },
    { key: 'count', label: 'Repeticiones', group: 'Relieve', type: 'range', min: 4, max: 36, step: 1, default: 16 },
    { key: 'relief', label: 'Altura del relieve', group: 'Relieve', type: 'range', min: 0.4, max: 5, step: 0.1, default: 1.4, unit: 'mm' },
    { key: 'rim', label: 'Ancho del borde', group: 'Relieve', type: 'range', min: 0, max: 12, step: 0.5, default: 4, unit: 'mm' },
    { key: 'rimHeight', label: 'Altura del borde', group: 'Relieve', type: 'range', min: 0, max: 6, step: 0.1, default: 2, unit: 'mm' },
  ],
  presets: [
    { name: 'Mandala', values: { pattern: 'mandala', count: 16, shape: '0' } },
    { name: 'Hexágono flor', values: { pattern: 'flower', count: 12, shape: '6' } },
    { name: 'Sol', values: { pattern: 'sunburst', count: 24, shape: '0', relief: 1.2 } },
    { name: 'Plato ondas', values: { pattern: 'ripple', count: 10, diameter: 160, rim: 8, rimHeight: 5, relief: 1 } },
  ],
  build(v) {
    const { num, str } = reader(v);
    const sides = Number(str('shape'));
    const R = num('diameter') / 2;
    const base = num('base');
    const relief = num('relief');
    const rimW = num('rim');
    const rimH = num('rimHeight');
    const k = num('count');
    const pattern = POLAR[str('pattern')] ?? POLAR.mandala;
    // Los polígonos se orientan con un lado horizontal.
    const rot = sides >= 3 ? Math.PI / sides : 0;
    return buildPolarSlab({
      radius: (t) => R * polygonFactor(sides, t, rot),
      segments: segmentsFor(360, sides),
      rings: Math.round(R * 2),
      height: (rho, t) => {
        // Distancia al borde en mm (aprox.) para dibujar el reborde.
        const edge = (1 - rho) * R * polygonFactor(sides, t, rot);
        const inRim = rimW > 0 ? smoothstep(rimW + 0.8, rimW, edge) : 0;
        const inner = rimW > 0 ? rho / Math.max(0.05, 1 - rimW / R) : rho;
        const design = inRim > 0.999 ? 0 : relief * pattern(Math.min(1, inner), t, k);
        return base + design * (1 - inRim) + rimH * inRim;
      },
    });
  },
};

/** Patrones de panel: (u, v) en celdas; devuelven [0, 1]. */
const PANEL: Record<string, (u: number, v: number) => number> = {
  waves: (u) => 0.5 + 0.5 * Math.sin(TAU * u),
  cross: (u, v) => 0.5 + 0.25 * (Math.sin(TAU * u) + Math.sin(TAU * v)),
  pyramids: (u, v) => 1 - 2 * Math.max(Math.abs(u - Math.floor(u) - 0.5), Math.abs(v - Math.floor(v) - 0.5)),
  bubbles: (u, v) => {
    const d = 2 * Math.hypot(u - Math.floor(u) - 0.5, v - Math.floor(v) - 0.5);
    return Math.sqrt(Math.max(0, 1 - d * d));
  },
  diamonds: (u, v) => Math.min(tri(u + v), tri(u - v)),
  hexagons: (u, v) => {
    // Centro más cercano de una rejilla hexagonal (dos rejillas rectangulares desfasadas).
    const s3 = Math.sqrt(3);
    const ax = u - Math.round(u), ay = v - s3 * Math.round(v / s3);
    const bx = u - 0.5 - Math.round(u - 0.5), by = v - s3 / 2 - s3 * Math.round((v - s3 / 2) / s3);
    const [px, py] = Math.hypot(ax, ay) < Math.hypot(bx, by) ? [ax, ay] : [bx, by];
    const x = Math.abs(px), y = Math.abs(py);
    const d = Math.max(x, x * 0.5 + (y * s3) / 2) / 0.5; // 1 = arista del hexágono
    return smoothstep(0.95, 0.5, d);
  },
  scales: (u, v) => {
    const row = Math.floor(v);
    const x = u + (row % 2 ? 0.5 : 0);
    const dx = x - Math.floor(x) - 0.5;
    const dy = v - row;
    const d = Math.hypot(dx, dy);
    return clamp01(1 - d) ** 0.7;
  },
  ripple: (u, v) => 0.5 + 0.5 * Math.cos(TAU * Math.hypot(u, v)),
};

export const wallPanel: Generator = {
  id: 'panel',
  name: 'Panel 3D',
  description: 'Azulejos y paneles de pared con relieve, combinables en mosaico.',
  params: [
    { key: 'width', label: 'Ancho', group: 'Forma', type: 'range', min: 50, max: 250, step: 1, default: 150, unit: 'mm' },
    { key: 'depth', label: 'Alto', group: 'Forma', type: 'range', min: 50, max: 250, step: 1, default: 150, unit: 'mm' },
    { key: 'base', label: 'Grosor base', group: 'Forma', type: 'range', min: 1.2, max: 10, step: 0.2, default: 3, unit: 'mm', fixed: true },
    {
      key: 'pattern', label: 'Diseño', group: 'Relieve', type: 'select', default: 'hexagons',
      options: [
        { value: 'hexagons', label: 'Hexágonos' },
        { value: 'pyramids', label: 'Pirámides' },
        { value: 'diamonds', label: 'Diamantes' },
        { value: 'bubbles', label: 'Burbujas' },
        { value: 'scales', label: 'Escamas' },
        { value: 'waves', label: 'Ondas' },
        { value: 'cross', label: 'Ondas cruzadas' },
        { value: 'ripple', label: 'Ondas de agua' },
      ],
    },
    { key: 'cells', label: 'Celdas por lado', group: 'Relieve', type: 'range', min: 1, max: 16, step: 1, default: 5 },
    { key: 'relief', label: 'Altura del relieve', group: 'Relieve', type: 'range', min: 0.5, max: 25, step: 0.5, default: 8, unit: 'mm' },
    { key: 'frame', label: 'Marco', group: 'Relieve', type: 'range', min: 0, max: 15, step: 0.5, default: 0, unit: 'mm' },
    {
      key: 'res', label: 'Resolución', group: 'Impresión', type: 'select', default: '0.75', fixed: true,
      options: [
        { value: '1.5', label: 'Borrador' },
        { value: '0.75', label: 'Normal' },
        { value: '0.4', label: 'Alta' },
      ],
    },
  ],
  presets: [
    { name: 'Colmena', values: { pattern: 'hexagons', cells: 5, relief: 6 } },
    { name: 'Pirámides', values: { pattern: 'pyramids', cells: 4, relief: 15 } },
    { name: 'Ondas', values: { pattern: 'waves', cells: 5, relief: 10 } },
    { name: 'Escamas', values: { pattern: 'scales', cells: 7, relief: 5 } },
  ],
  build(v) {
    const { num, str } = reader(v);
    const W = num('width');
    const D = num('depth');
    const base = num('base');
    const relief = num('relief');
    const frame = num('frame');
    const cell = W / num('cells');
    const pattern = PANEL[str('pattern')] ?? PANEL.hexagons;
    const centered = str('pattern') === 'ripple';
    return buildRectSlab({
      width: W,
      depth: D,
      step: Number(str('res')) || 1,
      height: (x, y) => {
        const edge = Math.min(W / 2 - Math.abs(x), D / 2 - Math.abs(y));
        const u = centered ? x / cell : (x + W / 2) / cell;
        const w = centered ? y / cell : (y + D / 2) / cell;
        const h = relief * clamp01(pattern(u, w));
        if (frame <= 0) return base + h;
        const inFrame = smoothstep(frame + 0.8, frame, edge);
        return base + h * (1 - inFrame) + relief * inFrame;
      },
    });
  },
};
