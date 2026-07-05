# Codex2CC Check Log

## Requirements Stage

### Check 1: Scope

Pass.

- The goal states Codex delegates to a Claude Code compatible CLI, streams
  output, receives structured results, and continues orchestration.
- The boundary states Codex remains reviewer and final authority.
- The environment facts capture the empty workspace and the local `/usr/bin/cc`
  clang collision.

### Check 2: Contract

Pass after revision.

- Inputs now include prompt, cwd, mode, timeout, command override, command args,
  and optional result file path.
- Outputs define status, exit metadata, duration, command metadata, prompt
  preview, cwd, mode, log tails, result file content, and error text.
- Failure handling covers invalid command resolution, timeout, process failure,
  and unsafe result file paths.

### Check 3: Evidence

Pass.

- `pwd` confirmed the project root.
- `git status --short --branch` failed because the workspace is not a git
  repository.
- `find . -maxdepth 3 -print` showed only `.omx` state files before new docs.
- `which cc` returned `/usr/bin/cc`.
- `cc --help` returned clang help text.
- `which claude` returned a local Claude-like CLI path, but requirements keep
  the executable configurable.

## Technical Design Stage

### Check 1: Scope

Pass.

- The design uses a Codex plugin plus one MCP stdio server, matching the goal of
  a Codex-callable bridge.
- Hooks are explicitly excluded from the first version, keeping scope bounded.
- Codex remains the reviewer and orchestrator after the tool returns.

### Check 2: Contract

Pass after revision.

- The design defines `delegate_to_cc` input fields for prompt, cwd, mode,
  timeout, command override, command args, result file, output cap, and
  streaming behavior.
- The command protocol appends the framed prompt after configured base args.
- Result file access is limited to paths under the selected working directory.
- The install layout was revised to use `.agents/plugins/marketplace.json`
  pointing to `plugins/codex2cc`, so plugin discovery has a concrete path.

### Check 3: Evidence

Pass.

- MCP TypeScript SDK documentation was checked for the current
  `McpServer`, `StdioServerTransport`, `registerTool`, and
  `structuredContent` patterns.
- Local `codex plugin add --help` confirmed marketplace-based plugin
  installation shape.
- The local plugin-creator spec confirmed manifest and marketplace field
  requirements.

## Implementation Stage

### Check 1: Scope

Pass.

- The implementation creates a Codex plugin package at `plugins/codex2cc`.
- The plugin exposes one MCP stdio server and one tool, `delegate_to_cc`.
- No hooks were added.
- Codex remains responsible for reviewing returned `structuredContent`.

### Check 2: Contract

Pass.

- `delegate_to_cc` accepts prompt, cwd, mode, timeout, command override, command
  args, optional result file, output limit, and stream flag.
- Command resolution rejects compiler-style `/usr/bin/cc`.
- The runner appends the framed prompt after configured args and redacts the
  prompt from command metadata.
- Result file reads are constrained to the selected working directory.
- Timeout, non-zero exit, stdout/stderr capture, and path traversal are covered
  by automated tests.

### Check 3: Evidence

Pass.

- `npm test` passed with 15 tests after the second check fixes.
- `npm run smoke:mcp` passed through a real MCP stdio client/server call.
- The local plugin validator passed for `plugins/codex2cc`.
- `.agents/plugins/marketplace.json`, `.mcp.json`, and plugin manifest JSON all
  parse successfully.
- Placeholder scan over source docs, excluding `node_modules` and `dist`, found
  no `TBD`, `TODO`, `[TODO`, `maybe`, `later`, or `placeholder` matches.

## Installation Stage

### Check 1: Scope

Pass.

- The marketplace `codex2cc` can be added from GitHub or from a local checkout.
- The plugin is installed as `codex2cc@codex2cc`.
- The installed plugin remains a Codex plugin plus MCP stdio tool, with no
  hook surface added.

### Check 2: Contract

Pass.

- The installed cache manifest version is refreshed through the Codex
  cachebuster workflow when local plugin code changes.
- The installed `.mcp.json` path starts `node ./scripts/codex2cc-mcp.js`.
- The wrapper script explicitly starts `runStdioServer()`, matching the MCP
  server contract instead of relying on module side effects.

### Check 3: Evidence

Pass.

- `codex plugin marketplace add "$(pwd)" --json` returned
  `marketplaceName: codex2cc`.
- `codex plugin add codex2cc@codex2cc --json` installed the
  cachebuster-tagged local version.
- `codex plugin list --json` reports `installed: true` and `enabled: true` for
  `codex2cc@codex2cc`.
- `npm run smoke:mcp` passed from the installed cache path after the wrapper
  was verified.

## Second Check Stage

### Check 1: Scope

Pass.

- The second check stayed inside the existing Codex2CC plugin and docs.
- No hook surface, unrelated runtime config, or unrelated workspace files were
  introduced.

### Check 2: Bugs Found And Fixed

Pass after fixes.

- Bug: `ccCommand` accepted command strings such as `claude --print`, but the
  runner uses `spawn` without a shell. This would try to execute a binary named
  `claude --print` instead of passing `--print` as an argument.
- Fix: `resolveCliCommand()` now rejects whitespace in `ccCommand` and tells the
  caller to use `ccArgs`.
- Bug: timeout escalation checked `child.killed`, which only means a signal was
  sent, not that the process exited. A process ignoring `SIGTERM` might not get
  the intended `SIGKILL`.
- Fix: timeout escalation now checks `child.exitCode === null` and
  `child.signalCode === null` before sending `SIGKILL`.
- Bug: technical docs still referenced Vitest and a non-existent `config.ts`.
- Fix: docs now describe the actual Node built-in test setup and actual file
  tree.

### Check 3: Evidence

Pass.

- Added regression test for `ccCommand: "claude --print"` rejection.
- Added regression fixture for a process that ignores `SIGTERM`.
- Added regression test confirming timeout escalation reaches `SIGKILL`.
- Fresh `npm test` passed with 15 tests.
