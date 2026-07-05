#!/usr/bin/env node
process.on("SIGTERM", () => {
  process.stderr.write("ignored SIGTERM\n");
});

setInterval(() => {
  process.stdout.write("still running\n");
}, 200);
