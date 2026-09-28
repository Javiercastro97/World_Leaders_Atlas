import { getRepo } from "@/server/repo";
import { error, isModerator, json } from "@/server/http";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/schema";

export async function GET(req: Request) {
  if (!isModerator(req)) return error(401, "No autorizado");
  const s = new URL(req.url).searchParams.get("status");
  const status = SUBMISSION_STATUSES.includes(s as SubmissionStatus) ? (s as SubmissionStatus) : undefined;
  const repo = await getRepo();
  return json({ submissions: await repo.listSubmissions(status), reports: await repo.listReports(), log: await repo.listLog() });
}
