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

Do not rely on `/usr/bin/cc`; on macOS that is clang and the tool rejects it.
For Claude Code print-style execution, pass `ccArgs: ["--print"]` if that is
the correct protocol for the installed CLI.

## Codex Responsibilities

- Review the returned `structuredContent`.
- Inspect changed files before claiming completion.
- Run appropriate tests or verification after delegated coding work.
- Continue orchestration from the returned status, error, and log tails.
