/**
 * Descarga los PNG (fondo transparente) de todos los jugadores de LaLiga EA Sports.
 *
 * Uso:
 *   node scripts/descargar-jugadores-laliga.mjs
 *
 * No necesita instalar nada: solo Node 18 o superior.
 *
 * Qué hace:
 *   1. Pide a la API pública de LaLiga Fantasy la lista completa de jugadores.
 *   2. Crea una carpeta por equipo dentro de jugadores-laliga/.
 *   3. Descarga el PNG de cada jugador (256x256, fondo transparente).
 *   4. Deja un indice.json con los datos de cada jugador y su fichero.
 *
 * Es reanudable: si lo cortas y lo vuelves a lanzar, salta los que ya tenga.
 */

import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'jugadores-laliga');

// La API ha ido cambiando de dominio con los años. Se prueban en orden
// y se usa el primero que conteste con una lista de jugadores válida.
const ENDPOINTS_JUGADORES = [
  'https://api-fantasy.llt-services.com/api/v3/players',
  'https://api.laligafantasymarca.com/api/v3/players',
  'https://api-fantasy.llt-services.com/api/v4/players',
];

const CABECERAS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9',
};

const CONCURRENCIA = 8;
const REINTENTOS = 3;

const POSICIONES = {
  1: 'portero',
  2: 'defensa',
  3: 'centrocampista',
  4: 'delantero',
  5: 'entrenador',
};

// ---------------------------------------------------------------- utilidades

function slugificar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sin-nombre';
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pedir(url, { binario = false } = {}) {
  let ultimoError;
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), 30000);
      const res = await fetch(url, { headers: CABECERAS, signal: control.signal });
      clearTimeout(reloj);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return binario ? Buffer.from(await res.arrayBuffer()) : await res.json();
    } catch (err) {
      ultimoError = err;
      if (intento < REINTENTOS) await esperar(500 * 2 ** (intento - 1));
    }
  }
  throw ultimoError;
}

