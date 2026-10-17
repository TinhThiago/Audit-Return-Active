// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrowserRoot } from "../src/browser/BrowserRoot";
import type { BrowserAuth } from "../src/browser/auth";
vi.mock("../src/app/App", () => ({
  App: ({
    browserUser,
    sessionControls,
  }: {
    browserUser: string;
    sessionControls: React.ReactNode;
  }) => (
    <div data-testid="workspace">
      {browserUser}
      {sessionControls}
    </div>
  ),
}));
afterEach(cleanup);
it("makes the workspace inert while a logout popup is pending", async () => {
  const auth = fixture();
  auth.signOut.mockImplementation(() => new Promise(() => {}));
  render(<BrowserRoot auth={auth as unknown as BrowserAuth} />);
  fireEvent.click(
    await screen.findByRole("button", { name: /^Đăng nhập Microsoft$/ }),
  );
  await screen.findByTestId("workspace");
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(screen.getByTestId("workspace").closest("[inert]")).not.toBeNull();
});
it("clears stale workspace if logout clears the account before failing", async () => {
  const auth = fixture();
  render(<BrowserRoot auth={auth as unknown as BrowserAuth} />);
  fireEvent.click(
    await screen.findByRole("button", { name: /^Đăng nhập Microsoft$/ }),
  );
  await screen.findByTestId("workspace");
  auth.getAccount.mockReturnValue(null);
  auth.signOut.mockRejectedValue(new Error("popup failed"));
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await screen.findByRole("alert");
  expect(screen.queryByTestId("workspace")).toBeNull();
});
function fixture() {
  let account: unknown = null;
  return {
    settings: {
      tenantId: "tenant",
      clientId: "client",
      redirectUri: "https://example.com/Audit/auth-callback.html",
    },
    initialize: vi.fn().mockResolvedValue(undefined),
    getAccount: vi.fn(() => account),
    getToken: vi.fn().mockResolvedValue("token"),
    signIn: vi.fn(async () => {
      account = { homeAccountId: "one", username: "user@example.com" };
    }),
    signOut: vi.fn(async () => {
      account = null;
    }),
  };
}
it("gates workspace until explicit login and clears it on logout", async () => {
  const auth = fixture();
  render(<BrowserRoot auth={auth as unknown as BrowserAuth} />);
  const login = await screen.findByRole("button", {
    name: /^Đăng nhập Microsoft$/,
  });
  expect(screen.queryByTestId("workspace")).toBeNull();
  expect(auth.signIn).not.toHaveBeenCalled();
  expect(screen.getByText(auth.settings.redirectUri)).toBeTruthy();
  fireEvent.click(login);
  await screen.findByTestId("workspace");
  expect(screen.getByText("user@example.com")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await waitFor(() => expect(screen.queryByTestId("workspace")).toBeNull());
});
it("shows initialization failure without opening popup or mounting workspace", async () => {
  const auth = fixture();
  auth.initialize.mockRejectedValue(new Error("initialization failed"));
  render(<BrowserRoot auth={auth as unknown as BrowserAuth} />);
  await screen.findByRole("alert");
  expect(auth.signIn).not.toHaveBeenCalled();
  expect(screen.queryByTestId("workspace")).toBeNull();
});
