#!/usr/bin/env node
const prompt = process.argv.at(-1) ?? "";

process.stdout.write(`stdout:${prompt.slice(0, 20)}\n`);
process.stderr.write("stderr:diagnostic\n");
