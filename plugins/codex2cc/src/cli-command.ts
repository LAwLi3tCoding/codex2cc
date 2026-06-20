import path from "node:path";

export type CommandSource = "input" | "environment" | "fallback";

export interface ResolveCliCommandInput {
  ccCommand?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

export interface ResolvedCliCommand {
  command: string;
  source: CommandSource;
}

export async function resolveCliCommand(
  input: ResolveCliCommandInput = {}
): Promise<ResolvedCliCommand> {
  const env = input.env ?? process.env;
  const rawCommand = firstNonEmpty(input.ccCommand, env.CODEX2CC_CC_COMMAND, "claude");
  const source: CommandSource = input.ccCommand?.trim()
    ? "input"
    : env.CODEX2CC_CC_COMMAND?.trim()
      ? "environment"
      : "fallback";

  const command = rawCommand.trim();
  rejectCommandWithArguments(command);
  rejectCompilerCc(command);

  return { command, source };
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
