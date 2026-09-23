import type { Generator, Param, Values } from './generators/types';

const ICONS: Record<string, string> = {
  vase: 'M9 3h6v2c0 1.5 4 3.5 4 8.5S16.5 21 15 21H9c-1.5 0-4-2.5-4-7.5S9 6.5 9 5z',
  planter: 'M4 5h16M5.5 5l1.8 15h9.4L18.5 5M8 9h8',
  candle: 'M12 3c1.5 2 1.5 3.2 0 4.5C10.5 6.2 10.5 5 12 3zM5 11h14l-1.5 9h-11zM9 11v-1.5h6V11',
  bowl: 'M3 9h18c0 5.5-4 10-9 10S3 14.5 3 9zM9 19h6',
  lampshade: 'M8 3h8l4 13H4zM12 16v5M9 21h6',
  coaster: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  panel: 'M3 3h18v18H3zM8 7l3 1.7v3.5L8 14l-3-1.8V8.7zM16 7l3 1.7v3.5L16 14l-3-1.8V8.7zM12 14l3 1.7V19M9 19v-3.3l3-1.7',
};

export function renderGenerators(root: HTMLElement, gens: Generator[], active: string, onPick: (g: Generator) => void) {
  root.replaceChildren(
    ...gens.map((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gen' + (g.id === active ? ' active' : '');
      b.title = g.description;
      b.setAttribute('aria-pressed', String(g.id === active));
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[g.id] ?? ''}"/></svg><span>${g.name}</span>`;
      b.addEventListener('click', () => onPick(g));
      return b;
    }),
  );
}

export function renderPresets(root: HTMLElement, g: Generator, onPick: (values: Values) => void) {
  root.replaceChildren(
    ...g.presets.map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = p.name;
      b.addEventListener('click', () => onPick(p.values));
      return b;
    }),
  );
}

const fmt = (p: Param & { type: 'range' }, v: number) => {
  const decimals = p.step < 1 ? String(p.step).split('.')[1]?.length ?? 1 : 0;
  return v.toFixed(decimals);
};

function control(p: Param, value: Values[string], onChange: (v: Values[string]) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = `field field-${p.type}`;
  const id = `p-${p.key}`;

  if (p.type === 'toggle') {
    row.innerHTML = `<label class="toggle" for="${id}"><input id="${id}" type="checkbox"><span>${p.label}</span></label>`;
    const input = row.querySelector('input')!;
    input.checked = Boolean(value);
    input.addEventListener('change', () => onChange(input.checked));
  } else if (p.type === 'select') {
    row.innerHTML = `<label for="${id}">${p.label}</label><select id="${id}"></select>`;
    const sel = row.querySelector('select')!;
    for (const o of p.options) sel.add(new Option(o.label, o.value, false, o.value === value));
    sel.addEventListener('change', () => onChange(sel.value));
  } else {
    row.innerHTML = `
      <div class="field-head">
        <label for="${id}">${p.label}</label>
        <span class="num"><input type="number" aria-label="${p.label}" min="${p.min}" max="${p.max}" step="${p.step}">${p.unit ? `<small>${p.unit}</small>` : ''}</span>
      </div>
      <input id="${id}" type="range" min="${p.min}" max="${p.max}" step="${p.step}">`;
    const range = row.querySelector<HTMLInputElement>('input[type=range]')!;
    const num = row.querySelector<HTMLInputElement>('input[type=number]')!;
    const set = (v: number) => {
      range.value = String(v);
      num.value = fmt(p, v);
      range.style.setProperty('--fill', `${((v - p.min) / (p.max - p.min)) * 100}%`);
    };
    set(Number(value));
    range.addEventListener('input', () => {
      set(Number(range.value));
      onChange(Number(range.value));
    });
    num.addEventListener('change', () => {
      const v = Math.min(p.max, Math.max(p.min, Number(num.value) || p.min));
      set(v);
      onChange(v);
    });
  }
  if (p.hint) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = p.hint;
    row.appendChild(hint);
  }
  return row;
}

export function renderParams(root: HTMLElement, g: Generator, values: Values, onChange: (key: string, v: Values[string]) => void) {
  const groups = new Map<string, HTMLElement>();
  root.replaceChildren();
  for (const p of g.params) {
    const name = p.group ?? 'General';
    let body = groups.get(name);
    if (!body) {
      const details = document.createElement('details');
      details.className = 'block group';
      details.open = true;
      details.innerHTML = `<summary><h2>${name}</h2></summary><div class="group-body"></div>`;
      root.appendChild(details);
      body = details.querySelector<HTMLElement>('.group-body')!;
      groups.set(name, body);
    }
    body.appendChild(control(p, values[p.key], (v) => onChange(p.key, v)));
  }
}

export function renderSwatches(root: HTMLElement, colors: [string, string][], active: string, onPick: (hex: string) => void) {
  root.replaceChildren(
    ...colors.map(([name, hex]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (hex === active ? ' active' : '');
      b.style.background = hex;
      b.title = name;
      b.setAttribute('aria-label', name);
      b.addEventListener('click', () => onPick(hex));
      return b;
    }),
  );
}

let toastTimer = 0;
export function toast(el: HTMLElement, message: string) {
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2200);
}
