import { spawnSync } from "node:child_process";
const build = process.argv[2] === "build";
const env = {
  ...process.env,
  VITE_RUNTIME_MODE: "browser",
  VITE_BASE_PATH:
    process.env.VITE_BASE_PATH ?? (build ? "/Audit-Return-Active/" : "/"),
};
if (build) {
  const check = spawnSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "--noEmit"],
    { stdio: "inherit", env },
  );
  if (check.status !== 0) process.exit(check.status ?? 1);
}
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    ...(build ? ["build"] : ["--host", "localhost"]),
  ],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
