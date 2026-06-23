---
name: codex2cc
description: Delegate bounded design, coding, review, or custom tasks from Codex to a Claude Code compatible CLI, then review the returned structured result before continuing.
---

# Codex2CC

Use this skill when the user wants Codex to launch a Claude Code compatible CLI
as a downstream execution lane and then continue orchestration or review in
Codex.

## Tool

Call the `delegate_to_cc` MCP tool.

Important inputs:

- `prompt`: delegated task text.
- `contextSummary`: optional Codex-visible conversation or task summary.
- `currentInstruction`: optional active task instruction. Use this when the
  user asks to call cc based on prior Codex conversation context.
- `mode`: `design`, `code`, `review`, or `custom`.
- `cwd`: repository or workspace where the downstream CLI should run.
- `ccCommand`: optional executable override.
- `ccArgs`: optional base arguments. The delegated prompt is appended last.
- `timeoutMs`: task timeout.
- `resultFile`: optional relative result file under `cwd`.

## Command Selection

The tool resolves the downstream command in this order:

1. `ccCommand`.
2. `CODEX2CC_CC_COMMAND`.
3. `claude`.

This local plugin configuration sets `CODEX2CC_CC_COMMAND=occ` in `.mcp.json`,
so the default downstream command is `occ` unless a tool call overrides
`ccCommand`.

Do not rely on `/usr/bin/cc`; on macOS that is clang and the tool rejects it.
For Claude Code print-style execution, pass `ccArgs: ["--print"]` if that is
the correct protocol for the installed CLI.

## Codex Responsibilities

- When the user asks to call cc during an ongoing Codex conversation, first
  summarize the task-relevant context currently visible to Codex and pass it as
  `contextSummary`.
- Put the user's newest requested next step in `currentInstruction`; keep
  `prompt` as a concise fallback.
- Review the returned `structuredContent`.
- Inspect changed files before claiming completion.
- Run appropriate tests or verification after delegated coding work.
- Continue orchestration from the returned status, error, and log tails.

## Boundary

Codex2CC's MCP server cannot independently read Codex's private transcript.
Conversation-aware delegation works through explicit handoff: Codex prepares the
summary before calling the tool.
