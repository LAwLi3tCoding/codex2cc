import path from "node:path";
import { readFile } from "node:fs/promises";
export async function resolveCliCommand(input = {}) {
    const env = input.env ?? process.env;
    const localConfigCommand = await readLocalConfigCommand(input.configDir);
    const rawCommand = firstNonEmpty(input.ccCommand, env.CODEX2CC_CC_COMMAND, localConfigCommand, "claude");
    const source = input.ccCommand?.trim()
        ? "input"
        : env.CODEX2CC_CC_COMMAND?.trim()
            ? "environment"
            : localConfigCommand?.trim()
                ? "local-config"
                : "fallback";
    const command = rawCommand.trim();
    rejectCommandWithArguments(command);
    rejectCompilerCc(command);
    return { command, source };
}
async function readLocalConfigCommand(configDir) {
    if (!configDir) {
        return undefined;
    }
    try {
        const configPath = path.join(configDir, "codex2cc.local.json");
        const rawConfig = await readFile(configPath, "utf8");
        const parsed = JSON.parse(rawConfig);
        return typeof parsed.ccCommand === "string" ? parsed.ccCommand : undefined;
    }
    catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
        if (code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}
function firstNonEmpty(...values) {
    for (const value of values) {
        if (value?.trim()) {
            return value;
        }
    }
    throw new Error("No CLI command could be resolved");
}
function rejectCompilerCc(command) {
    const basename = path.basename(command);
    if (basename === "cc" || command === "/usr/bin/cc") {
        throw new Error(`Refusing to use compiler-style cc command '${command}'. Configure a Claude Code compatible CLI instead.`);
    }
}
function rejectCommandWithArguments(command) {
    if (/\s/.test(command)) {
        throw new Error(`ccCommand must be an executable path or name without arguments. Put arguments in ccArgs instead.`);
    }
}
