function protectSpreadsheetFormula(value: string) {
    return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: unknown) {
    const safeValue = protectSpreadsheetFormula(value == null ? '' : String(value));
    return `"${safeValue.replaceAll('"', '""')}"`;
}

export function downloadCsv(headers: string[], rows: unknown[][], filename: string) {
    const content = [headers, ...rows]
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\r\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportSlug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
}
