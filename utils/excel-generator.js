import ExcelJS from 'exceljs';

const HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
};
const HEADER_FONT = {
    bold: true,
    color: { argb: 'FFEBC246' },
    size: 12,
};
const TITLE_FONT = {
    bold: true,
    color: { argb: 'FFEBC246' },
    size: 16,
};
const SUBTITLE_FONT = {
    italic: true,
    color: { argb: 'FFC6C6CD' },
    size: 11,
};
const BORDER = {
    top: { style: 'thin', color: { argb: 'FF45464C' } },
    left: { style: 'thin', color: { argb: 'FF45464C' } },
    bottom: { style: 'thin', color: { argb: 'FF45464C' } },
    right: { style: 'thin', color: { argb: 'FF45464C' } },
};

export const generateStatsExcelBuffer = async (
    title,
    headers,
    rows,
    options = {}
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AISentinel';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(title.slice(0, 31), {
        properties: { tabColor: { argb: 'FFEBC246' } },
    });

    const titleRow = sheet.addRow([title]);
    titleRow.font = TITLE_FONT;
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
    sheet.getRow(titleRow.number).height = 26;

    if (options.subtitle) {
        const subRow = sheet.addRow([options.subtitle]);
        subRow.font = SUBTITLE_FONT;
        subRow.alignment = { horizontal: 'center' };
        sheet.mergeCells(subRow.number, 1, subRow.number, headers.length);
    }

    sheet.addRow([]);

    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = BORDER;
    });
    headerRow.height = 22;

    rows.forEach((row, index) => {
        const dataRow = sheet.addRow(row);
        dataRow.eachCell((cell, colNumber) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = BORDER;
            if (colNumber === 1) {
                cell.font = { bold: true, color: { argb: 'FFEBC246' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1C2B3C' },
                };
            } else {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: index % 2 === 0 ? 'FF122131' : 'FF0D1C2D' },
                };
                cell.font = { color: { argb: 'FFD4E4FA' } };
            }
        });
    });

    const widths = options.columnWidths || headers.map((h) => Math.max(15, String(h).length + 4));
    widths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
    });

    const footerRow = sheet.addRow([]);
    const generatedRow = sheet.addRow([
        `Generado el: ${new Date().toLocaleString('es-GT')}`,
    ]);
    generatedRow.font = SUBTITLE_FONT;
    generatedRow.alignment = { horizontal: 'right' };
    sheet.mergeCells(
        generatedRow.number,
        1,
        generatedRow.number,
        headers.length
    );

    return await workbook.xlsx.writeBuffer();
};
