#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverPath = join(scriptDir, "..", "dist", "src", "mcp-server.js");

if (!existsSync(serverPath)) {
  process.stderr.write(
    "codex2cc MCP server is not built. Run `npm install && npm run build` in the plugin directory.\n"
  );
  process.exit(1);
}

const serverModule = await import(pathToFileURL(serverPath).href);
await serverModule.runStdioServer();
