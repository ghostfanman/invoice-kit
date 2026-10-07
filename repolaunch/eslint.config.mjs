import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "data/**", "node_modules/**", "next-env.d.ts", "coverage/**"]),
  {
    rules: {
      // Repository-Inhalte werden nie als HTML gerendert.
      "react/no-danger": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Kein HTML-Rendering von Fremdinhalten." },
      ],
    },
  },
]);
