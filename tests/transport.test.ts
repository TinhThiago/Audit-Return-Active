import { expect, it } from "vitest";
import { PowerAppsTransport, safePath } from "../src/data/powerAppsTransport";
it("restricts paths to the approved Dataverse origin and API", () => {
  expect(
    safePath(
      "https://phuochung1.crm5.dynamics.com/api/data/v9.2/audits?$skiptoken=x",
    ),
  ).toBe("audits?$skiptoken=x");
  for (const path of [
    "https://evil.example/audits",
    "//evil.example/api/data/v9.2/audits",
    "../admin",
    "audits/../../users",
  ])
    expect(() => safePath(path)).toThrow();
});
it("decodes connector response and sends If-Match on state PATCH", async () => {
  let request: unknown;
  const t = new PowerAppsTransport(async (input) => {
    request = input;
    return {
      success: true,
      data: {
        statusCode: 200,
        headers: {},
        body: { value: [{ auditid: "one" }] },
      },
    };
  });
  expect(await t.request({ method: "GET", path: "audits" })).toEqual({
    value: [{ auditid: "one" }],
  });
  await t.request({
    method: "PATCH",
    path: "ph_items(00000000-0000-0000-0000-000000000001)",
    body: { statecode: 0, statuscode: 2 },
    etag: 'W/"42"',
  });
  expect(request).toMatchObject({
    method: "PATCH",
    headers: { "If-Match": 'W/"42"' },
    body: '{"statecode":0,"statuscode":2}',
  });
  await expect(
    t.request({ method: "PATCH", path: "audits", body: { name: "forbidden" } }),
  ).rejects.toThrow();
});
it("preserves permission and concurrency HTTP errors", async () => {
  const t = new PowerAppsTransport(async () => ({
    success: true,
    data: { statusCode: 412, body: { error: { message: "changed" } } },
  }));
  await expect(
    t.request({ method: "GET", path: "audits" }),
  ).rejects.toMatchObject({ status: 412 });
});
