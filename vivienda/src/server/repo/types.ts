import type {
  Dataset,
  EventType,
  HousingEvent,
  Metric,
  Organization,
  OrgType,
  ProcedureType,
  ReportInput,
  Source,
  Statistic,
  Submission,
  SubmissionStatus,
} from "@/lib/schema";

export interface EventFilter {
  /** Id de provincia (PR-XX) o CCAA (CA-XX). */
  territory?: string;
  municipality?: string;
  from?: string; // AAAA-MM-DD
  to?: string;
  types?: EventType[];
  organizationId?: string;
  includeDemo?: boolean;
}

export interface OrganizationFilter {
  territory?: string;
  type?: OrgType;
  q?: string;
}

export interface StatisticFilter {
  metric?: Metric;
  datasetIds?: string[];
  territoryType?: Statistic["territory_type"];
  territoryCode?: string;
  periodType?: Statistic["period_type"];
  procedureType?: ProcedureType;
}

export interface StoredReport extends Omit<ReportInput, "website" | "form_token"> {
  id: string;
  status: "open" | "resolved" | "dismissed";
  client_hash: string;
  created_at: string;
  resolved_at: string | null;
}

export interface ModerationLogEntry {
  id?: number;
  target_type: "submission" | "event" | "report" | "organization";
  target_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  moderator: string;
  created_at: string;
}

export interface Repo {
  readonly kind: "file" | "postgres";
  /** false cuando no hay almacenamiento persistente para escrituras (producción sin BD). */
  readonly writable: boolean;

  listEvents(f?: EventFilter): Promise<HousingEvent[]>;
  getEvent(slug: string): Promise<HousingEvent | null>;
  getEventById(id: string): Promise<HousingEvent | null>;
  createEvent(e: HousingEvent, source: Source): Promise<void>;
  updateEvent(id: string, patch: Partial<HousingEvent>): Promise<void>;
  /** Retirada (p. ej. por solicitud de privacidad). El registro de moderación conserva la traza, no el contenido. */
  deleteEvent(id: string): Promise<void>;

  listOrganizations(f?: OrganizationFilter): Promise<Organization[]>;
  getOrganization(slug: string): Promise<Organization | null>;

  listSources(): Promise<Source[]>;
  getSource(id: string): Promise<Source | null>;

  listDatasets(): Promise<Dataset[]>;
  listStatistics(f?: StatisticFilter): Promise<Statistic[]>;

  createSubmission(s: Submission): Promise<void>;
  listSubmissions(status?: SubmissionStatus): Promise<Submission[]>;
  getSubmission(id: string): Promise<Submission | null>;
  updateSubmission(id: string, patch: Partial<Submission>): Promise<void>;
  countSubmissionsSince(clientHash: string, sinceIso: string): Promise<number>;

  createReport(r: StoredReport): Promise<void>;
  listReports(status?: StoredReport["status"]): Promise<StoredReport[]>;
  updateReport(id: string, patch: Partial<StoredReport>): Promise<void>;

  log(entry: ModerationLogEntry): Promise<void>;
  listLog(targetId?: string): Promise<ModerationLogEntry[]>;
}
