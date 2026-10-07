"use client";

/** Sprunglink, der das URL-Fragment (mit dem Zugriffsschlüssel) nicht überschreibt. */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      className="skip-link"
      href="#content"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById("content")?.focus();
      }}
    >
      {label}
    </a>
  );
}
