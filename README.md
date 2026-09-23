# Deco STL

Web app para diseñar objetos decorativos paramétricos y descargarlos como **STL listos para imprimir en 3D**. Todo corre en el navegador: no hay servidor ni cuentas.

## Qué se puede generar

| Objeto | Qué ajustar |
| --- | --- |
| **Jarrón** | Perfil (4 radios + alturas), lados, giro, texturas (estrías, gallones, diamantes, anillos, ondas, burbujas), modo sólido para "vase mode" |
| **Maceta** | Lo mismo + agujero de drenaje |
| **Portavelas** | Hueco a medida para tealight, tealight maxi, vela cónica o pilar |
| **Cuenco** | Cuencos y vaciabolsillos |
| **Pantalla** | Tubo abierto para lámparas LED |
| **Posavasos** | Contorno circular/poligonal, relieves (mandala, flor, sol, espiral, anillos, ondas), reborde |
| **Panel 3D** | Azulejos de pared: hexágonos, pirámides, diamantes, burbujas, escamas, ondas |
| **Portalápices** | Organizador de escritorio con las mismas formas y texturas que los jarrones |
| **Marco** | Portarretratos 9×13 a 15×20 cm, moldura escalonada art déco, biselada o plana; rebaje trasero y base de apoyo opcional. Se imprime boca abajo sin soportes |
| **Gancho** | Ganchos de pared curvos, art déco o dobles, con agujeros avellanados; se imprimen acostados para mayor resistencia |
| **Letras** | Nombres y frases en 3D: letras unidas por una barra (se paran solas), sueltas o sobre una placa con agujeros para colgar |

**Texto en relieve o grabado**: jarrones, macetas, portavelas, cuencos, pantallas, portalápices, posavasos y paneles aceptan un texto. En los recipientes se envuelve sobre la superficie siguiendo la forma (incluso facetada o con giro). Tipografías incluidas: Righteous, Poiret One, Bebas Neue, Pacifico y Lobster.

Cada tipo trae estilos predefinidos, un botón **Sorprendeme** para variaciones aleatorias y **Copiar enlace** para compartir el diseño exacto (queda guardado en la URL).

Las piezas se generan siempre como **sólidos cerrados (estancos) con normales hacia afuera**, sobre el plano Z = 0 y en milímetros, así que el slicer (Cura, PrusaSlicer, Bambu Studio, OrcaSlicer…) las abre sin reparaciones. La vista previa muestra tamaño, gramos aproximados de PLA y avisos (tamaño mayor a 256 mm, voladizos, paredes finas).

## Desarrollo

```bash
npm install
npm run dev       # servidor local en http://localhost:5173
npm test          # verifica que todas las piezas y estilos sean sólidos cerrados
npm run build     # genera la versión estática en dist/
```

La carpeta `dist/` es un sitio estático: se puede publicar en GitHub Pages, Netlify, Vercel o cualquier hosting.

### Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` corre los tests y el build en cada push, y publica `dist/` en GitHub Pages cuando el push es a la rama principal. Para activarlo una única vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**. La app queda en `https://<usuario>.github.io/deco-stl/`.

## Cómo se garantiza que el STL sea imprimible

- Las formas base (recipientes, placas con relieve) se construyen directamente como sólidos cerrados.
- El texto y las piezas compuestas usan booleanas de [manifold](https://github.com/elalish/manifold) (WASM), que siempre devuelven una malla válida aunque los cuerpos se superpongan (por ejemplo, letras cursivas).
- Los tests generan cada objeto con sus estilos, valores aleatorios y texto, y verifican que la malla sea cerrada y orientada; también que marcos, letras, ganchos, posavasos y paneles no tengan voladizos de más de 45°.

## Estructura

```
src/
  geometry/   mesh.ts (constructor de mallas + análisis), shell.ts (recipientes),
              slab.ts (placas con relieve), profile.ts (perfiles y texturas),
              csg.ts (booleanas con manifold-3d)
  text/       fonts.ts (tipografías), outline.ts (texto → contornos)
  assets/fonts/  tipografías TTF con su licencia OFL
  generators/ vessels.ts, slabs.ts, objects.ts (marco, gancho, letras), text.ts (texto sobre piezas);
              cada generador declara parámetros, estilos y build() (puede ser async)
  export/     stl.ts (STL binario)
  viewer.ts   vista 3D con three.js
  ui.ts, main.ts
tests/        chequeo de estanqueidad para todos los generadores
```

### Agregar un objeto nuevo

1. Crear un `Generator` (ver `src/generators/types.ts`): lista de `params`, `presets` y `build(values)` que devuelva un `MeshData`.
2. Construir la malla con `MeshBuilder` o reutilizar `buildShell`, `buildPolarSlab` o `buildRectSlab`.
3. Registrarlo en `src/generators/index.ts` (y opcionalmente un ícono en `src/ui.ts`). Los tests lo cubren automáticamente.

## Licencias de terceros

Las tipografías de `src/assets/fonts/` se distribuyen bajo la SIL Open Font License 1.1 (ver los archivos `OFL-*.txt` junto a cada una).
