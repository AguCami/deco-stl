import { csg, fromManifold, type CrossSection, type Manifold, type ManifoldToplevel } from '../geometry/csg';
import { FONT_OPTIONS, loadFont } from '../text/fonts';
import { textOutline } from '../text/outline';
import { reader, type Generator } from './types';

type Keep = <O extends { delete(): void }>(o: O) => O;
type V2 = [number, number];

/** Rectángulo centrado con esquinas redondeadas. */
function roundedRect(m: ManifoldToplevel, keep: Keep, w: number, h: number, r: number): CrossSection {
  const rr = Math.max(0, Math.min(r, w / 2 - 0.1, h / 2 - 0.1));
  const core = keep(m.CrossSection.square([w - 2 * rr, h - 2 * rr], true));
  return rr > 0 ? keep(core.offset(rr, 'Round', 2, 48)) : core;
}

/** Trazo de ancho `2r` con puntas redondas que pasa por los puntos dados. */
function stroke(m: ManifoldToplevel, keep: Keep, pts: V2[], r: number): CrossSection {
  const dots = pts.map((p) => keep(keep(m.CrossSection.circle(r, 32)).translate(p)));
  const parts = dots.slice(1).map((d, i) => keep(m.CrossSection.hull([dots[i], d])));
  return keep(m.CrossSection.union(parts.length ? parts : dots));
}

function arc(cx: number, cy: number, r: number, from: number, to: number, n = 16): V2[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as V2;
  });
}

// ---------------------------------------------------------------------------
// Marco de fotos
// ---------------------------------------------------------------------------

const PHOTOS: Record<string, [number, number]> = {
  '9x13': [89, 127],
  '10x15': [102, 152],
  '13x18': [127, 178],
  '15x20': [152, 203],
};

