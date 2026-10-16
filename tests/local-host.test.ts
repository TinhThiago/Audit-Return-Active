import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("uses localhost for the Power Apps local player allowlist", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8").replace(
      /^\uFEFF/,
      "",
    ),
  );
  const config = JSON.parse(
    readFileSync(new URL("../power.config.json", import.meta.url), "utf8"),
  );
  expect(pkg.scripts.dev).toBe("vite --host localhost");
  expect(new URL(config.localAppUrl).hostname).toBe("localhost");
});
