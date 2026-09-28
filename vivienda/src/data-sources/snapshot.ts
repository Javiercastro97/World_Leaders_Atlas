/** Utilidades para guardar snapshots brutos reproducibles. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { SnapshotFile, SnapshotManifest } from "./types";

/** Raíz de datos versionados. VIVIENDA_DATA_DIR permite apuntar a fixtures de prueba. */
export const DATA_DIR = path.resolve(process.cwd(), process.env.VIVIENDA_DATA_DIR ?? "data");
export const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
export const NORMALIZED_DIR = path.join(DATA_DIR, "normalized");

export function snapshotIdFor(now: Date): string {
  return now.toISOString().replace(/[:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function saveRaw(dir: string, name: string, body: string | Uint8Array, url: string, contentType: string): Promise<SnapshotFile> {
  await mkdir(dir, { recursive: true });
  const buf = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
  await writeFile(path.join(dir, name), buf);
  return {
    name,
    url,
    contentType,
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

export async function writeManifest(dir: string, m: SnapshotManifest) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
}

export async function readManifest(dir: string): Promise<SnapshotManifest> {
  return JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as SnapshotManifest;
}

/** Último snapshot de una fuente (los ids son ISO y ordenan lexicográficamente). */
export async function latestSnapshotDir(source: string): Promise<string | null> {
  const base = path.join(SNAPSHOT_DIR, source);
  try {
    const entries = (await readdir(base, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    return entries.length ? path.join(base, entries[entries.length - 1]) : null;
  } catch {
    return null;
  }
}

/** Verifica que los ficheros brutos no han cambiado desde que se descargaron. */
export async function verifySnapshot(dir: string, m: SnapshotManifest): Promise<string[]> {
  const problems: string[] = [];
  for (const f of m.files) {
    try {
      const buf = await readFile(path.join(dir, f.name));
      const h = createHash("sha256").update(buf).digest("hex");
      if (h !== f.sha256) problems.push(`${f.name}: hash distinto`);
    } catch {
      problems.push(`${f.name}: no existe`);
    }
  }
  return problems;
}
