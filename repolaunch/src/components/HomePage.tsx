import { DEMO_FIXTURES, FIXTURE_REPOS } from "@/fixtures/repos";
import type { Language } from "@/core/types";
import { t } from "@/i18n/messages";
import { getConfig } from "@/server/config";
import { HomeForm } from "./HomeForm";
import { Shell } from "./Shell";

export function HomePage({ lang }: { lang: Language }) {
  const m = t(lang);
  const cfg = getConfig();
  const demos = cfg.demoMode ? DEMO_FIXTURES.map((name) => ({ name, title: FIXTURE_REPOS.find((f) => f.name === name)?.title ?? name })) : [];
  return (
    <Shell lang={lang} switchHref={lang === "de" ? "/en" : "/"}>
      <h1>{m.appName}</h1>
      <p className="lead">{m.tagline}</p>
      <p className="muted">{m.promise}</p>
      <HomeForm lang={lang} demos={demos} />
      <p className="muted">{m.form.privacy}</p>
    </Shell>
  );
}
