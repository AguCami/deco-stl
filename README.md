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

## Estructura

```
src/
  geometry/   mesh.ts (constructor de mallas + análisis), shell.ts (recipientes),
              slab.ts (placas con relieve), profile.ts (perfiles y texturas)
  generators/ un archivo por familia; cada generador declara parámetros, estilos y build()
  export/     stl.ts (STL binario)
  viewer.ts   vista 3D con three.js
  ui.ts, main.ts
tests/        chequeo de estanqueidad para todos los generadores
```

### Agregar un objeto nuevo

1. Crear un `Generator` (ver `src/generators/types.ts`): lista de `params`, `presets` y `build(values)` que devuelva un `MeshData`.
2. Construir la malla con `MeshBuilder` o reutilizar `buildShell`, `buildPolarSlab` o `buildRectSlab`.
3. Registrarlo en `src/generators/index.ts` (y opcionalmente un ícono en `src/ui.ts`). Los tests lo cubren automáticamente.
