import { useMemo, useRef, useState } from "react";
import { Workflow } from "lucide-react";
import { Empty, formatDate, GuidText, Message } from "../../ui/components";
import { environment } from "../../config/environment";
import {
  flowTitle,
  readFlowNames,
  readPurviewCsv,
  restoreWindow,
} from "./deletedFlows";

const exportNames = `Add-PowerAppsAccount
$environment = '${environment.id}'
Get-AdminFlow -EnvironmentName $environment -IncludeDeleted $true |
  Select-Object FlowName, DisplayName, @{Name='EnvironmentName'; Expression={$environment}} |
  ConvertTo-Json | Set-Content -Encoding UTF8 flow-names.json`;

export function DeletedFlowsPage() {
  const [report, setReport] = useState<ReturnType<typeof readPurviewCsv>>();
  const [names, setNames] = useState<ReturnType<typeof readFlowNames>>(
    new Map(),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const revision = useRef(0);
  const csvInput = useRef<HTMLInputElement>(null);
  const namesInput = useRef<HTMLInputElement>(null);
  const load = async (file: File | undefined, kind: "audit" | "names") => {
    if (!file) return;
    const request = ++revision.current;
    setError("");
    if (kind === "audit") setReport(undefined);
    else setNames(new Map());
    setBusy(true);
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error(
          "File vượt 25 MB. Hãy xuất theo khoảng thời gian ngắn hơn.",
        );
      const contents = await file.text();
      if (request !== revision.current) return;
      if (kind === "audit") {
        setReport(readPurviewCsv(contents));
        setLimit(50);
      } else setNames(readFlowNames(contents));
    } catch (e) {
      if (request === revision.current)
        setError(
          e instanceof SyntaxError
            ? "File tên flow không phải JSON hợp lệ."
            : e instanceof Error
              ? e.message
              : "Không đọc được file.",
        );
    } finally {
      if (request === revision.current) setBusy(false);
    }
  };
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    return (
      report?.events.filter((event) =>
        [
          flowTitle(event, names),
          event.actor,
          event.flowId,
          event.environmentId,
        ].some((value) => value.toLocaleLowerCase("vi").includes(term)),
      ) ?? []
    );
  }, [report, names, search]);
  const clear = () => {
    revision.current++;
    setReport(undefined);
    setNames(new Map());
    setError("");
    setBusy(false);
    setSearch("");
    setLimit(50);
    if (csvInput.current) csvInput.current.value = "";
    if (namesInput.current) namesInput.current.value = "";
  };
  const now = Date.now();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">POWER AUTOMATE</span>
          <h1>Cloud Flow đã xóa</h1>
          <p>
            Xem tên flow, tài khoản thực hiện và thời điểm xóa từ nhật ký
            Microsoft Purview.
          </p>
        </div>
        <span className="page-mark">
          <Workflow size={22} />
        </span>
      </div>
      <section className="filter-card" aria-label="Nguồn nhật ký Cloud Flow">
        <p>
          Trong{" "}
          <a
            href="https://purview.microsoft.com/"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft Purview
          </a>
          , vào <strong>Audit → Search</strong>, chọn{" "}
          <strong>Deleted flow</strong> và xuất CSV. File chỉ được đọc trong tab
          này.
        </p>
        <div className="flow-import">
          <label>
            CSV từ Microsoft Purview
            <input
              ref={csvInput}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => void load(e.currentTarget.files?.[0], "audit")}
            />
          </label>
          <label>
            JSON tên flow (nếu log thiếu tiêu đề)
            <input
              ref={namesInput}
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => void load(e.currentTarget.files?.[0], "names")}
            />
          </label>
          <button type="button" className="button" onClick={clear}>
            Xóa dữ liệu đã nạp
          </button>
        </div>
        <details className="flow-help">
          <summary>Cách lấy tên hiển thị của flow</summary>
          <p>
            Nhờ quản trị viên môi trường chạy lệnh PowerShell dưới đây với
            module quản trị Power Apps. Lệnh chỉ đọc danh sách flow của Phước
            Hưng Production và xuất ba cột để đối chiếu theo môi trường và Flow
            ID.
          </p>
          <pre>{exportNames}</pre>
          <p>
            Chọn file <code>flow-names.json</code> ở trên. Nếu cả hai nguồn đều
            thiếu tên, trang sẽ báo rõ và vẫn hiển thị Flow ID.
          </p>
        </details>
      </section>
      {error && <Message>{error}</Message>}
      {!!report?.unreadable && (
        <Message kind="warning">
          Bỏ qua {report.unreadable} dòng có AuditData không đọc được.
        </Message>
      )}
      <section className="results-card">
        <header className="results-header">
          <h2>Lịch sử xóa cloud flow</h2>
          <span className="metadata">
            {report
              ? `${filtered.length} / ${report.events.length} sự kiện`
              : "Thời gian UTC+7"}
          </span>
        </header>
        {report && (
          <div className="flow-search">
            <label>
              Tìm tên flow, tài khoản hoặc ID
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(50);
                }}
              />
            </label>
          </div>
        )}
        {busy && <Empty loading title="Đang đọc file…" />}
        {!busy && !report && (
          <Empty title="Chưa nạp nhật ký">
            <span>Chọn file CSV Purview để xem sự kiện xóa.</span>
          </Empty>
        )}
        {!busy && report && !filtered.length && (
          <Empty title="Không có sự kiện xóa phù hợp" />
        )}
        {!busy && filtered.length > 0 && (
          <div className="flow-results">
            <table>
              <thead>
                <tr>
                  <th>Tên cloud flow / Flow ID</th>
                  <th>Tài khoản thực hiện</th>
                  <th>Thời điểm xóa</th>
                  <th>Hạn khôi phục</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((event) => {
                  const window = restoreWindow(event.deletedAt, now);
                  return (
                    <tr key={event.key}>
                      <td>
                        <strong>
                          {flowTitle(event, names) || "Chưa có tên hiển thị"}
                        </strong>
                        {event.flowId && <GuidText value={event.flowId} />}
                        <small>
                          Môi trường:{" "}
                          {event.environmentId === environment.id
                            ? environment.name
                            : event.environmentId || "Không xác định"}
                        </small>
                      </td>
                      <td>{event.actor || "Không có trong log"}</td>
                      <td>
                        {event.deletedAt === null
                          ? "Không xác định"
                          : formatDate(new Date(event.deletedAt).toISOString())}
                      </td>
                      <td>
                        {window.status === "within"
                          ? "Trong hạn 21 ngày"
                          : window.status === "expired"
                            ? "Quá hạn 21 ngày"
                            : "Chưa xác định"}
                        {window.deadline !== undefined && (
                          <small>
                            {formatDate(
                              new Date(window.deadline).toISOString(),
                            )}
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > limit && (
          <div className="flow-search">
            <button className="button" onClick={() => setLimit((n) => n + 50)}>
              Xem thêm
            </button>
          </div>
        )}
      </section>
      <Message kind="info">
        Hạn 21 ngày được tính từ nhật ký. Quản trị viên cần kiểm tra flow còn
        trong danh sách đã xóa trước khi{" "}
        <a
          href="https://learn.microsoft.com/power-automate/how-tos-restore-deleted-flow"
          target="_blank"
          rel="noreferrer"
        >
          khôi phục trong Power Automate
        </a>
        .
      </Message>
    </>
  );
}
