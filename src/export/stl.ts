import type { MeshData } from '../geometry/mesh';

/** Serializa la malla como STL binario (formato compacto que aceptan todos los slicers). */
export function toBinarySTL(mesh: MeshData, header = 'deco-stl'): ArrayBuffer {
  const { positions: p, indices: ix } = mesh;
  const count = ix.length / 3;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  const text = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buffer, 0, 80).set(text);
  view.setUint32(80, count, true);

  let o = 84;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const f of [nx, ny, nz]) { view.setFloat32(o, f, true); o += 4; }
    for (const i of [a, b, c]) {
      view.setFloat32(o, p[i], true);
      view.setFloat32(o + 4, p[i + 1], true);
      view.setFloat32(o + 8, p[i + 2], true);
      o += 12;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return buffer;
}

export function downloadSTL(mesh: MeshData, filename: string): void {
  const blob = new Blob([toBinarySTL(mesh)], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
