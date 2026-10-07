"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Language } from "@/core/types";
import { t } from "@/i18n/messages";
import type { JobView } from "@/server/service";
import { AiPanel } from "./AiPanel";
import { ReportView } from "./ReportView";

function readKey(): string | null {
  const m = window.location.hash.match(/(?:^#|&)k=([A-Za-z0-9_-]{43})(?:&|$)/);
  return m ? m[1]! : null;
}

function subscribeHash(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function ReportClient({ lang, id }: { lang: Language; id: string }) {
  const m = t(lang);
  // undefined = noch nicht geprüft (Server-Rendering), null = kein Schlüssel im Link
  const hashKey = useSyncExternalStore(subscribeHash, readKey, () => undefined);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const key = hashKey ?? savedKey;
  const [view, setView] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((x) => x + 1), []);

  // Schlüssel merken, falls das Fragment später durch eine Navigation ersetzt wird.
  if (hashKey && hashKey !== savedKey) setSavedKey(hashKey);

  useEffect(() => {
    if (!key || deleted) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(m.apiErrors[(data as { error?: string }).error ?? "unknown"] ?? m.apiErrors.unknown!);
          return;
        }
        setError(null);
        const v = data as JobView;
        setView(v);
        const busy = v.status === "queued" || v.status === "running" || v.ai.status === "queued" || v.ai.status === "running";
        if (busy) timer = setTimeout(refresh, 1500);
      } catch {
        if (cancelled) return;
        setError(m.apiErrors.network!);
        timer = setTimeout(refresh, 5000);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, key, m, tick, refresh, deleted]);

  async function download() {
    if (!key) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/export`, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(m.apiErrors[(data as { error?: string }).error ?? "unknown"] ?? m.apiErrors.unknown!);
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "repolaunch-export.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError(m.apiErrors.network!);
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    if (!key || !window.confirm(m.report.deleteConfirm)) return;
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    if (res.status === 204) {
      setDeleted(true);
      setView(null);
      history.replaceState(null, "", window.location.pathname);
    } else {
      setError(m.apiErrors.unknown!);
    }
  }

  async function startAi(sections: string[]): Promise<string | null> {
    if (!key) return m.apiErrors.unknown!;
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ consent: true, sections }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return m.apiErrors[(data as { error?: string }).error ?? "unknown"] ?? m.apiErrors.unknown!;
    }
    refresh();
    return null;
  }

  const home = lang === "de" ? "/" : "/en";
  if (deleted) {
    return (
      <>
        <h1>{m.report.heading}</h1>
        <p className="notice ok" role="status">
          {m.report.deleted}
        </p>
        <p>
          <a href={home}>{m.job.retry}</a>
        </p>
      </>
    );
  }
  if (hashKey === null && !savedKey) {
    return (
      <>
        <h1>{m.report.heading}</h1>
        <p className="notice bad" role="alert">
          {m.job.missingKey}
        </p>
        <p>
          <a href={home}>{m.job.retry}</a>
        </p>
      </>
    );
  }

  const statusText = view ? m.job[view.status] : m.job.loading;
  const busy = !view || view.status === "queued" || view.status === "running";
  return (
    <>
      <h1>
        {m.report.heading}
        {view ? `: ${view.input.source === "fixture" ? `Demo ${view.input.fixtureName}` : `${view.input.owner}/${view.input.repo}`}` : ""}
      </h1>
      <div role="status" aria-live="polite" className="status-line">
        {busy && <span className="spinner" aria-hidden="true" />}
        <span>{statusText}</span>
      </div>
      {error && (
        <p className="notice bad" role="alert">
          {error}
        </p>
      )}
      {view && (
        <>
          <p className="notice">
            {m.job.keepLink} {m.job.expires} <time dateTime={view.expiresAt}>{new Date(view.expiresAt).toLocaleString(lang === "de" ? "de-DE" : "en-GB")}</time>.
          </p>
          {view.status === "failed" && (
            <div className="notice bad" role="alert">
              <p>{m.jobErrors[view.errorCode ?? "internal_error"] ?? m.jobErrors.internal_error}</p>
              <p>
                <a href={home}>{m.job.retry}</a>
              </p>
            </div>
          )}
          {view.status === "done" && view.audit && view.snapshot && (
            <>
              <ReportView lang={lang} view={view} />
              <AiPanel lang={lang} view={view} onStart={startAi} />
              <section aria-labelledby="export-h">
                <h2 id="export-h">Export</h2>
                <p>{m.report.exportContents}</p>
                <div className="actions">
                  <button type="button" onClick={() => void download()} disabled={downloading} aria-busy={downloading}>
                    {downloading ? m.report.downloading : m.report.download}
                  </button>
                  <button type="button" className="danger" onClick={() => void remove()}>
                    {m.report.delete}
                  </button>
                </div>
              </section>
            </>
          )}
          {view.status !== "done" && (
            <div className="actions">
              <button type="button" className="danger" onClick={() => void remove()}>
                {m.report.delete}
              </button>
            </div>
          )}
          <details>
            <summary>{m.job.events}</summary>
            <ol>
              {view.events.map((e, i) => (
                <li key={i}>
                  <time dateTime={e.at}>{new Date(e.at).toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB")}</time> {e.type}
                  {e.detail ? `: ${e.detail}` : ""}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </>
  );
}
