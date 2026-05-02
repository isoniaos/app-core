import { spawnSync } from "node:child_process";

const project =
  process.env.ISONIA_WORKSPACE_SOURCES === "true"
    ? "tsconfig.workspace-sources.json"
    : "tsconfig.json";

const result = spawnSync("tsc", ["-p", project, ...process.argv.slice(2)], {
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
