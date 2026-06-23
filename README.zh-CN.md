# Codex2CC

语言：[English](README.en.md) | [简体中文](README.zh-CN.md)

Codex2CC 是一个本地 Codex 插件，用来让 Codex 把有边界的设计、编码、
审核或自定义任务委托给 Claude Code 兼容 CLI，再把结构化执行结果交回
Codex，由 Codex 继续编排、审核和验证。

核心边界是：下游 CLI 负责执行被委托的任务，Codex 仍然是最终编排者和审核者。

## 能力

- 向 Codex 暴露 `delegate_to_cc` MCP 工具。
- 启动可配置的下游 CLI 进程。
- 将子进程 stdout 和 stderr 实时展示到用户终端。
- 截取有上限的 stdout 和 stderr 尾部日志。
- 返回结构化状态、退出码、信号、命令元数据、耗时、日志和可选结果文件内容。
- 支持 `design`、`code`、`review`、`custom` 四种任务模式。
- 支持通过 `contextSummary` 和 `currentInstruction` 把 Codex 可见上下文交给 cc。
- 使用无 shell 的 `spawn()` 启动命令，参数显式传入。

## 仓库结构

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

仓库根目录是本地 marketplace 根目录。真正可安装的插件在
`plugins/codex2cc`。

## 环境要求

- Node.js 20 或更高版本。
- 支持插件能力的 Codex CLI。
- 一个 Claude Code 兼容的下游 CLI，通常是 `claude`。
- 如果下游 CLI 需要登录，需要提前完成认证。

在 macOS 上不要使用 `/usr/bin/cc`。这个命令是 clang，不是 Claude Code，
Codex2CC 会拒绝它。

## 本地安装

在仓库根目录执行：

```bash
codex plugin marketplace add "$(pwd)"
codex plugin add codex2cc@codex2cc-local
```

安装或重新安装后，需要打开一个新的 Codex 会话，让插件的 MCP 工具和 skill
在会话启动时加载。

## 开发

```bash
cd plugins/codex2cc
npm install
npm test
npm run smoke:mcp
```

`npm test` 会先编译 TypeScript，再运行编译后的 Node 测试。
`npm run smoke:mcp` 会通过插件 manifest 使用的同一个 wrapper 启动 MCP
server，并用 fixture worker 调用 `delegate_to_cc`。

## 启动 cc 的命令

当前本地插件配置通过 `plugins/codex2cc/.mcp.json` 里的
`CODEX2CC_CC_COMMAND` 默认启动：

```bash
occ
```

Codex2CC 按下面顺序解析下游 CLI：

1. 工具入参 `ccCommand`。
2. 环境变量 `CODEX2CC_CC_COMMAND`。
3. 如果前两者都未设置，才使用兜底命令 `claude`。

`ccCommand` 只能是可执行文件名或路径，不能带空格和参数。参数必须放到
`ccArgs`。

正确示例：

```json
{
  "prompt": "设计新的 API 边界。",
  "mode": "design",
  "cwd": "/path/to/repo",
  "ccCommand": "occ",
  "ccArgs": ["--print"]
}
```

错误示例：

```json
{
  "ccCommand": "claude --print"
}
```

如果你的 cc 命令不是 `occ`，可以这样自定义：

```json
{
  "ccCommand": "/usr/local/bin/occ",
  "ccArgs": ["--print"]
}
```

也可以设置环境变量：

```bash
export CODEX2CC_CC_COMMAND=/usr/local/bin/occ
```

## 工具契约

工具名：`delegate_to_cc`。

输入字段：

- `prompt`：必填，被委托的任务。
- `contextSummary`：可选，Codex 在调用工具前整理出的前文对话或任务相关上下文摘要。
- `currentInstruction`：可选，最新任务指令；提供后它会作为 cc 的当前任务，`prompt`
  仍作为必填兜底字段保留。
- `cwd`：工作目录。默认是 MCP server 进程目录。
- `mode`：`design`、`code`、`review` 或 `custom`。
- `ccCommand`：可选，下游可执行文件覆盖值。
- `ccArgs`：可选，下游命令参数；委托 prompt 会被追加到最后。
- `timeoutMs`：超时时间，单位毫秒，默认 `900000`。
- `resultFile`：可选，执行完成后读取 `cwd` 下的相对路径文件。
- `maxOutputBytes`：输出截取上限，默认 `65536`。
- `streamOutput`：是否把子进程输出实时展示到终端，默认 `true`。

结构化输出包括：

- `status`：`success`、`failed` 或 `timed_out`。
- `exitCode` 和 `signal`。
- `durationMs`。
- `command.executable` 和脱敏后的 `command.args`。
- `cwd`、`mode`、`promptPreview` 和 `contextProvided`。
- `stdoutTail`、`stderrTail` 和截断标记。
- 可选 `resultFile`。
- 可选 `error`。

## 使用示例

插件安装后，在新的 Codex 会话里可以这样要求 Codex 委托任务：

```text
使用 Codex2CC 让 cc 审核当前实现，并返回问题列表。
```

如果要在 Codex 对话过程中让 cc 承接前文上下文，Codex 会先总结当前可见对话，
再调用工具：

```json
{
  "prompt": "执行下一步任务。",
  "contextSummary": "Codex 已经确定采用最小 API 方案，v1 不引入 hooks，并确认 ccCommand 不能带参数。",
  "currentInstruction": "实现选定的 API 边界，并返回修改文件和验证命令。",
  "mode": "code",
  "cwd": "/path/to/repo",
  "ccCommand": "occ",
  "ccArgs": ["--print"]
}
```

MCP server 不能自己读取 Codex 私有对话 transcript。当前支持的机制是显式交接：
Codex 先把自己当前可见的上下文总结成 `contextSummary`，把最新任务放进
`currentInstruction`，Codex2CC 再把两部分组织进最终传给 cc 的 prompt。

带自定义命令配置的示例：

```json
{
  "prompt": "实现这个小范围 bug 修复，并总结修改过的文件。",
  "mode": "code",
  "cwd": "/path/to/repo",
  "ccCommand": "occ",
  "ccArgs": ["--print"],
  "timeoutMs": 1800000,
  "streamOutput": true
}
```

## 开发期间更新插件

修改插件源码后执行：

```bash
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py" \
  "$(pwd)/plugins/codex2cc"

codex plugin add codex2cc@codex2cc-local
```

然后打开新的 Codex 会话。

## 验证

推荐检查：

```bash
cd plugins/codex2cc
npm test
npm run smoke:mcp
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" .
```

如果系统 Python 不能直接安装依赖，可以创建临时 virtualenv，安装 `PyYAML`
后再运行插件校验脚本。

## GitHub 发布说明

建议提交源码、文档、lock 文件、插件 manifest、marketplace 配置，以及当前
构建出的 `dist` 文件，这样别人从仓库拉取后可以更快验证插件。不要提交
`node_modules`。

要推送到 GitHub，需要先把当前目录初始化为 Git 仓库，连接 GitHub remote，
提交 commit，然后 push。

## 文档

- [需求说明](docs/requirements.md)
- [技术方案](docs/technical-design.md)
- [检查记录](docs/checks.md)
- [项目完整说明](docs/project-guide.md)
- [插件 README](plugins/codex2cc/README.md)
