/**
 * Núcleo de geometría: un constructor de mallas indexadas y utilidades para
 * coser anillos/lazos cerrados. Todas las piezas se construyen como sólidos
 * cerrados (estancos) con normales hacia afuera y eje Z hacia arriba, que es
 * la convención de los slicers de impresión 3D. Unidades: milímetros.
 */

export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

export type Loop = number[];

export class MeshBuilder {
  private pos: number[] = [];
  private idx: number[] = [];

  vertex(x: number, y: number, z: number): number {
    this.pos.push(x, y, z);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /** Cuadrilátero A→B→C→D (antihorario visto desde la cara exterior). */
  quad(a: number, b: number, c: number, d: number): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  /** Crea un lazo cerrado de `n` vértices; `at(j)` devuelve [x, y, z]. */
  loop(n: number, at: (j: number) => [number, number, number]): Loop {
    const out: Loop = new Array(n);
    for (let j = 0; j < n; j++) {
      const [x, y, z] = at(j);
      out[j] = this.vertex(x, y, z);
    }
    return out;
  }

  /**
   * Une dos lazos antihorarios (vistos desde +Z) con la misma cantidad de
   * vértices. Con `outward = true`, la banda mira "a la derecha" del recorrido
   * de `a` hacia `b`: si `b` está encima de `a`, mira hacia afuera del eje; si
   * ambos están en el mismo plano y `a` es el exterior, mira hacia +Z.
   */
  stitch(a: Loop, b: Loop, outward = true): void {
    const n = a.length;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      if (outward) this.quad(a[j], a[k], b[k], b[j]);
      else this.quad(a[j], b[j], b[k], a[k]);
    }
  }

  /** Tapa un lazo antihorario con un abanico desde `center`, mirando a +Z o -Z. */
  fan(center: number, loop: Loop, up: boolean): void {
    const n = loop.length;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      if (up) this.tri(center, loop[j], loop[k]);
      else this.tri(center, loop[k], loop[j]);
    }
  }

  build(): MeshData {
    return {
      positions: new Float32Array(this.pos),
      indices: new Uint32Array(this.idx),
    };
  }
}

export interface MeshStats {
  triangles: number;
  size: [number, number, number];
  /** Volumen en mm³. */
  volume: number;
  /** Fracción (0–1) del área de superficie con voladizo mayor a 45°. */
  overhang: number;
}

export function analyze(mesh: MeshData): MeshStats {
  const p = mesh.positions;
  const ix = mesh.indices;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (p[i + a] < min[a]) min[a] = p[i + a];
      if (p[i + a] > max[a]) max[a] = p[i + a];
    }
  }

  const bedZ = min[2] + 0.01;
  // Voladizo medido desde la vertical: la normal apunta hacia abajo con nz < -sin(α).
  // Un grado de tolerancia para que los biseles de 45° exactos no cuenten.
  const limit = Math.sin((46 * Math.PI) / 180);
  let volume = 0;
  let area = 0;
  let overhangArea = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const ax = p[a], ay = p[a + 1], az = p[a + 2];
    const bx = p[b], by = p[b + 1], bz = p[b + 2];
    const cx = p[c], cy = p[c + 1], cz = p[c + 2];
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    const triArea = len / 2;
    area += triArea;
    const onBed = az < bedZ && bz < bedZ && cz < bedZ;
    if (!onBed && len > 0 && nz / len < -limit) overhangArea += triArea;
  }

  return {
    triangles: ix.length / 3,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    volume,
    overhang: area > 0 ? overhangArea / area : 0,
  };
}
