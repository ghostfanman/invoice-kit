import { getApp } from "@/server/app";
import { fromResult } from "@/server/http";
import { exportJob } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const r = exportJob(getApp(), id, req.headers);
  if (!r.ok) return fromResult(r);
  return new Response(new Blob([r.body.zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${r.body.filename}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
