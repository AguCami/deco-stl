import { MeshBuilder, type Loop, type MeshData } from './mesh';

export interface PolarSlabOptions {
  /** Radio del contorno en función del ángulo (permite polígonos). */
  radius: (theta: number) => number;
  segments: number;
  rings: number;
  /** Altura de la cara superior; rho va de 0 (centro) a 1 (borde). Debe ser > 0. */
  height: (rho: number, theta: number) => number;
}

/** Placa circular/poligonal con relieve en la cara superior (posavasos, platos). */
export function buildPolarSlab(o: PolarSlabOptions): MeshData {
  const m = new MeshBuilder();
  const n = Math.max(3, Math.round(o.segments));
  const rings = Math.max(1, Math.round(o.rings));
  const angle = (j: number) => (j / n) * Math.PI * 2;
  const R = Array.from({ length: n }, (_, j) => o.radius(angle(j)));
  const h = (rho: number, theta: number) => Math.max(0.2, o.height(rho, theta));

  const top: Loop[] = [];
  for (let k = 1; k <= rings; k++) {
    const rho = k / rings;
    top.push(
      m.loop(n, (j) => {
        const r = rho * R[j];
        return [r * Math.cos(angle(j)), r * Math.sin(angle(j)), h(rho, angle(j))];
      }),
    );
  }
  m.fan(m.vertex(0, 0, h(0, 0)), top[0], true);
  for (let k = 0; k < rings - 1; k++) m.stitch(top[k + 1], top[k], true);

  const bottom = m.loop(n, (j) => [R[j] * Math.cos(angle(j)), R[j] * Math.sin(angle(j)), 0]);
  m.stitch(bottom, top[rings - 1], true);
  m.fan(m.vertex(0, 0, 0), bottom, false);
  return m.build();
}

export interface RectSlabOptions {
  width: number;
  depth: number;
  /** Tamaño aproximado de cada celda de la malla, en mm. */
  step: number;
  /** Altura de la cara superior en (x, y) centrados en el origen. Debe ser > 0. */
  height: (x: number, y: number) => number;
}

/** Placa rectangular con relieve (paneles de pared, azulejos). */
export function buildRectSlab(o: RectSlabOptions): MeshData {
  const m = new MeshBuilder();
  const nx = Math.max(1, Math.round(o.width / o.step));
  const ny = Math.max(1, Math.round(o.depth / o.step));
  const X = (i: number) => (i / nx - 0.5) * o.width;
  const Y = (j: number) => (j / ny - 0.5) * o.depth;
  const h = (x: number, y: number) => Math.max(0.2, o.height(x, y));

  const grid: number[][] = [];
  for (let i = 0; i <= nx; i++) {
    const col: number[] = [];
    for (let j = 0; j <= ny; j++) col.push(m.vertex(X(i), Y(j), h(X(i), Y(j))));
    grid.push(col);
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) m.quad(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
  }

  // Perímetro antihorario visto desde arriba.
  const top: Loop = [];
  const bottom: Loop = [];
  const push = (i: number, j: number) => {
    top.push(grid[i][j]);
    bottom.push(m.vertex(X(i), Y(j), 0));
  };
  for (let i = 0; i < nx; i++) push(i, 0);
  for (let j = 0; j < ny; j++) push(nx, j);
  for (let i = nx; i > 0; i--) push(i, ny);
  for (let j = ny; j > 0; j--) push(0, j);

  m.stitch(bottom, top, true);
  // La base es convexa: basta con un abanico desde el centro.
  m.fan(m.vertex(0, 0, 0), bottom, false);
  return m.build();
}
