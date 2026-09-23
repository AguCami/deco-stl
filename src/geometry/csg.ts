/**
 * Operaciones booleanas robustas (unión, resta) con manifold-3d (WASM).
 * Garantizan que el resultado siga siendo un sólido cerrado aunque los
 * cuerpos se superpongan, algo imprescindible para texto y piezas compuestas.
 */
import Module from 'manifold-3d/manifold';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d/manifold';
import type { MeshData } from './mesh';

let wasm: Promise<ManifoldToplevel> | null = null;

export function getManifold(): Promise<ManifoldToplevel> {
  // En el navegador indicamos dónde quedó el .wasm tras el build; en Node lo encuentra solo.
  const config = typeof window === 'undefined' ? undefined : { locateFile: () => wasmUrl };
  wasm ??= Module(config).then((m) => {
    m.setup();
    return m;
  });
  return wasm;
}

/**
 * Los objetos de manifold viven en memoria WASM y hay que liberarlos a mano.
 * `csg` pasa un `keep` que registra cada objeto creado y los libera al final.
 */
export async function csg<T>(fn: (m: ManifoldToplevel, keep: <O extends Deletable>(o: O) => O) => T): Promise<T> {
  const m = await getManifold();
  const owned: Deletable[] = [];
  try {
    return fn(m, (o) => {
      owned.push(o);
      return o;
    });
  } finally {
    for (const o of owned) o.delete();
  }
}

interface Deletable {
  delete(): void;
}

export function toManifold(m: ManifoldToplevel, data: MeshData): Manifold {
  const mesh = new m.Mesh({ numProp: 3, vertProperties: data.positions, triVerts: data.indices });
  mesh.merge();
  return new m.Manifold(mesh);
}

export function fromManifold(solid: Manifold): MeshData {
  const mesh = solid.getMesh();
  const positions =
    mesh.numProp === 3
      ? Float32Array.from(mesh.vertProperties)
      : Float32Array.from({ length: (mesh.vertProperties.length / mesh.numProp) * 3 }, (_, i) =>
          mesh.vertProperties[Math.floor(i / 3) * mesh.numProp + (i % 3)],
        );
  return { positions, indices: Uint32Array.from(mesh.triVerts) };
}

export type { CrossSection, Manifold, ManifoldToplevel };
