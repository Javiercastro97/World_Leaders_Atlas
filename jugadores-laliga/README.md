# Jugadores de LaLiga EA Sports — PNG

Carpeta destino de los PNG (fondo transparente) de todos los jugadores
de Primera División.

## Cómo llenarla

Colócate en la carpeta donde quieras los PNG y lanza el script:

```
node scripts/descargar-jugadores-laliga.mjs
```

La carpeta `jugadores-laliga/` se crea en el **directorio actual**, no junto
al script, así que da igual desde dónde lo ejecutes o dónde guardes el fichero.

No hay que instalar nada: solo Node 18 o superior. Tarda un par de minutos.

## Qué queda dentro

```
jugadores-laliga/
├── real-madrid/
│   ├── vinicius-jr.png
│   └── ...
├── fc-barcelona/
│   └── ...
└── indice.json
```

Una carpeta por equipo, un PNG por jugador, y un `indice.json` con el
nombre, nombre completo, equipo, posición y fichero de cada uno.

## Detalles

- **Fuente**: API pública de LaLiga Fantasy (`api-fantasy.llt-services.com`),
  imágenes servidas desde `assets-fantasy.llt-services.com` a 256×256.
- **Reanudable**: si lo cortas o algún jugador falla, vuelve a lanzarlo.
  Salta los que ya estén descargados y reintenta solo los que faltan.
- **Los PNG no se suben a git** (ver `.gitignore`): son varios cientos de
  binarios y no forman parte del atlas político. Cada uno los genera en local.
  Si algún día quieres versionarlos, borra la regla `jugadores-laliga/**/*.png`
  del `.gitignore`.
