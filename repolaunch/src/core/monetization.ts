// Regelbasierte Bewertung möglicher Einnahmewege. Keine Rechtsberatung, keine Umsatzversprechen.
// Preise sind Testhypothesen, keine erhobenen Marktpreise.

import type { Finding, Goal, Language, Localized, MonetizationAssessment, MonetizationOption, ProjectType, RepoSnapshot, UserContext } from "./types";

type OptionType = MonetizationOption["type"];

interface OptionText {
  title: Localized;
  whoPays: Localized;
  forWhat: Localized;
  prerequisites: Localized[];
  effort: Localized;
  targetCustomers: Localized;
  priceHypothesis: Localized;
}

const TEXT: Record<OptionType, OptionText> = {
  sponsoring: {
    title: { de: "Sponsoring", en: "Sponsoring" },
    whoPays: { de: "Einzelpersonen und Unternehmen, die das Projekt nutzen", en: "Individuals and companies that use the project" },
    forWhat: { de: "Fortbestand und Pflege des Projekts, ohne direkte Gegenleistung", en: "Continued existence and maintenance of the project, without a direct service in return" },
    prerequisites: [
      { de: "GitHub Sponsors: Teilnahmeberechtigung und Einrichtung durch dich (siehe GitHub-Dokumentation)", en: "GitHub Sponsors: eligibility and setup by you (see GitHub documentation)" },
      { de: ".github/FUNDING.yml und ein Hinweis in der README", en: ".github/FUNDING.yml and a note in the README" },
      { de: "Sichtbare, verlässliche Pflege", en: "Visible, reliable maintenance" },
    ],
    effort: { de: "1 bis 3 Std. Einrichtung, danach laufende Pflege der Sponsorenkommunikation", en: "1 to 3 h setup, then ongoing sponsor communication" },
    targetCustomers: { de: "Firmen mit Abhängigkeit vom Projekt, zufriedene Einzelnutzer", en: "Companies depending on the project, satisfied individual users" },
    priceHypothesis: { de: "Stufen von 5, 25 und 100 € pro Monat (Testhypothese)", en: "Tiers of 5, 25 and 100 EUR per month (test hypothesis)" },
  },
  paid_setup: {
    title: { de: "Bezahltes Setup", en: "Paid setup" },
    whoPays: { de: "Teams, die das Projekt einsetzen wollen, aber keine Zeit für Installation und Konfiguration haben", en: "Teams that want to use the project but lack time for installation and configuration" },
    forWhat: { de: "Installation, Konfiguration und Übergabe in ihrer Umgebung", en: "Installation, configuration and handover in their environment" },
    prerequisites: [
      { de: "Reproduzierbare Installation (z. B. Docker) und klare Grenzen des Angebots", en: "Reproducible installation (e.g. Docker) and clear scope of the offer" },
      { de: "Kontaktweg und Angebotsbeschreibung in README oder Website", en: "Contact channel and offer description in README or website" },
    ],
    effort: { de: "Je Kunde 2 bis 8 Std.", en: "2 to 8 h per customer" },
    targetCustomers: { de: "Kleine Firmen und Teams ohne eigenes Betriebsteam", en: "Small companies and teams without their own operations staff" },
    priceHypothesis: { de: "Einmalig 300 bis 1.500 € je Installation (Testhypothese)", en: "One-off 300 to 1,500 EUR per installation (test hypothesis)" },
  },
  support_maintenance: {
    title: { de: "Support und Wartung", en: "Support and maintenance" },
    whoPays: { de: "Unternehmen, die das Projekt produktiv einsetzen", en: "Companies that use the project in production" },
    forWhat: { de: "Verbindlichen Ansprechpartner, Reaktionszeiten, Updates und Fehlerbehebung", en: "A committed contact, response times, updates and bug fixing" },
    prerequisites: [
      { de: "Erkennbar gepflegtes Projekt mit Releases", en: "Visibly maintained project with releases" },
      { de: "Klar definierte Reaktionszeiten, die du einhalten kannst", en: "Clearly defined response times that you can keep" },
      { de: "Sicherheitsrichtlinie und Kontaktweg", en: "Security policy and contact channel" },
    ],
    effort: { de: "Laufend, je Kunde einige Stunden pro Monat", en: "Ongoing, a few hours per customer per month" },
    targetCustomers: { de: "Firmen mit geschäftskritischer Nutzung", en: "Companies with business-critical usage" },
    priceHypothesis: { de: "Ab 150 € pro Monat für einen festen Reaktionsrahmen (Testhypothese)", en: "From 150 EUR per month for a fixed response window (test hypothesis)" },
  },
  training: {
    title: { de: "Schulung", en: "Training" },
    whoPays: { de: "Teams, die das Projekt schneller oder tiefer nutzen wollen", en: "Teams that want to adopt the project faster or more deeply" },
    forWhat: { de: "Workshops, Einführungen oder Beratungsstunden", en: "Workshops, onboarding sessions or consulting hours" },
    prerequisites: [
      { de: "Dokumentation, auf die eine Schulung aufbauen kann", en: "Documentation that a training can build on" },
      { de: "Nachfrage, z. B. wiederkehrende Fragen in Issues", en: "Demand, e.g. recurring questions in issues" },
    ],
    effort: { de: "Vorbereitung 1 bis 3 Tage, danach je Termin", en: "1 to 3 days preparation, then per session" },
    targetCustomers: { de: "Teams in Unternehmen, Agenturen", en: "Teams in companies, agencies" },
    priceHypothesis: { de: "500 bis 1.500 € pro halbem Tag (Testhypothese)", en: "500 to 1,500 EUR per half day (test hypothesis)" },
  },
  hosted_version: {
    title: { de: "Gehostete Version", en: "Hosted version" },
    whoPays: { de: "Nutzer, die das Produkt ohne eigenen Betrieb verwenden wollen", en: "Users who want to use the product without running it themselves" },
    forWhat: { de: "Betrieb, Updates, Backups und Verfügbarkeit", en: "Operations, updates, backups and availability" },
    prerequisites: [
      { de: "Betriebsfähiges Webprodukt mit Mandantentrennung", en: "Operable web product with tenant separation" },
      { de: "Datenschutz, Impressum, AGB und Zahlungsabwicklung", en: "Privacy policy, legal notice, terms and payment processing" },
      { de: "Prüfung, ob Lizenz und Rechte Dritter ein gehostetes Angebot erlauben (keine Rechtsberatung)", en: "Check whether the license and third-party rights allow a hosted offer (not legal advice)" },
    ],
    effort: { de: "Hoch: Wochen bis Monate, danach laufender Betrieb", en: "High: weeks to months, then ongoing operations" },
    targetCustomers: { de: "Kleine Teams ohne IT-Betrieb", en: "Small teams without IT operations" },
    priceHypothesis: { de: "10 bis 30 € pro Monat und Team (Testhypothese)", en: "10 to 30 EUR per month and team (test hypothesis)" },
  },
  commercial_features: {
    title: { de: "Zusätzliche kommerzielle Funktionen", en: "Additional commercial features" },
    whoPays: { de: "Fortgeschrittene oder geschäftliche Nutzer", en: "Advanced or business users" },
    forWhat: { de: "Funktionen über den offenen Kern hinaus, z. B. Team- oder Integrationsfunktionen", en: "Features beyond the open core, e.g. team or integration features" },
    prerequisites: [
      { de: "Klare Trennung zwischen offenem Kern und kommerziellem Teil", en: "Clear separation between open core and commercial part" },
      { de: "Rechte an allen Beiträgen klären; keine automatische Lizenzänderung (keine Rechtsberatung)", en: "Clarify rights to all contributions; no automatic license change (not legal advice)" },
    ],
    effort: { de: "Mittel bis hoch, abhängig vom Funktionsumfang", en: "Medium to high, depending on scope" },
    targetCustomers: { de: "Unternehmen mit erweiterten Anforderungen", en: "Companies with advanced requirements" },
    priceHypothesis: { de: "50 bis 300 € pro Jahr und Lizenz (Testhypothese)", en: "50 to 300 EUR per year and license (test hypothesis)" },
  },
};

