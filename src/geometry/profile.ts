/** Herramientas para perfiles de revolución y texturas de superficie. */

const TAU = Math.PI * 2;

/**
 * Interpolación cúbica suave (Hermite con tangentes tipo Catmull-Rom) a
 * través de puntos de control (t, valor) ordenados por t.
 */
export function smoothProfile(points: [number, number][]): (t: number) => number {
  const n = points.length;
  const slope = (i: number) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const m = points.map((_, i) => slope(i));
  return (t: number) => {
    if (t <= points[0][0]) return points[0][1];
    if (t >= points[n - 1][0]) return points[n - 1][1];
    let i = 0;
    while (t > points[i + 1][0]) i++;
    const [t0, p0] = points[i];
    const [t1, p1] = points[i + 1];
    const h = t1 - t0;
    const s = (t - t0) / h;
    const s2 = s * s, s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * p0 +
      (s3 - 2 * s2 + s) * h * m[i] +
      (-2 * s3 + 3 * s2) * p1 +
      (s3 - s2) * h * m[i + 1]
    );
  };
}

/** Onda triangular de periodo 1 con valores en [0, 1] (1 en x = 0.5). */
const tri = (x: number) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);

export type SurfacePattern = 'none' | 'ribs' | 'scallops' | 'diamonds' | 'rings' | 'waves' | 'bubbles';

export const SURFACE_PATTERNS: { value: SurfacePattern; label: string }[] = [
  { value: 'none', label: 'Liso' },
  { value: 'ribs', label: 'Estrías' },
  { value: 'scallops', label: 'Gallones' },
  { value: 'diamonds', label: 'Diamantes' },
  { value: 'rings', label: 'Anillos' },
  { value: 'waves', label: 'Ondas' },
  { value: 'bubbles', label: 'Burbujas' },
];

export interface SurfaceStyle {
  /** Lados del polígono de la sección (< 3 = circular). */
  sides: number;
  /** Giro total en grados de abajo hacia arriba. */
  twist: number;
  pattern: SurfacePattern;
  /** Repeticiones del patrón alrededor. */
  count: number;
  /** Profundidad del patrón en mm. */
  depth: number;
  /** Relación altura / perímetro medio, para que los patrones 2D queden proporcionados. */
  aspect: number;
}

/**
 * Aplica sección poligonal, giro y textura a un radio base.
 * Devuelve el radio final en (t, θ).
 */
export function styleRadius(base: (t: number) => number, s: SurfaceStyle) {
  const sides = Math.round(s.sides);
  const twist = (s.twist * Math.PI) / 180;
  const k = Math.max(1, Math.round(s.count));
  const vertical = Math.max(1, Math.round(k * s.aspect));

  return (t: number, theta: number) => {
    const a = theta - twist * t;
    let r = base(t);
    r *= polygonFactor(sides, a);
    const u = (a / TAU) * k; // coordenada horizontal en "celdas"
    const v = t * vertical; // coordenada vertical en "celdas"
    switch (s.pattern) {
      case 'ribs':
        r += s.depth * 0.5 * (1 + Math.cos(TAU * u));
        break;
      case 'scallops':
        r += s.depth * Math.abs(Math.sin(Math.PI * u));
        break;
      case 'diamonds':
        r += s.depth * Math.min(tri(u + v), tri(u - v));
        break;
      case 'rings':
        r += s.depth * 0.5 * (1 + Math.cos(TAU * v));
        break;
      case 'waves':
        r += s.depth * 0.5 * (1 + Math.cos(TAU * (u + 0.35 * Math.sin(TAU * v * 0.5))));
        break;
      case 'bubbles': {
        const row = Math.floor(v);
        const du = u + (row % 2 ? 0.5 : 0);
        const dx = du - Math.floor(du) - 0.5;
        const dy = v - row - 0.5;
        const d = Math.min(1, 2 * Math.hypot(dx, dy));
        r += s.depth * Math.sqrt(1 - d * d);
        break;
      }
    }
    return r;
  };
}

/** Radio de un polígono regular de `sides` lados (circunradio 1) en el ángulo θ. */
export function polygonFactor(sides: number, theta: number, rotation = 0): number {
  if (sides < 3) return 1;
  const seg = TAU / sides;
  const a = theta - rotation;
  const local = a - seg * Math.floor(a / seg) - seg / 2;
  return Math.cos(seg / 2) / Math.cos(local);
}

/** Cantidad de segmentos, múltiplo de `sides` para que las aristas caigan en vértices. */
export function segmentsFor(base: number, sides: number): number {
  const s = Math.round(sides);
  if (s < 3) return base;
  return s * Math.ceil(base / s);
}
