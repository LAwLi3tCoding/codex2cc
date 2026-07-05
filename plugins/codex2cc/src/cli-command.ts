import path from "node:path";
import { readFile } from "node:fs/promises";

export type CommandSource = "input" | "environment" | "local-config" | "fallback";

export interface ResolveCliCommandInput {
  ccCommand?: string;
  configDir?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

export interface ResolvedCliCommand {
  command: string;
  args: string[];
  source: CommandSource;
}

export async function resolveCliCommand(
  input: ResolveCliCommandInput = {}
): Promise<ResolvedCliCommand> {
  const env = input.env ?? process.env;
  const localConfig = await readLocalConfig(input.configDir);
  const rawCommand = firstNonEmpty(
    input.ccCommand,
    env.CODEX2CC_CC_COMMAND,
    localConfig.ccCommand,
    "claude"
  );
  const source: CommandSource = input.ccCommand?.trim()
    ? "input"
    : env.CODEX2CC_CC_COMMAND?.trim()
      ? "environment"
      : localConfig.ccCommand?.trim()
        ? "local-config"
        : "fallback";

  const command = rawCommand.trim();
  rejectCommandWithArguments(command);
  rejectCompilerCc(command);

  return {
    command,
    args: source === "local-config" ? localConfig.ccArgs : [],
    source
  };
}

async function readLocalConfig(configDir?: string): Promise<{ ccCommand?: string; ccArgs: string[] }> {
  if (!configDir) {
    return { ccArgs: [] };
  }

  try {
    const configPath = path.join(configDir, "codex2cc.local.json");
    const rawConfig = await readFile(configPath, "utf8");
    const parsed = JSON.parse(rawConfig) as { ccCommand?: unknown; ccArgs?: unknown };
    return {
      ccCommand: typeof parsed.ccCommand === "string" ? parsed.ccCommand : undefined,
      ccArgs: Array.isArray(parsed.ccArgs)
        ? parsed.ccArgs.filter((arg): arg is string => typeof arg === "string")
        : []
    };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
    if (code === "ENOENT") {
      return { ccArgs: [] };
    }
    throw error;
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value?.trim()) {
      return value;
    }
  }
  throw new Error("No CLI command could be resolved");
}

function rejectCompilerCc(command: string): void {
  const basename = path.basename(command);
  if (basename === "cc" || command === "/usr/bin/cc") {
    throw new Error(
      `Refusing to use compiler-style cc command '${command}'. Configure a Claude Code compatible CLI instead.`
    );
  }
}

function rejectCommandWithArguments(command: string): void {
  if (/\s/.test(command)) {
    throw new Error(
      `ccCommand must be an executable path or name without arguments. Put arguments in ccArgs instead.`
    );
  }
}
