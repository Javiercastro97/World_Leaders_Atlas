/**
 * Repositorio sobre ficheros: lee los datos curados (data/curated), los resultados del ETL
 * (data/normalized) y, solo en desarrollo, los fixtures DEMO.
 *
 * Escrituras (envíos, reportes, moderación): en memoria y SOLO fuera de producción.
 * En producción sin DATABASE_URL la app es de solo lectura y los formularios lo indican.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Dataset, HousingEvent, Organization, Source, Statistic, Submission } from "@/lib/schema";
import { loadCurated } from "@/data-sources/collectives";
import { NORMALIZED_DIR } from "@/data-sources/snapshot";
import { demoEnabled, demoEvents, demoOrganizations, demoStatistics, DEMO_DATASET, DEMO_POP_DATASET, DEMO_SOURCE } from "../demo";
import { filterEvents, filterOrganizations, filterStatistics } from "./filters";
import type { ModerationLogEntry, Repo, StoredReport } from "./types";

async function readArr<T>(name: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(path.join(NORMALIZED_DIR, name), "utf8")) as T[];
  } catch {
    return [];
  }
}

interface Store {
  organizations: Organization[];
  events: HousingEvent[];
  sources: Source[];
  datasets: Dataset[];
  statistics: Statistic[];
  loadedAt: number;
}

// Estado mutable de desarrollo (sobrevive a recargas en caliente vía globalThis)
const mem = (globalThis as unknown as { __viviendaMem?: { submissions: Submission[]; reports: StoredReport[]; log: ModerationLogEntry[]; events: HousingEvent[]; sources: Source[] } }).__viviendaMem ??= {
  submissions: [],
  reports: [],
  log: [],
  events: [],
  sources: [],
};

const TTL = 60_000;

export class FileRepo implements Repo {
  readonly kind = "file" as const;
  readonly writable = process.env.NODE_ENV !== "production";
  private store: Store | null = null;

  constructor(private now: () => Date = () => new Date()) {}

  private async load(): Promise<Store> {
    if (this.store && Date.now() - this.store.loadedAt < TTL) return this.store;
    const [curated, sources, datasets, statistics] = await Promise.all([
      loadCurated(),
      readArr<Source>("sources.json"),
      readArr<Dataset>("datasets.json"),
      readArr<Statistic>("statistics.json"),
    ]);
    if (curated.errors.length) console.warn("[datos curados] ficheros ignorados:\n" + curated.errors.join("\n"));
    const demo = demoEnabled();
    this.store = {
      organizations: [...curated.organizations, ...(demo ? demoOrganizations() : [])],
      events: [...curated.events, ...(demo ? demoEvents(this.now()) : [])],
      sources: [...sources, ...curated.sources, ...(demo ? [DEMO_SOURCE] : [])],
      datasets: [...datasets, ...(demo ? [DEMO_DATASET, DEMO_POP_DATASET] : [])],
      statistics: [...statistics, ...(demo ? demoStatistics() : [])],
      loadedAt: Date.now(),
    };
    return this.store;
  }

  private assertWritable() {
    if (!this.writable) throw new Error("Almacenamiento de solo lectura: configura DATABASE_URL para aceptar envíos.");
  }

  async listEvents(f = {}) {
    const s = await this.load();
    return filterEvents([...s.events, ...mem.events], { includeDemo: demoEnabled(), ...f });
  }
  async getEvent(slug: string) {
    return (await this.listEvents()).find((e) => e.slug === slug) ?? null;
  }
  async getEventById(id: string) {
    return (await this.listEvents()).find((e) => e.id === id) ?? null;
  }
  async createEvent(e: HousingEvent, source: Source) {
    this.assertWritable();
    mem.sources.push(source);
    mem.events.push(e);
  }
  async updateEvent(id: string, patch: Partial<HousingEvent>) {
    this.assertWritable();
    const e = mem.events.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  }

  async deleteEvent(id: string) {
    this.assertWritable();
    mem.events = mem.events.filter((e) => e.id !== id);
  }

  async listOrganizations(f = {}) {
    return filterOrganizations((await this.load()).organizations, f);
  }
  async getOrganization(slug: string) {
    return (await this.load()).organizations.find((o) => o.slug === slug) ?? null;
  }

  async listSources() {
    const s = await this.load();
    return [...s.sources, ...mem.sources];
  }
  async getSource(id: string) {
    return (await this.listSources()).find((s) => s.id === id) ?? null;
  }

  async listDatasets() {
    return (await this.load()).datasets;
  }
  async listStatistics(f = {}) {
    return filterStatistics((await this.load()).statistics, f);
  }

  async createSubmission(s: Submission) {
    this.assertWritable();
    mem.submissions.push(s);
  }
  async listSubmissions(status?: Submission["status"]) {
    return mem.submissions.filter((s) => !status || s.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getSubmission(id: string) {
    return mem.submissions.find((s) => s.id === id) ?? null;
  }
  async updateSubmission(id: string, patch: Partial<Submission>) {
    this.assertWritable();
    const s = mem.submissions.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
  }
  async countSubmissionsSince(clientHash: string, sinceIso: string) {
    return mem.submissions.filter((s) => s.client_hash === clientHash && s.created_at >= sinceIso).length;
  }

  async createReport(r: StoredReport) {
    this.assertWritable();
    mem.reports.push(r);
  }
  async listReports(status?: StoredReport["status"]) {
    return mem.reports.filter((r) => !status || r.status === status);
  }
  async updateReport(id: string, patch: Partial<StoredReport>) {
    this.assertWritable();
    const r = mem.reports.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  }

  async log(entry: ModerationLogEntry) {
    mem.log.push({ ...entry, id: mem.log.length + 1 });
  }
  async listLog(targetId?: string) {
    return mem.log.filter((l) => !targetId || l.target_id === targetId).reverse();
  }
}
