import { useEffect, useMemo, useRef, useState } from "react";
import { App } from "../app/App";
import { ServicesProvider } from "../app/providers";
import { Message, Spinner } from "../ui/components";
import { BrowserAuth, loginError } from "./auth";
import { BrowserTransport } from "./browserTransport";

export function BrowserRoot({ auth: supplied }: { auth?: BrowserAuth }) {
  const [auth] = useState(() => supplied || new BrowserAuth());
  const [ready, setReady] = useState(false);
  const [account, setAccount] =
    useState<ReturnType<BrowserAuth["getAccount"]>>(null);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState(0);
  const inFlight = useRef(0);
  const interaction = useRef(false);
  const [error, setError] = useState("");
  const [epoch, setEpoch] = useState(0);
  const transport = useMemo(
    () =>
      new BrowserTransport(
        auth,
        undefined,
        (delta) => {
          inFlight.current += delta;
          setRequests(inFlight.current);
        },
        () => !interaction.current,
      ),
    [auth],
  );
  useEffect(() => {
    let live = true;
    void auth
      .initialize()
      .then(() => {
        if (live) {
          setAccount(auth.getAccount());
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) {
          setError(loginError(e));
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, [auth]);
  const interact = async (action: "login" | "logout", retry = false) => {
    if (interaction.current || inFlight.current) return;
    interaction.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "logout") await auth.signOut();
      else await auth.signIn(retry);
      setAccount(auth.getAccount());
      setEpoch((e) => e + 1);
    } catch (e) {
      setAccount(auth.getAccount());
      setEpoch((e) => e + 1);
      setError(loginError(e));
    } finally {
      interaction.current = false;
      setBusy(false);
    }
  };
  const controls = (
    <>
      <button
        className="button"
        disabled={busy || requests > 0}
        onClick={() => void interact("login")}
      >
        Cấp quyền lại
      </button>
      <button
        className="button"
        disabled={busy || requests > 0}
        onClick={() => void interact("logout")}
      >
        Đăng xuất
      </button>
    </>
  );
  return (
    <>
      {error && (
        <div className="session-message">
          <Message>{error}</Message>
          <button
            className="button"
            disabled={busy || requests > 0}
            onClick={() => void interact("login", true)}
          >
            Hủy lượt đăng nhập cũ và thử lại
          </button>
        </div>
      )}
      {account ? (
        <div inert={busy || undefined}>
          <ServicesProvider
            key={`${account.homeAccountId}:${epoch}`}
            transport={transport}
          >
            <App
              browserUser={account.username || account.name || "Microsoft"}
              sessionControls={controls}
            />
          </ServicesProvider>
        </div>
      ) : (
        <div className="login-page">
          <section className="login-card">
            <span className="brand-monogram">PH</span>
            <span className="eyebrow">DATAVERSE AUDIT</span>
            <h1>Audit- Return Active</h1>
            <p>
              Xem lịch sử audit, kích hoạt, ngừng hoạt động hoặc xóa bản ghi
              trong Phuoc Hung Production.
            </p>
            <button
              className="button primary"
              disabled={!ready || busy}
              onClick={() => void interact("login")}
            >
              {!ready || busy ? <Spinner /> : null} Đăng nhập Microsoft
            </button>
            <p className="metadata">
              Sử dụng tài khoản Microsoft được cấp quyền trong Dataverse.
            </p>
            <details>
              <summary>Cấu hình đăng nhập Microsoft</summary>
              <p>
                Thêm Redirect URI dưới đây vào platform{" "}
                <strong>Single-page application (SPA)</strong> của app
                registration. Cần delegated permission Dataverse{" "}
                <code>user_impersonation</code> và consent theo chính sách
                tenant.
              </p>
              <dl>
                <dt>Redirect URI</dt>
                <dd>
                  <code>{auth.settings.redirectUri}</code>
                </dd>
                <dt>Client ID</dt>
                <dd>
                  <code>{auth.settings.clientId}</code>
                </dd>
                <dt>Tenant ID</dt>
                <dd>
                  <code>{auth.settings.tenantId}</code>
                </dd>
              </dl>
            </details>
          </section>
        </div>
      )}
    </>
  );
}
