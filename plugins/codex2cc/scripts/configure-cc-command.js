#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2]?.trim();

if (!command || command === "--help" || command === "-h") {
  process.stderr.write(
    [
      "Usage: npm run configure:cc -- <command>",
      "",
      "Examples:",
      "  npm run configure:cc -- occ",
      "  npm run configure:cc -- claude",
      "  npm run configure:cc -- /usr/local/bin/claude",
      "",
      "Pass flags through tool input ccArgs, not through this command."
    ].join("\n") + "\n"
  );
  process.exit(command ? 0 : 1);
}

if (/\s/.test(command)) {
  process.stderr.write("cc command must be an executable path or name without arguments.\n");
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const configPath = join(scriptDir, "..", "codex2cc.local.json");
writeFileSync(configPath, `${JSON.stringify({ ccCommand: command }, null, 2)}\n`, "utf8");
console.log(`Wrote ${configPath}`);
console.log(`Codex2CC will use ${command} when CODEX2CC_CC_COMMAND is not already set.`);
