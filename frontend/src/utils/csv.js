/**
 * Spreadsheet files: rows written as comma-separated values that Excel, Numbers and
 * Google Sheets open.
 */

/**
 * One cell: quoted when it holds a comma, quote or line break, and with a leading '
 * when it starts like a formula, so a spreadsheet shows it as text instead of running it.
 */
const cell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** A header and rows as CSV text, each line ended with CRLF. */
export const toCsv = (header, rows) =>
  [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';

/** Saves CSV text as a file in the browser's downloads, marked as UTF-8 for Excel. */
export const downloadCsv = (filename, text) => {
  const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
