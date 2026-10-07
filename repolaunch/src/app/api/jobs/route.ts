import { getApp } from "@/server/app";
import { fromResult, json, readJsonBody, sameOriginOk } from "@/server/http";
import { createJob } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!sameOriginOk(req)) return json(403, { error: "invalid_request" });
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  return fromResult(createJob(getApp(), body.body, req.headers));
}