/** Comprueba que lo descargado es un PNG de verdad y no una página de error. */
function esPng(buffer) {
  return (
    buffer.length > 1000 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

/**
 * Saca la mejor URL de imagen disponible del objeto del jugador.
 * La API devuelve algo como:
 *   images: { transparent: { "256x256": "...png" }, beated: {...} }
 * Se prefiere la transparente y el tamaño más grande.
 */
function urlDeImagen(jugador) {
  const imgs = jugador?.images;

  const deGrupo = (grupo) => {
    if (!grupo) return null;
    if (typeof grupo === 'string') return grupo;
    const claves = Object.keys(grupo)
      .filter((k) => typeof grupo[k] === 'string' && grupo[k].startsWith('http'))
      .sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
    return claves.length ? grupo[claves[0]] : null;
  };

  const candidata =
    deGrupo(imgs?.transparent) ||
    deGrupo(imgs?.beated) ||
    deGrupo(imgs?.styled) ||
    deGrupo(imgs);

  if (candidata) return candidata;

  // Último recurso: reconstruir la URL con el patrón conocido de assets.
  const idJugador = jugador?.id;
  const idEquipo = jugador?.team?.id;
  if (idJugador && idEquipo) {
    return `https://assets-fantasy.llt-services.com/players/t${idEquipo}/p${idJugador}/256x256/p${idJugador}_t${idEquipo}_1.png`;
  }
  return null;
}

// ------------------------------------------------------------------ programa

async function obtenerJugadores() {
  for (const url of ENDPOINTS_JUGADORES) {
    process.stdout.write(`  probando ${new URL(url).host}${new URL(url).pathname} … `);
    try {
      const datos = await pedir(url);
      const lista = Array.isArray(datos) ? datos : datos?.data ?? datos?.players;
      if (Array.isArray(lista) && lista.length > 0) {
        console.log(`OK (${lista.length} jugadores)`);
        return lista;
      }
      console.log('respuesta vacía');
    } catch (err) {
      console.log(`falla (${err.message})`);
    }
  }
  throw new Error(
    'Ningún endpoint de la API respondió. Puede que hayan cambiado la URL.\n' +
      'Abre https://fantasy.laliga.com en el navegador, pestaña Red (Network),\n' +
      'busca la petición que devuelve los jugadores y pásame esa URL.',
  );
}

/** Ejecuta tareas con un límite de descargas simultáneas. */
async function enParalelo(tareas, limite, alTerminarUna) {
  let indice = 0;
  const trabajadores = Array.from({ length: limite }, async () => {
    while (indice < tareas.length) {
      const mia = tareas[indice++];
      const resultado = await mia();
      alTerminarUna(resultado);
    }
  });
  await Promise.all(trabajadores);
}

async function main() {
  console.log('\nDescarga de PNG — LaLiga EA Sports\n');

  console.log('1. Pidiendo la lista de jugadores…');
  const crudos = await obtenerJugadores();

  // Normalizar y quedarse solo con quien tenga equipo e imagen.
  const jugadores = [];
  const sinImagen = [];

  for (const j of crudos) {
    const equipo = j?.team?.name || j?.team?.shortName;
    const nombre = j?.nickname || j?.name || j?.lastName;
    const url = urlDeImagen(j);
    if (!equipo || !nombre) continue;
    if (!url) {
      sinImagen.push(`${nombre} (${equipo})`);
      continue;
    }
    jugadores.push({
      id: String(j.id),
      nombre,
      nombreCompleto: [j.name, j.lastName].filter(Boolean).join(' ') || nombre,
      equipo,
      equipoId: j?.team?.id ? String(j.team.id) : null,
      posicion: POSICIONES[j.positionId] || j.position || 'desconocida',
      url,
    });
  }

  const equipos = [...new Set(jugadores.map((j) => j.equipo))].sort();
  console.log(`   ${jugadores.length} jugadores en ${equipos.length} equipos.`);
  if (sinImagen.length) console.log(`   ${sinImagen.length} sin foto disponible (se omiten).`);

  // Carpeta por equipo.
  console.log(`\n2. Creando carpetas en ${path.relative(process.cwd(), DESTINO) || DESTINO}/`);
  const carpetaDe = new Map();
  for (const equipo of equipos) {
    const carpeta = path.join(DESTINO, slugificar(equipo));
    await mkdir(carpeta, { recursive: true });
    carpetaDe.set(equipo, carpeta);
  }

  // Nombres de fichero únicos (dos jugadores pueden compartir apodo).
  const usados = new Set();
  for (const j of jugadores) {
    let base = slugificar(j.nombre);
    let clave = `${j.equipo}/${base}`;
    if (usados.has(clave)) {
      base = `${base}-${j.id}`;
      clave = `${j.equipo}/${base}`;
    }
    usados.add(clave);
    j.fichero = path.join(carpetaDe.get(j.equipo), `${base}.png`);
  }

  // Descargar.
  console.log(`\n3. Descargando ${jugadores.length} PNG (${CONCURRENCIA} a la vez)…\n`);
  let hechos = 0;
  let saltados = 0;
  const fallidos = [];

  const tareas = jugadores.map((j) => async () => {
    if (existsSync(j.fichero) && (await stat(j.fichero)).size > 1000) {
      saltados++;
      return { ok: true, saltado: true };
    }
    try {
      const buffer = await pedir(j.url, { binario: true });
      if (!esPng(buffer)) throw new Error('la respuesta no es un PNG');
      await writeFile(j.fichero, buffer);
      return { ok: true };
    } catch (err) {
      fallidos.push({ jugador: `${j.nombre} (${j.equipo})`, url: j.url, motivo: err.message });
      return { ok: false };
    }
  });

  const total = tareas.length;
  await enParalelo(tareas, CONCURRENCIA, (r) => {
    if (r.ok && !r.saltado) hechos++;
    const vistos = hechos + saltados + fallidos.length;
    process.stdout.write(`\r   ${vistos}/${total}  descargados ${hechos} · ya estaban ${saltados} · fallos ${fallidos.length}   `);
  });
  console.log('\n');

  // Índice.
  const indice = {
    competicion: 'LaLiga EA Sports',
    generado: new Date().toISOString(),
    equipos: equipos.length,
    jugadores: jugadores.length,
    lista: jugadores.map((j) => ({
      id: j.id,
      nombre: j.nombre,
      nombreCompleto: j.nombreCompleto,
      equipo: j.equipo,
      posicion: j.posicion,
      fichero: path.relative(DESTINO, j.fichero),
      url: j.url,
    })),
  };
  await writeFile(path.join(DESTINO, 'indice.json'), JSON.stringify(indice, null, 2) + '\n');

  // Resumen por equipo.
  console.log('4. Resumen\n');
  for (const equipo of equipos) {
    const carpeta = carpetaDe.get(equipo);
    const n = (await readdir(carpeta)).filter((f) => f.endsWith('.png')).length;
    console.log(`   ${String(n).padStart(3)}  ${equipo}`);
  }

  console.log(`\n   Total: ${hechos + saltados} PNG en ${path.relative(process.cwd(), DESTINO) || DESTINO}/`);
  console.log(`   Índice: jugadores-laliga/indice.json`);

  if (fallidos.length) {
    console.log(`\n   ${fallidos.length} ${fallidos.length === 1 ? 'fallo' : 'fallos'}:`);
    for (const f of fallidos.slice(0, 20)) console.log(`     - ${f.jugador}: ${f.motivo}`);
    if (fallidos.length > 20) console.log(`     … y ${fallidos.length - 20} más`);
    console.log('   Vuelve a lanzar el script: reintenta solo los que faltan.');
  }
  console.log('');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exit(1);
});
