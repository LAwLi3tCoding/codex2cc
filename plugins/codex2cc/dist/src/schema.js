import path from "node:path";
import { z } from "zod";
export const MAX_TIMEOUT_MS = 7_200_000;
export const DEFAULT_TIMEOUT_MS = 900_000;
export const MAX_OUTPUT_BYTES = 1_048_576;
export const DEFAULT_OUTPUT_BYTES = 65_536;
export const delegateInputSchema = z.object({
    prompt: z.string().min(1),
    contextSummary: z.string().min(1).optional(),
    currentInstruction: z.string().min(1).optional(),
    cwd: z.string().min(1).optional(),
    mode: z.enum(["design", "code", "review", "custom"]).default("custom"),
    timeoutMs: z.number().int().min(100).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
    ccCommand: z.string().min(1).optional(),
    ccArgs: z.array(z.string()).default([]),
    resultFile: z.string().min(1).optional(),
    maxOutputBytes: z.number().int().min(1).max(MAX_OUTPUT_BYTES).default(DEFAULT_OUTPUT_BYTES),
    streamOutput: z.boolean().default(true)
});
export function normalizeDelegateInput(rawInput, defaultCwd = process.cwd()) {
    const parsed = delegateInputSchema.parse(rawInput);
    return {
        ...parsed,
        cwd: path.resolve(parsed.cwd ?? defaultCwd)
    };
}
