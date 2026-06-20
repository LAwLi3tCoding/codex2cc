# Codex2CC Plugin

This plugin exposes one MCP tool, `delegate_to_cc`, that launches a configured
Claude Code compatible CLI as a downstream worker.

Codex should use the returned `structuredContent` as evidence, then review
changes and run verification before claiming completion.

## Tool Inputs

- `prompt`: delegated task.
- `contextSummary`: optional summary of prior Codex-visible conversation or
  task context.
- `currentInstruction`: optional latest task instruction. When present, this is
  the active task passed to the worker.
- `mode`: `design`, `code`, `review`, or `custom`.
- `cwd`: working directory.
- `ccCommand`: optional executable override.
- `ccArgs`: optional arguments. The delegated prompt is appended last.
- `timeoutMs`: timeout in milliseconds.
- `resultFile`: optional relative path under `cwd`.
- `maxOutputBytes`: output capture limit.
- `streamOutput`: whether to mirror child output to the terminal.

## Context Handoff

The MCP server cannot read Codex conversation history on its own. For
conversation-aware delegation, Codex should summarize the relevant visible
conversation into `contextSummary` and put the newest task into
`currentInstruction` before calling `delegate_to_cc`.

## Local Checks

```bash
npm install
npm test
npm run smoke:mcp
```
