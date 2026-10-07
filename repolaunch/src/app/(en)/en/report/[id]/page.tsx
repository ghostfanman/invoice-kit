import type { Metadata } from "next";
import { ReportClient } from "@/components/ReportClient";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RepoLaunch",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Shell lang="en" switchHref={`/report/${id}`}>
      <ReportClient lang="en" id={id} />
    </Shell>
  );
}
