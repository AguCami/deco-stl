import { csg, fromManifold, toManifold } from '../geometry/csg';
import type { MeshData } from '../geometry/mesh';
import { FONT_OPTIONS, loadFont } from '../text/fonts';
import { textOutline, type TextOutline } from '../text/outline';
import { reader, type Param, type Values } from './types';

const G = 'Texto';

interface TextDefaults {
  size: number;
  maxSize?: number;
  depth: number;
  /** Agrega el control de altura sobre la pieza (recipientes). */
  position?: boolean;
}

/** Parámetros comunes para agregar texto a una pieza. */
export function textParams(d: TextDefaults): Param[] {
  const params: Param[] = [
    { key: 'text', label: 'Texto', group: G, type: 'text', default: '', maxLength: 30, placeholder: 'Ej.: Hogar, un nombre…', fixed: true },
    { key: 'font', label: 'Tipografía', group: G, type: 'select', options: FONT_OPTIONS, default: 'righteous', fixed: true },
    { key: 'textSize', label: 'Altura de letra', group: G, type: 'range', min: 5, max: d.maxSize ?? 60, step: 0.5, default: d.size, unit: 'mm', fixed: true },
    { key: 'textDepth', label: 'Relieve del texto', group: G, type: 'range', min: 0.4, max: 5, step: 0.1, default: d.depth, unit: 'mm', fixed: true },
    { key: 'engrave', label: 'Texto hundido (grabado)', group: G, type: 'toggle', default: false, fixed: true },
  ];
  if (d.position) {
    params.push({ key: 'textPos', label: 'Altura del texto en la pieza', group: G, type: 'range', min: 0.1, max: 0.9, step: 0.01, default: 0.5, fixed: true });
  }
  return params;
}

async function outlineFor(v: Values, maxWidth: number, maxHeight = Infinity): Promise<TextOutline | null> {
  const { str, num } = reader(v);
  const text = str('text').trim();
  if (!text) return null;
  const font = await loadFont(str('font'));
  let size = num('textSize');
  let out = textOutline(font, text, size);
  if (!out) return null;
  // Achicar si no entra en el espacio disponible.
  const fit = Math.min(1, maxWidth / out.width, maxHeight / out.height);
  if (fit < 0.999) {
    size *= fit;
    out = textOutline(font, text, size);
  }
  return out;
}

/**
 * Texto sobre una pieza plana (posavasos, panel) centrado en el origen.
 * En relieve llega hasta `top + textDepth`; grabado baja `textDepth` desde `floor`.
 */
export async function flatText(mesh: MeshData, v: Values, o: { top: number; floor: number; maxWidth: number; maxHeight?: number }): Promise<MeshData> {
  const outline = await outlineFor(v, o.maxWidth, o.maxHeight);
  if (!outline) return mesh;
  const { num, bool } = reader(v);
  const depth = num('textDepth');
  return csg((m, keep) => {
    const body = keep(toManifold(m, mesh));
    const section = keep(new m.CrossSection(outline.contours, 'NonZero'));
    let result;
    if (bool('engrave')) {
      const cut = Math.min(depth, o.floor - 0.6);
      const prism = keep(keep(section.extrude(o.top + 10)).translate([0, 0, o.floor - cut]));
      result = keep(body.subtract(prism));
    } else {
      const prism = keep(keep(section.extrude(o.top + depth - 0.2)).translate([0, 0, 0.2]));
      result = keep(body.add(prism));
    }
    return fromManifold(result);
  });
}

export interface WrapOptions {
  height: number;
  /** Radio de la superficie sin textura en (t, θ). */
  surface: (t: number, theta: number) => number;
  /** Cuánto sobresale la textura por encima de `surface`. */
  texture: number;
  /** Espesor de pared disponible para grabar (Infinity si es macizo). */
  wall: number;
  /** Zona vertical utilizable, en mm. */
  zMin: number;
  zMax: number;
}

/** Texto envuelto sobre la cara frontal de un recipiente. */
export async function wrapText(mesh: MeshData, v: Values, o: WrapOptions): Promise<MeshData> {
  const { num, bool } = reader(v);
  const theta0 = Math.atan2(-0.7, 0.55); // de frente a la cámara inicial (ver Viewer.frame)
  const t0 = num('textPos');
  const rMid = o.surface(t0, theta0);
  const outline = await outlineFor(v, Math.PI * rMid * 0.8, (o.zMax - o.zMin) * 0.9);
  if (!outline) return mesh;

  const H = o.height;
  const half = outline.height / 2;
  const zc = Math.min(o.zMax - half, Math.max(o.zMin + half, t0 * H));
  const depth = num('textDepth');
  const engrave = bool('engrave');
  const cut = Math.min(depth, o.wall - 0.6);
  if (engrave && cut < 0.2) return mesh;
  const embed = Math.min(0.8, o.wall / 2);
  const inner = engrave ? cut : embed;
  const span = engrave ? cut + o.texture + 1 : embed + o.texture + depth;

  return csg((m, keep) => {
    const body = keep(toManifold(m, mesh));
    const section = keep(new m.CrossSection(outline.contours, 'NonZero'));
    const slab = keep(keep(section.extrude(1)).refineToLength(0.8));
    const letters = keep(
      slab.warp((p) => {
        const z = zc + p[1];
        const t = Math.min(1, Math.max(0, z / H));
        const theta = theta0 + p[0] / rMid;
        const r = o.surface(t, theta) - inner + p[2] * span;
        p[0] = r * Math.cos(theta);
        p[1] = r * Math.sin(theta);
        p[2] = z;
      }),
    );
    const result = keep(engrave ? body.subtract(letters) : body.add(letters));
    return fromManifold(result);
  });
}
