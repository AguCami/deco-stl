import type { Font } from 'opentype.js';

export type Vec2 = [number, number];

export interface TextOutline {
  /** Contornos cerrados en mm, centrados en el origen, eje Y hacia arriba. */
  contours: Vec2[][];
  width: number;
  height: number;
  /** Por renglón: posición Y de la línea base (tras centrar) y ancho. */
  lines: { baseline: number; width: number }[];
}

/**
 * Convierte un texto en contornos poligonales. Las curvas se subdividen con
 * segmentos de ~`tolerance` mm. Los contornos se deben rellenar con la regla
 * NonZero (así las letras cursivas que se superponen quedan unidas).
 * `size` es la altura de las mayúsculas en mm.
 */
export function textOutline(font: Font, text: string, size: number, spacing = 0, tolerance = 0.25): TextOutline | null {
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.length);
  if (!lines.length) return null;

  const capHeight = (font.tables.os2 as { sCapHeight?: number } | undefined)?.sCapHeight || font.unitsPerEm * 0.7;
  const em = (size * font.unitsPerEm) / capHeight;
  const lineGap = size * 1.45;

  const contours: Vec2[][] = [];
  const widths: number[] = [];
  lines.forEach((line, row) => {
    const path = font.getPath(line, 0, row * lineGap, em, { kerning: true, letterSpacing: spacing / em });
    // Cada renglón se centra horizontalmente.
    const bb = path.getBoundingBox();
    const dx = -(bb.x1 + bb.x2) / 2;
    widths.push(bb.x2 - bb.x1);
    let current: Vec2[] = [];
    let x0 = 0, y0 = 0;
    const flush = () => {
      if (current.length >= 3) contours.push(current);
      current = [];
    };
    const push = (x: number, y: number) => {
      const last = current[current.length - 1];
      if (!last || Math.hypot(last[0] - x - dx, last[1] + y) > 1e-4) current.push([x + dx, -y]);
    };
    const steps = (len: number) => Math.min(24, Math.max(2, Math.ceil(len / tolerance)));
    for (const c of path.commands) {
      switch (c.type) {
        case 'M':
          flush();
          push(c.x, c.y);
          break;
        case 'L':
          push(c.x, c.y);
          break;
        case 'Q': {
          const n = steps(Math.hypot(c.x1 - x0, c.y1 - y0) + Math.hypot(c.x - c.x1, c.y - c.y1));
          for (let i = 1; i <= n; i++) {
            const t = i / n, u = 1 - t;
            push(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y);
          }
          break;
        }
        case 'C': {
          const n = steps(
            Math.hypot(c.x1 - x0, c.y1 - y0) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2),
          );
          for (let i = 1; i <= n; i++) {
            const t = i / n, u = 1 - t;
            push(
              u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
              u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
            );
          }
          break;
        }
        case 'Z':
          flush();
          break;
      }
      if (c.type !== 'Z') {
        x0 = c.x;
        y0 = c.y;
      }
    }
    flush();
  });

  // Quitar el punto de cierre duplicado y centrar.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of contours) {
    const a = poly[0], b = poly[poly.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) poly.pop();
    for (const [x, y] of poly) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const valid = contours.filter((p) => p.length >= 3);
  if (!valid.length) return null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  for (const poly of valid) for (const p of poly) { p[0] -= cx; p[1] -= cy; }
  const rows = lines.map((_, row) => ({ baseline: -row * lineGap - cy, width: widths[row] }));
  return { contours: valid, width: maxX - minX, height: maxY - minY, lines: rows };
}
