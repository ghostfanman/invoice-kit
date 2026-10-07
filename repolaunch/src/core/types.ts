// Gemeinsame Typen des Audit-Kerns. Der Kern ist unabhängig von Next.js und SQLite.

export const GOALS = ["users", "contributors", "sponsors", "support_clients", "saas_customers"] as const;
export type Goal = (typeof GOALS)[number];

export const PROJECT_TYPES = ["cli", "library", "webapp", "template", "other"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const LANGUAGES = ["de", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export type Localized = Record<Language, string>;

/** Angaben des Nutzers. Sie werden im Bericht getrennt von Repository-Belegen geführt. */
export interface UserContext {
  goal: Goal;
  language: Language;
  audience?: string;
  knownFeatures?: string;
  projectTypeOverride?: ProjectType;
}

/** Zustand einer einzelnen gelesenen Datei. "unknown" heißt: nicht geprüft oder nicht lesbar, nicht "fehlt". */
export type FileState =
  | { state: "present"; path: string; text: string; size: number; truncated: boolean }
  | { state: "missing"; path: string }
  | { state: "unknown"; path: string; reason: Localized };

export interface TreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
}

export interface ReleaseInfo {
  tag: string;
  name: string | null;
  publishedAt: string | null;
  prerelease: boolean;
  htmlUrl: string;
  hasNotes: boolean;
}

export interface RepoMeta {
  description: string | null;
  topics: string[];
  homepage: string | null;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  isTemplate: boolean;
  hasIssues: boolean;
  hasDiscussions: boolean;
  pushedAt: string | null;
  createdAt: string | null;
  license: { spdxId: string | null; name: string | null } | null;
}

export interface RequestStats {
  requests: number;
  notModified: number;
  bytes: number;
  durationMs: number;
}

/** Begrenzter, unveränderlicher Schnappschuss eines öffentlichen Repositorys zu einem Commit. */
export interface RepoSnapshot {
  schemaVersion: 1;
  source: "github" | "fixture";
  fixtureName?: string;
  owner: string;
  repo: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  commitSha: string;
  analyzedAt: string;
  meta: RepoMeta;
  /** Nur zur Anzeige. Sterne fließen in keine Bewertung ein. */
  display: { stars: number | null };
  tree: {
    entries: TreeEntry[];
    /** Verzeichnisse, deren Inhalt (nicht rekursiv) gelesen wurde. "" ist das Wurzelverzeichnis. */
    scannedDirs: string[];
    truncated: boolean;
  };
  readme: FileState;
  files: Record<string, FileState>;
  releases: { state: "present" | "missing" | "unknown"; items: ReleaseInfo[]; tagsFound: boolean | null; reason?: Localized };
  goodFirstIssues: { state: "present" | "missing" | "unknown" | "not_checked"; count: number; reason?: Localized };
  stats: RequestStats;
  notes: Localized[];
}

export type FindingStatus = "present" | "missing" | "unknown" | "not_relevant";
export type Severity = "high" | "medium" | "low" | "none";
export type Category = "understanding" | "usability" | "trust" | "distribution";

export interface Evidence {
  /** "field": API-Feld; "file": Dateiausschnitt; "absence": belegte Suche ohne Treffer; "note": Hinweis. */
  kind: "field" | "file" | "absence" | "note";
  label: string;
  url?: string;
  path?: string;
  lines?: [number, number];
  snippet?: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleVersion: number;
  category: Category;
  status: FindingStatus;
  severity: Severity;
  weight: number;
  title: string;
  evidence: Evidence[];
  rationale: string;
  task: string | null;
  effort: string | null;
  effortMinutes: [number, number] | null;
  impactHypothesis: string | null;
  /** Nur bei unknown oder not_relevant: warum die Regel nicht bewertet wurde. */
  exclusionReason?: string;
}

export interface ScoreBreakdown {
  category: Category;
  achieved: number;
  possible: number;
  unknownWeight: number;
}

export interface ReadinessScore {
  /** Interner Bereitschaftsscore 0 bis 100 oder null, wenn nichts bewertbar war. */
  value: number | null;
  achievedWeight: number;
  possibleWeight: number;
  unknownWeight: number;
  /** Anteil der relevanten Gewichte, die bewertet werden konnten (0 bis 1). */
  coverage: number;
  byCategory: ScoreBreakdown[];
  excluded: { ruleId: string; status: FindingStatus; reason: string }[];
  formula: string;
}

export interface ProjectClassification {
  detected: ProjectType;
  used: ProjectType;
  overridden: boolean;
  signals: { type: ProjectType; reason: string; evidence?: string }[];
}

export interface PrioritizedTask {
  rank: number;
  findingId: string;
  title: string;
  task: string;
  severity: Severity;
  effort: string;
  impactHypothesis: string;
}

export interface MonetizationOption {
  type: "sponsoring" | "paid_setup" | "support_maintenance" | "training" | "hosted_version" | "commercial_features";
  title: string;
  fit: "good" | "conditional" | "unlikely";
  reasons: string[];
  whoPays: string;
  forWhat: string;
  prerequisites: string[];
  effort: string;
  targetCustomers: string;
  priceHypothesis: string;
}

export interface MonetizationAssessment {
  required: boolean;
  summary: string;
  licenseNote: string;
  options: MonetizationOption[];
  disclaimers: string[];
}

export interface LaunchPlanTask {
  week: 1 | 2 | 3 | 4;
  title: string;
  why: string;
  effort: string;
  signal: string;
  findingIds: string[];
}

export interface LaunchPlan {
  basis: "rules";
  tasks: LaunchPlanTask[];
}

export interface InjectionFlag {
  path: string;
  line: number;
  pattern: string;
  excerpt: string;
}

export interface AuditResult {
  schemaVersion: 1;
  rulesetVersion: string;
  generatedAt: string;
  classification: ProjectClassification;
  findings: Finding[];
  tasks: PrioritizedTask[];
  score: ReadinessScore;
  monetization: MonetizationAssessment;
  launchPlan: LaunchPlan;
  injectionFlags: InjectionFlag[];
}
