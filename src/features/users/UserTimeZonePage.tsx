import { Clock3, RefreshCw, Search } from "lucide-react";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServices } from "../../app/providers";
import { useLatestRequest } from "../../app/useLatestRequest";
import type {
  TimeZoneOption,
  UserTimeZone,
  UserTimeZonePage as UserPage,
} from "../../data/userTimeZoneService";
import { errorMessage } from "../../data/transport";
import { Empty, Message, Spinner } from "../../ui/components";

const UserRow = memo(function UserRow({
  user,
  labels,
  options,
  onSave,
}: {
  user: UserTimeZone;
  labels: ReadonlyMap<number, string>;
  options: ReactNode;
  onSave: (id: string, code: number) => Promise<void>;
}) {
  const [current, setCurrent] = useState(user.timeZoneCode);
  const [draft, setDraft] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  }>();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const selected = draft ?? current;
  const canSave =
    user.hasSettings &&
    draft !== null &&
    draft !== current &&
    labels.has(draft);
  const save = async () => {
    if (!canSave || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFeedback(undefined);
    try {
      await onSave(user.id, draft);
      setCurrent(draft);
      setDraft(null);
      setFeedback({ kind: "success", text: "Đã cập nhật" });
    } catch (error) {
      setFeedback({ kind: "error", text: errorMessage(error) });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return (
    <tr>
      <td>
        <strong>{user.name}</strong>
        {user.account && (
          <span className="timezone-account">{user.account}</span>
        )}
      </td>
      <td>
        {!user.hasSettings
          ? "Chưa có thiết lập"
          : current === null
            ? "Chưa đặt múi giờ"
            : (labels.get(current) ?? `Múi giờ mã ${current}`)}
      </td>
      <td>
        <select
          aria-label={`Múi giờ cho ${user.name}`}
          value={selected ?? ""}
          disabled={!user.hasSettings || saving || !labels.size}
          onChange={(event) => {
            setDraft(
              event.target.value === "" ? null : Number(event.target.value),
            );
            setFeedback(undefined);
          }}
        >
          <option value="" disabled>
            Chọn múi giờ
          </option>
          {current !== null && !labels.has(current) && (
            <option value={current} disabled>
              Múi giờ mã {current}
            </option>
          )}
          {options}
        </select>
      </td>
      <td>
        <button
          className="button primary"
          type="button"
          onClick={() => void save()}
          disabled={!canSave || saving}
          aria-label={`Cập nhật múi giờ cho ${user.name}`}
        >
          {saving && <Spinner />} {saving ? "Đang cập nhật" : "Cập nhật"}
        </button>
        {feedback && (
          <span
            className={`timezone-feedback ${feedback.kind}`}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </span>
        )}
      </td>
    </tr>
  );
});

export function UserTimeZonePage({ ready }: { ready: boolean }) {
  const { userTimeZones } = useServices();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [savingCount, setSavingCount] = useState(0);
  const users = useLatestRequest<UserPage>(`${search}:${version}`);
  const definitions = useLatestRequest<TimeZoneOption[]>("user-time-zones");
  useEffect(() => {
    if (ready)
      void users.run((signal) =>
        userTimeZones.listUsers(search, undefined, signal),
      );
  }, [ready, users.run, userTimeZones, search]);
  useEffect(() => {
    if (ready)
      void definitions.run((signal) => userTimeZones.listTimeZones(signal));
  }, [ready, definitions.run, userTimeZones]);
  const labels = useMemo(
    () => new Map(definitions.data?.map(({ code, label }) => [code, label])),
    [definitions.data],
  );
  const options = useMemo(
    () =>
      definitions.data?.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      )),
    [definitions.data],
  );
  const onSave = useMemo(
    () => async (id: string, code: number) => {
      setSavingCount((count) => count + 1);
      try {
        await userTimeZones.update(id, code);
      } finally {
        setSavingCount((count) => count - 1);
      }
    },
    [userTimeZones],
  );
  const nextPage = () => {
    const page = users.data;
    if (!page?.next || users.loading) return;
    void users.run(async (signal) => {
      const next = await userTimeZones.listUsers(search, page.next, signal);
      const seen = new Set(page.users.map(({ id }) => id));
      return {
        users: [...page.users, ...next.users.filter(({ id }) => !seen.has(id))],
        next: next.next,
      };
    }, true);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN TRỊ DATAVERSE</span>
          <h1>Thiết lập múi giờ</h1>
          <p>
            Xem và cập nhật múi giờ của từng người dùng trong Phuoc Hung
            Production.
          </p>
        </div>
        <span className="page-mark">
          <Clock3 size={22} />
        </span>
      </div>
      <form
        className="filter-card timezone-filter"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || savingCount) return;
          const term = input.trim();
          if (term === search) setVersion((value) => value + 1);
          else setSearch(term);
        }}
      >
        <label htmlFor="timezone-user-search">
          Tìm người dùng
          <input
            id="timezone-user-search"
            type="search"
            placeholder="Nhập tên hoặc email"
            value={input}
            maxLength={120}
            onChange={(event) => setInput(event.target.value)}
            disabled={!ready}
          />
        </label>
        <button
          type="submit"
          className="button primary"
          disabled={!ready || !!savingCount}
        >
          <Search size={16} /> Tìm kiếm
        </button>
        <button
          type="button"
          className="button"
          disabled={!ready || users.loading || !!savingCount}
          onClick={() => {
            setVersion((value) => value + 1);
            if (definitions.error)
              void definitions.run((signal) =>
                userTimeZones.listTimeZones(signal),
              );
          }}
        >
          <RefreshCw size={15} /> Làm mới
        </button>
      </form>
      {users.error && <Message>{users.error}</Message>}
      {definitions.error && (
        <Message>Không tải được danh mục múi giờ. {definitions.error}</Message>
      )}
      <section
        className="results-card"
        aria-labelledby="timezone-results-heading"
      >
        <div className="results-header">
          <h2 id="timezone-results-heading">Người dùng Dataverse</h2>
          {users.data && (
            <span className="field-hint">
              {users.data.users.length} người dùng đã tải
            </span>
          )}
        </div>
        {users.data?.users.length ? (
          <>
            <div className="table-scroll">
              <table className="data-table timezone-table">
                <thead>
                  <tr>
                    <th scope="col">Người dùng</th>
                    <th scope="col">Múi giờ hiện tại</th>
                    <th scope="col">Chọn múi giờ</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.users.map((user) => (
                    <UserRow
                      key={user.id}
                      {...{ user, labels, options, onSave }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {users.data.next && (
              <div className="results-header">
                <button
                  type="button"
                  className="button"
                  onClick={nextPage}
                  disabled={users.loading}
                >
                  {users.loading ? (
                    <>
                      <Spinner /> Đang tải
                    </>
                  ) : (
                    "Tải thêm"
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <Empty
            loading={users.loading}
            title={
              !ready
                ? "Chờ kết nối Dataverse"
                : users.loading
                  ? "Đang tải người dùng…"
                  : users.error
                    ? "Chưa tải được người dùng"
                    : "Không tìm thấy người dùng"
            }
          />
        )}
        {definitions.loading && (
          <div className="results-header" role="status">
            <span className="field-hint">Đang tải danh mục múi giờ…</span>
          </div>
        )}
      </section>
    </>
  );
}
