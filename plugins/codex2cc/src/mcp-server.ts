import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runDelegatedTask } from "./runner.js";
import { delegateInputSchema, normalizeDelegateInput } from "./schema.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "codex2cc",
    version: "0.1.0"
  });

  server.registerTool(
    "delegate_to_cc",
    {
      title: "Delegate to Claude Code compatible CLI",
      description:
        "Launch a configured Claude Code compatible CLI for a bounded task. Codex may pass a contextSummary and currentInstruction for conversation-aware delegation.",
      inputSchema: delegateInputSchema,
      outputSchema: z.object({
        status: z.enum(["success", "failed", "timed_out"]),
        exitCode: z.number().nullable(),
        signal: z.string().nullable(),
        durationMs: z.number(),
        command: z.object({
          executable: z.string(),
          args: z.array(z.string()),
          source: z.string()
        }),
        promptPreview: z.string(),
        contextProvided: z.boolean(),
        cwd: z.string(),
        mode: z.enum(["design", "code", "review", "custom"]),
        stdoutTail: z.string(),
        stderrTail: z.string(),
        stdoutTruncated: z.boolean(),
        stderrTruncated: z.boolean(),
        resultFile: z
          .object({
            path: z.string(),
            content: z.string(),
            truncated: z.boolean()
          })
          .optional(),
        error: z.string().optional()
      })
    },
    async (rawInput) => {
      const input = normalizeDelegateInput(rawInput);
      const result = await runDelegatedTask(input);
      const summary = [
        `codex2cc ${result.status}`,
        `mode=${result.mode}`,
        `exitCode=${result.exitCode ?? "null"}`,
        `durationMs=${result.durationMs}`,
        result.error ? `error=${result.error}` : undefined
      ]
        .filter(Boolean)
        .join(" ");

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: result,
        isError: result.status !== "success"
      };
    }
  );

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdioServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
