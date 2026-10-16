export function normalizeGuid(value: string): string {
  const text = value.trim();
  const clean =
    text.startsWith("{") && text.endsWith("}") ? text.slice(1, -1) : text;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      clean,
    )
  )
    throw new Error(
      "Nhập GUID hợp lệ, ví dụ 6b429899-30c1-f111-aaaf-6045bd5a2f39.",
    );
  return clean.toLowerCase();
}
