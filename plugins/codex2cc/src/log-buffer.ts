export class LogBuffer {
  readonly maxBytes: number;
  truncated = false;
  #chunks: Buffer[] = [];
  #byteLength = 0;

  constructor(maxBytes: number) {
    if (!Number.isInteger(maxBytes) || maxBytes < 1) {
      throw new Error("maxBytes must be a positive integer");
    }
    this.maxBytes = maxBytes;
  }

  append(chunk: Buffer | string): void {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (buffer.length === 0) {
      return;
    }

    this.#chunks.push(buffer);
    this.#byteLength += buffer.length;
    this.#trim();
  }

  text(): string {
    return Buffer.concat(this.#chunks, this.#byteLength).toString("utf8");
  }

  #trim(): void {
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
