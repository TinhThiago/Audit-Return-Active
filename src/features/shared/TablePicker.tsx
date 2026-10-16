import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { TableMetadata } from "../../domain/types";
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi");
export function TablePicker({
  tables,
  value,
  onChange,
  disabled,
}: {
  tables: TableMetadata[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const list = useId(),
    label = useId();
  const selected = tables.find((t) => t.logicalName === value);
  const matches = useMemo(
    () =>
      tables.filter((t) =>
        normalized(t.displayName + " " + t.logicalName).includes(
          normalized(search),
        ),
      ),
    [tables, search],
  );
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (active >= 0)
      document
        .getElementById(list + "-" + active)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, list]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const choose = (table: TableMetadata) => {
    onChange(table.logicalName);
    setOpen(false);
    setSearch("");
    setActive(-1);
    input.current?.focus();
  };
  return (
    <div className="table-picker" ref={root}>
      <label id={label}>
        Table <span className="required">*</span>
      </label>
      <div className="table-combobox">
        <Search size={15} />
        <input
          ref={input}
          role="combobox"
          aria-labelledby={label}
          aria-expanded={open}
          aria-controls={list}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 && active < matches.length
              ? list + "-" + active
              : undefined
          }
          autoComplete="off"
          disabled={disabled}
          placeholder="Chọn hoặc tìm table…"
          value={open ? search : selected?.displayName || ""}
          onFocus={() => {
            setOpen(true);
            setSearch("");
            setActive(-1);
          }}
          onClick={() => {
            setOpen(true);
          }}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setSearch("");
              return;
            }
            if (e.key === "Tab") {
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              if (!matches.length) {
                setActive(-1);
                return;
              }
              setActive((i) =>
                e.key === "ArrowDown"
                  ? Math.min(i + 1, matches.length - 1)
                  : Math.max(i - 1, 0),
              );
            }
            if (e.key === "Enter" && open && matches.length) {
              e.preventDefault();
              choose(matches[active >= 0 ? active : 0]);
            }
          }}
        />
        <button
          className="icon-button"
          type="button"
          disabled={disabled}
          aria-label="Mở danh sách table"
          tabIndex={-1}
          onClick={() => {
            if (open) setOpen(false);
            else {
              input.current?.focus();
              setSearch("");
              setOpen(true);
            }
          }}
        >
          <ChevronDown size={15} />
        </button>
      </div>
      {open && !disabled && (
        <div
          className="table-options"
          role="listbox"
          id={list}
          aria-label="Table custom unmanaged"
        >
          {matches.map((t, i) => (
            <div
              role="option"
              id={list + "-" + i}
              key={t.logicalName}
              aria-selected={value === t.logicalName}
              className={"table-option " + (i === active ? "highlighted" : "")}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(t)}
            >
              <strong>{t.displayName}</strong>
              <code>{t.logicalName}</code>
            </div>
          ))}
          {!matches.length && (
            <div className="lookup-note" role="status">
              Không tìm thấy table.
            </div>
          )}
        </div>
      )}
      <span className="field-hint">
        {tables.length} table · custom unmanaged
      </span>
    </div>
  );
}
