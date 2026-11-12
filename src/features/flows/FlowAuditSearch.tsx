import type { BrowserAuth } from "../../browser/auth";
import { useEffect, useRef, useState } from "react";
import { authSettings } from "../../browser/auth-config";
import type { AuditService } from "../../data/auditService";
import { environment } from "../../config/environment";
import { Message, Spinner } from "../../ui/components";
import { connectGraph, flowAuditAuthError } from "./graphAuth";
import { GraphAudit } from "./graphAudit";
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
}: {
  browserUser?: string;
  browserAuth?: BrowserAuth;
  audit: AuditService;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onReport: (report: FlowAuditReport) => void;
}) {
  const [days, setDays] = useState(21);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const search = async () => {
    if (active.current || busy) return;
    const controller = new AbortController();
    const signal = controller.signal;
    active.current = controller;
    onBusy(true);
    setError("");
    setProgress("Đang kết nối Microsoft Audit…");
    try {
      const token = await connectGraph(
        signal,
        browserUser?.includes("@") ? browserUser : undefined,
        browserAuth,
      );
      setProgress("Microsoft đang tra cứu nhật ký. Có thể mất vài phút…");
      const report = await new GraphAudit(token).search(days, signal);
      signal.throwIfAborted();
      onReport(report);
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
        setError(flowAuditAuthError(e));
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
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 21, 30, 90].map((n) => (
              <option key={n} value={n}>
                {n} ngày gần đây
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