export const photoFrame: Generator = {
  id: 'frame',
  name: 'Marco',
  description: 'Portarretratos que se imprime boca abajo, con rebaje trasero y base de apoyo opcional.',
  params: [
    {
      key: 'photo', label: 'Tamaño de foto', group: 'Foto', type: 'select', default: '10x15', fixed: true,
      options: [
        { value: '9x13', label: '9 × 13 cm' },
        { value: '10x15', label: '10 × 15 cm' },
        { value: '13x18', label: '13 × 18 cm' },
        { value: '15x20', label: '15 × 20 cm' },
      ],
    },
    {
      key: 'orient', label: 'Orientación', group: 'Foto', type: 'select', default: 'v', fixed: true,
      options: [
        { value: 'v', label: 'Vertical' },
        { value: 'h', label: 'Horizontal' },
      ],
    },
    { key: 'lip', label: 'Solapa sobre la foto', group: 'Foto', type: 'range', min: 3, max: 10, step: 0.5, default: 4, unit: 'mm', fixed: true },
    {
      key: 'style', label: 'Moldura', group: 'Forma', type: 'select', default: 'stepped',
      options: [
        { value: 'stepped', label: 'Escalonada (art déco)' },
        { value: 'chamfer', label: 'Biselada' },
        { value: 'flat', label: 'Plana' },
      ],
    },
    { key: 'border', label: 'Ancho del marco', group: 'Forma', type: 'range', min: 10, max: 40, step: 1, default: 20, unit: 'mm' },
    { key: 'thick', label: 'Grosor', group: 'Forma', type: 'range', min: 6, max: 16, step: 0.5, default: 9, unit: 'mm' },
    { key: 'corner', label: 'Radio de esquinas', group: 'Forma', type: 'range', min: 0, max: 20, step: 0.5, default: 4, unit: 'mm' },
    { key: 'stand', label: 'Incluir base de apoyo', group: 'Impresión', type: 'toggle', default: true, fixed: true, hint: 'Una pieza aparte con ranura inclinada 15° para parar el marco sobre un mueble.' },
  ],
  presets: [
    { name: 'Art déco', values: { style: 'stepped', border: 22, thick: 10, corner: 2 } },
    { name: 'Biselado fino', values: { style: 'chamfer', border: 14, thick: 8, corner: 1 } },
    { name: 'Redondeado', values: { style: 'flat', border: 18, thick: 8, corner: 14 } },
  ],
  build(v) {
    const { num, str, bool } = reader(v);
    let [pw, ph] = PHOTOS[str('photo')] ?? PHOTOS['10x15'];
    if (str('orient') === 'h') [pw, ph] = [ph, pw];
    const border = num('border');
    const T = num('thick');
    const lip = num('lip');
    const W = pw + 2 * border;
    const H = ph + 2 * border;
    const rebate = Math.min(3, T - 2.4); // foto + cartón trasero
    const style = str('style');

    return csg((m, keep) => {
      const outer = roundedRect(m, keep, W, H, num('corner'));
      const window = keep(m.CrossSection.square([pw - 2 * lip, ph - 2 * lip], true));
      const slab = (cs: CrossSection, z0: number, h: number) => keep(keep(cs.extrude(h)).translate([0, 0, z0]));

      // La cara frontal apoya en la cama (z = 0); la moldura se construye hacia arriba.
      const bodyParts: Manifold[] = [];
      const cutParts: Manifold[] = [slab(window, -1, T + 2)];
      if (style === 'stepped') {
        // Escalones art déco imprimibles boca abajo: cada escalón es un bisel a 45°
        // seguido de un tramo vertical, así nunca hay voladizos de más de 45°.
        const steps = 3;
        const s = Math.min(1.4, T / (2 * steps + 1), border / (steps + 3));
        const tiers = (section: (d: number) => CrossSection, into: Manifold[], cutter: boolean) => {
          for (let k = 0; k < steps; k++) {
            const z0 = 2 * k * s;
            const d0 = (steps - k) * s;
            const a = section(d0);
            const b = section(d0 - s);
            if (cutter && k === 0) into.push(slab(a, -1, 1.01));
            into.push(keep(m.Manifold.hull([slab(a, z0, 0.01), slab(b, z0 + s, 0.01)])));
            into.push(slab(b, z0 + s - 0.005, s + 0.01));
          }
        };
        tiers((d) => keep(outer.offset(-d, 'Round', 2, 48)), bodyParts, false);
        tiers((d) => keep(window.offset(d, 'Miter')), cutParts, true);
        bodyParts.push(slab(outer, 2 * steps * s - 0.005, T - 2 * steps * s + 0.005));
      } else if (style === 'chamfer') {
        const c = Math.min(3, T / 2.5, border / 3);
        bodyParts.push(keep(m.Manifold.hull([slab(keep(outer.offset(-c, 'Round')), 0, 0.01), slab(outer, c, T - c)])));
        cutParts.push(keep(m.Manifold.hull([slab(keep(window.offset(c, 'Miter')), -1, 1), slab(window, c, 0.01)])));
      } else {
        bodyParts.push(slab(outer, 0, T));
      }
      const pocket = keep(m.CrossSection.square([pw + 1, ph + 1], true));
      cutParts.push(slab(pocket, T - rebate, rebate + 1));

      let frame = keep(keep(m.Manifold.union(bodyParts)).subtract(keep(m.Manifold.union(cutParts))));

      if (bool('stand')) {
        // Base con ranura inclinada, ubicada delante del marco en la cama.
        const L = Math.min(W * 0.6, 110);
        const depth = 42;
        const baseH = 14;
        const block = keep(m.Manifold.cube([L, depth, baseH], true));
        const slot = keep(
          keep(keep(keep(m.Manifold.cube([L + 2, T + 0.6, 40], true)).translate([0, 0, 20])).rotate([-15, 0, 0])).translate([0, 4, -baseH / 2 + 4]),
        );
        const stand = keep(keep(block.subtract(slot)).translate([0, -H / 2 - 12 - depth / 2, baseH / 2]));
        frame = keep(frame.add(stand));
      }
      return fromManifold(frame);
    });
  },
};

// ---------------------------------------------------------------------------
// Ganchos de pared
// ---------------------------------------------------------------------------

