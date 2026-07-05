export class LogBuffer {
    maxBytes;
    truncated = false;
    #chunks = [];
    #byteLength = 0;
    constructor(maxBytes) {
        if (!Number.isInteger(maxBytes) || maxBytes < 1) {
            throw new Error("maxBytes must be a positive integer");
        }
        this.maxBytes = maxBytes;
    }
    append(chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (buffer.length === 0) {
            return;
        }
        this.#chunks.push(buffer);
        this.#byteLength += buffer.length;
        this.#trim();
    }
    text() {
        return decodeUtf8Tail(Buffer.concat(this.#chunks, this.#byteLength));
    }
    #trim() {
        if (this.#byteLength <= this.maxBytes) {
            return;
        }
        this.truncated = true;
        let overflow = this.#byteLength - this.maxBytes;
        while (overflow > 0 && this.#chunks.length > 0) {
            const first = this.#chunks[0];
            if (first.length <= overflow) {
                this.#chunks.shift();
                this.#byteLength -= first.length;
                overflow -= first.length;
                continue;
            }
            this.#chunks[0] = first.subarray(overflow);
            this.#byteLength -= overflow;
            overflow = 0;
        }
    }
}
function decodeUtf8Tail(buffer) {
    let offset = 0;
    while (offset < buffer.length && isUtf8ContinuationByte(buffer[offset])) {
        offset += 1;
    }
    return buffer.subarray(offset).toString("utf8");
}
function isUtf8ContinuationByte(byte) {
    return byte >= 0x80 && byte <= 0xbf;
}
