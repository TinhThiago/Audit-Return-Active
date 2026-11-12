// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { GraphAuditWaitError } from "../src/features/flows/graphAudit";
import { FlowAuditSearch } from "../src/features/flows/FlowAuditSearch";
import type { AuditService } from "../src/data/auditService";
import type { FlowAuditReport } from "../src/features/flows/deletedFlows";

const { search, connect, resume } = vi.hoisted(() => ({
  search: vi.fn(),
  connect: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("../src/features/flows/graphAudit", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/features/flows/graphAudit")
  >()),
  GraphAudit: class {
    search = search;
    resume = resume;
  },
}));
vi.mock("../src/features/flows/graphAuth", () => ({
  connectGraph: connect,
  flowAuditAuthError: (error: Error) => error.message,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function Harness() {
  const [busy, onBusy] = useState(false);
  const [report, onReport] = useState<FlowAuditReport>();
  return (
    <FlowAuditSearch
      browserUser="tester@example.com"
      audit={{} as AuditService}
      {...{ busy, onBusy, report, onReport }}
    />
  );
}

it("shows progress and a zero-record diagnostic next to the action, which stays available", async () => {
  connect.mockResolvedValue(async () => "token");
  let resolve!: (report: FlowAuditReport) => void;
  search.mockReturnValue(
    new Promise<FlowAuditReport>((done) => {
      resolve = done;
    }),
  );
  render(<Harness />);
  const panel = within(
    screen.getByRole("region", { name: "Tra cứu Microsoft Audit trực tiếp" }),
  );
  const button = panel.getByRole("button", { name: "Kiểm tra nguồn nhật ký" });
  fireEvent.click(button);
  expect(panel.getByRole("status").textContent).toContain(
    "Đang bắt đầu kiểm tra nguồn nhật ký",
  );
  await waitFor(() =>
    expect(search).toHaveBeenCalledWith(
      21,
      expect.any(AbortSignal),
      expect.any(Number),
      true,
    ),
  );
  resolve({
    events: [],
    unreadable: 0,
    graph: { received: 0, days: 21, workloadOnly: true },
  });
  expect(
    (await panel.findByText(/Microsoft Graph trả về 0 bản ghi/)).textContent,
  ).toContain("0 sự kiện xóa");
  expect((button as HTMLButtonElement).disabled).toBe(false);
});

it("shows diagnostic errors beside the button", async () => {
  connect.mockResolvedValue(async () => "token");
  search.mockRejectedValue(new Error("Graph từ chối truy cập"));
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Kiểm tra nguồn nhật ký" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Graph từ chối truy cập",
  );
});

it("offers to continue waiting on the same query after a timeout", async () => {
  connect.mockResolvedValue(async () => "token");
  const query = { id: "existing-query", days: 21, workloadOnly: true };
  search.mockRejectedValueOnce(new GraphAuditWaitError(query));
  resume.mockResolvedValueOnce({
    events: [],
    unreadable: 0,
    graph: { received: 0, days: 21, workloadOnly: true },
  });
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Kiểm tra nguồn nhật ký" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục chờ" }));
  await screen.findByText(/Microsoft Graph trả về 0 bản ghi/);
  expect(search).toHaveBeenCalledTimes(1);
  expect(resume).toHaveBeenCalledWith(query, expect.any(AbortSignal));
  expect(screen.queryByRole("button", { name: "Tiếp tục chờ" })).toBeNull();
});
