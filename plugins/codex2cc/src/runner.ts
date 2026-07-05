import { spawn } from "node:child_process";
import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCliCommand } from "./cli-command.js";
import { LogBuffer } from "./log-buffer.js";
import { buildDelegatedPrompt, previewPrompt, type DelegationMode } from "./prompt.js";

export interface RunDelegatedTaskInput {
  prompt: string;
  contextSummary?: string;
  currentInstruction?: string;
  cwd: string;
  mode: DelegationMode;
  timeoutMs: number;
  ccCommand?: string;
  ccArgs?: string[];
  resultFile?: string;
  maxOutputBytes: number;
  streamOutput: boolean;
  killGraceMs?: number;
}

export type DelegatedTaskStatus = "success" | "failed" | "timed_out";

export interface DelegatedTaskResult {
  [key: string]: unknown;
  status: DelegatedTaskStatus;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  command: {
    executable: string;
    args: string[];
    source: string;
  };
  promptPreview: string;
  contextProvided: boolean;
  cwd: string;
  mode: DelegationMode;
  stdoutTail: string;
  stderrTail: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  resultFile?: {
    path: string;
    content: string;
    truncated: boolean;
  };
  error?: string;
}

const EXIT_STDIO_DRAIN_MS = 50;

export async function runDelegatedTask(input: RunDelegatedTaskInput): Promise<DelegatedTaskResult> {
  const cwd = path.resolve(input.cwd);
  const command = await resolveCliCommand({
    ccCommand: input.ccCommand,
    configDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
    env: process.env
  });
  const delegatedPrompt = buildDelegatedPrompt({
    mode: input.mode,
    cwd,
    prompt: input.prompt,
    contextSummary: input.contextSummary,
    currentInstruction: input.currentInstruction
  });
  const args = [...command.args, ...(input.ccArgs ?? []), delegatedPrompt];
  const redactedArgs = [...command.args, ...(input.ccArgs ?? []), "[prompt]"];
  const stdout = new LogBuffer(input.maxOutputBytes);
  const stderr = new LogBuffer(input.maxOutputBytes);
  const startedAt = Date.now();

  const processResult = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    spawnError?: Error;
  }>((resolve) => {
    let settled = false;
    let timedOut = false;
    let timeout: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let exitDrainTimer: NodeJS.Timeout | undefined;
    const killGraceMs = input.killGraceMs ?? 1000;

    const child = spawn(command.command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const clearTimers = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      if (exitDrainTimer) {
        clearTimeout(exitDrainTimer);
      }
    };

    const finish = (result: {
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      timedOut: boolean;
      spawnError?: Error;
    }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      resolve(result);
    };

    const finishAfterExit = (result: {
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      timedOut: boolean;
    }) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      exitDrainTimer = setTimeout(() => finish(result), EXIT_STDIO_DRAIN_MS);
    };

    timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }, killGraceMs);
    }, input.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout.append(chunk);
      if (input.streamOutput) {
        process.stdout.write(chunk);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr.append(chunk);
      if (input.streamOutput) {
        process.stderr.write(chunk);
      }
    });

    child.on("error", (error) => {
      finish({ exitCode: null, signal: null, timedOut, spawnError: error });
    });

    child.on("exit", (exitCode, signal) => {
      if (settled) {
        return;
      }
      finishAfterExit({ exitCode, signal, timedOut });
    });

    child.on("close", (exitCode, signal) => {
      finish({ exitCode, signal, timedOut });
    });
  });

  const durationMs = Date.now() - startedAt;
  const status: DelegatedTaskStatus = processResult.timedOut
    ? "timed_out"
    : processResult.exitCode === 0 && !processResult.spawnError
      ? "success"
      : "failed";

  const result: DelegatedTaskResult = {
    status,
    exitCode: processResult.exitCode,
    signal: processResult.signal,
    durationMs,
    command: {
      executable: command.command,
      args: redactedArgs,
      source: command.source
    },
    promptPreview: previewPrompt(delegatedPrompt),
    contextProvided: Boolean(input.contextSummary),
    cwd,
    mode: input.mode,
    stdoutTail: stdout.text(),
    stderrTail: stderr.text(),
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated
  };

  if (processResult.spawnError) {
    result.error = processResult.spawnError.message;
  } else if (status === "timed_out") {
    result.error = `Delegated CLI timed out after ${input.timeoutMs}ms`;
  } else if (status === "failed") {
    result.error = `Delegated CLI exited with code ${processResult.exitCode}`;
  }

  if (input.resultFile) {
    result.resultFile = await readResultFile(cwd, input.resultFile, input.maxOutputBytes);
  }

  return result;
}

async function readResultFile(
  cwd: string,
  resultFile: string,
  maxBytes: number
): Promise<{ path: string; content: string; truncated: boolean }> {
  if (path.isAbsolute(resultFile)) {
    throw new Error("resultFile must stay inside cwd");
  }

  const absolutePath = path.resolve(cwd, resultFile);
  const relative = path.relative(cwd, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("resultFile must stay inside cwd");
  }

  const fileStat = await stat(absolutePath);
  if (fileStat.size > maxBytes) {
    throw new Error(`resultFile exceeds maxOutputBytes (${maxBytes})`);
  }

  return {
    path: absolutePath,
    content: await readFile(absolutePath, "utf8"),
    truncated: false
  };
}
