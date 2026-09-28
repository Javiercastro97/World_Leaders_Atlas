/**
 * Contrato común de los proveedores de datos.
 *
 * Un adaptador:
 *   1. descarga (fetch) y guarda SIEMPRE el material bruto en data/snapshots/<fuente>/<fecha>/,
 *   2. normaliza ese snapshot a filas del modelo (Statistic, Dataset, Source),
 *   3. informa de avisos (valores no emparejados, totales que no cuadran…).
 *
 * La normalización es una función pura del snapshot: se puede re-ejecutar sin red
 * y producir exactamente el mismo resultado (reproducibilidad).
 */
import type { Dataset, Source, Statistic } from "@/lib/schema";

/** Una celda de un cubo estadístico: cada dimensión con su código y etiqueta originales. */
export interface Cell {
  dims: Record<string, { code: string; label: string }>;
  value: number | null;
}

export interface CubeVariable {
  code: string;
  label: string;
  time: boolean;
  values: { code: string; label: string }[];
}

export interface Cube {
  title: string;
  updated: string | null;
  variables: CubeVariable[];
  cells: Cell[];
}

export interface SnapshotFile {
  name: string;
  url: string;
  sha256: string;
  bytes: number;
  contentType: string;
}

export interface SnapshotManifest {
  source: string;
  snapshot_id: string;
  retrieved_at: string;
  files: SnapshotFile[];
  notes: string[];
}

export interface NormalizedResult {
  sources: Source[];
  datasets: Dataset[];
  statistics: Statistic[];
  warnings: string[];
}

export interface FetchContext {
  /** Carpeta donde escribir los ficheros brutos del snapshot. */
  dir: string;
  snapshotId: string;
  now: Date;
  fetch: typeof fetch;
  log: (msg: string) => void;
}

export interface DataSourceAdapter {
  id: string;
  name: string;
  /** Descarga material bruto al directorio del snapshot. */
  fetchSnapshot(ctx: FetchContext): Promise<SnapshotManifest>;
  /** Normaliza un snapshot ya descargado (sin red). */
  normalize(dir: string, manifest: SnapshotManifest): Promise<NormalizedResult>;
}

export const USER_AGENT = "MapaPorLaVivienda/0.1 (+https://github.com/javiercastro97/world_leaders_atlas; herramienta civica de datos abiertos)";
