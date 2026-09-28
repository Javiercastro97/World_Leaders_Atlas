/**
 * Lector mínimo de JSON-stat 2.0 (formato de respuesta de la API de PxWeb con
 * `response.format = "json-stat2"`). https://json-stat.org/format/
 */
import type { Cube, CubeVariable, Cell } from "./types";

interface JsonStatCategory {
  index?: string[] | Record<string, number>;
  label?: Record<string, string>;
}
interface JsonStatDimension {
  label?: string;
  category: JsonStatCategory;
}
export interface JsonStatDataset {
  version?: string;
  class?: string;
  label?: string;
  updated?: string;
  id: string[];
  size: number[];
  role?: { time?: string[]; geo?: string[]; metric?: string[] };
  dimension: Record<string, JsonStatDimension>;
  value: (number | null)[] | Record<string, number | null>;
  status?: Record<string, string> | string[] | string;
}

function categoryCodes(cat: JsonStatCategory): string[] {
  if (Array.isArray(cat.index)) return cat.index;
  if (cat.index) {
    return Object.entries(cat.index)
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
  }
  return Object.keys(cat.label ?? {});
}

export function parseJsonStat(ds: JsonStatDataset): Cube {
  if (!ds || !Array.isArray(ds.id) || !Array.isArray(ds.size)) {
    throw new Error("JSON-stat no válido: faltan id/size");
  }
  const timeDims = new Set(ds.role?.time ?? []);
  const variables: CubeVariable[] = ds.id.map((code) => {
    const dim = ds.dimension[code];
    const codes = categoryCodes(dim.category);
    return {
      code,
      label: dim.label ?? code,
      time: timeDims.has(code),
      values: codes.map((c) => ({ code: c, label: dim.category.label?.[c] ?? c })),
    };
  });

  const total = ds.size.reduce((a, b) => a * b, 1);
  const getValue = (i: number): number | null => {
    const v = Array.isArray(ds.value) ? ds.value[i] : ds.value[String(i)];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const cells: Cell[] = [];
  const idx = new Array(ds.size.length).fill(0);
  for (let i = 0; i < total; i++) {
    // índice lineal → índices por dimensión (orden fila-mayor, la última dimensión varía más rápido)
    let rem = i;
    for (let d = ds.size.length - 1; d >= 0; d--) {
      idx[d] = rem % ds.size[d];
      rem = Math.floor(rem / ds.size[d]);
    }
    const dims: Cell["dims"] = {};
    variables.forEach((v, d) => {
      dims[v.code] = v.values[idx[d]];
    });
    cells.push({ dims, value: getValue(i) });
  }

  return { title: ds.label ?? "", updated: ds.updated ?? null, variables, cells };
}