export const wallHook: Generator = {
  id: 'hook',
  name: 'Gancho',
  description: 'Ganchos de pared para atornillar; se imprimen acostados para que sean resistentes.',
  params: [
    {
      key: 'style', label: 'Estilo', group: 'Forma', type: 'select', default: 'curved',
      options: [
        { value: 'curved', label: 'Curvo (J)' },
        { value: 'deco', label: 'Art déco angular' },
        { value: 'double', label: 'Doble (perchero)' },
      ],
    },
    { key: 'plate', label: 'Alto de la placa', group: 'Forma', type: 'range', min: 40, max: 140, step: 1, default: 70, unit: 'mm' },
    { key: 'reach', label: 'Largo del brazo', group: 'Forma', type: 'range', min: 20, max: 80, step: 1, default: 40, unit: 'mm' },
    { key: 'tip', label: 'Altura de la punta', group: 'Forma', type: 'range', min: 10, max: 60, step: 1, default: 24, unit: 'mm' },
    { key: 'thick', label: 'Grosor', group: 'Forma', type: 'range', min: 4, max: 12, step: 0.5, default: 7, unit: 'mm', fixed: true },
    { key: 'width', label: 'Ancho', group: 'Forma', type: 'range', min: 10, max: 40, step: 1, default: 18, unit: 'mm' },
    {
      key: 'holes', label: 'Agujeros para tornillo', group: 'Fijación', type: 'select', default: '1', fixed: true,
      options: [
        { value: '0', label: 'Ninguno (adhesivo)' },
        { value: '1', label: 'Uno' },
        { value: '2', label: 'Dos' },
      ],
    },
    { key: 'screw', label: 'Diámetro del tornillo', group: 'Fijación', type: 'range', min: 3, max: 5, step: 0.5, default: 4, unit: 'mm', fixed: true },
    { key: 'countersink', label: 'Avellanado', group: 'Fijación', type: 'toggle', default: true, fixed: true },
  ],
  presets: [
    { name: 'Curvo', values: { style: 'curved' } },
    { name: 'Art déco', values: { style: 'deco', reach: 38, tip: 22 } },
    { name: 'Perchero doble', values: { style: 'double', plate: 100, reach: 50, tip: 26, width: 22, holes: '2' } },
  ],
  build(v) {
    const { num, str, bool } = reader(v);
    const t = num('thick');
    const r = t / 2;
    const plateH = num('plate');
    const reach = Math.max(num('reach'), t * 2.5);
    const width = num('width');
    const style = str('style');
    const screw = num('screw');
    const holeY = plateH - Math.max(9, screw * 2.2);

    /** Brazo en J que sale de la placa a la altura y0. */
    const jPath = (y0: number, len: number, tipH: number): V2[] => {
      const R = Math.max(r * 1.2, Math.min(len - t, tipH) / 2);
      const cx = len - r - R;
      const pts: V2[] = [[r, y0 + r], [cx, y0 + r], ...arc(cx, y0 + r + R, R, -Math.PI / 2, 0).slice(1)];
      if (tipH > R + r) pts.push([len - r, y0 + tipH]);
      return pts;
    };

    return csg((m, keep) => {
      const parts: CrossSection[] = [];
      if (style === 'deco') {
        // Placa recta con remate escalonado y brazo en ángulo.
        parts.push(keep(keep(m.CrossSection.square([t, plateH])).translate([0, 0])));
        parts.push(keep(keep(m.CrossSection.square([3, 10])).translate([t - 0.1, plateH - 16])));
        parts.push(keep(keep(m.CrossSection.square([5.5, 5])).translate([t - 0.1, plateH - 13.5])));
        const tipH = Math.max(num('tip'), reach * 0.4 + t + 4);
        parts.push(stroke(m, keep, [[r, r], [reach * 0.6, r], [reach - r, r + reach * 0.4], [reach - r, tipH]], r));
      } else {
        parts.push(stroke(m, keep, [[r, r], [r, plateH - r]], r));
        parts.push(stroke(m, keep, jPath(0, reach, num('tip')), r));
        if (style === 'double') {
          const y0 = plateH * 0.4;
          const tip2 = Math.max(t + 4, Math.min(num('tip') * 0.7, holeY - y0 - screw * 2 - 4));
          parts.push(stroke(m, keep, jPath(y0, reach * 0.6, tip2), r));
        }
      }
      let hook = keep(keep(m.CrossSection.union(parts)).extrude(width));

      // Agujeros horizontales (eje X) que atraviesan la placa; la cabeza queda del lado del brazo.
      const n = Number(str('holes'));
      const zs = n === 2 && width >= 20 ? [width * 0.28, width * 0.72] : n >= 1 ? [width / 2] : [];
      const ys = n === 2 && width < 20 ? [holeY, holeY - Math.max(14, screw * 3.5)] : [holeY];
      const along = (h: number, r1: number, r2: number) => keep(keep(m.Manifold.cylinder(h, r1, r2, 32)).rotate([0, 90, 0]));
      for (const z of zs) {
        for (const y of ys) {
          const rd = screw / 2 + 0.2;
          hook = keep(hook.subtract(keep(along(t + 2, rd, rd).translate([-1, y, z]))));
          if (bool('countersink')) {
            const head = Math.min(screw, t - 1.2);
            const sink = Math.max(0, head - rd);
            if (sink > 0.3) hook = keep(hook.subtract(keep(along(sink + 0.01, rd, head).translate([t - sink, y, z]))));
          }
        }
      }
      return fromManifold(hook);
    });
  },
};

// ---------------------------------------------------------------------------
// Letras y carteles
// ---------------------------------------------------------------------------

