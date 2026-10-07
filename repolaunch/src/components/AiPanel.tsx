"use client";

import { useId, useState } from "react";
import { AI_SECTIONS, type AiSection } from "@/core/ai/types";
import type { Language } from "@/core/types";
import { t } from "@/i18n/messages";
import type { JobView } from "@/server/service";


export function AiPanel({ lang, view, onStart }: { lang: Language; view: JobView; onStart: (sections: string[]) => Promise<string | null> }) {
  const m = t(lang);
  const ids = useId();
  const ai = view.ai;
  const av = ai.availability;
  const [sections, setSections] = useState<AiSection[]>(["readme", "descriptionTopics", "plan30", "launchTexts", "monetization"]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = av.disclosure;
  const canStart = av.configured && av.runsLeft > 0 && (ai.status === "none" || ai.status === "failed" || ai.status === "done");

  async function start() {
    setBusy(true);
    setError(await onStart(sections));
    setBusy(false);
  }

  return (
    <section aria-labelledby={`${ids}-h`} className="panel">
      <h2 id={`${ids}-h`}>{m.ai.heading}</h2>
      <p>{m.ai.intro}</p>
      {!av.configured && <p className="notice">{m.ai.notConfigured}</p>}

      {ai.status === "queued" || ai.status === "running" ? (
        <p className="status-line" role="status">
          <span className="spinner" aria-hidden="true" /> {ai.status === "queued" ? m.ai.queued : m.ai.running}
        </p>
      ) : null}
      {ai.status === "failed" && (
        <p className="notice bad" role="alert">
          {m.ai.failed}: {m.aiErrors[ai.errorCode ?? "internal_error"] ?? ai.errorCode}
        </p>
      )}
      {ai.status === "done" && ai.result && <AiResult lang={lang} view={view} />}

      {canStart && d && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (consent && sections.length > 0) void start();
          }}
        >
          {d.isTestAdapter && <p className="notice warn">{m.ai.fakeProvider}</p>}
          <h3>{m.ai.dataSent}</h3>
          <dl className="meta">
            <dt>{m.ai.provider}</dt>
            <dd>{d.provider}</dd>
            <dt>{m.ai.model}</dt>
            <dd>
              <code>{d.model}</code>
            </dd>
            <dt>{m.ai.endpoint}</dt>
            <dd>
              <code>{d.endpointHost}</code>
            </dd>
          </dl>
          <ul>
            {d.items.map((item) => (
              <li key={item.id}>
                {item.label[lang]}: {item.chars.toLocaleString(lang === "de" ? "de-DE" : "en-GB")} {m.ai.chars}
                {item.note ? ` (${item.note[lang]})` : ""}
              </li>
            ))}
          </ul>
          <p>
            {m.ai.redacted}: {d.redactedLines}
          </p>
          <h3>{m.ai.limits}</h3>
          <ul>
            <li>
              {m.ai.maxInput}: {d.limits.maxInputChars.toLocaleString()} {m.ai.chars}
            </li>
            <li>
              {m.ai.maxOutput}: {d.limits.maxOutputTokens.toLocaleString()} Token
            </li>
            <li>
              {m.ai.timeout}: {Math.round(d.limits.timeoutMs / 1000)} s
            </li>
            <li>
              {m.ai.budget}: {d.limits.maxCostUsd} USD
              {d.worstCaseCostUsd !== null ? ` (${lang === "de" ? "höchstens geschätzt" : "estimated maximum"} ${d.worstCaseCostUsd} USD)` : ""}
            </li>
          </ul>
          <fieldset>
            <legend>{m.ai.sections}</legend>
            {AI_SECTIONS.map((s) => (
              <label key={s} className="checkbox">
                <input
                  type="checkbox"
                  checked={sections.includes(s)}
                  onChange={(e) => setSections((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))}
                />
                <span>{m.ai.sectionLabels[s]}</span>
              </label>
            ))}
          </fieldset>
          <label className="checkbox">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>{m.ai.consent}</span>
          </label>
          {error && (
            <p className="notice bad" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" disabled={!consent || sections.length === 0 || busy} aria-busy={busy}>
              {m.ai.start}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function AiResult({ lang, view }: { lang: Language; view: JobView }) {
  const m = t(lang);
  const r = view.ai.result!;
  const o = r.output;
  const unverified = r.checks.filter((c) => c.status === "unverified");
  return (
    <div>
      <p className="notice ok" role="status">
        {m.ai.done}. {m.ai.provider}: {r.provider}, {m.ai.model}: <code>{r.model}</code>. {m.ai.cost}:{" "}
        {r.cost.estimatedUsd === null ? "?" : `${r.cost.estimatedUsd} USD`} ({r.cost.inputTokens} in, {r.cost.outputTokens} out). {r.cost.note[lang]}
      </p>
      {r.isTestAdapter && <p className="notice warn">{m.ai.fakeProvider}</p>}
      {unverified.length > 0 && (
        <details open>
          <summary>
            {m.ai.checks}: {unverified.length} {m.ai.unverified.toLowerCase()}
          </summary>
          <ul>
            {unverified.map((c, i) => (
              <li key={i}>
                <strong>{m.ai.unverified}</strong> ({c.kind}, {c.section}): <code>{c.value}</code>. {c.reason[lang]}
              </li>
            ))}
          </ul>
        </details>
      )}
      {o.readme && (
        <details>
          <summary>README.suggested.md ({m.ai.preview})</summary>
          <pre>{r.readmeAnnotated ?? o.readme.markdown}</pre>
        </details>
      )}
      {o.descriptionTopics && (
        <details>
          <summary>{m.ai.sectionLabels.descriptionTopics}</summary>
          <pre>{o.descriptionTopics.description}</pre>
          <p>Topics: {o.descriptionTopics.topics.join(", ")}</p>
          <p className="muted">{o.descriptionTopics.rationale}</p>
        </details>
      )}
      {o.plan30 && (
        <details>
          <summary>{m.ai.sectionLabels.plan30}</summary>
          <ol>
            {o.plan30.tasks.map((x, i) => (
              <li key={i}>
                {m.report.week} {x.week}: <strong>{x.title}</strong> ({x.effort}). {x.why}
              </li>
            ))}
          </ol>
        </details>
      )}
      {o.launchTexts && (
        <details>
          <summary>{m.ai.sectionLabels.launchTexts}</summary>
          <h4>LinkedIn</h4>
          <pre>{o.launchTexts.linkedin}</pre>
          <h4>{o.launchTexts.community.name}</h4>
          <pre>{o.launchTexts.community.text}</pre>
          <h4>Release</h4>
          <pre>{o.launchTexts.releaseAnnouncement}</pre>
        </details>
      )}
      {o.monetization && (
        <details>
          <summary>{m.ai.sectionLabels.monetization}</summary>
          {o.monetization.options.map((x, i) => (
            <div key={i}>
              <h4>{x.title}</h4>
              <p>
                {m.report.whoPays}: {x.whoPays}. {m.report.forWhat}: {x.forWhat}. {m.report.priceHypothesis}: {x.priceHypothesis}
              </p>
            </div>
          ))}
        </details>
      )}
      {o.landingPage && (
        <details>
          <summary>{m.ai.sectionLabels.landingPage}</summary>
          <pre>{o.landingPage.markdown}</pre>
        </details>
      )}
      {o.openQuestions.length > 0 && (
        <>
          <h3>{m.ai.openQuestions}</h3>
          <ul>
            {o.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
