# Codex2CC

Languages: [English](README.en.md) | [简体中文](README.zh-CN.md)

Codex2CC is a local Codex plugin that delegates bounded design, coding, review,
or custom tasks to a Claude Code compatible CLI, then returns structured results
to Codex for orchestration and verification.

Codex remains the final coordinator. The downstream CLI does the delegated work;
Codex reviews the evidence, runs checks, and decides the next step.

## Features

- Exposes a `delegate_to_cc` MCP tool to Codex.
- Starts a configurable downstream CLI process.
- Streams child stdout and stderr to the user's terminal.
- Captures bounded stdout and stderr tails.
- Returns structured status, exit code, signal, command metadata, duration,
  logs, and optional result file content.
- Supports task modes: `design`, `code`, `review`, and `custom`.
- Supports Codex-visible context handoff through `contextSummary` and
  `currentInstruction`.
- Keeps command execution shell-free by using `spawn()` with explicit arguments.

## Repository Layout

```text
codex2cc/
  .agents/plugins/marketplace.json
  README.md
  README.en.md
  README.zh-CN.md
  docs/
  plugins/
    codex2cc/
      .codex-plugin/plugin.json
      .mcp.json
      package.json
      scripts/
      skills/
      src/
      tests/
```

The repository root is the local marketplace root. The installable plugin lives
in `plugins/codex2cc`.

## Requirements

- Node.js 20 or newer.
- Codex CLI with plugin support.
- A Claude Code compatible downstream CLI, usually `claude`.
- A logged-in downstream CLI session if that CLI requires authentication.

On macOS, do not use `/usr/bin/cc`. That binary is clang, not Claude Code, and
Codex2CC rejects it.

## Install Locally

From the repository root:

```bash
codex plugin marketplace add "$(pwd)"
codex plugin add codex2cc@codex2cc-local
```

Open a new Codex thread after installing or reinstalling so the plugin's MCP
tool and skill are loaded.

## Develop

```bash
cd plugins/codex2cc
npm install
npm test
npm run smoke:mcp
```

`npm test` builds TypeScript and runs the compiled Node test suite.
`npm run smoke:mcp` starts the MCP server through the same wrapper used by the
plugin manifest and calls `delegate_to_cc` with a fixture worker.

## Configure the Downstream CLI

Codex2CC resolves the downstream executable in this order:

1. Tool input `ccCommand`.
2. Environment variable `CODEX2CC_CC_COMMAND`.
3. Fallback command `claude`.

`ccCommand` must be only the executable name or path. Put flags and arguments in
`ccArgs`.

Valid:

```json
{
  "prompt": "Design the new API boundary.",
  "mode": "design",
  "cwd": "/path/to/repo",
  "ccCommand": "claude",
  "ccArgs": ["--print"]
}
```

Invalid:

```json
{
  "ccCommand": "claude --print"
}
```

## Tool Contract

Tool name: `delegate_to_cc`.

Input fields:

- `prompt`: required delegated task.
- `contextSummary`: optional summary of the prior Codex conversation or
  task-relevant context. Codex should prepare this before calling the tool.
- `currentInstruction`: optional latest task instruction. When present, this is
  used as the active task while `prompt` remains a required fallback.
- `cwd`: working directory. Defaults to the MCP server process directory.
- `mode`: `design`, `code`, `review`, or `custom`.
- `ccCommand`: optional downstream executable override.
- `ccArgs`: optional downstream arguments. The delegated prompt is appended
  last.
- `timeoutMs`: timeout in milliseconds. Default: `900000`.
- `resultFile`: optional relative file under `cwd` to read after execution.
- `maxOutputBytes`: capture limit. Default: `65536`.
- `streamOutput`: whether to mirror child output to the terminal. Default:
  `true`.

Structured output includes:

- `status`: `success`, `failed`, or `timed_out`.
- `exitCode` and `signal`.
- `durationMs`.
- `command.executable` and redacted `command.args`.
- `cwd`, `mode`, `promptPreview`, and `contextProvided`.
- `stdoutTail`, `stderrTail`, and truncation flags.
- Optional `resultFile`.
- Optional `error`.

## Example Delegation

After the plugin is installed in a fresh Codex thread, ask Codex to delegate a
bounded task:

```text
Use Codex2CC to ask cc to review the current implementation and return findings.
```

For conversation-aware delegation, Codex summarizes the visible conversation
before calling the tool:

```json
{
  "prompt": "Implement the next step.",
  "contextSummary": "Codex has already selected the minimal API shape, rejected hooks for v1, and confirmed that ccCommand must not contain flags.",
  "currentInstruction": "Implement the selected API boundary and return changed files plus verification commands.",
  "mode": "code",
  "cwd": "/path/to/repo",
  "ccCommand": "claude",
  "ccArgs": ["--print"]
}
```

The MCP server cannot read Codex's private conversation transcript by itself.
The supported mechanism is explicit handoff: Codex summarizes the context it can
currently see, passes that summary in `contextSummary`, and sends the latest
task in `currentInstruction`. Codex2CC then frames both sections into the final
prompt passed to cc.

For custom command configuration:

```json
{
  "prompt": "Implement the narrow bug fix and summarize changed files.",
  "mode": "code",
  "cwd": "/path/to/repo",
  "ccCommand": "claude",
  "ccArgs": ["--print"],
  "timeoutMs": 1800000,
  "streamOutput": true
}
```

## Update During Development

After changing plugin source:

```bash
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py" \
  "$(pwd)/plugins/codex2cc"

codex plugin add codex2cc@codex2cc-local
```

Then open a new Codex thread.

## Verification

Expected checks:

```bash
cd plugins/codex2cc
npm test
npm run smoke:mcp
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" .
```

If system Python cannot install dependencies directly, create a temporary
virtual environment and install `PyYAML` there before running the validator.

## GitHub Publishing Notes

Commit source, documentation, lock files, plugin manifests, marketplace config,
and the built `dist` files if you want the plugin to be runnable immediately
from a fresh checkout. Do not commit `node_modules`.

To push this project to GitHub, the local directory must first be initialized as
a Git repository, connected to a GitHub remote, committed, and pushed.

## Documentation

- [Requirements](docs/requirements.md)
- [Technical Design](docs/technical-design.md)
- [Checks](docs/checks.md)
- [Project Guide](docs/project-guide.md)
- [Plugin README](plugins/codex2cc/README.md)
