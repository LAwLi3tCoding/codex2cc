# Codex2CC Requirements

## Goal

Build a local Codex plugin that lets Codex delegate bounded work to a separate
Claude Code compatible CLI process, stream that process output in the user's
terminal, collect a structured execution result, and return control to Codex for
review, validation, and further orchestration.

The plugin is a bridge, not a replacement for Codex. Codex remains the
orchestrator and final reviewer. The downstream CLI is an execution lane for
design, coding, analysis, and verification tasks.

## Current Environment Facts

- Workspace: the project root directory.
- The workspace initially contains only `.omx` runtime state and is not a git
  repository.
- No existing plugin manifest, package file, tests, or source tree existed at
  the start of this work.
- On this host, `cc` resolves to `/usr/bin/cc`, which is clang. It is not a
  valid Claude Code command for this plugin.
- A Claude-like CLI exists at `claude`, but the plugin must not hard-code that
  assumption. The executable is configurable.

## Functional Requirements

1. Expose a Codex-callable tool through a Codex plugin.
2. Accept a task prompt, working directory, execution mode, timeout, optional
   command override, optional command arguments, and optional result file path.
3. Resolve the downstream CLI command in this order:
   - explicit tool input `ccCommand`;
   - environment variable `CODEX2CC_CC_COMMAND`;
   - local ignored `codex2cc.local.json` file;
   - fallback command `claude`.
4. Reject `/usr/bin/cc` and other compiler-looking `cc` resolutions by default.
5. Launch the downstream CLI in a way that streams stdout and stderr to the
   user's terminal while also capturing bounded logs for Codex.
6. Return a structured result to Codex containing status, exit code, signal,
   duration, command metadata, working directory, log tail, optional result file
   content, and error text.
7. Support these task modes:
   - `design`: ask the downstream CLI for architecture or design output;
   - `code`: ask it to implement scoped changes;
   - `review`: ask it to review or verify work;
   - `custom`: pass the user's prompt directly with minimal framing.
8. Provide prompt framing that tells the downstream CLI it is a delegated worker
   and must return control to Codex after finishing.
9. Support timeout and cancellation behavior by terminating the child process.
10. Preserve audit evidence in the returned result without requiring Codex to
    parse terminal text.
11. Pass the final delegated prompt as the last process argument after any
    configured base arguments, so wrappers can adapt to different downstream
    CLI protocols.
12. Read an optional result file only when it is inside the selected working
    directory and below the configured size limit.

## Non-Functional Requirements

1. Keep the implementation local-first and installable as a Codex plugin.
2. Prefer a small TypeScript/Node implementation using an MCP stdio server.
3. Keep shell wrappers thin; core behavior belongs in testable TypeScript.
4. Avoid hooks for the first version because hooks increase runtime failure
   surface and are not required for explicit delegation.
5. Keep logs bounded to prevent unbounded memory growth.
6. Use explicit validation for command, cwd, timeout, and mode inputs.
7. Document installation, configuration, and smoke tests.
8. Make tests runnable without a real Claude Code account by using fixture
   commands.

## Boundaries

1. The plugin does not decide whether downstream output is correct. Codex must
   review and verify it.
2. The plugin does not bypass Codex sandbox, approval, or host policies.
3. The plugin does not guarantee interactive login flows inside the downstream
   CLI. If the downstream CLI requires login, the user must prepare it first.
4. The plugin does not run multiple downstream tasks concurrently in the same
   process. First version is one tool call, one child process.
5. The plugin does not edit Codex global config directly during normal use.

## Result Contract

The tool returns:

- `status`: `success`, `failed`, or `timed_out`;
- `exitCode`: numeric process exit code when available;
- `signal`: process termination signal when available;
- `durationMs`: elapsed time;
- `command`: executable name and argument list, with the prompt redacted from
  command metadata;
- `promptPreview`: short preview of the delegated prompt;
- `cwd`: child process working directory;
- `mode`: requested task mode;
- `stdoutTail` and `stderrTail`: bounded captured output;
- `resultFile`: optional file path and text content when requested;
- `error`: human-readable error text for failed setup or execution.

## Check Gate Policy

Every major stage must pass three checks before the next stage starts:

1. Scope check: verify the stage still satisfies the stated goal and boundaries.
2. Contract check: verify inputs, outputs, failure modes, and docs are coherent.
3. Evidence check: verify the stage has concrete file, command, test, or review
   evidence rather than only intent.

## Acceptance Criteria

1. The plugin manifest validates with the local plugin validator.
2. The MCP server starts over stdio.
3. The main delegation tool works with a fixture command and returns structured
   content.
4. Output from a fixture command is streamed to the terminal and captured in the
   result tail.
5. Timeout handling is covered by tests.
6. Invalid compiler-style `cc` resolution is rejected by tests.
7. Documentation explains how to configure a real downstream CLI.
