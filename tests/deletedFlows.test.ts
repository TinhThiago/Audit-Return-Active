import { expect, it } from "vitest";
import {
  flowTitle,
  readFlowNames,
  readPurviewCsv,
  restoreWindow,
} from "../src/features/flows/deletedFlows";

const flow = "12345678-1234-1234-1234-123456789abc";
const sample = {
  Operation: "DeleteFlow",
  CreationTime: "2026-11-01T12:00:00",
  UserUPN: "operator@example.com",
  FlowDetailsUrl: `https://make.powerautomate.com/environments/env/flows/${flow}/details`,
};
const csv = (...records: unknown[]) =>
  "\ufeffOperations,AuditData\r\n" +
  records
    .map((data) => ',"' + JSON.stringify(data).replaceAll('"', '""') + '"')
    .join("\r\n");

it("reads the Vietnamese title, actor, Flow ID and UTC time; ignores failed and unrelated activity", () => {
  const event = {
    ...sample,
    ID: "event",
    FlowDisplayName: 'Duyệt, "đề nghị"',
    ResultStatus: "Succeeded",
  };
  const { events } = readPurviewCsv(
    csv(
      event,
      event,
      { ...sample, ResultStatus: "Failed" },
      { ...sample, Operation: "EditFlow" },
    ),
  );
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    title: 'Duyệt, "đề nghị"',
    actor: "operator@example.com",
    environmentId: "env",
    flowId: flow,
    deletedAt: Date.parse("2026-11-01T12:00:00Z"),
  });
});
it("only joins a missing title when both environment and Flow ID match", () => {
  const {
    events: [event],
  } = readPurviewCsv(csv({ ...sample, FlowName: flow }));
  const names = readFlowNames(
    JSON.stringify([
      { EnvironmentName: "ENV", FlowName: flow, DisplayName: "Gửi báo cáo" },
    ]),
  );
  expect(event.title).toBe("");
  expect(flowTitle(event, names)).toBe("Gửi báo cáo");
  expect(flowTitle({ ...event, environmentId: "another" }, names)).toBe("");
});
it("reports missing AuditData and unreadable rows instead of silently discarding them", () => {
  expect(() => readPurviewCsv("Time,Operation\r\n")).toThrow(/AuditData/);
  expect(readPurviewCsv('AuditData\r\n"not JSON"').unreadable).toBe(1);
});
it("distinguishes recovery window, expired, and unavailable timestamps", () => {
  const day = 86_400_000;
  expect(restoreWindow(day, day * 22 - 1).status).toBe("within");
  expect(restoreWindow(day, day * 22).status).toBe("expired");
  expect(restoreWindow(null, day).status).toBe("unknown");
});
