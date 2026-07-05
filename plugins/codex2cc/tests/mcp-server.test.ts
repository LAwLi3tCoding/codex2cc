import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

describe("codex2cc MCP server", () => {
  it("does not stream delegated stdout into the stdio transport by default", async () => {
    const pluginRoot = process.cwd();
    const serverScript = path.join(pluginRoot, "scripts", "codex2cc-mcp.js");
    const fixture = path.join(pluginRoot, "tests", "fixtures", "echo-worker.mjs");
    const client = new Client({ name: "codex2cc-default-stream-test", version: "0.1.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverScript],
      cwd: pluginRoot
    });
    const transportErrors: string[] = [];

    transport.onerror = (error) => {
      transportErrors.push(error instanceof Error ? error.message : String(error));
    };

    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: "delegate_to_cc",
        arguments: {
          prompt: "stream default repro",
          cwd: pluginRoot,
          mode: "custom",
          ccCommand: process.execPath,
          ccArgs: [fixture],
          timeoutMs: 2000,
          maxOutputBytes: 2048
        }
      });

      assert.equal(result.isError, false);
      const structured = result.structuredContent as { status?: string } | undefined;
      assert.equal(structured?.status, "success");
      assert.deepEqual(transportErrors, []);
    } finally {
      await client.close();
    }
  });
});
