/** Tipografías libres (SIL Open Font License) incluidas en src/assets/fonts. */
import { parse, type Font } from 'opentype.js';
import bebas from '../assets/fonts/BebasNeue-Regular.ttf?url';
import righteous from '../assets/fonts/Righteous-Regular.ttf?url';
import poiret from '../assets/fonts/PoiretOne-Regular.ttf?url';
import pacifico from '../assets/fonts/Pacifico-Regular.ttf?url';
import lobster from '../assets/fonts/Lobster-Regular.ttf?url';

export const FONTS = [
  { value: 'righteous', label: 'Righteous (deco redondeada)', url: righteous, file: 'Righteous-Regular.ttf' },
  { value: 'poiret', label: 'Poiret One (art déco fina)', url: poiret, file: 'PoiretOne-Regular.ttf' },
  { value: 'bebas', label: 'Bebas Neue (mayúsculas)', url: bebas, file: 'BebasNeue-Regular.ttf' },
  { value: 'pacifico', label: 'Pacifico (cursiva)', url: pacifico, file: 'Pacifico-Regular.ttf' },
  { value: 'lobster', label: 'Lobster (retro)', url: lobster, file: 'Lobster-Regular.ttf' },
] as const;

export const FONT_OPTIONS = FONTS.map(({ value, label }) => ({ value, label }));

/** Cómo obtener los bytes de una fuente; los tests lo reemplazan para leer del disco. */
let readFont = async (f: (typeof FONTS)[number]): Promise<ArrayBuffer> => {
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`No se pudo cargar la fuente ${f.file}`);
  return res.arrayBuffer();
};

export function setFontReader(fn: typeof readFont) {
  readFont = fn;
}

const cache = new Map<string, Promise<Font>>();

export function loadFont(id: string): Promise<Font> {
  const f = FONTS.find((x) => x.value === id) ?? FONTS[0];
  let p = cache.get(f.value);
  if (!p) {
    p = readFont(f).then((buf) => parse(buf));
    p.catch(() => cache.delete(f.value));
    cache.set(f.value, p);
  }
  return p;
}
