// Ekspor CSV di browser (tampilan saja, tidak memanggil backend).

export interface CsvSection {
  title: string;
  header: string[];
  rows: (string | number | null | undefined)[][];
}

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function buildCsv(sections: CsvSection[]): string {
  // "sep=," membuat Excel (termasuk setelan regional Indonesia) memakai koma sebagai pemisah
  const lines: string[] = ['sep=,'];
  sections.forEach((section, i) => {
    if (i > 0) lines.push('');
    lines.push(cell(section.title));
    lines.push(section.header.map(cell).join(','));
    section.rows.forEach((row) => lines.push(row.map(cell).join(',')));
  });
  return lines.join('\r\n');
}

export function downloadCsv(filenameBase: string, sections: CsvSection[]) {
  const stamp = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const name = `${filenameBase}_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.csv`;
  const blob = new Blob(['﻿', buildCsv(sections)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fmtClock = (t: number | string) => new Date(t).toLocaleTimeString('en-GB', { hour12: false });
