import type { StatusOption, TableMetadata } from "./types";
export type ActiveDecision =
  | { kind: "ready"; state: number; status: number; options: StatusOption[] }
  | { kind: "chooseStatus"; state: number; options: StatusOption[] }
  | { kind: "unsupported"; reason: string };
export function resolveStateTarget(
  table: TableMetadata,
  selectedStatus?: number,
  targetName: "Active" | "Inactive" = "Active",
): ActiveDecision {
  const active = table.states.find((s) => s.invariantName === "Active");
  const inactive = table.states.find((s) => s.invariantName === "Inactive");
  if (
    table.isActivity ||
    table.states.length !== 2 ||
    !active ||
    !inactive ||
    active.value === inactive.value
  )
    return {
      kind: "unsupported",
      reason:
        "Table này không có vòng đời Active/Inactive tổng quát. Cần dùng thao tác nghiệp vụ riêng.",
    };
  const target = targetName === "Active" ? active : inactive;
  const options = table.statuses.filter(
    (s) => s.state === target.value && Number.isInteger(s.value),
  );
  if (!options.length)
    return {
      kind: "unsupported",
      reason: `Metadata không cung cấp status reason ${targetName} hợp lệ.`,
    };
  if (selectedStatus !== undefined) {
    if (!options.some((s) => s.value === selectedStatus))
      return {
        kind: "unsupported",
        reason: `Status reason không thuộc trạng thái ${targetName}.`,
      };
    return {
      kind: "ready",
      state: target.value,
      status: selectedStatus,
      options,
    };
  }
  const status =
    options.find((s) => s.value === target.defaultStatus)?.value ??
    (options.length === 1 ? options[0].value : undefined);
  if (status === undefined)
    return { kind: "chooseStatus", state: target.value, options };
  return { kind: "ready", state: target.value, status, options };
}

export const resolveActiveTarget = (table: TableMetadata, status?: number) =>
  resolveStateTarget(table, status, "Active");
export const resolveInactiveTarget = (table: TableMetadata, status?: number) =>
  resolveStateTarget(table, status, "Inactive");
