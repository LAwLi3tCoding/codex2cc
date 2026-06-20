# Codex2CC Technical Design

## Architecture

Codex2CC is a local Codex plugin that exposes one MCP stdio server. The MCP
server registers a `delegate_to_cc` tool. Codex calls that tool when it wants a
separate Claude Code compatible CLI to perform a bounded task.

The runtime flow is:

```text
Codex
  -> Codex plugin manifest
  -> MCP stdio wrapper: scripts/codex2cc-mcp.js
  -> Built server: dist/src/mcp-server.js
  -> delegate_to_cc tool
  -> TypeScript child-process runner
  -> downstream CLI process
  -> streamed terminal output + structured MCP result
  -> Codex review / next orchestration step
```

No hook is required in the first version. The plugin is explicit: Codex invokes
the tool only when delegation is useful.

## Repository Layout

```text
codex2cc/
  .agents/plugins/marketplace.json
  docs/
  plugins/
    codex2cc/
      .codex-plugin/plugin.json
      .mcp.json
      scripts/
        codex2cc-mcp.js
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
      package.json
      tsconfig.json
```

The workspace root is the development repository. The installable plugin lives
at `plugins/codex2cc`, and the repo-level marketplace points at
`./plugins/codex2cc`.

## Plugin Manifest

`plugins/codex2cc/.codex-plugin/plugin.json` declares:

- plugin name `codex2cc`;
- `skills` pointing at `./skills/`;
- `mcpServers` pointing at `./.mcp.json`;
- interface metadata and starter prompts.

`plugins/codex2cc/.mcp.json` declares one stdio MCP server:

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

The script wrapper resolves the built server relative to the plugin root and
keeps plugin installation independent of a globally installed package binary.

`.agents/plugins/marketplace.json` declares a local marketplace named
`codex2cc-local` with one plugin entry:

```json
{
  "name": "codex2cc-local",
  "plugins": [
    {
      "name": "codex2cc",
      "source": {
        "source": "local",
        "path": "./plugins/codex2cc"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

## MCP Tool Contract

Tool name: `delegate_to_cc`.

Input fields:

- `prompt` string, required;
- `cwd` string, optional, defaults to MCP server process cwd;
- `mode` enum: `design`, `code`, `review`, `custom`, defaults to `custom`;
- `timeoutMs` integer, optional, default `900000`, maximum `7200000`;
- `ccCommand` string, optional;
- `ccArgs` string array, optional;
- `resultFile` string, optional relative path under `cwd`;
- `maxOutputBytes` integer, optional, default `65536`, maximum `1048576`;
- `streamOutput` boolean, optional, default `true`.

Output fields match the requirements result contract. The MCP handler returns
both `structuredContent` and a concise text summary.

## Command Resolution

Command resolution is implemented in `src/cli-command.ts`.

Resolution order:

1. `ccCommand` tool input.
2. `CODEX2CC_CC_COMMAND` environment variable.
3. `claude`.

The resolver rejects unsafe or wrong defaults:

- empty command;
- command basename exactly `cc`;
- resolved absolute path `/usr/bin/cc`;
- command strings that include whitespace, because arguments must be passed
  through `ccArgs`.

The runner passes `ccArgs` first and appends the framed prompt as the final
argument. This supports commands such as:

```bash
claude --print "<delegated prompt>"
```

by configuring `ccArgs` as `["--print"]`.

## Prompt Framing

`src/prompt.ts` builds the delegated prompt. For `design`, `code`, and `review`,
the prompt adds:

- role boundary: the downstream CLI is a delegated worker;
- workspace and mode;
- instruction to avoid claiming final acceptance;
- instruction to summarize changed files, commands run, and blockers;
- instruction to return control to Codex.

`custom` sends a minimal wrapper around the user prompt and avoids adding
workflow-specific requirements beyond returning control.

## Process Management

`src/runner.ts` owns child process execution.

- Use `spawn` instead of `exec` to avoid shell interpolation.
- Set `cwd` to the validated working directory.
- Use `stdio: ["ignore", "pipe", "pipe"]`.
- Mirror child stdout and stderr to parent stdout and stderr when
  `streamOutput` is true.
- Capture bounded stdout and stderr tails with `LogBuffer`.
- Track start time, end time, exit code, signal, and timeout state.
- On timeout, send `SIGTERM`, wait briefly, then send `SIGKILL` if the child has
  not exited.
- The default `SIGTERM` grace period is 1000ms; tests can override it through
  `killGraceMs` in the internal runner API.
- Resolve with `success` only when exit code is `0` and no timeout occurred.

The runner does not parse downstream prose. Codex receives the captured output
and decides the next orchestration action.

## Result File Handling

If `resultFile` is provided:

1. Resolve it relative to `cwd`.
2. Reject absolute paths and paths escaping `cwd`.
3. Reject files larger than `maxOutputBytes`.
4. Read UTF-8 text content into the result.

This lets wrappers write structured summaries to files without giving the
plugin broad filesystem read behavior.

## Skill Entry

`skills/codex2cc/SKILL.md` explains when Codex should use the plugin:

- delegate design, code, or review work to a Claude Code compatible CLI;
- pass `ccCommand` or set `CODEX2CC_CC_COMMAND` when the executable is not
  `claude`;
- review downstream output before claiming completion;
- run local verification after delegated coding work.

The skill is guidance only. The MCP tool is the executable interface.

## Testing Strategy

Use TypeScript plus Node's built-in `node:test` runner. The project originally
tried Vitest, but local native optional dependencies made that path less stable
for this CLI plugin. The current test command compiles with `tsc` and runs
compiled tests with `node --test`.

Unit tests:

- prompt framing for each mode;
- log buffer truncation;
- command resolution and compiler-style `cc` rejection;
- input normalization defaults and limits.

Integration-style tests:

- fixture child command exits `0` and produces stdout/stderr;
- fixture child command exits non-zero;
- timeout kills a long-running fixture;
- result file is read only when it stays under `cwd`;
- result file path traversal is rejected.

Plugin validation:

- run `npm run build`;
- run `npm test`;
- run the local plugin validator;
- start the MCP server briefly for smoke validation.

## Implementation Order

1. Create package, TypeScript, Node test setup, manifest, MCP config, skill,
   and docs.
2. Write failing tests for prompt, command resolution, log buffer, and runner.
3. Implement minimal TypeScript modules to pass tests.
4. Register the MCP tool and add script wrapper.
5. Add README with install, configuration, and smoke-test steps.
6. Run all checks, fix issues, and record verification evidence.