export const letters: Generator = {
  id: 'letters',
  name: 'Letras',
  description: 'Nombres y palabras en 3D: letras unidas, sueltas o sobre una placa.',
  params: [
    { key: 'text', label: 'Texto', group: 'Texto', type: 'text', default: 'Hogar', maxLength: 40, multiline: true, placeholder: 'Escribí un nombre o una frase' },
    { key: 'font', label: 'Tipografía', group: 'Texto', type: 'select', options: FONT_OPTIONS, default: 'pacifico' },
    { key: 'size', label: 'Altura de letra', group: 'Texto', type: 'range', min: 10, max: 120, step: 1, default: 40, unit: 'mm' },
    { key: 'spacing', label: 'Espaciado', group: 'Texto', type: 'range', min: -3, max: 12, step: 0.5, default: 0, unit: 'mm' },
    {
      key: 'mode', label: 'Formato', group: 'Forma', type: 'select', default: 'joined',
      options: [
        { value: 'joined', label: 'Letras unidas (se paran solas)' },
        { value: 'loose', label: 'Letras sueltas' },
        { value: 'plate', label: 'Placa con texto' },
      ],
    },
    { key: 'depth', label: 'Espesor de las letras', group: 'Forma', type: 'range', min: 2, max: 30, step: 0.5, default: 8, unit: 'mm' },
    { key: 'bar', label: 'Alto de la barra de unión', group: 'Forma', type: 'range', min: 2, max: 12, step: 0.5, default: 4, unit: 'mm', hint: 'Sólo en "Letras unidas": una base bajo el renglón que une todas las letras.' },
    { key: 'margin', label: 'Margen de la placa', group: 'Placa', type: 'range', min: 3, max: 25, step: 0.5, default: 8, unit: 'mm' },
    { key: 'plateThick', label: 'Grosor de la placa', group: 'Placa', type: 'range', min: 2, max: 8, step: 0.2, default: 3, unit: 'mm', fixed: true },
    { key: 'engrave', label: 'Texto grabado en la placa', group: 'Placa', type: 'toggle', default: false, fixed: true },
    { key: 'hang', label: 'Agujeros para colgar', group: 'Placa', type: 'toggle', default: true, fixed: true },
  ],
  presets: [
    { name: 'Cursiva unida', values: { text: 'Hogar', font: 'pacifico', mode: 'joined', size: 40, depth: 8 } },
    { name: 'Letras bloque', values: { text: 'CASA', font: 'bebas', mode: 'loose', size: 70, depth: 16, spacing: 4 } },
    { name: 'Cartel art déco', values: { text: 'BIENVENIDOS', font: 'poiret', mode: 'plate', size: 20, depth: 1.6, margin: 10 } },
    { name: 'Retro', values: { text: 'Café', font: 'lobster', mode: 'joined', size: 45, depth: 8 } },
  ],
  async build(v) {
    const { num, str, bool } = reader(v);
    const font = await loadFont(str('font'));
    const outline = textOutline(font, str('text').trim() || 'Deco', num('size'), num('spacing'));
    return csg((m, keep) => {
      if (!outline) throw new Error('Texto vacío');
      const text = keep(new m.CrossSection(outline.contours, 'NonZero'));
      const depth = num('depth');
      const mode = str('mode');
      let solid: Manifold;
      if (mode === 'plate') {
        const margin = num('margin');
        const pt = num('plateThick');
        const W = outline.width + 2 * margin;
        const H = outline.height + 2 * margin;
        let plate = keep(roundedRect(m, keep, W, H, Math.min(margin * 0.8, H / 2)).extrude(pt));
        if (bool('hang') && margin >= 5) {
          for (const x of [-W / 2 + margin / 2, W / 2 - margin / 2]) {
            plate = keep(plate.subtract(keep(keep(m.Manifold.cylinder(pt + 2, Math.min(2.2, margin / 3), undefined, 24)).translate([x, 0, -1]))));
          }
        }
        if (bool('engrave')) {
          const cut = Math.min(depth, pt - 0.8);
          solid = keep(plate.subtract(keep(keep(text.extrude(pt)).translate([0, 0, pt - cut]))));
        } else {
          solid = keep(plate.add(keep(keep(text.extrude(pt + depth - 0.2)).translate([0, 0, 0.2]))));
        }
      } else if (mode === 'joined') {
        // Una barra bajo cada renglón une las letras para que formen una sola pieza.
        const bar = num('bar');
        const overlap = Math.min(bar * 0.6, num('size') * 0.12);
        const bars = outline.lines.map(({ baseline, width }) => {
          const w = Math.max(4, width - num('size') * 0.15);
          return keep(keep(m.CrossSection.square([w, bar])).translate([-w / 2, baseline - bar + overlap]));
        });
        solid = keep(keep(m.CrossSection.union([text, ...bars])).extrude(depth));
      } else {
        solid = keep(text.extrude(depth));
      }
      return fromManifold(solid);
    });
  },
};
