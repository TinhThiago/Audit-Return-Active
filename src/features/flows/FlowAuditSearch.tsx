import type { BrowserAuth } from "../../browser/auth";
import { useEffect, useRef, useState } from "react";
import { authSettings } from "../../browser/auth-config";
import type { AuditService } from "../../data/auditService";
import { environment } from "../../config/environment";
import { Message, Spinner } from "../../ui/components";
import { connectGraph, flowAuditAuthError } from "./graphAuth";
import {
  GraphAudit,
  GraphAuditWaitError,
  type GraphAuditQuery,
} from "./graphAudit";
import type { FlowAuditReport } from "./deletedFlows";

async function fillTitles(
  report: FlowAuditReport,
  audit: AuditService,
  signal: AbortSignal,
) {
  const pending = report.events
    .filter(
      (e) =>
        !e.title &&
        e.environmentId === environment.id &&
        e.flowId &&
        e.deletedAt !== null,
    )
    .slice(0, 30);
  let index = 0;
  const names = new Map<string, string>();
  await Promise.all(
    Array.from({ length: Math.min(4, pending.length) }, async () => {
      while (!signal.aborted && index < pending.length) {
        const event = pending[index++];
        try {
          const name = await audit.deletedCloudFlowTitle(
            event.flowId,
            event.deletedAt!,
            signal,
          );
          if (name) names.set(event.key, name);
        } catch {
          /* Source is optional: the user might lack Dataverse audit access. */
        }
      }
    }),
  );
  return {
    ...report,
    events: report.events.map((event) => ({
      ...event,
      title: event.title || names.get(event.key) || "",
    })),
  };
}

export function FlowAuditSearch({
  browserUser,
  browserAuth,
  audit,
  busy,
  onBusy,
  onReport,
  report,
}: {
  browserUser?: string;
  browserAuth?: BrowserAuth;
  audit: AuditService;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onReport: (report: FlowAuditReport) => void;
  report?: FlowAuditReport;
}) {
  const [days, setDays] = useState(21);
  const [pendingQuery, setPendingQuery] = useState<GraphAuditQuery>();
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const search = async (workloadOnly = false) => {
    if (active.current || busy) return;
    const resume =
      pendingQuery?.days === days && pendingQuery.workloadOnly === workloadOnly
        ? pendingQuery
        : undefined;
    setPendingQuery(resume);
    const controller = new AbortController();
    const signal = controller.signal;
    active.current = controller;
    onBusy(true);
    setError("");
    setCancelled(false);
    setProgress(
      resume
        ? "Đang kết nối lại truy vấn Microsoft…"
        : workloadOnly
          ? "Đang bắt đầu kiểm tra nguồn nhật ký…"
          : "Đang kết nối Microsoft Audit…",
    );
    try {
      const token = await connectGraph(
        signal,
        browserUser?.includes("@") ? browserUser : undefined,
        browserAuth,
      );
      signal.throwIfAborted();
      setProgress(
        workloadOnly
          ? "Đang kiểm tra nhật ký Power Automate. Có thể mất vài phút…"
          : "Microsoft đang tra cứu nhật ký. Có thể mất vài phút…",
      );
      const graphAudit = new GraphAudit(token);
      const report = await (resume
        ? graphAudit.resume(resume, signal)
        : graphAudit.search(days, signal, Date.now(), workloadOnly));
      signal.throwIfAborted();
      setPendingQuery(undefined);
      onReport(report);
      if (!report.events.length) return;
      setProgress("Đang đối chiếu tên flow từ audit Dataverse nếu có…");
      const complete = await fillTitles(
        report,
        audit,
        AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      );
      signal.throwIfAborted();
      onReport(complete);
    } catch (e) {
      if (!signal.aborted) {
        setPendingQuery(e instanceof GraphAuditWaitError ? e.query : undefined);
        setError(flowAuditAuthError(e));
      } else if (active.current === controller) {
        setCancelled(true);
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setProgress("");
        onBusy(false);
      }
    }
  };
  if (!browserUser) return null;
  const graph = report?.graph?.days === days ? report.graph : undefined;
  return (
    <section
      className="filter-card"
      aria-label="Tra cứu Microsoft Audit trực tiếp"
    >
      <h2>Tải lịch sử xóa trực tiếp</h2>
      <p>
        Tra cứu nhật ký Power Automate qua Microsoft Graph. Bạn có thể cần xác
        nhận tài khoản trong popup Microsoft.
      </p>
      <div className="flow-import">
        <label>
          Khoảng thời gian
          <select
            value={days}
            disabled={busy}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setError("");
              setCancelled(false);
            }}
          >
            {[1, 7, 21, 30, 90].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "24 giờ gần đây" : n + " ngày gần đây"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => void search()}
        >
          Tải lịch sử xóa
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void search(true)}
        >
          Kiểm tra nguồn nhật ký
        </button>
        {pendingQuery?.days === days && !progress && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void search(pendingQuery.workloadOnly)}
          >
            Tiếp tục chờ
          </button>
        )}
        {progress && (
          <button
            type="button"
            className="button"
            onClick={() => active.current?.abort()}
          >
            Dừng chờ
          </button>
        )}
      </div>
      {progress && (
        <p role="status">
          <Spinner /> {progress}
        </p>
      )}
      {error && <Message>{error}</Message>}
      {!progress && !error && cancelled && (
        <Message kind="info">Đã dừng chờ.</Message>
      )}
      {!progress && !error && !cancelled && graph && report && (
        <Message kind={report.events.length ? "success" : "info"}>
          <strong>
            {graph.workloadOnly
              ? "Đã kiểm tra nguồn nhật ký."
              : "Đã tải lịch sử xóa."}
          </strong>{" "}
          Microsoft Graph trả về {graph.received} bản ghi trong {graph.days}{" "}
          ngày; tìm thấy {report.events.length} sự kiện xóa.
          {report.events.length > 0
            ? " Xem chi tiết ở bảng bên dưới."
            : graph.workloadOnly
              ? graph.received === 0
                ? " Graph chưa trả nhật ký Power Automate trong khoảng ngày và phạm vi quyền của tài khoản này."
                : " Có nhật ký Power Automate, nhưng chưa nhận diện được sự kiện xóa thành công."
              : " Bấm Kiểm tra nguồn nhật ký để kiểm tra rộng hơn."}
        </Message>
      )}
      <details className="flow-help">
        <summary>Quyền cần để tra cứu</summary>
        <p>
          Trang dùng đăng ký Microsoft Entra của app theo mặc định. Đăng ký cần
          quyền Microsoft Graph Delegated <code>AuditLogsQuery.Read.All</code>,
          admin consent và SPA Redirect URI{" "}
          <code>{authSettings().redirectUri}</code>. Tài khoản đăng nhập cần
          quyền đọc Audit trong Purview.
        </p>
      </details>
    </section>
  );
}
