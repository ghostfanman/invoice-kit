"use client";

/** Sprachwechsel, der den geheimen Schlüssel im URL-Fragment erhält. */
export function LangSwitch({ href, lang, label }: { href: string; lang: string; label: string }) {
  return (
    <a
      href={href}
      lang={lang}
      hrefLang={lang}
      onClick={(e) => {
        if (window.location.hash) {
          e.preventDefault();
          window.location.assign(href + window.location.hash);
        }
      }}
    >
      {label}
    </a>
  );
}
