# PENSAMIENTOS INTRUSIVOS: motor de la serie

Serie vertical de sátira y humor absurdo. Cada episodio muestra pensamientos intrusivos **inventados** de una
**versión ficticia y caricaturesca** de un personaje famoso. Todo el vídeo lleva el cartel `PARODIA · FICCIÓN`.
Nada de lo que aparece son pensamientos, declaraciones ni hechos reales de nadie.

- **Stack:** [Remotion](https://www.remotion.dev) (vídeo hecho con React). Es reproducible: el mismo `episode.json` produce siempre el mismo vídeo.
- **Formato:** 1080×1920, 9:16, 30 fps, H.264 + AAC. Sube directo a TikTok o Reels.
- **Estética:** recortes de cartulina, rotulador, fotocopia, animación a pocas poses. Todo está dibujado por código: sin IA generativa y sin bancos de imágenes.

## Renderizar

```bash
cd pensamientos-intrusivos
npm install --legacy-peer-deps      # solo la primera vez
./render ep01_felipe_vi             # → output/pensamientos_intrusivos_ep01.mp4  (~5 min)
```

Para iterar rápido:

```bash
npm run render -- ep01_felipe_vi --stills         # fotogramas clave en episodes/ep01_felipe_vi/generated/
scripts/contact.sh ep01_felipe_vi                 # hoja de contactos con todos los stills
npm run render -- ep01_felipe_vi --frames=0-299   # solo un tramo
npm run studio                                    # editor visual en el navegador (timeline)
```

## Estructura

```
episodes/
  _shared/sfx/           biblioteca de sonidos (generada con `npm run sfx`, sustituible por .wav reales)
  ep01_felipe_vi/
    episode.json         EL EPISODIO ENTERO: guion, tiempos, cámara, manos, garabatos, sonido
    audio/               voz grabada y sonidos propios del episodio
    images/              recortes fotográficos (PNG con transparencia)
    doodles/             garabatos escaneados (PNG)
    generated/           stills de revisión (no se versionan)
src/engine/              el motor, que no sabe nada de ningún episodio concreto
  camera.ts              cámara POV
  hands.tsx              manos
  doodles.tsx            capa de pensamiento intrusivo
  subtitles.tsx          subtítulos de papel pegado
  audio.tsx              buses de sonido
  animations.ts          presets de animación "mala a propósito"
  motion.ts              keyframes escalonados, aleatorio determinista, zonas seguras
  look.tsx               rotulador, recorte con borde blanco, fotocopia, tembleque
src/assets/              decorados, props y personajes dibujados (registry.tsx = lo que el JSON puede nombrar)
scripts/render.mjs       comando de render (valida el JSON antes)
```

## Reglas de la serie (el motor las da por hechas)

1. **POV siempre.** La cámara son los ojos del protagonista. Del protagonista solo se ven sus manos y mangas.
2. **Animación limitada.** Por defecto los keyframes son **escalonados**: se mantiene una pose hasta la siguiente, sin interpolar. `"ease": "jerk"` hace la transición en 3 saltos. `"linear"` existe, pero no se usa.
3. **Silencio como remate.** Las pistas se cortan en seco con `until`.
4. **Nunca dos garabatos idénticos.** Cada uno recibe una semilla propia y todos tiemblan ("boil") cada 3 frames.
5. **Zonas seguras** (`SAFE` en `motion.ts`): nada importante por encima de y=230, por debajo de y=1500 ni a la derecha de x=910.

## Crear un episodio nuevo

1. Copia `episodes/ep01_felipe_vi` como `episodes/ep02_loquesea`, vacía `audio/` e `images/` y edita `episode.json`.
2. Si el decorado es nuevo, tienes dos caminos:
   - rápido, sin código: `"background": { "set": "paper" }` más recortes fotográficos `"asset": "image:images/foto.png"`;
   - dibujado: un componente nuevo en `src/assets/` registrado en `SETS` / `PROPS` de `registry.tsx`.
3. `./render ep02_loquesea`

## Referencia de `episode.json`

Tiempos en **segundos**. Dentro de una escena, `at`, `until` y `t` cuentan **desde el inicio de la escena**. En `tracks` son absolutos.

| Campo de episodio | Qué es |
|---|---|
| `title`, `character`, `duration` | obligatorios |
| `output` | nombre del MP4 |
| `disclaimer` | cartel permanente (usar siempre `PARODIA · FICCIÓN`) |
| `subtitleY` | altura por defecto de los subtítulos |
| `mix` | ganancia por bus: `VOICE`, `AMBIENCE`, `FOLEY`, `COMEDY_SFX`, `MUSIC` |
| `tracks` | pistas continuas que cruzan escenas (ambiente, alarma…) |
| `scenes` | lista de escenas |

| Campo de escena | Qué es |
|---|---|
| `start`, `end` | segundos absolutos |
| `background` | `{ set, props, lighting: [{t, level}], alarm: {at, until, period} }` |
| `camera` | movimientos POV (tabla abajo) |
| `hands` | `{ side: left/right, x, y, rot, scale, pose, tremble, keys[] }` |
| `props`, `characters` | `{ id, asset, x, y, scale, rot, pose, at, until, keys[], props }` |
| `doodles` | garabatos (tabla abajo) |
| `subtitle` | `{ text, at, until, style: thought/shout/whisper, words: {palabra: fx}, y, size }` |
| `voice`, `sfx` | `{ sound, at, until, bus, volume, loop, rate, trimStart }` |
| `animations` | `{ target: id, preset, at, dur, amount }` |
| `note` | intención cómica de la escena (documentación) |

**Cámara POV:** `POV_LOOK_LEFT`, `POV_LOOK_RIGHT`, `POV_LOOK_DOWN`, `POV_LOOK_UP` (`amount`, `dur`, `steps`, `returnAt`),
`POV_MICRO_SHAKE`, `POV_PANIC` (`amount`, `until`), `POV_DOUBLE_TAKE` (`direction`, `target`, `zoom`),
`POV_SLOW_APPROACH` (zoom a saltos hacia `target`), `POV_SNAP_ZOOM` (zoom seco, 1 o 2 poses),
`POV_FREEZE` (congela el mundo; pensamientos y sonido siguen).

**Manos:** `HAND_LEFT` / `HAND_RIGHT` = `side` + `pose: "rest"`; `HAND_POINT` = `point`; `HAND_PRESS` = `press`;
`HAND_GRAB` = `grab`; `HAND_NERVOUS` = `nervous` (tamborilea); `HAND_HIDE` = `hide`.
Para sustituir el dibujo por una mano propia: `"asset": "image:images/mano.png"`.

**Garabatos:** `DOODLE_ARROW` (`to`, `text`), `DOODLE_CIRCLE`, `DOODLE_EYES`, `DOODLE_TEXT` (`text`, `size`),
`DOODLE_SHAKE`, `DOODLE_HALO`, `DOODLE_DEVIL`, `DOODLE_QUESTION`, `DOODLE_TARGET`, `DOODLE_IMAGE` (`src` en `doodles/`).
Todos admiten `draw` (segundos que tarda en dibujarse, a saltos), `color`, `rot`, `scale` y `space`.
Con `space: "world"` el garabato va pegado a la escena y sigue a la cámara; con `"screen"` se queda pegado al cristal.

**Efectos por palabra en subtítulos:** `grow`, `shake`, `tilt`, `vanish`, `strike`, `arrow`, `tiny`.

**Presets de animación:** `fall`, `drop_in`, `pop_in`, `slide_in_left`, `slide_in_right`, `shake`, `squash`, `flicker`, `wobble`.

**Sonidos de biblioteca:** `click`, `bonk`, `metal_clang`, `clonk`, `cheap_trumpet`, `bad_applause`, `angel_choir`, `alarm`,
`paper`, `chair`, `footsteps`, `electrical_failure`, `dramatic_hit`, `tiny_pop`, `whoosh_cheap`, `cough`,
`crash_distant`, `room_tone`, `speech_murmur`, `shout_who`. Están sintetizados en `scripts/gen-sfx.mjs`.
Para usar una grabación real basta con dejar un `.wav` con el mismo nombre en `episodes/_shared/sfx/`.

## Voz

EP01 funciona sin voz: los pensamientos se leen y el sonido carga el ritmo. Para añadir voz en off, graba cada frase
(`audio/no_1.wav`…) y añádela a la escena:

```json
"voice": [{ "sound": "audio/no_1.wav", "at": 0.7, "line": "No." }]
```

No se usan clones ni imitaciones de la voz de personas reales.

## Licencia de Remotion

Remotion es gratis para particulares y empresas de hasta 3 personas. Por encima hace falta licencia de empresa (remotion.pro).
