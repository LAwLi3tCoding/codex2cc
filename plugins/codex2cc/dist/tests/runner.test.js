import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runDelegatedTask } from "../src/runner.js";
const fixturesDir = path.join(process.cwd(), "tests", "fixtures");
describe("runDelegatedTask", () => {
    it("streams and captures successful worker output", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-success-"));
        const result = await runDelegatedTask({
            prompt: "hello from codex",
            mode: "custom",
            cwd,
            ccCommand: process.execPath,
            ccArgs: [path.join(fixturesDir, "echo-worker.mjs")],
            streamOutput: false,
            timeoutMs: 2000,
            maxOutputBytes: 1024
        });
        assert.equal(result.status, "success");
        assert.equal(result.exitCode, 0);
        assert.match(result.stdoutTail, /stdout:/);
        assert.match(result.stderrTail, /stderr:diagnostic/);
        assert.equal(result.command.executable, process.execPath);
        assert.deepEqual(result.command.args, [path.join(fixturesDir, "echo-worker.mjs"), "[prompt]"]);
    });
    it("reports non-zero exits as failed", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-fail-"));
        const result = await runDelegatedTask({
            prompt: "fail",
            mode: "custom",
            cwd,
            ccCommand: process.execPath,
            ccArgs: [path.join(fixturesDir, "fail-worker.mjs")],
            streamOutput: false,
            timeoutMs: 2000,
            maxOutputBytes: 1024
        });
        assert.equal(result.status, "failed");
        assert.equal(result.exitCode, 7);
        assert.match(result.stderrTail, /intentional failure/);
    });
    it("terminates workers that exceed timeout", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-timeout-"));
        const result = await runDelegatedTask({
            prompt: "sleep",
            mode: "custom",
            cwd,
            ccCommand: process.execPath,
            ccArgs: [path.join(fixturesDir, "sleep-worker.mjs")],
            streamOutput: false,
            timeoutMs: 100,
            maxOutputBytes: 1024
        });
        assert.equal(result.status, "timed_out");
        assert.match(result.error ?? "", /timed out/);
    });
    it("escalates to SIGKILL when a timed-out worker ignores SIGTERM", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-kill-"));
        const result = await runDelegatedTask({
            prompt: "ignore term",
            mode: "custom",
            cwd,
            ccCommand: process.execPath,
            ccArgs: [path.join(fixturesDir, "ignore-term-worker.mjs")],
            streamOutput: false,
            timeoutMs: 100,
            maxOutputBytes: 2048,
            killGraceMs: 50
        });
        assert.equal(result.status, "timed_out");
        assert.equal(result.signal, "SIGKILL");
        assert.match(result.stderrTail, /ignored SIGTERM/);
    });
    it("reads result files under cwd", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-result-"));
        await writeFile(path.join(cwd, "summary.txt"), "worker summary", "utf8");
        const result = await runDelegatedTask({
            prompt: "hello",
            mode: "custom",
            cwd,
            ccCommand: process.execPath,
            ccArgs: [path.join(fixturesDir, "echo-worker.mjs")],
            resultFile: "summary.txt",
            streamOutput: false,
            timeoutMs: 2000,
            maxOutputBytes: 1024
        });
        assert.equal(result.resultFile?.path, path.join(cwd, "summary.txt"));
        assert.equal(result.resultFile?.content, "worker summary");
    });
    it("rejects result files outside cwd", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-traversal-"));
        await assert.rejects(() => runDelegatedTask({
            prompt: "hello",
            mode: "custom",
            cwd,
            ccCommand: process.execPath,
            ccArgs: [path.join(fixturesDir, "echo-worker.mjs")],
            resultFile: "../outside.txt",
            streamOutput: false,
            timeoutMs: 2000,
            maxOutputBytes: 1024
        }), /resultFile must stay inside cwd/);
    });
});
