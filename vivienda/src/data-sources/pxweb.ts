/**
 * Cliente genérico de la API PxWeb v1 (Statistics Sweden), usada por el CGPJ y por otros
 * organismos. Contrato estándar:
 *
 *   GET  {base}/api/v1/{lang}/                         → bases de datos [{dbid,text}]
 *   GET  {base}/api/v1/{lang}/{db}/{...niveles}        → nodos [{id,type:'l'|'t',text}]
 *   GET  {base}/api/v1/{lang}/{db}/{...}/{tabla}.px    → metadatos {title,variables[]}
 *   POST {base}/api/v1/{lang}/{db}/{...}/{tabla}.px    → datos (JSON-stat 2.0)
 *
 * Alternativa sin API: el fichero PC-Axis bruto, publicado por PxWeb en
 *   {base}/Resources/PX/Databases/{db}/{tabla}.px
 */
import { USER_AGENT } from "./types";

export interface PxNode {
  id: string;
  type: "l" | "t" | "h";
  text: string;
  updated?: string;
}

export interface PxTableMeta {
  title: string;
  variables: { code: string; text: string; values: string[]; valueTexts: string[]; time?: boolean; elimination?: boolean }[];
}

export interface PxWebClientOptions {
  base: string; // p. ej. https://www6.poderjudicial.es/PxWeb-20252-v1
  lang?: string;
  fetch?: typeof fetch;
  /** Pausa mínima entre peticiones (respeto a los límites del servidor). */
  minIntervalMs?: number;
  timeoutMs?: number;
}

export class PxWebClient {
  readonly base: string;
  readonly lang: string;
  private f: typeof fetch;
  private minInterval: number;
  private timeout: number;
  private last = 0;

  constructor(o: PxWebClientOptions) {
    this.base = o.base.replace(/\/+$/, "");
    this.lang = o.lang ?? "es";
    this.f = o.fetch ?? fetch;
    this.minInterval = o.minIntervalMs ?? 1500;
    this.timeout = o.timeoutMs ?? 30_000;
  }

  apiUrl(...path: string[]): string {
    return [this.base, "api/v1", this.lang, ...path.map(encodeURIComponent)].join("/");
  }

  pxFileUrl(db: string, table: string): string {
    return [this.base, "Resources/PX/Databases", encodeURIComponent(db), encodeURIComponent(table)].join("/");
  }

  private async throttle() {
    const wait = this.last + this.minInterval - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
  }

  async request(url: string, init?: RequestInit): Promise<Response> {
    await this.throttle();
    const res = await this.f(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/plain, */*", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(this.timeout),
    });
    if (res.status === 429) throw new Error(`PxWeb: 429 (límite de peticiones) en ${url}`);
    if (!res.ok) throw new Error(`PxWeb: HTTP ${res.status} en ${url}`);
    return res;
  }

  async list(...path: string[]): Promise<PxNode[]> {
    const res = await this.request(this.apiUrl(...path));
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) throw new Error("PxWeb: listado inesperado");
    return body.map((n: Record<string, string>) => ({
      id: n.id ?? n.dbid,
      type: (n.type as PxNode["type"]) ?? "l",
      text: n.text,
      updated: n.updated,
    }));
  }

  async metadata(...path: string[]): Promise<PxTableMeta> {
    const res = await this.request(this.apiUrl(...path));
    return (await res.json()) as PxTableMeta;
  }

  /** Descarga la tabla completa como JSON-stat 2.0 (texto bruto, para guardarlo tal cual). */
  async queryAll(meta: PxTableMeta, ...path: string[]): Promise<string> {
    const body = {
      query: meta.variables.map((v) => ({ code: v.code, selection: { filter: "all", values: ["*"] } })),
      response: { format: "json-stat2" },
    };
    const res = await this.request(this.apiUrl(...path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.text();
  }

  async pxFile(db: string, table: string): Promise<{ text: string; url: string }> {
    const url = this.pxFileUrl(db, table);
    const res = await this.request(url, { headers: { Accept: "text/plain, */*" } });
    const buf = new Uint8Array(await res.arrayBuffer());
    // Los .px del CGPJ declaran CODEPAGE; windows-1252/iso-8859-1 es lo habitual en PxWeb en español.
    const head = new TextDecoder("latin1").decode(buf.slice(0, 2000));
    const cp = /CODEPAGE="([^"]+)"/i.exec(head)?.[1]?.toLowerCase() ?? "windows-1252";
    const enc = cp.includes("utf") ? "utf-8" : "windows-1252";
    return { text: new TextDecoder(enc).decode(buf), url };
  }
}
