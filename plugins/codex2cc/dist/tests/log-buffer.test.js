import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LogBuffer } from "../src/log-buffer.js";
describe("LogBuffer", () => {
    it("keeps the newest bytes when output exceeds the limit", () => {
        const buffer = new LogBuffer(5);
        buffer.append(Buffer.from("hello"));
        buffer.append(Buffer.from(" world"));
        assert.equal(buffer.text(), "world");
        assert.equal(buffer.truncated, true);
    });
    it("does not return broken UTF-8 replacement characters after truncation", () => {
        const buffer = new LogBuffer(2);
        buffer.append("你");
        assert.equal(buffer.text(), "");
        assert.equal(buffer.truncated, true);
    });
});
