import { ALL_TERRITORIES } from "@/lib/territories";
import { json } from "@/server/http";

export const dynamic = "force-static";

export function GET() {
  return json({ territories: ALL_TERRITORIES }, { cache: "public", maxAge: 86400 });
}
