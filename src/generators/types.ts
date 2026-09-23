import type { MeshData } from '../geometry/mesh';

interface BaseParam {
  key: string;
  label: string;
  /** Sección del panel en la que se agrupa el control. */
  group?: string;
  /** Excluir del botón "Sorprendeme". */
  fixed?: boolean;
  hint?: string;
}

export interface RangeParam extends BaseParam {
  type: 'range';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface SelectParam extends BaseParam {
  type: 'select';
  options: { value: string; label: string }[];
  default: string;
}

export interface ToggleParam extends BaseParam {
  type: 'toggle';
  default: boolean;
}

export type Param = RangeParam | SelectParam | ToggleParam;
export type Values = Record<string, number | string | boolean>;

export interface Preset {
  name: string;
  values: Values;
}

export interface Generator {
  id: string;
  name: string;
  description: string;
  params: Param[];
  presets: Preset[];
  build(values: Values): MeshData;
}

export function defaults(g: Generator): Values {
  return Object.fromEntries(g.params.map((p) => [p.key, p.default]));
}

/** Completa y valida valores (p. ej. los que vienen de un enlace compartido). */
export function sanitize(g: Generator, input: Values): Values {
  const out = defaults(g);
  for (const p of g.params) {
    const v = input[p.key];
    if (p.type === 'range' && typeof v === 'number' && Number.isFinite(v)) {
      out[p.key] = Math.min(p.max, Math.max(p.min, v));
    } else if (p.type === 'select' && typeof v === 'string' && p.options.some((o) => o.value === v)) {
      out[p.key] = v;
    } else if (p.type === 'toggle' && typeof v === 'boolean') {
      out[p.key] = v;
    }
  }
  return out;
}

export function randomize(g: Generator, current: Values, rand = Math.random): Values {
  const out = { ...current };
  for (const p of g.params) {
    if (p.fixed) continue;
    if (p.type === 'range') {
      const steps = Math.round((p.max - p.min) / p.step);
      out[p.key] = +(p.min + Math.round(rand() * steps) * p.step).toFixed(4);
    } else if (p.type === 'select') {
      out[p.key] = p.options[Math.floor(rand() * p.options.length)].value;
    }
  }
  return out;
}

/** Lector tipado de valores. */
export function reader(v: Values) {
  return {
    num: (k: string) => Number(v[k]),
    str: (k: string) => String(v[k]),
    bool: (k: string) => Boolean(v[k]),
  };
}
