# Codex2CC

Languages: [English](#english) | [简体中文](#简体中文)

<a id="english"></a>

## English

Codex2CC is a local Codex plugin that lets Codex delegate bounded work to a
Claude Code compatible CLI and receive structured execution results back through
MCP. It is designed for cases where Codex should remain the orchestrator, but a
separate `claude`-style command should run a focused design, coding, review, or
custom task.

The plugin does not replace Codex's judgment. Codex calls the downstream CLI,
captures the result, reviews the evidence, runs verification when needed, and
then decides the next step.

## What It Provides

- A Codex plugin named `codex2cc`.
- One MCP stdio server named `codex2cc`.
- One MCP tool named `delegate_to_cc`.
- Two Codex skills:
  - `codex2cc`: delegate work to a Claude Code compatible CLI.
  - `codex2cc-configure`: configure the local downstream command.
- Bounded stdout and stderr capture with truncation metadata.
- Structured execution metadata: status, exit code, signal, duration, command
  source, prompt preview, cwd, task mode, logs, and optional result-file content.
- Four delegation modes: `design`, `code`, `review`, and `custom`.
- Explicit conversation-context handoff through `contextSummary` and
  `currentInstruction`.

## When To Use It

Use Codex2CC when you want a separate Claude Code compatible CLI to do a bounded
piece of work while Codex keeps control of orchestration and final review.

Good fits:

- ask another CLI to review a focused diff;
- run a design or planning lane and return a concise result;
- delegate a narrow implementation task in a repository;
- ask a Claude Code compatible tool to produce a summary file that Codex reads
  back through `resultFile`.

Poor fits:

- unrestricted long-running autonomous work with no timeout;
- tasks that require Codex to trust downstream output without review;
- commands that need shell interpolation in `ccCommand`;
- using `/usr/bin/cc` on macOS, which is clang, not Claude Code.

## Requirements

- Node.js 20 or newer.
- Codex CLI or Codex App with plugin and MCP support.
- A Claude Code compatible downstream CLI. The default executable name is
  `claude`.
- The downstream CLI must be installed and authenticated according to its own
  rules.

## Repository Layout

```text
codex2cc/
  .agents/plugins/marketplace.json
  LICENSE
  README.md
  README.en.md
  README.zh-CN.md
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
      package-lock.json
      scripts/
        codex2cc-mcp.js
        configure-cc-command.js
        smoke-mcp.js
      skills/
        codex2cc/SKILL.md
        codex2cc-configure/SKILL.md
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

The repository root is the local Codex plugin marketplace. The installable
plugin itself lives in `plugins/codex2cc`.

## Installation

From the repository root:

```bash
codex plugin marketplace add "$(pwd)"
codex plugin add codex2cc@codex2cc-local
```

Open a new Codex session after installing or reinstalling. Codex loads plugin
skills and starts MCP servers when a session starts.

## Development Setup

```bash
cd plugins/codex2cc
npm install
npm test
npm run smoke:mcp
```

`npm test` compiles TypeScript and runs the compiled Node test suite.

`npm run smoke:mcp` starts the same MCP wrapper used by the plugin manifest,
lists tools, and calls `delegate_to_cc` with a fixture worker.

## Configure The Downstream CLI

Codex2CC resolves the downstream executable in this order:

1. Tool input `ccCommand`.
2. Environment variable `CODEX2CC_CC_COMMAND`.
3. Ignored local file `plugins/codex2cc/codex2cc.local.json`.
4. Fallback command `claude`.

If another user installs this repository and does not configure anything,
Codex2CC runs:

```bash
claude <delegatedPrompt>
```

For Claude Code print-style execution, callers usually pass:

```json
{
  "ccArgs": ["--print"]
}
```

That makes the final command:

```bash
claude --print <delegatedPrompt>
```

### Local Command Configuration

To set a local default command without changing tracked files:

```bash
cd plugins/codex2cc
npm run configure:cc -- claude
```

This writes `plugins/codex2cc/codex2cc.local.json`, which is git-ignored.

If your executable is not on the default `claude` path:

```bash
npm run configure:cc -- /usr/local/bin/claude
```

You can also set an environment variable:

```bash
export CODEX2CC_CC_COMMAND=/usr/local/bin/claude
```

`ccCommand` must be only an executable name or path. Put all flags in `ccArgs`.

Valid:

```json
{
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

`codex2cc.local.json` may also include `ccArgs`. Local `ccArgs` are prepended
before tool input `ccArgs`, and the delegated prompt is appended last.

## Usage

After installing the plugin, ask Codex to delegate a bounded task:

```text
Use Codex2CC to ask cc to review this implementation and return findings.
```

For a direct MCP call, the important fields are:

```json
{
  "prompt": "Review the current diff and return actionable findings.",
  "mode": "review",
  "cwd": "/path/to/repo",
  "ccArgs": ["--print"],
  "timeoutMs": 900000,
  "streamOutput": true
}
```

For conversation-aware delegation, Codex should summarize what it can see and
pass the latest instruction explicitly:

```json
{
  "prompt": "Implement the next step.",
  "contextSummary": "Codex selected the minimal API shape and confirmed that ccCommand must not contain flags.",
  "currentInstruction": "Implement the selected API boundary and return changed files plus verification commands.",
  "mode": "code",
  "cwd": "/path/to/repo",
  "ccArgs": ["--print"]
}
```

The MCP server cannot read Codex's private conversation transcript by itself.
Context transfer is explicit and controlled by Codex.

## MCP Tool Contract

Tool name: `delegate_to_cc`.

Input fields:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `prompt` | string | required | Delegated task text. |
| `contextSummary` | string | optional | Summary of Codex-visible prior context. |
| `currentInstruction` | string | optional | Latest active instruction. If set, it becomes the worker task while `prompt` remains the fallback. |
| `cwd` | string | MCP process cwd | Working directory for the downstream command. |
| `mode` | `design` \| `code` \| `review` \| `custom` | `custom` | Delegation mode used for prompt framing. |
| `timeoutMs` | integer | `900000` | Timeout in milliseconds. Maximum: `7200000`. |
| `ccCommand` | string | resolved | Executable override. Must not contain arguments. |
| `ccArgs` | string[] | `[]` | Arguments passed before the delegated prompt. |
| `resultFile` | string | optional | Relative file under `cwd` to read after execution. |
| `maxOutputBytes` | integer | `65536` | Capture limit for stdout, stderr, and result file. Maximum: `1048576`. |
| `streamOutput` | boolean | `true` | Whether to mirror child output to the terminal. |

Structured output:

| Field | Description |
| --- | --- |
| `status` | `success`, `failed`, or `timed_out`. |
| `exitCode` | Downstream process exit code, or `null`. |
| `signal` | Terminating signal, or `null`. |
| `durationMs` | Runtime duration. |
| `command.executable` | Resolved executable. |
| `command.args` | Arguments with the delegated prompt redacted as `[prompt]`. |
| `command.source` | `input`, `environment`, `local-config`, or `fallback`. |
| `promptPreview` | Compact prompt preview. |
| `contextProvided` | Whether `contextSummary` was provided. |
| `cwd` | Resolved working directory. |
| `mode` | Delegation mode. |
| `stdoutTail` / `stderrTail` | Captured bounded output tails. |
| `stdoutTruncated` / `stderrTruncated` | Whether output was trimmed. |
| `resultFile` | Optional file path and content. |
| `error` | Optional failure summary. |

## Architecture

```text
Codex
  -> loads codex2cc plugin
  -> starts MCP server through scripts/codex2cc-mcp.js
  -> imports dist/src/mcp-server.js
  -> registers delegate_to_cc
  -> validates input with Zod
  -> resolves downstream CLI command
  -> builds delegated prompt
  -> spawn(command, [...ccArgs, delegatedPrompt])
  -> streams output and captures tails
  -> optionally reads resultFile
  -> returns structuredContent to Codex
  -> Codex reviews evidence and continues orchestration
```

Main files:

- `plugins/codex2cc/.codex-plugin/plugin.json`: plugin metadata, skill path,
  MCP config path, UI metadata, default prompts.
- `plugins/codex2cc/.mcp.json`: stdio MCP server declaration.
- `plugins/codex2cc/scripts/codex2cc-mcp.js`: runtime wrapper that loads the
  built server from `dist`.
- `plugins/codex2cc/src/mcp-server.ts`: MCP server and `delegate_to_cc` tool.
- `plugins/codex2cc/src/schema.ts`: Zod input schema, defaults, and limits.
- `plugins/codex2cc/src/cli-command.ts`: command resolution and command
  validation.
- `plugins/codex2cc/src/prompt.ts`: prompt framing for each delegation mode.
- `plugins/codex2cc/src/runner.ts`: child-process execution, timeout handling,
  log capture, and result-file reading.
- `plugins/codex2cc/src/log-buffer.ts`: bounded tail buffer.
- `plugins/codex2cc/tests/`: Node test suite and fixture workers.

## Technical Details

### Process execution

The runner uses `spawn()` rather than `exec()`. This avoids shell interpolation
and keeps `ccCommand` separate from `ccArgs`.

On timeout, the runner sends `SIGTERM`, waits briefly, and then sends
`SIGKILL` if the direct child has not exited. It also resolves after the direct
child exits even if a descendant briefly keeps stdio open. This prevents CLI
wrappers from turning a completed parent process into a long false timeout.

### Prompt framing

`design`, `code`, and `review` modes add worker requirements such as staying in
scope, listing changed files, reporting commands and blockers, and returning
control to Codex. `custom` mode uses a lighter wrapper.

If `currentInstruction` is provided, it is the active task. Otherwise `prompt`
is used directly.

### Result files

`resultFile` must be a relative path inside `cwd`. Absolute paths and path
traversal outside `cwd` are rejected. Files larger than `maxOutputBytes` are
rejected.

### Output limits

Stdout and stderr are captured with bounded tail buffers. Large output is
truncated from the front, preserving the newest bytes and setting truncation
flags.

### Built files

The plugin wrapper launches `dist/src/mcp-server.js`, so a fresh checkout needs
the built `dist` files to run immediately. During development, run `npm test` or
`npm run build` after changing TypeScript.

## Verification

Recommended checks:

```bash
cd plugins/codex2cc
npm test
npm run smoke:mcp
```

Optional plugin manifest validation:

```bash
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" .
```

If system Python cannot install dependencies directly, create a temporary
virtual environment and install `PyYAML` before running the validator.

## Troubleshooting

### `claude` is not found

Configure the executable:

```bash
cd plugins/codex2cc
npm run configure:cc -- /absolute/path/to/claude
```

or set:

```bash
export CODEX2CC_CC_COMMAND=/absolute/path/to/claude
```

### `ccCommand must be an executable path or name without arguments`

Move flags from `ccCommand` to `ccArgs`.

Use:

```json
{
  "ccCommand": "claude",
  "ccArgs": ["--print"]
}
```

Do not use:

```json
{
  "ccCommand": "claude --print"
}
```

### `/usr/bin/cc` is rejected

On macOS, `/usr/bin/cc` is clang. Configure a Claude Code compatible executable
instead.

### MCP server says the built server is missing

Build the plugin:

```bash
cd plugins/codex2cc
npm install
npm run build
```

### Downstream CLI exits non-zero

Inspect `stdoutTail`, `stderrTail`, `exitCode`, and `command.source` in
`structuredContent`. Codex2CC reports the process result; it does not reinterpret
the downstream CLI's own auth, quota, network, or permission errors.

## Development Recommendations

- Keep delegated tasks bounded. The plugin is a bridge, not an unattended
  orchestration system.
- Prefer `ccArgs: ["--print"]` for Claude Code style non-interactive runs.
- Pass `contextSummary` and `currentInstruction` when prior Codex conversation
  context matters.
- Keep local command customization in `codex2cc.local.json` or
  `CODEX2CC_CC_COMMAND`; do not commit machine-specific command names.
- Commit `dist` when publishing the plugin so the MCP wrapper can run from a
  fresh checkout.
- Do not commit `node_modules`.
- Run `npm test` after changing TypeScript, schemas, prompt framing, process
  handling, or README examples that describe behavior.

## Publishing Notes

For GitHub publication, include:

- source files under `plugins/codex2cc/src`;
- tests and fixtures;
- `dist` build output;
- `package.json` and `package-lock.json`;
- plugin manifest and MCP config;
- marketplace config;
- README and docs.

Do not include local ignored configuration such as `codex2cc.local.json`.

## Related Documents

- [Requirements](docs/requirements.md)
- [Technical Design](docs/technical-design.md)
- [Checks](docs/checks.md)
- [Project Guide](docs/project-guide.md)
- [Plugin README](plugins/codex2cc/README.md)

---

<a id="简体中文"></a>

## 简体中文

Codex2CC 是一个本地 Codex 插件，用来让 Codex 通过 MCP 把有边界的任务
委托给 Claude Code 兼容 CLI，并拿回结构化执行结果。它适合这样的场景：
Codex 仍然负责整体编排和最终审核，但某个独立的 `claude` 风格命令需要执行
一段明确的设计、编码、评审或自定义任务。

这个插件不会替代 Codex 的判断。Codex 调用下游 CLI，收集结果，审阅证据，
必要时继续运行验证，然后决定下一步。

## 提供的能力

- 一个名为 `codex2cc` 的 Codex 插件。
- 一个名为 `codex2cc` 的 MCP stdio server。
- 一个名为 `delegate_to_cc` 的 MCP 工具。
- 两个 Codex skill：
  - `codex2cc`：把任务委托给 Claude Code 兼容 CLI。
  - `codex2cc-configure`：配置本地下游命令。
- 有上限的 stdout 和 stderr 截取，并返回截断标记。
- 结构化执行元数据：状态、退出码、信号、耗时、命令来源、prompt 预览、
  cwd、任务模式、日志，以及可选结果文件内容。
- 四种委托模式：`design`、`code`、`review`、`custom`。
- 通过 `contextSummary` 和 `currentInstruction` 显式交接上下文。

## 适用场景

当你希望另一个 Claude Code 兼容 CLI 执行一段有边界的任务，同时让 Codex
保留编排权和最终审核权时，可以使用 Codex2CC。

适合：

- 让另一个 CLI 审查一个聚焦 diff；
- 启动一个设计或计划 lane，并返回简短结果；
- 在仓库里委托一个窄范围实现任务；
- 让 Claude Code 兼容工具写出摘要文件，再由 Codex 通过 `resultFile` 读回。

不适合：

- 没有超时边界的长时间自治任务；
- 要求 Codex 不经审核直接信任下游输出；
- 把 shell 插值写进 `ccCommand`；
- 在 macOS 上使用 `/usr/bin/cc`，那是 clang，不是 Claude Code。

## 环境要求

- Node.js 20 或更高版本。
- 支持插件和 MCP 的 Codex CLI 或 Codex App。
- 一个 Claude Code 兼容下游 CLI。默认可执行文件名是 `claude`。
- 如果下游 CLI 需要认证，需要先按它自己的规则完成登录。

## 仓库结构

```text
codex2cc/
  .agents/plugins/marketplace.json
  LICENSE
  README.md
  README.en.md
  README.zh-CN.md
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
      package-lock.json
      scripts/
        codex2cc-mcp.js
        configure-cc-command.js
        smoke-mcp.js
      skills/
        codex2cc/SKILL.md
        codex2cc-configure/SKILL.md
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

仓库根目录是本地 Codex 插件 marketplace。真正可安装的插件位于
`plugins/codex2cc`。

## 安装方式

在仓库根目录执行：

```bash
codex plugin marketplace add "$(pwd)"
codex plugin add codex2cc@codex2cc-local
```

安装或重新安装后，打开一个新的 Codex 会话。Codex 会在会话启动时加载插件
skill 并启动 MCP server。

## 开发环境

```bash
cd plugins/codex2cc
npm install
npm test
npm run smoke:mcp
```

`npm test` 会编译 TypeScript，并运行编译后的 Node 测试套件。

`npm run smoke:mcp` 会启动插件 manifest 使用的同一个 MCP wrapper，列出工具，
并用 fixture worker 调用 `delegate_to_cc`。

## 配置下游 CLI

Codex2CC 按下面顺序解析下游可执行文件：

1. 工具入参 `ccCommand`。
2. 环境变量 `CODEX2CC_CC_COMMAND`。
3. 被 git 忽略的本地文件 `plugins/codex2cc/codex2cc.local.json`。
4. 兜底命令 `claude`。

如果其他用户安装这个仓库且完全没有配置，Codex2CC 会运行：

```bash
claude <delegatedPrompt>
```

对于 Claude Code 的 print 风格非交互执行，调用方通常传：

```json
{
  "ccArgs": ["--print"]
}
```

最终命令就是：

```bash
claude --print <delegatedPrompt>
```

### 本地命令配置

设置本地默认命令且不修改 tracked 文件：

```bash
cd plugins/codex2cc
npm run configure:cc -- claude
```

这会写入被 git 忽略的 `plugins/codex2cc/codex2cc.local.json`。

如果你的可执行文件不在默认 `claude` 路径上：

```bash
npm run configure:cc -- /usr/local/bin/claude
```

也可以设置环境变量：

```bash
export CODEX2CC_CC_COMMAND=/usr/local/bin/claude
```

`ccCommand` 只能是可执行文件名或路径。所有 flags 都必须放在 `ccArgs`。

正确：

```json
{
  "ccCommand": "claude",
  "ccArgs": ["--print"]
}
```

错误：

```json
{
  "ccCommand": "claude --print"
}
```

`codex2cc.local.json` 也可以包含 `ccArgs`。本地 `ccArgs` 会排在工具入参
`ccArgs` 前面，委托 prompt 总是最后追加。

## 使用方式

安装插件后，可以让 Codex 委托一个有边界的任务：

```text
Use Codex2CC to ask cc to review this implementation and return findings.
```

如果直接调用 MCP 工具，核心字段如下：

```json
{
  "prompt": "Review the current diff and return actionable findings.",
  "mode": "review",
  "cwd": "/path/to/repo",
  "ccArgs": ["--print"],
  "timeoutMs": 900000,
  "streamOutput": true
}
```

如果委托任务依赖 Codex 当前对话上下文，Codex 应显式传递摘要和最新指令：

```json
{
  "prompt": "Implement the next step.",
  "contextSummary": "Codex selected the minimal API shape and confirmed that ccCommand must not contain flags.",
  "currentInstruction": "Implement the selected API boundary and return changed files plus verification commands.",
  "mode": "code",
  "cwd": "/path/to/repo",
  "ccArgs": ["--print"]
}
```

MCP server 不能自己读取 Codex 的私有对话 transcript。上下文交接由 Codex
显式控制。

## MCP 工具契约

工具名：`delegate_to_cc`。

输入字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `prompt` | string | 必填 | 被委托的任务文本。 |
| `contextSummary` | string | 可选 | Codex 可见前文上下文摘要。 |
| `currentInstruction` | string | 可选 | 最新有效指令。设置后它会成为 worker 任务，`prompt` 保留为兜底。 |
| `cwd` | string | MCP 进程 cwd | 下游命令工作目录。 |
| `mode` | `design` \| `code` \| `review` \| `custom` | `custom` | 用于 prompt framing 的委托模式。 |
| `timeoutMs` | integer | `900000` | 超时时间，单位毫秒。最大值：`7200000`。 |
| `ccCommand` | string | 解析得到 | 可执行文件覆盖值。不能包含参数。 |
| `ccArgs` | string[] | `[]` | 委托 prompt 之前传入的参数。 |
| `resultFile` | string | 可选 | 执行后读取的 `cwd` 内相对文件路径。 |
| `maxOutputBytes` | integer | `65536` | stdout、stderr 和结果文件的截取上限。最大值：`1048576`。 |
| `streamOutput` | boolean | `true` | 是否把子进程输出实时镜像到终端。 |

结构化输出：

| 字段 | 说明 |
| --- | --- |
| `status` | `success`、`failed` 或 `timed_out`。 |
| `exitCode` | 下游进程退出码，或 `null`。 |
| `signal` | 终止信号，或 `null`。 |
| `durationMs` | 执行耗时。 |
| `command.executable` | 解析后的可执行文件。 |
| `command.args` | 参数列表，委托 prompt 会被脱敏成 `[prompt]`。 |
| `command.source` | `input`、`environment`、`local-config` 或 `fallback`。 |
| `promptPreview` | 压缩后的 prompt 预览。 |
| `contextProvided` | 是否提供了 `contextSummary`。 |
| `cwd` | 解析后的工作目录。 |
| `mode` | 委托模式。 |
| `stdoutTail` / `stderrTail` | 有上限的输出尾部。 |
| `stdoutTruncated` / `stderrTruncated` | 输出是否被裁剪。 |
| `resultFile` | 可选文件路径和内容。 |
| `error` | 可选失败摘要。 |

## 项目架构

```text
Codex
  -> 加载 codex2cc 插件
  -> 通过 scripts/codex2cc-mcp.js 启动 MCP server
  -> 导入 dist/src/mcp-server.js
  -> 注册 delegate_to_cc
  -> 使用 Zod 校验输入
  -> 解析下游 CLI 命令
  -> 构造委托 prompt
  -> spawn(command, [...ccArgs, delegatedPrompt])
  -> 流式输出并截取尾部日志
  -> 可选读取 resultFile
  -> 返回 structuredContent 给 Codex
  -> Codex 审阅证据并继续编排
```

主要文件：

- `plugins/codex2cc/.codex-plugin/plugin.json`：插件元数据、skill 路径、
  MCP config 路径、UI 信息和默认 prompt。
- `plugins/codex2cc/.mcp.json`：stdio MCP server 声明。
- `plugins/codex2cc/scripts/codex2cc-mcp.js`：运行时 wrapper，从 `dist`
  加载构建后的 server。
- `plugins/codex2cc/src/mcp-server.ts`：MCP server 和 `delegate_to_cc` 工具。
- `plugins/codex2cc/src/schema.ts`：Zod 输入 schema、默认值和限制。
- `plugins/codex2cc/src/cli-command.ts`：命令解析和命令校验。
- `plugins/codex2cc/src/prompt.ts`：各委托模式的 prompt framing。
- `plugins/codex2cc/src/runner.ts`：子进程执行、超时处理、日志截取和结果文件读取。
- `plugins/codex2cc/src/log-buffer.ts`：有上限的 tail buffer。
- `plugins/codex2cc/tests/`：Node 测试套件和 fixture workers。

## 技术细节

### 进程执行

runner 使用 `spawn()`，不使用 `exec()`。这样可以避免 shell 插值，并保持
`ccCommand` 和 `ccArgs` 分离。

超时时，runner 会发送 `SIGTERM`，短暂等待后，如果直接子进程还没有退出，再发送
`SIGKILL`。如果直接子进程已经退出，即使 descendant 短暂持有 stdio，也会在短暂
drain 后返回，避免 CLI wrapper 把已结束的父进程伪装成长时间 timeout。

### Prompt framing

`design`、`code` 和 `review` 模式会加入 worker 要求，例如保持范围、列出修改文件、
报告执行命令和 blocker，并把控制权交还给 Codex。`custom` 模式使用更轻量的包装。

如果提供了 `currentInstruction`，它就是有效任务；否则直接使用 `prompt`。

### 结果文件

`resultFile` 必须是 `cwd` 内的相对路径。绝对路径和逃逸出 `cwd` 的路径都会被拒绝。
超过 `maxOutputBytes` 的文件会被拒绝。

### 输出限制

stdout 和 stderr 使用有上限的 tail buffer 截取。超大输出会从前面裁剪，保留最新
字节，并设置 truncation 标记。

### 构建产物

插件 wrapper 启动的是 `dist/src/mcp-server.js`，因此如果希望 fresh checkout
能立即运行插件，需要提交当前 `dist` 构建产物。开发时修改 TypeScript 后运行
`npm test` 或 `npm run build`。

## 验证

推荐检查：

```bash
cd plugins/codex2cc
npm test
npm run smoke:mcp
```

可选插件 manifest 校验：

```bash
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" .
```

如果系统 Python 不能直接安装依赖，可以创建临时 virtualenv，安装 `PyYAML`
后再运行校验脚本。

## 故障排查

### 找不到 `claude`

配置可执行文件：

```bash
cd plugins/codex2cc
npm run configure:cc -- /absolute/path/to/claude
```

或设置：

```bash
export CODEX2CC_CC_COMMAND=/absolute/path/to/claude
```

### `ccCommand must be an executable path or name without arguments`

把 flags 从 `ccCommand` 移到 `ccArgs`。

使用：

```json
{
  "ccCommand": "claude",
  "ccArgs": ["--print"]
}
```

不要使用：

```json
{
  "ccCommand": "claude --print"
}
```

### `/usr/bin/cc` 被拒绝

在 macOS 上，`/usr/bin/cc` 是 clang。请配置 Claude Code 兼容可执行文件。

### MCP server 提示缺少构建后的 server

构建插件：

```bash
cd plugins/codex2cc
npm install
npm run build
```

### 下游 CLI 非零退出

查看 `structuredContent` 中的 `stdoutTail`、`stderrTail`、`exitCode` 和
`command.source`。Codex2CC 只报告进程结果，不会重新解释下游 CLI 自身的认证、
额度、网络或权限错误。

## 开发建议

- 保持委托任务有明确边界。这个插件是桥接器，不是无人值守编排系统。
- Claude Code 风格非交互运行优先使用 `ccArgs: ["--print"]`。
- 如果任务依赖 Codex 前文对话，传入 `contextSummary` 和 `currentInstruction`。
- 本机命令定制放在 `codex2cc.local.json` 或 `CODEX2CC_CC_COMMAND`，不要提交机器
  私有命令名。
- 发布插件时提交 `dist`，让 MCP wrapper 可以从 fresh checkout 直接运行。
- 不要提交 `node_modules`。
- 修改 TypeScript、schema、prompt framing、进程处理或 README 行为示例后，运行
  `npm test`。

## 发布建议

发布到 GitHub 时建议包含：

- `plugins/codex2cc/src` 下的源码；
- 测试和 fixtures；
- `dist` 构建产物；
- `package.json` 和 `package-lock.json`；
- 插件 manifest 和 MCP config；
- marketplace config；
- README 和 docs。

不要包含本地 ignored 配置，例如 `codex2cc.local.json`。

## 相关文档

- [需求说明](docs/requirements.md)
- [技术方案](docs/technical-design.md)
- [检查记录](docs/checks.md)
- [项目完整说明](docs/project-guide.md)
- [插件 README](plugins/codex2cc/README.md)
