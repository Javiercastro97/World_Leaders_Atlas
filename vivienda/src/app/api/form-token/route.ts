import { issueFormToken } from "@/lib/antispam";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Sello temporal firmado para formularios públicos (anti-spam sin captcha ni cookies). */
export function GET() {
  return json({ token: issueFormToken() });
}