const PERMISSIVE = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "Zlib", "MPL-2.0", "BSL-1.0"];
const COPYLEFT = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0", "EUPL-1.2", "GPL-2.0-only", "GPL-3.0-only", "AGPL-3.0-only", "GPL-3.0-or-later", "AGPL-3.0-or-later"];

type Fit = MonetizationOption["fit"];

function fitFor(type: OptionType, p: ProjectType, goal: Goal, maintained: boolean, archived: boolean, hasDocs: boolean, selfHostable: boolean): { fit: Fit; reasons: Localized[] } {
  if (archived) return { fit: "unlikely", reasons: [{ de: "Repository ist archiviert.", en: "Repository is archived." }] };
  const r: Localized[] = [];
  switch (type) {
    case "sponsoring":
      if (goal === "sponsors") return { fit: "good", reasons: [{ de: "Dein Ziel ist Sponsoring.", en: "Your goal is sponsoring." }] };
      if ((p === "library" || p === "cli") && maintained) return { fit: "conditional", reasons: [{ de: "Bibliotheken und CLIs mit vielen Nutzern erhalten am ehesten Sponsoring.", en: "Libraries and CLIs with many users are most likely to receive sponsorship." }] };
      return { fit: "conditional", reasons: [{ de: "Möglich, aber meist geringe Beträge.", en: "Possible, but usually small amounts." }] };
    case "paid_setup":
      if (p === "library") return { fit: "unlikely", reasons: [{ de: "Bibliotheken werden selten aufwendig eingerichtet.", en: "Libraries rarely need elaborate setup." }] };
      if ((p === "webapp" || p === "template") && selfHostable) {
        r.push({ de: "Selbst hostbares Produkt (Docker-Dateien gefunden).", en: "Self-hostable product (Docker files found)." });
        return { fit: goal === "support_clients" || goal === "saas_customers" ? "good" : "conditional", reasons: r };
      }
      return { fit: "conditional", reasons: [{ de: "Nur sinnvoll, wenn die Einrichtung für Kunden spürbar aufwendig ist.", en: "Only useful if setup is noticeably laborious for customers." }] };
    case "support_maintenance":
      if (!maintained) return { fit: "unlikely", reasons: [{ de: "Ohne erkennbare Pflege ist Support schwer glaubwürdig.", en: "Without visible maintenance, support is hard to make credible." }] };
      if (goal === "support_clients") return { fit: "good", reasons: [{ de: "Dein Ziel sind Supportkunden und das Projekt wird gepflegt.", en: "Your goal is support customers and the project is maintained." }] };
      return { fit: "conditional", reasons: [{ de: "Möglich, sobald Unternehmen das Projekt produktiv nutzen.", en: "Possible once companies use the project in production." }] };
    case "training":
      if (p === "template" || p === "other") return { fit: "unlikely", reasons: [{ de: "Für diesen Projekttyp gibt es selten Schulungsbedarf.", en: "This project type rarely needs training." }] };
      return { fit: hasDocs ? "conditional" : "unlikely", reasons: [hasDocs ? { de: "Dokumentation vorhanden, auf die Schulungen aufbauen können.", en: "Documentation exists that training can build on." } : { de: "Ohne Dokumentation fehlt die Grundlage.", en: "Without documentation there is no foundation." }] };
    case "hosted_version":
      if (p !== "webapp") return { fit: "unlikely", reasons: [{ de: "Nur für Webprodukte naheliegend.", en: "Only obvious for web products." }] };
      return { fit: goal === "saas_customers" ? "good" : "conditional", reasons: [{ de: "Webprodukt; gehosteter Betrieb verkauft Komfort.", en: "Web product; hosted operation sells convenience." }] };
    case "commercial_features":
      if (goal === "users" || goal === "contributors") return { fit: "unlikely", reasons: [{ de: "Passt nicht zu deinem Ziel.", en: "Does not fit your goal." }] };
      if (p === "webapp" || p === "cli") return { fit: "conditional", reasons: [{ de: "Möglich als offener Kern mit Zusatzfunktionen; Rechte an Beiträgen vorher klären.", en: "Possible as open core with add-ons; clarify rights to contributions first." }] };
      return { fit: "unlikely", reasons: [{ de: "Für diesen Projekttyp schwer abgrenzbar.", en: "Hard to separate for this project type." }] };
  }
}

