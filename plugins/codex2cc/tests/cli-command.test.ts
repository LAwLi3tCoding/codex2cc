import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    await assert.rejects(
      () => resolveCliCommand({
        ccCommand: "/usr/bin/cc",
        env: {}
      }),
      /compiler/
    );
  });

  it("rejects command strings that include arguments", async () => {
    await assert.rejects(
      () =>
        resolveCliCommand({
          ccCommand: "claude --print",
          env: {}
        }),
      /ccArgs/
    );
  });

  it("falls back to claude when no override is provided", async () => {
    const resolved = await resolveCliCommand({
      env: {}
    });

    assert.equal(resolved.command, "claude");
    assert.equal(resolved.source, "fallback");
  });
});
