import { useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  CalendarDays,
  ChevronDown,
  History,
  Trash2,
} from "lucide-react";
import type {
  AuditPage as AuditPageData,
  TableMetadata,
  AuditEvent,
} from "../../domain/types";
import { useLatestRequest } from "../../app/useLatestRequest";
import { useServices } from "../../app/providers";
import { RecordLookup } from "../shared/RecordLookup";
import { AuditDetails } from "./AuditDetails";
import {
  Empty,
  GuidText,
  Message,
  Spinner,
  formatDate,
} from "../../ui/components";
export function AuditPage({
  table,
  mode,
}: {
  table?: TableMetadata;
  mode: "createUpdate" | "delete";
}) {
  const [guid, setGuid] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showDates, setShowDates] = useState(false);
  const [selected, setSelected] = useState<AuditEvent>();
  const detailsTrigger = useRef<HTMLButtonElement | null>(null);
  const { audit } = useServices();
  const key = JSON.stringify([table?.logicalName, mode, guid, from, to]);
  const query = useLatestRequest<AuditPageData>(key);
  const valid = !!table && (mode === "delete" || !!guid.trim());
  const run = (more = false) => {
    if (!table) return;
    setSelected(undefined);
    void query.run(async (signal) => {
      const page = await audit.list(
        {
          table,
          mode,
          recordId: guid,
          from: from || undefined,
          to: to || undefined,
        },
        more ? query.data?.continuation : undefined,
        signal,
      );
      return more
        ? { ...page, events: [...(query.data?.events || []), ...page.events] }
        : page;
    }, more);
  };
  const change = (update: () => void) => {
    update();
    setSelected(undefined);
  };
  const close = () => {
    setSelected(undefined);
    detailsTrigger.current?.focus();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DATAVERSE AUDIT</span>
          <h1>
            {mode === "delete" ? "Audit Delete" : "Audit Create / Update"}
          </h1>
          <p>
            {mode === "delete"
              ? "Tra cứu các sự kiện xóa bản ghi theo table."
              : "Theo dõi lịch sử tạo và thay đổi của từng bản ghi."}
          </p>
        </div>
        <span className="page-mark">
          {mode === "delete" ? <Trash2 size={22} /> : <History size={22} />}
        </span>
      </div>
      <section className="filter-card" aria-label="Bộ lọc audit">
        <div className="filter-context">
          <span className="field-hint">TABLE ĐANG CHỌN</span>
          <strong>{table?.displayName || "Chưa chọn table"}</strong>
          {table && <code>{table.logicalName}</code>}
        </div>
        {mode === "createUpdate" && (
          <div className="guid-field">
            <label htmlFor="record-guid">
              GUID bản ghi <span className="required">*</span>
            </label>
            <div className="record-query-row">
              <div className="guid-input">
                <input
                  id="record-guid"
                  value={guid}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  onChange={(e) => change(() => setGuid(e.target.value))}
                  disabled={!table}
                  spellCheck={false}
                />
                {table && (
                  <RecordLookup
                    table={table}
                    inactiveOnly={false}
                    onSelect={(id) => change(() => setGuid(id))}
                  />
                )}
              </div>
              <div className="record-actions">
                <button
                  className="button primary"
                  disabled={!valid || query.loading}
                  onClick={() => run()}
                >
                  {query.loading ? <Spinner /> : <Search size={16} />}{" "}
                  {query.loading ? "Đang tra cứu" : "Xem audit"}
                </button>
                <button
                  className="button"
                  disabled={!valid || query.loading}
                  onClick={() => run()}
                >
                  <RefreshCw size={15} /> Làm mới
                </button>
              </div>
            </div>
            <span className="field-hint">
              Nhập GUID để tra cứu cả bản ghi đã bị xóa.
            </span>
          </div>
        )}
        {mode === "delete" && (
          <div className="record-actions">
            <button
              className="button primary"
              disabled={!valid || query.loading}
              onClick={() => run()}
            >
              {query.loading ? <Spinner /> : <Search size={16} />}{" "}
              {query.loading ? "Đang tra cứu" : "Xem audit"}
            </button>
            <button
              className="button"
              disabled={!valid || query.loading}
              onClick={() => run()}
            >
              <RefreshCw size={15} /> Làm mới
            </button>
          </div>
        )}
        <button
          className="text-button date-toggle"
          onClick={() => setShowDates((v) => !v)}
          aria-expanded={showDates}
        >
          <CalendarDays size={15} /> Khoảng thời gian{" "}
          {from || to ? "· Đã lọc" : "· Tùy chọn"} <ChevronDown size={13} />
        </button>
        {showDates && (
          <div className="date-fields">
            <div>
              <label htmlFor="from-date">Từ ngày</label>
              <input
                id="from-date"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => change(() => setFrom(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="to-date">Đến ngày</label>
              <input
                id="to-date"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => change(() => setTo(e.target.value))}
              />
            </div>
            <button
              className="text-button"
              onClick={() =>
                change(() => {
                  setFrom("");
                  setTo("");
                })
              }
            >
              Xóa lọc ngày
            </button>
          </div>
        )}
      </section>
      {table && !table.auditEnabled && (
        <Message kind="warning">
          Table hiện chưa bật audit. Lịch sử chỉ xuất hiện nếu trước đây đã được
          ghi nhận và vẫn còn được lưu.
        </Message>
      )}
      {query.error && <Message>{query.error}</Message>}
      <section className="results-card" aria-label="Kết quả audit">
        <header className="results-header">
          <h2>{mode === "delete" ? "Bản ghi đã xóa" : "Lịch sử audit"}</h2>
          <span className="metadata">
            {query.data
              ? `${query.data.events.length} sự kiện đã tải${query.data.continuation ? " · Còn dữ liệu" : ""}`
              : "Theo yêu cầu"}
          </span>
        </header>
        {!query.attempted && (
          <Empty title={table ? "Sẵn sàng tra cứu" : "Chọn table để bắt đầu"}>
            {mode === "delete"
              ? "Chọn table rồi bấm Xem audit để xem các sự kiện xóa."
              : "Chọn table và GUID, sau đó bấm Xem audit."}
          </Empty>
        )}
        {query.loading && !query.data && (
          <Empty title="Đang tải lịch sử audit…" loading />
        )}
        {query.data && !query.data.events.length && (
          <Empty title="Không có sự kiện audit">
            Không tìm thấy audit phù hợp với bộ lọc đã chọn.
          </Empty>
        )}
        {query.data && query.data.events.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời gian (UTC+7)</th>
                  <th>Thao tác</th>
                  <th>Người thực hiện</th>
                  {mode === "delete" && <th>GUID bản ghi đã xóa</th>}
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {query.data.events.map((event) => (
                  <tr
                    key={event.id}
                    className={selected?.id === event.id ? "selected" : ""}
                  >
                    <td>{formatDate(event.at)}</td>
                    <td>
                      <span className="tag">
                        {event.operation === 1
                          ? "Create"
                          : event.operation === 2
                            ? "Update"
                            : "Delete"}
                      </span>
                    </td>
                    <td>{event.user}</td>
                    {mode === "delete" && (
                      <td>
                        <GuidText value={event.recordId} />
                      </td>
                    )}
                    <td>
                      <button
                        className="record-link"
                        onClick={(e) => {
                          detailsTrigger.current = e.currentTarget;
                          setSelected(event);
                        }}
                      >
                        Xem thay đổi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data?.continuation && (
          <footer className="results-footer">
            <span className="metadata">Phân trang theo Dataverse</span>
            <button
              className="button"
              disabled={query.loading}
              onClick={() => run(true)}
            >
              {query.loading ? <Spinner /> : <ChevronDown size={14} />} Tải thêm
            </button>
          </footer>
        )}
      </section>
      {selected && table && (
        <AuditDetails
          key={key + selected.id}
          table={table}
          event={selected}
          onClose={close}
        />
      )}
    </>
  );
}
