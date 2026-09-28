// Biblioteca de sonidos de la serie, sintetizada por código.
// Reproducible (semilla fija), sin descargas, sin licencias de terceros.
// Deliberadamente cutre: suena a teclado Casio y a efectos de PowerPoint.
//
//   npm run sfx   → escribe episodes/_shared/sfx/*.wav
//
// Para sustituir un sonido por una grabación real basta con dejar un .wav
// con el mismo nombre en esa carpeta (y no volver a ejecutar este script).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "episodes", "_shared", "sfx");
fs.mkdirSync(OUT, { recursive: true });

// ---------- utilidades ----------
let seed = 1337;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rnd() * 2 - 1;
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const TAU = Math.PI * 2;

function writeWav(name, data, gain = 0.9) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? gain / peak : 1;
  const b = Buffer.alloc(44 + data.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i] * k));
    b.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, `${name}.wav`), b);
  console.log(`  ${name}.wav  ${(data.length / SR).toFixed(2)}s`);
}

// mezcla `src` dentro de `dst` a partir del segundo `at`
function mix(dst, src, at = 0, vol = 1) {
  const o = Math.floor(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * vol;
  return dst;
}

// filtro biquad (RBJ) — lowpass / bandpass / highpass
function biquad(data, type, freq, q = 0.707) {
  const w = (TAU * freq) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = a; b1 = 0; b2 = -a; }
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  const out = new Float32Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}

const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ---------- sonidos ----------
const lib = {};

lib.click = () => {
  const d = buf(0.12);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    d[i] = noise() * Math.exp(-t / 0.0025) * 0.9 + Math.sin(TAU * 2300 * t) * Math.exp(-t / 0.008) * 0.6;
    const t2 = t - 0.045; // el "clack" del muelle volviendo
    if (t2 > 0) d[i] += (noise() * Math.exp(-t2 / 0.002) + Math.sin(TAU * 1700 * t2) * Math.exp(-t2 / 0.006)) * 0.35;
  }
  return biquad(d, "hp", 400);
};

lib.bonk = () => {
  const d = buf(0.35);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    ph += (TAU * (120 + 380 * Math.exp(-t / 0.03))) / SR;
    d[i] = Math.sin(ph) * env(t, 0.002, 0.09) + noise() * Math.exp(-t / 0.004) * 0.3;
  }
  return d;
};

function metal(freqs, decay, len, attackNoise = 0.6) {
  const d = buf(len);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    let v = 0;
    freqs.forEach((f, k) => (v += Math.sin(TAU * f * t + k) * Math.exp(-t / (decay / (1 + k * 0.35)))));
    d[i] = v / freqs.length + noise() * Math.exp(-t / 0.006) * attackNoise;
  }
  return d;
}
lib.metal_clang = () => metal([523, 1187, 1871, 2593, 3301, 4210], 0.7, 1.8);
// el CLONK: grave, sucio, como una caja de fusibles del tamaño de un armario
lib.clonk = () => {
  const d = metal([92, 211, 367, 590, 873, 1302], 0.55, 2.2, 1.0);
  const boom = buf(1.2);
  for (let i = 0; i < boom.length; i++) {
    const t = i / SR;
    boom[i] = Math.sin(TAU * (48 + 30 * Math.exp(-t / 0.05)) * t) * Math.exp(-t / 0.35);
  }
  return mix(d, boom, 0, 1.3);
};

// trompeta de feria: onda cuadrada filtrada, afinación cada vez peor
lib.cheap_trumpet = () => {
  const notes = [
    [392, 0.14], [392, 0.14], [392, 0.14], [523, 0.5], [0, 0.08],
    [494, 0.14], [523, 0.14], [587, 0.3], [0, 0.06],
    [659, 0.22], [640, 1.25], // la última nota se desploma
  ];
  const total = notes.reduce((s, n) => s + n[1], 0) + 0.3;
  const d = buf(total);
  let pos = 0, ph = 0;
  notes.forEach(([f, dur], idx) => {
    const n = Math.floor(dur * SR), last = idx === notes.length - 1;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      if (!f) { d[pos + i] = 0; continue; }
      let freq = f * (1 + 0.012 * Math.sin(TAU * 5.5 * t)) * (1 + (rnd() - 0.5) * 0.002);
      if (last) freq *= 1 - 0.09 * Math.min(1, t / dur) ** 2; // se cae
      if (last && t > dur * 0.72 && Math.floor(t * 30) % 3 === 0) freq *= 1.5; // gallo
      ph += (TAU * freq) / SR;
      const sq = Math.sin(ph) > 0 ? 1 : -1;
      const a = Math.min(1, t / 0.015) * Math.min(1, (dur - t) / 0.03);
      d[pos + i] = (sq * 0.6 + Math.sin(ph * 2) * 0.3) * a;
    }
    pos += n;
  });
  return biquad(biquad(d, "lp", 2600), "bp", 1100, 0.6).map((v, i) => v * 0.8 + d[i] * 0.08);
};

