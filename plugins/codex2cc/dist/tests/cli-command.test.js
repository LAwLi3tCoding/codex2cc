import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveCliCommand } from "../src/cli-command.js";
describe("resolveCliCommand", () => {
    it("uses explicit command before environment and fallback", async () => {
        const resolved = await resolveCliCommand({
            ccCommand: "node",
            env: { CODEX2CC_CC_COMMAND: "claude" }
        });
        assert.equal(resolved.command, "node");
        assert.equal(resolved.source, "input");
    });
    it("rejects compiler-style cc commands", async () => {
        await assert.rejects(() => resolveCliCommand({
            ccCommand: "/usr/bin/cc",
            env: {}
        }), /compiler/);
    });
    it("rejects command strings that include arguments", async () => {
        await assert.rejects(() => resolveCliCommand({
            ccCommand: "claude --print",
            env: {}
        }), /ccArgs/);
    });
    it("falls back to claude when no override is provided", async () => {
        const resolved = await resolveCliCommand({
            env: {}
        });
        assert.equal(resolved.command, "claude");
        assert.equal(resolved.source, "fallback");
    });
    it("uses ignored local config before fallback", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-config-"));
        await writeFile(path.join(cwd, "codex2cc.local.json"), '{"ccCommand":"occ"}\n', "utf8");
        const resolved = await resolveCliCommand({
            env: {},
            configDir: cwd
        });
        assert.equal(resolved.command, "occ");
        assert.equal(resolved.source, "local-config");
    });
    it("uses environment before ignored local config", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "codex2cc-env-config-"));
        await writeFile(path.join(cwd, "codex2cc.local.json"), '{"ccCommand":"occ"}\n', "utf8");
        const resolved = await resolveCliCommand({
            env: { CODEX2CC_CC_COMMAND: "claude" },
            configDir: cwd
        });
        assert.equal(resolved.command, "claude");
        assert.equal(resolved.source, "environment");
    });
});
