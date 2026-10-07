import { getApp } from "@/server/app";
import { fromResult, json, readJsonBody, sameOriginOk } from "@/server/http";
import { requestAi } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!sameOriginOk(req)) return json(403, { error: "invalid_request" });
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  return fromResult(requestAi(getApp(), id, body.body, req.headers));
}
