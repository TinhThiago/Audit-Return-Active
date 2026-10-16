// Display-only recovery for names imported with UTF-8 bytes interpreted as CP1252.
// Never alters the stored row, GUID, query or audit evidence.
const cp1252 = new Map<number, number>();
const decoder = new TextDecoder("windows-1252");
for (let byte = 128; byte <= 255; byte++)
  cp1252.set(decoder.decode(Uint8Array.of(byte)).charCodeAt(0), byte);
const markers = (value: string) =>
  (
    value.match(
      /[ÃÂÆÄÅáâ][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u2010-\u203a\u20ac\u2122]/g,
    ) || []
  ).length;
export function displayRecordName(value: string): string {
  if (!markers(value)) return value;
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    const byte =
      code < 128
        ? code
        : (cp1252.get(code) ?? (code <= 255 ? code : undefined));
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  try {
    const candidate = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
    return markers(candidate) < markers(value) ? candidate : value;
  } catch {
    return value;
  }
}
