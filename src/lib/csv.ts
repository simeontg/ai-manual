// Excel/Sheets-friendly CSV: CRLF, RFC4180 quoting, UTF-8 BOM
function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
