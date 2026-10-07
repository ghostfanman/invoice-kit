// Regelbasierter 30-Tage-Plan mit höchstens zehn Aufgaben, abgeleitet aus den Befunden.

import type { Finding, LaunchPlan, LaunchPlanTask, PrioritizedTask, RepoSnapshot, UserContext } from "./types";

export function buildLaunchPlan(findings: Finding[], tasks: PrioritizedTask[], user: UserContext, snapshot: RepoSnapshot): LaunchPlan {
  const de = user.language === "de";
  const plan: LaunchPlanTask[] = [];
  const byId = new Map(findings.map((f) => [f.id, f]));

  // Woche 1 und 2: priorisierte Aufgaben aus dem Audit
  tasks.forEach((t, i) => {
    plan.push({
      week: i < 3 ? 1 : 2,
      title: t.title,
      why: t.task,
      effort: t.effort,
      signal: de ? "Befund ist bei erneutem Audit \"vorhanden\"" : "Finding is \"present\" in a repeat audit",
      findingIds: [t.findingId],
    });
  });

  const releasesMissing = byId.get("trust.releases@1")?.status === "missing";
  const archived = snapshot.meta.archived;

  if (!archived) {
    plan.push({
      week: 2,
      title: releasesMissing ? (de ? "Erstes Release vorbereiten" : "Prepare a first release") : (de ? "Nächstes Release vorbereiten" : "Prepare the next release"),
      why: de
        ? "Ein Release bündelt die Verbesserungen und gibt einen konkreten Anlass für die Ankündigung."
        : "A release bundles the improvements and gives a concrete reason for the announcement.",
      effort: de ? "30 bis 90 Min." : "30 to 90 min",
      signal: de ? "Release mit Notes veröffentlicht" : "Release with notes published",
      findingIds: releasesMissing ? ["trust.releases@1"] : [],
    });
    plan.push({
      week: 3,
      title: de ? "Release ankündigen" : "Announce the release",
      why: de
        ? "Kurze, ehrliche Ankündigung mit Nutzen, Installationsweg und Link. Keine Versprechen zu Reichweite."
        : "A short, honest announcement with benefit, installation path and link. No promises about reach.",
      effort: de ? "30 bis 60 Min." : "30 to 60 min",
      signal: de ? "Besuche und Rückfragen nach der Ankündigung (sofern messbar)" : "Visits and questions after the announcement (where measurable)",
      findingIds: [],
    });
    plan.push({
      week: 3,
      title: de ? "In einer passenden Entwicklercommunity vorstellen" : "Present it in a fitting developer community",
      why: de
        ? "Eine Community wählen, in der die Zielgruppe tatsächlich aktiv ist, und deren Regeln zu Eigenwerbung beachten."
        : "Pick one community where the audience is actually active and follow its self-promotion rules.",
      effort: de ? "30 bis 60 Min." : "30 to 60 min",
      signal: de ? "Qualifizierte Rückmeldungen, Issues oder Installationen" : "Qualified feedback, issues or installations",
      findingIds: [],
    });
  }
  plan.push({
    week: 4,
    title: de ? "Rückmeldungen auswerten" : "Review feedback",
    why: de
      ? "Fragen und Issues sammeln; die häufigste Frage direkt in der README beantworten."
      : "Collect questions and issues; answer the most frequent question directly in the README.",
    effort: de ? "30 bis 60 Min." : "30 to 60 min",
    signal: de ? "Anzahl wiederkehrender Fragen sinkt" : "Number of recurring questions decreases",
    findingIds: [],
  });
  plan.push({
    week: 4,
    title: de ? "Erneut auditieren und vergleichen" : "Re-run the audit and compare",
    why: de
      ? "Neuer Audit auf dem aktuellen Commit zeigt, welche Befunde erledigt sind."
      : "A new audit on the current commit shows which findings are resolved.",
    effort: de ? "5 bis 10 Min." : "5 to 10 min",
    signal: de ? "Weniger fehlende Befunde mit hoher Schwere" : "Fewer missing findings with high severity",
    findingIds: [],
  });
  return { basis: "rules", tasks: plan.slice(0, 10) };
}
