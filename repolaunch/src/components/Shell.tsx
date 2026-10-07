import type { ReactNode } from "react";
import type { Language } from "@/core/types";
import { t } from "@/i18n/messages";
import { LangSwitch } from "./LangSwitch";
import { SkipLink } from "./SkipLink";

export function Shell({ lang, switchHref, children }: { lang: Language; switchHref: string; children: ReactNode }) {
  const m = t(lang);
  return (
    <>
      <SkipLink label={m.skipToContent} />
      <header className="site">
        <div className="container">
          <a className="brand" href={lang === "de" ? "/" : "/en"}>
            {m.appName}
          </a>
          <LangSwitch href={switchHref} lang={lang === "de" ? "en" : "de"} label={m.languageSwitch} />
        </div>
      </header>
      <main id="content" className="container" tabIndex={-1}>
        {children}
      </main>
      <footer className="site">
        <div className="container">
          <p>{m.footer}</p>
        </div>
      </footer>
    </>
  );
}
