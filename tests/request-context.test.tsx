// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useLatestRequest } from "../src/app/useLatestRequest";
afterEach(cleanup);
it("ignores late responses from a previous table or GUID", async () => {
  let resolve!: (value: string) => void;
  const deferred = new Promise<string>((r) => {
    resolve = r;
  });
  const { result, rerender } = renderHook(
    ({ context }) => useLatestRequest<string>(context),
    { initialProps: { context: "table-one:id-one" } },
  );
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.run(() => deferred);
  });
  expect(result.current.loading).toBe(true);
  rerender({ context: "table-two:id-two" });
  expect(result.current.data).toBeUndefined();
  expect(result.current.loading).toBe(false);
  await act(async () => {
    resolve("wrong row");
    await pending;
  });
  expect(result.current.data).toBeUndefined();
  await act(async () => {
    await result.current.run(async () => "correct row");
  });
  expect(result.current.data).toBe("correct row");
});
it("a newer query wins even if the older response returns last", async () => {
  let resolve!: (value: string) => void;
  const { result } = renderHook(() =>
    useLatestRequest<string>("table-one:id-one"),
  );
  let old!: Promise<void>;
  act(() => {
    old = result.current.run(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
  });
  await act(async () => {
    await result.current.run(async () => "new result");
    resolve("old result");
    await old;
  });
  expect(result.current.data).toBe("new result");
});
it("keeps typed filters and displays failures", async () => {
  function Form() {
    const state = useLatestRequest<string>("form");
    return (
      <>
        <input aria-label="GUID" defaultValue="typed-guid" />
        <button
          onClick={() =>
            void state.run(async () => {
              throw new Error("No permission");
            })
          }
        >
          Tra cứu
        </button>
        {state.error && <p role="alert">{state.error}</p>}
      </>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByText("Tra cứu"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("No permission"),
  );
  expect((screen.getByLabelText("GUID") as HTMLInputElement).value).toBe(
    "typed-guid",
  );
});
