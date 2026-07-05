#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverScript = path.join(pluginRoot, "scripts", "codex2cc-mcp.js");
const fixture = path.join(pluginRoot, "tests", "fixtures", "echo-worker.mjs");

const client = new Client({ name: "codex2cc-smoke", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverScript],
  cwd: pluginRoot
});
const transportErrors = [];

transport.onerror = (error) => {
  transportErrors.push(error instanceof Error ? error.message : String(error));
};

try {
  await client.connect(transport);
  const tools = await client.listTools();
  if (!tools.tools.some((tool) => tool.name === "delegate_to_cc")) {
    throw new Error("delegate_to_cc tool was not listed");
  }

  const result = await client.callTool({
    name: "delegate_to_cc",
    arguments: {
      prompt: "smoke",
      cwd: pluginRoot,
      mode: "custom",
      ccCommand: process.execPath,
      ccArgs: [fixture],
      timeoutMs: 2000,
      maxOutputBytes: 2048
    }
  });

  if (result.isError) {
    throw new Error(`delegate_to_cc returned MCP error: ${JSON.stringify(result)}`);
  }

  const structured = result.structuredContent;
  if (!structured || structured.status !== "success") {
    throw new Error(`unexpected structured result: ${JSON.stringify(structured)}`);
  }
  if (transportErrors.length > 0) {
    throw new Error(`stdio transport received non-MCP output: ${transportErrors.join("; ")}`);
  }

  console.log("codex2cc MCP smoke passed");
} finally {
  await client.close();
}
