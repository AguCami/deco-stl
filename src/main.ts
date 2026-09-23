import './style.css';
import { GENERATORS, findGenerator } from './generators';
import { defaults, randomize, sanitize, type Generator, type Values } from './generators/types';
import { analyze, type MeshData, type MeshStats } from './geometry/mesh';
import { downloadSTL } from './export/stl';
import { Viewer } from './viewer';
import { renderGenerators, renderParams, renderPresets, renderSwatches, toast } from './ui';

const COLORS: [string, string][] = [
  ['Arena', '#d9c7a7'],
  ['Blanco hueso', '#eee8dc'],
  ['Terracota', '#c46a4a'],
  ['Salvia', '#9caf88'],
  ['Rosa empolvado', '#e2a9a1'],
  ['Azul petróleo', '#2f5d6b'],
  ['Mostaza', '#d4a238'],
  ['Carbón', '#3a3a3f'],
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const viewer = new Viewer($('viewport'));
let gen: Generator = GENERATORS[0];
let values: Values = defaults(gen);
let mesh: MeshData | null = null;
let color = COLORS[0][1];
let building = false;
let queued: { reframe: boolean } | null = null;

/** Valores iniciales de un tipo: sus parámetros por defecto con el primer estilo aplicado. */
const starter = (g: Generator) => sanitize(g, { ...defaults(g), ...g.presets[0]?.values });

function readHash(): boolean {
  const [id, encoded] = location.hash.slice(1).split(':');
  const g = findGenerator(id);
  if (!g) return false;
  gen = g;
  try {
    values = encoded ? sanitize(g, JSON.parse(decodeURIComponent(encoded))) : starter(g);
  } catch {
    values = starter(g);
  }
  return true;
}

function writeHash() {
  const base = defaults(gen);
  const diff = Object.fromEntries(Object.entries(values).filter(([k, v]) => base[k] !== v));
  history.replaceState(null, '', `#${gen.id}:${encodeURIComponent(JSON.stringify(diff))}`);
}

function renderStats(s: MeshStats) {
  const [x, y, z] = s.size.map((v) => v.toFixed(0));
  const grams = (s.volume / 1000) * 1.24;
  const warnings: string[] = [];
  if (Math.max(...s.size) > 256) warnings.push('Supera los 256 mm: revisá el volumen de tu impresora.');
  if (s.overhang > 0.08) warnings.push(`Voladizos > 45° en ${(s.overhang * 100).toFixed(0)} % de la superficie: puede necesitar soportes.`);
  const wall = values.wall;
  if (typeof wall === 'number' && wall < 1.2) warnings.push('Pared fina: usá boquilla de 0,4 mm y al menos 2 perímetros.');
  $('stats').innerHTML = `
    <dl>
      <div><dt>Tamaño</dt><dd>${x} × ${y} × ${z} mm</dd></div>
      <div><dt>Material</dt><dd>≈ ${grams.toFixed(0)} g PLA</dd></div>
      <div><dt>Triángulos</dt><dd>${s.triangles.toLocaleString('es')}</dd></div>
    </dl>
    ${warnings.map((w) => `<p class="warn">${w}</p>`).join('')}`;
}

/**
 * Regenera la pieza. Si ya hay una generación en curso (las que llevan texto
 * pueden tardar), se encola sólo la última petición.
 */
async function rebuild(reframe = false) {
  if (building) {
    queued = { reframe: reframe || (queued?.reframe ?? false) };
    return;
  }
  building = true;
  const stage = $('viewport').parentElement!;
  const slow = setTimeout(() => stage.classList.add('busy'), 150);
  try {
    await new Promise(requestAnimationFrame);
    const next = await gen.build(values);
    mesh = next;
    viewer.setMesh(next);
    if (reframe) viewer.frame();
    renderStats(analyze(next));
    writeHash();
  } catch (err) {
    console.error(err);
    toast($('toast'), 'No se pudo generar con estos valores; probá cambiar alguno.');
  } finally {
    clearTimeout(slow);
    stage.classList.remove('busy');
    building = false;
    if (queued) {
      const q = queued;
      queued = null;
      void rebuild(q.reframe);
    }
  }
}

function renderForm() {
  renderParams($('params'), gen, values, (key, v) => {
    values = { ...values, [key]: v };
    rebuild();
  });
}

function selectGenerator(g: Generator, initial?: Values) {
  gen = g;
  values = initial ?? starter(g);
  renderGenerators($('generators'), GENERATORS, g.id, (next) => next !== gen && selectGenerator(next));
  renderPresets($('presets'), g, (preset) => {
    values = sanitize(gen, { ...defaults(gen), ...preset });
    renderForm();
    rebuild(true);
  });
  renderForm();
  rebuild(true);
}

function pickColor(hex: string) {
  color = hex;
  viewer.setColor(hex);
  renderSwatches($('colors'), COLORS, color, pickColor);
}

$('random').addEventListener('click', () => {
  values = randomize(gen, values);
  renderForm();
  rebuild(true);
});
$('reset').addEventListener('click', () => selectGenerator(gen));
$('share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast($('toast'), 'Enlace copiado: compartí tu diseño.');
  } catch {
    toast($('toast'), 'No se pudo copiar; copiá la dirección del navegador.');
  }
});
$('download').addEventListener('click', () => {
  if (!mesh) return;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadSTL(mesh, `deco-${gen.id}-${stamp}.stl`);
  toast($('toast'), 'STL descargado. ¡A imprimir!');
});
window.addEventListener('hashchange', () => {
  if (readHash()) selectGenerator(gen, values);
});

pickColor(color);
if (readHash()) selectGenerator(gen, values);
else selectGenerator(gen);
