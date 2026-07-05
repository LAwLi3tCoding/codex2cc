#!/usr/bin/env node
import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["-e", "setTimeout(() => {}, 1500);"],
  { stdio: ["ignore", "inherit", "inherit"] }
);

child.unref();
process.stdout.write("parent exited while child holds stdio\n");