export function assessMonetization(snapshot: RepoSnapshot, user: UserContext, projectType: ProjectType, findings: Finding[]): MonetizationAssessment {
  const lang: Language = user.language;
  const status = (id: string) => findings.find((f) => f.ruleId === id)?.status;
  const maintained = status("trust.maintenance") !== "missing";
  const hasDocs = status("usability.docs") === "present";
  const rootFiles = snapshot.tree.entries.map((e) => e.path.toLowerCase());
  const selfHostable = rootFiles.some((f) => ["dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"].includes(f));
  const archived = snapshot.meta.archived;

  const order: Record<Fit, number> = { good: 0, conditional: 1, unlikely: 2 };
  const options: MonetizationOption[] = (Object.keys(TEXT) as OptionType[])
    .map((type) => {
      const t = TEXT[type];
      const { fit, reasons } = fitFor(type, projectType, user.goal, maintained, archived, hasDocs, selfHostable);
      return {
        type,
        title: t.title[lang],
        fit,
        reasons: reasons.map((x) => x[lang]),
        whoPays: t.whoPays[lang],
        forWhat: t.forWhat[lang],
        prerequisites: t.prerequisites.map((x) => x[lang]),
        effort: t.effort[lang],
        targetCustomers: t.targetCustomers[lang],
        priceHypothesis: t.priceHypothesis[lang],
      };
    })
    .sort((a, b) => order[a.fit] - order[b.fit]);

  const spdx = snapshot.meta.license?.spdxId ?? null;
  let licenseNote: string;
  if (!spdx || spdx === "NOASSERTION") {
    licenseNote = lang === "de"
      ? "Keine Lizenz automatisch erkannt. Ohne klare Lizenz ist die Nutzung durch andere rechtlich unklar; das bremst jede Monetarisierung über Nutzer. Keine Rechtsberatung."
      : "No license detected automatically. Without a clear license, use by others is legally unclear, which hinders any user-based monetisation. Not legal advice.";
  } else if (PERMISSIVE.includes(spdx)) {
    licenseNote = lang === "de"
      ? `Erkannte Lizenz: ${spdx} (GitHub-Lizenzerkennung). Freizügige Lizenzen erlauben in der Regel auch Dritten kommerzielle Nutzung, einschließlich eigener gehosteter Angebote. Keine Rechtsberatung.`
      : `Detected license: ${spdx} (GitHub license detection). Permissive licenses usually also allow third parties commercial use, including their own hosted offers. Not legal advice.`;
  } else if (COPYLEFT.includes(spdx)) {
    licenseNote = lang === "de"
      ? `Erkannte Lizenz: ${spdx} (GitHub-Lizenzerkennung). Copyleft-Lizenzen haben Auswirkungen auf Weitergabe und bei AGPL auch auf Netzwerknutzung. Auswirkungen auf kommerzielle Angebote und Beiträge Dritter rechtlich prüfen lassen. Keine Rechtsberatung.`
      : `Detected license: ${spdx} (GitHub license detection). Copyleft licenses affect redistribution and, for AGPL, network use. Have the effects on commercial offers and third-party contributions reviewed legally. Not legal advice.`;
  } else {
    licenseNote = lang === "de"
      ? `Erkannte Lizenz: ${spdx}. Bedingungen für kommerzielle Nutzung im Lizenztext prüfen. Keine Rechtsberatung.`
      : `Detected license: ${spdx}. Check the license text for commercial-use conditions. Not legal advice.`;
  }

  const required = user.goal === "sponsors" || user.goal === "support_clients" || user.goal === "saas_customers";
  const summary = archived
    ? lang === "de" ? "Das Repository ist archiviert. Einnahmewege setzen voraus, dass das Projekt wieder gepflegt wird." : "The repository is archived. Revenue options require the project to be maintained again."
    : required
      ? lang === "de" ? "Dein Ziel erfordert einen Einnahmeweg. Die Einordnung unten beruht auf Projekttyp, Wartungsstatus und Lizenzinformationen." : "Your goal requires a revenue option. The assessment below is based on project type, maintenance status and license information."
      : lang === "de" ? "Für dein Ziel ist kein Geschäftsmodell erforderlich. Nicht jedes Repository braucht eines; die Optionen dienen nur der Orientierung." : "Your goal does not require a business model. Not every repository needs one; the options are for orientation only.";

  const disclaimers = lang === "de"
    ? [
        "Preise sind Testhypothesen, keine erhobenen Marktpreise.",
        "Keine Rechtsberatung. Bestehende Lizenzen, Rechte Dritter und Beiträge anderer beachten.",
        "Keine automatische Lizenzänderung; Dual Licensing wird nicht pauschal empfohlen.",
        "GitHub Sponsors setzt Teilnahmeberechtigung und Einrichtung durch den Maintainer voraus.",
        "Die Analyse eines öffentlichen Repositorys ist keine Erlaubnis, dessen Inhalte kommerziell weiterzuverwenden.",
      ]
    : [
        "Prices are test hypotheses, not surveyed market prices.",
        "Not legal advice. Respect existing licenses, third-party rights and contributions by others.",
        "No automatic license change; dual licensing is not recommended across the board.",
        "GitHub Sponsors requires eligibility and setup by the maintainer.",
        "Analysing a public repository does not grant permission to reuse its contents commercially.",
      ];

  return { required, summary, licenseNote, options, disclaimers };
}
