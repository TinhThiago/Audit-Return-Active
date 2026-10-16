import { useEffect, useRef } from "react";
import { X, ArrowRight, History } from "lucide-react";
import type {
  AuditEvent,
  TableMetadata,
  AuditChange,
} from "../../domain/types";
import { useServices } from "../../app/providers";
import { useLatestRequest } from "../../app/useLatestRequest";
import {
  Empty,
  GuidText,
  Message,
  Value,
  formatDate,
} from "../../ui/components";
export function AuditDetails({
  event,
  table,
  onClose,
}: {
  event: AuditEvent;
  table: TableMetadata;
  onClose: () => void;
}) {
  const { audit, metadata } = useServices();
  const state = useLatestRequest<AuditChange[]>(
    table.logicalName + ":" + event.id,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    void state.run(async (signal) =>
      audit.details(
        event.id,
        await metadata.getTable(table.logicalName, signal),
        signal,
      ),
    );
  }, [audit, metadata, event.id, table.logicalName, state.run]);
  return (
    <aside
      className="details-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Chi tiết chỉnh sửa"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header className="panel-header">
        <div>
          <span className="eyebrow">AUDIT DETAILS</span>
          <h2>Chi tiết chỉnh sửa</h2>
        </div>
        <button
          ref={closeRef}
          className="icon-button"
          aria-label="Đóng chi tiết audit"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="panel-context">
        <span className="tag">
          <History size={12} />{" "}
          {event.operation === 1
            ? "Create"
            : event.operation === 2
              ? "Update"
              : "Delete"}
        </span>
        <strong>{table.displayName}</strong>
        <GuidText value={event.recordId} />
        <dl>
          <div>
            <dt>Thời gian (UTC+7)</dt>
            <dd>{formatDate(event.at)}</dd>
          </div>
          <div>
            <dt>Người thực hiện</dt>
            <dd>{event.user}</dd>
          </div>
        </dl>
      </div>
      <div className="panel-content">
        {state.loading && <Empty title="Đang tải chi tiết…" loading />}
        {state.error && (
          <Message>
            {state.error}
            <button
              className="text-button"
              onClick={() =>
                void state.run(async (signal) =>
                  audit.details(
                    event.id,
                    await metadata.getTable(table.logicalName, signal),
                    signal,
                  ),
                )
              }
            >
              Thử lại
            </button>
          </Message>
        )}
        {state.data?.length === 0 && (
          <Empty title="Không có giá trị trường">
            Sự kiện này không cung cấp thay đổi thuộc tính.
          </Empty>
        )}
        {state.data && state.data.length > 0 && (
          <>
            <div className="section-caption">
              {state.data.length} trường được ghi nhận
            </div>
            {state.data.map((change) => (
              <section className="change-card" key={change.field}>
                <strong>{change.label}</strong>
                <code>{change.field}</code>
                <div className="change-values">
                  <div>
                    <span className="field-hint">Trước thay đổi</span>
                    <Value value={change.old} />
                  </div>
                  <ArrowRight size={15} />
                  <div>
                    <span className="field-hint">Sau thay đổi</span>
                    <Value value={change.new} />
                  </div>
                </div>
              </section>
            ))}
          </>
        )}
      </div>
      <footer className="panel-footer">
        Chỉ hiển thị các trường có dữ liệu trong audit.
      </footer>
    </aside>
  );
}
