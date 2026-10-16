import { displayRecordName } from "../../ui/displayRecordName";
import { useEffect, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import type { TableMetadata } from "../../domain/types";
import { useLatestRequest } from "../../app/useLatestRequest";
import { useServices } from "../../app/providers";
import { Spinner } from "../../ui/components";
export function RecordLookup({
  table,
  inactiveOnly,
  onSelect,
  disabled,
  initialOpen = false,
}: {
  table: TableMetadata;
  inactiveOnly: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [search, setSearch] = useState("");
  const { records } = useServices();
  const query = useLatestRequest<Awaited<ReturnType<typeof records.lookup>>>(
    table.logicalName + ":" + inactiveOnly + ":" + search,
  );
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void query.run((signal) =>
        records.lookup(table, search, inactiveOnly, undefined, signal),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [open, table, search, inactiveOnly, records, query.run]);
  return (
    <div className="lookup">
      <button
        className="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || !table.primaryNameAttribute}
        aria-expanded={open}
      >
        <Search size={15} /> Chọn bản ghi <ChevronDown size={13} />
      </button>
      {open && (
        <section className="lookup-panel" aria-label="Tìm bản ghi">
          <div className="lookup-heading">
            <strong>
              {inactiveOnly ? "Bản ghi Inactive" : "Bản ghi hiện có"}
            </strong>
            <button
              className="icon-button"
              aria-label="Đóng tìm bản ghi"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <label htmlFor="record-search">Tìm theo tên</label>
          <input
            autoFocus
            id="record-search"
            placeholder="Nhập tên bản ghi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {query.loading && (
            <div className="lookup-note">
              <Spinner /> Đang tìm…
            </div>
          )}
          {query.error && (
            <p role="alert" className="field-error">
              {query.error}
            </p>
          )}
          <ul>
            {query.data?.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(row.id);
                    setOpen(false);
                  }}
                >
                  <strong
                    title={
                      displayRecordName(row.name) !== row.name
                        ? `Tên gốc: ${row.name}`
                        : row.name
                    }
                  >
                    {displayRecordName(row.name)}
                  </strong>
                  <code>{row.id}</code>
                </button>
              </li>
            ))}
          </ul>
          {query.data && !query.data.rows.length && (
            <p className="lookup-note">
              Không tìm thấy bản ghi. Bạn vẫn có thể nhập GUID trực tiếp.
            </p>
          )}
          {query.data?.continuation && (
            <button
              className="button"
              disabled={query.loading}
              onClick={() =>
                void query.run(async (signal) => {
                  const page = await records.lookup(
                    table,
                    search,
                    inactiveOnly,
                    query.data?.continuation,
                    signal,
                  );
                  return {
                    ...page,
                    rows: [...(query.data?.rows || []), ...page.rows],
                  };
                }, true)
              }
            >
              Tải thêm
            </button>
          )}
        </section>
      )}
    </div>
  );
}