lib.bad_applause = () => {
  const d = buf(2.6);
  const clappers = 4;
  for (let c = 0; c < clappers; c++) {
    let t = rnd() * 0.25;
    const rate = 0.18 + rnd() * 0.12;
    const stop = 1.2 + rnd() * 1.2; // cada uno se cansa cuando quiere
    while (t < stop) {
      const clap = buf(0.05);
      for (let i = 0; i < clap.length; i++) clap[i] = noise() * Math.exp(-(i / SR) / 0.008);
      mix(d, biquad(clap, "bp", 1200 + c * 300, 1.2), t, 0.8);
      t += rate * (0.8 + rnd() * 0.5);
    }
  }
  return d;
};

// coro celestial de teclado barato
lib.angel_choir = () => {
  const d = buf(3.2);
  const chord = [220, 277.2, 329.6, 440, 554.4];
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    let v = 0;
    chord.forEach((f, k) => {
      for (const det of [-0.004, 0, 0.005]) {
        const ph = TAU * f * (1 + det) * t + k;
        v += ((ph / TAU) % 1) * 2 - 1; // sierra
      }
    });
    d[i] = v * Math.min(1, t / 0.6) * Math.min(1, (3.2 - t) / 0.8) * (1 + 0.15 * Math.sin(TAU * 4 * t));
  }
  return biquad(biquad(d, "bp", 800, 1.5), "lp", 3000);
};

lib.alarm = () => {
  const d = buf(2.0);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    ph += (TAU * (Math.floor(t / 0.25) % 2 ? 660 : 880)) / SR;
    d[i] = (Math.sin(ph) > 0 ? 1 : -1) * 0.7;
  }
  return biquad(d, "lp", 3500);
};

lib.paper = () => {
  const d = buf(0.7);
  for (let k = 0; k < 14; k++) {
    const g = buf(0.03);
    for (let i = 0; i < g.length; i++) g[i] = noise() * Math.exp(-(i / SR) / 0.006);
    mix(d, g, rnd() * 0.6, 0.3 + rnd() * 0.7);
  }
  return biquad(d, "hp", 1500);
};

lib.chair = () => {
  const d = buf(0.9);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    ph += (TAU * (180 + 60 * Math.sin(TAU * 7 * t) + 40 * noise())) / SR;
    d[i] = (t < 0.55 ? ((ph / TAU) % 1 - 0.5) * (0.6 + noise() * 0.4) : 0) * Math.min(1, t / 0.05);
  }
  const thud = buf(0.3);
  for (let i = 0; i < thud.length; i++) thud[i] = Math.sin(TAU * 70 * (i / SR)) * Math.exp(-(i / SR) / 0.06);
  return mix(biquad(d, "bp", 900, 2), thud, 0.58, 1.4);
};

lib.footsteps = () => {
  const d = buf(1.8);
  for (let k = 0; k < 5; k++) {
    const s = buf(0.15);
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      s[i] = Math.sin(TAU * 95 * t) * Math.exp(-t / 0.03) + noise() * Math.exp(-t / 0.01) * 0.4;
    }
    mix(d, biquad(s, "lp", 1800), k * 0.34 + rnd() * 0.03);
  }
  return d;
};

lib.electrical_failure = () => {
  const d = buf(1.6);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const on = t < 1.25 && rnd() > (t > 0.6 ? 0.25 : 0.02);
    let v = 0;
    for (let h = 1; h < 12; h += 2) v += Math.sin(TAU * 50 * h * t) / h;
    d[i] = on ? v * 0.5 + noise() * 0.15 * (rnd() > 0.995 ? 6 : 1) : 0;
    if (t > 1.25 && t < 1.3) d[i] = noise() * Math.exp(-(t - 1.25) / 0.01); // pop final
  }
  return d;
};

lib.dramatic_hit = () => {
  const d = buf(1.5);
  const stab = [110, 130.8, 164.8];
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    let v = Math.sin(TAU * (45 + 40 * Math.exp(-t / 0.04)) * t) * Math.exp(-t / 0.45) * 1.2;
    stab.forEach((f) => (v += (((f * t) % 1) * 2 - 1) * 0.25 * Math.exp(-t / 0.3)));
    d[i] = v + noise() * Math.exp(-t / 0.02) * 0.5;
  }
  return biquad(d, "lp", 4000);
};

