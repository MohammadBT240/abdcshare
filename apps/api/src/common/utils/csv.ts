/** Minimal, correct CSV parse/stringify (RFC-4180-ish: quotes, escaped quotes, CRLF). No deps. */

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  const keys = header!.map((h) => h.trim());
  return body
    .filter((r) => r.some((c) => c.trim() !== '')) // skip blank lines
    .map((r) => {
      const obj: Record<string, string> = {};
      keys.forEach((k, i) => (obj[k] = (r[i] ?? '').trim()));
      return obj;
    });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return lines.join('\n');
}
