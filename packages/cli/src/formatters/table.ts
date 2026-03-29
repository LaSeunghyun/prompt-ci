/**
 * Simple fixed-width table renderer. No external dependencies.
 */

export function renderTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  const colWidths = headers.map((_, colIdx) =>
    Math.max(...allRows.map((row) => (row[colIdx] ?? '').length)),
  );

  const separator = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
  const formatRow = (row: string[]): string =>
    row.map((cell, i) => ` ${(cell ?? '').padEnd(colWidths[i])} `).join('|');

  const lines: string[] = [
    separator,
    formatRow(headers),
    separator,
    ...rows.map(formatRow),
    separator,
  ];

  return lines.join('\n');
}
