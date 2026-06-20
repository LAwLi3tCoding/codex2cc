export function buildDelegatedPrompt(input) {
    const header = [
        "You are a delegated worker launched by Codex.",
        "Codex remains the orchestrator and final reviewer.",
        `Mode: ${input.mode}`,
        `Workspace: ${input.cwd}`,
        "When finished, return control to Codex with a concise summary."
    ];
    if (input.mode === "custom") {
        return [
            ...header,
            "",
            "Task:",
            input.prompt,
            "",
            "Do not claim final acceptance; return control to Codex."
        ].join("\n");
    }
    return [
        ...header,
        "",
        "Worker requirements:",
        "- Stay inside the requested task scope.",
        "- List changed files, commands run, and blockers.",
        "- Do not self-approve final completion.",
        "- Explicitly return control to Codex for review.",
        "",
        "Task:",
        input.prompt
    ].join("\n");
}
export function previewPrompt(prompt, maxLength = 240) {
    const compact = prompt.replace(/\s+/g, " ").trim();
    if (compact.length <= maxLength) {
        return compact;
    }
    return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}
