# Codex2CC Project Guide

## Purpose

Codex2CC is a local Codex plugin that lets Codex delegate bounded work to a
Claude Code compatible CLI, while keeping Codex as the orchestrator and reviewer.

The plugin starts a downstream CLI process, streams its stdout and stderr to the
terminal, captures bounded logs, and returns a structured result to Codex. Codex
can then inspect the result, run verification, and decide the next step.

## Repository Shape

```text
codex2cc/
  .agents/plugins/marketplace.json
  README.md
  docs/
    checks.md
    project-guide.md
    requirements.md
    technical-design.md
  plugins/
    codex2cc/
      .codex-plugin/plugin.json
      .mcp.json
      README.md
      package.json
      scripts/
        codex2cc-mcp.js
        smoke-mcp.js
      skills/
        codex2cc/SKILL.md
      src/
        cli-command.ts
        log-buffer.ts
        mcp-server.ts
        prompt.ts
        runner.ts
        schema.ts
      tests/
        fixtures/
        *.test.ts
      tsconfig.json
```

The repository root is the local marketplace root. The actual installable plugin
is `plugins/codex2cc`.

## Main Components

### Marketplace

`.agents/plugins/marketplace.json` defines marketplace `codex2cc-local` and
points Codex at `./plugins/codex2cc`.

### Plugin Manifest

`plugins/codex2cc/.codex-plugin/plugin.json` declares:

- name: `codex2cc`;
- version: local semver plus Codex cachebuster when refreshed;
- skill path: `./skills/`;
- MCP config path: `./.mcp.json`;
- UI metadata and default prompts.

### MCP Config

`plugins/codex2cc/.mcp.json` declares one server:

```json
{
  "mcpServers": {
    "codex2cc": {
      "command": "node",
      "args": ["./scripts/codex2cc-mcp.js"]
    }
  }
}
```

### MCP Wrapper

`scripts/codex2cc-mcp.js` checks that `dist/src/mcp-server.js` exists, imports
it, and explicitly starts `runStdioServer()`.

This wrapper is the path Codex launches after the plugin is installed.

### MCP Server

`src/mcp-server.ts` creates a `McpServer`, registers `delegate_to_cc`, validates
input with Zod, calls the runner, and returns both:

- text summary in `content`;
- machine-readable result in `structuredContent`.

### Runner

`src/runner.ts` owns child process execution:

- resolves the downstream command;
- builds the delegated prompt;
- runs `spawn()` without a shell;
- streams stdout and stderr when requested;
- captures bounded log tails;
- handles non-zero exit;
- handles timeout with `SIGTERM` followed by `SIGKILL`;
- reads optional result files under the working directory.

### Command Resolver

`src/cli-command.ts` resolves the downstream CLI in this order:

1. tool input `ccCommand`;
2. environment variable `CODEX2CC_CC_COMMAND`;
3. fallback `claude`.

It rejects:

- `/usr/bin/cc`;
- basename `cc`;
- command strings containing whitespace.

Arguments must be passed via `ccArgs`.

### Prompt Builder

`src/prompt.ts` frames delegated work so the downstream CLI understands:

- it is a delegated worker;
- Codex remains final reviewer;
- it should summarize changed files, commands, and blockers;
- it should return control to Codex.

### Schema

`src/schema.ts` defines tool input defaults and limits:

- `mode`: `custom` by default;
- `timeoutMs`: 900000 by default, max 7200000;
- `maxOutputBytes`: 65536 by default, max 1048576;
- `streamOutput`: true by default.

## Tool Contract

Tool name: `delegate_to_cc`.

Input fields:

- `prompt`: required task text.
- `cwd`: working directory.
- `mode`: `design`, `code`, `review`, or `custom`.
- `timeoutMs`: timeout in milliseconds.
- `ccCommand`: executable path or name only.
- `ccArgs`: base arguments; the delegated prompt is appended last.
- `resultFile`: optional relative file under `cwd`.
- `maxOutputBytes`: capture limit for stdout, stderr, and result file.
- `streamOutput`: whether to mirror child output to terminal.

Structured output fields:

- `status`: `success`, `failed`, or `timed_out`;
- `exitCode`;
- `signal`;
- `durationMs`;
- `command.executable`;
- `command.args`, with prompt redacted as `[prompt]`;
- `promptPreview`;
- `cwd`;
- `mode`;
- `stdoutTail`;
- `stderrTail`;
- `stdoutTruncated`;
- `stderrTruncated`;
- optional `resultFile`;
- optional `error`.

## Runtime Flow

```text
Codex
  -> loads codex2cc plugin
  -> starts MCP server through scripts/codex2cc-mcp.js
  -> calls delegate_to_cc
  -> validates input
  -> resolves CLI command
  -> builds delegated prompt
  -> spawn(command, [...ccArgs, prompt])
  -> streams output and captures tails
  -> returns structured result
  -> Codex reviews and continues orchestration
```

## Installing Locally

From the project root:

```bash
codex plugin marketplace add "$(pwd)"
codex plugin add codex2cc@codex2cc-local
```

Open a new Codex thread after installing or reinstalling, because plugin tools
and skills are loaded at session start.

## Updating During Development

After changing plugin source:

```bash
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py" \
  "$(pwd)/plugins/codex2cc"

codex plugin add codex2cc@codex2cc-local
```

Then open a new Codex thread.

## Testing

From `plugins/codex2cc`:

```bash
npm install
npm test
npm run smoke:mcp
```

`npm test` compiles TypeScript and runs compiled tests through Node's built-in
test runner.

`npm run smoke:mcp` starts the MCP server through the same wrapper configured in
`.mcp.json`, lists tools, and calls `delegate_to_cc` with a fixture worker.

## Plugin Validation

The local plugin validator needs PyYAML. If system Python is externally managed,
use a temporary virtualenv:

```bash
python3 -m venv /tmp/codex2cc-validator-venv
/tmp/codex2cc-validator-venv/bin/python -m pip install PyYAML
/tmp/codex2cc-validator-venv/bin/python \
  "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" \
  "$(pwd)/plugins/codex2cc"
```

## Important Boundaries

- Codex2CC does not decide whether the downstream work is correct.
- Codex must inspect returned evidence and run verification.
- Codex2CC does not bypass sandbox, approval, or runtime policies.
- The first version runs one downstream process per tool call.
- The downstream CLI must already be installed and authenticated if it requires
  login.
- `ccCommand` is executable only; put flags in `ccArgs`.

## Known Local Environment Facts

- `/usr/bin/cc` is clang on this machine and is rejected.
- A `claude` executable exists locally, but the plugin does not hard-code that
  path.
- The workspace initially was not a git repository.
- The installed plugin is visible as `codex2cc@codex2cc-local` after local
  marketplace registration.

## Second Check Findings

The second check found and fixed:

- command strings like `claude --print` being accepted in `ccCommand`;
- timeout escalation relying on `child.killed`;
- stale docs mentioning Vitest and a non-existent `config.ts`.

Regression tests now cover command-string rejection and `SIGKILL` escalation for
workers that ignore `SIGTERM`.
