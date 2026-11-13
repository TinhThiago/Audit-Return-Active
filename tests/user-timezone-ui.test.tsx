// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { App } from "../src/app/App";
import { ServicesProvider } from "../src/app/providers";
import { FakeTransport } from "./support";

afterEach(cleanup);

it("opens the time zone page and saves only the chosen user's row on click", async () => {
  const an = "6b429899-30c1-f111-aaaf-6045bd5a2f39";
  const binh = "6b429899-30c1-f111-aaaf-6045bd5a2f40";
  const transport = new FakeTransport(({ path, method }) => {
    if (method === "PATCH") return;
    if (path.startsWith("systemusers?"))
      return {
        value: [
          {
            systemuserid: an,
            fullname: "Nguyễn An",
            user_settings: [{ timezonecode: 85 }],
          },
          {
            systemuserid: binh,
            fullname: "Trần Bình",
            user_settings: [{ timezonecode: 85 }],
          },
        ],
      };
    if (path.startsWith("timezonedefinitions?"))
      return {
        value: [
          { timezonecode: 85, userinterfacename: "UTC" },
          {
            timezonecode: 205,
            userinterfacename: "(UTC+07:00) Bangkok, Hanoi, Jakarta",
          },
        ],
      };
    return { value: [] };
  });
  render(
    <ServicesProvider transport={transport}>
      <App browserUser="admin@example.com" />
    </ServicesProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Thiết lập múi giờ" }));
  const anSelect = await screen.findByRole("combobox", {
    name: "Múi giờ cho Nguyễn An",
  });
  const anRow = within(anSelect.closest("tr")!);
  const binhSelect = screen.getByRole("combobox", {
    name: "Múi giờ cho Trần Bình",
  });
  const save = anRow.getByRole("button", {
    name: "Cập nhật múi giờ cho Nguyễn An",
  });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(anSelect, { target: { value: "205" } });
  expect(anRow.getByRole("cell", { name: "UTC" })).toBeTruthy();
  expect(transport.requests.some((r) => r.method === "PATCH")).toBe(false);
  fireEvent.click(save);
  await anRow.findByRole("status", { name: "" });
  expect(anRow.getAllByRole("cell")[1].textContent).toBe(
    "(UTC+07:00) Bangkok, Hanoi, Jakarta",
  );
  expect((binhSelect as HTMLSelectElement).value).toBe("85");
  expect(transport.requests.filter((r) => r.method === "PATCH")).toEqual([
    {
      method: "PATCH",
      path: `usersettingscollection(${an})`,
      body: { timezonecode: 205 },
      etag: "*",
    },
  ]);
});
