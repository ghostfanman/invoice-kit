import { getApp } from "@/server/app";
import { fromResult, json, sameOriginOk } from "@/server/http";
import { deleteJob, getJobView } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  return fromResult(getJobView(getApp(), id, req.headers));
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  if (!sameOriginOk(req)) return json(403, { error: "invalid_request" });
  const { id } = await ctx.params;
  return fromResult(deleteJob(getApp(), id, req.headers));
}
