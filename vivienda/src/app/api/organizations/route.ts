import { z } from "zod";
import { ORG_TYPES } from "@/lib/vocab";
import { getRepo } from "@/server/repo";
import { queryObject, resolveTerritory } from "@/server/params";
import { error, json, zodError } from "@/server/http";

const Q = z.object({
  territory: z.string().optional(),
  province: z.string().optional(),
  type: z.enum(ORG_TYPES).optional(),
  q: z.string().max(80).optional(),
});

export async function GET(req: Request) {
  const parsed = Q.safeParse(queryObject(new URL(req.url)));
  if (!parsed.success) return zodError(parsed.error);
  const tp = parsed.data.territory ?? parsed.data.province;
  const territory = resolveTerritory(tp);
  if (tp && !territory) return error(400, `Territorio desconocido: ${tp}`);
  const repo = await getRepo();
  const orgs = await repo.listOrganizations({ territory: territory ?? undefined, type: parsed.data.type, q: parsed.data.q });
  const sources = new Map((await repo.listSources()).map((s) => [s.id, s]));
  return json(
    {
      organizations: orgs.map((o) => ({ ...o, source: sources.get(o.source_id) ?? null })),
      meta: { count: orgs.length },
    },
    { cache: "public", maxAge: 300 },
  );
}
