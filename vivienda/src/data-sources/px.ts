/**
 * Parser del formato PC-Axis (.px), el formato nativo de las bases PxWeb.
 * Se usa como alternativa cuando la API JSON de PxWeb no está habilitada:
 * el mismo fichero .px que ofrece la opción "Guardar como PC-Axis".
 *
 * Referencia: https://www.scb.se/globalassets/vara-tjanster/px-programmen/px-file_format_specification_2013.pdf
 * Soporta: STUB/HEADING, VALUES, CODES, TIMEVAL, DATA con separadores espacio/;/tab,
 * valores ausentes ("." ".." "..." "...." "-" "\"..\"").
 */
import type { Cube, CubeVariable, Cell } from "./types";

type Keyword = { key: string; lang: string | null; sub: string | null; value: string };

function splitStatements(text: string): Keyword[] {
  const out: Keyword[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    // clave hasta '='
    const eq = text.indexOf("=", i);
    if (eq < 0) break;
    const rawKey = text.slice(i, eq).trim();
    // valor hasta ';' fuera de comillas
    let j = eq + 1;
    let inQ = false;
    for (; j < n; j++) {
      const ch = text[j];
      if (ch === '"') inQ = !inQ;
      else if (ch === ";" && !inQ) break;
    }
    const value = text.slice(eq + 1, j).trim();
    i = j + 1;
    if (!rawKey) continue;
    const m = /^([A-Z0-9-]+)(?:\[([^\]]+)\])?(?:\("([^"]*)"\))?$/i.exec(rawKey.replace(/\s+/g, ""));
    if (!m) continue;
    out.push({ key: m[1].toUpperCase(), lang: m[2] ?? null, sub: m[3] ?? null, value });
    if (m[1].toUpperCase() === "DATA") break;
  }
  return out;
}

/**
 * Lista PX: elementos separados por comas fuera de comillas. Un elemento largo puede
 * partirse en varios segmentos entrecomillados consecutivos ("abc"\n"def" = "abcdef").
 */
function parseList(v: string): string[] {
  const items: string[] = [];
  let cur: string | null = null;
  let i = 0;
  while (i < v.length) {
    const ch = v[i];
    if (ch === '"') {
      const end = v.indexOf('"', i + 1);
      const seg = v.slice(i + 1, end < 0 ? v.length : end);
      cur = (cur ?? "") + seg;
      i = end < 0 ? v.length : end + 1;
    } else if (ch === ",") {
      if (cur !== null) items.push(cur);
      cur = null;
      i++;
    } else {
      i++;
    }
  }
  if (cur !== null) items.push(cur);
  return items;
}

function unquote(v: string): string {
  return parseList(v).join("") || v.replace(/^"|"$/g, "");
}

const MISSING = new Set([".", "..", "...", "....", ".....", "......", "-", ":"]);

export function parsePx(text: string, preferLang?: string): Cube {
  const stmts = splitStatements(text.replace(/^\uFEFF/, ""));
  const pick = (key: string, sub: string | null = null): Keyword | undefined => {
    const all = stmts.filter((s) => s.key === key && s.sub === sub);
    return all.find((s) => s.lang === (preferLang ?? null)) ?? all.find((s) => s.lang === null) ?? all[0];
  };

  const stub = parseList(pick("STUB")?.value ?? "");
  const heading = parseList(pick("HEADING")?.value ?? "");
  const order = [...stub, ...heading];
  if (!order.length) throw new Error("PX sin STUB/HEADING");

  const timevalKeys = new Set(stmts.filter((s) => s.key === "TIMEVAL" && s.sub).map((s) => s.sub!));
  const variables: CubeVariable[] = order.map((name) => {
    const labels = parseList(pick("VALUES", name)?.value ?? "");
    const codesStmt = pick("CODES", name);
    const codes = codesStmt ? parseList(codesStmt.value) : labels;
    return {
      code: name,
      label: name,
      time: timevalKeys.has(name),
      values: labels.map((label, k) => ({ code: codes[k] ?? label, label })),
    };
  });

  const dataStmt = stmts.find((s) => s.key === "DATA");
  if (!dataStmt) throw new Error("PX sin DATA");
  const tokens = dataStmt.value
    .replace(/"/g, " ")
    .split(/[\s,;\t]+/)
    .filter(Boolean);
  const sizes = variables.map((v) => v.values.length);
  const total = sizes.reduce((a, b) => a * b, 1);
  if (tokens.length !== total) {
    throw new Error(`PX: DATA tiene ${tokens.length} valores y se esperaban ${total}`);
  }

  const cells: Cell[] = [];
  const idx = new Array(sizes.length).fill(0);
  for (let i = 0; i < total; i++) {
    let rem = i;
    for (let d = sizes.length - 1; d >= 0; d--) {
      idx[d] = rem % sizes[d];
      rem = Math.floor(rem / sizes[d]);
    }
    const dims: Cell["dims"] = {};
    variables.forEach((v, d) => (dims[v.code] = v.values[idx[d]]));
    const t = tokens[i];
    const num = MISSING.has(t) ? null : Number(t.replace(",", "."));
    cells.push({ dims, value: num !== null && Number.isFinite(num) ? num : null });
  }

  return {
    title: unquote(pick("TITLE")?.value ?? pick("CONTENTS")?.value ?? ""),
    updated: unquote(pick("LAST-UPDATED")?.value ?? "") || null,
    variables,
    cells,
  };
}
