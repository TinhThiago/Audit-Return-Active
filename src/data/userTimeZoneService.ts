import { normalizeGuid } from "../domain/guid";
import type { ODataPage } from "../domain/types";
import { safePath } from "./requestTransport";
import { DataverseError, type DataverseTransport } from "./transport";

export type UserTimeZone = {
  id: string;
  name: string;
  account: string;
  timeZoneCode: number | null;
  hasSettings: boolean;
};

export type TimeZoneOption = { code: number; label: string };
export type UserTimeZonePage = { users: UserTimeZone[]; next?: string };

type SettingsRow = { timezonecode?: number | null };
type UserRow = {
  systemuserid: string;
  fullname?: string;
  domainname?: string;
  user_settings?: SettingsRow[];
};
type DefinitionRow = {
  timezonecode?: number;
  userinterfacename?: string;
  standardname?: string;
};

function collectionPath(path: string, collection: string) {
  const scoped = safePath(path);
  if (!scoped.startsWith(`${collection}?`))
    throw new Error("Trang tiếp theo không thuộc danh sách đang xem.");
  return scoped;
}

export class UserTimeZoneService {
  private options?: TimeZoneOption[];

  constructor(private transport: DataverseTransport) {}

  async listUsers(
    search: string,
    next?: string,
    signal?: AbortSignal,
  ): Promise<UserTimeZonePage> {
    const term = search.trim().slice(0, 120).replaceAll("'", "''");
    const filters = [
      "applicationid eq null",
      "azureactivedirectoryobjectid ne null",
    ];
    if (term)
      filters.push(
        `(contains(fullname,'${term}') or contains(domainname,'${term}'))`,
      );
    const path = next
      ? collectionPath(next, "systemusers")
      : `systemusers?${new URLSearchParams({
          $select: "systemuserid,fullname,domainname",
          $filter: filters.join(" and "),
          $expand: "user_settings($select=timezonecode)",
          $orderby: "fullname asc,systemuserid asc",
        })}`;
    const page = await this.transport.request<ODataPage<UserRow>>({
      method: "GET",
      path,
      signal,
    });
    if (!Array.isArray(page?.value))
      throw new Error("Không đọc được danh sách người dùng Dataverse.");
    return {
      users: page.value.map((row) => {
        const settings = row.user_settings?.[0];
        return {
          id: normalizeGuid(row.systemuserid),
          name: row.fullname?.trim() || row.domainname || "Chưa có tên",
          account: row.domainname || "",
          timeZoneCode:
            typeof settings?.timezonecode === "number"
              ? settings.timezonecode
              : null,
          hasSettings: !!settings,
        };
      }),
      next: page["@odata.nextLink"],
    };
  }

  async listTimeZones(signal?: AbortSignal): Promise<TimeZoneOption[]> {
    if (this.options) return this.options;
    let path: string | undefined = `timezonedefinitions?${new URLSearchParams({
      $select: "timezonecode,userinterfacename,standardname",
      $filter: "retiredorder eq 0",
      $orderby: "bias desc,userinterfacename asc,timezonedefinitionid asc",
    })}`;
    const options = new Map<number, TimeZoneOption>();
    const visited = new Set<string>();
    while (path) {
      if (visited.has(path) || visited.size >= 20)
        throw new Error("Không tải được đầy đủ danh mục múi giờ.");
      visited.add(path);
      const page: ODataPage<DefinitionRow> = await this.transport.request({
        method: "GET",
        path,
        signal,
      });
      if (!Array.isArray(page?.value))
        throw new Error("Không đọc được danh mục múi giờ Dataverse.");
      for (const row of page.value) {
        const code = row.timezonecode;
        const label = row.userinterfacename?.trim() || row.standardname?.trim();
        if (
          typeof code === "number" &&
          Number.isInteger(code) &&
          label &&
          !options.has(code)
        )
          options.set(code, { code, label });
      }
      const next = page["@odata.nextLink"];
      path = next ? collectionPath(next, "timezonedefinitions") : undefined;
    }
    if (!options.size) throw new Error("Dataverse không trả danh mục múi giờ.");
    this.options = [...options.values()];
    return this.options;
  }

  async update(userId: string, code: number): Promise<void> {
    try {
      await this.transport.request({
        method: "PATCH",
        path: `usersettingscollection(${normalizeGuid(userId)})`,
        body: { timezonecode: code },
        etag: "*",
      });
    } catch (error) {
      if (error instanceof DataverseError && error.status === 403)
        throw new Error(
          "Tài khoản của bạn không có quyền cập nhật thiết lập người dùng này.",
        );
      if (error instanceof DataverseError && error.status === 404)
        throw new Error(
          "Không tìm thấy thiết lập người dùng. Hãy tải lại danh sách.",
        );
      throw error;
    }
  }
}
