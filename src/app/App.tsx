import { useEffect, useState, type ReactNode } from "react";
import {
  History,
  Trash2,
  Power,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useServices } from "./providers";
import { useLatestRequest } from "./useLatestRequest";
import type { TableMetadata } from "../domain/types";
import { environment } from "../config/environment";
import { TablePicker } from "../features/shared/TablePicker";
import { AuditPage } from "../features/audit/AuditPage";
import { ActivationPage } from "../features/activation/ActivationPage";
import { Message, Spinner } from "../ui/components";
type Page = "createUpdate" | "delete" | "active" | "deactivate";
const pages = [
  { id: "createUpdate" as const, label: "Create / Update", Icon: History },
  { id: "delete" as const, label: "Audit Delete", Icon: Trash2 },
  { id: "active" as const, label: "Return Active / Delete", Icon: Power },
  { id: "deactivate" as const, label: "Deactivate", Icon: Power },
];
export function App({
  browserUser,
  sessionControls,
}: {
  browserUser?: string;
  sessionControls?: ReactNode;
}) {
  const [page, setPage] = useState<Page>("createUpdate");
  const [collapsed, setCollapsed] = useState(false);
  const [tableName, setTableName] = useState("");
  const [user, setUser] = useState("");
  const [contextError, setContextError] = useState("");
  const { metadata } = useServices();
  const standaloneLocal =
    !browserUser && import.meta.env.DEV && window.self === window.top;
  const catalog = useLatestRequest<TableMetadata[]>("production-catalog");
  const table = catalog.data?.find((t) => t.logicalName === tableName);
  useEffect(() => {
    if (browserUser) {
      setUser(browserUser);
      void catalog.run((signal) => metadata.listTables(signal));
      return;
    }
    if (standaloneLocal) return;
    let live = true;
    const timeout = setTimeout(() => {
      if (live)
        setContextError(
          "Mở app qua Power Apps để sử dụng kết nối Dataverse. Bản xem trước localhost chỉ hiển thị giao diện.",
        );
    }, 15000);
    void import("@microsoft/power-apps/app")
      .then((m) => m.getContext())
      .then((context) => {
        if (!live) return;
        clearTimeout(timeout);
        if (context.app.environmentId !== environment.id) {
          setContextError(
            "App đang chạy ngoài môi trường Phuoc Hung Production.",
          );
          return;
        }
        setUser(
          context.user.fullName ||
            context.user.userPrincipalName ||
            "Người dùng Power Apps",
        );
        void catalog.run((signal) => metadata.listTables(signal));
      })
      .catch(() => {
        if (live)
          setContextError(
            "Chưa kết nối Power Apps. Mở app bằng liên kết Power Apps hoặc Local Play.",
          );
      });
    return () => {
      live = false;
      clearTimeout(timeout);
    };
  }, [metadata, catalog.run, standaloneLocal, browserUser]);
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Đi đến nội dung
      </a>
      <header className="global-header">
        <div className="brand">
          <span className="brand-monogram">PH</span>
          <span className="brand-divider" />
          <strong>{environment.appName}</strong>
        </div>
        <div className="header-right">
          {sessionControls}
          <span className="environment-chip">
            <span /> Production
          </span>
          {user && (
            <span className="user-name" title={user}>
              {user}
            </span>
          )}
          <span className="account-avatar" title={user || "Power Apps"}>
            {user ? (
              user.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()
            ) : (
              <ShieldCheck size={16} />
            )}
          </span>
        </div>
      </header>
      <div className={`workspace ${collapsed ? "collapsed" : ""}`}>
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span>ĐIỀU HƯỚNG</span>
            <button
              className="icon-button"
              aria-label={collapsed ? "Mở sidebar" : "Thu gọn sidebar"}
              title={collapsed ? "Mở sidebar" : "Thu gọn sidebar"}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
          </div>
          <nav aria-label="Điều hướng app">
            <span className="nav-section">AUDIT & RECORDS</span>
            {pages.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`nav-item ${id === page ? "current" : ""}`}
                aria-current={id === page ? "page" : undefined}
                title={label}
                onClick={() => setPage(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === page && <ChevronRight size={13} />}
              </button>
            ))}
          </nav>
          {!collapsed && (
            <div className="sidebar-table">
              <div className="sidebar-caption">
                <Database size={15} />
                <strong>Ngữ cảnh dữ liệu</strong>
              </div>
              <TablePicker
                tables={catalog.data || []}
                value={tableName}
                onChange={setTableName}
                disabled={catalog.loading || !catalog.data}
              />
              {catalog.loading && (
                <div className="sidebar-note">
                  <Spinner /> Đang đọc metadata…
                </div>
              )}
              {(catalog.error || contextError) && (
                <div className="sidebar-note error-note">
                  Chưa tải được table
                </div>
              )}
            </div>
          )}
          <footer className="sidebar-footer">
            <Database size={16} />
            <div>
              <strong>Dataverse</strong>
              <span>Phuoc Hung Production</span>
            </div>
          </footer>
        </aside>
        <main id="main-content" tabIndex={-1}>
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} /> Audit & Records{" "}
            <ChevronRight size={12} />{" "}
            <span>{pages.find((p) => p.id === page)?.label}</span>
          </div>
          {collapsed && (
            <div className="inline-table-picker">
              <TablePicker
                tables={catalog.data || []}
                value={tableName}
                onChange={setTableName}
                disabled={catalog.loading || !catalog.data}
              />
            </div>
          )}
          {standaloneLocal && (
            <Message kind="info">
              <strong>Chạy local với dữ liệu Dataverse</strong>
              <p>
                Localhost trực tiếp chưa có phiên Power Apps. Chạy{" "}
                <code>npm run local</code> trong thư mục app, rồi mở link{" "}
                <strong>Local Play</strong> được in trong terminal bằng trình
                duyệt đang đăng nhập Phuoc Hung Production.
              </p>
              <p>Server local phải tiếp tục chạy trong lúc kiểm thử.</p>
            </Message>
          )}
          {contextError && <Message kind="info">{contextError}</Message>}
          {catalog.error && (
            <Message>
              {catalog.error}
              <button
                className="text-button"
                onClick={() =>
                  void catalog.run((signal) => metadata.listTables(signal))
                }
              >
                <RefreshCw size={14} /> Thử tải lại table
              </button>
            </Message>
          )}
          {page === "active" || page === "deactivate" ? (
            <ActivationPage key={page + tableName} table={table} mode={page} />
          ) : (
            <AuditPage key={page + tableName} table={table} mode={page} />
          )}
          <footer className="workspace-footer">
            <span>PH Standard · Audit- Return Active</span>
            <span>
              <span
                className={`connection-dot ${catalog.data ? "connected" : ""}`}
              />
              {catalog.data ? "Đã tải metadata" : "Chưa tải metadata"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
