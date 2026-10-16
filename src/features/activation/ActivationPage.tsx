import { useRef, useState } from "react";
import { Search, Power, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type { RecordSnapshot, TableMetadata } from "../../domain/types";
import { resolveStateTarget } from "../../domain/statePolicy";
import { useServices } from "../../app/providers";
import { useLatestRequest } from "../../app/useLatestRequest";
import { RecordLookup } from "../shared/RecordLookup";
import { Empty, GuidText, Message, Spinner } from "../../ui/components";
import { errorMessage } from "../../data/transport";
export function ActivationPage({
  table,
  mode = "active",
}: {
  table?: TableMetadata;
  mode?: "active" | "deactivate";
}) {
  const targetName = mode === "active" ? "Active" : "Inactive";
  const actionLabel = mode === "active" ? "Active" : "Deactivate";
  const { records, metadata } = useServices();
  const [guid, setGuid] = useState("");
  const [status, setStatus] = useState<number>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "warning" | "error";
    text: string;
  }>();
  const [pending, setPending] = useState(false);
  const query = useLatestRequest<{
    table: TableMetadata;
    record: RecordSnapshot;
  }>(table?.logicalName + ":" + guid);
  const decision = query.data
    ? resolveStateTarget(query.data.table, status, targetName)
    : undefined;
  const isActive =
    query.data?.record.state ===
    query.data?.table.states.find((s) => s.invariantName === targetName)?.value;
  const load = () => {
    if (!table || !guid.trim()) return;
    setNotice(undefined);
    setStatus(undefined);
    void query.run(async (signal) => {
      const detailed = await metadata.getTable(table.logicalName, signal);
      const record = await records.get(detailed, guid, signal);
      setPending(false);
      return { table: detailed, record };
    });
  };
  const activate = async () => {
    if (lock.current || !query.data) return;
    lock.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      const changeState =
        mode === "active"
          ? records.activate.bind(records)
          : records.deactivate.bind(records);
      const result = await changeState(
        query.data.table,
        query.data.record,
        status,
      );
      if (result.kind === "verificationPending") {
        setPending(true);
        setNotice({ kind: "warning", text: result.message });
      } else {
        setNotice({
          kind: "success",
          text:
            result.kind === "alreadyActive" || result.kind === "alreadyInactive"
              ? `Bản ghi đã ${targetName}, không cần thay đổi.`
              : `Đã chuyển bản ghi sang ${targetName} và xác minh trạng thái.`,
        });
        await query.run(async () => ({
          table: query.data!.table,
          record: result.record,
        }));
      }
    } catch (e) {
      setPending(true);
      setNotice({
        kind: "error",
        text: errorMessage(e) + " Tải lại bản ghi trước khi thử tiếp.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const deleteRecord = async () => {
    if (lock.current || !query.data || query.loading || pending) return;
    const current = query.data;
    if (
      !window.confirm(
        `Xóa bản ghi "${current.record.name}"?\nTable: ${current.table.displayName} (${current.table.logicalName})\nGUID: ${current.record.id}\n\nBản ghi sẽ bị xóa khỏi Dataverse. Dữ liệu liên quan có thể bị xóa theo cấu hình quan hệ.`,
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setDeleting(true);
    setNotice(undefined);
    try {
      await records.delete(current.table, current.record);
      setGuid("");
      setStatus(undefined);
      setPending(false);
      setNotice({
        kind: "success",
        text: `Đã xóa bản ghi "${current.record.name}" (${current.record.id}) khỏi Dataverse.`,
      });
    } catch (e) {
      setPending(true);
      setNotice({
        kind: "error",
        text:
          errorMessage(e) +
          " Tải lại để kiểm tra bản ghi trước khi thử tiếp; app không tự gửi lại lệnh xóa.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
      setDeleting(false);
    }
  };
  const changeGuid = (value: string) => {
    setGuid(value);
    setStatus(undefined);
    setNotice(undefined);
    setPending(false);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">RECORD MANAGEMENT</span>
          <h1>{mode === "active" ? "Return Active / Delete" : "Deactivate"}</h1>
          <p>
            {mode === "active"
              ? "Kích hoạt lại hoặc xóa bản ghi khỏi Dataverse."
              : "Chuyển bản ghi đang hoạt động sang Inactive."}
          </p>
        </div>
        <span className="page-mark">
          <Power size={22} />
        </span>
      </div>
      <section className="filter-card" aria-label="Chọn bản ghi kích hoạt">
        <div className="filter-context">
          <span className="field-hint">TABLE ĐANG CHỌN</span>
          <strong>{table?.displayName || "Chưa chọn table"}</strong>
          {table && <code>{table.logicalName}</code>}
        </div>
        <div className="guid-field">
          <label htmlFor="activation-guid">
            ID / GUID bản ghi <span className="required">*</span>
          </label>
          <div className="record-query-row">
            <div className="guid-input">
              <input
                id="activation-guid"
                value={guid}
                onChange={(e) => changeGuid(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={!table || busy}
                spellCheck={false}
              />
              {table && (
                <ManagedRecordLookup
                  table={table}
                  onSelect={changeGuid}
                  disabled={busy}
                />
              )}
            </div>
            <div className="record-actions">
              <button
                className="button primary"
                disabled={!table || !guid.trim() || query.loading || busy}
                onClick={load}
              >
                {query.loading ? <Spinner /> : <Search size={16} />} Xem bản ghi
              </button>
              <button
                className="button"
                disabled={!table || !guid.trim() || query.loading || busy}
                onClick={load}
              >
                <RefreshCw size={15} /> Tải lại
              </button>
            </div>
          </div>
          <span className="field-hint">
            {mode === "active"
              ? "Đọc bản ghi trước khi bấm Active hoặc Delete."
              : "Đọc bản ghi trước khi bấm Deactivate."}
          </span>
        </div>
      </section>
      {query.error && <Message>{query.error}</Message>}
      {notice && <Message kind={notice.kind}>{notice.text}</Message>}
      <section className="results-card">
        <header className="results-header">
          <h2>Bản ghi</h2>
          <span className="metadata">Trạng thái trực tiếp từ Dataverse</span>
        </header>
        {!query.attempted && (
          <Empty title="Chọn bản ghi cần xử lý">
            Chọn table và ID, sau đó bấm Xem bản ghi.
          </Empty>
        )}
        {query.loading && <Empty title="Đang đọc bản ghi…" loading />}
        {query.data && !query.loading && (
          <div className="record-detail">
            <div className="record-title">
              <div className="record-avatar">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2>{query.data.record.name}</h2>
                <GuidText value={query.data.record.id} />
              </div>
              <span className="tag">{query.data.record.stateLabel}</span>
            </div>
            <dl className="record-fields">
              <div>
                <dt>Table</dt>
                <dd>{query.data.table.displayName}</dd>
              </div>
              <div>
                <dt>Trạng thái hiện tại</dt>
                <dd>
                  {query.data.record.stateLabel}{" "}
                  <span className="metadata">({query.data.record.state})</span>
                </dd>
              </div>
              <div>
                <dt>Status reason</dt>
                <dd>
                  {query.data.record.statusLabel}{" "}
                  <span className="metadata">({query.data.record.status})</span>
                </dd>
              </div>
              <div>
                <dt>Phiên bản</dt>
                <dd>
                  <code>{query.data.record.etag || "Không được cung cấp"}</code>
                </dd>
              </div>
            </dl>
            {(decision?.kind === "chooseStatus" ||
              (decision?.kind === "ready" && decision.options.length > 1)) && (
              <div className="status-field">
                <label htmlFor="active-status">
                  Status reason khi {targetName}{" "}
                  <span className="required">*</span>
                </label>
                <select
                  id="active-status"
                  value={
                    status ?? (decision.kind === "ready" ? decision.status : "")
                  }
                  onChange={(e) =>
                    setStatus(
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  disabled={busy}
                >
                  <option value="">Chọn status reason</option>
                  {decision.options.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {decision?.kind === "unsupported" && (
              <Message kind="warning">{decision.reason}</Message>
            )}
            <div className="activation-footer">
              <div>
                <strong>
                  {isActive
                    ? `Bản ghi đang ${targetName}`
                    : `${actionLabel} bản ghi này`}
                </strong>
                <p>
                  {isActive
                    ? "Không cần cập nhật thêm."
                    : "Thay đổi trạng thái theo metadata của table."}
                </p>
              </div>
              <div className="record-actions">
                <button
                  className="button primary"
                  onClick={() => void activate()}
                  disabled={
                    busy ||
                    query.loading ||
                    isActive ||
                    pending ||
                    decision?.kind !== "ready" ||
                    !query.data.record.etag
                  }
                >
                  {busy ? <Spinner /> : <Power size={16} />}{" "}
                  {busy && !deleting ? "Đang cập nhật" : actionLabel}
                </button>
                {mode === "active" && (
                  <button
                    className="button danger"
                    onClick={() => void deleteRecord()}
                    disabled={
                      busy ||
                      query.loading ||
                      pending ||
                      !query.data.record.etag
                    }
                  >
                    {deleting ? <Spinner /> : <Trash2 size={16} />}{" "}
                    {deleting ? "Đang xóa" : "Delete"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
function ManagedRecordLookup({
  table,
  onSelect,
  disabled,
}: {
  table: TableMetadata;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const { metadata } = useServices();
  const state = useLatestRequest<TableMetadata>(table.logicalName);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        className="button"
        disabled={disabled || state.loading}
        onClick={() =>
          void state
            .run((signal) => metadata.getTable(table.logicalName, signal))
            .then(() => setOpen(true))
        }
      >
        {state.loading ? <Spinner /> : <Search size={15} />} Chọn bản ghi
      </button>
    );
  return state.data ? (
    <RecordLookup
      table={state.data}
      inactiveOnly={false}
      initialOpen
      onSelect={onSelect}
      disabled={disabled}
    />
  ) : (
    <span className="field-error">
      {state.error || "Không tải được metadata. Nhập GUID trực tiếp."}
    </span>
  );
}
