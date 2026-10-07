import { getApp } from "@/server/app";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const app = getApp();
    app.db.prepare("SELECT 1").get();
    return json(200, { ok: true, activeJobs: app.store.activeCount(), ai: app.provider ? app.provider.id : "none", demo: app.config.demoMode });
  } catch {
    return json(503, { ok: false });
  }
}
