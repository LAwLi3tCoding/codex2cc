import path from "node:path";
import { readFile } from "node:fs/promises";
export async function resolveCliCommand(input = {}) {
    const env = input.env ?? process.env;
    const explicitCommand = input.ccCommand?.trim();
    if (explicitCommand) {
        return buildResolvedCommand(explicitCommand, [], "input");
    }
    const envCommand = env.CODEX2CC_CC_COMMAND?.trim();
    if (envCommand) {
        return buildResolvedCommand(envCommand, [], "environment");
    }
    const localConfig = await readLocalConfig(input.configDir);
    const localCommand = localConfig.ccCommand?.trim();
    if (localCommand) {
        return buildResolvedCommand(localCommand, localConfig.ccArgs, "local-config");
    }
    return buildResolvedCommand("claude", [], "fallback");
}
async function readLocalConfig(configDir) {
    if (!configDir) {
        return { ccArgs: [] };
    }
    try {
        const configPath = path.join(configDir, "codex2cc.local.json");
        const rawConfig = await readFile(configPath, "utf8");
        const parsed = JSON.parse(rawConfig);
        return {
            ccCommand: typeof parsed.ccCommand === "string" ? parsed.ccCommand : undefined,
            ccArgs: parseLocalCcArgs(parsed.ccArgs)
        };
    }
    catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
        if (code === "ENOENT") {
            return { ccArgs: [] };
        }
        throw error;
    }
}
function parseLocalCcArgs(value) {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error("codex2cc.local.json ccArgs must be an array of strings");
    }
    for (const arg of value) {
        if (typeof arg !== "string") {
            throw new Error("codex2cc.local.json ccArgs must be an array of strings");
        }
    }
    return value;
}
function buildResolvedCommand(command, args, source) {
    rejectCommandWithArguments(command);
    rejectCompilerCc(command);
    return {
        command,
        args,
        source
    };
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
