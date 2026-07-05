---
name: codex2cc-configure
description: Quickly configure the local Codex2CC downstream cc command by setting CODEX2CC_CC_COMMAND or writing codex2cc.local.json.
---

# Codex2CC Configure

Use this skill when the user wants to set or change the local command Codex2CC
uses to start cc.

## Fast Path

From `plugins/codex2cc`:

```bash
npm run configure:cc -- claude
```

Replace `claude` with another local executable name or absolute path when
needed, for example `/usr/local/bin/claude`.

This writes `codex2cc.local.json`, which is ignored by git and read by the MCP
wrapper before the server starts.

## Override Rules

Codex2CC resolves the command in this order:

1. tool input `ccCommand`;
2. environment variable `CODEX2CC_CC_COMMAND`;
3. local ignored file `codex2cc.local.json`;
4. fallback `claude`.

Arguments do not belong in the command. Put flags in `ccArgs`; when using
`codex2cc.local.json`, `ccArgs` must be an array of strings.

## After Changing

Reinstall or refresh the plugin if needed, then open a new Codex session so the
MCP server starts with the new local configuration.
