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
});
