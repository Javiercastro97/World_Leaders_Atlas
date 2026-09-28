import type { Repo } from "./types";
import { FileRepo } from "./file";

let repo: Repo | null = null;

/** Postgres si hay DATABASE_URL; si no, ficheros (datos curados + snapshots del ETL). */
export async function getRepo(): Promise<Repo> {
  if (repo) return repo;
  if (process.env.DATABASE_URL) {
    const { PgRepo } = await import("./pg");
    repo = new PgRepo();
  } else {
    repo = new FileRepo();
  }
  return repo;
}

export function setRepoForTests(r: Repo | null) {
  repo = r;
}

export type { Repo } from "./types";
