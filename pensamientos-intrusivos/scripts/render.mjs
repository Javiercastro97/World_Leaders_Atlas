// render <episodio>  →  output/<episode.output>.mp4   (H.264 + AAC, 1080x1920, 30 fps: listo para TikTok/Reels)
//
//   npm run render -- ep01_felipe_vi
//   npm run render -- ep01_felipe_vi --stills      (fotogramas clave en episodes/<ep>/generated/ para revisar)
//   npm run render -- ep01_felipe_vi --frames=0-299 (solo un tramo, para iterar rápido)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (f) => args.find((a) => a.startsWith(`--${f}`));

if (!name) {
  const eps = fs.readdirSync(path.join(ROOT, "episodes")).filter((d) => !d.startsWith("_"));
  console.error(`Uso: npm run render -- <episodio>\nEpisodios: ${eps.join(", ")}`);
  process.exit(1);
}

const epDir = path.join(ROOT, "episodes", name);
const epFile = path.join(epDir, "episode.json");
if (!fs.existsSync(epFile)) {
  console.error(`No existe ${path.relative(ROOT, epFile)}`);
  process.exit(1);
}
const episode = JSON.parse(fs.readFileSync(epFile, "utf8"));

// ---- validación mínima con mensajes en cristiano ----
const problems = [];
for (const k of ["title", "character", "duration", "scenes"]) if (episode[k] === undefined) problems.push(`falta "${k}"`);
(episode.scenes ?? []).forEach((s, i) => {
  const tag = `escena ${i + 1} (${s.id ?? "sin id"})`;
  if (!(s.end > s.start)) problems.push(`${tag}: end debe ser mayor que start`);
  if (!s.background?.set) problems.push(`${tag}: falta background.set`);
  if (s.end > episode.duration + 1e-6) problems.push(`${tag}: termina después de "duration"`);
  const sounds = [...(s.sfx ?? []), ...(s.voice ?? [])];
  for (const snd of sounds) {
    const file = snd.sound.includes("/") ? path.join(epDir, snd.sound) : path.join(ROOT, "episodes", "_shared", "sfx", `${snd.sound}.wav`);
    if (!fs.existsSync(file)) problems.push(`${tag}: no encuentro el sonido "${snd.sound}" (${path.relative(ROOT, file)})`);
  }
});
for (const tr of episode.tracks ?? []) {
  const file = tr.sound.includes("/") ? path.join(epDir, tr.sound) : path.join(ROOT, "episodes", "_shared", "sfx", `${tr.sound}.wav`);
  if (!fs.existsSync(file)) problems.push(`pista: no encuentro "${tr.sound}"`);
}
if (problems.length) {
  console.error("episode.json tiene problemas:\n - " + problems.join("\n - "));
  process.exit(1);
}

// ---- navegador: usa el Chromium local si existe (sin descargas) ----
const LOCAL_SHELL = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = process.env.REMOTION_BROWSER ?? (fs.existsSync(LOCAL_SHELL) ? LOCAL_SHELL : null);

console.log(`▸ Empaquetando motor…`);
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "src", "index.ts"),
  publicDir: path.join(ROOT, "episodes"),
});

const inputProps = { episode, dir: name };
const composition = await selectComposition({ serveUrl, id: "Episode", inputProps, browserExecutable });

if (flag("stills")) {
  const out = path.join(epDir, "generated");
  fs.mkdirSync(out, { recursive: true });
  // un fotograma por escena (a 1/3 y a 2/3) + los que pida --at=12.5,30
  const times = [];
  for (const s of episode.scenes) times.push(s.start + (s.end - s.start) * 0.35, s.start + (s.end - s.start) * 0.8);
  const extra = flag("at")?.split("=")[1];
  if (extra) times.push(...extra.split(",").map(Number));
  for (const t of times) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(t * 30));
    const file = path.join(out, `still_${String(frame).padStart(4, "0")}.jpg`);
    await renderStill({ composition, serveUrl, output: file, frame, inputProps, browserExecutable, imageFormat: "jpeg", jpegQuality: 80 });
    console.log(`  ${path.relative(ROOT, file)}  (t=${t.toFixed(2)}s)`);
  }
  process.exit(0);
}

const outDir = path.join(ROOT, "output");
fs.mkdirSync(outDir, { recursive: true });
const outputLocation = path.join(outDir, episode.output ?? `pensamientos_intrusivos_${episode.id ?? name}.mp4`);
const range = flag("frames")?.split("=")[1]?.split("-").map(Number);

console.log(`▸ Renderizando "${episode.title}" → ${path.relative(ROOT, outputLocation)}`);
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  audioCodec: "aac",
  audioBitrate: "192k",
  crf: 20,
  colorSpace: "bt709",
  pixelFormat: "yuv420p",
  x264Preset: "medium",
  outputLocation,
  inputProps,
  browserExecutable,
  frameRange: range ? [range[0], range[1]] : null,
  concurrency: process.env.CONCURRENCY ? Number(process.env.CONCURRENCY) : null,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 100);
    if (pct >= last + 10) {
      last = pct;
      process.stdout.write(`  ${pct}%\n`);
    }
  },
});
console.log(`✓ Listo: ${outputLocation}`);
