import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDelegatedPrompt } from "../src/prompt.js";
describe("buildDelegatedPrompt", () => {
    it("frames design work as delegated work that returns to Codex", () => {
        const prompt = buildDelegatedPrompt({
            mode: "design",
            cwd: "/tmp/project",
            prompt: "Design the auth flow."
        });
        assert.match(prompt, /delegated worker/);
        assert.match(prompt, /Mode: design/);
        assert.match(prompt, /\/tmp\/project/);
        assert.match(prompt, /return control to Codex/);
        assert.match(prompt, /Design the auth flow\./);
    });
    it("keeps custom mode lightweight", () => {
        const prompt = buildDelegatedPrompt({
            mode: "custom",
            cwd: "/tmp/project",
            prompt: "Say hi."
        });
        assert.match(prompt, /Say hi\./);
        assert.match(prompt, /return control to Codex/);
        assert.doesNotMatch(prompt, /changed files/);
    });
    it("includes Codex-visible context summary and current instruction when provided", () => {
        const prompt = buildDelegatedPrompt({
            mode: "code",
            cwd: "/tmp/project",
            prompt: "Fallback task text.",
            contextSummary: "Codex already designed the API and selected option B.",
            currentInstruction: "Implement the selected API boundary."
        });
        assert.match(prompt, /Codex-visible context summary:/);
        assert.match(prompt, /Codex already designed the API/);
        assert.match(prompt, /Current instruction from Codex:/);
        assert.match(prompt, /Implement the selected API boundary/);
        assert.doesNotMatch(prompt, /Fallback task text/);
    });
});
