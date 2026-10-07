// Erkennt den Projekttyp aus Manifesten, Topics, Dateiliste und Beschreibung.
// Jedes Signal wird mit Begründung ausgegeben, damit die Einordnung nachvollziehbar bleibt.

import type { ProjectClassification, ProjectType, RepoSnapshot } from "../types";
import { readManifests } from "./manifests";

const WEB_FRAMEWORKS = ["next", "nuxt", "@remix-run/react", "@sveltejs/kit", "astro", "react-scripts", "vite", "@angular/core", "express", "fastify", "django", "flask", "rails", "laravel/framework"];

export function classifyProject(snapshot: RepoSnapshot, override?: ProjectType): ProjectClassification {
  const scores: Record<ProjectType, number> = { cli: 0, library: 0, webapp: 0, template: 0, other: 0 };
  const signals: ProjectClassification["signals"] = [];
  const add = (type: ProjectType, points: number, reason: string, evidence?: string) => {
    scores[type] += points;
    signals.push({ type, reason, evidence });
  };

  const topics = snapshot.meta.topics.map((t) => t.toLowerCase());
  const desc = (snapshot.meta.description ?? "").toLowerCase();
  const name = snapshot.repo.toLowerCase();
  const rootFiles = snapshot.tree.entries.filter((e) => !e.path.includes("/")).map((e) => e.path.toLowerCase());

  if (snapshot.meta.isTemplate) add("template", 5, "Repository ist als Template markiert", "API-Feld is_template");
  if (topics.some((t) => ["template", "boilerplate", "starter", "starter-kit", "scaffold"].includes(t))) add("template", 3, "Topic weist auf eine Vorlage hin", "Topics");
  if (/\b(template|boilerplate|starter)\b/.test(name)) add("template", 2, "Name weist auf eine Vorlage hin", "Repository-Name");

  for (const m of readManifests(snapshot)) {
    if (m.hasBin) add("cli", 4, `Manifest definiert ausführbare Befehle (${m.binNames.slice(0, 3).join(", ")})`, m.path);
    if (m.isLibrary && !m.isPrivate && m.ecosystem !== "go") add("library", 3, "Manifest beschreibt ein importierbares Paket", m.path);
    if (m.ecosystem === "go" && m.isLibrary) add("library", 2, "Go-Modul ohne main-Paket im Wurzelverzeichnis", m.path);
    const web = m.dependencies.filter((d) => WEB_FRAMEWORKS.includes(d));
    if (web.length > 0) add("webapp", m.isPrivate ? 4 : 2, `Web-Framework als Abhängigkeit (${web.slice(0, 3).join(", ")})`, m.path);
    if (m.isPrivate) add("webapp", 1, "Paket ist als private markiert und nicht zur Veröffentlichung gedacht", m.path);
    if (m.ecosystem === "github-action") add("other", 3, "GitHub Action (action.yml)", m.path);
  }

  if (topics.some((t) => ["cli", "command-line", "command-line-tool", "terminal", "cli-tool"].includes(t))) add("cli", 3, "Topic weist auf ein CLI hin", "Topics");
  if (/\b(cli|command[- ]line|terminal)\b/.test(desc)) add("cli", 2, "Beschreibung nennt Kommandozeile", "Beschreibung");
  if (topics.some((t) => ["library", "sdk", "package", "npm-package", "python-library", "crate"].includes(t))) add("library", 3, "Topic weist auf eine Bibliothek hin", "Topics");
  if (/\b(library|sdk|package|bibliothek)\b/.test(desc)) add("library", 2, "Beschreibung nennt Bibliothek oder Paket", "Beschreibung");
  if (topics.some((t) => ["saas", "webapp", "web-app", "self-hosted", "selfhosted", "dashboard"].includes(t))) add("webapp", 3, "Topic weist auf ein Webprodukt hin", "Topics");
  if (/\b(web ?app|saas|self-hosted|dashboard|platform)\b/.test(desc)) add("webapp", 2, "Beschreibung nennt Webprodukt", "Beschreibung");
  if (rootFiles.includes("docker-compose.yml") || rootFiles.includes("compose.yaml") || rootFiles.includes("docker-compose.yaml")) add("webapp", 2, "Docker-Compose-Datei im Wurzelverzeichnis", "Dateiliste");
  if (rootFiles.includes("index.html")) add("webapp", 1, "index.html im Wurzelverzeichnis", "Dateiliste");

  let detected: ProjectType = "other";
  let best = 0;
  for (const t of ["template", "cli", "webapp", "library", "other"] as ProjectType[]) {
    if (scores[t] > best) {
      best = scores[t];
      detected = t;
    }
  }
  if (best < 2) detected = "other";
  return { detected, used: override ?? detected, overridden: Boolean(override && override !== detected), signals };
}
