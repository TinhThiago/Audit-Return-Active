import type { ReactNode } from "react";
import {
  Inbox,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Info,
  Copy,
} from "lucide-react";
import { useState } from "react";
import type { AuditValue } from "../domain/types";
export function Spinner() {
  return <LoaderCircle size={16} className="spin" aria-hidden="true" />;
}
export function Message({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "info" | "warning";
  children: ReactNode;
}) {
  const Icon =
    kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : Info;
  return (
    <div
      className={`message ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title,
  children,
  loading = false,
}: {
  title: string;
  children?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="empty" role="status">
      <div className="empty-icon">
        {loading ? <Spinner /> : <Inbox size={27} strokeWidth={1.3} />}
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function GuidText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="guid-wrap">
      <code className="guid" title={value}>
        {value || "Không được cung cấp"}
      </code>
      {value && (
        <button
          className="icon-button"
          aria-label={`Sao chép GUID ${value}`}
          title="Sao chép GUID"
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              })
              .catch(() => setCopied(false));
          }}
        >
          <Copy size={13} />
          {copied && <span className="copy-feedback">Đã sao chép</span>}
        </button>
      )}
    </span>
  );
}
export function Value({ value }: { value: AuditValue }) {
  if (!value.available)
    return <span className="muted">Không được cung cấp</span>;
  if (value.value === null) return <span className="muted">Null</span>;
  if (value.value === "") return <span className="muted">Chuỗi rỗng</span>;
  return (
    <span className="audit-value">
      {value.formatted ??
        (typeof value.value === "object"
          ? JSON.stringify(value.value)
          : String(value.value))}
    </span>
  );
}
const formatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Bangkok",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Không được cung cấp"
    : (() => {
        const parts = Object.fromEntries(
          formatter.formatToParts(d).map((p) => [p.type, p.value]),
        );
        return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
      })();
}
