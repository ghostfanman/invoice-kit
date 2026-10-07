"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { parseRepoInput } from "@/core/repo-input";
import { GOALS, PROJECT_TYPES, type Goal, type Language, type ProjectType } from "@/core/types";
import { t } from "@/i18n/messages";

interface Props {
  lang: Language;
  demos: { name: string; title: string }[];
}

export function HomeForm({ lang, demos }: Props) {
  const m = t(lang);
  const router = useRouter();
  const ids = useId();
  const [repo, setRepo] = useState("");
  const [goal, setGoal] = useState<Goal>("users");
  const [reportLang, setReportLang] = useState<Language>(lang);
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  const [audience, setAudience] = useState("");
  const [features, setFeatures] = useState("");
  const [repoError, setRepoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const repoRef = useRef<HTMLInputElement>(null);

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          goal,
          language: reportLang,
          audience: audience.trim() || undefined,
          knownFeatures: features.trim() || undefined,
          projectType: projectType || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; key?: string; error?: string; detail?: string };
      if (res.ok && data.id && data.key) {
        const prefix = reportLang === "en" ? "/en" : "";
        router.push(`${prefix}/report/${data.id}#k=${data.key}`);
        return;
      }
      if (data.error === "invalid_repo" && data.detail) {
        setRepoError(m.inputErrors[data.detail] ?? m.apiErrors.invalid_request!);
        repoRef.current?.focus();
      } else {
        setFormError(m.apiErrors[data.error ?? "unknown"] ?? m.apiErrors.unknown!);
      }
    } catch {
      setFormError(m.apiErrors.network!);
    }
    setBusy(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = parseRepoInput(repo);
    if (!r.ok) {
      setRepoError(m.inputErrors[r.error] ?? m.apiErrors.invalid_request!);
      repoRef.current?.focus();
      return;
    }
    setRepoError(null);
    void submit({ repo: `${r.owner}/${r.repo}` });
  }

  const repoId = `${ids}-repo`;
  return (
    <section aria-labelledby={`${ids}-h`}>
      <h2 id={`${ids}-h`}>{m.form.heading}</h2>
      <form className="panel" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={repoId}>{m.form.repoLabel}</label>
          <input
            ref={repoRef}
            id={repoId}
            name="repo"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="owner/repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            aria-invalid={repoError ? true : undefined}
            aria-describedby={`${repoId}-hint${repoError ? ` ${repoId}-err` : ""}`}
            required
            maxLength={200}
          />
          <span id={`${repoId}-hint`} className="hint">
            {m.form.repoHelp}
          </span>
          {repoError && (
            <p id={`${repoId}-err`} className="error-text">
              {repoError}
            </p>
          )}
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor={`${ids}-goal`}>{m.form.goalLabel}</label>
            <select id={`${ids}-goal`} value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {m.goals[g]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${ids}-lang`}>{m.form.languageLabel}</label>
            <select id={`${ids}-lang`} value={reportLang} onChange={(e) => setReportLang(e.target.value as Language)}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-type`}>{m.form.typeLabel}</label>
          <select id={`${ids}-type`} value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType | "")}>
            <option value="">{m.form.typeAuto}</option>
            {PROJECT_TYPES.map((p) => (
              <option key={p} value={p}>
                {m.projectTypes[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-aud`}>{m.form.audienceLabel}</label>
          <input id={`${ids}-aud`} type="text" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={500} aria-describedby={`${ids}-aud-hint`} />
          <span id={`${ids}-aud-hint`} className="hint">
            {m.form.audienceHelp}
          </span>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-feat`}>{m.form.featuresLabel}</label>
          <textarea id={`${ids}-feat`} value={features} onChange={(e) => setFeatures(e.target.value)} maxLength={2000} aria-describedby={`${ids}-feat-hint`} />
          <span id={`${ids}-feat-hint`} className="hint">
            {m.form.featuresHelp}
          </span>
        </div>
        {formError && (
          <p className="notice bad" role="alert">
            {formError}
          </p>
        )}
        <div className="actions">
          <button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? m.form.submitting : m.form.submit}
          </button>
        </div>
      </form>

      {demos.length > 0 && (
        <section className="panel" aria-labelledby={`${ids}-demo`}>
          <h2 id={`${ids}-demo`}>{m.form.demoHeading}</h2>
          <p>{m.form.demoText}</p>
          <div className="actions">
            {demos.map((d) => (
              <button key={d.name} type="button" className="secondary" disabled={busy} onClick={() => void submit({ fixture: d.name })}>
                {m.form.demoButton}: {d.title}
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
