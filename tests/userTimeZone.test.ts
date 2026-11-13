import { expect, it, vi } from "vitest";
import { environment } from "../src/config/environment";
import { ScopedTransport } from "../src/data/requestTransport";
import { UserTimeZoneService } from "../src/data/userTimeZoneService";
import { FakeTransport } from "./support";

const id = "6b429899-30c1-f111-aaaf-6045bd5a2f39";
const next = `${environment.url}${environment.api}systemusers?$skiptoken=next`;

it("reads users and their own settings together and follows the Dataverse page link", async () => {
  const transport = new FakeTransport(() => ({
    value: [
      {
        systemuserid: id,
        fullname: "Nguyễn An",
        domainname: "an@example.com",
        user_settings: [{ timezonecode: 205 }],
      },
    ],
    "@odata.nextLink": next,
  }));
  const service = new UserTimeZoneService(transport);
  const page = await service.listUsers("O'Neil");
  expect(page.users).toEqual([
    {
      id,
      name: "Nguyễn An",
      account: "an@example.com",
      timeZoneCode: 205,
      hasSettings: true,
    },
  ]);
  expect(
    new URLSearchParams(transport.requests[0].path.split("?")[1]).get(
      "$filter",
    ),
  ).toContain("'O''Neil'");
  await service.listUsers("O'Neil", page.next);
  expect(transport.requests.map((r) => r.path)[1]).toBe(
    "systemusers?$skiptoken=next",
  );
  await expect(
    service.listUsers("", `${environment.url}${environment.api}audits?$top=2`),
  ).rejects.toThrow();
});

it("updates only the selected user's time zone and cannot create a missing settings record", async () => {
  const call = vi.fn(async () => ({
    success: true,
    data: { statusCode: 204 },
  }));
  const service = new UserTimeZoneService(new ScopedTransport(call));
  await service.update(id, 205);
  expect(call).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "PATCH",
      url: `${environment.url}${environment.api}usersettingscollection(${id})`,
      headers: expect.objectContaining({ "If-Match": "*" }),
      body: '{"timezonecode":205}',
    }),
  );
});

it("rejects a time-zone update against another table, an invalid code, or unrelated fields", async () => {
  const call = vi.fn(async () => ({ success: true, data: {} }));
  const transport = new ScopedTransport(call);
  for (const [path, body] of [
    [`systemusers(${id})`, { timezonecode: 205 }],
    [`usersettingscollection(${id})`, { timezonecode: 1.5 }],
    [`usersettingscollection(${id})`, { timezonecode: 205, localeid: 1033 }],
    [`usersettingscollection(${id})`, { statecode: 0, statuscode: 1 }],
  ] as const) {
    await expect(
      transport.request({ method: "PATCH", path, body, etag: "*" }),
    ).rejects.toThrow();
  }
  expect(call).not.toHaveBeenCalled();
});
