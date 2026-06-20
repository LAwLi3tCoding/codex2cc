import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDelegateInput } from "../src/schema.js";
describe("normalizeDelegateInput", () => {
    it("applies defaults and clamps supported fields", () => {
        const input = normalizeDelegateInput({ prompt: "do work" }, "/tmp/project");
        assert.equal(input.prompt, "do work");
        assert.equal(input.cwd, "/tmp/project");
        assert.equal(input.mode, "custom");
        assert.equal(input.timeoutMs, 900000);
        assert.equal(input.maxOutputBytes, 65536);
        assert.equal(input.streamOutput, true);
    });
    it("rejects invalid timeout and mode", () => {
        assert.throws(() => normalizeDelegateInput({ prompt: "x", mode: "other" }, "/tmp/project"), /mode/);
        assert.throws(() => normalizeDelegateInput({ prompt: "x", timeoutMs: 1 }, "/tmp/project"), /timeoutMs/);
    });
});