lib.tiny_pop = () => {
  const d = buf(0.08);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    ph += (TAU * (700 + 900 * Math.min(1, t / 0.03))) / SR;
    d[i] = Math.sin(ph) * env(t, 0.001, 0.015);
  }
  return d;
};

lib.whoosh_cheap = () => {
  const d = buf(0.35);
  for (let i = 0; i < d.length; i++) d[i] = noise() * Math.sin((Math.PI * i) / d.length) ** 2;
  return biquad(d, "bp", 1400, 0.9);
};

lib.cough = () => {
  const d = buf(0.9);
  for (const at of [0, 0.32]) {
    const c = buf(0.25);
    for (let i = 0; i < c.length; i++) {
      const t = i / SR;
      c[i] = (noise() * 0.8 + Math.sin(TAU * 140 * t) * 0.4) * env(t, 0.005, 0.06);
    }
    mix(d, biquad(c, "bp", 700, 0.8), at);
  }
  return d;
};

lib.crash_distant = () => {
  // cosas cayendo fuera de campo: clangs, cristalitos, un golpe sordo
  const d = buf(2.4);
  mix(d, metal([700, 1530, 2210, 3120], 0.35, 1.0), 0.0, 0.8);
  mix(d, lib.bonk(), 0.25, 0.7);
  mix(d, metal([2900, 4100, 5230, 6400], 0.15, 0.6, 0.2), 0.42, 0.6);
  mix(d, metal([410, 980, 1600], 0.5, 1.2), 0.7, 0.7);
  mix(d, lib.chair(), 1.05, 0.8);
  mix(d, metal([3300, 4700, 5900], 0.1, 0.4, 0.2), 1.5, 0.5);
  return biquad(d, "lp", 5000);
};

// ambiente de salón de actos: tono de sala + murmullo lejano
lib.room_tone = () => {
  const d = buf(8);
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    b = b * 0.995 + noise() * 0.02;
    d[i] = b + noise() * 0.004;
  }
  return biquad(d, "lp", 900);
};

// Voz "de muñeco": pulso glotal + formantes. No imita a nadie: es un bla-bla.
const VOWELS = { a: [800, 1200], e: [450, 1900], i: [300, 2300], o: [500, 900], u: [330, 800] };
function gibberish(syllables, { pitch = 140, rate = 0.16, len, shout = false }) {
  const total = len ?? syllables.length * rate + 0.4;
  const src = buf(total);
  let ph = 0;
  for (let i = 0; i < src.length; i++) {
    const t = i / SR;
    const k = Math.floor(t / rate);
    const inSyl = k < syllables.length && (t % rate) / rate < 0.82;
    const contour = shout ? 1 + 0.5 * Math.min(1, t / (total * 0.6)) : 1 + 0.08 * Math.sin(TAU * 1.3 * t);
    ph += (TAU * pitch * contour * (1 + 0.02 * noise())) / SR;
    src[i] = inSyl ? (ph / TAU) % 1 - 0.5 + noise() * (shout ? 0.25 : 0.05) : 0;
  }
  // un filtro por vocal, aplicado por sílaba
  const out = buf(total);
  syllables.forEach((v, k) => {
    const [f1, f2] = VOWELS[v] ?? VOWELS.a;
    const seg = src.slice(Math.floor(k * rate * SR), Math.floor((k + 1) * rate * SR));
    const hi = biquad(seg, "bp", f2, 4);
    const f = biquad(seg, "bp", f1, 3).map((x, i) => x + hi[i] * 0.6);
    const a = Math.floor(k * rate * SR);
    for (let i = 0; i < f.length; i++) out[a + i] += f[i] * Math.min(1, i / 300) * Math.min(1, (f.length - i) / 300);
  });
  return out;
}
lib.speech_murmur = () => gibberish("aeoaieaoeaoieaeoeaiaoeaoaeieoa".split(""), { pitch: 110, rate: 0.19 });
lib.shout_who = () => gibberish(["i", "e", "a", "o", "a", "o", "e", "o"], { pitch: 230, rate: 0.17, shout: true });

// ---------- escribir ----------
console.log(`Generando biblioteca SFX en ${path.relative(process.cwd(), OUT)}/`);
for (const [name, fn] of Object.entries(lib)) {
  const skip = process.argv.includes("--keep") && fs.existsSync(path.join(OUT, `${name}.wav`));
  if (skip) continue;
  writeWav(name, fn(), name === "room_tone" ? 0.5 : 0.9);
}
