#!/usr/bin/env node
import { spawn } from "node:child_process";

const markerPath = process.argv[2];

spawn(process.execPath, [
  "-e",
  `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "alive"), 500); setTimeout(() => {}, 2000);`
], {
  stdio: "ignore"
});

setInterval(() => {}, 1000);
