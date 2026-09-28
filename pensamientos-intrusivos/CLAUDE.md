# PENSAMIENTOS INTRUSIVOS — contexto para Claude Code

Subproyecto independiente del Atlas (su propio package.json). Motor Remotion para una serie vertical de parodia.
Leer README.md primero: tiene la referencia completa de episode.json.

## Reglas que no se negocian
- Siempre POV en primera persona. El protagonista nunca aparece: solo manos, mangas y lo que "ve".
- Siempre el cartel `PARODIA · FICCIÓN`. Los pensamientos son inventados y no se presentan como reales.
- No se imitan ni clonan voces reales. Nada de IA generativa en lo visual (estética anti "AI slop").
- Animación a pocas poses: keyframes escalonados por defecto, temblores deterministas con `rs()`/`hash()`.
- El renderer no lleva nada hardcodeado de un episodio: todo sale de `episodes/<ep>/episode.json`.
- Javier no programa: explícale los cambios en lenguaje natural y, antes de publicar, pídele que revise el MP4.

## Flujo de trabajo
- `npm run render -- <ep> --stills` + `scripts/contact.sh <ep>` → revisar la hoja de contactos antes del render completo.
- `./render <ep>` → `output/*.mp4` (~5 min). El Chromium local es `/opt/pw-browsers/...headless_shell` (ver render.mjs).
- El ffmpeg que trae Remotion es mínimo (sin `tile` ni `drawtext`). Para verificar el audio tiene `silencedetect` y `loudnorm`.

## Lecciones
- Al reescribir un JSON en Python, leerlo ANTES de abrir el archivo en modo "w": abrirlo lo trunca (se perdió EP01 una vez).
- La etiqueta de un DOODLE_ARROW se dibuja en negro: no ponerla sobre zonas oscuras (el borde del escenario).
- Las manos se dibujan antes que la segunda mano de la lista: la que "sujeta" va la última.
