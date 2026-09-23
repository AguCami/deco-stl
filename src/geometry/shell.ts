import { MeshBuilder, type Loop, type MeshData } from './mesh';

/** Radio en función de la altura normalizada t (0–1) y el ángulo θ. */
export type RadiusFn = (t: number, theta: number) => number;

export interface ShellOptions {
  height: number;
  /** Divisiones alrededor del eje. */
  segments: number;
  /** Divisiones en altura. */
  rows: number;
  outer: RadiusFn;
  /** Radio interior; por defecto `outer - wall`. `t` se mide sobre la altura total. */
  inner?: RadiusFn;
  wall: number;
  /** Grosor del fondo (ignorado si `openBottom`). */
  base: number;
  /** Tubo abierto por abajo (pantallas de lámpara). */
  openBottom?: boolean;
  /** Sólido macizo, útil para el "modo jarrón" del slicer. */
  solid?: boolean;
  /** Radio del agujero de drenaje en el fondo (0 = sin agujero). */
  drainHole?: number;
  /**
   * Giro (radianes) de los vértices de cada anillo según t. Hacer que siga el
   * giro del diseño mantiene las aristas de los polígonos sobre vértices.
   */
  phase?: (t: number) => number;
}

const MIN_WALL = 0.4;

/**
 * Genera un recipiente de revolución (jarrón, maceta, cuenco…) como sólido
 * cerrado: superficie exterior, interior, borde superior y fondo.
 */
export function buildShell(o: ShellOptions): MeshData {
  const m = new MeshBuilder();
  const n = Math.max(3, Math.round(o.segments));
  const rows = Math.max(1, Math.round(o.rows));
  const H = o.height;
  const phase = o.phase ?? (() => 0);
  const angleAt = (t: number) => {
    const p = phase(t);
    return (j: number) => (j / n) * Math.PI * 2 + p;
  };
  const polar = (r: number, theta: number, z: number): [number, number, number] => [
    r * Math.cos(theta),
    r * Math.sin(theta),
    z,
  ];
  const outerR = (t: number, theta: number) => Math.max(1, o.outer(t, theta));

  const outer: Loop[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const angle = angleAt(t);
    outer.push(m.loop(n, (j) => polar(outerR(t, angle(j)), angle(j), t * H)));
  }
  for (let i = 0; i < rows; i++) m.stitch(outer[i], outer[i + 1], true);

  if (o.solid) {
    m.fan(m.vertex(0, 0, 0), outer[0], false);
    m.fan(m.vertex(0, 0, H), outer[rows], true);
    return m.build();
  }

  const floorZ = o.openBottom ? 0 : Math.min(Math.max(o.base, 0.2), H - 0.5);
  const innerR = (t: number, theta: number) => {
    const out = outerR(t, theta);
    const want = o.inner ? o.inner(t, theta) : out - o.wall;
    return Math.max(0.5, Math.min(want, out - MIN_WALL));
  };
  const innerRows = Math.max(1, Math.round((rows * (H - floorZ)) / H));
  const inner: Loop[] = [];
  for (let i = 0; i <= innerRows; i++) {
    const z = floorZ + ((H - floorZ) * i) / innerRows;
    const t = z / H;
    const angle = angleAt(t);
    inner.push(m.loop(n, (j) => polar(innerR(t, angle(j)), angle(j), z)));
  }
  for (let i = 0; i < innerRows; i++) m.stitch(inner[i], inner[i + 1], false);

  // Borde superior (labio).
  m.stitch(outer[rows], inner[innerRows], true);

  if (o.openBottom) {
    m.stitch(outer[0], inner[0], false);
    return m.build();
  }

  const t0 = floorZ / H;
  const a0 = angleAt(0);
  const a1 = angleAt(t0);
  let minFloorR = Infinity;
  for (let j = 0; j < n; j++) minFloorR = Math.min(minFloorR, innerR(0, a0(j)), innerR(t0, a1(j)));
  const hole = Math.min(o.drainHole ?? 0, minFloorR - 1.5);

  if (hole > 0.5) {
    const h0 = m.loop(n, (j) => polar(hole, a0(j), 0));
    const h1 = m.loop(n, (j) => polar(hole, a1(j), floorZ));
    m.stitch(outer[0], h0, false); // cara inferior
    m.stitch(inner[0], h1, true); // piso interior
    m.stitch(h0, h1, false); // pared del agujero
  } else {
    m.fan(m.vertex(0, 0, 0), outer[0], false);
    m.fan(m.vertex(0, 0, floorZ), inner[0], true);
  }
  return m.build();
}
