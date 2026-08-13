import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = path.join(rootDir, ".tmp-language-audit-runtime");
const tscCli = require.resolve("typescript/bin/tsc");

execFileSync(
  "node",
  [
    tscCli,
    "scripts/audit-language-source-integrity.ts",
    "lib/subjects/languageSourceAudit.ts",
    "lib/subjects/languageSourceIntegrity.ts",
    "lib/readings/structuredReading.ts",
    "lib/subjects/subjectConfig.ts",
    "--outDir",
    outDir,
    "--module",
    "commonjs",
    "--target",
    "es2020",
    "--moduleResolution",
    "node",
    "--esModuleInterop",
    "--skipLibCheck",
  ],
  { stdio: "inherit", cwd: rootDir },
);

execFileSync(
  "node",
  [path.join(outDir, "scripts", "audit-language-source-integrity.js")],
  { stdio: "inherit", cwd: rootDir },
);